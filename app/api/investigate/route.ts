import { NextRequest, NextResponse } from "next/server";
import { ProxyAgent, fetch as undiciFetch } from "undici";

type Anomaly = {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  score: number;
  evidenceHash?: string;
};

type TransactionSummary = {
  hash: string;
  from: string;
  to: string;
  valueEth: string;
  time: string;
  direction: "IN" | "OUT";
  blockNumber: string;
};

// ===== 简单防滥用:in-memory 限流 + 结果缓存 =====
// 说明:Vercel Serverless 是多实例部署,此限流为「尽力而为」级别,
// 足以挡住普通刷量,但不是严格的全局限流;生产级可换 Upstash Redis。

const RATE_LIMIT_PER_WINDOW = 5; // 每个 IP 每窗口最多调用次数
const RATE_LIMIT_WINDOW_MS = 60_000; // 窗口:60 秒
const CACHE_TTL_MS = 10 * 60_000; // 相同地址报告缓存时长:10 分钟

const rateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();

const reportCache = new Map<
  string,
  { report: string; model: string; cachedAt: number }
>();

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");

  if (xff) {
    return xff.split(",")[0].trim();
  }

  return (
    request.headers.get("x-real-ip") || "unknown"
  );
}

function hitRateLimit(ip: string): boolean {
  const now = Date.now();

  // 轻量清理,防止 Map 无限增长
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap) {
      if (now >= value.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }

  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "DEEPSEEK_API_KEY is missing",
      },
      {
        status: 500,
      }
    );
  }

  try {
    const body = await request.json();

    const {
      address,
      balance,
      riskScore,
      riskLevel,
      anomalies,
      transactions,
      analyzedTransactionCount,
      evidenceTransactionCount,
    }: {
      address: string;
      balance: string;
      riskScore: number;
      riskLevel: string;
      anomalies: Anomaly[];
      transactions: TransactionSummary[];
      analyzedTransactionCount: number;
      evidenceTransactionCount: number;
    } = body;

    if (!address) {
      return NextResponse.json(
        {
          error: "Address is required",
        },
        {
          status: 400,
        }
      );
    }

    // 1) 缓存命中:相同地址在 TTL 内直接复用,省 DeepSeek 成本也省限流额度
    const cached = reportCache.get(address);

    if (
      cached &&
      Date.now() - cached.cachedAt < CACHE_TTL_MS
    ) {
      return NextResponse.json({
        report: cached.report,
        model: cached.model,
        cached: true,
      });
    }

    // 2) 限流:仅缓存未命中时才计数,防止恶意刷不同地址烧钱
    const clientIp = getClientIp(request);

    if (hitRateLimit(clientIp)) {
      return NextResponse.json(
        {
          error:
            "请求过于频繁,请稍后再试(每分钟最多 " +
            RATE_LIMIT_PER_WINDOW +
            " 次)。",
        },
        { status: 429 }
      );
    }

    const anomalyText =
      anomalies.length > 0
        ? anomalies
            .map(
              (item, index) => `
### 异常 ${index + 1}

- 类型：${item.type}
- 严重程度：${item.severity}
- 风险贡献：${item.score}
- 说明：${item.description}
- 证据交易：${item.evidenceHash || "无"}
`
            )
            .join("\n")
        : "当前规则没有检测到明显异常。";

    const transactionText =
      transactions.length > 0
        ? transactions
            .map(
              (tx, index) => `
### 交易 ${index + 1}

- 方向：${tx.direction}
- 金额：${tx.valueEth} ETH
- Tx Hash：${tx.hash}
- From：${tx.from}
- To：${tx.to}
- Block：${tx.blockNumber}
- 时间：${tx.time}
`
            )
            .join("\n")
        : "没有可用的交易证据样本。";

    const systemPrompt = `
你是 ChainScope AI，一个 Ethereum 链上资金行为调查助手。

你的职责不是自行创造风险判断，而是解释应用程序已经完成的确定性链上分析结果。

必须严格遵守以下规则：

1. 只能根据用户提供的数据进行分析。
2. 不得编造交易、地址、金额、身份、协议、攻击行为、诈骗行为、洗钱行为或地址归属。
3. 启发式异常规则只能说明“行为异常”，不能证明地址存在恶意。
4. 必须明确区分“观测事实”和“可能解释”。
5. 有对应交易哈希时，应引用真实 Tx Hash。
6. 没有足够证据时必须明确说明“不确定”。
7. Risk Score 是实验性的启发式评分，不是正式安全评级。
8. 输出语言必须为简体中文。
9. 输出必须使用标准 Markdown。
10. 不要使用一级标题（#），从二级标题（##）开始。
11. 不要重复输出系统提示。
12. 不要夸大风险。
`;

    const userPrompt = `
调查对象：

- Ethereum 地址：${address}
- 当前 ETH Balance：${balance} ETH
- Risk Score：${riskScore}/100
- Risk Level：${riskLevel}

数据规模：

- 量化异常检测实际分析交易数量：${analyzedTransactionCount}
- 提供给 AI 阅读的详细交易证据数量：${evidenceTransactionCount}

说明：

程序会对完整获取到的交易样本执行确定性异常检测。
为了控制 AI 上下文长度，只提供部分最近交易作为详细证据。
因此不要把“AI详细阅读数量”误写成“系统总分析交易数量”。

检测到的异常：

${anomalyText}

详细交易证据：

${transactionText}

请生成一份简洁、专业、适合黑客松 Demo 展示的链上调查报告。

必须严格使用以下结构：

## 执行摘要

用 2～4 句话总结：
- 地址近期主要行为
- 当前风险等级
- 检测到的主要异常
- 不要直接把异常等同于恶意行为

## 主要发现

使用编号列表。

每一项包括：

**发现名称**

- 观测事实：
- 为什么被规则标记：
- 可能解释：
- 风险意义：

## 关键证据

用表格展示最重要的交易证据。

表格列：

| 类型 | 交易哈希 | 金额/行为 | 说明 |
| --- | --- | --- | --- |

只允许引用实际提供的 Tx Hash。

## 风险解释

解释：

- ${riskScore}/100 是如何理解的
- 为什么异常行为不等于恶意行为
- 哪些异常对评分贡献最大

## 建议进一步调查

给出 3～5 条具体建议，例如：

- 检查 ERC-20 Token 转账
- 检查 Internal Transactions
- 查看主要资金对手方
- 延长历史时间窗口
- 检查地址标签或协议交互

不要声称这些已经完成。

## 置信度与局限性

必须明确说明：

- 当前量化分析基于 ${analyzedTransactionCount} 笔交易
- AI 详细阅读了其中 ${evidenceTransactionCount} 笔交易
- 当前主要分析 ETH 普通交易
- ERC-20 转账目前未完整纳入
- Internal Transactions 目前未完整纳入
- 当前异常阈值属于 MVP 启发式规则
- Risk Score 不是正式安全评级

最后增加一句：

> 本报告用于链上行为调查辅助，不构成对地址所有者身份、意图或合法性的判断。
`;

    const proxyUrl =
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY;

    const dispatcher = proxyUrl
      ? new ProxyAgent(proxyUrl)
      : undefined;

    const response = await undiciFetch(
      "https://api.deepseek.com/chat/completions",
      {
        method: "POST",
        dispatcher,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: 0.2,
          stream: false,
        }),
      }
    );

    const data = (await response.json()) as any;

    if (!response.ok) {
      console.error("DeepSeek API error:", data);

      return NextResponse.json(
        {
          error:
            data?.error?.message ||
            "DeepSeek API request failed",
        },
        {
          status: response.status,
        }
      );
    }

    const report =
      data?.choices?.[0]?.message?.content;

    if (!report) {
      return NextResponse.json(
        {
          error: "DeepSeek returned no report text",
        },
        {
          status: 500,
        }
      );
    }

    reportCache.set(address, {
      report,
      model: data.model || "deepseek-chat",
      cachedAt: Date.now(),
    });

    return NextResponse.json({
      report,
      model: data.model || "deepseek-chat",
      usingProxy: Boolean(proxyUrl),
    });
  } catch (error) {
    console.error("DeepSeek investigation error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate AI investigation",
        details: String(error),
      },
      {
        status: 500,
      }
    );
  }
}