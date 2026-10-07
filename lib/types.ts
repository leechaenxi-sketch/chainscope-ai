export type Language = "zh" | "en";
export type Tab = "overview" | "trace" | "report" | "evidence";

export type Transaction = {
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

export type TokenTransfer = {
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

export type InternalTransaction = {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timeStamp: string;
  type?: string;
  isError?: string;
};

export type Anomaly = {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  score: number;
  evidenceHash?: string;
};

export type Counterparty = {
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

export type SecondHopResult = {
  investigatedAddress: string;
  selectionReason: string;
  transactionCount: number;
  tokenTransferCount: number;
  internalTransactionCount: number;
  counterparties: Counterparty[];
  linksBackToRoot: boolean;
  rootInteractionCount: number;
};

export type ChangeMetric = {
  key: string;
  labelZh: string;
  labelEn: string;
  baseline: number;
  recent: number;
  unitZh: string;
  unitEn: string;
  direction: "UP" | "DOWN" | "STABLE";
  magnitude: number;
  important: boolean;
  explanationZh: string;
  explanationEn: string;
};

export type CauseHypothesis = {
  id: string;
  titleZh: string;
  titleEn: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidenceZh: string[];
  evidenceEn: string[];
  explanationZh: string;
  explanationEn: string;
};

export type ImpactItem = {
  id: string;
  categoryZh: string;
  categoryEn: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
};

export type ChangeAnalysis = {
  recentStart: number;
  baselineStart: number;
  metrics: ChangeMetric[];
  causes: CauseHypothesis[];
  impacts: ImpactItem[];
  summaryZh: string;
  summaryEn: string;
};
