import { NextRequest, NextResponse } from "next/server";
import { ProxyAgent, fetch as undiciFetch } from "undici";

type Language = "zh" | "en";

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

type CounterpartySummary = {
  address: string;
  interactionCount: number;
  outgoingCount: number;
  incomingCount: number;
  ethOut: string;
  ethIn: string;
  tokenEventCount: number;
  internalEventCount: number;
  sources: string[];
  tokenSymbols: string[];
  lastInteraction: string;
};

type SecondHopSummary = {
  investigatedAddress: string;
  selectedFromAddress: string;
  selectionReason: string;

  transactionCount: number;
  tokenTransferCount: number;
  internalTransactionCount: number;

  totalObservedEvents: number;

  topCounterparties: {
    address: string;
    interactionCount: number;
    outgoingCount: number;
    incomingCount: number;
    ethOut: string;
    ethIn: string;
    sources: string[];
    tokenSymbols: string[];
  }[];

  linksBackToRoot: boolean;
  rootInteractionCount: number;
};

// ============================================================
// 防滥用：限流 + 报告缓存
// ============================================================

const RATE_LIMIT_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 10 * 60_000;

const rateLimitMap = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();

const reportCache = new Map<
  string,
  {
    report: string;
    model: string;
    cachedAt: number;
  }
>();

function getClientIp(request: NextRequest) {
  const xff = request.headers.get("x-forwarded-for");

  if (xff) {
    return xff.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function hitRateLimit(ip: string) {
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

function cleanupCache() {
  const now = Date.now();

  if (reportCache.size < 500) {
    return;
  }

  for (const [key, value] of reportCache) {
    if (now - value.cachedAt >= CACHE_TTL_MS) {
      reportCache.delete(key);
    }
  }
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
      counterparties,
      secondHop,

      analyzedTransactionCount,
      analyzedTokenTransferCount,
      analyzedInternalTransactionCount,

      evidenceTransactionCount,
      evidenceTokenTransferCount,
      evidenceInternalTransactionCount,

      language,
    }: {
      address: string;
      balance: string;
      riskScore: number;
      riskLevel: string;

      anomalies: Anomaly[];

      transactions: TransactionSummary[];
      tokenTransfers: TokenTransferSummary[];
      internalTransactions: InternalTransactionSummary[];

      counterparties: CounterpartySummary[];

      secondHop?: SecondHopSummary | null;

      analyzedTransactionCount: number;
      analyzedTokenTransferCount: number;
      analyzedInternalTransactionCount: number;

      evidenceTransactionCount: number;
      evidenceTokenTransferCount: number;
      evidenceInternalTransactionCount: number;

      language?: Language;
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

    const selectedLanguage: Language =
      language === "en" ? "en" : "zh";

    const normalizedAddress = address.trim().toLowerCase();

    cleanupCache();

    // 中文 / 英文使用不同缓存
    const cacheKey = `v4:${selectedLanguage}:${normalizedAddress}`;

    const cached = reportCache.get(cacheKey);

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

    const clientIp = getClientIp(request);

    if (hitRateLimit(clientIp)) {
      return NextResponse.json(
        {
          error:
            selectedLanguage === "zh"
              ? `请求过于频繁，请稍后再试。每分钟最多生成 ${RATE_LIMIT_PER_WINDOW} 次新的 AI 调查报告。`
              : `Too many requests. You may generate up to ${RATE_LIMIT_PER_WINDOW} new AI reports per minute.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        }
      );
    }

    const anomalyText =
      anomalies?.length > 0
        ? anomalies
            .map(
              (item, index) => `
### Signal ${index + 1}

- Type: ${item.type}
- Severity: ${item.severity}
- Risk contribution: ${item.score}
- Description: ${item.description}
- Evidence transaction: ${item.evidenceHash || "N/A"}
`
            )
            .join("\n")
        : "No major anomaly signals were detected by the current rules.";

    const transactionText =
      transactions?.length > 0
        ? transactions
            .map(
              (tx, index) => `
### ETH Transaction ${index + 1}

- Direction: ${tx.direction}
- Amount: ${tx.valueEth} ETH
- Tx Hash: ${tx.hash}
- From: ${tx.from}
- To: ${tx.to}
- Block: ${tx.blockNumber}
- Time: ${tx.time}
`
            )
            .join("\n")
        : "No normal ETH transaction evidence is available.";

    const tokenText =
      tokenTransfers?.length > 0
        ? tokenTransfers
            .map(
              (tx, index) => `
### ERC-20 Transfer ${index + 1}

- Direction: ${tx.direction}
- Token: ${tx.tokenName} (${tx.symbol})
- Amount: ${tx.amount} ${tx.symbol}
- Tx Hash: ${tx.hash}
- From: ${tx.from}
- To: ${tx.to}
- Token Contract: ${tx.contractAddress}
- Block: ${tx.blockNumber}
- Time: ${tx.time}
`
            )
            .join("\n")
        : "No ERC-20 token transfer evidence is available.";

    const internalText =
      internalTransactions?.length > 0
        ? internalTransactions
            .map(
              (tx, index) => `
### Internal Transaction ${index + 1}

- Direction: ${tx.direction}
- Amount: ${tx.valueEth} ETH
- Call Type: ${tx.type || "unknown"}
- Tx Hash: ${tx.hash}
- From: ${tx.from}
- To: ${tx.to}
- Block: ${tx.blockNumber}
- Time: ${tx.time}
- Failed: ${tx.isError === "1" ? "Yes" : "No"}
`
            )
            .join("\n")
        : "No internal transaction evidence is available.";

    const counterpartyText =
      counterparties?.length > 0
        ? counterparties
            .slice(0, 10)
            .map(
              (item, index) => `
### Counterparty ${index + 1}

- Address: ${item.address}
- Interaction Events: ${item.interactionCount}
- Outgoing Events: ${item.outgoingCount}
- Incoming Events: ${item.incomingCount}
- ETH Out: ${item.ethOut} ETH
- ETH In: ${item.ethIn} ETH
- ERC-20 Events: ${item.tokenEventCount}
- Internal Events: ${item.internalEventCount}
- Sources: ${item.sources.join(", ")}
- Tokens: ${
                item.tokenSymbols.length
                  ? item.tokenSymbols.join(", ")
                  : "None"
              }
- Last Interaction: ${item.lastInteraction}
`
            )
            .join("\n")
        : "No sufficient counterparty information is available.";

    const secondHopText = secondHop
      ? `
### Automated Second-Hop Investigation

- Root Address: ${secondHop.selectedFromAddress}
- Selected First-Hop Counterparty: ${secondHop.investigatedAddress}
- Selection Reason: ${secondHop.selectionReason}
- ETH Transaction Sample: ${secondHop.transactionCount}
- ERC-20 Sample: ${secondHop.tokenTransferCount}
- Internal Transaction Sample: ${secondHop.internalTransactionCount}
- Total Observed Events: ${secondHop.totalObservedEvents}
- Root Address Observed Again: ${
          secondHop.linksBackToRoot ? "Yes" : "No"
        }
- Observed Events With Root: ${secondHop.rootInteractionCount}

Second-Hop Counterparties:

${
  secondHop.topCounterparties.length
    ? secondHop.topCounterparties
        .map(
          (item, index) => `
#### Connected Address ${index + 1}

- Address: ${item.address}
- Interaction Events: ${item.interactionCount}
- Outgoing Events: ${item.outgoingCount}
- Incoming Events: ${item.incomingCount}
- ETH Out: ${item.ethOut}
- ETH In: ${item.ethIn}
- Sources: ${item.sources.join(", ")}
- Tokens: ${
            item.tokenSymbols.length
              ? item.tokenSymbols.join(", ")
              : "None"
          }
`
        )
        .join("\n")
    : "No sufficient second-hop counterparty information is available."
}
`
      : "No valid second-hop investigation was completed.";

    const isZh = selectedLanguage === "zh";

    const systemPrompt = isZh
      ? `
你是 ChainScope AI，一个 Ethereum 链上资金行为调查 Agent。

系统提供：

1. 普通 ETH Transactions
2. ERC-20 Token Transfers
3. Internal Transactions
4. Counterparty Aggregation
5. 自动 Second-Hop Investigation

必须严格遵守：

1. 不得编造身份、诈骗、攻击、洗钱、制裁、协议归属或资金来源。
2. 异常行为不等于恶意行为。
3. 对手方行为不能自动归因于根地址。
4. 二跳地址行为不能直接计入根地址 Risk Score。
5. Risk Score 只基于根地址确定性启发式规则。
6. 必须区分链上事实、程序计算结果和可能解释。
7. 证据不足时必须明确说明不确定。
8. 必须使用简体中文。
9. 输出标准 Markdown。
10. 从二级标题开始。
11. 不得声称执行了系统实际上没有执行的分析。
`
      : `
You are ChainScope AI, an Ethereum on-chain investigation agent.

The system provides:

1. Normal ETH Transactions
2. ERC-20 Token Transfers
3. Internal Transactions
4. Counterparty Aggregation
5. Automated Second-Hop Investigation

You must follow these rules:

1. Never invent identities, scams, hacks, money laundering, sanctions, protocol ownership, or sources of funds.
2. Anomalous behavior does not prove malicious behavior.
3. Counterparty behavior must not automatically be attributed to the root address.
4. Second-hop behavior must not be included directly in the root Risk Score.
5. The Risk Score is based only on deterministic heuristic rules for the root address.
6. Clearly distinguish blockchain facts, program calculations, and interpretations.
7. Clearly express uncertainty when evidence is insufficient.
8. Write entirely in English.
9. Use standard Markdown.
10. Start from level-two headings.
11. Never claim that the system performed an investigation it did not actually perform.
`;

    const userPrompt = isZh
      ? `
调查地址：

${address}

当前 ETH Balance：

${balance} ETH

Risk Score：

${riskScore}/100

Risk Level：

${riskLevel}

## 数据规模

普通 ETH：
- 系统分析：${analyzedTransactionCount}
- AI 详细阅读：${evidenceTransactionCount}

ERC-20：
- 系统分析：${analyzedTokenTransferCount}
- AI 详细阅读：${evidenceTokenTransferCount}

Internal：
- 系统分析：${analyzedInternalTransactionCount}
- AI 详细阅读：${evidenceInternalTransactionCount}

## 异常信号

${anomalyText}

## 普通 ETH 证据

${transactionText}

## ERC-20 证据

${tokenText}

## Internal 证据

${internalText}

## 第一跳对手方

${counterpartyText}

## 二跳调查

${secondHopText}

请生成一份专业、简洁、适合黑客松 Demo 的中文 Ethereum 调查报告。

严格使用：

## 执行摘要

## 主要发现

## 第一跳资金关系

## 二跳调查结果

必须明确说明：
二跳地址与根地址的关联不意味着共同身份、共同控制或恶意关系。

## 多来源行为分析

### 普通 ETH

### ERC-20

### Internal Transactions

### 跨来源关联

## 关键证据

使用：

| 层级 | 数据源 | 地址 / Tx Hash | 行为 | 说明 |
| --- | --- | --- | --- | --- |

## 风险解释

解释 ${riskScore}/100 的意义，以及为什么异常不等于恶意。

## 建议进一步调查

## 置信度与局限性

必须说明：

- 当前数据基于有限最近样本
- 二跳只自动追踪一个主要第一跳对手方
- 二跳结果不直接影响根地址 Risk Score
- 当前没有完整地址实体标签
- 当前没有完整协议语义识别
- 当前属于 MVP 启发式分析
- AI 只解释系统提供的证据

最后写：

> 本报告用于链上行为调查辅助，不构成对任何地址所有者身份、意图或合法性的判断。
`
      : `
Investigated Address:

${address}

Current ETH Balance:

${balance} ETH

Risk Score:

${riskScore}/100

Risk Level:

${riskLevel}

## Data Scope

Normal ETH:
- Program analyzed: ${analyzedTransactionCount}
- AI detailed evidence: ${evidenceTransactionCount}

ERC-20:
- Program analyzed: ${analyzedTokenTransferCount}
- AI detailed evidence: ${evidenceTokenTransferCount}

Internal:
- Program analyzed: ${analyzedInternalTransactionCount}
- AI detailed evidence: ${evidenceInternalTransactionCount}

## Anomaly Signals

${anomalyText}

## ETH Evidence

${transactionText}

## ERC-20 Evidence

${tokenText}

## Internal Evidence

${internalText}

## First-Hop Counterparties

${counterpartyText}

## Second-Hop Investigation

${secondHopText}

Generate a professional and concise Ethereum investigation report suitable for a hackathon demo.

Use exactly this structure:

## Executive Summary

## Key Findings

## First-Hop Relationships

## Second-Hop Investigation

Explicitly state that second-hop relationships do not prove shared identity, ownership, control, or malicious intent.

## Multi-Source Behavior Analysis

### Normal ETH

### ERC-20

### Internal Transactions

### Cross-Source Relationships

## Key Evidence

Use:

| Layer | Source | Address / Tx Hash | Behavior | Notes |
| --- | --- | --- | --- | --- |

## Risk Interpretation

Explain the meaning of ${riskScore}/100 and why anomalous behavior does not prove malicious intent.

## Recommended Next Steps

## Confidence & Limitations

Explicitly state:

- The investigation uses a limited recent sample.
- Only one primary first-hop counterparty is automatically traced.
- Second-hop behavior does not directly affect the root Risk Score.
- Full entity attribution is not currently available.
- Full protocol semantic interpretation is not currently available.
- Current detection rules are MVP heuristics.
- AI only explains evidence supplied by the system.

End with:

> This report is intended to assist on-chain investigation and does not determine the identity, intent, or legality of any address owner.
`;

    const proxyUrl =
      process.env.HTTPS_PROXY || process.env.HTTP_PROXY;

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

    const model = data.model || "deepseek-chat";

    reportCache.set(cacheKey, {
      report,
      model,
      cachedAt: Date.now(),
    });

    return NextResponse.json({
      report,
      model,
      cached: false,
      language: selectedLanguage,
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