"use client";

import { useMemo, useState } from "react";
import { ethers } from "ethers";

import { Dashboard } from "@/components/chain/Dashboard";
import { copy } from "@/lib/copy";
import {
  analyzeBehaviorChange,
  buildCounterparties,
  calculateRiskScore,
  chooseSecondHopCounterparty,
  detectCounterpartyAnomalies,
  detectEthAnomalies,
  detectInternalAnomalies,
  detectTokenAnomalies,
  getRiskLevel,
} from "@/lib/analysis";
import { formatEth, formatTime, formatTokenAmount } from "@/lib/format";
import type {
  Anomaly,
  ChangeAnalysis,
  Counterparty,
  InternalTransaction,
  Language,
  SecondHopResult,
  Tab,
  TokenTransfer,
  Transaction,
} from "@/lib/types";

export default function Home() {
  const [language, setLanguage] = useState<Language>("zh");
  const t = copy[language];

  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState("--");
  const [status, setStatus] = useState<string>(copy.zh.initialStatus);

  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tokenTransfers, setTokenTransfers] = useState<TokenTransfer[]>([]);
  const [internalTransactions, setInternalTransactions] = useState<InternalTransaction[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [secondHop, setSecondHop] = useState<SecondHopResult | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [changeAnalysis, setChangeAnalysis] = useState<ChangeAnalysis | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [aiReport, setAiReport] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const flaggedHashes = useMemo(() => {
    return new Set(
      anomalies
        .map((item) => item.evidenceHash?.toLowerCase())
        .filter((value): value is string => Boolean(value))
    );
  }, [anomalies]);

  const totalEvents =
    transactions.length + tokenTransfers.length + internalTransactions.length;

  const risk = useMemo(
    () => getRiskLevel(riskScore, language),
    [riskScore, language]
  );

  const hasResults = riskScore !== null;

  function updateLanguage(next: Language) {
    setLanguage(next);
    if (!loading && riskScore === null) {
      setStatus(copy[next].initialStatus);
    }
  }

  function localFormatTime(timestamp: string) {
    return formatTime(timestamp, language);
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

    const rootAddress = address.toLowerCase();

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
      setActiveTab("overview");

      setStatus(language === "zh" ? "正在获取钱包余额..." : "Fetching wallet balance...");

      const provider = new ethers.JsonRpcProvider("https://ethereum-rpc.publicnode.com");
      const balanceWei = await provider.getBalance(address);
      const formattedBalance = Number(ethers.formatEther(balanceWei)).toFixed(4);
      setBalance(formattedBalance);

      setStatus(language === "zh" ? "正在收集 ETH、ERC-20 和 Internal 数据..." : "Collecting ETH, ERC-20 and Internal data...");

      const [txResponse, tokenResponse, internalResponse] = await Promise.all([
        fetch(`/api/transactions?address=${encodeURIComponent(address)}`),
        fetch(`/api/tokentx?address=${encodeURIComponent(address)}`),
        fetch(`/api/internal-transactions?address=${encodeURIComponent(address)}`),
      ]);

      const [txData, tokenData, internalData] = await Promise.all([
        txResponse.json(),
        tokenResponse.json(),
        internalResponse.json(),
      ]);

      if (!txResponse.ok) throw new Error(txData.error || "Failed to retrieve ETH transactions");
      if (!tokenResponse.ok) throw new Error(tokenData.error || "Failed to retrieve token transfers");
      if (!internalResponse.ok) throw new Error(internalData.error || "Failed to retrieve internal transactions");

      const txItems: Transaction[] = Array.isArray(txData.items) ? txData.items : [];
      const tokenItems: TokenTransfer[] = Array.isArray(tokenData.items) ? tokenData.items : [];
      const internalItems: InternalTransaction[] = Array.isArray(internalData.items) ? internalData.items : [];

      setTransactions(txItems);
      setTokenTransfers(tokenItems);
      setInternalTransactions(internalItems);

      setStatus(language === "zh" ? "正在构建对手方关系..." : "Building counterparty relationships...");
      const firstHopCounterparties = buildCounterparties(
        txItems,
        tokenItems,
        internalItems,
        rootAddress
      );
      setCounterparties(firstHopCounterparties);

      setStatus(language === "zh" ? "正在检测行为异常..." : "Detecting behavioral anomalies...");
      const detected = [
        ...detectEthAnomalies(txItems, address, language),
        ...detectTokenAnomalies(tokenItems, language),
        ...detectInternalAnomalies(internalItems, language),
        ...detectCounterpartyAnomalies(firstHopCounterparties, language),
      ];
      setAnomalies(detected);

      const score = calculateRiskScore(detected);
      setRiskScore(score);
      const riskLevel = getRiskLevel(score, language).label;

      setStatus(language === "zh" ? "正在比较近期行为与基准行为..." : "Comparing recent behavior with baseline behavior...");
      const changeResult = analyzeBehaviorChange(
        txItems,
        tokenItems,
        internalItems,
        firstHopCounterparties,
        rootAddress
      );
      setChangeAnalysis(changeResult);

      let secondHopResult: SecondHopResult | null = null;
      const selectedCounterparty = chooseSecondHopCounterparty(
        firstHopCounterparties,
        rootAddress
      );

      if (selectedCounterparty) {
        setStatus(language === "zh" ? "Agent 正在验证主要对手方关系..." : "Agent is validating a major counterparty relationship...");

        try {
          const response = await fetch(
            `/api/second-hop?address=${encodeURIComponent(selectedCounterparty.address)}`
          );
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Second-hop investigation failed");

          const secondTxs: Transaction[] = Array.isArray(data.transactions) ? data.transactions : [];
          const secondTokens: TokenTransfer[] = Array.isArray(data.tokenTransfers) ? data.tokenTransfers : [];
          const secondInternals: InternalTransaction[] = Array.isArray(data.internalTransactions) ? data.internalTransactions : [];

          const secondCounterparties = buildCounterparties(
            secondTxs,
            secondTokens,
            secondInternals,
            selectedCounterparty.address.toLowerCase()
          );

          const rootRelationship = secondCounterparties.find(
            (item) => item.address.toLowerCase() === rootAddress
          );

          secondHopResult = {
            investigatedAddress: selectedCounterparty.address,
            selectionReason:
              language === "zh"
                ? `Agent 根据该地址的 ${selectedCounterparty.interactionCount} 次观测交互和 ${selectedCounterparty.sources.length} 类数据来源信号，选择它进行进一步调查。`
                : `The agent selected this address because it has ${selectedCounterparty.interactionCount} observed interaction events across ${selectedCounterparty.sources.length} data source(s).`,
            transactionCount: secondTxs.length,
            tokenTransferCount: secondTokens.length,
            internalTransactionCount: secondInternals.length,
            counterparties: secondCounterparties,
            linksBackToRoot: Boolean(rootRelationship),
            rootInteractionCount: rootRelationship?.interactionCount || 0,
          };

          setSecondHop(secondHopResult);
        } catch (error) {
          console.error("Second-hop investigation:", error);
        }
      }

      setStatus(language === "zh" ? "正在生成变化原因与潜在影响报告..." : "Generating change cause and impact report...");
      setAiLoading(true);

      const evidenceTransactions = txItems.slice(0, 20).map((tx) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        valueEth: formatEth(tx.value),
        time: localFormatTime(tx.timeStamp),
        direction: tx.from?.toLowerCase() === rootAddress ? ("OUT" as const) : ("IN" as const),
        blockNumber: tx.blockNumber,
      }));

      const evidenceTokens = tokenItems.slice(0, 20).map((tx) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        direction: tx.from?.toLowerCase() === rootAddress ? ("OUT" as const) : ("IN" as const),
        amount: formatTokenAmount(tx.value, tx.tokenDecimal),
        symbol: tx.tokenSymbol || "TOKEN",
        tokenName: tx.tokenName || "Unknown Token",
        contractAddress: tx.contractAddress,
        time: localFormatTime(tx.timeStamp),
        blockNumber: tx.blockNumber,
      }));

      const evidenceInternal = internalItems.slice(0, 20).map((tx) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        direction: tx.from?.toLowerCase() === rootAddress ? ("OUT" as const) : ("IN" as const),
        valueEth: formatEth(tx.value),
        type: tx.type || "unknown",
        time: localFormatTime(tx.timeStamp),
        blockNumber: tx.blockNumber,
        isError: tx.isError,
      }));

      const firstHopEvidence = firstHopCounterparties.slice(0, 10).map((item) => ({
        address: item.address,
        interactionCount: item.interactionCount,
        outgoingCount: item.outgoingCount,
        incomingCount: item.incomingCount,
        ethOut: item.ethOut.toFixed(4),
        ethIn: item.ethIn.toFixed(4),
        tokenEventCount: item.tokenEventCount,
        internalEventCount: item.internalEventCount,
        sources: item.sources,
        tokenSymbols: item.tokenSymbols,
        lastInteraction: item.lastTimestamp ? localFormatTime(String(item.lastTimestamp)) : "Unknown",
      }));

      const secondHopEvidence = secondHopResult
        ? {
            investigatedAddress: secondHopResult.investigatedAddress,
            selectedFromAddress: address,
            selectionReason: secondHopResult.selectionReason,
            transactionCount: secondHopResult.transactionCount,
            tokenTransferCount: secondHopResult.tokenTransferCount,
            internalTransactionCount: secondHopResult.internalTransactionCount,
            totalObservedEvents:
              secondHopResult.transactionCount +
              secondHopResult.tokenTransferCount +
              secondHopResult.internalTransactionCount,
            linksBackToRoot: secondHopResult.linksBackToRoot,
            rootInteractionCount: secondHopResult.rootInteractionCount,
            topCounterparties: secondHopResult.counterparties
              .filter((item) => item.address.toLowerCase() !== rootAddress)
              .slice(0, 6)
              .map((item) => ({
                address: item.address,
                interactionCount: item.interactionCount,
                outgoingCount: item.outgoingCount,
                incomingCount: item.incomingCount,
                ethOut: item.ethOut.toFixed(4),
                ethIn: item.ethIn.toFixed(4),
                sources: item.sources,
                tokenSymbols: item.tokenSymbols,
              })),
          }
        : null;

      try {
        const aiResponse = await fetch("/api/investigate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            balance: formattedBalance,
            riskScore: score,
            riskLevel,
            language,
            anomalies: detected,
            changeAnalysis: changeResult,
            transactions: evidenceTransactions,
            tokenTransfers: evidenceTokens,
            internalTransactions: evidenceInternal,
            counterparties: firstHopEvidence,
            secondHop: secondHopEvidence,
            analyzedTransactionCount: txItems.length,
            analyzedTokenTransferCount: tokenItems.length,
            analyzedInternalTransactionCount: internalItems.length,
            evidenceTransactionCount: evidenceTransactions.length,
            evidenceTokenTransferCount: evidenceTokens.length,
            evidenceInternalTransactionCount: evidenceInternal.length,
          }),
        });

        const aiData = await aiResponse.json();
        if (!aiResponse.ok) throw new Error(aiData.error || "AI investigation failed");
        setAiReport(aiData.report || "");
      } catch (error) {
        console.error(error);
        setAiReport(
          language === "zh"
            ? `\n## AI 报告生成失败\n\n程序已经完成变化检测、原因假设和潜在影响分析，但 AI 报告暂时无法生成。\n`
            : `\n## AI Report Generation Failed\n\nDeterministic change detection, cause hypotheses and impact analysis completed successfully, but the AI report could not be generated.\n`
        );
      } finally {
        setAiLoading(false);
      }

      setStatus(language === "zh" ? "调查完成" : "Investigation complete");
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

  return (
    <Dashboard
      language={language}
      t={t}
      address={address}
      status={status}
      loading={loading}
      onAddressChange={setAddress}
      onStart={startInvestigation}
      onLanguageChange={updateLanguage}
      hasResults={hasResults}
      riskScore={riskScore}
      riskLabel={risk.label}
      riskClass={risk.className}
      totalEvents={totalEvents}
      transactions={transactions}
      tokenTransfers={tokenTransfers}
      internalTransactions={internalTransactions}
      changeAnalysis={changeAnalysis}
      counterparties={counterparties}
      anomalies={anomalies}
      secondHop={secondHop}
      aiLoading={aiLoading}
      aiReport={aiReport}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      flaggedHashes={flaggedHashes}
      formatTime={localFormatTime}
    />
  );
}
