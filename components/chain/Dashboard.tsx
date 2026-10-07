"use client";

import type { ReactNode } from "react";
import {
  ArrowDown, ArrowRight, ArrowUp, ChartLineUp, Check, CircleNotch,
  Database, FileText, MagnifyingGlass, ShieldCheck, Stack,
  TreeStructure, Wallet, WarningCircle, CaretDown,
} from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  Anomaly, CauseHypothesis, ChangeAnalysis, ChangeMetric, Counterparty,
  ImpactItem, InternalTransaction, Language, SecondHopResult, Tab,
  TokenTransfer, Transaction,
} from "@/lib/types";
import type { copy } from "@/lib/copy";
import { formatEth, formatMetricValue, shortenGlobal } from "@/lib/format";

type Copy = (typeof copy)[Language];
export type DashboardProps = {
  language: Language;
  t: Copy;
  address: string;
  status: string;
  loading: boolean;
  onAddressChange: (value: string) => void;
  onStart: () => void;
  onLanguageChange: (lang: Language) => void;
  hasResults: boolean;
  riskScore: number | null;
  riskLabel: string;
  riskClass: string;
  totalEvents: number;
  transactions: Transaction[];
  tokenTransfers: TokenTransfer[];
  internalTransactions: InternalTransaction[];
  changeAnalysis: ChangeAnalysis | null;
  counterparties: Counterparty[];
  anomalies: Anomaly[];
  secondHop: SecondHopResult | null;
  aiLoading: boolean;
  aiReport: string;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  flaggedHashes: Set<string>;
  formatTime: (timestamp: string) => string;
};

export function Dashboard({
  language, t, address, status, loading, onAddressChange, onStart,
  onLanguageChange, hasResults, riskScore, riskLabel, riskClass,
  totalEvents, transactions, tokenTransfers, internalTransactions,
  changeAnalysis, counterparties, anomalies, secondHop, aiLoading,
  aiReport, activeTab, onTabChange, flaggedHashes, formatTime,
}: DashboardProps) {
  const importantChanges = changeAnalysis?.metrics.filter((x) => x.important) || [];
  const navigation = [
    { id: "overview" as const, label: t.overview, icon: ChartLineUp },
    { id: "trace" as const, label: t.trace, icon: TreeStructure },
    { id: "report" as const, label: t.report, icon: FileText },
    { id: "evidence" as const, label: t.evidence, icon: Database },
  ];

  return (
    <main className="chain-app" lang={language === "zh" ? "zh-CN" : "en"}>
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">C</div>
          <div className="brand-copy">
            <div className="brand-name">ChainScope AI</div>
            <div className="brand-subtitle">{t.subtitle}</div>
          </div>
        </div>
        <div className="header-controls">
          <div className="network-label"><Stack size={17} aria-hidden="true" />{t.network}</div>
          <div className="language-switch">
            <button type="button" onClick={() => onLanguageChange("zh")} aria-pressed={language === "zh"} className={language === "zh" ? "selected" : ""}>中文</button>
            <button type="button" onClick={() => onLanguageChange("en")} aria-pressed={language === "en"} className={language === "en" ? "selected" : ""}>EN</button>
          </div>
        </div>
      </header>

      <div className="app-layout">
        <aside className="app-sidebar">
          <nav className="side-navigation" aria-label={t.heroEyebrow}>
            {navigation.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                disabled={!hasResults}
                onClick={() => onTabChange(id)}
                aria-pressed={activeTab === id}
                aria-controls={hasResults ? "investigation-content" : undefined}
                className={"nav-button" + (activeTab === id ? " active" : "")}
              >
                <Icon size={21} weight="regular" aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="workspace">
          <section className={"investigation-hero" + (hasResults ? " with-results" : "")}>
            <div className="hero-eyebrow">{t.heroEyebrow}</div>
            <h1>{t.heroTitle1}<span>{" "}{t.heroTitle2}</span></h1>
            <p className="hero-description">{t.heroDescription}</p>
            <div className="address-search">
              <MagnifyingGlass size={21} aria-hidden="true" className="search-icon" />
              <input
                value={address}
                onChange={(e) => onAddressChange(e.target.value)}
                placeholder={t.placeholder}
                aria-label={t.placeholder}
                spellCheck={false}
                autoComplete="off"
                className="address-input"
              />
              <button type="button" onClick={onStart} disabled={loading} className="primary-button">
                {loading ? <CircleNotch size={18} className="loading-icon" aria-hidden="true" /> : null}
                <span>{loading ? t.investigating : t.start}</span>
                {!loading && <ArrowRight size={18} aria-hidden="true" />}
              </button>
            </div>
            <div className={"investigation-status" + (loading ? " is-loading" : "")} role="status" aria-live="polite">
              {loading && <CircleNotch size={15} className="loading-icon" aria-hidden="true" />}
              {status}
            </div>
          </section>

          {hasResults && riskScore !== null && (
            <>
              <section className="summary-strip">
                <SummaryCard label={t.rootRisk} value={String(riskScore)} description={riskLabel} valueClass={riskClass} icon={<ShieldCheck size={18} />} />
                <SummaryCard
                  label={t.observedEvents}
                  value={String(totalEvents)}
                  description={transactions.length + " ETH · " + tokenTransfers.length + " ERC-20 · " + internalTransactions.length + " Internal"}
                  icon={<Stack size={18} />}
                />
                <SummaryCard label={t.changeSignals} value={String(importantChanges.length)} description={t.whatChangedDesc} icon={<ChartLineUp size={18} />} />
                <SummaryCard label={t.agentTrace} value={secondHop ? "1" : "0"} description={secondHop ? t.firstHop : t.noSecondHop} icon={<TreeStructure size={18} />} />
              </section>

              <div id="investigation-content" className="investigation-content">
                {activeTab === "overview" && (
                  <div className="overview-grid">
                    <Panel className="changes-panel">
                      <SectionHeader number="01" title={t.whatChanged} subtitle={t.whatChangedDesc} />
                      <p className="analysis-summary">{language === "zh" ? changeAnalysis?.summaryZh : changeAnalysis?.summaryEn}</p>
                      <div className="change-grid">
                        {importantChanges.length ? importantChanges.map((item) => (
                          <ChangeCard key={item.key} item={item} language={language} recentLabel={t.recent} baselineLabel={t.baseline} />
                        )) : <EmptyState>{t.noChange}</EmptyState>}
                      </div>
                    </Panel>

                    <Panel className="causes-panel">
                      <SectionHeader number="02" title={t.whyChanged} subtitle={t.whyChangedDesc} />
                      <div className="cause-list">
                        {changeAnalysis?.causes.length ? changeAnalysis.causes.map((cause) => (
                          <CauseCard key={cause.id} cause={cause} language={language} confidenceLabel={t.confidence} levels={{ LOW: t.low, MEDIUM: t.medium, HIGH: t.high }} />
                        )) : <EmptyState>{t.noCause}</EmptyState>}
                      </div>
                    </Panel>

                    <Panel className="impacts-panel">
                      <SectionHeader number="03" title={t.potentialImpact} subtitle={t.potentialImpactDesc} />
                      <div className="impact-grid">
                        {changeAnalysis?.impacts.length ? changeAnalysis.impacts.map((impact) => (
                          <ImpactCard key={impact.id} impact={impact} language={language} />
                        )) : <EmptyState>{t.noImpact}</EmptyState>}
                      </div>
                    </Panel>

                    <Panel className="support-panel">
                      <SectionHeader number="04" title={t.supportingEvidence} subtitle={t.supportingEvidenceDesc} />
                      <div className="evidence-summaries">
                        <EvidenceSummary title={language === "zh" ? "异常信号" : "Anomaly Signals"} value={String(anomalies.length)} description={language === "zh" ? "用于验证行为变化是否异常" : "Used to validate whether behavioral changes are unusual"} />
                        <EvidenceSummary title={language === "zh" ? "直接对手方" : "Direct Counterparties"} value={String(counterparties.length)} description={language === "zh" ? "用于解释资金流向是否发生集中" : "Used to explain whether fund relationships became concentrated"} />
                        <EvidenceSummary title={language === "zh" ? "重点原始证据" : "Flagged Raw Evidence"} value={String(flaggedHashes.size)} description={language === "zh" ? "异常规则直接引用的 Tx Hash" : "Tx hashes directly referenced by anomaly rules"} />
                      </div>
                    </Panel>
                  </div>
                )}

                {activeTab === "trace" && (
                  <Panel className="trace-panel">
                    <SectionHeader number="Agent" title={t.traceTitle} subtitle={t.traceDesc} />
                    {!secondHop ? <EmptyState>{t.noSecondHop}</EmptyState> : (
                      <>
                        <div className="trace-flow">
                          <TraceNode badge={t.rootWallet} address={address} />
                          <TraceArrow label={t.directRelation} />
                          <TraceNode badge={t.firstHop} address={secondHop.investigatedAddress} />
                          <TraceArrow label={t.continueInvestigation} />
                          <div className="second-hop-column">
                            <div className="second-hop-heading">{t.secondHop}</div>
                            <p className="second-hop-description">{t.secondHopDesc}</p>
                            <div className="counterparty-grid">
                              {secondHop.counterparties.filter((item) => item.address.toLowerCase() !== address.toLowerCase()).slice(0, 6).map((item, index) => (
                                <CounterpartyCard key={item.address} item={item} index={index + 1} language={language} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="important-notice">
                          <WarningCircle size={21} aria-hidden="true" />
                          <div><div className="notice-title">{t.important}</div><p>{t.importantText}</p></div>
                        </div>
                      </>
                    )}
                  </Panel>
                )}

                {activeTab === "report" && (
                  <Panel className="report-panel">
                    <SectionHeader number="AI" title={t.reportTitle} subtitle={t.reportDesc} />
                    <div className="report-body" aria-busy={aiLoading}>
                      {aiLoading ? <div className="report-loading" role="status"><CircleNotch size={20} className="loading-icon" aria-hidden="true" />{t.generating}</div> : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h2: ({ children }) => <h2>{children}</h2>,
                            h3: ({ children }) => <h3>{children}</h3>,
                            p: ({ children }) => <p>{children}</p>,
                            ul: ({ children }) => <ul>{children}</ul>,
                            ol: ({ children }) => <ol>{children}</ol>,
                            blockquote: ({ children }) => <blockquote>{children}</blockquote>,
                            table: ({ children }) => <div className="report-table-scroll"><table>{children}</table></div>,
                            th: ({ children }) => <th>{children}</th>,
                            td: ({ children }) => <td>{children}</td>,
                          }}
                        >{aiReport}</ReactMarkdown>
                      )}
                    </div>
                  </Panel>
                )}

                {activeTab === "evidence" && (
                  <EvidenceExplorer
                    language={language} address={address}
                    title={t.evidenceTitle} description={t.evidenceDesc}
                    evidenceReason={t.evidenceReason} anomaliesLabel={t.anomalies}
                    ethLabel={t.ethTransactions} tokenLabel={t.tokenTransfers}
                    internalLabel={t.internalTransactions} anomalies={anomalies}
                    transactions={transactions} tokenTransfers={tokenTransfers}
                    internalTransactions={internalTransactions} flaggedHashes={flaggedHashes}
                    formatTime={formatTime}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={"content-panel " + className}>{children}</section>;
}

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return <div className="section-header"><span className="section-marker">{number}</span><div><h2>{title}</h2><p>{subtitle}</p></div></div>;
}

function SummaryCard({ label, value, description, valueClass = "", icon }: { label: string; value: string; description: string; valueClass?: string; icon: ReactNode }) {
  return <div className="summary-item"><div className="summary-label"><span aria-hidden="true">{icon}</span>{label}</div><div className={"summary-value " + valueClass}>{value}</div><div className="summary-description">{description}</div></div>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

function ChangeCard({ item, language, recentLabel, baselineLabel }: { item: ChangeMetric; language: Language; recentLabel: string; baselineLabel: string }) {
  const up = item.direction === "UP";
  const label = language === "zh" ? item.labelZh : item.labelEn;
  const unit = language === "zh" ? item.unitZh : item.unitEn;
  const explanation = language === "zh" ? item.explanationZh : item.explanationEn;
  return (
    <div className="change-card">
      <div className="change-label"><h3>{label}</h3><span className={up ? "trend-up" : "trend-down"}>{up ? <ArrowUp size={17} aria-label="↑" /> : <ArrowDown size={17} aria-label="↓" />}</span></div>
      <div className="metric-comparison">
        <div><div className="metric-label">{baselineLabel}</div><div className="baseline-value">{formatMetricValue(item.baseline)}<span>{unit}</span></div></div>
        <ArrowRight size={17} className="metric-arrow" aria-label="→" />
        <div><div className="metric-label">{recentLabel}</div><div className="recent-value">{formatMetricValue(item.recent)}<span>{unit}</span></div></div>
      </div>
      <p>{explanation}</p>
    </div>
  );
}

function CauseCard({ cause, language, confidenceLabel, levels }: { cause: CauseHypothesis; language: Language; confidenceLabel: string; levels: Record<CauseHypothesis["confidence"], string> }) {
  const title = language === "zh" ? cause.titleZh : cause.titleEn;
  const evidence = language === "zh" ? cause.evidenceZh : cause.evidenceEn;
  const explanation = language === "zh" ? cause.explanationZh : cause.explanationEn;
  const verificationEvidence = language === "zh" ? cause.verification?.evidenceZh : cause.verification?.evidenceEn;
  const status = cause.verification?.status;
  const verificationLabel = status === "SUPPORTED"
    ? language === "zh" ? "验证：已获得额外支持" : "Validation: Additional support"
    : status === "PARTIAL"
      ? language === "zh" ? "验证：部分支持" : "Validation: Partial support"
      : language === "zh" ? "验证：仍待确认" : "Validation: Unresolved";
  return (
    <div className="cause-card">
      <div className="cause-heading"><h3>{title}</h3><span className={"confidence-label confidence-" + cause.confidence.toLowerCase()}>{confidenceLabel}: {levels[cause.confidence]}</span></div>
      <div className="cause-evidence">{evidence.map((item, index) => <div key={index}><Check size={15} aria-label="✓" /><span>{item}</span></div>)}</div>
      <p>{explanation}</p>
      {cause.verification && (
        <div className={"cause-verification verification-" + status?.toLowerCase()}>
          <div className="verification-title">{verificationLabel}</div>
          <div className="verification-evidence">
            {verificationEvidence?.map((item, index) => <div key={index}>• {item}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

function ImpactCard({ impact, language }: { impact: ImpactItem; language: Language }) {
  return <div className="impact-card"><div className="impact-category">{language === "zh" ? impact.categoryZh : impact.categoryEn}</div><h3>{language === "zh" ? impact.titleZh : impact.titleEn}</h3><p>{language === "zh" ? impact.descriptionZh : impact.descriptionEn}</p></div>;
}

function EvidenceSummary({ title, value, description }: { title: string; value: string; description: string }) {
  return <div className="evidence-summary"><div><h3>{title}</h3><p>{description}</p></div><span>{value}</span></div>;
}

function TraceNode({ badge, address }: { badge: string; address: string }) {
  return <div className="trace-node"><Wallet size={23} aria-hidden="true" /><div><div className="trace-badge">{badge}</div><div className="trace-address">{address}</div></div></div>;
}

function TraceArrow({ label }: { label: string }) {
  return <div className="trace-link"><span>{label}</span><ArrowRight size={26} aria-hidden="true" /></div>;
}

function CounterpartyCard({ item, index, language }: { item: Counterparty; index: number; language: Language }) {
  return <div className="counterparty-card"><Wallet size={18} aria-hidden="true" /><div><div className="counterparty-label">{language === "zh" ? "关联地址 #" + index : "Connected Address #" + index}</div><div className="counterparty-address">{shortenGlobal(item.address)}</div><div className="counterparty-count">{item.interactionCount} {language === "zh" ? "次观测事件" : "observed events"}</div></div></div>;
}

type EvidenceExplorerProps = {
  language: Language;
  address: string;
  title: string;
  description: string;
  evidenceReason: string;
  anomaliesLabel: string;
  ethLabel: string;
  tokenLabel: string;
  internalLabel: string;
  anomalies: Anomaly[];
  transactions: Transaction[];
  tokenTransfers: TokenTransfer[];
  internalTransactions: InternalTransaction[];
  flaggedHashes: Set<string>;
  formatTime: (timestamp: string) => string;
};

function EvidenceExplorer(props: EvidenceExplorerProps) {
  const { language, address, title, description, evidenceReason, anomaliesLabel, ethLabel, tokenLabel, internalLabel, anomalies, transactions, tokenTransfers, internalTransactions, flaggedHashes, formatTime } = props;
  const flaggedEthCount = transactions.filter((tx) => flaggedHashes.has(tx.hash?.toLowerCase())).length;
  const flaggedTokenCount = tokenTransfers.filter((tx) => flaggedHashes.has(tx.hash?.toLowerCase())).length;
  const flaggedInternalCount = internalTransactions.filter((tx) => flaggedHashes.has(tx.hash?.toLowerCase())).length;
  return (
    <Panel className="evidence-panel">
      <SectionHeader number="Data" title={title} subtitle={description} />
      {flaggedHashes.size > 0 && <div className="evidence-alert"><WarningCircle size={23} aria-label="!" /><div><div className="evidence-alert-title">{language === "zh" ? "检测到 " + flaggedHashes.size + " 个重点 Tx Hash" : flaggedHashes.size + " flagged transaction hash(es) detected"}</div><p>{evidenceReason}</p></div></div>}
      <div className="evidence-explorer">
        <EvidenceAccordion title={anomaliesLabel} count={anomalies.length} flaggedCount={anomalies.filter((x) => Boolean(x.evidenceHash)).length} language={language}><div className="anomaly-list">{anomalies.map((x, i) => <AnomalyEvidence key={x.type + "-" + i} anomaly={x} language={language} />)}</div></EvidenceAccordion>
        <EvidenceAccordion title={ethLabel} count={transactions.length} flaggedCount={flaggedEthCount} language={language}><EvidenceRows kind="eth" items={transactions} address={address} flaggedHashes={flaggedHashes} language={language} formatTime={formatTime} /></EvidenceAccordion>
        <EvidenceAccordion title={tokenLabel} count={tokenTransfers.length} flaggedCount={flaggedTokenCount} language={language}><EvidenceRows kind="token" items={tokenTransfers} address={address} flaggedHashes={flaggedHashes} language={language} formatTime={formatTime} /></EvidenceAccordion>
        <EvidenceAccordion title={internalLabel} count={internalTransactions.length} flaggedCount={flaggedInternalCount} language={language}><EvidenceRows kind="internal" items={internalTransactions} address={address} flaggedHashes={flaggedHashes} language={language} formatTime={formatTime} /></EvidenceAccordion>
      </div>
    </Panel>
  );
}

function EvidenceAccordion({ title, count, flaggedCount, language, children }: { title: string; count: number; flaggedCount: number; language: Language; children: ReactNode }) {
  return <details className="evidence-accordion"><summary><div className="accordion-heading"><span>{title}</span>{flaggedCount > 0 && <span className="flag-label">{language === "zh" ? flaggedCount + " 条重点" : flaggedCount + " flagged"}</span>}</div><div className="accordion-meta"><span>{count}</span><CaretDown size={15} aria-hidden="true" /></div></summary><div className="accordion-body">{children}</div></details>;
}

function AnomalyEvidence({ anomaly, language }: { anomaly: Anomaly; language: Language }) {
  const hasEvidence = Boolean(anomaly.evidenceHash);
  return <div className={"anomaly-evidence" + (hasEvidence ? " linked" : "")}><div className="anomaly-heading"><div><h3>{anomaly.type}</h3><p>{anomaly.description}</p></div>{hasEvidence && <span className="flag-label">{language === "zh" ? "有链上证据" : "Evidence Linked"}</span>}</div>{anomaly.evidenceHash && <div className="anomaly-hash">Tx: {shortenGlobal(anomaly.evidenceHash)}</div>}</div>;
}

type EvidenceRowsProps = {
  kind: "eth" | "token" | "internal";
  items: (Transaction | TokenTransfer | InternalTransaction)[];
  address: string;
  flaggedHashes: Set<string>;
  language: Language;
  formatTime: (timestamp: string) => string;
};

function EvidenceRows({ kind, items, address, flaggedHashes, language, formatTime }: EvidenceRowsProps) {
  const ordered = [...items].slice(0, 30).sort((a, b) => Number(flaggedHashes.has(b.hash?.toLowerCase())) - Number(flaggedHashes.has(a.hash?.toLowerCase())));
  return <div className="evidence-rows">{ordered.map((tx, index) => {
    const flagged = flaggedHashes.has(tx.hash?.toLowerCase());
    const direction = tx.from?.toLowerCase() === address.toLowerCase() ? "OUT" : "IN";
    const title = kind === "token" ? (("tokenSymbol" in tx && tx.tokenSymbol) || "TOKEN") : formatEth(tx.value) + " ETH" + (kind === "internal" ? " · Internal" : "");
    return <EvidenceRow key={tx.hash + "-" + index} direction={direction} title={title} hash={tx.hash} time={formatTime(tx.timeStamp)} flagged={flagged} language={language} />;
  })}</div>;
}

function EvidenceRow({ direction, title, hash, time, flagged, language }: { direction: "IN" | "OUT"; title: string; hash: string; time: string; flagged: boolean; language: Language }) {
  return <div className={"evidence-row" + (flagged ? " flagged" : "")}><div className="evidence-row-main"><div className="transaction-info"><span className={"direction-badge " + direction.toLowerCase()}>{direction === "OUT" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />}{direction}</span><div><div className="transaction-title"><span>{title}</span>{flagged && <span className="flag-label">{language === "zh" ? "重点证据" : "Flagged Evidence"}</span>}</div><div className="transaction-hash">{shortenGlobal(hash)}</div></div></div><div className="transaction-time">{time}</div></div>{flagged && <div className="flag-explanation">{language === "zh" ? "该交易被异常检测规则直接引用，建议优先核查。" : "This transaction is directly referenced by an anomaly rule and should be reviewed first."}</div>}</div>;
}
