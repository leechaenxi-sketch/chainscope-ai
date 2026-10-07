"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
import { formatEth, formatMetricValue, shortenGlobal } from "@/lib/format";

export function Dashboard({
  language,
  t,
  address,
  status,
  loading,
  onAddressChange,
  onStart,
  onLanguageChange,
  hasResults,
  riskScore,
  riskLabel,
  riskClass,
  totalEvents,
  transactions,
  tokenTransfers,
  internalTransactions,
  changeAnalysis,
  counterparties,
  anomalies,
  secondHop,
  aiLoading,
  aiReport,
  activeTab,
  onTabChange,
  flaggedHashes,
  formatTime,
}: {
  language: Language;
  t: any;
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
}) {
  const importantChanges = changeAnalysis?.metrics.filter((x) => x.important) || [];

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
              <div className="font-semibold">ChainScope</div>
              <div className="text-xs text-slate-500">{t.subtitle}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-xs text-slate-500 md:block">{t.network}</div>
            <div className="flex rounded-lg border border-white/[0.08] p-1">
              <button
                onClick={() => onLanguageChange("zh")}
                className={`rounded-md px-3 py-1.5 text-xs ${language === "zh" ? "bg-white text-slate-950" : "text-slate-500"}`}
              >
                中文
              </button>
              <button
                onClick={() => onLanguageChange("en")}
                className={`rounded-md px-3 py-1.5 text-xs ${language === "en" ? "bg-white text-slate-950" : "text-slate-500"}`}
              >
                EN
              </button>
            </div>
          </div>
        </header>

        <section className="pb-12 pt-20 text-center md:pt-28">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-400">
            {t.heroEyebrow}
          </div>

          <h1 className="mx-auto mt-5 max-w-5xl text-5xl font-semibold tracking-[-0.055em] md:text-7xl">
            ChainScope
          </h1>

          <div className="mt-5 space-y-1">
            <div className="text-lg font-medium text-slate-200 md:text-xl">
              {t.heroChineseName}
            </div>
            <div className="text-sm tracking-[0.04em] text-slate-500 md:text-base">
              {t.heroEnglishName}
            </div>
          </div>

          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-cyan-300/90 md:text-base">
            {t.heroTaglineItems.map((item: string, index: number) => (
              <span key={item} className="flex items-center gap-3">
                {index > 0 && <span className="text-slate-700">·</span>}
                <span>{item}</span>
              </span>
            ))}
          </div>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-500 md:text-base">
            {t.heroDescription}
          </p>

          <div className="mx-auto mt-9 flex max-w-3xl flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2 md:flex-row">
            <input
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder={t.placeholder}
              className="flex-1 bg-transparent px-4 py-4 font-mono text-sm outline-none"
            />
            <button
              onClick={onStart}
              disabled={loading}
              className="rounded-xl bg-white px-6 py-4 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {loading ? t.investigating : t.start}
            </button>
          </div>

          <div className="mt-4 text-xs text-slate-500">{status}</div>
        </section>

        {hasResults && riskScore !== null && (
          <>
            <section className="grid gap-3 md:grid-cols-4">
              <SummaryCard label={t.rootRisk} value={`${riskScore}`} description={riskLabel} valueClass={riskClass} />
              <SummaryCard
                label={t.observedEvents}
                value={`${totalEvents}`}
                description={`${transactions.length} ETH · ${tokenTransfers.length} ERC-20 · ${internalTransactions.length} Internal`}
              />
              <SummaryCard label={t.changeSignals} value={`${importantChanges.length}`} description={t.whatChangedDesc} />
              <SummaryCard label={t.agentTrace} value={secondHop ? "1" : "0"} description={secondHop ? t.firstHop : t.noSecondHop} />
            </section>

            <section className="mt-7">
              <div className="inline-flex rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5">
                <TabButton active={activeTab === "overview"} onClick={() => onTabChange("overview")}>{t.overview}</TabButton>
                <TabButton active={activeTab === "trace"} onClick={() => onTabChange("trace")}>{t.trace}</TabButton>
                <TabButton active={activeTab === "report"} onClick={() => onTabChange("report")}>{t.report}</TabButton>
                <TabButton active={activeTab === "evidence"} onClick={() => onTabChange("evidence")}>{t.evidence}</TabButton>
              </div>
            </section>

            {activeTab === "overview" && (
              <div className="mt-5 space-y-5">
                <Panel>
                  <SectionHeader number="01" title={t.whatChanged} subtitle={t.whatChangedDesc} />
                  <p className="mt-5 text-sm leading-7 text-slate-400">
                    {language === "zh" ? changeAnalysis?.summaryZh : changeAnalysis?.summaryEn}
                  </p>
                  <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {importantChanges.length ? importantChanges.map((item) => (
                      <ChangeCard key={item.key} item={item} language={language} recentLabel={t.recent} baselineLabel={t.baseline} />
                    )) : <div className="md:col-span-2 lg:col-span-3"><EmptyState>{t.noChange}</EmptyState></div>}
                  </div>
                </Panel>

                <Panel>
                  <SectionHeader number="02" title={t.whyChanged} subtitle={t.whyChangedDesc} />
                  <div className="mt-5 grid gap-3 lg:grid-cols-3">
                    {changeAnalysis?.causes.length ? changeAnalysis.causes.map((cause) => (
                      <CauseCard key={cause.id} cause={cause} language={language} confidenceLabel={t.confidence} levels={{ LOW: t.low, MEDIUM: t.medium, HIGH: t.high }} />
                    )) : <div className="lg:col-span-3"><EmptyState>{t.noCause}</EmptyState></div>}
                  </div>
                </Panel>

                <Panel>
                  <SectionHeader number="03" title={t.potentialImpact} subtitle={t.potentialImpactDesc} />
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {changeAnalysis?.impacts.length ? changeAnalysis.impacts.map((impact) => (
                      <ImpactCard key={impact.id} impact={impact} language={language} />
                    )) : <div className="md:col-span-2"><EmptyState>{t.noImpact}</EmptyState></div>}
                  </div>
                </Panel>

                <Panel>
                  <SectionHeader number="04" title={t.supportingEvidence} subtitle={t.supportingEvidenceDesc} />
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <EvidenceSummary title={language === "zh" ? "异常信号" : "Anomaly Signals"} value={`${anomalies.length}`} description={language === "zh" ? "用于验证行为变化是否异常" : "Used to validate whether behavioral changes are unusual"} />
                    <EvidenceSummary title={language === "zh" ? "直接对手方" : "Direct Counterparties"} value={`${counterparties.length}`} description={language === "zh" ? "用于解释资金流向是否发生集中" : "Used to explain whether fund relationships became concentrated"} />
                    <EvidenceSummary title={language === "zh" ? "重点原始证据" : "Flagged Raw Evidence"} value={`${flaggedHashes.size}`} description={language === "zh" ? "异常规则直接引用的 Tx Hash" : "Tx hashes directly referenced by anomaly rules"} />
                  </div>
                </Panel>
              </div>
            )}

            {activeTab === "trace" && (
              <section className="mt-5">
                <Panel>
                  <SectionHeader number="Agent" title={t.traceTitle} subtitle={t.traceDesc} />
                  {!secondHop ? <div className="mt-5"><EmptyState>{t.noSecondHop}</EmptyState></div> : (
                    <div className="mt-8 flex flex-col items-center">
                      <TraceNode badge={t.rootWallet} address={address} />
                      <TraceArrow label={t.directRelation} />
                      <TraceNode badge={t.firstHop} address={secondHop.investigatedAddress} />
                      <TraceArrow label={t.continueInvestigation} />
                      <div className="w-full">
                        <div className="text-center">
                          <div className="text-xs uppercase tracking-[0.22em] text-violet-300">{t.secondHop}</div>
                          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">{t.secondHopDesc}</p>
                        </div>
                        <div className="mt-5 grid gap-3 md:grid-cols-3">
                          {secondHop.counterparties.filter((item) => item.address.toLowerCase() !== address.toLowerCase()).slice(0, 6).map((item, index) => (
                            <CounterpartyCard key={item.address} item={item} index={index + 1} language={language} />
                          ))}
                        </div>
                      </div>
                      <div className="mt-6 w-full rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4">
                        <div className="text-sm font-medium text-amber-300">{t.important}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{t.importantText}</p>
                      </div>
                    </div>
                  )}
                </Panel>
              </section>
            )}

            {activeTab === "report" && (
              <section className="mt-5">
                <Panel>
                  <SectionHeader number="AI" title={t.reportTitle} subtitle={t.reportDesc} />
                  <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/[0.12] p-6">
                    {aiLoading ? <div className="py-10 text-sm text-cyan-400">{t.generating}</div> : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h2: ({ children }) => <h2 className="mb-4 mt-9 border-b border-white/[0.06] pb-3 text-xl font-semibold first:mt-0">{children}</h2>,
                          h3: ({ children }) => <h3 className="mb-3 mt-6 text-base font-semibold text-cyan-300">{children}</h3>,
                          p: ({ children }) => <p className="my-4 text-sm leading-7 text-slate-300">{children}</p>,
                          ul: ({ children }) => <ul className="my-4 list-disc space-y-2 pl-5 text-sm text-slate-300">{children}</ul>,
                          ol: ({ children }) => <ol className="my-4 list-decimal space-y-2 pl-5 text-sm text-slate-300">{children}</ol>,
                          blockquote: ({ children }) => <blockquote className="my-5 border-l-2 border-cyan-400 px-4 text-sm text-slate-400">{children}</blockquote>,
                          table: ({ children }) => <div className="my-5 overflow-x-auto"><table className="w-full text-sm">{children}</table></div>,
                          th: ({ children }) => <th className="border border-white/[0.08] px-3 py-2 text-left">{children}</th>,
                          td: ({ children }) => <td className="border border-white/[0.06] px-3 py-2 text-slate-400">{children}</td>,
                        }}
                      >{aiReport}</ReactMarkdown>
                    )}
                  </div>
                </Panel>
              </section>
            )}

            {activeTab === "evidence" && (
              <EvidenceExplorer
                language={language}
                address={address}
                title={t.evidenceTitle}
                description={t.evidenceDesc}
                evidenceReason={t.evidenceReason}
                anomaliesLabel={t.anomalies}
                ethLabel={t.ethTransactions}
                tokenLabel={t.tokenTransfers}
                internalLabel={t.internalTransactions}
                anomalies={anomalies}
                transactions={transactions}
                tokenTransfers={tokenTransfers}
                internalTransactions={internalTransactions}
                flaggedHashes={flaggedHashes}
                formatTime={formatTime}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-white/[0.065] bg-white/[0.025] p-5 md:p-6">{children}</div>;
}
function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return <div className="flex gap-4"><div className="pt-0.5 text-xs font-medium text-cyan-400">{number}</div><div><h3 className="text-lg font-medium">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p></div></div>;
}
function SummaryCard({ label, value, description, valueClass = "" }: { label: string; value: string; description: string; valueClass?: string }) {
  return <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5"><div className="text-[11px] uppercase tracking-[0.17em] text-slate-500">{label}</div><div className={`mt-4 text-3xl font-semibold ${valueClass}`}>{value}</div><div className="mt-2 text-xs leading-5 text-slate-500">{description}</div></div>;
}
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`rounded-lg px-4 py-2 text-sm ${active ? "bg-white text-slate-950" : "text-slate-500 hover:text-white"}`}>{children}</button>;
}
function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/[0.08] px-5 py-10 text-center text-sm text-slate-500">{children}</div>;
}
function ChangeCard({ item, language, recentLabel, baselineLabel }: any) {
  const up = item.direction === "UP";
  const label = language === "zh" ? item.labelZh : item.labelEn;
  const unit = language === "zh" ? item.unitZh : item.unitEn;
  const explanation = language === "zh" ? item.explanationZh : item.explanationEn;
  return <div className="rounded-xl border border-white/[0.06] bg-black/[0.1] p-4"><div className="flex items-start justify-between"><div className="text-sm font-medium">{label}</div><div className={up ? "text-emerald-400" : "text-orange-400"}>{up ? "↑" : "↓"}</div></div><div className="mt-4 flex items-end gap-3"><div><div className="text-[10px] uppercase text-slate-600">{baselineLabel}</div><div className="mt-1 text-lg text-slate-500">{formatMetricValue(item.baseline)}{unit}</div></div><div className="pb-1 text-slate-700">→</div><div><div className="text-[10px] uppercase text-slate-600">{recentLabel}</div><div className="mt-1 text-2xl font-semibold">{formatMetricValue(item.recent)}{unit}</div></div></div><p className="mt-4 text-xs leading-5 text-slate-500">{explanation}</p></div>;
}
function CauseCard({ cause, language, confidenceLabel, levels }: any) {
  const title = language === "zh" ? cause.titleZh : cause.titleEn;
  const evidence = language === "zh" ? cause.evidenceZh : cause.evidenceEn;
  const explanation = language === "zh" ? cause.explanationZh : cause.explanationEn;

  const verificationEvidence =
    language === "zh"
      ? cause.verification?.evidenceZh
      : cause.verification?.evidenceEn;

  const status = cause.verification?.status;

  const verificationLabel =
    status === "SUPPORTED"
      ? language === "zh"
        ? "验证：已获得额外支持"
        : "Validation: Additional support"
      : status === "PARTIAL"
      ? language === "zh"
        ? "验证：部分支持"
        : "Validation: Partial support"
      : language === "zh"
      ? "验证：仍待确认"
      : "Validation: Unresolved";

  const verificationClass =
    status === "SUPPORTED"
      ? "border-emerald-400/20 bg-emerald-400/[0.04]"
      : status === "PARTIAL"
      ? "border-cyan-400/20 bg-cyan-400/[0.04]"
      : "border-white/[0.06] bg-white/[0.02]";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/[0.1] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium">{title}</div>

        <div className="rounded-md bg-white/[0.05] px-2 py-1 text-[10px] text-slate-400">
          {confidenceLabel}: {levels[cause.confidence]}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {evidence.map((item: string, index: number) => (
          <div key={index} className="flex gap-2 text-xs text-slate-400">
            <span className="text-emerald-400">✓</span>
            {item}
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-6 text-slate-500">
        {explanation}
      </p>

      {cause.verification && (
        <div className={`mt-5 rounded-lg border p-3 ${verificationClass}`}>
          <div className="text-[11px] font-semibold text-slate-300">
            {verificationLabel}
          </div>

          <div className="mt-2 space-y-1.5">
            {verificationEvidence?.map((item: string, index: number) => (
              <div key={index} className="text-[11px] leading-5 text-slate-500">
                • {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function ImpactCard({ impact, language }: any) {
  return <div className="rounded-xl border border-white/[0.06] bg-black/[0.1] p-5"><div className="text-[10px] uppercase tracking-[0.16em] text-cyan-400">{language === "zh" ? impact.categoryZh : impact.categoryEn}</div><div className="mt-2 font-medium">{language === "zh" ? impact.titleZh : impact.titleEn}</div><p className="mt-3 text-sm leading-6 text-slate-500">{language === "zh" ? impact.descriptionZh : impact.descriptionEn}</p></div>;
}
function EvidenceSummary({ title, value, description }: { title: string; value: string; description: string }) {
  return <div className="rounded-xl border border-white/[0.06] bg-black/[0.1] p-4"><div className="text-xs text-slate-500">{title}</div><div className="mt-2 text-2xl font-semibold">{value}</div><p className="mt-2 text-xs leading-5 text-slate-600">{description}</p></div>;
}
function TraceNode({ badge, address }: { badge: string; address: string }) {
  return <div className="w-full max-w-xl rounded-xl border border-cyan-400/20 bg-cyan-400/[0.025] p-5 text-center"><div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">{badge}</div><div className="mt-3 break-all font-mono text-sm text-slate-300">{address}</div></div>;
}
function TraceArrow({ label }: { label: string }) {
  return <div className="flex flex-col items-center py-4"><div className="h-6 w-px bg-white/[0.12]"/><div className="rounded-full border border-white/[0.07] px-3 py-1 text-[10px] text-slate-500">{label}</div><div className="h-6 w-px bg-white/[0.12]"/><div className="text-xs text-slate-600">▼</div></div>;
}
function CounterpartyCard({ item, index, language }: { item: Counterparty; index: number; language: Language }) {
  return <div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.025] p-4"><div className="text-[10px] text-violet-300">{language === "zh" ? `关联地址 #${index}` : `Connected Address #${index}`}</div><div className="mt-2 truncate font-mono text-sm">{shortenGlobal(item.address)}</div><div className="mt-3 text-xs text-slate-500">{item.interactionCount} {language === "zh" ? "次观测事件" : "observed events"}</div></div>;
}
function EvidenceExplorer(props: any) {
  const { language, address, title, description, evidenceReason, anomaliesLabel, ethLabel, tokenLabel, internalLabel, anomalies, transactions, tokenTransfers, internalTransactions, flaggedHashes, formatTime } = props;
  const flaggedEthCount = transactions.filter((tx: Transaction) => flaggedHashes.has(tx.hash?.toLowerCase())).length;
  const flaggedTokenCount = tokenTransfers.filter((tx: TokenTransfer) => flaggedHashes.has(tx.hash?.toLowerCase())).length;
  const flaggedInternalCount = internalTransactions.filter((tx: InternalTransaction) => flaggedHashes.has(tx.hash?.toLowerCase())).length;
  return <section className="mt-5"><Panel><SectionHeader number="Data" title={title} subtitle={description}/>{flaggedHashes.size > 0 && <div className="mt-5 flex items-start gap-3 rounded-xl border border-orange-400/20 bg-orange-400/[0.04] p-4"><div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-400/10 text-sm text-orange-300">!</div><div><div className="text-sm font-medium text-orange-200">{language === "zh" ? `检测到 ${flaggedHashes.size} 个重点 Tx Hash` : `${flaggedHashes.size} flagged transaction hash(es) detected`}</div><p className="mt-1 text-xs leading-5 text-slate-500">{evidenceReason}</p></div></div>}<div className="mt-5 space-y-2"><EvidenceAccordion title={anomaliesLabel} count={anomalies.length} flaggedCount={anomalies.filter((x: Anomaly) => Boolean(x.evidenceHash)).length} language={language}><div className="space-y-2">{anomalies.map((x: Anomaly, i: number) => <AnomalyEvidence key={`${x.type}-${i}`} anomaly={x} language={language}/>)}</div></EvidenceAccordion><EvidenceAccordion title={ethLabel} count={transactions.length} flaggedCount={flaggedEthCount} language={language}><EvidenceRows kind="eth" items={transactions} address={address} flaggedHashes={flaggedHashes} language={language} formatTime={formatTime}/></EvidenceAccordion><EvidenceAccordion title={tokenLabel} count={tokenTransfers.length} flaggedCount={flaggedTokenCount} language={language}><EvidenceRows kind="token" items={tokenTransfers} address={address} flaggedHashes={flaggedHashes} language={language} formatTime={formatTime}/></EvidenceAccordion><EvidenceAccordion title={internalLabel} count={internalTransactions.length} flaggedCount={flaggedInternalCount} language={language}><EvidenceRows kind="internal" items={internalTransactions} address={address} flaggedHashes={flaggedHashes} language={language} formatTime={formatTime}/></EvidenceAccordion></div></Panel></section>;
}
function EvidenceAccordion({ title, count, flaggedCount, language, children }: any) {
  return <details className="group rounded-xl border border-white/[0.06] bg-black/[0.04]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4"><div className="flex items-center gap-3"><span className="text-sm">{title}</span>{flaggedCount > 0 && <span className="rounded-full border border-orange-400/20 bg-orange-400/[0.08] px-2.5 py-1 text-[10px] font-medium text-orange-300">{language === "zh" ? `${flaggedCount} 条重点` : `${flaggedCount} flagged`}</span>}</div><div className="flex items-center gap-3"><span className="text-xs text-slate-500">{count}</span><span className="text-xs text-slate-600 transition group-open:rotate-180">↓</span></div></summary><div className="border-t border-white/[0.05] p-4">{children}</div></details>;
}
function AnomalyEvidence({ anomaly, language }: { anomaly: Anomaly; language: Language }) {
  const hasEvidence = Boolean(anomaly.evidenceHash);
  return <div className={`rounded-lg border p-4 ${hasEvidence ? "border-orange-400/20 bg-orange-400/[0.035]" : "border-transparent bg-black/[0.12]"}`}><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium">{anomaly.type}</div><p className="mt-2 text-xs leading-5 text-slate-500">{anomaly.description}</p></div>{hasEvidence && <span className="shrink-0 rounded-md bg-orange-400/10 px-2 py-1 text-[10px] font-medium text-orange-300">{language === "zh" ? "有链上证据" : "Evidence Linked"}</span>}</div>{anomaly.evidenceHash && <div className="mt-3 border-t border-orange-400/10 pt-3 font-mono text-[10px] text-orange-300/70">Tx: {shortenGlobal(anomaly.evidenceHash)}</div>}</div>;
}
function EvidenceRows({ kind, items, address, flaggedHashes, language, formatTime }: any) {
  const ordered = [...items].slice(0, 30).sort((a, b) => Number(flaggedHashes.has(b.hash?.toLowerCase())) - Number(flaggedHashes.has(a.hash?.toLowerCase())));
  return <div className="space-y-2">{ordered.map((tx: any, index: number) => {
    const flagged = flaggedHashes.has(tx.hash?.toLowerCase());
    const direction = tx.from?.toLowerCase() === address.toLowerCase() ? "OUT" : "IN";
    const title = kind === "token" ? (tx.tokenSymbol || "TOKEN") : `${formatEth(tx.value)} ETH${kind === "internal" ? " · Internal" : ""}`;
    return <EvidenceRow key={`${tx.hash}-${index}`} direction={direction} title={title} hash={tx.hash} time={formatTime(tx.timeStamp)} flagged={flagged} language={language}/>;
  })}</div>;
}
function EvidenceRow({ direction, title, hash, time, flagged, language }: any) {
  return <div className={`relative overflow-hidden rounded-lg border p-4 transition ${flagged ? "border-orange-400/30 bg-orange-400/[0.055]" : "border-transparent bg-black/[0.12]"}`}>{flagged && <div className="absolute inset-y-0 left-0 w-[3px] bg-orange-400"/>}<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><span className={`rounded px-2 py-1 text-[10px] ${direction === "OUT" ? "bg-orange-400/10 text-orange-300" : "bg-emerald-400/10 text-emerald-300"}`}>{direction}</span><div><div className="flex flex-wrap items-center gap-2"><div className="text-sm">{title}</div>{flagged && <span className="rounded-md border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-orange-300">{language === "zh" ? "重点证据" : "Flagged Evidence"}</span>}</div><div className="mt-1 font-mono text-[10px] text-slate-600">{shortenGlobal(hash)}</div></div></div><div className="text-[10px] text-slate-600">{time}</div></div>{flagged && <div className="mt-3 rounded-md bg-orange-400/[0.04] px-3 py-2 text-[10px] leading-5 text-orange-200/60">{language === "zh" ? "该交易被异常检测规则直接引用，建议优先核查。" : "This transaction is directly referenced by an anomaly rule and should be reviewed first."}</div>}</div>;
}
