import { NextRequest, NextResponse } from "next/server";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const RATE_LIMIT_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 10 * 60_000;

const rateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();

const reportCache = new Map<
  string,
  { report: string; model: string; cachedAt: number }
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

  if (reportCache.size < 500) return;

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
      { error: "DEEPSEEK_API_KEY is missing" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const {
      address,
      balance,
      riskScore,
      riskLevel,
      language,
      anomalies,
      changeAnalysis,
      addressContexts,
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
    } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const selectedLanguage = language === "en" ? "en" : "zh";
    const isZh = selectedLanguage === "zh";

    const normalizedAddress = String(address).trim().toLowerCase();

    cleanupCache();

    const cacheKey = `change-v2:${selectedLanguage}:${normalizedAddress}`;
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
          error: isZh
            ? `请求过于频繁，请稍后再试。每分钟最多生成 ${RATE_LIMIT_PER_WINDOW} 次新的 AI 调查报告。`
            : `Too many requests. Up to ${RATE_LIMIT_PER_WINDOW} new AI reports may be generated per minute.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
          },
        }
      );
    }

    const importantChanges = Array.isArray(changeAnalysis?.metrics)
      ? changeAnalysis.metrics.filter((item: any) => item.important)
      : [];

    const changeMetricsText =
      importantChanges.length > 0
        ? importantChanges
            .map(
              (item: any, index: number) => `
### Change ${index + 1}
- Metric: ${isZh ? item.labelZh : item.labelEn}
- Baseline: ${item.baseline} ${isZh ? item.unitZh : item.unitEn}
- Recent: ${item.recent} ${isZh ? item.unitZh : item.unitEn}
- Direction: ${item.direction}
`
            )
            .join("\n")
        : "No material change metrics.";

    const causeText =
      Array.isArray(changeAnalysis?.causes) &&
      changeAnalysis.causes.length > 0
        ? changeAnalysis.causes
            .map(
              (cause: any, index: number) => `
### Cause Hypothesis ${index + 1}
- Hypothesis: ${isZh ? cause.titleZh : cause.titleEn}
- Confidence: ${cause.confidence}
- Initial evidence:
${
  (isZh ? cause.evidenceZh : cause.evidenceEn)
    ?.map((x: string) => `  - ${x}`)
    .join("\n") || "  - None"
}
- Deterministic verification status: ${
                cause.verification?.status || "UNRESOLVED"
              }
- Verification evidence:
${
  (isZh
    ? cause.verification?.evidenceZh
    : cause.verification?.evidenceEn
  )
    ?.map((x: string) => `  - ${x}`)
    .join("\n") || "  - No extra verification evidence"
}
`
            )
            .join("\n")
        : "No deterministic cause hypothesis.";

    const impactText =
      Array.isArray(changeAnalysis?.impacts) &&
      changeAnalysis.impacts.length > 0
        ? changeAnalysis.impacts
            .map(
              (impact: any, index: number) => `
### Impact ${index + 1}
- Category: ${isZh ? impact.categoryZh : impact.categoryEn}
- Impact: ${isZh ? impact.titleZh : impact.titleEn}
- Severity: ${impact.severity}
- Explanation: ${
                isZh ? impact.descriptionZh : impact.descriptionEn
              }
`
            )
            .join("\n")
        : "No major potential impact identified.";

    const addressContextText =
      Array.isArray(addressContexts) && addressContexts.length > 0
        ? addressContexts
            .map(
              (item: any, index: number) => `
### Address Context ${index + 1}
- Address: ${item.address}
- Type: ${item.isContract ? "Smart Contract" : "EOA / No bytecode detected"}
- Contract Name: ${item.contractName || "Unknown"}
- Source Verified: ${item.sourceVerified ? "Yes" : "No / unavailable"}
- Proxy: ${item.isProxy ? "Yes" : "No / unavailable"}
- Implementation: ${item.implementation || "Unknown"}
`
            )
            .join("\n")
        : "No additional address-context metadata was available.";

    const anomalyText =
      Array.isArray(anomalies) && anomalies.length > 0
        ? anomalies
            .map(
              (item: any, index: number) => `
### Anomaly ${index + 1}
- Type: ${item.type}
- Severity: ${item.severity}
- Score contribution: ${item.score}
- Description: ${item.description}
- Evidence hash: ${item.evidenceHash || "N/A"}
`
            )
            .join("\n")
        : "No anomaly signals.";

    const txText =
      Array.isArray(transactions) && transactions.length > 0
        ? transactions
            .slice(0, 20)
            .map(
              (tx: any, index: number) => `
### ETH ${index + 1}
- Direction: ${tx.direction}
- Amount: ${tx.valueEth} ETH
- Hash: ${tx.hash}
- From: ${tx.from}
- To: ${tx.to}
- Time: ${tx.time}
`
            )
            .join("\n")
        : "No ETH evidence.";

    const tokenText =
      Array.isArray(tokenTransfers) && tokenTransfers.length > 0
        ? tokenTransfers
            .slice(0, 20)
            .map(
              (tx: any, index: number) => `
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
            .join("\n")
        : "No ERC-20 evidence.";

    const internalText =
      Array.isArray(internalTransactions) &&
      internalTransactions.length > 0
        ? internalTransactions
            .slice(0, 20)
            .map(
              (tx: any, index: number) => `
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
            .join("\n")
        : "No internal evidence.";

    const counterpartyText =
      Array.isArray(counterparties) && counterparties.length > 0
        ? counterparties
            .slice(0, 8)
            .map(
              (item: any, index: number) => `
### Counterparty ${index + 1}
- Address: ${item.address}
- Events: ${item.interactionCount}
- Outgoing: ${item.outgoingCount}
- Incoming: ${item.incomingCount}
- ETH Out: ${item.ethOut}
- ETH In: ${item.ethIn}
- Sources: ${Array.isArray(item.sources) ? item.sources.join(", ") : ""}
`
            )
            .join("\n")
        : "No counterparty evidence.";

    const secondHopText = secondHop
      ? `
- Investigated first-hop address: ${secondHop.investigatedAddress}
- Selection reason: ${secondHop.selectionReason}
- Observed second-hop events: ${secondHop.totalObservedEvents}
- Root observed again: ${secondHop.linksBackToRoot ? "Yes" : "No"}

Second-Hop Counterparties:
${
  Array.isArray(secondHop.topCounterparties)
    ? secondHop.topCounterparties
        .slice(0, 6)
        .map(
          (item: any, index: number) => `
### Second-Hop ${index + 1}
- Address: ${item.address}
- Events: ${item.interactionCount}
- ETH Out: ${item.ethOut}
- ETH In: ${item.ethIn}
- Sources: ${Array.isArray(item.sources) ? item.sources.join(", ") : ""}
`
        )
        .join("\n")
    : "None"
}
`
      : "No second-hop evidence.";

    const systemPrompt = isZh
      ? `
你是 ChainScope AI，一个 Ethereum 链上变化调查 Agent。

你的工作不是创造原因，而是解释程序已经计算和验证过的证据。

特别注意：
1. “变化”只能来自 baseline vs recent 的确定性计算。
2. “原因”必须保持为假设。
3. 现在系统额外提供 Address Context Verification：
   - 是否存在链上合约 bytecode
   - Etherscan 合约名称（若可用）
   - 源码是否验证
   - Proxy / Implementation（若可用）
4. 合约地址只能说明“该地址存在合约代码”，不能自动说明它属于某个协议，除非 Contract Name 明确提供。
5. EOA / 无 bytecode 也不能说明多个地址属于同一个人。
6. verification=SUPPORTED 只代表“额外证据方向一致”，不是原因被证明。
7. 不得编造身份、协议、黑客攻击、诈骗、洗钱、制裁或资金来源。
8. 第二跳行为不能直接归因于根地址。
9. Risk Score 与 Change Analysis 是两个不同维度。
10. 使用简体中文 Markdown，从 ## 开始。
`
      : `
You are ChainScope AI, an Ethereum on-chain change investigation agent.

Your job is to explain evidence already calculated and validated by the program, not to invent causes.

Important:
1. Changes must come only from deterministic baseline-vs-recent calculations.
2. Causes must remain hypotheses.
3. The system now supplies Address Context Verification:
   - whether on-chain contract bytecode exists
   - Etherscan contract name when available
   - source verification status
   - proxy / implementation metadata when available
4. Contract bytecode only proves that the address is a contract. Do not infer a protocol unless an explicit contract name is supplied.
5. EOA/no-bytecode status does not prove common ownership.
6. verification=SUPPORTED means extra evidence is directionally consistent, not that the cause is proven.
7. Never invent identities, protocols, hacks, scams, laundering, sanctions, or sources of funds.
8. Do not attribute second-hop behavior directly to the root address.
9. Risk Score and Change Analysis are separate dimensions.
10. Write in English Markdown starting from ##.
`;

    const userPrompt = isZh
      ? `
调查地址：${address}
ETH Balance：${balance} ETH
Risk Score：${riskScore}/100
Risk Level：${riskLevel}

## 程序计算出的变化
${changeMetricsText}

## 原因假设与确定性验证
${causeText}

## 地址类型 / 合约上下文
${addressContextText}

## 潜在影响
${impactText}

## 异常证据
${anomalyText}

## ETH 证据
${txText}

## ERC-20 证据
${tokenText}

## Internal 证据
${internalText}

## 直接对手方
${counterpartyText}

## Second-Hop
${secondHopText}

## 数据规模
ETH：程序分析 ${analyzedTransactionCount}，AI 阅读 ${evidenceTransactionCount}
ERC-20：程序分析 ${analyzedTokenTransferCount}，AI 阅读 ${evidenceTokenTransferCount}
Internal：程序分析 ${analyzedInternalTransactionCount}，AI 阅读 ${evidenceInternalTransactionCount}

请生成：

## 执行摘要

## 发生了什么变化
必须写 baseline → recent 的真实数值。

## 为什么可能发生变化
每个原因都写：
- 原始支持证据
- 新增验证证据
- 验证状态（已获得额外支持 / 部分支持 / 仍待验证）
- 仍缺什么证据
- 为什么不能把假设写成事实

## 潜在影响

## Agent 验证过程
重点说明 Address Context Verification 和 Second-Hop 分别验证了什么、没有验证什么。

## 关键证据
用表格。

## 风险解释

## 下一步调查
优先建议能真正验证原因的下一步。

## 置信度与局限性

最后：
> 本报告用于链上变化调查辅助，不构成对任何地址所有者身份、意图、责任或合法性的判断。
`
      : `
Investigated address: ${address}
ETH Balance: ${balance} ETH
Risk Score: ${riskScore}/100
Risk Level: ${riskLevel}

## Deterministic Changes
${changeMetricsText}

## Cause Hypotheses and Deterministic Verification
${causeText}

## Address / Contract Context
${addressContextText}

## Potential Impacts
${impactText}

## Anomaly Evidence
${anomalyText}

## ETH Evidence
${txText}

## ERC-20 Evidence
${tokenText}

## Internal Evidence
${internalText}

## Direct Counterparties
${counterpartyText}

## Second-Hop
${secondHopText}

Generate:

## Executive Summary
## What Changed
## Why It May Have Changed
For each cause include original evidence, new verification evidence, verification status, missing evidence, and why the cause remains a hypothesis.
## Potential Impact
## Agent Validation Process
Explain what Address Context Verification and Second-Hop do and do not validate.
## Key Evidence
Use a table.
## Risk Interpretation
## Recommended Next Investigation
## Confidence & Limitations

End with:
> This report assists on-chain change investigation and does not determine the identity, intent, responsibility, or legality of any address owner.
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
            data?.error?.message || "DeepSeek API request failed",
        },
        {
          status: response.status,
        }
      );
    }

    const report = data?.choices?.[0]?.message?.content;

    if (!report) {
      return NextResponse.json(
        { error: "DeepSeek returned no report text" },
        { status: 500 }
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
