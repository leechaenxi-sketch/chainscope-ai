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

type Tab =
  | "overview"
  | "trace"
  | "report"
  | "evidence";

const copy = {
  zh: {
    subtitle: "以太坊链上调查智能体",
    network: "Ethereum 主网",

    heroEyebrow: "链上智能调查",
    heroTitle1: "看清资金流向，",
    heroTitle2: "而不是淹没在数据里。",
    heroDescription:
      "整合 ETH、ERC-20、内部交易、对手方关系与自动二跳追踪，让复杂链上行为变得清晰可解释。",

    placeholder: "输入 Ethereum 地址：0x...",
    start: "开始调查",
    investigating: "调查中...",

    initialStatus: "输入一个 Ethereum 地址开始调查。",

    overview: "总览",
    trace: "Agent 追踪",
    report: "AI 报告",
    evidence: "原始证据",

    rootRisk: "根地址风险",
    rootRiskDesc: "仅评估当前被调查地址",

    observedEvents: "观测事件",
    signals: "异常信号",
    signalDesc: "可解释的行为异常指标",

    agentTrace: "Agent 追踪",
    hopDone: "已追踪 1 跳",
    noHop: "未追踪",
    hopDoneDesc: "自动深入调查一个直接对手方",
    noHopDesc: "没有找到合适的二跳目标",

    keySignals: "核心异常信号",
    keySignalsDesc: "当前地址最值得关注的行为异常。",

    directCounterparties: "直接对手方",
    directCounterpartiesDesc:
      "与当前被调查地址直接发生链上交互的地址。",

    investigationPath: "调查路径",
    investigationPathDesc:
      "清楚展示 ChainScope 如何从根地址逐步向下一层关系追踪。",

    howToRead: "如何理解这张图",
    howToReadDesc:
      "根地址是你输入的地址。ChainScope 会从它的直接对手方中自动选择一个值得进一步调查的地址，然后继续分析该地址的主要关系。第二跳地址并不一定与最初的根地址存在直接关系。",

    rootWallet: "根地址",
    investigatedAddress: "被调查地址",
    rootDesc: "这是用户最初输入的 Ethereum 地址。",

    firstHop: "第一跳",
    selectedCounterparty: "Agent 自动选择的直接对手方",
    selectedDesc:
      "ChainScope 根据交互强度和多来源信号自动选择该地址继续调查。",

    directRelationship: "直接链上关系",
    agentInvestigates: "Agent 继续调查此地址",

    secondHop: "第二跳",
    connectedAddresses: "该第一跳地址的主要关联地址",
    connectedDesc:
      "以下地址主要与第一跳地址发生交互，不代表它们一定与根地址存在直接关系。",

    connectedAddress: "关联地址",
    events: "次事件",
    outgoing: "转出",
    incoming: "转入",

    important: "重要说明",
    importantDesc:
      "第二跳地址的行为不会计入根地址 Risk Score。地址之间存在关系，也不代表它们具有相同身份、共同控制关系或恶意意图。",

    aiReport: "AI 调查报告",
    aiReportDesc:
      "DeepSeek 负责解释 ChainScope 已经计算和收集到的链上证据。",
    generatingReport: "正在生成调查报告...",

    evidenceExplorer: "证据浏览器",
    evidenceExplorerDesc:
      "原始区块链记录默认折叠，需要核查结论时再展开查看。",

    anomalySignals: "异常信号",
    ethTransactions: "ETH 普通交易",
    tokenTransfers: "ERC-20 转账",
    internalTransactions: "Internal Transactions",

    noSignals: "当前没有检测到明显异常信号。",
    noReport: "暂未生成 AI 调查报告。",
    noSecondHop: "没有找到适合自动继续追踪的第一跳地址。",

    firstHopSelected:
      "Agent 已选择该直接对手方继续调查，因为它具有较高的交互强度和跨来源行为信号。",

    viewTrace: "查看完整调查路径 →",

    ethTx: "ETH 交易",
    internal: "Internal",
    nextHop: "下一跳地址",

    rootScoreOnly: "仅根地址",
  },

  en: {
    subtitle: "Ethereum Investigation Agent",
    network: "Ethereum Mainnet",

    heroEyebrow: "On-chain Intelligence",
    heroTitle1: "Follow the money,",
    heroTitle2: "not the noise.",
    heroDescription:
      "Combine ETH, ERC-20, internal transactions, counterparty relationships and autonomous second-hop tracing into one clear investigation.",

    placeholder: "Enter Ethereum address: 0x...",
    start: "Start Investigation",
    investigating: "Investigating...",

    initialStatus: "Enter an Ethereum address to begin.",

    overview: "Overview",
    trace: "Agent Trace",
    report: "AI Report",
    evidence: "Evidence",

    rootRisk: "Root Risk",
    rootRiskDesc: "Evaluates the investigated root address only",

    observedEvents: "Observed Events",
    signals: "Signals",
    signalDesc: "Explainable behavioral anomaly indicators",

    agentTrace: "Agent Trace",
    hopDone: "1 Hop Traced",
    noHop: "No Trace",
    hopDoneDesc: "One direct counterparty investigated further",
    noHopDesc: "No suitable second-hop target",

    keySignals: "Key Signals",
    keySignalsDesc:
      "The most relevant behavioral anomalies around the investigated wallet.",

    directCounterparties: "Direct Counterparties",
    directCounterpartiesDesc:
      "Addresses directly interacting with the investigated wallet.",

    investigationPath: "Investigation Path",
    investigationPathDesc:
      "See exactly how ChainScope moves from the root address to the next relationship layer.",

    howToRead: "How to read this",
    howToReadDesc:
      "The root wallet is the address you entered. ChainScope automatically selects one direct counterparty for deeper investigation. The second-hop addresses shown afterward are relationships of that selected address and are not necessarily directly connected to the original root wallet.",

    rootWallet: "Root Wallet",
    investigatedAddress: "Investigated Address",
    rootDesc: "This is the Ethereum address entered by the user.",

    firstHop: "First Hop",
    selectedCounterparty: "Agent-selected Direct Counterparty",
    selectedDesc:
      "ChainScope selected this address based on interaction strength and cross-source signals.",

    directRelationship: "Direct on-chain relationship",
    agentInvestigates: "Agent investigates this address",

    secondHop: "Second Hop",
    connectedAddresses: "Connected addresses of the selected first-hop target",
    connectedDesc:
      "These addresses mainly interact with the selected first-hop address and are not necessarily directly related to the original root wallet.",

    connectedAddress: "Connected Address",
    events: "events",
    outgoing: "Outgoing",
    incoming: "Incoming",

    important: "Important",
    importantDesc:
      "Second-hop behavior does not affect the root Risk Score. A relationship between addresses does not prove shared identity, common control, ownership, or malicious intent.",

    aiReport: "AI Investigation Report",
    aiReportDesc:
      "DeepSeek explains deterministic evidence collected and calculated by ChainScope.",
    generatingReport: "Generating investigation report...",

    evidenceExplorer: "Evidence Explorer",
    evidenceExplorerDesc:
      "Raw blockchain records stay collapsed until you need to verify the investigation.",

    anomalySignals: "Anomaly Signals",
    ethTransactions: "ETH Transactions",
    tokenTransfers: "ERC-20 Transfers",
    internalTransactions: "Internal Transactions",

    noSignals: "No major anomaly signals were detected.",
    noReport: "No AI investigation report generated yet.",
    noSecondHop: "No suitable first-hop address was selected for deeper tracing.",

    firstHopSelected:
      "The agent selected this direct counterparty because it produced a stronger interaction and cross-source investigation signal.",

    viewTrace: "View investigation path →",

    ethTx: "ETH Tx",
    internal: "Internal",
    nextHop: "Next-hop",

    rootScoreOnly: "Root address only",
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

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [tokenTransfers, setTokenTransfers] =
    useState<TokenTransfer[]>([]);

  const [
    internalTransactions,
    setInternalTransactions,
  ] = useState<InternalTransaction[]>([]);

  const [counterparties, setCounterparties] =
    useState<Counterparty[]>([]);

  const [secondHop, setSecondHop] =
    useState<SecondHopResult | null>(null);

  const [anomalies, setAnomalies] =
    useState<Anomaly[]>([]);

  const [riskScore, setRiskScore] =
    useState<number | null>(null);

  const [aiReport, setAiReport] =
    useState("");

  const [activeTab, setActiveTab] =
    useState<Tab>("overview");

  function updateLanguage(next: Language) {
    setLanguage(next);

    if (!loading && riskScore === null) {
      setStatus(copy[next].initialStatus);
    }
  }

  async function startInvestigation() {
    if (!ethers.isAddress(address)) {
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
      setRiskScore(null);
      setAiReport("");

      setActiveTab("overview");

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
        await provider.getBalance(address);

      const formattedBalance =
        Number(
          ethers.formatEther(balanceWei)
        ).toFixed(4);

      setBalance(formattedBalance);

      setStatus(
        language === "zh"
          ? "正在收集链上证据..."
          : "Collecting on-chain evidence..."
      );

      const [
        txResponse,
        tokenResponse,
        internalResponse,
      ] = await Promise.all([
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
      ] = await Promise.all([
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

      if (!internalResponse.ok) {
        throw new Error(
          internalData.error ||
            "Failed to retrieve internal transactions"
        );
      }

      const txItems: Transaction[] =
        Array.isArray(txData.items)
          ? txData.items
          : [];

      const tokenItems: TokenTransfer[] =
        Array.isArray(tokenData.items)
          ? tokenData.items
          : [];

      const internalItems: InternalTransaction[] =
        Array.isArray(internalData.items)
          ? internalData.items
          : [];

      setTransactions(txItems);
      setTokenTransfers(tokenItems);
      setInternalTransactions(internalItems);

      setStatus(
        language === "zh"
          ? "正在构建资金关系..."
          : "Building transaction relationships..."
      );

      const firstHopCounterparties =
        buildCounterparties(
          txItems,
          tokenItems,
          internalItems,
          rootAddress
        );

      setCounterparties(firstHopCounterparties);

      setStatus(
        language === "zh"
          ? "正在检测异常行为..."
          : "Detecting anomalous behavior..."
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

      setAnomalies(detected);

      const score =
        calculateRiskScore(detected);

      setRiskScore(score);

      const riskLevel =
        getRiskLevel(score).label;

      let secondHopResult:
        | SecondHopResult
        | null = null;

      const selectedCounterparty =
        chooseSecondHopCounterparty(
          firstHopCounterparties,
          rootAddress
        );

      if (selectedCounterparty) {
        setStatus(
          language === "zh"
            ? "Agent 正在自动追踪最值得关注的直接对手方..."
            : "Agent is tracing the most relevant direct counterparty..."
        );

        try {
          const response = await fetch(
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
            Array.isArray(data.transactions)
              ? data.transactions
              : [];

          const secondTokens: TokenTransfer[] =
            Array.isArray(data.tokenTransfers)
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
                ? `Agent 根据该地址的 ${selectedCounterparty.interactionCount} 次观测交互以及 ${selectedCounterparty.sources.length} 类数据来源信号，自动选择它继续调查。`
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
              Boolean(rootRelationship),

            rootInteractionCount:
              rootRelationship
                ?.interactionCount || 0,
          };

          setSecondHop(secondHopResult);
        } catch (error) {
          console.error(
            "Second-hop investigation:",
            error
          );
        }
      }

      setStatus(
        language === "zh"
          ? "正在生成 AI 调查报告..."
          : "Generating AI investigation report..."
      );

      setAiLoading(true);

      const evidenceTransactions =
        txItems.slice(0, 20).map((tx) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,

          valueEth:
            formatEth(tx.value),

          time:
            formatTime(tx.timeStamp),

          direction:
            tx.from?.toLowerCase() ===
            rootAddress
              ? "OUT"
              : "IN",

          blockNumber:
            tx.blockNumber,
        }));

      const evidenceTokens =
        tokenItems.slice(0, 20).map((tx) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,

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
            formatTime(tx.timeStamp),

          blockNumber:
            tx.blockNumber,
        }));

      const evidenceInternal =
        internalItems.slice(0, 20).map((tx) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,

          direction:
            tx.from?.toLowerCase() ===
            rootAddress
              ? "OUT"
              : "IN",

          valueEth:
            formatEth(tx.value),

          type:
            tx.type || "unknown",

          time:
            formatTime(tx.timeStamp),

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
              item.ethOut.toFixed(4),

            ethIn:
              item.ethIn.toFixed(4),

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
                secondHopResult.investigatedAddress,

              selectedFromAddress:
                address,

              selectionReason:
                secondHopResult.selectionReason,

              transactionCount:
                secondHopResult.transactionCount,

              tokenTransferCount:
                secondHopResult.tokenTransferCount,

              internalTransactionCount:
                secondHopResult.internalTransactionCount,

              totalObservedEvents:
                secondHopResult.transactionCount +
                secondHopResult.tokenTransferCount +
                secondHopResult.internalTransactionCount,

              linksBackToRoot:
                secondHopResult.linksBackToRoot,

              rootInteractionCount:
                secondHopResult.rootInteractionCount,

              topCounterparties:
                secondHopResult.counterparties
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
                      item.ethOut.toFixed(4),

                    ethIn:
                      item.ethIn.toFixed(4),

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
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                address,

                balance:
                  formattedBalance,

                riskScore:
                  score,

                riskLevel,

                language,

                anomalies:
                  detected,

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
          aiData.report || ""
        );
      } catch (error) {
        console.error(error);

        setAiReport(
          language === "zh"
            ? `
## AI 调查报告生成失败

确定性链上分析已经完成，但 AI 报告暂时无法生成。

你仍然可以查看总览、Agent 追踪和原始证据。
`
            : `
## AI Report Generation Failed

The deterministic on-chain investigation completed successfully, but the AI report could not be generated.

You can still review the overview, agent trace and raw evidence.
`
        );
      } finally {
        setAiLoading(false);
      }

      setStatus(
        language === "zh"
          ? secondHopResult
            ? "调查完成 · Agent 二跳追踪已完成"
            : "调查完成"
          : secondHopResult
          ? "Investigation complete · Second-hop trace completed"
          : "Investigation complete"
      );
    } catch (error) {
      console.error(error);

      setStatus(
        error instanceof Error
          ? error.message
          : language === "zh"
          ? "调查失败。"
          : "Investigation failed."
      );
    } finally {
      setLoading(false);
    }
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
            item.outgoingCount * 1.5 +
            item.sources.length * 3 +
            Math.min(
              Math.log10(
                item.ethOut + 1
              ) * 2,
              8
            );

          return {
            item,
            score,
          };
        })
        .sort(
          (a, b) =>
            b.score - a.score
        );

    return candidates[0]?.item || null;
  }

  function buildCounterparties(
    txs: Transaction[],
    tokens: TokenTransfer[],
    internals: InternalTransaction[],
    target: string
  ): Counterparty[] {
    type MutableCounterparty =
      Counterparty & {
        sourceSet: Set<string>;
        tokenSet: Set<string>;
      };

    const map = new Map<
      string,
      MutableCounterparty
    >();

    function getItem(
      counterpartyAddress: string
    ) {
      const key =
        counterpartyAddress.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          address:
            counterpartyAddress,

          interactionCount: 0,

          outgoingCount: 0,
          incomingCount: 0,

          ethOut: 0,
          ethIn: 0,

          tokenEventCount: 0,
          internalEventCount: 0,

          sources: [],
          tokenSymbols: [],

          lastTimestamp: 0,

          sourceSet:
            new Set<string>(),

          tokenSet:
            new Set<string>(),
        });
      }

      return map.get(key)!;
    }

    for (const tx of txs) {
      const from =
        tx.from?.toLowerCase();

      const to =
        tx.to?.toLowerCase();

      const outgoing =
        from === target;

      const incoming =
        to === target;

      if (!outgoing && !incoming) {
        continue;
      }

      const counterparty =
        outgoing
          ? tx.to
          : tx.from;

      if (!counterparty) {
        continue;
      }

      const item =
        getItem(counterparty);

      item.interactionCount++;

      item.sourceSet.add("ETH");

      item.lastTimestamp =
        Math.max(
          item.lastTimestamp,
          Number(tx.timeStamp)
        );

      const amount =
        Number(
          formatEth(tx.value)
        );

      if (outgoing) {
        item.outgoingCount++;
        item.ethOut += amount;
      } else {
        item.incomingCount++;
        item.ethIn += amount;
      }
    }

    for (const tx of tokens) {
      const from =
        tx.from?.toLowerCase();

      const to =
        tx.to?.toLowerCase();

      const outgoing =
        from === target;

      const incoming =
        to === target;

      if (!outgoing && !incoming) {
        continue;
      }

      const counterparty =
        outgoing
          ? tx.to
          : tx.from;

      if (!counterparty) {
        continue;
      }

      const item =
        getItem(counterparty);

      item.interactionCount++;
      item.tokenEventCount++;

      item.sourceSet.add("ERC-20");

      if (tx.tokenSymbol) {
        item.tokenSet.add(
          tx.tokenSymbol
        );
      }

      item.lastTimestamp =
        Math.max(
          item.lastTimestamp,
          Number(tx.timeStamp)
        );

      if (outgoing) {
        item.outgoingCount++;
      } else {
        item.incomingCount++;
      }
    }

    for (const tx of internals) {
      const from =
        tx.from?.toLowerCase();

      const to =
        tx.to?.toLowerCase();

      const outgoing =
        from === target;

      const incoming =
        to === target;

      if (!outgoing && !incoming) {
        continue;
      }

      const counterparty =
        outgoing
          ? tx.to
          : tx.from;

      if (!counterparty) {
        continue;
      }

      const item =
        getItem(counterparty);

      item.interactionCount++;
      item.internalEventCount++;

      item.sourceSet.add("Internal");

      item.lastTimestamp =
        Math.max(
          item.lastTimestamp,
          Number(tx.timeStamp)
        );

      const amount =
        Number(
          formatEth(tx.value)
        );

      if (outgoing) {
        item.outgoingCount++;
        item.ethOut += amount;
      } else {
        item.incomingCount++;
        item.ethIn += amount;
      }
    }

    return Array.from(
      map.values()
    )
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
          ).slice(0, 8),

        lastTimestamp:
          item.lastTimestamp,
      }))
      .sort(
        (a, b) =>
          b.interactionCount -
          a.interactionCount
      );
  }

  function detectCounterpartyAnomalies(
    items: Counterparty[]
  ): Anomaly[] {
    const results: Anomaly[] = [];

    if (!items.length) {
      return results;
    }

    const outgoingTotal =
      items.reduce(
        (sum, item) =>
          sum +
          item.outgoingCount,
        0
      );

    if (outgoingTotal >= 5) {
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
        top.outgoingCount >= 4 &&
        ratio >= 0.7
      ) {
        results.push({
          type:
            language === "zh"
              ? "对手方高度集中"
              : "Counterparty Concentration",

          severity:
            ratio >= 0.85
              ? "HIGH"
              : "MEDIUM",

          description:
            language === "zh"
              ? `${(
                  ratio * 100
                ).toFixed(
                  1
                )}% 的样本转出交互集中于同一个对手方。`
              : `${(
                  ratio * 100
                ).toFixed(
                  1
                )}% of sampled outgoing interactions involve one counterparty.`,

          score:
            ratio >= 0.85
              ? 12
              : 7,
        });
      }
    }

    const multisource =
      items.find(
        (item) =>
          item.sources.length >= 3 &&
          item.interactionCount >= 5
      );

    if (multisource) {
      results.push({
        type:
          language === "zh"
            ? "多来源重复对手方"
            : "Multi-source Counterparty",

        severity: "MEDIUM",

        description:
          language === "zh"
            ? `${shorten(
                multisource.address
              )} 同时出现在 ETH、ERC-20 与 Internal 活动中。`
            : `${shorten(
                multisource.address
              )} appears across ETH, ERC-20 and Internal activity.`,

        score: 6,
      });
    }

    return results;
  }

  function detectEthAnomalies(
    txs: Transaction[],
    targetAddress: string
  ): Anomaly[] {
    const results: Anomaly[] = [];

    if (!txs.length) {
      return results;
    }

    const target =
      targetAddress.toLowerCase();

    const parsed =
      txs
        .map((tx) => {
          let ethValue = 0;

          try {
            ethValue =
              Number(
                ethers.formatEther(
                  tx.value || "0"
                )
              );
          } catch {}

          return {
            ...tx,

            ethValue,

            timestamp:
              Number(tx.timeStamp),

            isOutgoing:
              tx.from?.toLowerCase() ===
              target,

            isIncoming:
              tx.to?.toLowerCase() ===
              target,
          };
        })
        .sort(
          (a, b) =>
            a.timestamp -
            b.timestamp
        );

    const outgoing =
      parsed.filter(
        (tx) =>
          tx.isOutgoing &&
          tx.ethValue > 0
      );

    const incoming =
      parsed.filter(
        (tx) =>
          tx.isIncoming &&
          tx.ethValue > 0
      );

    const avgOutgoing =
      outgoing.length
        ? outgoing.reduce(
            (sum, tx) =>
              sum +
              tx.ethValue,
            0
          ) /
          outgoing.length
        : 0;

    const large =
      outgoing.filter(
        (tx) =>
          avgOutgoing > 0 &&
          tx.ethValue >=
            avgOutgoing * 3 &&
          tx.ethValue >= 0.1
      );

    if (large.length) {
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
        avgOutgoing * 8;

      results.push({
        type:
          language === "zh"
            ? "ETH 大额转出"
            : "Large ETH Transfer",

        severity:
          high
            ? "HIGH"
            : "MEDIUM",

        description:
          language === "zh"
            ? `${biggest.ethValue.toFixed(
                4
              )} ETH 的转账显著高于近期平均转出 ${avgOutgoing.toFixed(
                4
              )} ETH。`
            : `${biggest.ethValue.toFixed(
                4
              )} ETH was significantly larger than the recent outgoing average of ${avgOutgoing.toFixed(
                4
              )} ETH.`,

        score:
          high ? 18 : 10,

        evidenceHash:
          biggest.hash,
      });
    }

    let max10m = 0;
    let frequencyHash = "";

    for (
      let i = 0;
      i < parsed.length;
      i++
    ) {
      let count = 0;

      for (
        let j = i;
        j < parsed.length;
        j++
      ) {
        if (
          parsed[j].timestamp -
            parsed[i].timestamp <=
          600
        ) {
          count++;
        } else {
          break;
        }
      }

      if (count > max10m) {
        max10m = count;
        frequencyHash =
          parsed[i].hash;
      }
    }

    if (max10m >= 8) {
      results.push({
        type:
          language === "zh"
            ? "ETH 交易频率突增"
            : "ETH Transaction Frequency Spike",

        severity:
          max10m >= 15
            ? "HIGH"
            : "MEDIUM",

        description:
          language === "zh"
            ? `10 分钟内观察到 ${max10m} 次普通 Ethereum 交易。`
            : `${max10m} normal Ethereum transactions occurred within a 10-minute window.`,

        score:
          max10m >= 15
            ? 14
            : 8,

        evidenceHash:
          frequencyHash,
      });
    }

    for (const received of incoming) {
      let outgoingSoon = 0;
      let evidenceHash = "";

      for (const sent of outgoing) {
        const delay =
          sent.timestamp -
          received.timestamp;

        if (
          delay >= 0 &&
          delay <= 1800
        ) {
          outgoingSoon +=
            sent.ethValue;

          if (!evidenceHash) {
            evidenceHash =
              sent.hash;
          }
        }
      }

      if (
        received.ethValue >= 0.1 &&
        outgoingSoon >=
          received.ethValue * 0.7
      ) {
        results.push({
          type:
            language === "zh"
              ? "ETH 快速流出"
              : "Rapid ETH Outflow",

          severity: "HIGH",

          description:
            language === "zh"
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

          score: 18,

          evidenceHash,
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
    const results: Anomaly[] = [];

    if (!transfers.length) {
      return results;
    }

    const target =
      targetAddress.toLowerCase();

    const parsed =
      transfers
        .map((tx) => ({
          ...tx,

          amount:
            Number(
              formatTokenAmount(
                tx.value,
                tx.tokenDecimal
              )
            ),

          timestamp:
            Number(tx.timeStamp),

          isOutgoing:
            tx.from?.toLowerCase() ===
            target,
        }))
        .sort(
          (a, b) =>
            a.timestamp -
            b.timestamp
        );

    const outgoing =
      parsed.filter(
        (tx) =>
          tx.isOutgoing &&
          tx.amount > 0
      );

    const byToken =
      new Map<
        string,
        typeof outgoing
      >();

    for (const tx of outgoing) {
      const key =
        tx.contractAddress
          ?.toLowerCase() ||
        tx.tokenSymbol;

      const group =
        byToken.get(key) || [];

      group.push(tx);

      byToken.set(
        key,
        group
      );
    }

    for (
      const [, group]
      of byToken
    ) {
      if (group.length < 3) {
        continue;
      }

      const average =
        group.reduce(
          (sum, tx) =>
            sum + tx.amount,
          0
        ) /
        group.length;

      const biggest =
        group.reduce(
          (a, b) =>
            a.amount >
            b.amount
              ? a
              : b
        );

      if (
        average > 0 &&
        biggest.amount >=
          average * 3
      ) {
        const high =
          biggest.amount >=
          average * 8;

        results.push({
          type:
            language === "zh"
              ? "ERC-20 大额转账"
              : "Large ERC-20 Transfer",

          severity:
            high
              ? "HIGH"
              : "MEDIUM",

          description:
            language === "zh"
              ? `${biggest.amount.toLocaleString()} ${
                  biggest.tokenSymbol
                } 显著高于该 Token 近期样本平均转账金额。`
              : `${biggest.amount.toLocaleString()} ${
                  biggest.tokenSymbol
                } was significantly larger than the recent sample average for this token.`,

          score:
            high ? 16 : 9,

          evidenceHash:
            biggest.hash,
        });

        break;
      }
    }

    let max10m = 0;
    let evidenceHash = "";

    for (
      let i = 0;
      i < parsed.length;
      i++
    ) {
      let count = 0;

      for (
        let j = i;
        j < parsed.length;
        j++
      ) {
        if (
          parsed[j].timestamp -
            parsed[i].timestamp <=
          600
        ) {
          count++;
        } else {
          break;
        }
      }

      if (count > max10m) {
        max10m = count;
        evidenceHash =
          parsed[i].hash;
      }
    }

    if (max10m >= 8) {
      results.push({
        type:
          language === "zh"
            ? "ERC-20 活动突增"
            : "ERC-20 Activity Spike",

        severity:
          max10m >= 15
            ? "HIGH"
            : "MEDIUM",

        description:
          language === "zh"
            ? `10 分钟内观察到 ${max10m} 次 ERC-20 转账事件。`
            : `${max10m} ERC-20 transfer events occurred within a 10-minute window.`,

        score:
          max10m >= 15
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
    const results: Anomaly[] = [];

    if (!items.length) {
      return results;
    }

    const target =
      targetAddress.toLowerCase();

    const parsed =
      items
        .map((tx) => ({
          ...tx,

          ethValue:
            Number(
              formatEth(tx.value)
            ),

          timestamp:
            Number(tx.timeStamp),

          isOutgoing:
            tx.from?.toLowerCase() ===
            target,

          isIncoming:
            tx.to?.toLowerCase() ===
            target,
        }))
        .sort(
          (a, b) =>
            a.timestamp -
            b.timestamp
        );

    const outgoing =
      parsed.filter(
        (tx) =>
          tx.isOutgoing &&
          tx.ethValue > 0
      );

    const incoming =
      parsed.filter(
        (tx) =>
          tx.isIncoming &&
          tx.ethValue > 0
      );

    const average =
      outgoing.length
        ? outgoing.reduce(
            (sum, tx) =>
              sum +
              tx.ethValue,
            0
          ) /
          outgoing.length
        : 0;

    if (
      outgoing.length >= 3 &&
      average > 0
    ) {
      const biggest =
        outgoing.reduce(
          (a, b) =>
            a.ethValue >
            b.ethValue
              ? a
              : b
        );

      if (
        biggest.ethValue >=
        average * 3
      ) {
        const high =
          biggest.ethValue >=
          average * 8;

        results.push({
          type:
            language === "zh"
              ? "Internal 大额 ETH 转账"
              : "Large Internal ETH Transfer",

          severity:
            high
              ? "HIGH"
              : "MEDIUM",

          description:
            language === "zh"
              ? `一笔 ${biggest.ethValue.toFixed(
                  4
                )} ETH 的内部转账显著高于近期内部转出平均水平。`
              : `An internal transfer of ${biggest.ethValue.toFixed(
                  4
                )} ETH was significantly larger than the recent internal average.`,

          score:
            high ? 16 : 9,

          evidenceHash:
            biggest.hash,
        });
      }
    }

    let max10m = 0;
    let evidenceHash = "";

    for (
      let i = 0;
      i < parsed.length;
      i++
    ) {
      let count = 0;

      for (
        let j = i;
        j < parsed.length;
        j++
      ) {
        if (
          parsed[j].timestamp -
            parsed[i].timestamp <=
          600
        ) {
          count++;
        } else {
          break;
        }
      }

      if (count > max10m) {
        max10m = count;

        evidenceHash =
          parsed[i].hash;
      }
    }

    if (max10m >= 8) {
      results.push({
        type:
          language === "zh"
            ? "Internal 活动突增"
            : "Internal Transaction Activity Spike",

        severity:
          max10m >= 15
            ? "HIGH"
            : "MEDIUM",

        description:
          language === "zh"
            ? `10 分钟内观察到 ${max10m} 次 Internal Transaction 事件。`
            : `${max10m} internal transaction events occurred within a 10-minute window.`,

        score:
          max10m >= 15
            ? 14
            : 8,

        evidenceHash,
      });
    }

    for (const received of incoming) {
      let sentSoon = 0;
      let evidenceHash = "";

      for (const sent of outgoing) {
        const delay =
          sent.timestamp -
          received.timestamp;

        if (
          delay >= 0 &&
          delay <= 1800
        ) {
          sentSoon +=
            sent.ethValue;

          if (!evidenceHash) {
            evidenceHash =
              sent.hash;
          }
        }
      }

      if (
        received.ethValue >= 0.1 &&
        sentSoon >=
          received.ethValue * 0.7
      ) {
        results.push({
          type:
            language === "zh"
              ? "Internal 资金快速流出"
              : "Rapid Internal Fund Outflow",

          severity: "HIGH",

          description:
            language === "zh"
              ? `内部收到 ${received.ethValue.toFixed(
                  4
                )} ETH 后，30 分钟内约有 ${sentSoon.toFixed(
                  4
                )} ETH 再次流出。`
              : `After receiving ${received.ethValue.toFixed(
                  4
                )} ETH internally, approximately ${sentSoon.toFixed(
                  4
                )} ETH was transferred out within 30 minutes.`,

          score: 18,

          evidenceHash,
        });

        break;
      }
    }

    return results;
  }

  function calculateRiskScore(
    items: Anomaly[]
  ) {
    return Math.min(
      items.reduce(
        (sum, item) =>
          sum + item.score,
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
          value || "0",
          Number(
            decimals || "18"
          )
        )
      ).toFixed(4);
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
          value || "0"
        )
      ).toFixed(4);
    } catch {
      return "0.0000";
    }
  }

  function formatTime(
    timestamp: string
  ) {
    return new Date(
      Number(timestamp) * 1000
    ).toLocaleString(
      language === "zh"
        ? "zh-CN"
        : "en-US"
    );
  }

  function shorten(
    value: string
  ) {
    if (!value) {
      return "N/A";
    }

    if (value.length <= 16) {
      return value;
    }

    return `${value.slice(
      0,
      8
    )}...${value.slice(-6)}`;
  }

  function getRiskLevel(
    score: number | null
  ) {
    if (score === null) {
      return {
        label:
          language === "zh"
            ? "等待"
            : "WAITING",

        className:
          "text-slate-400",

        bg:
          "bg-slate-500/10",

        border:
          "border-slate-700",
      };
    }

    if (score >= 80) {
      return {
        label:
          language === "zh"
            ? "严重"
            : "CRITICAL",

        className:
          "text-red-400",

        bg:
          "bg-red-500/10",

        border:
          "border-red-500/30",
      };
    }

    if (score >= 60) {
      return {
        label:
          language === "zh"
            ? "高风险"
            : "HIGH",

        className:
          "text-orange-400",

        bg:
          "bg-orange-500/10",

        border:
          "border-orange-500/30",
      };
    }

    if (score >= 30) {
      return {
        label:
          language === "zh"
            ? "中风险"
            : "MEDIUM",

        className:
          "text-yellow-400",

        bg:
          "bg-yellow-500/10",

        border:
          "border-yellow-500/30",
      };
    }

    return {
      label:
        language === "zh"
          ? "低风险"
          : "LOW",

      className:
        "text-emerald-400",

      bg:
        "bg-emerald-500/10",

      border:
        "border-emerald-500/30",
    };
  }

  const risk =
    useMemo(
      () =>
        getRiskLevel(
          riskScore
        ),
      [riskScore, language]
    );

  const totalEvents =
    transactions.length +
    tokenTransfers.length +
    internalTransactions.length;

  const hasResults =
    riskScore !== null;

  const selectedFirstHop =
    secondHop
      ? counterparties.find(
          (item) =>
            item.address.toLowerCase() ===
            secondHop.investigatedAddress.toLowerCase()
        )
      : null;

  return (
    <main className="min-h-screen bg-[#08111d] text-white">

      <div className="pointer-events-none fixed inset-0 overflow-hidden">

        <div className="absolute left-1/2 top-[-220px] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-cyan-500/[0.07] blur-[120px]" />

        <div className="absolute bottom-[-250px] right-[-150px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.05] blur-[120px]" />

      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-7 md:px-8">

        <header className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-lg font-bold text-cyan-300">
              C
            </div>

            <div>

              <div className="font-semibold tracking-tight">
                ChainScope AI
              </div>

              <div className="mt-0.5 text-xs text-slate-500">
                {t.subtitle}
              </div>

            </div>

          </div>

          <div className="flex items-center gap-3">

            <div className="hidden rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 sm:block">
              {t.network}
            </div>

            <LanguageSwitch
              language={language}
              onChange={updateLanguage}
            />

          </div>

        </header>

        <section className="pb-12 pt-20 text-center md:pb-16 md:pt-28">

          <div className="text-xs font-medium uppercase tracking-[0.28em] text-cyan-400">
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

          <div className="mx-auto mt-9 flex max-w-3xl flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-2 shadow-2xl shadow-black/20 backdrop-blur md:flex-row">

            <input
              value={address}
              onChange={(e) =>
                setAddress(
                  e.target.value
                )
              }
              placeholder={t.placeholder}
              className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-4 font-mono text-sm text-slate-200 outline-none placeholder:text-slate-600"
            />

            <button
              onClick={
                startInvestigation
              }
              disabled={
                loading
              }
              className="rounded-xl bg-white px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? t.investigating
                : t.start}
            </button>

          </div>

          <div className="mx-auto mt-4 flex max-w-3xl items-center justify-center gap-2 text-xs text-slate-500">

            <div
              className={`h-1.5 w-1.5 rounded-full ${
                loading
                  ? "animate-pulse bg-cyan-400"
                  : hasResults
                  ? "bg-emerald-400"
                  : "bg-slate-600"
              }`}
            />

            {status}

          </div>

        </section>

        {hasResults && (
          <>

            <section className="grid gap-3 md:grid-cols-4">

              <div
                className={`rounded-2xl border p-5 ${risk.border} ${risk.bg}`}
              >

                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {t.rootRisk}
                </div>

                <div className="mt-4 flex items-end gap-3">

                  <div className="text-4xl font-semibold tracking-tight">
                    {riskScore}
                  </div>

                  <div
                    className={`pb-1 text-xs font-semibold ${risk.className}`}
                  >
                    {risk.label}
                  </div>

                </div>

                <div className="mt-3 text-xs text-slate-500">
                  {t.rootRiskDesc}
                </div>

              </div>

              <SummaryCard
                label={t.observedEvents}
                value={String(
                  totalEvents
                )}
                description={`${transactions.length} ETH · ${tokenTransfers.length} ERC-20 · ${internalTransactions.length} Internal`}
              />

              <SummaryCard
                label={t.signals}
                value={String(
                  anomalies.length
                )}
                description={
                  t.signalDesc
                }
              />

              <SummaryCard
                label={t.agentTrace}
                value={
                  secondHop
                    ? t.hopDone
                    : t.noHop
                }
                description={
                  secondHop
                    ? t.hopDoneDesc
                    : t.noHopDesc
                }
              />

            </section>

            <section className="mt-7">

              <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5">

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

            {activeTab === "overview" && (
              <section className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">

                <Panel>

                  <SectionHeader
                    title={t.keySignals}
                    subtitle={
                      t.keySignalsDesc
                    }
                  />

                  <div className="mt-5 space-y-2.5">

                    {anomalies.length === 0 ? (
                      <EmptyState>
                        {t.noSignals}
                      </EmptyState>
                    ) : (
                      anomalies
                        .slice(0, 5)
                        .map(
                          (
                            anomaly,
                            index
                          ) => (
                            <AnomalyCard
                              key={`${anomaly.type}-${index}`}
                              anomaly={
                                anomaly
                              }
                            />
                          )
                        )
                    )}

                  </div>

                </Panel>

                <Panel>

                  <SectionHeader
                    title={
                      t.directCounterparties
                    }
                    subtitle={
                      t.directCounterpartiesDesc
                    }
                  />

                  <div className="mt-5 space-y-2.5">

                    {counterparties
                      .slice(0, 4)
                      .map(
                        (
                          item,
                          index
                        ) => (
                          <CompactCounterparty
                            key={
                              item.address
                            }
                            item={
                              item
                            }
                            rank={
                              index + 1
                            }
                            language={
                              language
                            }
                          />
                        )
                      )}

                  </div>

                  <button
                    onClick={() =>
                      setActiveTab(
                        "trace"
                      )
                    }
                    className="mt-5 text-sm text-cyan-400 transition hover:text-cyan-300"
                  >
                    {t.viewTrace}
                  </button>

                </Panel>

              </section>
            )}

            {activeTab === "trace" && (
              <section className="mt-5">

                <Panel>

                  <SectionHeader
                    title={
                      t.investigationPath
                    }
                    subtitle={
                      t.investigationPathDesc
                    }
                  />

                  <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">

                    <div className="text-sm font-medium text-slate-200">
                      {t.howToRead}
                    </div>

                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                      {t.howToReadDesc}
                    </p>

                  </div>

                  {!secondHop ? (
                    <div className="mt-6">

                      <EmptyState>
                        {t.noSecondHop}
                      </EmptyState>

                    </div>
                  ) : (
                    <div className="mt-8">

                      <div className="flex flex-col items-center">

                        <TraceNode
                          badge={
                            t.rootWallet
                          }
                          title={
                            t.investigatedAddress
                          }
                          address={
                            address
                          }
                          description={
                            t.rootDesc
                          }
                          tone="root"
                        />

                        <TraceArrow
                          label={
                            t.directRelationship
                          }
                        />

                        <TraceNode
                          badge={
                            t.firstHop
                          }
                          title={
                            t.selectedCounterparty
                          }
                          address={
                            secondHop.investigatedAddress
                          }
                          description={
                            t.selectedDesc
                          }
                          tone="selected"
                          extra={
                            selectedFirstHop
                              ? `${selectedFirstHop.interactionCount} ${
                                  language ===
                                  "zh"
                                    ? "次交互"
                                    : "events"
                                } · ${selectedFirstHop.sources.join(
                                  " / "
                                )}`
                              : undefined
                          }
                        />

                        <TraceArrow
                          label={
                            t.agentInvestigates
                          }
                        />

                        <div className="w-full">

                          <div className="text-center">

                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-300">
                              {t.secondHop}
                            </div>

                            <h4 className="mt-2 text-lg font-medium">
                              {t.connectedAddresses}
                            </h4>

                            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                              {t.connectedDesc}
                            </p>

                          </div>

                          <div className="mx-auto mt-6 h-8 w-px bg-white/[0.12]" />

                          <div className="grid gap-3 md:grid-cols-3">

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
                                  <SecondHopNode
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
                                    labels={
                                      t
                                    }
                                  />
                                )
                              )}

                          </div>

                        </div>

                      </div>

                      <div className="mt-6 grid gap-3 sm:grid-cols-4">

                        <MiniMetric
                          label={
                            t.ethTx
                          }
                          value={String(
                            secondHop.transactionCount
                          )}
                        />

                        <MiniMetric
                          label="ERC-20"
                          value={String(
                            secondHop.tokenTransferCount
                          )}
                        />

                        <MiniMetric
                          label={
                            t.internal
                          }
                          value={String(
                            secondHop.internalTransactionCount
                          )}
                        />

                        <MiniMetric
                          label={
                            t.nextHop
                          }
                          value={String(
                            secondHop.counterparties.length
                          )}
                        />

                      </div>

                      <div className="mt-5 rounded-xl border border-amber-500/15 bg-amber-500/[0.035] p-4">

                        <div className="text-sm font-medium text-amber-300">
                          {t.important}
                        </div>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {t.importantDesc}
                        </p>

                      </div>

                    </div>
                  )}

                </Panel>

              </section>
            )}

            {activeTab === "report" && (
              <section className="mt-5">

                <Panel>

                  <SectionHeader
                    title={
                      t.aiReport
                    }
                    subtitle={
                      t.aiReportDesc
                    }
                  />

                  <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/[0.12] p-5 md:p-7">

                    {aiLoading ? (
                      <div className="flex items-center gap-3 py-12 text-sm text-cyan-400">

                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />

                        {t.generatingReport}

                      </div>
                    ) : aiReport ? (
                      <article>

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
                              <h3 className="mb-3 mt-7 text-base font-semibold text-cyan-300">
                                {children}
                              </h3>
                            ),

                            p: ({
                              children,
                            }) => (
                              <p className="my-4 max-w-4xl text-sm leading-7 text-slate-300">
                                {children}
                              </p>
                            ),

                            strong: ({
                              children,
                            }) => (
                              <strong className="font-semibold text-white">
                                {children}
                              </strong>
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

                            li: ({
                              children,
                            }) => (
                              <li className="leading-7">
                                {children}
                              </li>
                            ),

                            blockquote: ({
                              children,
                            }) => (
                              <blockquote className="my-6 border-l-2 border-cyan-400/70 bg-cyan-400/[0.04] px-4 py-2 text-slate-400">
                                {children}
                              </blockquote>
                            ),

                            table: ({
                              children,
                            }) => (
                              <div className="my-6 overflow-x-auto">

                                <table className="w-full border-collapse text-sm">
                                  {children}
                                </table>

                              </div>
                            ),

                            th: ({
                              children,
                            }) => (
                              <th className="border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-left font-medium">
                                {children}
                              </th>
                            ),

                            td: ({
                              children,
                            }) => (
                              <td className="border border-white/[0.06] px-4 py-3 align-top text-slate-400">
                                {children}
                              </td>
                            ),
                          }}
                        >
                          {aiReport}
                        </ReactMarkdown>

                      </article>
                    ) : (
                      <EmptyState>
                        {t.noReport}
                      </EmptyState>
                    )}

                  </div>

                </Panel>

              </section>
            )}

            {activeTab === "evidence" && (
              <section className="mt-5">

                <Panel>

                  <SectionHeader
                    title={
                      t.evidenceExplorer
                    }
                    subtitle={
                      t.evidenceExplorerDesc
                    }
                  />

                  <div className="mt-6 space-y-2">

                    <EvidenceAccordion
                      title={
                        t.anomalySignals
                      }
                      count={
                        anomalies.length
                      }
                    >

                      <div className="space-y-2">

                        {anomalies.map(
                          (
                            anomaly,
                            index
                          ) => (
                            <AnomalyCard
                              key={`${anomaly.type}-${index}`}
                              anomaly={
                                anomaly
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
                    >

                      <EvidenceList>

                        {transactions
                          .slice(0, 30)
                          .map((tx) => (
                            <TransactionRow
                              key={
                                tx.hash
                              }
                              direction={
                                tx.from?.toLowerCase() ===
                                address.toLowerCase()
                                  ? "OUT"
                                  : "IN"
                              }
                              title={`${formatEth(
                                tx.value
                              )} ETH`}
                              subtitle={`Block ${tx.blockNumber}`}
                              hash={
                                tx.hash
                              }
                              from={
                                tx.from
                              }
                              to={
                                tx.to
                              }
                              time={formatTime(
                                tx.timeStamp
                              )}
                            />
                          ))}

                      </EvidenceList>

                    </EvidenceAccordion>

                    <EvidenceAccordion
                      title={
                        t.tokenTransfers
                      }
                      count={
                        tokenTransfers.length
                      }
                    >

                      <EvidenceList>

                        {tokenTransfers
                          .slice(0, 30)
                          .map(
                            (
                              tx,
                              index
                            ) => (
                              <TransactionRow
                                key={`${tx.hash}-${index}`}
                                direction={
                                  tx.from?.toLowerCase() ===
                                  address.toLowerCase()
                                    ? "OUT"
                                    : "IN"
                                }
                                title={`${formatTokenAmount(
                                  tx.value,
                                  tx.tokenDecimal
                                )} ${
                                  tx.tokenSymbol ||
                                  "TOKEN"
                                }`}
                                subtitle={
                                  tx.tokenName ||
                                  "Unknown Token"
                                }
                                hash={
                                  tx.hash
                                }
                                from={
                                  tx.from
                                }
                                to={
                                  tx.to
                                }
                                time={formatTime(
                                  tx.timeStamp
                                )}
                              />
                            )
                          )}

                      </EvidenceList>

                    </EvidenceAccordion>

                    <EvidenceAccordion
                      title={
                        t.internalTransactions
                      }
                      count={
                        internalTransactions.length
                      }
                    >

                      <EvidenceList>

                        {internalTransactions
                          .slice(0, 30)
                          .map(
                            (
                              tx,
                              index
                            ) => (
                              <TransactionRow
                                key={`${tx.hash}-${index}`}
                                direction={
                                  tx.from?.toLowerCase() ===
                                  address.toLowerCase()
                                    ? "OUT"
                                    : "IN"
                                }
                                title={`${formatEth(
                                  tx.value
                                )} ETH`}
                                subtitle={`Internal · ${
                                  tx.type ||
                                  "unknown"
                                }`}
                                hash={
                                  tx.hash
                                }
                                from={
                                  tx.from
                                }
                                to={
                                  tx.to
                                }
                                time={formatTime(
                                  tx.timeStamp
                                )}
                              />
                            )
                          )}

                      </EvidenceList>

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
  language: Language;
  onChange: (
    language: Language
  ) => void;
}) {
  return (
    <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">

      <button
        onClick={() =>
          onChange("zh")
        }
        className={`rounded-md px-3 py-1.5 text-xs transition ${
          language === "zh"
            ? "bg-white text-slate-950"
            : "text-slate-500 hover:text-white"
        }`}
      >
        中文
      </button>

      <button
        onClick={() =>
          onChange("en")
        }
        className={`rounded-md px-3 py-1.5 text-xs transition ${
          language === "en"
            ? "bg-white text-slate-950"
            : "text-slate-500 hover:text-white"
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
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.065] bg-white/[0.028] p-5 backdrop-blur-sm md:p-6">
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>

      <h3 className="text-lg font-medium tracking-tight">
        {title}
      </h3>

      <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
        {subtitle}
      </p>

    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.065] bg-white/[0.028] p-5">

      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>

      <div className="mt-4 text-2xl font-semibold tracking-tight">
        {value}
      </div>

      <div className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </div>

    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">

      <div className="text-xs text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-xl font-medium">
        {value}
      </div>

    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={
        onClick
      }
      className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm transition ${
        active
          ? "bg-white text-slate-950"
          : "text-slate-500 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function AnomalyCard({
  anomaly,
}: {
  anomaly: Anomaly;
}) {
  const accent =
    anomaly.severity === "HIGH"
      ? "bg-red-400"
      : anomaly.severity === "MEDIUM"
      ? "bg-amber-400"
      : "bg-emerald-400";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/[0.1] p-4">

      <div className="flex items-start justify-between gap-4">

        <div className="flex gap-3">

          <div
            className={`mt-1.5 h-2 w-2 rounded-full ${accent}`}
          />

          <div>

            <div className="text-sm font-medium text-slate-200">
              {anomaly.type}
            </div>

            <p className="mt-1.5 text-sm leading-6 text-slate-500">
              {anomaly.description}
            </p>

          </div>

        </div>

        <div className="text-xs text-slate-500">
          +{anomaly.score}
        </div>

      </div>

    </div>
  );
}

function CompactCounterparty({
  item,
  rank,
  language,
}: {
  item: Counterparty;
  rank: number;
  language: Language;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-black/[0.1] p-4">

      <div className="min-w-0">

        <div className="text-[11px] text-slate-600">
          {language === "zh"
            ? `直接关系 #${rank}`
            : `Direct #${rank}`}
        </div>

        <div className="mt-1 truncate font-mono text-sm text-slate-200">
          {shortenGlobal(
            item.address
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">

          {item.sources.map(
            (source) => (
              <span
                key={source}
                className="rounded-md bg-white/[0.04] px-2 py-1 text-[10px] text-slate-500"
              >
                {source}
              </span>
            )
          )}

        </div>

      </div>

      <div className="shrink-0 text-right">

        <div className="text-lg font-medium">
          {item.interactionCount}
        </div>

        <div className="text-[11px] text-slate-600">
          {language === "zh"
            ? "次事件"
            : "events"}
        </div>

      </div>

    </div>
  );
}

function TraceNode({
  badge,
  title,
  address,
  description,
  tone,
  extra,
}: {
  badge: string;
  title: string;
  address: string;
  description: string;
  tone:
    | "root"
    | "selected";
  extra?: string;
}) {
  const border =
    tone === "root"
      ? "border-cyan-400/25"
      : "border-violet-400/25";

  const badgeColor =
    tone === "root"
      ? "text-cyan-300"
      : "text-violet-300";

  return (
    <div
      className={`w-full max-w-xl rounded-2xl border bg-white/[0.025] p-5 text-center ${border}`}
    >

      <div
        className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${badgeColor}`}
      >
        {badge}
      </div>

      <div className="mt-2 text-base font-medium">
        {title}
      </div>

      <div className="mx-auto mt-3 max-w-lg break-all rounded-lg bg-black/[0.15] px-4 py-3 font-mono text-xs text-slate-300">
        {address}
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        {description}
      </p>

      {extra && (
        <div className="mt-3 text-xs text-slate-500">
          {extra}
        </div>
      )}

    </div>
  );
}

function TraceArrow({
  label,
}: {
  label: string;
}) {
  return (
    <div className="flex flex-col items-center py-4">

      <div className="h-7 w-px bg-white/[0.12]" />

      <div className="rounded-full border border-white/[0.08] bg-[#08111d] px-3 py-1 text-[11px] text-slate-500">
        {label}
      </div>

      <div className="h-7 w-px bg-white/[0.12]" />

      <div className="-mt-1 text-xs text-slate-600">
        ▼
      </div>

    </div>
  );
}

function SecondHopNode({
  item,
  index,
  language,
  labels,
}: {
  item: Counterparty;
  index: number;
  language: Language;
  labels: typeof copy.zh;
}) {
  return (
    <div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.025] p-4">

      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0">

          <div className="text-[10px] uppercase tracking-[0.18em] text-violet-300">
            {labels.connectedAddress} #{index}
          </div>

          <div className="mt-2 truncate font-mono text-sm text-slate-200">
            {shortenGlobal(
              item.address
            )}
          </div>

        </div>

        <div className="shrink-0 text-right">

          <div className="text-base font-medium">
            {item.interactionCount}
          </div>

          <div className="text-[10px] text-slate-600">
            {labels.events}
          </div>

        </div>

      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">

        <SmallStat
          label={labels.outgoing}
          value={String(
            item.outgoingCount
          )}
        />

        <SmallStat
          label={labels.incoming}
          value={String(
            item.incomingCount
          )}
        />

      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">

        {item.sources.map(
          (source) => (
            <span
              key={source}
              className="rounded-md bg-white/[0.04] px-2 py-1 text-[10px] text-slate-500"
            >
              {source}
            </span>
          )
        )}

      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-5 text-slate-600">
        {language === "zh"
          ? "这是第一跳地址的关系，不代表与根地址直接关联。"
          : "Connected to the selected first-hop address, not necessarily directly to the root wallet."}
      </div>

    </div>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>

      <div className="text-[11px] text-slate-600">
        {label}
      </div>

      <div className="mt-1 text-sm text-slate-300">
        {value}
      </div>

    </div>
  );
}

function EvidenceAccordion({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-white/[0.06] bg-black/[0.08]">

      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">

        <div className="text-sm font-medium">
          {title}
        </div>

        <div className="flex items-center gap-3">

          <span className="rounded-md bg-white/[0.04] px-2 py-1 text-[11px] text-slate-500">
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

function EvidenceList({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      {children}
    </div>
  );
}

function TransactionRow({
  direction,
  title,
  subtitle,
  hash,
  from,
  to,
  time,
}: {
  direction: "IN" | "OUT";
  title: string;
  subtitle: string;
  hash: string;
  from: string;
  to: string;
  time: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-black/[0.1] p-4">

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

        <div className="flex items-center gap-3">

          <span
            className={`rounded-md px-2 py-1 text-[10px] font-medium ${
              direction === "OUT"
                ? "bg-orange-400/10 text-orange-300"
                : "bg-emerald-400/10 text-emerald-300"
            }`}
          >
            {direction}
          </span>

          <div>

            <div className="text-sm text-slate-200">
              {title}
            </div>

            <div className="mt-0.5 text-[11px] text-slate-600">
              {subtitle}
            </div>

          </div>

        </div>

        <div className="text-[11px] text-slate-600">
          {time}
        </div>

      </div>

      <div className="mt-3 grid gap-2 text-[11px] text-slate-600 md:grid-cols-3">

        <div>
          Tx{" "}
          <span className="font-mono text-slate-400">
            {shortenGlobal(
              hash
            )}
          </span>
        </div>

        <div>
          From{" "}
          <span className="font-mono text-slate-400">
            {shortenGlobal(
              from
            )}
          </span>
        </div>

        <div>
          To{" "}
          <span className="font-mono text-slate-400">
            {shortenGlobal(
              to
            )}
          </span>
        </div>

      </div>

    </div>
  );
}

function EmptyState({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] px-5 py-10 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

function shortenGlobal(
  value: string
) {
  if (!value) {
    return "N/A";
  }

  if (value.length <= 20) {
    return value;
  }

  return `${value.slice(
    0,
    10
  )}...${value.slice(-8)}`;
}