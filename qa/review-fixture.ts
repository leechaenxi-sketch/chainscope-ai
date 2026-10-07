import { copy } from "@/lib/copy";
import { analyzeBehaviorChange, buildCounterparties, detectEthAnomalies, detectCounterpartyAnomalies, calculateRiskScore, getRiskLevel } from "@/lib/analysis";
import { formatTime } from "@/lib/format";
import { applySimpleCauseVerification } from "@/lib/cause-verification";
import type { Language, Tab, Transaction } from "@/lib/types";
import type { DashboardProps } from "@/components/chain/Dashboard";

// Synthetic data for UI regression checks only. Not imported by the production page.
export function reviewProps(language: Language = "zh", activeTab: Tab = "overview"): DashboardProps {
  const address = "0x1111111111111111111111111111111111111111";
  const target = "0x2222222222222222222222222222222222222222";
  const source = "0x3333333333333333333333333333333333333333";
  const other = "0x4444444444444444444444444444444444444444";
  const epoch = 1791351600;
  const transactions: Transaction[] = Array.from({ length: 36 }, (_, i) => ({
    hash: "0x" + (i + 1).toString(16).padStart(64, "0"),
    from: i % 4 === 0 ? source : address,
    to: i % 4 === 0 ? address : target,
    value: String(BigInt(i % 4 === 0 ? 24 : 18) * BigInt("1000000000000000000")),
    blockNumber: String(23500000 + i),
    timeStamp: String(epoch - (i < 28 ? i * 540 : 9 * 86400 + i * 1800)),
    isError: "0",
  }));
  const counterparties = buildCounterparties(transactions, [], [], address);
  const anomalies = [...detectEthAnomalies(transactions, address, language), ...detectCounterpartyAnomalies(counterparties, language)];
  const riskScore = calculateRiskScore(anomalies);
  const risk = getRiskLevel(riskScore, language);
  const changeAnalysis = applySimpleCauseVerification(
    analyzeBehaviorChange(transactions, [], [], counterparties, address),
    [{ address: target, isContract: true, sourceVerified: true, contractName: "UI regression fixture" }],
    counterparties,
  );
  const secondParties = buildCounterparties([
    { ...transactions[1], from: target, to: address },
    { ...transactions[2], from: target, to: other },
    { ...transactions[3], from: other, to: target },
  ], [], [], target);
  return {
    language, t: copy[language], address, status: language === "zh" ? "调查完成" : "Investigation complete",
    loading: false, onAddressChange: () => {}, onStart: () => {}, onLanguageChange: () => {},
    hasResults: true, riskScore, riskLabel: risk.label, riskClass: risk.className,
    totalEvents: transactions.length, transactions, tokenTransfers: [], internalTransactions: [],
    counterparties, anomalies, changeAnalysis, activeTab, onTabChange: () => {},
    flaggedHashes: new Set(anomalies.map(a => a.evidenceHash?.toLowerCase()).filter((v): v is string => Boolean(v))),
    secondHop: { investigatedAddress: target, selectionReason: "", transactionCount: 3, tokenTransferCount: 0, internalTransactionCount: 0,
      counterparties: secondParties, linksBackToRoot: true, rootInteractionCount: 1 },
    aiLoading: false,
    aiReport: language === "zh" ? "## 执行摘要\n\n本内容为界面回归测试数据。\n\n### 关键证据\n\n- 当前页面使用仓库原有的分析结果。\n\n| 字段 | 内容 |\n| --- | --- |\n| 网络 | Ethereum |\n\n> 核对原始交易记录。" : "## Executive Summary\n\nSynthetic UI regression data.\n\n### Key Evidence\n\n- The view uses the original repository analysis.\n\n| Field | Value |\n| --- | --- |\n| Network | Ethereum |",
    formatTime: timestamp => formatTime(timestamp, language),
  };
}
