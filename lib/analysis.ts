import { ethers } from "ethers";
import type {
  Anomaly,
  CauseHypothesis,
  ChangeAnalysis,
  ChangeMetric,
  Counterparty,
  ImpactItem,
  InternalTransaction,
  Language,
  TokenTransfer,
  Transaction,
} from "./types";

export function buildCounterparties(
  txs: Transaction[],
  tokens: TokenTransfer[],
  internals: InternalTransaction[],
  target: string
): Counterparty[] {
  type Mutable = Counterparty & {
    sourceSet: Set<string>;
    tokenSet: Set<string>;
  };

  const map = new Map<string, Mutable>();

  function getItem(address: string) {
    const key = address.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        address,
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
        sourceSet: new Set<string>(),
        tokenSet: new Set<string>(),
      });
    }
    return map.get(key)!;
  }

  for (const tx of txs) {
    const from = tx.from?.toLowerCase();
    const to = tx.to?.toLowerCase();
    const outgoing = from === target;
    const incoming = to === target;
    if (!outgoing && !incoming) continue;

    const counterparty = outgoing ? tx.to : tx.from;
    if (!counterparty) continue;

    const item = getItem(counterparty);
    item.interactionCount++;
    item.sourceSet.add("ETH");
    item.lastTimestamp = Math.max(item.lastTimestamp, Number(tx.timeStamp));

    let amount = 0;
    try { amount = Number(ethers.formatEther(tx.value || "0")); } catch {}

    if (outgoing) {
      item.outgoingCount++;
      item.ethOut += amount;
    } else {
      item.incomingCount++;
      item.ethIn += amount;
    }
  }

  for (const tx of tokens) {
    const from = tx.from?.toLowerCase();
    const to = tx.to?.toLowerCase();
    const outgoing = from === target;
    const incoming = to === target;
    if (!outgoing && !incoming) continue;

    const counterparty = outgoing ? tx.to : tx.from;
    if (!counterparty) continue;

    const item = getItem(counterparty);
    item.interactionCount++;
    item.tokenEventCount++;
    item.sourceSet.add("ERC-20");
    if (tx.tokenSymbol) item.tokenSet.add(tx.tokenSymbol);
    item.lastTimestamp = Math.max(item.lastTimestamp, Number(tx.timeStamp));

    if (outgoing) item.outgoingCount++;
    else item.incomingCount++;
  }

  for (const tx of internals) {
    const from = tx.from?.toLowerCase();
    const to = tx.to?.toLowerCase();
    const outgoing = from === target;
    const incoming = to === target;
    if (!outgoing && !incoming) continue;

    const counterparty = outgoing ? tx.to : tx.from;
    if (!counterparty) continue;

    const item = getItem(counterparty);
    item.interactionCount++;
    item.internalEventCount++;
    item.sourceSet.add("Internal");
    item.lastTimestamp = Math.max(item.lastTimestamp, Number(tx.timeStamp));

    let amount = 0;
    try { amount = Number(ethers.formatEther(tx.value || "0")); } catch {}

    if (outgoing) {
      item.outgoingCount++;
      item.ethOut += amount;
    } else {
      item.incomingCount++;
      item.ethIn += amount;
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      address: item.address,
      interactionCount: item.interactionCount,
      outgoingCount: item.outgoingCount,
      incomingCount: item.incomingCount,
      ethOut: item.ethOut,
      ethIn: item.ethIn,
      tokenEventCount: item.tokenEventCount,
      internalEventCount: item.internalEventCount,
      sources: Array.from(item.sourceSet),
      tokenSymbols: Array.from(item.tokenSet).slice(0, 8),
      lastTimestamp: item.lastTimestamp,
    }))
    .sort((a, b) => b.interactionCount - a.interactionCount);
}

export function chooseSecondHopCounterparty(items: Counterparty[], root: string) {
  return items
    .filter((item) =>
      item.address &&
      item.address.toLowerCase() !== root &&
      item.address.toLowerCase() !== "0x0000000000000000000000000000000000000000"
    )
    .map((item) => ({
      item,
      score:
        item.interactionCount +
        item.outgoingCount * 1.5 +
        item.sources.length * 3 +
        Math.min(Math.log10(item.ethOut + 1) * 2, 8),
    }))
    .sort((a, b) => b.score - a.score)[0]?.item || null;
}

export function calculateRiskScore(items: Anomaly[]) {
  return Math.min(items.reduce((sum, item) => sum + item.score, 0), 100);
}

export function getRiskLevel(score: number | null, language: Language) {
  if (score === null) return { label: language === "zh" ? "等待" : "WAITING", className: "text-slate-400" };
  if (score >= 80) return { label: language === "zh" ? "严重" : "CRITICAL", className: "text-red-400" };
  if (score >= 60) return { label: language === "zh" ? "高风险" : "HIGH", className: "text-orange-400" };
  if (score >= 30) return { label: language === "zh" ? "中风险" : "MEDIUM", className: "text-amber-400" };
  return { label: language === "zh" ? "低风险" : "LOW", className: "text-emerald-400" };
}

export function detectCounterpartyAnomalies(items: Counterparty[], language: Language): Anomaly[] {
  if (!items.length) return [];
  const results: Anomaly[] = [];
  const outgoingTotal = items.reduce((sum, item) => sum + item.outgoingCount, 0);

  if (outgoingTotal >= 5) {
    const top = [...items].sort((a, b) => b.outgoingCount - a.outgoingCount)[0];
    const ratio = top.outgoingCount / outgoingTotal;
    if (top.outgoingCount >= 4 && ratio >= 0.7) {
      results.push({
        type: language === "zh" ? "对手方高度集中" : "Counterparty Concentration",
        severity: ratio >= 0.85 ? "HIGH" : "MEDIUM",
        description: language === "zh"
          ? `${(ratio * 100).toFixed(1)}% 的样本转出交互集中于同一个对手方。`
          : `${(ratio * 100).toFixed(1)}% of sampled outgoing interactions involve one counterparty.`,
        score: ratio >= 0.85 ? 12 : 7,
      });
    }
  }
  return results;
}

export function detectEthAnomalies(txs: Transaction[], targetAddress: string, language: Language): Anomaly[] {
  if (!txs.length) return [];
  const results: Anomaly[] = [];
  const target = targetAddress.toLowerCase();

  const parsed = txs.map((tx) => {
    let ethValue = 0;
    try { ethValue = Number(ethers.formatEther(tx.value || "0")); } catch {}
    return {
      ...tx,
      ethValue,
      timestamp: Number(tx.timeStamp),
      isOutgoing: tx.from?.toLowerCase() === target,
      isIncoming: tx.to?.toLowerCase() === target,
    };
  }).sort((a, b) => a.timestamp - b.timestamp);

  const outgoing = parsed.filter((tx) => tx.isOutgoing && tx.ethValue > 0);
  const incoming = parsed.filter((tx) => tx.isIncoming && tx.ethValue > 0);
  const avgOutgoing = outgoing.length
    ? outgoing.reduce((sum, tx) => sum + tx.ethValue, 0) / outgoing.length
    : 0;

  const large = outgoing.filter((tx) => avgOutgoing > 0 && tx.ethValue >= avgOutgoing * 3 && tx.ethValue >= 0.1);
  if (large.length) {
    const biggest = large.reduce((a, b) => a.ethValue > b.ethValue ? a : b);
    const high = biggest.ethValue >= avgOutgoing * 8;
    results.push({
      type: language === "zh" ? "ETH 大额转出" : "Large ETH Transfer",
      severity: high ? "HIGH" : "MEDIUM",
      description: language === "zh"
        ? `${biggest.ethValue.toFixed(4)} ETH 显著高于近期平均转出 ${avgOutgoing.toFixed(4)} ETH。`
        : `${biggest.ethValue.toFixed(4)} ETH was significantly larger than the recent outgoing average of ${avgOutgoing.toFixed(4)} ETH.`,
      score: high ? 18 : 10,
      evidenceHash: biggest.hash,
    });
  }

  let max10m = 0;
  let evidenceHash = "";
  for (let i = 0; i < parsed.length; i++) {
    let count = 0;
    for (let j = i; j < parsed.length; j++) {
      if (parsed[j].timestamp - parsed[i].timestamp <= 600) count++;
      else break;
    }
    if (count > max10m) {
      max10m = count;
      evidenceHash = parsed[i].hash;
    }
  }

  if (max10m >= 8) {
    results.push({
      type: language === "zh" ? "ETH 交易频率突增" : "ETH Transaction Frequency Spike",
      severity: max10m >= 15 ? "HIGH" : "MEDIUM",
      description: language === "zh"
        ? `10 分钟内观察到 ${max10m} 次普通 Ethereum 交易。`
        : `${max10m} normal Ethereum transactions occurred within a 10-minute window.`,
      score: max10m >= 15 ? 14 : 8,
      evidenceHash,
    });
  }

  for (const received of incoming) {
    let outgoingSoon = 0;
    let rapidHash = "";
    for (const sent of outgoing) {
      const delay = sent.timestamp - received.timestamp;
      if (delay >= 0 && delay <= 1800) {
        outgoingSoon += sent.ethValue;
        if (!rapidHash) rapidHash = sent.hash;
      }
    }
    if (received.ethValue >= 0.1 && outgoingSoon >= received.ethValue * 0.7) {
      results.push({
        type: language === "zh" ? "ETH 快速流出" : "Rapid ETH Outflow",
        severity: "HIGH",
        description: language === "zh"
          ? `收到 ${received.ethValue.toFixed(4)} ETH 后，30 分钟内约有 ${outgoingSoon.toFixed(4)} ETH 被转出。`
          : `After receiving ${received.ethValue.toFixed(4)} ETH, approximately ${outgoingSoon.toFixed(4)} ETH was sent out within 30 minutes.`,
        score: 18,
        evidenceHash: rapidHash,
      });
      break;
    }
  }

  return results;
}

function detectFrequencySpike<T extends { hash: string; timeStamp: string }>(
  items: T[],
  language: Language,
  zhType: string,
  enType: string,
  zhUnit: string,
  enUnit: string
): Anomaly[] {
  if (!items.length) return [];
  const parsed = items.map((x) => ({ ...x, timestamp: Number(x.timeStamp) })).sort((a, b) => a.timestamp - b.timestamp);
  let max10m = 0;
  let evidenceHash = "";
  for (let i = 0; i < parsed.length; i++) {
    let count = 0;
    for (let j = i; j < parsed.length; j++) {
      if (parsed[j].timestamp - parsed[i].timestamp <= 600) count++;
      else break;
    }
    if (count > max10m) {
      max10m = count;
      evidenceHash = parsed[i].hash;
    }
  }
  if (max10m < 8) return [];
  return [{
    type: language === "zh" ? zhType : enType,
    severity: max10m >= 15 ? "HIGH" : "MEDIUM",
    description: language === "zh"
      ? `10 分钟内观察到 ${max10m} 次${zhUnit}。`
      : `${max10m} ${enUnit} occurred within a 10-minute window.`,
    score: max10m >= 15 ? 14 : 8,
    evidenceHash,
  }];
}

export function detectTokenAnomalies(items: TokenTransfer[], language: Language) {
  return detectFrequencySpike(items, language, "ERC-20 活动突增", "ERC-20 Activity Spike", " ERC-20 转账事件", "ERC-20 transfer events");
}

export function detectInternalAnomalies(items: InternalTransaction[], language: Language) {
  return detectFrequencySpike(items, language, "Internal 活动突增", "Internal Transaction Activity Spike", " Internal Transaction", "internal transaction events");
}

export function analyzeBehaviorChange(
  txs: Transaction[],
  tokens: TokenTransfer[],
  internals: InternalTransaction[],
  cps: Counterparty[],
  root: string
): ChangeAnalysis {
  const allTimestamps = [
    ...txs.map((x) => Number(x.timeStamp)),
    ...tokens.map((x) => Number(x.timeStamp)),
    ...internals.map((x) => Number(x.timeStamp)),
  ].filter((x) => Number.isFinite(x) && x > 0);

  const latest = allTimestamps.length ? Math.max(...allTimestamps) : Math.floor(Date.now() / 1000);
  const WINDOW = 24 * 60 * 60;
  const recentStart = latest - WINDOW;
  const baselineStart = recentStart - WINDOW;

  const inRecent = (x: { timeStamp: string }) => Number(x.timeStamp) >= recentStart && Number(x.timeStamp) <= latest;
  const inBaseline = (x: { timeStamp: string }) => Number(x.timeStamp) >= baselineStart && Number(x.timeStamp) < recentStart;

  const recentTx = txs.filter(inRecent);
  const baselineTx = txs.filter(inBaseline);
  const recentTokens = tokens.filter(inRecent);
  const baselineTokens = tokens.filter(inBaseline);
  const recentInternal = internals.filter(inRecent);
  const baselineInternal = internals.filter(inBaseline);

  function ethOutflow(items: Transaction[]) {
    return items.reduce((sum, tx) => {
      if (tx.from?.toLowerCase() !== root) return sum;
      try { return sum + Number(ethers.formatEther(tx.value || "0")); }
      catch { return sum; }
    }, 0);
  }

  function internalOutflow(items: InternalTransaction[]) {
    return items.reduce((sum, tx) => {
      if (tx.from?.toLowerCase() !== root) return sum;
      try { return sum + Number(ethers.formatEther(tx.value || "0")); }
      catch { return sum; }
    }, 0);
  }

  function concentration(items: Transaction[]) {
    const outgoing = items.filter((x) => x.from?.toLowerCase() === root && x.to);
    if (outgoing.length < 2) return 0;
    const map = new Map<string, number>();
    for (const tx of outgoing) {
      let amount = 0;
      try { amount = Number(ethers.formatEther(tx.value || "0")); } catch {}
      const key = tx.to.toLowerCase();
      map.set(key, (map.get(key) || 0) + amount);
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    if (total <= 0) return 0;
    return Math.max(...Array.from(map.values())) / total;
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
    const ratio = recent / Math.max(Math.abs(baseline), 0.000001);
    let direction: "UP" | "DOWN" | "STABLE" = "STABLE";
    if (baseline === 0 && recent > 0) direction = "UP";
    else if (recent > baseline * 1.5) direction = "UP";
    else if (recent < baseline * 0.67) direction = "DOWN";

    const magnitude = baseline === 0 ? (recent > 0 ? 999 : 1) : ratio;
    const important = direction !== "STABLE" && (
      recent >= 3 || baseline >= 3 || key.includes("outflow") || key.includes("concentration")
    );

    return { key, labelZh, labelEn, baseline, recent, unitZh, unitEn, direction, magnitude, important, explanationZh, explanationEn };
  }

  const recentEthOut = ethOutflow(recentTx);
  const baselineEthOut = ethOutflow(baselineTx);
  const recentInternalOut = internalOutflow(recentInternal);
  const baselineInternalOut = internalOutflow(baselineInternal);
  const recentConcentration = concentration(recentTx);
  const baselineConcentration = concentration(baselineTx);

  const metrics: ChangeMetric[] = [
    makeMetric("eth_frequency", "ETH 交易频率", "ETH Transaction Frequency", baselineTx.length, recentTx.length, " 次/24h", " /24h", "近期普通 ETH 交易数量相较前一个 24 小时窗口发生变化。", "Recent normal ETH transaction activity changed compared with the previous 24-hour window."),
    makeMetric("eth_outflow", "ETH 转出量", "ETH Outflow", baselineEthOut, recentEthOut, " ETH", " ETH", "近期 ETH 转出规模相较基准窗口发生变化。", "Recent ETH outflow changed compared with the baseline window."),
    makeMetric("token_frequency", "ERC-20 活动", "ERC-20 Activity", baselineTokens.length, recentTokens.length, " 次/24h", " /24h", "近期 ERC-20 转账事件数量发生变化。", "Recent ERC-20 transfer activity changed."),
    makeMetric("internal_frequency", "Internal 活动", "Internal Activity", baselineInternal.length, recentInternal.length, " 次/24h", " /24h", "智能合约执行产生的内部资金活动数量发生变化。", "Internal transaction activity generated during smart-contract execution changed."),
    makeMetric("internal_outflow", "Internal ETH 转出", "Internal ETH Outflow", baselineInternalOut, recentInternalOut, " ETH", " ETH", "Internal Transaction 中的 ETH 转出规模发生变化。", "ETH outflow observed in internal transactions changed."),
    makeMetric("concentration", "主要接收方集中度", "Top Recipient Concentration", baselineConcentration * 100, recentConcentration * 100, "%", "%", "近期普通 ETH 转出是否更加集中到少数地址。", "Measures whether recent ETH outflow became more concentrated among fewer recipients."),
  ];

  const importantMetrics = metrics.filter((x) => x.important);
  const frequencyUp = importantMetrics.find((x) => x.key === "eth_frequency" && x.direction === "UP");
  const outflowUp = importantMetrics.find((x) => x.key === "eth_outflow" && x.direction === "UP");
  const tokenUp = importantMetrics.find((x) => x.key === "token_frequency" && x.direction === "UP");
  const internalUp = importantMetrics.find((x) => x.key === "internal_frequency" && x.direction === "UP");
  const concentrationUp = importantMetrics.find((x) => x.key === "concentration" && x.direction === "UP");

  const causes: CauseHypothesis[] = [];
  if (outflowUp && concentrationUp) {
    causes.push({
      id: "fund_consolidation",
      titleZh: "资金归集或资产迁移",
      titleEn: "Fund Consolidation or Asset Migration",
      confidence: concentrationUp.recent >= 70 ? "HIGH" : "MEDIUM",
      evidenceZh: ["近期 ETH 转出规模上升", "主要接收方集中度同步上升", "资金更集中地流向少数对手方"],
      evidenceEn: ["Recent ETH outflow increased", "Top-recipient concentration increased", "Funds became more concentrated among fewer counterparties"],
      explanationZh: "这种模式与资金归集、钱包迁移或集中管理资金的行为相符，但仅凭链上行为无法确认实际目的。",
      explanationEn: "This pattern is consistent with fund consolidation, wallet migration, or centralized treasury movement, but the actual purpose cannot be confirmed from on-chain behavior alone.",
    });
  }

  if (internalUp && (tokenUp || frequencyUp)) {
    causes.push({
      id: "automated_contract_activity",
      titleZh: "自动化合约或 DeFi 活动增加",
      titleEn: "Increased Automated Contract or DeFi Activity",
      confidence: tokenUp && internalUp ? "HIGH" : "MEDIUM",
      evidenceZh: ["Internal Transaction 活动上升", tokenUp ? "ERC-20 转账活动同步上升" : "普通交易活动同步变化", "多种链上事件在相近时间窗口同时增加"],
      evidenceEn: ["Internal transaction activity increased", tokenUp ? "ERC-20 transfer activity also increased" : "Normal transaction activity also changed", "Multiple on-chain event types increased in the same time window"],
      explanationZh: "多个数据源同步活跃通常与智能合约调用、DEX、DeFi 操作或自动化执行有关，但目前系统尚未完成协议语义识别。",
      explanationEn: "Simultaneous activity across multiple sources can be consistent with smart-contract calls, DEX or DeFi interaction, or automated execution. Full protocol semantics are not yet identified.",
    });
  }

  if (frequencyUp && outflowUp) {
    causes.push({
      id: "rapid_distribution",
      titleZh: "批量转账或快速资金分发",
      titleEn: "Batch Transfer or Rapid Fund Distribution",
      confidence: "MEDIUM",
      evidenceZh: ["短期交易频率上升", "ETH 转出规模同时增加", "资金活动在近期窗口内明显加速"],
      evidenceEn: ["Short-term transaction frequency increased", "ETH outflow also increased", "Fund movement accelerated in the recent window"],
      explanationZh: "这种模式可能来自批量支付、资金分发、自动化钱包操作或短期资产调整。当前证据不能区分具体业务目的。",
      explanationEn: "This can be consistent with batch payments, fund distribution, automated wallet operations, or short-term asset reallocation. The exact purpose cannot be determined from current evidence.",
    });
  }

  if (!causes.length && importantMetrics.length) {
    causes.push({
      id: "unresolved_external_change",
      titleZh: "未知外部行为变化",
      titleEn: "Unresolved External Behavioral Change",
      confidence: "LOW",
      evidenceZh: importantMetrics.slice(0, 3).map((x) => `${x.labelZh}发生明显变化`),
      evidenceEn: importantMetrics.slice(0, 3).map((x) => `${x.labelEn} changed materially`),
      explanationZh: "程序确认行为发生变化，但当前链上数据不足以可靠判断具体原因，需要进一步结合地址标签、协议语义或更长历史窗口。",
      explanationEn: "The program confirms that behavior changed, but current on-chain evidence is insufficient to reliably determine the cause. Entity labels, protocol semantics or a longer history window would be needed.",
    });
  }

  const impacts: ImpactItem[] = [];
  if (outflowUp) impacts.push({ id: "balance_pressure", categoryZh: "资金影响", categoryEn: "Financial Impact", titleZh: "余额可能进一步下降", titleEn: "Balance May Decline Further", descriptionZh: "如果近期高转出行为持续，当前地址的可用 ETH 余额可能继续下降。", descriptionEn: "If the elevated outflow continues, the address's available ETH balance may continue to decline.", severity: outflowUp.magnitude >= 3 ? "HIGH" : "MEDIUM" });
  if (concentrationUp && concentrationUp.recent >= 60) impacts.push({ id: "concentration_risk", categoryZh: "关系影响", categoryEn: "Network Impact", titleZh: "资金关系更加集中", titleEn: "Fund Relationships Are Becoming More Concentrated", descriptionZh: "更多资金集中到少数地址后，资金路径对少量对手方的依赖上升。", descriptionEn: "As more funds concentrate among fewer addresses, the fund-flow network becomes more dependent on a small number of counterparties.", severity: concentrationUp.recent >= 80 ? "HIGH" : "MEDIUM" });
  if (frequencyUp || internalUp || tokenUp) impacts.push({ id: "behavioral_shift", categoryZh: "行为影响", categoryEn: "Behavioral Impact", titleZh: "地址行为已经偏离近期基准", titleEn: "Wallet Behavior Has Shifted From Its Recent Baseline", descriptionZh: "多个活动指标发生同步变化，说明当前行为模式与前一个基准窗口不同。", descriptionEn: "Multiple activity metrics changed at the same time, indicating that the current behavior differs from the previous baseline window.", severity: "MEDIUM" });
  if (cps.length >= 5) impacts.push({ id: "trace_complexity", categoryZh: "调查影响", categoryEn: "Investigation Impact", titleZh: "资金关系扩散会增加追踪复杂度", titleEn: "Relationship Expansion Increases Tracing Complexity", descriptionZh: "当资金经过更多对手方和第二跳地址时，后续资金追踪需要更完整的关系图谱和标签信息。", descriptionEn: "As funds propagate through more counterparties and second-hop addresses, tracing requires richer graph and attribution data.", severity: cps.length >= 15 ? "HIGH" : "MEDIUM" });

  const summaryZh = importantMetrics.length
    ? `程序在最近 24 小时窗口中识别到 ${importantMetrics.length} 个明显变化指标。最重要的是：${importantMetrics.slice(0, 3).map((x) => x.labelZh).join("、")}。`
    : "当前最近 24 小时窗口与前一个基准窗口之间没有检测到明显变化。";

  const summaryEn = importantMetrics.length
    ? `The program identified ${importantMetrics.length} material change metric(s) in the recent 24-hour window. The most relevant were ${importantMetrics.slice(0, 3).map((x) => x.labelEn).join(", ")}.`
    : "No major behavioral change was detected between the recent 24-hour window and the previous baseline window.";

  return { recentStart, baselineStart, metrics, causes, impacts, summaryZh, summaryEn };
}
