"use client";

import {
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ethers } from "ethers";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Language = "zh" | "en";

type Transaction = {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timeStamp: string;
  isError?: string;
  gasUsed?: string;
  gasPrice?: string;
};

type TokenTransfer = {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timeStamp: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
};

type InternalTransaction = {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timeStamp: string;
  type?: string;
  isError?: string;
};

type Anomaly = {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  score: number;
  evidenceHash?: string;
};

type Counterparty = {
  address: string;

  interactionCount: number;

  outgoingCount: number;
  incomingCount: number;

  ethOut: number;
  ethIn: number;

  tokenEventCount: number;
  internalEventCount: number;

  sources: string[];
  tokenSymbols: string[];

  lastTimestamp: number;
};

type SecondHopResult = {
  investigatedAddress: string;

  selectionReason: string;

  transactionCount: number;
  tokenTransferCount: number;
  internalTransactionCount: number;

  counterparties: Counterparty[];

  linksBackToRoot: boolean;

  rootInteractionCount: number;
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

type Tab =
  | "overview"
  | "trace"
  | "report"
  | "evidence";

const copy = {
  zh: {
    subtitle: "以太坊链上变化调查智能体",
    network: "Ethereum 主网",

    heroEyebrow: "链上变化调查",
    heroTitle1: "不仅发现异常，",
    heroTitle2: "还解释为什么，以及可能影响什么。",
    heroDescription:
      "ChainScope 对比近期与基准行为，识别资金活动变化，并结合 ETH、ERC-20、Internal 与多跳关系分析变化原因和潜在影响。",

    placeholder: "输入 Ethereum 地址：0x...",
    start: "开始调查",
    investigating: "调查中...",

    initialStatus:
      "输入一个 Ethereum 地址开始调查。",

    overview: "变化分析",
    trace: "Agent 追踪",
    report: "AI 报告",
    evidence: "原始证据",

    rootRisk: "根地址风险",
    observedEvents: "观测事件",
    changeSignals: "明显变化",
    agentTrace: "Agent 追踪",

    whatChanged: "发生了什么变化",
    whatChangedDesc:
      "程序对比近期行为与前一个基准窗口，找出真正发生变化的指标。",

    whyChanged: "为什么可能发生变化",
    whyChangedDesc:
      "基于已观测链上证据形成多个原因假设，而不是直接猜测唯一原因。",

    potentialImpact: "潜在影响",
    potentialImpactDesc:
      "分析当前变化如果持续，可能对资金、关系网络和后续调查造成什么影响。",

    supportingEvidence: "支撑证据",
    supportingEvidenceDesc:
      "异常、对手方和第二跳用于支撑变化解释，而不是作为最终结论。",

    recent: "近期",
    baseline: "基准",
    confidence: "置信度",

    high: "高",
    medium: "中",
    low: "低",

    noChange:
      "当前样本中没有检测到明显行为变化。",
    noCause:
      "当前证据不足以形成明确原因假设。",
    noImpact:
      "当前没有检测到显著潜在影响。",

    traceTitle: "Agent 调查路径",
    traceDesc:
      "当程序发现值得继续验证的关系时，Agent 会自动选择一个直接对手方继续调查。",

    rootWallet: "根地址",
    directRelation: "直接链上关系",
    firstHop: "第一跳调查目标",
    continueInvestigation: "Agent 继续调查",
    secondHop: "第二跳关系",
    secondHopDesc:
      "这些地址主要与第一跳地址交互，不一定直接与根地址有关。",

    important: "重要说明",
    importantText:
      "第二跳行为不会直接加入根地址 Risk Score。链上关系也不等于共同身份、共同控制或恶意行为。",

    reportTitle: "AI 变化调查报告",
    reportDesc:
      "DeepSeek 只负责解释程序计算出的变化、原因假设、潜在影响和真实链上证据。",

    evidenceTitle: "原始证据",
    evidenceDesc:
      "与异常规则直接关联的交易会自动标记为重点证据，其余记录仍可用于人工核查。",

    anomalies: "异常信号",
    ethTransactions: "ETH 普通交易",
    tokenTransfers: "ERC-20 转账",
    internalTransactions: "Internal Transactions",

    noSecondHop:
      "当前没有找到适合继续自动追踪的直接对手方。",

    generating:
      "正在生成变化调查报告...",

    flaggedEvidence: "重点证据",
    flaggedCount: "条重点证据",
    evidenceReason:
      "该交易被至少一个异常检测规则引用。",
  },

  en: {
    subtitle: "Ethereum Change Investigation Agent",
    network: "Ethereum Mainnet",

    heroEyebrow: "On-chain Change Investigation",
    heroTitle1: "Detect what changed,",
    heroTitle2: "explain why and what it may affect.",
    heroDescription:
      "ChainScope compares recent behavior with a baseline, detects meaningful changes, and uses ETH, ERC-20, internal transactions and multi-hop relationships to explain possible causes and impacts.",

    placeholder: "Enter Ethereum address: 0x...",
    start: "Start Investigation",
    investigating: "Investigating...",

    initialStatus:
      "Enter an Ethereum address to begin.",

    overview: "Change Analysis",
    trace: "Agent Trace",
    report: "AI Report",
    evidence: "Evidence",

    rootRisk: "Root Risk",
    observedEvents: "Observed Events",
    changeSignals: "Major Changes",
    agentTrace: "Agent Trace",

    whatChanged: "What Changed",
    whatChangedDesc:
      "The program compares recent behavior with the previous baseline window to identify meaningful changes.",

    whyChanged: "Why It May Have Changed",
    whyChangedDesc:
      "Possible causes are formed from observed on-chain evidence instead of assuming a single explanation.",

    potentialImpact: "Potential Impact",
    potentialImpactDesc:
      "What the observed change may affect if the behavior continues.",

    supportingEvidence: "Supporting Evidence",
    supportingEvidenceDesc:
      "Anomalies, counterparties and second-hop relationships support the explanation rather than acting as the conclusion.",

    recent: "Recent",
    baseline: "Baseline",
    confidence: "Confidence",

    high: "High",
    medium: "Medium",
    low: "Low",

    noChange:
      "No major behavioral change was detected in the current sample.",
    noCause:
      "Current evidence is insufficient to form a strong cause hypothesis.",
    noImpact:
      "No significant potential impact was detected.",

    traceTitle: "Agent Investigation Path",
    traceDesc:
      "When a relationship is worth validating, the agent automatically selects one direct counterparty for deeper investigation.",

    rootWallet: "Root Wallet",
    directRelation: "Direct on-chain relationship",
    firstHop: "First-Hop Investigation Target",
    continueInvestigation: "Agent continues investigation",
    secondHop: "Second-Hop Relationships",
    secondHopDesc:
      "These addresses mainly interact with the selected first-hop address and are not necessarily directly related to the root wallet.",

    important: "Important",
    importantText:
      "Second-hop behavior does not directly affect the root Risk Score. An on-chain relationship does not prove shared identity, control, ownership or malicious intent.",

    reportTitle: "AI Change Investigation Report",
    reportDesc:
      "DeepSeek only explains deterministic changes, cause hypotheses, potential impacts and real blockchain evidence supplied by ChainScope.",

    evidenceTitle: "Raw Evidence",
    evidenceDesc:
      "Transactions directly referenced by anomaly rules are automatically highlighted while the remaining records stay available for verification.",

    anomalies: "Anomaly Signals",
    ethTransactions: "ETH Transactions",
    tokenTransfers: "ERC-20 Transfers",
    internalTransactions: "Internal Transactions",

    noSecondHop:
      "No suitable direct counterparty was selected for deeper tracing.",

    generating:
      "Generating change investigation report...",

    flaggedEvidence: "Flagged Evidence",
    flaggedCount: "flagged",
    evidenceReason:
      "This transaction is referenced by at least one anomaly detection rule.",
  },
};

export default function Home() {
  const [language, setLanguage] =
    useState<Language>("zh");

  const t = copy[language];

  const [address, setAddress] =
    useState("");

  const [balance, setBalance] =
    useState("--");

  const [status, setStatus] =
    useState(copy.zh.initialStatus);

  const [loading, setLoading] =
    useState(false);

  const [aiLoading, setAiLoading] =
    useState(false);

  const [
    transactions,
    setTransactions,
  ] =
    useState<Transaction[]>([]);

  const [
    tokenTransfers,
    setTokenTransfers,
  ] =
    useState<TokenTransfer[]>([]);

  const [
    internalTransactions,
    setInternalTransactions,
  ] =
    useState<
      InternalTransaction[]
    >([]);

  const [
    counterparties,
    setCounterparties,
  ] =
    useState<Counterparty[]>([]);

  const [
    secondHop,
    setSecondHop,
  ] =
    useState<SecondHopResult | null>(
      null
    );

  const [
    anomalies,
    setAnomalies,
  ] =
    useState<Anomaly[]>([]);

  const [
    changeAnalysis,
    setChangeAnalysis,
  ] =
    useState<ChangeAnalysis | null>(
      null
    );

  const [
    riskScore,
    setRiskScore,
  ] =
    useState<number | null>(
      null
    );

  const [
    aiReport,
    setAiReport,
  ] =
    useState("");

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<Tab>("overview");

  const flaggedHashes =
    useMemo(() => {
      return new Set(
        anomalies
          .map((item) =>
            item.evidenceHash?.toLowerCase()
          )
          .filter(
            (
              value
            ): value is string =>
              Boolean(value)
          )
      );
    }, [anomalies]);

  const flaggedEthCount =
    transactions.filter((tx) =>
      flaggedHashes.has(
        tx.hash?.toLowerCase()
      )
    ).length;

  const flaggedTokenCount =
    tokenTransfers.filter((tx) =>
      flaggedHashes.has(
        tx.hash?.toLowerCase()
      )
    ).length;

  const flaggedInternalCount =
    internalTransactions.filter((tx) =>
      flaggedHashes.has(
        tx.hash?.toLowerCase()
      )
    ).length;

  function updateLanguage(
    next: Language
  ) {
    setLanguage(next);

    if (
      !loading &&
      riskScore === null
    ) {
      setStatus(
        copy[next].initialStatus
      );
    }
  }

  async function startInvestigation() {
    if (
      !ethers.isAddress(
        address
      )
    ) {
      setStatus(
        language === "zh"
          ? "请输入有效的 Ethereum 地址。"
          : "Please enter a valid Ethereum address."
      );

      return;
    }

    const rootAddress =
      address.toLowerCase();

    try {
      setLoading(true);
      setAiLoading(false);

      setBalance("--");

      setTransactions([]);
      setTokenTransfers([]);
      setInternalTransactions([]);

      setCounterparties([]);
      setSecondHop(null);

      setAnomalies([]);
      setChangeAnalysis(null);

      setRiskScore(null);
      setAiReport("");

      setActiveTab(
        "overview"
      );

      setStatus(
        language === "zh"
          ? "正在获取钱包余额..."
          : "Fetching wallet balance..."
      );

      const provider =
        new ethers.JsonRpcProvider(
          "https://ethereum-rpc.publicnode.com"
        );

      const balanceWei =
        await provider.getBalance(
          address
        );

      const formattedBalance =
        Number(
          ethers.formatEther(
            balanceWei
          )
        ).toFixed(4);

      setBalance(
        formattedBalance
      );

      setStatus(
        language === "zh"
          ? "正在收集 ETH、ERC-20 和 Internal 数据..."
          : "Collecting ETH, ERC-20 and Internal data..."
      );

      const [
        txResponse,
        tokenResponse,
        internalResponse,
      ] =
        await Promise.all([
          fetch(
            `/api/transactions?address=${encodeURIComponent(
              address
            )}`
          ),

          fetch(
            `/api/tokentx?address=${encodeURIComponent(
              address
            )}`
          ),

          fetch(
            `/api/internal-transactions?address=${encodeURIComponent(
              address
            )}`
          ),
        ]);

      const [
        txData,
        tokenData,
        internalData,
      ] =
        await Promise.all([
          txResponse.json(),
          tokenResponse.json(),
          internalResponse.json(),
        ]);

      if (!txResponse.ok) {
        throw new Error(
          txData.error ||
            "Failed to retrieve ETH transactions"
        );
      }

      if (!tokenResponse.ok) {
        throw new Error(
          tokenData.error ||
            "Failed to retrieve token transfers"
        );
      }

      if (
        !internalResponse.ok
      ) {
        throw new Error(
          internalData.error ||
            "Failed to retrieve internal transactions"
        );
      }

      const txItems: Transaction[] =
        Array.isArray(
          txData.items
        )
          ? txData.items
          : [];

      const tokenItems: TokenTransfer[] =
        Array.isArray(
          tokenData.items
        )
          ? tokenData.items
          : [];

      const internalItems: InternalTransaction[] =
        Array.isArray(
          internalData.items
        )
          ? internalData.items
          : [];

      setTransactions(
        txItems
      );

      setTokenTransfers(
        tokenItems
      );

      setInternalTransactions(
        internalItems
      );

      setStatus(
        language === "zh"
          ? "正在构建对手方关系..."
          : "Building counterparty relationships..."
      );

      const firstHopCounterparties =
        buildCounterparties(
          txItems,
          tokenItems,
          internalItems,
          rootAddress
        );

      setCounterparties(
        firstHopCounterparties
      );

      setStatus(
        language === "zh"
          ? "正在检测行为异常..."
          : "Detecting behavioral anomalies..."
      );

      const detected = [
        ...detectEthAnomalies(
          txItems,
          address
        ),

        ...detectTokenAnomalies(
          tokenItems,
          address
        ),

        ...detectInternalAnomalies(
          internalItems,
          address
        ),

        ...detectCounterpartyAnomalies(
          firstHopCounterparties
        ),
      ];

      setAnomalies(
        detected
      );

      const score =
        calculateRiskScore(
          detected
        );

      setRiskScore(score);

      const riskLevel =
        getRiskLevel(
          score
        ).label;

      setStatus(
        language === "zh"
          ? "正在比较近期行为与基准行为..."
          : "Comparing recent behavior with baseline behavior..."
      );

      const changeResult =
        analyzeBehaviorChange(
          txItems,
          tokenItems,
          internalItems,
          firstHopCounterparties,
          rootAddress
        );

      setChangeAnalysis(
        changeResult
      );

      let secondHopResult:
        | SecondHopResult
        | null = null;

      const selectedCounterparty =
        chooseSecondHopCounterparty(
          firstHopCounterparties,
          rootAddress
        );

      if (
        selectedCounterparty
      ) {
        setStatus(
          language === "zh"
            ? "Agent 正在验证主要对手方关系..."
            : "Agent is validating a major counterparty relationship..."
        );

        try {
          const response =
            await fetch(
              `/api/second-hop?address=${encodeURIComponent(
                selectedCounterparty.address
              )}`
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data.error ||
                "Second-hop investigation failed"
            );
          }

          const secondTxs: Transaction[] =
            Array.isArray(
              data.transactions
            )
              ? data.transactions
              : [];

          const secondTokens: TokenTransfer[] =
            Array.isArray(
              data.tokenTransfers
            )
              ? data.tokenTransfers
              : [];

          const secondInternals: InternalTransaction[] =
            Array.isArray(
              data.internalTransactions
            )
              ? data.internalTransactions
              : [];

          const secondCounterparties =
            buildCounterparties(
              secondTxs,
              secondTokens,
              secondInternals,
              selectedCounterparty.address.toLowerCase()
            );

          const rootRelationship =
            secondCounterparties.find(
              (item) =>
                item.address.toLowerCase() ===
                rootAddress
            );

          secondHopResult = {
            investigatedAddress:
              selectedCounterparty.address,

            selectionReason:
              language === "zh"
                ? `Agent 根据该地址的 ${selectedCounterparty.interactionCount} 次观测交互和 ${selectedCounterparty.sources.length} 类数据来源信号，选择它进行进一步调查。`
                : `The agent selected this address because it has ${selectedCounterparty.interactionCount} observed interaction events across ${selectedCounterparty.sources.length} data source(s).`,

            transactionCount:
              secondTxs.length,

            tokenTransferCount:
              secondTokens.length,

            internalTransactionCount:
              secondInternals.length,

            counterparties:
              secondCounterparties,

            linksBackToRoot:
              Boolean(
                rootRelationship
              ),

            rootInteractionCount:
              rootRelationship
                ?.interactionCount ||
              0,
          };

          setSecondHop(
            secondHopResult
          );
        } catch (
          error
        ) {
          console.error(
            "Second-hop investigation:",
            error
          );
        }
      }

      setStatus(
        language === "zh"
          ? "正在生成变化原因与潜在影响报告..."
          : "Generating change cause and impact report..."
      );

      setAiLoading(true);

      const evidenceTransactions =
        txItems
          .slice(0, 20)
          .map((tx) => ({
            hash:
              tx.hash,

            from:
              tx.from,

            to:
              tx.to,

            valueEth:
              formatEth(
                tx.value
              ),

            time:
              formatTime(
                tx.timeStamp
              ),

            direction:
              tx.from?.toLowerCase() ===
              rootAddress
                ? "OUT"
                : "IN",

            blockNumber:
              tx.blockNumber,
          }));

      const evidenceTokens =
        tokenItems
          .slice(0, 20)
          .map((tx) => ({
            hash:
              tx.hash,

            from:
              tx.from,

            to:
              tx.to,

            direction:
              tx.from?.toLowerCase() ===
              rootAddress
                ? "OUT"
                : "IN",

            amount:
              formatTokenAmount(
                tx.value,
                tx.tokenDecimal
              ),

            symbol:
              tx.tokenSymbol ||
              "TOKEN",

            tokenName:
              tx.tokenName ||
              "Unknown Token",

            contractAddress:
              tx.contractAddress,

            time:
              formatTime(
                tx.timeStamp
              ),

            blockNumber:
              tx.blockNumber,
          }));

      const evidenceInternal =
        internalItems
          .slice(0, 20)
          .map((tx) => ({
            hash:
              tx.hash,

            from:
              tx.from,

            to:
              tx.to,

            direction:
              tx.from?.toLowerCase() ===
              rootAddress
                ? "OUT"
                : "IN",

            valueEth:
              formatEth(
                tx.value
              ),

            type:
              tx.type ||
              "unknown",

            time:
              formatTime(
                tx.timeStamp
              ),

            blockNumber:
              tx.blockNumber,

            isError:
              tx.isError,
          }));

      const firstHopEvidence =
        firstHopCounterparties
          .slice(0, 10)
          .map((item) => ({
            address:
              item.address,

            interactionCount:
              item.interactionCount,

            outgoingCount:
              item.outgoingCount,

            incomingCount:
              item.incomingCount,

            ethOut:
              item.ethOut.toFixed(
                4
              ),

            ethIn:
              item.ethIn.toFixed(
                4
              ),

            tokenEventCount:
              item.tokenEventCount,

            internalEventCount:
              item.internalEventCount,

            sources:
              item.sources,

            tokenSymbols:
              item.tokenSymbols,

            lastInteraction:
              item.lastTimestamp
                ? formatTime(
                    String(
                      item.lastTimestamp
                    )
                  )
                : "Unknown",
          }));

      const secondHopEvidence =
        secondHopResult
          ? {
              investigatedAddress:
                secondHopResult
                  .investigatedAddress,

              selectedFromAddress:
                address,

              selectionReason:
                secondHopResult
                  .selectionReason,

              transactionCount:
                secondHopResult
                  .transactionCount,

              tokenTransferCount:
                secondHopResult
                  .tokenTransferCount,

              internalTransactionCount:
                secondHopResult
                  .internalTransactionCount,

              totalObservedEvents:
                secondHopResult
                  .transactionCount +
                secondHopResult
                  .tokenTransferCount +
                secondHopResult
                  .internalTransactionCount,

              linksBackToRoot:
                secondHopResult
                  .linksBackToRoot,

              rootInteractionCount:
                secondHopResult
                  .rootInteractionCount,

              topCounterparties:
                secondHopResult
                  .counterparties
                  .filter(
                    (item) =>
                      item.address.toLowerCase() !==
                      rootAddress
                  )
                  .slice(0, 6)
                  .map((item) => ({
                    address:
                      item.address,

                    interactionCount:
                      item.interactionCount,

                    outgoingCount:
                      item.outgoingCount,

                    incomingCount:
                      item.incomingCount,

                    ethOut:
                      item.ethOut.toFixed(
                        4
                      ),

                    ethIn:
                      item.ethIn.toFixed(
                        4
                      ),

                    sources:
                      item.sources,

                    tokenSymbols:
                      item.tokenSymbols,
                  })),
            }
          : null;

      try {
        const aiResponse =
          await fetch(
            "/api/investigate",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  address,

                  balance:
                    formattedBalance,

                  riskScore:
                    score,

                  riskLevel,

                  language,

                  anomalies:
                    detected,

                  changeAnalysis:
                    changeResult,

                  transactions:
                    evidenceTransactions,

                  tokenTransfers:
                    evidenceTokens,

                  internalTransactions:
                    evidenceInternal,

                  counterparties:
                    firstHopEvidence,

                  secondHop:
                    secondHopEvidence,

                  analyzedTransactionCount:
                    txItems.length,

                  analyzedTokenTransferCount:
                    tokenItems.length,

                  analyzedInternalTransactionCount:
                    internalItems.length,

                  evidenceTransactionCount:
                    evidenceTransactions.length,

                  evidenceTokenTransferCount:
                    evidenceTokens.length,

                  evidenceInternalTransactionCount:
                    evidenceInternal.length,
                }),
            }
          );

        const aiData =
          await aiResponse.json();

        if (!aiResponse.ok) {
          throw new Error(
            aiData.error ||
              "AI investigation failed"
          );
        }

        setAiReport(
          aiData.report ||
            ""
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setAiReport(
          language === "zh"
            ? `
## AI 报告生成失败

程序已经完成变化检测、原因假设和潜在影响分析，但 AI 报告暂时无法生成。

你仍然可以查看“变化分析”和“Agent 追踪”。
`
            : `
## AI Report Generation Failed

Deterministic change detection, cause hypotheses and impact analysis completed successfully, but the AI report could not be generated.
`
        );
      } finally {
        setAiLoading(
          false
        );
      }

      setStatus(
        language === "zh"
          ? "调查完成"
          : "Investigation complete"
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      setStatus(
        error instanceof Error
          ? error.message
          : language === "zh"
          ? "调查失败。"
          : "Investigation failed."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  function analyzeBehaviorChange(
    txs: Transaction[],
    tokens: TokenTransfer[],
    internals: InternalTransaction[],
    cps: Counterparty[],
    root: string
  ): ChangeAnalysis {
    const allTimestamps = [
      ...txs.map(
        (x) =>
          Number(
            x.timeStamp
          )
      ),

      ...tokens.map(
        (x) =>
          Number(
            x.timeStamp
          )
      ),

      ...internals.map(
        (x) =>
          Number(
            x.timeStamp
          )
      ),
    ].filter(
      (x) =>
        Number.isFinite(
          x
        ) &&
        x >
          0
    );

    const latest =
      allTimestamps.length
        ? Math.max(
            ...allTimestamps
          )
        : Math.floor(
            Date.now() /
              1000
          );

    const WINDOW =
      24 *
      60 *
      60;

    const recentStart =
      latest -
      WINDOW;

    const baselineStart =
      recentStart -
      WINDOW;

    const recentTx =
      txs.filter(
        (x) =>
          Number(
            x.timeStamp
          ) >=
            recentStart &&
          Number(
            x.timeStamp
          ) <=
            latest
      );

    const baselineTx =
      txs.filter(
        (x) =>
          Number(
            x.timeStamp
          ) >=
            baselineStart &&
          Number(
            x.timeStamp
          ) <
            recentStart
      );

    const recentTokens =
      tokens.filter(
        (x) =>
          Number(
            x.timeStamp
          ) >=
            recentStart &&
          Number(
            x.timeStamp
          ) <=
            latest
      );

    const baselineTokens =
      tokens.filter(
        (x) =>
          Number(
            x.timeStamp
          ) >=
            baselineStart &&
          Number(
            x.timeStamp
          ) <
            recentStart
      );

    const recentInternal =
      internals.filter(
        (x) =>
          Number(
            x.timeStamp
          ) >=
            recentStart &&
          Number(
            x.timeStamp
          ) <=
            latest
      );

    const baselineInternal =
      internals.filter(
        (x) =>
          Number(
            x.timeStamp
          ) >=
            baselineStart &&
          Number(
            x.timeStamp
          ) <
            recentStart
      );

    function ethOutflow(
      items: Transaction[]
    ) {
      return items.reduce(
        (sum, tx) => {
          if (
            tx.from?.toLowerCase() !==
            root
          ) {
            return sum;
          }

          try {
            return (
              sum +
              Number(
                ethers.formatEther(
                  tx.value ||
                    "0"
                )
              )
            );
          } catch {
            return sum;
          }
        },
        0
      );
    }

    function internalOutflow(
      items: InternalTransaction[]
    ) {
      return items.reduce(
        (sum, tx) => {
          if (
            tx.from?.toLowerCase() !==
            root
          ) {
            return sum;
          }

          try {
            return (
              sum +
              Number(
                ethers.formatEther(
                  tx.value ||
                    "0"
                )
              )
            );
          } catch {
            return sum;
          }
        },
        0
      );
    }

    function concentration(
      items: Transaction[]
    ) {
      const outgoing =
        items.filter(
          (x) =>
            x.from?.toLowerCase() ===
              root &&
            x.to
        );

      if (
        outgoing.length <
        2
      ) {
        return 0;
      }

      const map =
        new Map<
          string,
          number
        >();

      for (
        const tx of outgoing
      ) {
        let amount =
          0;

        try {
          amount =
            Number(
              ethers.formatEther(
                tx.value ||
                  "0"
              )
            );
        } catch {}

        const key =
          tx.to.toLowerCase();

        map.set(
          key,
          (map.get(
            key
          ) || 0) +
            amount
        );
      }

      const total =
        Array.from(
          map.values()
        ).reduce(
          (a, b) =>
            a + b,
          0
        );

      if (
        total <=
        0
      ) {
        return 0;
      }

      const top =
        Math.max(
          ...Array.from(
            map.values()
          )
        );

      return (
        top /
        total
      );
    }

    function makeMetric(
      key: string,
      labelZh: string,
      labelEn: string,
      baseline: number,
      recent: number,
      unitZh: string,
      unitEn: string,
      explanationZh: string,
      explanationEn: string
    ): ChangeMetric {
      const denominator =
        Math.max(
          Math.abs(
            baseline
          ),
          0.000001
        );

      const ratio =
        recent /
        denominator;

      let direction:
        | "UP"
        | "DOWN"
        | "STABLE" =
        "STABLE";

      if (
        baseline ===
          0 &&
        recent >
          0
      ) {
        direction =
          "UP";
      } else if (
        recent >
        baseline *
          1.5
      ) {
        direction =
          "UP";
      } else if (
        recent <
        baseline *
          0.67
      ) {
        direction =
          "DOWN";
      }

      const magnitude =
        baseline ===
          0
          ? recent >
            0
            ? 999
            : 1
          : ratio;

      const important =
        direction !==
          "STABLE" &&
        (
          recent >=
            3 ||
          baseline >=
            3 ||
          key.includes(
            "outflow"
          ) ||
          key.includes(
            "concentration"
          )
        );

      return {
        key,
        labelZh,
        labelEn,
        baseline,
        recent,
        unitZh,
        unitEn,
        direction,
        magnitude,
        important,
        explanationZh,
        explanationEn,
      };
    }

    const recentEthOut =
      ethOutflow(
        recentTx
      );

    const baselineEthOut =
      ethOutflow(
        baselineTx
      );

    const recentInternalOut =
      internalOutflow(
        recentInternal
      );

    const baselineInternalOut =
      internalOutflow(
        baselineInternal
      );

    const recentConcentration =
      concentration(
        recentTx
      );

    const baselineConcentration =
      concentration(
        baselineTx
      );

    const metrics = [
      makeMetric(
        "eth_frequency",
        "ETH 交易频率",
        "ETH Transaction Frequency",
        baselineTx.length,
        recentTx.length,
        " 次/24h",
        " /24h",
        "近期普通 ETH 交易数量相较前一个 24 小时窗口发生变化。",
        "Recent normal ETH transaction activity changed compared with the previous 24-hour window."
      ),

      makeMetric(
        "eth_outflow",
        "ETH 转出量",
        "ETH Outflow",
        baselineEthOut,
        recentEthOut,
        " ETH",
        " ETH",
        "近期 ETH 转出规模相较基准窗口发生变化。",
        "Recent ETH outflow changed compared with the baseline window."
      ),

      makeMetric(
        "token_frequency",
        "ERC-20 活动",
        "ERC-20 Activity",
        baselineTokens.length,
        recentTokens.length,
        " 次/24h",
        " /24h",
        "近期 ERC-20 转账事件数量发生变化。",
        "Recent ERC-20 transfer activity changed."
      ),

      makeMetric(
        "internal_frequency",
        "Internal 活动",
        "Internal Activity",
        baselineInternal.length,
        recentInternal.length,
        " 次/24h",
        " /24h",
        "智能合约执行产生的内部资金活动数量发生变化。",
        "Internal transaction activity generated during smart-contract execution changed."
      ),

      makeMetric(
        "internal_outflow",
        "Internal ETH 转出",
        "Internal ETH Outflow",
        baselineInternalOut,
        recentInternalOut,
        " ETH",
        " ETH",
        "Internal Transaction 中的 ETH 转出规模发生变化。",
        "ETH outflow observed in internal transactions changed."
      ),

      makeMetric(
        "concentration",
        "主要接收方集中度",
        "Top Recipient Concentration",
        baselineConcentration *
          100,
        recentConcentration *
          100,
        "%",
        "%",
        "近期普通 ETH 转出是否更加集中到少数地址。",
        "Measures whether recent ETH outflow became more concentrated among fewer recipients."
      ),
    ];

    const importantMetrics =
      metrics.filter(
        (x) =>
          x.important
      );

    const causes:
      CauseHypothesis[] =
      [];

    const frequencyUp =
      importantMetrics.find(
        (x) =>
          x.key ===
            "eth_frequency" &&
          x.direction ===
            "UP"
      );

    const outflowUp =
      importantMetrics.find(
        (x) =>
          x.key ===
            "eth_outflow" &&
          x.direction ===
            "UP"
      );

    const tokenUp =
      importantMetrics.find(
        (x) =>
          x.key ===
            "token_frequency" &&
          x.direction ===
            "UP"
      );

    const internalUp =
      importantMetrics.find(
        (x) =>
          x.key ===
            "internal_frequency" &&
          x.direction ===
            "UP"
      );

    const concentrationUp =
      importantMetrics.find(
        (x) =>
          x.key ===
            "concentration" &&
          x.direction ===
            "UP"
      );

    if (
      outflowUp &&
      concentrationUp
    ) {
      causes.push({
        id:
          "fund_consolidation",

        titleZh:
          "资金归集或资产迁移",
        titleEn:
          "Fund Consolidation or Asset Migration",

        confidence:
          concentrationUp.recent >=
            70
            ? "HIGH"
            : "MEDIUM",

        evidenceZh: [
          "近期 ETH 转出规模上升",
          "主要接收方集中度同步上升",
          "资金更集中地流向少数对手方",
        ],

        evidenceEn: [
          "Recent ETH outflow increased",
          "Top-recipient concentration increased",
          "Funds became more concentrated among fewer counterparties",
        ],

        explanationZh:
          "这种模式与资金归集、钱包迁移或集中管理资金的行为相符，但仅凭链上行为无法确认实际目的。",

        explanationEn:
          "This pattern is consistent with fund consolidation, wallet migration, or centralized treasury movement, but the actual purpose cannot be confirmed from on-chain behavior alone.",
      });
    }

    if (
      internalUp &&
      (
        tokenUp ||
        frequencyUp
      )
    ) {
      causes.push({
        id:
          "automated_contract_activity",

        titleZh:
          "自动化合约或 DeFi 活动增加",
        titleEn:
          "Increased Automated Contract or DeFi Activity",

        confidence:
          tokenUp &&
          internalUp
            ? "HIGH"
            : "MEDIUM",

        evidenceZh: [
          "Internal Transaction 活动上升",
          tokenUp
            ? "ERC-20 转账活动同步上升"
            : "普通交易活动同步变化",
          "多种链上事件在相近时间窗口同时增加",
        ],

        evidenceEn: [
          "Internal transaction activity increased",
          tokenUp
            ? "ERC-20 transfer activity also increased"
            : "Normal transaction activity also changed",
          "Multiple on-chain event types increased in the same time window",
        ],

        explanationZh:
          "多个数据源同步活跃通常与智能合约调用、DEX、DeFi 操作或自动化执行有关，但目前系统尚未完成协议语义识别。",

        explanationEn:
          "Simultaneous activity across multiple sources can be consistent with smart-contract calls, DEX or DeFi interaction, or automated execution. Full protocol semantics are not yet identified.",
      });
    }

    if (
      frequencyUp &&
      outflowUp
    ) {
      causes.push({
        id:
          "rapid_distribution",

        titleZh:
          "批量转账或快速资金分发",
        titleEn:
          "Batch Transfer or Rapid Fund Distribution",

        confidence:
          "MEDIUM",

        evidenceZh: [
          "短期交易频率上升",
          "ETH 转出规模同时增加",
          "资金活动在近期窗口内明显加速",
        ],

        evidenceEn: [
          "Short-term transaction frequency increased",
          "ETH outflow also increased",
          "Fund movement accelerated in the recent window",
        ],

        explanationZh:
          "这种模式可能来自批量支付、资金分发、自动化钱包操作或短期资产调整。当前证据不能区分具体业务目的。",

        explanationEn:
          "This can be consistent with batch payments, fund distribution, automated wallet operations, or short-term asset reallocation. The exact purpose cannot be determined from current evidence.",
      });
    }

    if (
      causes.length ===
        0 &&
      importantMetrics.length >
        0
    ) {
      causes.push({
        id:
          "unresolved_external_change",

        titleZh:
          "未知外部行为变化",
        titleEn:
          "Unresolved External Behavioral Change",

        confidence:
          "LOW",

        evidenceZh:
          importantMetrics
            .slice(0, 3)
            .map(
              (x) =>
                `${x.labelZh}发生明显变化`
            ),

        evidenceEn:
          importantMetrics
            .slice(0, 3)
            .map(
              (x) =>
                `${x.labelEn} changed materially`
            ),

        explanationZh:
          "程序确认行为发生变化，但当前链上数据不足以可靠判断具体原因，需要进一步结合地址标签、协议语义或更长历史窗口。",

        explanationEn:
          "The program confirms that behavior changed, but current on-chain evidence is insufficient to reliably determine the cause. Entity labels, protocol semantics or a longer history window would be needed.",
      });
    }

    const impacts:
      ImpactItem[] =
      [];

    if (outflowUp) {
      impacts.push({
        id:
          "balance_pressure",

        categoryZh:
          "资金影响",
        categoryEn:
          "Financial Impact",

        titleZh:
          "余额可能进一步下降",
        titleEn:
          "Balance May Decline Further",

        descriptionZh:
          "如果近期高转出行为持续，当前地址的可用 ETH 余额可能继续下降。",

        descriptionEn:
          "If the elevated outflow continues, the address's available ETH balance may continue to decline.",

        severity:
          outflowUp.magnitude >=
            3
            ? "HIGH"
            : "MEDIUM",
      });
    }

    if (
      concentrationUp &&
      concentrationUp.recent >=
        60
    ) {
      impacts.push({
        id:
          "concentration_risk",

        categoryZh:
          "关系影响",
        categoryEn:
          "Network Impact",

        titleZh:
          "资金关系更加集中",
        titleEn:
          "Fund Relationships Are Becoming More Concentrated",

        descriptionZh:
          "更多资金集中到少数地址后，资金路径对少量对手方的依赖上升。",

        descriptionEn:
          "As more funds concentrate among fewer addresses, the fund-flow network becomes more dependent on a small number of counterparties.",

        severity:
          concentrationUp.recent >=
            80
            ? "HIGH"
            : "MEDIUM",
      });
    }

    if (
      frequencyUp ||
      internalUp ||
      tokenUp
    ) {
      impacts.push({
        id:
          "behavioral_shift",

        categoryZh:
          "行为影响",
        categoryEn:
          "Behavioral Impact",

        titleZh:
          "地址行为已经偏离近期基准",
        titleEn:
          "Wallet Behavior Has Shifted From Its Recent Baseline",

        descriptionZh:
          "多个活动指标发生同步变化，说明当前行为模式与前一个基准窗口不同。",

        descriptionEn:
          "Multiple activity metrics changed at the same time, indicating that the current behavior differs from the previous baseline window.",

        severity:
          "MEDIUM",
      });
    }

    if (
      cps.length >=
      5
    ) {
      impacts.push({
        id:
          "trace_complexity",

        categoryZh:
          "调查影响",
        categoryEn:
          "Investigation Impact",

        titleZh:
          "资金关系扩散会增加追踪复杂度",
        titleEn:
          "Relationship Expansion Increases Tracing Complexity",

        descriptionZh:
          "当资金经过更多对手方和第二跳地址时，后续资金追踪需要更完整的关系图谱和标签信息。",

        descriptionEn:
          "As funds propagate through more counterparties and second-hop addresses, tracing requires richer graph and attribution data.",

        severity:
          cps.length >=
            15
            ? "HIGH"
            : "MEDIUM",
      });
    }

    const summaryZh =
      importantMetrics.length
        ? `程序在最近 24 小时窗口中识别到 ${importantMetrics.length} 个明显变化指标。最重要的是：${importantMetrics
            .slice(0, 3)
            .map(
              (x) =>
                x.labelZh
            )
            .join("、")}。`
        : "当前最近 24 小时窗口与前一个基准窗口之间没有检测到明显变化。";

    const summaryEn =
      importantMetrics.length
        ? `The program identified ${importantMetrics.length} material change metric(s) in the recent 24-hour window. The most relevant were ${importantMetrics
            .slice(0, 3)
            .map(
              (x) =>
                x.labelEn
            )
            .join(", ")}.`
        : "No major behavioral change was detected between the recent 24-hour window and the previous baseline window.";

    return {
      recentStart,
      baselineStart,
      metrics,
      causes,
      impacts,
      summaryZh,
      summaryEn,
    };
  }

  function chooseSecondHopCounterparty(
    items: Counterparty[],
    root: string
  ) {
    const candidates =
      items
        .filter(
          (item) =>
            item.address &&
            item.address.toLowerCase() !==
              root &&
            item.address.toLowerCase() !==
              "0x0000000000000000000000000000000000000000"
        )
        .map((item) => {
          const score =
            item.interactionCount +
            item.outgoingCount *
              1.5 +
            item.sources.length *
              3 +
            Math.min(
              Math.log10(
                item.ethOut +
                  1
              ) *
                2,
              8
            );

          return {
            item,
            score,
          };
        })
        .sort(
          (a, b) =>
            b.score -
            a.score
        );

    return (
      candidates[0]
        ?.item ||
      null
    );
  }

  function buildCounterparties(
    txs: Transaction[],
    tokens: TokenTransfer[],
    internals: InternalTransaction[],
    target: string
  ): Counterparty[] {
    type MutableCounterparty =
      Counterparty & {
        sourceSet:
          Set<string>;
        tokenSet:
          Set<string>;
      };

    const map =
      new Map<
        string,
        MutableCounterparty
      >();

    function getItem(
      counterpartyAddress: string
    ) {
      const key =
        counterpartyAddress.toLowerCase();

      if (
        !map.has(
          key
        )
      ) {
        map.set(
          key,
          {
            address:
              counterpartyAddress,

            interactionCount:
              0,

            outgoingCount:
              0,

            incomingCount:
              0,

            ethOut:
              0,

            ethIn:
              0,

            tokenEventCount:
              0,

            internalEventCount:
              0,

            sources:
              [],

            tokenSymbols:
              [],

            lastTimestamp:
              0,

            sourceSet:
              new Set<string>(),

            tokenSet:
              new Set<string>(),
          }
        );
      }

      return map.get(
        key
      )!;
    }

    for (
      const tx of txs
    ) {
      const from =
        tx.from?.toLowerCase();

      const to =
        tx.to?.toLowerCase();

      const outgoing =
        from === target;

      const incoming =
        to === target;

      if (
        !outgoing &&
        !incoming
      ) {
        continue;
      }

      const counterparty =
        outgoing
          ? tx.to
          : tx.from;

      if (
        !counterparty
      ) {
        continue;
      }

      const item =
        getItem(
          counterparty
        );

      item.interactionCount++;

      item.sourceSet.add(
        "ETH"
      );

      item.lastTimestamp =
        Math.max(
          item.lastTimestamp,
          Number(
            tx.timeStamp
          )
        );

      let amount =
        0;

      try {
        amount =
          Number(
            ethers.formatEther(
              tx.value ||
                "0"
            )
          );
      } catch {}

      if (outgoing) {
        item.outgoingCount++;
        item.ethOut +=
          amount;
      } else {
        item.incomingCount++;
        item.ethIn +=
          amount;
      }
    }

    for (
      const tx of tokens
    ) {
      const from =
        tx.from?.toLowerCase();

      const to =
        tx.to?.toLowerCase();

      const outgoing =
        from === target;

      const incoming =
        to === target;

      if (
        !outgoing &&
        !incoming
      ) {
        continue;
      }

      const counterparty =
        outgoing
          ? tx.to
          : tx.from;

      if (
        !counterparty
      ) {
        continue;
      }

      const item =
        getItem(
          counterparty
        );

      item.interactionCount++;
      item.tokenEventCount++;

      item.sourceSet.add(
        "ERC-20"
      );

      if (
        tx.tokenSymbol
      ) {
        item.tokenSet.add(
          tx.tokenSymbol
        );
      }

      item.lastTimestamp =
        Math.max(
          item.lastTimestamp,
          Number(
            tx.timeStamp
          )
        );

      if (outgoing) {
        item.outgoingCount++;
      } else {
        item.incomingCount++;
      }
    }

    for (
      const tx of internals
    ) {
      const from =
        tx.from?.toLowerCase();

      const to =
        tx.to?.toLowerCase();

      const outgoing =
        from === target;

      const incoming =
        to === target;

      if (
        !outgoing &&
        !incoming
      ) {
        continue;
      }

      const counterparty =
        outgoing
          ? tx.to
          : tx.from;

      if (
        !counterparty
      ) {
        continue;
      }

      const item =
        getItem(
          counterparty
        );

      item.interactionCount++;
      item.internalEventCount++;

      item.sourceSet.add(
        "Internal"
      );

      item.lastTimestamp =
        Math.max(
          item.lastTimestamp,
          Number(
            tx.timeStamp
          )
        );

      let amount =
        0;

      try {
        amount =
          Number(
            ethers.formatEther(
              tx.value ||
                "0"
            )
          );
      } catch {}

      if (outgoing) {
        item.outgoingCount++;
        item.ethOut +=
          amount;
      } else {
        item.incomingCount++;
        item.ethIn +=
          amount;
      }
    }

    return Array.from(
      map.values()
    )
      .map(
        (item) => ({
          address:
            item.address,

          interactionCount:
            item.interactionCount,

          outgoingCount:
            item.outgoingCount,

          incomingCount:
            item.incomingCount,

          ethOut:
            item.ethOut,

          ethIn:
            item.ethIn,

          tokenEventCount:
            item.tokenEventCount,

          internalEventCount:
            item.internalEventCount,

          sources:
            Array.from(
              item.sourceSet
            ),

          tokenSymbols:
            Array.from(
              item.tokenSet
            ).slice(
              0,
              8
            ),

          lastTimestamp:
            item.lastTimestamp,
        })
      )
      .sort(
        (a, b) =>
          b.interactionCount -
          a.interactionCount
      );
  }

  function detectCounterpartyAnomalies(
    items: Counterparty[]
  ): Anomaly[] {
    const results:
      Anomaly[] =
      [];

    if (
      !items.length
    ) {
      return results;
    }

    const outgoingTotal =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.outgoingCount,
        0
      );

    if (
      outgoingTotal >=
      5
    ) {
      const top =
        [...items].sort(
          (a, b) =>
            b.outgoingCount -
            a.outgoingCount
        )[0];

      const ratio =
        top.outgoingCount /
        outgoingTotal;

      if (
        top.outgoingCount >=
          4 &&
        ratio >=
          0.7
      ) {
        results.push({
          type:
            language ===
            "zh"
              ? "对手方高度集中"
              : "Counterparty Concentration",

          severity:
            ratio >=
            0.85
              ? "HIGH"
              : "MEDIUM",

          description:
            language ===
            "zh"
              ? `${(
                  ratio *
                  100
                ).toFixed(
                  1
                )}% 的样本转出交互集中于同一个对手方。`
              : `${(
                  ratio *
                  100
                ).toFixed(
                  1
                )}% of sampled outgoing interactions involve one counterparty.`,

          score:
            ratio >=
            0.85
              ? 12
              : 7,
        });
      }
    }

    return results;
  }

  function detectEthAnomalies(
    txs: Transaction[],
    targetAddress: string
  ): Anomaly[] {
    const results:
      Anomaly[] =
      [];

    if (
      !txs.length
    ) {
      return results;
    }

    const target =
      targetAddress.toLowerCase();

    const parsed =
      txs
        .map(
          (tx) => {
            let ethValue =
              0;

            try {
              ethValue =
                Number(
                  ethers.formatEther(
                    tx.value ||
                      "0"
                  )
                );
            } catch {}

            return {
              ...tx,

              ethValue,

              timestamp:
                Number(
                  tx.timeStamp
                ),

              isOutgoing:
                tx.from?.toLowerCase() ===
                target,

              isIncoming:
                tx.to?.toLowerCase() ===
                target,
            };
          }
        )
        .sort(
          (a, b) =>
            a.timestamp -
            b.timestamp
        );

    const outgoing =
      parsed.filter(
        (tx) =>
          tx.isOutgoing &&
          tx.ethValue >
            0
      );

    const incoming =
      parsed.filter(
        (tx) =>
          tx.isIncoming &&
          tx.ethValue >
            0
      );

    const avgOutgoing =
      outgoing.length
        ? outgoing.reduce(
            (
              sum,
              tx
            ) =>
              sum +
              tx.ethValue,
            0
          ) /
          outgoing.length
        : 0;

    const large =
      outgoing.filter(
        (tx) =>
          avgOutgoing >
            0 &&
          tx.ethValue >=
            avgOutgoing *
              3 &&
          tx.ethValue >=
            0.1
      );

    if (
      large.length
    ) {
      const biggest =
        large.reduce(
          (a, b) =>
            a.ethValue >
            b.ethValue
              ? a
              : b
        );

      const high =
        biggest.ethValue >=
        avgOutgoing *
          8;

      results.push({
        type:
          language ===
          "zh"
            ? "ETH 大额转出"
            : "Large ETH Transfer",

        severity:
          high
            ? "HIGH"
            : "MEDIUM",

        description:
          language ===
          "zh"
            ? `${biggest.ethValue.toFixed(
                4
              )} ETH 显著高于近期平均转出 ${avgOutgoing.toFixed(
                4
              )} ETH。`
            : `${biggest.ethValue.toFixed(
                4
              )} ETH was significantly larger than the recent outgoing average of ${avgOutgoing.toFixed(
                4
              )} ETH.`,

        score:
          high
            ? 18
            : 10,

        evidenceHash:
          biggest.hash,
      });
    }

    let max10m =
      0;

    let evidenceHash =
      "";

    for (
      let i = 0;
      i <
      parsed.length;
      i++
    ) {
      let count =
        0;

      for (
        let j = i;
        j <
        parsed.length;
        j++
      ) {
        if (
          parsed[j]
            .timestamp -
            parsed[i]
              .timestamp <=
          600
        ) {
          count++;
        } else {
          break;
        }
      }

      if (
        count >
        max10m
      ) {
        max10m =
          count;

        evidenceHash =
          parsed[i]
            .hash;
      }
    }

    if (
      max10m >=
      8
    ) {
      results.push({
        type:
          language ===
          "zh"
            ? "ETH 交易频率突增"
            : "ETH Transaction Frequency Spike",

        severity:
          max10m >=
          15
            ? "HIGH"
            : "MEDIUM",

        description:
          language ===
          "zh"
            ? `10 分钟内观察到 ${max10m} 次普通 Ethereum 交易。`
            : `${max10m} normal Ethereum transactions occurred within a 10-minute window.`,

        score:
          max10m >=
          15
            ? 14
            : 8,

        evidenceHash,
      });
    }

    for (
      const received of incoming
    ) {
      let outgoingSoon =
        0;

      let rapidHash =
        "";

      for (
        const sent of outgoing
      ) {
        const delay =
          sent.timestamp -
          received.timestamp;

        if (
          delay >=
            0 &&
          delay <=
            1800
        ) {
          outgoingSoon +=
            sent.ethValue;

          if (
            !rapidHash
          ) {
            rapidHash =
              sent.hash;
          }
        }
      }

      if (
        received.ethValue >=
          0.1 &&
        outgoingSoon >=
          received.ethValue *
            0.7
      ) {
        results.push({
          type:
            language ===
            "zh"
              ? "ETH 快速流出"
              : "Rapid ETH Outflow",

          severity:
            "HIGH",

          description:
            language ===
            "zh"
              ? `收到 ${received.ethValue.toFixed(
                  4
                )} ETH 后，30 分钟内约有 ${outgoingSoon.toFixed(
                  4
                )} ETH 被转出。`
              : `After receiving ${received.ethValue.toFixed(
                  4
                )} ETH, approximately ${outgoingSoon.toFixed(
                  4
                )} ETH was sent out within 30 minutes.`,

          score:
            18,

          evidenceHash:
            rapidHash,
        });

        break;
      }
    }

    return results;
  }

  function detectTokenAnomalies(
    transfers: TokenTransfer[],
    targetAddress: string
  ): Anomaly[] {
    const results:
      Anomaly[] =
      [];

    if (
      !transfers.length
    ) {
      return results;
    }

    const parsed =
      transfers
        .map(
          (tx) => ({
            ...tx,

            timestamp:
              Number(
                tx.timeStamp
              ),
          })
        )
        .sort(
          (a, b) =>
            a.timestamp -
            b.timestamp
        );

    let max10m =
      0;

    let evidenceHash =
      "";

    for (
      let i = 0;
      i <
      parsed.length;
      i++
    ) {
      let count =
        0;

      for (
        let j = i;
        j <
        parsed.length;
        j++
      ) {
        if (
          parsed[j]
            .timestamp -
            parsed[i]
              .timestamp <=
          600
        ) {
          count++;
        } else {
          break;
        }
      }

      if (
        count >
        max10m
      ) {
        max10m =
          count;

        evidenceHash =
          parsed[i]
            .hash;
      }
    }

    if (
      max10m >=
      8
    ) {
      results.push({
        type:
          language ===
          "zh"
            ? "ERC-20 活动突增"
            : "ERC-20 Activity Spike",

        severity:
          max10m >=
          15
            ? "HIGH"
            : "MEDIUM",

        description:
          language ===
          "zh"
            ? `10 分钟内观察到 ${max10m} 次 ERC-20 转账事件。`
            : `${max10m} ERC-20 transfer events occurred within a 10-minute window.`,

        score:
          max10m >=
          15
            ? 14
            : 8,

        evidenceHash,
      });
    }

    return results;
  }

  function detectInternalAnomalies(
    items: InternalTransaction[],
    targetAddress: string
  ): Anomaly[] {
    const results:
      Anomaly[] =
      [];

    if (
      !items.length
    ) {
      return results;
    }

    const parsed =
      items
        .map(
          (tx) => ({
            ...tx,

            timestamp:
              Number(
                tx.timeStamp
              ),
          })
        )
        .sort(
          (a, b) =>
            a.timestamp -
            b.timestamp
        );

    let max10m =
      0;

    let evidenceHash =
      "";

    for (
      let i = 0;
      i <
      parsed.length;
      i++
    ) {
      let count =
        0;

      for (
        let j = i;
        j <
        parsed.length;
        j++
      ) {
        if (
          parsed[j]
            .timestamp -
            parsed[i]
              .timestamp <=
          600
        ) {
          count++;
        } else {
          break;
        }
      }

      if (
        count >
        max10m
      ) {
        max10m =
          count;

        evidenceHash =
          parsed[i]
            .hash;
      }
    }

    if (
      max10m >=
      8
    ) {
      results.push({
        type:
          language ===
          "zh"
            ? "Internal 活动突增"
            : "Internal Transaction Activity Spike",

        severity:
          max10m >=
          15
            ? "HIGH"
            : "MEDIUM",

        description:
          language ===
          "zh"
            ? `10 分钟内观察到 ${max10m} 次 Internal Transaction。`
            : `${max10m} internal transaction events occurred within a 10-minute window.`,

        score:
          max10m >=
          15
            ? 14
            : 8,

        evidenceHash,
      });
    }

    return results;
  }

  function calculateRiskScore(
    items: Anomaly[]
  ) {
    return Math.min(
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.score,
        0
      ),
      100
    );
  }

  function formatTokenAmount(
    value: string,
    decimals: string
  ) {
    try {
      return Number(
        ethers.formatUnits(
          value ||
            "0",
          Number(
            decimals ||
              "18"
          )
        )
      ).toFixed(
        4
      );
    } catch {
      return "0.0000";
    }
  }

  function formatEth(
    value: string
  ) {
    try {
      return Number(
        ethers.formatEther(
          value ||
            "0"
        )
      ).toFixed(
        4
      );
    } catch {
      return "0.0000";
    }
  }

  function formatTime(
    timestamp: string
  ) {
    return new Date(
      Number(
        timestamp
      ) *
        1000
    ).toLocaleString(
      language ===
        "zh"
        ? "zh-CN"
        : "en-US"
    );
  }

  function getRiskLevel(
    score: number | null
  ) {
    if (
      score ===
      null
    ) {
      return {
        label:
          language ===
          "zh"
            ? "等待"
            : "WAITING",

        className:
          "text-slate-400",
      };
    }

    if (
      score >=
      80
    ) {
      return {
        label:
          language ===
          "zh"
            ? "严重"
            : "CRITICAL",

        className:
          "text-red-400",
      };
    }

    if (
      score >=
      60
    ) {
      return {
        label:
          language ===
          "zh"
            ? "高风险"
            : "HIGH",

        className:
          "text-orange-400",
      };
    }

    if (
      score >=
      30
    ) {
      return {
        label:
          language ===
          "zh"
            ? "中风险"
            : "MEDIUM",

        className:
          "text-amber-400",
      };
    }

    return {
      label:
        language ===
        "zh"
          ? "低风险"
          : "LOW",

      className:
        "text-emerald-400",
    };
  }

  const risk =
    useMemo(
      () =>
        getRiskLevel(
          riskScore
        ),
      [
        riskScore,
        language,
      ]
    );

  const totalEvents =
    transactions.length +
    tokenTransfers.length +
    internalTransactions.length;

  const importantChanges =
    changeAnalysis?.metrics.filter(
      (x) =>
        x.important
    ) ||
    [];

  const hasResults =
    riskScore !==
    null;

  return (
    <main className="min-h-screen bg-[#08111d] text-white">

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-250px] h-[550px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-500/[0.06] blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-7 md:px-8">

        <header className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] font-semibold text-cyan-300">
              C
            </div>

            <div>
              <div className="font-semibold">
                ChainScope AI
              </div>

              <div className="text-xs text-slate-500">
                {t.subtitle}
              </div>
            </div>

          </div>

          <div className="flex items-center gap-3">

            <div className="hidden text-xs text-slate-500 md:block">
              {t.network}
            </div>

            <LanguageSwitch
              language={
                language
              }
              onChange={
                updateLanguage
              }
            />

          </div>

        </header>

        <section className="pb-12 pt-20 text-center md:pt-28">

          <div className="text-xs uppercase tracking-[0.28em] text-cyan-400">
            {t.heroEyebrow}
          </div>

          <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] md:text-6xl">
            {t.heroTitle1}
            <span className="block text-slate-400">
              {t.heroTitle2}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-slate-400 md:text-base">
            {t.heroDescription}
          </p>

          <div className="mx-auto mt-9 flex max-w-3xl flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2 md:flex-row">

            <input
              value={
                address
              }
              onChange={(
                e
              ) =>
                setAddress(
                  e.target
                    .value
                )
              }
              placeholder={
                t.placeholder
              }
              className="flex-1 bg-transparent px-4 py-4 font-mono text-sm outline-none"
            />

            <button
              onClick={
                startInvestigation
              }
              disabled={
                loading
              }
              className="rounded-xl bg-white px-6 py-4 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {loading
                ? t.investigating
                : t.start}
            </button>

          </div>

          <div className="mt-4 text-xs text-slate-500">
            {status}
          </div>

        </section>

        {hasResults && (
          <>

            <section className="grid gap-3 md:grid-cols-4">

              <SummaryCard
                label={
                  t.rootRisk
                }
                value={`${riskScore}`}
                description={
                  risk.label
                }
                valueClass={
                  risk.className
                }
              />

              <SummaryCard
                label={
                  t.observedEvents
                }
                value={`${totalEvents}`}
                description={`${transactions.length} ETH · ${tokenTransfers.length} ERC-20 · ${internalTransactions.length} Internal`}
              />

              <SummaryCard
                label={
                  t.changeSignals
                }
                value={`${importantChanges.length}`}
                description={
                  t.whatChangedDesc
                }
              />

              <SummaryCard
                label={
                  t.agentTrace
                }
                value={
                  secondHop
                    ? "1"
                    : "0"
                }
                description={
                  secondHop
                    ? t.firstHop
                    : t.noSecondHop
                }
              />

            </section>

            <section className="mt-7">

              <div className="inline-flex rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5">

                <TabButton
                  active={
                    activeTab ===
                    "overview"
                  }
                  onClick={() =>
                    setActiveTab(
                      "overview"
                    )
                  }
                >
                  {t.overview}
                </TabButton>

                <TabButton
                  active={
                    activeTab ===
                    "trace"
                  }
                  onClick={() =>
                    setActiveTab(
                      "trace"
                    )
                  }
                >
                  {t.trace}
                </TabButton>

                <TabButton
                  active={
                    activeTab ===
                    "report"
                  }
                  onClick={() =>
                    setActiveTab(
                      "report"
                    )
                  }
                >
                  {t.report}
                </TabButton>

                <TabButton
                  active={
                    activeTab ===
                    "evidence"
                  }
                  onClick={() =>
                    setActiveTab(
                      "evidence"
                    )
                  }
                >
                  {t.evidence}
                </TabButton>

              </div>

            </section>

            {activeTab ===
              "overview" && (
              <div className="mt-5 space-y-5">

                <Panel>

                  <SectionHeader
                    number="01"
                    title={
                      t.whatChanged
                    }
                    subtitle={
                      t.whatChangedDesc
                    }
                  />

                  <p className="mt-5 text-sm leading-7 text-slate-400">
                    {language ===
                    "zh"
                      ? changeAnalysis?.summaryZh
                      : changeAnalysis?.summaryEn}
                  </p>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">

                    {importantChanges.length ? (
                      importantChanges.map(
                        (item) => (
                          <ChangeCard
                            key={
                              item.key
                            }
                            item={
                              item
                            }
                            language={
                              language
                            }
                            recentLabel={
                              t.recent
                            }
                            baselineLabel={
                              t.baseline
                            }
                          />
                        )
                      )
                    ) : (
                      <div className="md:col-span-2 lg:col-span-3">
                        <EmptyState>
                          {t.noChange}
                        </EmptyState>
                      </div>
                    )}

                  </div>

                </Panel>

                <Panel>

                  <SectionHeader
                    number="02"
                    title={
                      t.whyChanged
                    }
                    subtitle={
                      t.whyChangedDesc
                    }
                  />

                  <div className="mt-5 grid gap-3 lg:grid-cols-3">

                    {changeAnalysis?.causes.length ? (
                      changeAnalysis.causes.map(
                        (cause) => (
                          <CauseCard
                            key={
                              cause.id
                            }
                            cause={
                              cause
                            }
                            language={
                              language
                            }
                            confidenceLabel={
                              t.confidence
                            }
                            levels={{
                              LOW:
                                t.low,
                              MEDIUM:
                                t.medium,
                              HIGH:
                                t.high,
                            }}
                          />
                        )
                      )
                    ) : (
                      <div className="lg:col-span-3">
                        <EmptyState>
                          {t.noCause}
                        </EmptyState>
                      </div>
                    )}

                  </div>

                </Panel>

                <Panel>

                  <SectionHeader
                    number="03"
                    title={
                      t.potentialImpact
                    }
                    subtitle={
                      t.potentialImpactDesc
                    }
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-2">

                    {changeAnalysis?.impacts.length ? (
                      changeAnalysis.impacts.map(
                        (impact) => (
                          <ImpactCard
                            key={
                              impact.id
                            }
                            impact={
                              impact
                            }
                            language={
                              language
                            }
                          />
                        )
                      )
                    ) : (
                      <div className="md:col-span-2">
                        <EmptyState>
                          {t.noImpact}
                        </EmptyState>
                      </div>
                    )}

                  </div>

                </Panel>

                <Panel>

                  <SectionHeader
                    number="04"
                    title={
                      t.supportingEvidence
                    }
                    subtitle={
                      t.supportingEvidenceDesc
                    }
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-3">

                    <EvidenceSummary
                      title={
                        language ===
                        "zh"
                          ? "异常信号"
                          : "Anomaly Signals"
                      }
                      value={`${anomalies.length}`}
                      description={
                        language ===
                        "zh"
                          ? "用于验证行为变化是否异常"
                          : "Used to validate whether behavioral changes are unusual"
                      }
                    />

                    <EvidenceSummary
                      title={
                        language ===
                        "zh"
                          ? "直接对手方"
                          : "Direct Counterparties"
                      }
                      value={`${counterparties.length}`}
                      description={
                        language ===
                        "zh"
                          ? "用于解释资金流向是否发生集中"
                          : "Used to explain whether fund relationships became concentrated"
                      }
                    />

                    <EvidenceSummary
                      title={
                        language ===
                        "zh"
                          ? "重点原始证据"
                          : "Flagged Raw Evidence"
                      }
                      value={`${flaggedHashes.size}`}
                      description={
                        language ===
                        "zh"
                          ? "异常规则直接引用的 Tx Hash"
                          : "Tx hashes directly referenced by anomaly rules"
                      }
                    />

                  </div>

                </Panel>

              </div>
            )}

            {activeTab ===
              "trace" && (
              <section className="mt-5">

                <Panel>

                  <SectionHeader
                    number="Agent"
                    title={
                      t.traceTitle
                    }
                    subtitle={
                      t.traceDesc
                    }
                  />

                  {!secondHop ? (
                    <div className="mt-5">
                      <EmptyState>
                        {t.noSecondHop}
                      </EmptyState>
                    </div>
                  ) : (
                    <div className="mt-8 flex flex-col items-center">

                      <TraceNode
                        badge={
                          t.rootWallet
                        }
                        address={
                          address
                        }
                      />

                      <TraceArrow
                        label={
                          t.directRelation
                        }
                      />

                      <TraceNode
                        badge={
                          t.firstHop
                        }
                        address={
                          secondHop
                            .investigatedAddress
                        }
                      />

                      <TraceArrow
                        label={
                          t.continueInvestigation
                        }
                      />

                      <div className="w-full">

                        <div className="text-center">

                          <div className="text-xs uppercase tracking-[0.22em] text-violet-300">
                            {t.secondHop}
                          </div>

                          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
                            {t.secondHopDesc}
                          </p>

                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-3">

                          {secondHop.counterparties
                            .filter(
                              (item) =>
                                item.address.toLowerCase() !==
                                address.toLowerCase()
                            )
                            .slice(0, 6)
                            .map(
                              (
                                item,
                                index
                              ) => (
                                <CounterpartyCard
                                  key={
                                    item.address
                                  }
                                  item={
                                    item
                                  }
                                  index={
                                    index + 1
                                  }
                                  language={
                                    language
                                  }
                                />
                              )
                            )}

                        </div>

                      </div>

                      <div className="mt-6 w-full rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4">

                        <div className="text-sm font-medium text-amber-300">
                          {t.important}
                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {t.importantText}
                        </p>

                      </div>

                    </div>
                  )}

                </Panel>

              </section>
            )}

            {activeTab ===
              "report" && (
              <section className="mt-5">

                <Panel>

                  <SectionHeader
                    number="AI"
                    title={
                      t.reportTitle
                    }
                    subtitle={
                      t.reportDesc
                    }
                  />

                  <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/[0.12] p-6">

                    {aiLoading ? (
                      <div className="py-10 text-sm text-cyan-400">
                        {t.generating}
                      </div>
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[
                          remarkGfm,
                        ]}
                        components={{
                          h2: ({
                            children,
                          }) => (
                            <h2 className="mb-4 mt-9 border-b border-white/[0.06] pb-3 text-xl font-semibold first:mt-0">
                              {children}
                            </h2>
                          ),

                          h3: ({
                            children,
                          }) => (
                            <h3 className="mb-3 mt-6 text-base font-semibold text-cyan-300">
                              {children}
                            </h3>
                          ),

                          p: ({
                            children,
                          }) => (
                            <p className="my-4 text-sm leading-7 text-slate-300">
                              {children}
                            </p>
                          ),

                          ul: ({
                            children,
                          }) => (
                            <ul className="my-4 list-disc space-y-2 pl-5 text-sm text-slate-300">
                              {children}
                            </ul>
                          ),

                          ol: ({
                            children,
                          }) => (
                            <ol className="my-4 list-decimal space-y-2 pl-5 text-sm text-slate-300">
                              {children}
                            </ol>
                          ),

                          blockquote: ({
                            children,
                          }) => (
                            <blockquote className="my-5 border-l-2 border-cyan-400 px-4 text-sm text-slate-400">
                              {children}
                            </blockquote>
                          ),

                          table: ({
                            children,
                          }) => (
                            <div className="my-5 overflow-x-auto">
                              <table className="w-full text-sm">
                                {children}
                              </table>
                            </div>
                          ),

                          th: ({
                            children,
                          }) => (
                            <th className="border border-white/[0.08] px-3 py-2 text-left">
                              {children}
                            </th>
                          ),

                          td: ({
                            children,
                          }) => (
                            <td className="border border-white/[0.06] px-3 py-2 text-slate-400">
                              {children}
                            </td>
                          ),
                        }}
                      >
                        {aiReport}
                      </ReactMarkdown>
                    )}

                  </div>

                </Panel>

              </section>
            )}

            {activeTab ===
              "evidence" && (
              <section className="mt-5">

                <Panel>

                  <SectionHeader
                    number="Data"
                    title={
                      t.evidenceTitle
                    }
                    subtitle={
                      t.evidenceDesc
                    }
                  />

                  {flaggedHashes.size > 0 && (
                    <div className="mt-5 flex items-start gap-3 rounded-xl border border-orange-400/20 bg-orange-400/[0.04] p-4">

                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-400/10 text-sm text-orange-300">
                        !
                      </div>

                      <div>
                        <div className="text-sm font-medium text-orange-200">
                          {language === "zh"
                            ? `检测到 ${flaggedHashes.size} 个重点 Tx Hash`
                            : `${flaggedHashes.size} flagged transaction hash(es) detected`}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {t.evidenceReason}
                        </p>
                      </div>

                    </div>
                  )}

                  <div className="mt-5 space-y-2">

                    <EvidenceAccordion
                      title={
                        t.anomalies
                      }
                      count={
                        anomalies.length
                      }
                      flaggedCount={
                        anomalies.filter(
                          (item) =>
                            Boolean(
                              item.evidenceHash
                            )
                        ).length
                      }
                      language={
                        language
                      }
                    >
                      <div className="space-y-2">
                        {anomalies.map(
                          (
                            item,
                            index
                          ) => (
                            <AnomalyEvidence
                              key={`${item.type}-${index}`}
                              anomaly={
                                item
                              }
                              language={
                                language
                              }
                            />
                          )
                        )}
                      </div>
                    </EvidenceAccordion>

                    <EvidenceAccordion
                      title={
                        t.ethTransactions
                      }
                      count={
                        transactions.length
                      }
                      flaggedCount={
                        flaggedEthCount
                      }
                      language={
                        language
                      }
                    >
                      <TransactionEvidence
                        items={
                          transactions
                        }
                        address={
                          address
                        }
                        formatTime={
                          formatTime
                        }
                        flaggedHashes={
                          flaggedHashes
                        }
                        language={
                          language
                        }
                      />
                    </EvidenceAccordion>

                    <EvidenceAccordion
                      title={
                        t.tokenTransfers
                      }
                      count={
                        tokenTransfers.length
                      }
                      flaggedCount={
                        flaggedTokenCount
                      }
                      language={
                        language
                      }
                    >
                      <TokenEvidence
                        items={
                          tokenTransfers
                        }
                        address={
                          address
                        }
                        formatTime={
                          formatTime
                        }
                        flaggedHashes={
                          flaggedHashes
                        }
                        language={
                          language
                        }
                      />
                    </EvidenceAccordion>

                    <EvidenceAccordion
                      title={
                        t.internalTransactions
                      }
                      count={
                        internalTransactions.length
                      }
                      flaggedCount={
                        flaggedInternalCount
                      }
                      language={
                        language
                      }
                    >
                      <InternalEvidence
                        items={
                          internalTransactions
                        }
                        address={
                          address
                        }
                        formatTime={
                          formatTime
                        }
                        flaggedHashes={
                          flaggedHashes
                        }
                        language={
                          language
                        }
                      />
                    </EvidenceAccordion>

                  </div>

                </Panel>

              </section>
            )}

          </>
        )}

      </div>

    </main>
  );
}

function LanguageSwitch({
  language,
  onChange,
}: {
  language:
    Language;

  onChange:
    (
      lang:
        Language
    ) => void;
}) {
  return (
    <div className="flex rounded-lg border border-white/[0.08] p-1">

      <button
        onClick={() =>
          onChange(
            "zh"
          )
        }
        className={`rounded-md px-3 py-1.5 text-xs ${
          language ===
          "zh"
            ? "bg-white text-slate-950"
            : "text-slate-500"
        }`}
      >
        中文
      </button>

      <button
        onClick={() =>
          onChange(
            "en"
          )
        }
        className={`rounded-md px-3 py-1.5 text-xs ${
          language ===
          "en"
            ? "bg-white text-slate-950"
            : "text-slate-500"
        }`}
      >
        EN
      </button>

    </div>
  );
}

function Panel({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.065] bg-white/[0.025] p-5 md:p-6">
      {children}
    </div>
  );
}

function SectionHeader({
  number,
  title,
  subtitle,
}: {
  number:
    string;

  title:
    string;

  subtitle:
    string;
}) {
  return (
    <div className="flex gap-4">

      <div className="pt-0.5 text-xs font-medium text-cyan-400">
        {number}
      </div>

      <div>

        <h3 className="text-lg font-medium">
          {title}
        </h3>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          {subtitle}
        </p>

      </div>

    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  valueClass = "",
}: {
  label:
    string;

  value:
    string;

  description:
    string;

  valueClass?:
    string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">

      <div className="text-[11px] uppercase tracking-[0.17em] text-slate-500">
        {label}
      </div>

      <div className={`mt-4 text-3xl font-semibold ${valueClass}`}>
        {value}
      </div>

      <div className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </div>

    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active:
    boolean;

  onClick:
    () =>
      void;

  children:
    ReactNode;
}) {
  return (
    <button
      onClick={
        onClick
      }
      className={`rounded-lg px-4 py-2 text-sm ${
        active
          ? "bg-white text-slate-950"
          : "text-slate-500 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ChangeCard({
  item,
  language,
  recentLabel,
  baselineLabel,
}: {
  item:
    ChangeMetric;

  language:
    Language;

  recentLabel:
    string;

  baselineLabel:
    string;
}) {
  const up =
    item.direction ===
    "UP";

  const label =
    language ===
    "zh"
      ? item.labelZh
      : item.labelEn;

  const unit =
    language ===
    "zh"
      ? item.unitZh
      : item.unitEn;

  const explanation =
    language ===
    "zh"
      ? item.explanationZh
      : item.explanationEn;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/[0.1] p-4">

      <div className="flex items-start justify-between">

        <div className="text-sm font-medium">
          {label}
        </div>

        <div
          className={
            up
              ? "text-emerald-400"
              : "text-orange-400"
          }
        >
          {up
            ? "↑"
            : "↓"}
        </div>

      </div>

      <div className="mt-4 flex items-end gap-3">

        <div>

          <div className="text-[10px] uppercase text-slate-600">
            {baselineLabel}
          </div>

          <div className="mt-1 text-lg text-slate-500">
            {formatMetricValue(
              item.baseline
            )}
            {unit}
          </div>

        </div>

        <div className="pb-1 text-slate-700">
          →
        </div>

        <div>

          <div className="text-[10px] uppercase text-slate-600">
            {recentLabel}
          </div>

          <div className="mt-1 text-2xl font-semibold">
            {formatMetricValue(
              item.recent
            )}
            {unit}
          </div>

        </div>

      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        {explanation}
      </p>

    </div>
  );
}

function CauseCard({
  cause,
  language,
  confidenceLabel,
  levels,
}: {
  cause:
    CauseHypothesis;

  language:
    Language;

  confidenceLabel:
    string;

  levels: {
    LOW:
      string;
    MEDIUM:
      string;
    HIGH:
      string;
  };
}) {
  const title =
    language ===
    "zh"
      ? cause.titleZh
      : cause.titleEn;

  const evidence =
    language ===
    "zh"
      ? cause.evidenceZh
      : cause.evidenceEn;

  const explanation =
    language ===
    "zh"
      ? cause.explanationZh
      : cause.explanationEn;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/[0.1] p-5">

      <div className="flex items-start justify-between gap-3">

        <div className="font-medium">
          {title}
        </div>

        <div className="rounded-md bg-white/[0.05] px-2 py-1 text-[10px] text-slate-400">
          {confidenceLabel}:{" "}
          {levels[
            cause.confidence
          ]}
        </div>

      </div>

      <div className="mt-4 space-y-2">

        {evidence.map(
          (
            item,
            index
          ) => (
            <div
              key={
                index
              }
              className="flex gap-2 text-xs text-slate-400"
            >
              <span className="text-emerald-400">
                ✓
              </span>

              {item}
            </div>
          )
        )}

      </div>

      <p className="mt-4 text-xs leading-6 text-slate-500">
        {explanation}
      </p>

    </div>
  );
}

function ImpactCard({
  impact,
  language,
}: {
  impact:
    ImpactItem;

  language:
    Language;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/[0.1] p-5">

      <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-400">
        {language ===
        "zh"
          ? impact.categoryZh
          : impact.categoryEn}
      </div>

      <div className="mt-2 font-medium">
        {language ===
        "zh"
          ? impact.titleZh
          : impact.titleEn}
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        {language ===
        "zh"
          ? impact.descriptionZh
          : impact.descriptionEn}
      </p>

    </div>
  );
}

function EvidenceSummary({
  title,
  value,
  description,
}: {
  title:
    string;

  value:
    string;

  description:
    string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/[0.1] p-4">

      <div className="text-xs text-slate-500">
        {title}
      </div>

      <div className="mt-2 text-2xl font-semibold">
        {value}
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-600">
        {description}
      </p>

    </div>
  );
}

function TraceNode({
  badge,
  address,
}: {
  badge:
    string;

  address:
    string;
}) {
  return (
    <div className="w-full max-w-xl rounded-xl border border-cyan-400/20 bg-cyan-400/[0.025] p-5 text-center">

      <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
        {badge}
      </div>

      <div className="mt-3 break-all font-mono text-sm text-slate-300">
        {address}
      </div>

    </div>
  );
}

function TraceArrow({
  label,
}: {
  label:
    string;
}) {
  return (
    <div className="flex flex-col items-center py-4">

      <div className="h-6 w-px bg-white/[0.12]" />

      <div className="rounded-full border border-white/[0.07] px-3 py-1 text-[10px] text-slate-500">
        {label}
      </div>

      <div className="h-6 w-px bg-white/[0.12]" />

      <div className="text-xs text-slate-600">
        ▼
      </div>

    </div>
  );
}

function CounterpartyCard({
  item,
  index,
  language,
}: {
  item:
    Counterparty;

  index:
    number;

  language:
    Language;
}) {
  return (
    <div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.025] p-4">

      <div className="text-[10px] text-violet-300">
        {language ===
        "zh"
          ? `关联地址 #${index}`
          : `Connected Address #${index}`}
      </div>

      <div className="mt-2 truncate font-mono text-sm">
        {shortenGlobal(
          item.address
        )}
      </div>

      <div className="mt-3 text-xs text-slate-500">
        {item.interactionCount}{" "}
        {language ===
        "zh"
          ? "次观测事件"
          : "observed events"}
      </div>

    </div>
  );
}

function EvidenceAccordion({
  title,
  count,
  flaggedCount,
  language,
  children,
}: {
  title:
    string;

  count:
    number;

  flaggedCount:
    number;

  language:
    Language;

  children:
    ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-white/[0.06] bg-black/[0.04]">

      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">

        <div className="flex items-center gap-3">

          <span className="text-sm">
            {title}
          </span>

          {flaggedCount > 0 && (
            <span className="rounded-full border border-orange-400/20 bg-orange-400/[0.08] px-2.5 py-1 text-[10px] font-medium text-orange-300">
              {language ===
              "zh"
                ? `${flaggedCount} 条重点`
                : `${flaggedCount} flagged`}
            </span>
          )}

        </div>

        <div className="flex items-center gap-3">

          <span className="text-xs text-slate-500">
            {count}
          </span>

          <span className="text-xs text-slate-600 transition group-open:rotate-180">
            ↓
          </span>

        </div>

      </summary>

      <div className="border-t border-white/[0.05] p-4">
        {children}
      </div>

    </details>
  );
}

function AnomalyEvidence({
  anomaly,
  language,
}: {
  anomaly:
    Anomaly;

  language:
    Language;
}) {
  const hasEvidence =
    Boolean(
      anomaly.evidenceHash
    );

  return (
    <div
      className={`rounded-lg border p-4 ${
        hasEvidence
          ? "border-orange-400/20 bg-orange-400/[0.035]"
          : "border-transparent bg-black/[0.12]"
      }`}
    >

      <div className="flex items-start justify-between gap-3">

        <div>

          <div className="text-sm font-medium">
            {anomaly.type}
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            {anomaly.description}
          </p>

        </div>

        {hasEvidence && (
          <span className="shrink-0 rounded-md bg-orange-400/10 px-2 py-1 text-[10px] font-medium text-orange-300">
            {language ===
            "zh"
              ? "有链上证据"
              : "Evidence Linked"}
          </span>
        )}

      </div>

      {anomaly.evidenceHash && (
        <div className="mt-3 border-t border-orange-400/10 pt-3 font-mono text-[10px] text-orange-300/70">
          Tx:{" "}
          {shortenGlobal(
            anomaly.evidenceHash
          )}
        </div>
      )}

    </div>
  );
}

function TransactionEvidence({
  items,
  address,
  formatTime,
  flaggedHashes,
  language,
}: {
  items:
    Transaction[];

  address:
    string;

  formatTime:
    (
      time:
        string
    ) =>
      string;

  flaggedHashes:
    Set<string>;

  language:
    Language;
}) {
  const ordered =
    [...items]
      .slice(0, 30)
      .sort(
        (a, b) =>
          Number(
            flaggedHashes.has(
              b.hash?.toLowerCase()
            )
          ) -
          Number(
            flaggedHashes.has(
              a.hash?.toLowerCase()
            )
          )
      );

  return (
    <div className="space-y-2">

      {ordered.map(
        (
          tx
        ) => {
          const flagged =
            flaggedHashes.has(
              tx.hash?.toLowerCase()
            );

          return (
            <EvidenceRow
              key={
                tx.hash
              }
              direction={
                tx.from?.toLowerCase() ===
                address.toLowerCase()
                  ? "OUT"
                  : "IN"
              }
              title={`${formatEtherSafe(
                tx.value
              )} ETH`}
              hash={
                tx.hash
              }
              time={
                formatTime(
                  tx.timeStamp
                )
              }
              flagged={
                flagged
              }
              language={
                language
              }
            />
          );
        }
      )}

    </div>
  );
}

function TokenEvidence({
  items,
  address,
  formatTime,
  flaggedHashes,
  language,
}: {
  items:
    TokenTransfer[];

  address:
    string;

  formatTime:
    (
      time:
        string
    ) =>
      string;

  flaggedHashes:
    Set<string>;

  language:
    Language;
}) {
  const ordered =
    [...items]
      .slice(0, 30)
      .sort(
        (a, b) =>
          Number(
            flaggedHashes.has(
              b.hash?.toLowerCase()
            )
          ) -
          Number(
            flaggedHashes.has(
              a.hash?.toLowerCase()
            )
          )
      );

  return (
    <div className="space-y-2">

      {ordered.map(
        (
          tx,
          index
        ) => {
          const flagged =
            flaggedHashes.has(
              tx.hash?.toLowerCase()
            );

          return (
            <EvidenceRow
              key={`${tx.hash}-${index}`}
              direction={
                tx.from?.toLowerCase() ===
                address.toLowerCase()
                  ? "OUT"
                  : "IN"
              }
              title={
                tx.tokenSymbol ||
                "TOKEN"
              }
              hash={
                tx.hash
              }
              time={
                formatTime(
                  tx.timeStamp
                )
              }
              flagged={
                flagged
              }
              language={
                language
              }
            />
          );
        }
      )}

    </div>
  );
}

function InternalEvidence({
  items,
  address,
  formatTime,
  flaggedHashes,
  language,
}: {
  items:
    InternalTransaction[];

  address:
    string;

  formatTime:
    (
      time:
        string
    ) =>
      string;

  flaggedHashes:
    Set<string>;

  language:
    Language;
}) {
  const ordered =
    [...items]
      .slice(0, 30)
      .sort(
        (a, b) =>
          Number(
            flaggedHashes.has(
              b.hash?.toLowerCase()
            )
          ) -
          Number(
            flaggedHashes.has(
              a.hash?.toLowerCase()
            )
          )
      );

  return (
    <div className="space-y-2">

      {ordered.map(
        (
          tx,
          index
        ) => {
          const flagged =
            flaggedHashes.has(
              tx.hash?.toLowerCase()
            );

          return (
            <EvidenceRow
              key={`${tx.hash}-${index}`}
              direction={
                tx.from?.toLowerCase() ===
                address.toLowerCase()
                  ? "OUT"
                  : "IN"
              }
              title={`${formatEtherSafe(
                tx.value
              )} ETH · Internal`}
              hash={
                tx.hash
              }
              time={
                formatTime(
                  tx.timeStamp
                )
              }
              flagged={
                flagged
              }
              language={
                language
              }
            />
          );
        }
      )}

    </div>
  );
}

function EvidenceRow({
  direction,
  title,
  hash,
  time,
  flagged,
  language,
}: {
  direction:
    "IN" |
    "OUT";

  title:
    string;

  hash:
    string;

  time:
    string;

  flagged:
    boolean;

  language:
    Language;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border p-4 transition ${
        flagged
          ? "border-orange-400/30 bg-orange-400/[0.055] shadow-[0_0_0_1px_rgba(251,146,60,0.03)]"
          : "border-transparent bg-black/[0.12]"
      }`}
    >

      {flagged && (
        <div className="absolute inset-y-0 left-0 w-[3px] bg-orange-400" />
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <span
            className={`rounded px-2 py-1 text-[10px] ${
              direction ===
              "OUT"
                ? "bg-orange-400/10 text-orange-300"
                : "bg-emerald-400/10 text-emerald-300"
            }`}
          >
            {direction}
          </span>

          <div>

            <div className="flex flex-wrap items-center gap-2">

              <div className="text-sm">
                {title}
              </div>

              {flagged && (
                <span className="rounded-md border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-orange-300">
                  {language ===
                  "zh"
                    ? "重点证据"
                    : "Flagged Evidence"}
                </span>
              )}

            </div>

            <div className="mt-1 font-mono text-[10px] text-slate-600">
              {shortenGlobal(
                hash
              )}
            </div>

          </div>

        </div>

        <div className="text-[10px] text-slate-600">
          {time}
        </div>

      </div>

      {flagged && (
        <div className="mt-3 rounded-md bg-orange-400/[0.04] px-3 py-2 text-[10px] leading-5 text-orange-200/60">
          {language ===
          "zh"
            ? "该交易被异常检测规则直接引用，建议优先核查。"
            : "This transaction is directly referenced by an anomaly rule and should be reviewed first."}
        </div>
      )}

    </div>
  );
}

function EmptyState({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] px-5 py-10 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

function formatMetricValue(
  value:
    number
) {
  if (
    Math.abs(
      value
    ) >=
    1000
  ) {
    return value.toLocaleString(
      undefined,
      {
        maximumFractionDigits:
          1,
      }
    );
  }

  if (
    Math.abs(
      value
    ) >=
    10
  ) {
    return value.toFixed(
      1
    );
  }

  return value.toFixed(
    2
  );
}

function formatEtherSafe(
  value:
    string
) {
  try {
    return Number(
      ethers.formatEther(
        value ||
          "0"
      )
    ).toFixed(
      4
    );
  } catch {
    return "0.0000";
  }
}

function shortenGlobal(
  value:
    string
) {
  if (
    !value
  ) {
    return "N/A";
  }

  if (
    value.length <=
    20
  ) {
    return value;
  }

  return `${value.slice(
    0,
    10
  )}...${value.slice(
    -8
  )}`;
}