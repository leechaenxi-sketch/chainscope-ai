import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ProxyAgent,
  fetch as undiciFetch,
} from "undici";

type Language =
  | "zh"
  | "en";

type Anomaly = {
  type: string;
  severity:
    | "LOW"
    | "MEDIUM"
    | "HIGH";
  description: string;
  score: number;
  evidenceHash?: string;
};

type ChangeMetric = {
  key: string;

  labelZh: string;
  labelEn: string;

  baseline: number;
  recent: number;

  unitZh: string;
  unitEn: string;

  direction:
    | "UP"
    | "DOWN"
    | "STABLE";

  magnitude: number;
  important: boolean;

  explanationZh: string;
  explanationEn: string;
};

type CauseHypothesis = {
  id: string;

  titleZh: string;
  titleEn: string;

  confidence:
    | "LOW"
    | "MEDIUM"
    | "HIGH";

  evidenceZh: string[];
  evidenceEn: string[];

  explanationZh: string;
  explanationEn: string;
};

type ImpactItem = {
  id: string;

  categoryZh: string;
  categoryEn: string;

  titleZh: string;
  titleEn: string;

  descriptionZh: string;
  descriptionEn: string;

  severity:
    | "LOW"
    | "MEDIUM"
    | "HIGH";
};

type ChangeAnalysis = {
  recentStart: number;
  baselineStart: number;

  metrics: ChangeMetric[];

  causes: CauseHypothesis[];

  impacts: ImpactItem[];

  summaryZh: string;
  summaryEn: string;
};

type TransactionSummary = {
  hash: string;
  from: string;
  to: string;
  valueEth: string;
  time: string;
  direction:
    | "IN"
    | "OUT";
  blockNumber: string;
};

type TokenTransferSummary = {
  hash: string;
  from: string;
  to: string;
  direction:
    | "IN"
    | "OUT";
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
  direction:
    | "IN"
    | "OUT";
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
// 防滥用
// ============================================================

const RATE_LIMIT_PER_WINDOW =
  5;

const RATE_LIMIT_WINDOW_MS =
  60_000;

const CACHE_TTL_MS =
  10 *
  60_000;

const rateLimitMap =
  new Map<
    string,
    {
      count:
        number;

      resetAt:
        number;
    }
  >();

const reportCache =
  new Map<
    string,
    {
      report:
        string;

      model:
        string;

      cachedAt:
        number;
    }
  >();

function getClientIp(
  request:
    NextRequest
) {
  const xff =
    request.headers.get(
      "x-forwarded-for"
    );

  if (
    xff
  ) {
    return xff
      .split(
        ","
      )[0]
      .trim();
  }

  return (
    request.headers.get(
      "x-real-ip"
    ) ||
    "unknown"
  );
}

function hitRateLimit(
  ip:
    string
) {
  const now =
    Date.now();

  if (
    rateLimitMap.size >
    1000
  ) {
    for (
      const [
        key,
        value,
      ] of rateLimitMap
    ) {
      if (
        now >=
        value.resetAt
      ) {
        rateLimitMap.delete(
          key
        );
      }
    }
  }

  const entry =
    rateLimitMap.get(
      ip
    );

  if (
    !entry ||
    now >=
      entry.resetAt
  ) {
    rateLimitMap.set(
      ip,
      {
        count:
          1,

        resetAt:
          now +
          RATE_LIMIT_WINDOW_MS,
      }
    );

    return false;
  }

  entry.count +=
    1;

  return (
    entry.count >
    RATE_LIMIT_PER_WINDOW
  );
}

function cleanupCache() {
  const now =
    Date.now();

  if (
    reportCache.size <
    500
  ) {
    return;
  }

  for (
    const [
      key,
      value,
    ] of reportCache
  ) {
    if (
      now -
        value.cachedAt >=
      CACHE_TTL_MS
    ) {
      reportCache.delete(
        key
      );
    }
  }
}

export async function POST(
  request:
    NextRequest
) {
  const apiKey =
    process.env
      .DEEPSEEK_API_KEY;

  if (
    !apiKey
  ) {
    return NextResponse.json(
      {
        error:
          "DEEPSEEK_API_KEY is missing",
      },
      {
        status:
          500,
      }
    );
  }

  try {
    const body =
      await request.json();

    const {
      address,
      balance,

      riskScore,
      riskLevel,

      language,

      anomalies,

      changeAnalysis,

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
    }: {
      address:
        string;

      balance:
        string;

      riskScore:
        number;

      riskLevel:
        string;

      language?:
        Language;

      anomalies:
        Anomaly[];

      changeAnalysis:
        ChangeAnalysis;

      transactions:
        TransactionSummary[];

      tokenTransfers:
        TokenTransferSummary[];

      internalTransactions:
        InternalTransactionSummary[];

      counterparties:
        CounterpartySummary[];

      secondHop?:
        SecondHopSummary |
        null;

      analyzedTransactionCount:
        number;

      analyzedTokenTransferCount:
        number;

      analyzedInternalTransactionCount:
        number;

      evidenceTransactionCount:
        number;

      evidenceTokenTransferCount:
        number;

      evidenceInternalTransactionCount:
        number;
    } =
      body;

    if (
      !address
    ) {
      return NextResponse.json(
        {
          error:
            "Address is required",
        },
        {
          status:
            400,
        }
      );
    }

    const selectedLanguage:
      Language =
      language ===
      "en"
        ? "en"
        : "zh";

    const isZh =
      selectedLanguage ===
      "zh";

    const normalizedAddress =
      address
        .trim()
        .toLowerCase();

    cleanupCache();

    const cacheKey =
      `change-v1:${selectedLanguage}:${normalizedAddress}`;

    const cached =
      reportCache.get(
        cacheKey
      );

    if (
      cached &&
      Date.now() -
        cached.cachedAt <
        CACHE_TTL_MS
    ) {
      return NextResponse.json({
        report:
          cached.report,

        model:
          cached.model,

        cached:
          true,
      });
    }

    const clientIp =
      getClientIp(
        request
      );

    if (
      hitRateLimit(
        clientIp
      )
    ) {
      return NextResponse.json(
        {
          error:
            isZh
              ? `请求过于频繁，请稍后再试。每分钟最多生成 ${RATE_LIMIT_PER_WINDOW} 次新的 AI 调查报告。`
              : `Too many requests. Up to ${RATE_LIMIT_PER_WINDOW} new AI reports may be generated per minute.`,
        },
        {
          status:
            429,

          headers: {
            "Retry-After":
              "60",
          },
        }
      );
    }

    // ========================================================
    // Change Analysis
    // ========================================================

    const changeMetrics =
      changeAnalysis
        ?.metrics
        ?.filter(
          (
            item
          ) =>
            item.important
        )
        .map(
          (
            item,
            index
          ) => `
### Change ${index + 1}

- Metric: ${
            isZh
              ? item.labelZh
              : item.labelEn
          }
- Baseline: ${item.baseline} ${
            isZh
              ? item.unitZh
              : item.unitEn
          }
- Recent: ${item.recent} ${
            isZh
              ? item.unitZh
              : item.unitEn
          }
- Direction: ${item.direction}
- Explanation: ${
            isZh
              ? item.explanationZh
              : item.explanationEn
          }
`
        )
        .join(
          "\n"
        ) ||
      "No material change metrics.";

    const causeText =
      changeAnalysis
        ?.causes
        ?.map(
          (
            cause,
            index
          ) => `
### Cause Hypothesis ${index + 1}

- Hypothesis: ${
            isZh
              ? cause.titleZh
              : cause.titleEn
          }
- Confidence: ${cause.confidence}
- Evidence:
${
  (
    isZh
      ? cause.evidenceZh
      : cause.evidenceEn
  )
    .map(
      (
        x
      ) =>
        `  - ${x}`
    )
    .join(
      "\n"
    )
}
- Interpretation: ${
            isZh
              ? cause.explanationZh
              : cause.explanationEn
          }
`
        )
        .join(
          "\n"
        ) ||
      "No deterministic cause hypothesis.";

    const impactText =
      changeAnalysis
        ?.impacts
        ?.map(
          (
            impact,
            index
          ) => `
### Impact ${index + 1}

- Category: ${
            isZh
              ? impact.categoryZh
              : impact.categoryEn
          }
- Impact: ${
            isZh
              ? impact.titleZh
              : impact.titleEn
          }
- Severity: ${impact.severity}
- Explanation: ${
            isZh
              ? impact.descriptionZh
              : impact.descriptionEn
          }
`
        )
        .join(
          "\n"
        ) ||
      "No major potential impact identified.";

    // ========================================================
    // Evidence
    // ========================================================

    const anomalyText =
      anomalies?.length
        ? anomalies
            .map(
              (
                item,
                index
              ) => `
### Anomaly ${index + 1}

- Type: ${item.type}
- Severity: ${item.severity}
- Score contribution: ${item.score}
- Description: ${item.description}
- Evidence hash: ${item.evidenceHash || "N/A"}
`
            )
            .join(
              "\n"
            )
        : "No anomaly signals.";

    const transactionText =
      transactions?.length
        ? transactions
            .map(
              (
                tx,
                index
              ) => `
### ETH ${index + 1}

- Direction: ${tx.direction}
- Amount: ${tx.valueEth} ETH
- Hash: ${tx.hash}
- From: ${tx.from}
- To: ${tx.to}
- Time: ${tx.time}
`
            )
            .join(
              "\n"
            )
        : "No ETH evidence.";

    const tokenText =
      tokenTransfers?.length
        ? tokenTransfers
            .map(
              (
                tx,
                index
              ) => `
### ERC-20 ${index + 1}

- Direction: ${tx.direction}
- Token: ${tx.tokenName} (${tx.symbol})
- Amount: ${tx.amount}
- Hash: ${tx.hash}
- From: ${tx.from}
- To: ${tx.to}
- Time: ${tx.time}
`
            )
            .join(
              "\n"
            )
        : "No ERC-20 evidence.";

    const internalText =
      internalTransactions?.length
        ? internalTransactions
            .map(
              (
                tx,
                index
              ) => `
### Internal ${index + 1}

- Direction: ${tx.direction}
- Amount: ${tx.valueEth} ETH
- Type: ${tx.type}
- Hash: ${tx.hash}
- From: ${tx.from}
- To: ${tx.to}
- Time: ${tx.time}
`
            )
            .join(
              "\n"
            )
        : "No internal evidence.";

    const counterpartyText =
      counterparties?.length
        ? counterparties
            .slice(
              0,
              8
            )
            .map(
              (
                item,
                index
              ) => `
### Counterparty ${index + 1}

- Address: ${item.address}
- Events: ${item.interactionCount}
- Outgoing: ${item.outgoingCount}
- Incoming: ${item.incomingCount}
- ETH Out: ${item.ethOut}
- ETH In: ${item.ethIn}
- Sources: ${item.sources.join(", ")}
`
            )
            .join(
              "\n"
            )
        : "No counterparty evidence.";

    const secondHopText =
      secondHop
        ? `
- Investigated first-hop address: ${secondHop.investigatedAddress}
- Selection reason: ${secondHop.selectionReason}
- Observed second-hop events: ${secondHop.totalObservedEvents}
- Root observed again: ${secondHop.linksBackToRoot ? "Yes" : "No"}

Second-Hop Counterparties:

${secondHop.topCounterparties
  .map(
    (
      item,
      index
    ) => `
### Second-Hop ${index + 1}

- Address: ${item.address}
- Events: ${item.interactionCount}
- ETH Out: ${item.ethOut}
- ETH In: ${item.ethIn}
- Sources: ${item.sources.join(", ")}
`
  )
  .join(
    "\n"
  )}
`
        : "No second-hop evidence.";

    const systemPrompt =
      isZh
        ? `
你是 ChainScope AI，一个 Ethereum 链上变化调查 Agent。

你的核心任务不是简单罗列交易，而是回答：

1. 发生了什么变化？
2. 为什么可能发生这些变化？
3. 这些变化可能产生什么影响？
4. 哪些链上证据支持这些判断？
5. 哪些结论仍然存在不确定性？

必须严格遵守：

- 所有“变化”必须来自程序提供的 baseline vs recent 计算结果。
- 不得创造程序没有计算出的变化。
- 原因只能作为“假设”或“可能解释”，不能写成已确认事实。
- 不得编造地址身份、协议、攻击、诈骗、洗钱、制裁或资金来源。
- 异常不等于恶意。
- 关联关系不等于共同身份、控制或所有权。
- 第二跳行为不得直接归因于根地址。
- 第二跳结果不得直接加入根地址 Risk Score。
- 潜在影响必须写成条件性判断，例如“如果该趋势持续……”。
- AI 只负责解释程序提供的证据，不负责创造证据。
- Risk Score 是实验性 MVP 启发式评分。
- 使用简体中文。
- 使用 Markdown。
- 从 ## 开始，不要使用一级标题。
`
        : `
You are ChainScope AI, an Ethereum on-chain change investigation agent.

Your core task is not to simply list transactions. You must answer:

1. What changed?
2. Why may it have changed?
3. What could the change affect?
4. What evidence supports the explanation?
5. What remains uncertain?

Strict rules:

- Every change must come from the supplied baseline-vs-recent calculations.
- Never invent a change that was not calculated.
- Causes must remain hypotheses or possible explanations, not confirmed facts.
- Never invent identities, protocols, hacks, scams, laundering, sanctions, or sources of funds.
- Anomalous behavior does not prove malicious intent.
- Relationships do not prove shared identity, control, or ownership.
- Second-hop behavior must not be attributed directly to the root address.
- Second-hop behavior must not directly alter the root Risk Score.
- Potential impacts must be conditional, such as "if the trend continues".
- AI only explains supplied evidence.
- The Risk Score is an experimental MVP heuristic.
- Write entirely in English.
- Use Markdown starting from level-two headings.
`;

    const userPrompt =
      isZh
        ? `
调查地址：

${address}

ETH Balance：

${balance} ETH

Risk Score：

${riskScore}/100

Risk Level：

${riskLevel}

## 程序计算出的变化摘要

${changeAnalysis?.summaryZh || "无"}

## What Changed

${changeMetrics}

## 程序生成的原因假设

${causeText}

## 程序生成的潜在影响

${impactText}

## 异常证据

${anomalyText}

## ETH 证据

${transactionText}

## ERC-20 证据

${tokenText}

## Internal 证据

${internalText}

## 直接对手方

${counterpartyText}

## Second-Hop 验证

${secondHopText}

## 数据规模

ETH：
- 程序分析 ${analyzedTransactionCount}
- AI 阅读 ${evidenceTransactionCount}

ERC-20：
- 程序分析 ${analyzedTokenTransferCount}
- AI 阅读 ${evidenceTokenTransferCount}

Internal：
- 程序分析 ${analyzedInternalTransactionCount}
- AI 阅读 ${evidenceInternalTransactionCount}

生成调查报告。

严格结构：

## 执行摘要

用 3～6 句话回答：
- 最重要的变化是什么
- 最可能的原因假设是什么
- 最值得关注的潜在影响是什么

## 发生了什么变化

必须引用 baseline → recent 的真实数值。

不要只写“活动异常”，必须写清楚：

“什么指标，从多少变成多少”。

## 为什么可能发生变化

按假设分别分析。

每个原因使用：

### 原因假设名称

- 支持证据
- 反证或不足
- 置信度
- 为什么这只是可能解释而非确定事实

## 潜在影响

按照：

- 资金影响
- 行为影响
- 网络关系影响
- 调查影响

只写有证据支持的内容。

## Agent 验证过程

解释：

- 为什么查看主要对手方
- 为什么继续做 Second-Hop
- Second-Hop 是否支持或削弱前面的原因假设

不要把 Second-Hop 地址行为归因于根地址。

## 关键证据

使用表格：

| 证据类型 | 基准 / 近期 / 地址 / Tx | 观测事实 | 支持什么判断 |
| --- | --- | --- | --- |

只能引用真实提供的证据。

## 风险解释

解释 Risk Score ${riskScore}/100。

必须明确：
Risk Score 和 Change Analysis 是两个不同维度。

Risk Score 衡量启发式异常信号，
Change Analysis 衡量近期行为相对基准发生了什么变化。

## 下一步调查

给出 3～6 个真正有助于验证原因的下一步，例如：

- 地址实体标签
- 合约和协议语义识别
- 更长历史窗口
- 第二个主要对手方追踪
- 第三跳资金流
- 外部事件时间线对齐

## 置信度与局限性

必须说明：

- 当前只使用有限最近交易样本
- baseline 是样本中的前一个时间窗口，不代表完整历史正常状态
- 某些窗口可能交易量不足
- Second-Hop 只追踪一个主要对手方
- 当前缺少完整协议语义和实体标签
- 原因分析属于基于证据的假设，不是确定归因
- AI 只解释程序提供的信息

最后写：

> 本报告用于链上变化调查辅助，不构成对任何地址所有者身份、意图、责任或合法性的判断。
`
        : `
Investigated address:

${address}

ETH Balance:

${balance} ETH

Risk Score:

${riskScore}/100

Risk Level:

${riskLevel}

## Deterministic Change Summary

${changeAnalysis?.summaryEn || "None"}

## What Changed

${changeMetrics}

## Deterministic Cause Hypotheses

${causeText}

## Deterministic Potential Impacts

${impactText}

## Anomaly Evidence

${anomalyText}

## ETH Evidence

${transactionText}

## ERC-20 Evidence

${tokenText}

## Internal Evidence

${internalText}

## Direct Counterparties

${counterpartyText}

## Second-Hop Validation

${secondHopText}

Generate the investigation report using this exact structure:

## Executive Summary

## What Changed

Quote real baseline → recent values.

## Why It May Have Changed

For each hypothesis include:
- Supporting evidence
- Missing or contradictory evidence
- Confidence
- Why it is only a hypothesis

## Potential Impact

Cover only supported:
- Financial impact
- Behavioral impact
- Network impact
- Investigation impact

## Agent Validation Process

Explain how counterparty and second-hop investigation helped validate the cause hypotheses.

## Key Evidence

Use:

| Evidence Type | Baseline / Recent / Address / Tx | Observation | What It Supports |
| --- | --- | --- | --- |

## Risk Interpretation

Explain that Risk Score and Change Analysis are separate dimensions.

## Recommended Next Investigation

## Confidence & Limitations

End with:

> This report assists on-chain change investigation and does not determine the identity, intent, responsibility, or legality of any address owner.
`;

    const proxyUrl =
      process.env
        .HTTPS_PROXY ||
      process.env
        .HTTP_PROXY;

    const dispatcher =
      proxyUrl
        ? new ProxyAgent(
            proxyUrl
          )
        : undefined;

    const response =
      await undiciFetch(
        "https://api.deepseek.com/chat/completions",
        {
          method:
            "POST",

          dispatcher,

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              model:
                "deepseek-chat",

              messages: [
                {
                  role:
                    "system",

                  content:
                    systemPrompt,
                },

                {
                  role:
                    "user",

                  content:
                    userPrompt,
                },
              ],

              temperature:
                0.2,

              stream:
                false,
            }),
        }
      );

    const data =
      (await response.json()) as any;

    if (
      !response.ok
    ) {
      return NextResponse.json(
        {
          error:
            data?.error
              ?.message ||
            "DeepSeek API request failed",
        },
        {
          status:
            response.status,
        }
      );
    }

    const report =
      data?.choices?.[0]
        ?.message?.content;

    if (
      !report
    ) {
      return NextResponse.json(
        {
          error:
            "DeepSeek returned no report text",
        },
        {
          status:
            500,
        }
      );
    }

    const model =
      data.model ||
      "deepseek-chat";

    reportCache.set(
      cacheKey,
      {
        report,
        model,

        cachedAt:
          Date.now(),
      }
    );

    return NextResponse.json({
      report,
      model,

      cached:
        false,

      language:
        selectedLanguage,

      usingProxy:
        Boolean(
          proxyUrl
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "DeepSeek investigation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to generate AI investigation",

        details:
          String(
            error
          ),
      },
      {
        status:
          500,
      }
    );
  }
}