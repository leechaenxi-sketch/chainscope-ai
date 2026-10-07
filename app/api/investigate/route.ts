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

type TokenTransferSummary = {
  hash: string;
  from: string;
  to: string;
  direction: "IN" | "OUT";
  amount: string;
  symbol: string;
  tokenName: string;
  contractAddress: string;
  time: string;
  blockNumber: string;
};

type InternalTransactionSummary = {
  hash: string;
  from: string;
  to: string;
  direction: "IN" | "OUT";
  valueEth: string;
  type: string;
  time: string;
  blockNumber: string;
  isError?: string;
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
      tokenTransfers,
      internalTransactions,
      analyzedTransactionCount,
      analyzedTokenTransferCount,
      analyzedInternalTransactionCount,
      evidenceTransactionCount,
      evidenceTokenTransferCount,
      evidenceInternalTransactionCount,
    }: {
      address: string;
      balance: string;
      riskScore: number;
      riskLevel: string;
      anomalies: Anomaly[];
      transactions: TransactionSummary[];
      tokenTransfers: TokenTransferSummary[];
      internalTransactions: InternalTransactionSummary[];
      analyzedTransactionCount: number;
      analyzedTokenTransferCount: number;
      analyzedInternalTransactionCount: number;
      evidenceTransactionCount: number;
      evidenceTokenTransferCount: number;
      evidenceInternalTransactionCount: number;
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
### ETH 普通交易 ${index + 1}

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
        : "没有普通 ETH 交易证据样本。";

    const tokenText =
      tokenTransfers.length > 0
        ? tokenTransfers
            .map(
              (tx, index) => `
### ERC-20 转账 ${index + 1}

- 方向：${tx.direction}
- Token：${tx.tokenName} (${tx.symbol})
- 数量：${tx.amount} ${tx.symbol}
- Tx Hash：${tx.hash}
- From：${tx.from}
- To：${tx.to}
- Token Contract：${tx.contractAddress}
- Block：${tx.blockNumber}
- 时间：${tx.time}
`
            )
            .join("\n")
        : "没有 ERC-20 Token 转账证据样本。";

    const internalText =
      internalTransactions.length > 0
        ? internalTransactions
            .map(
              (tx, index) => `
### Internal Transaction ${index + 1}

- 方向：${tx.direction}
- 金额：${tx.valueEth} ETH
- 调用类型：${tx.type || "unknown"}
- Tx Hash：${tx.hash}
- From：${tx.from}
- To：${tx.to}
- Block：${tx.blockNumber}
- 时间：${tx.time}
- 是否失败：${tx.isError === "1" ? "是" : "否"}
`
            )
            .join("\n")
        : "没有 Internal Transaction 证据样本。";

    const systemPrompt = `
你是 ChainScope AI，一个 Ethereum 链上资金行为调查助手。

当前系统已经从三个数据源获取证据：

1. 普通 ETH Transactions
2. ERC-20 Token Transfers
3. Internal Transactions

你的职责是解释这些真实链上证据，而不是创造新的事实。

必须遵守：

1. 不得编造地址身份、攻击、诈骗、洗钱、制裁、协议归属或资金来源。
2. 异常行为不等于恶意行为。
3. 必须区分“事实”和“可能解释”。
4. 结论必须尽可能对应真实 Tx Hash。
5. 证据不足时必须明确说明不确定。
6. Risk Score 是实验性启发式评分，不是正式安全评级。
7. 必须使用简体中文。
8. 输出标准 Markdown。
9. 从二级标题开始，不要使用一级标题。
10. 不得声称执行了程序实际没有执行的分析。
`;

    const userPrompt = `
调查地址：

${address}

当前 ETH Balance：

${balance} ETH

Risk Score：

${riskScore}/100

Risk Level：

${riskLevel}

## 数据规模

普通 ETH Transactions：

- 系统分析：${analyzedTransactionCount} 笔
- AI 详细阅读：${evidenceTransactionCount} 笔

ERC-20 Token Transfers：

- 系统分析：${analyzedTokenTransferCount} 笔
- AI 详细阅读：${evidenceTokenTransferCount} 笔

Internal Transactions：

- 系统分析：${analyzedInternalTransactionCount} 笔
- AI 详细阅读：${evidenceInternalTransactionCount} 笔

## 异常检测结果

${anomalyText}

## 普通 ETH 交易

${transactionText}

## ERC-20 Token 转账

${tokenText}

## Internal Transactions

${internalText}

请生成专业、简洁、适合黑客松 Demo 的调查报告。

严格使用：

## 执行摘要

概括：
- 钱包主要资金行为
- 三类链上数据之间的关系
- Risk Score
- 最重要异常
- 不要把异常直接等同于恶意

## 主要发现

编号列出关键发现。

每个发现必须包含：

**发现名称**

- 观测事实
- 对应数据来源
- 为什么异常
- 可能解释
- 风险意义

## 多来源资金行为分析

### 普通 ETH 行为

### ERC-20 Token 行为

### Internal Transactions 行为

说明三者之间有没有明显关联。

## 关键证据

Markdown 表格：

| 数据源 | 资产/行为 | Tx Hash | 方向 | 说明 |
| --- | --- | --- | --- | --- |

只能引用真实提供的 Tx Hash。

## 风险解释

解释：

- ${riskScore}/100 的意义
- 哪些异常贡献最大
- 为什么异常 ≠ 恶意

## 建议进一步调查

给出 3～6 条建议，例如：

- 更长历史窗口
- 地址标签
- 对手方画像
- DeFi 协议识别
- Token 资金去向
- 合约调用语义

不能声称已经完成。

## 置信度与局限性

必须说明：

- 当前数据样本有限
- 三类数据源均只获取最近部分记录
- 当前规则属于 MVP 启发式规则
- 尚未完成完整地址标签和协议语义识别
- Risk Score 不是正式安全评级

最后写：

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
    console.error(
      "DeepSeek investigation error:",
      error
    );

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