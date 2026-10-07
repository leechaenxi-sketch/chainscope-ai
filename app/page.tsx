"use client";

import { useMemo, useState } from "react";
import { ethers } from "ethers";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Transaction = {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timeStamp: string;
  isError?: string;
  gas?: string;
  gasUsed?: string;
  gasPrice?: string;
};

type Anomaly = {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  score: number;
  evidenceHash?: string;
};

export default function Home() {
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState("--");
  const [status, setStatus] = useState("Waiting for analysis");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [anomalies, setAnomalies] =
    useState<Anomaly[]>([]);

  const [riskScore, setRiskScore] =
    useState<number | null>(null);

  const [aiReport, setAiReport] =
    useState("");

  async function startInvestigation() {
    if (!ethers.isAddress(address)) {
      setStatus("Please enter a valid Ethereum address.");
      setBalance("--");
      setTransactions([]);
      setAnomalies([]);
      setRiskScore(null);
      setAiReport("");
      return;
    }

    try {
      setLoading(true);
      setAiLoading(false);
      setAiReport("");

      setStatus("Fetching Ethereum data...");

      setTransactions([]);
      setAnomalies([]);
      setRiskScore(null);

      const provider =
        new ethers.JsonRpcProvider(
          "https://ethereum-rpc.publicnode.com"
        );

      const balanceWei =
        await provider.getBalance(address);

      const balanceEth =
        ethers.formatEther(balanceWei);

      const formattedBalance =
        Number(balanceEth).toFixed(4);

      setBalance(formattedBalance);

      setStatus(
        "Fetching recent transactions..."
      );

      const response = await fetch(
        `/api/transactions?address=${encodeURIComponent(
          address
        )}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to retrieve transactions"
        );
      }

      const items: Transaction[] =
        Array.isArray(data.items)
          ? data.items
          : [];

      setTransactions(items);

      setStatus(
        "Detecting abnormal behavior..."
      );

      const detected =
        detectAnomalies(
          items,
          address
        );

      setAnomalies(detected);

      const score =
        calculateRiskScore(detected);

      setRiskScore(score);

      const riskLevel =
        getRiskLevel(score).label;

      setStatus(
        "Generating AI investigation report..."
      );

      setAiLoading(true);

      const evidenceTransactions =
        items
          .slice(0, 20)
          .map((tx) => {
            const outgoing =
              tx.from?.toLowerCase() ===
              address.toLowerCase();

            return {
              hash: tx.hash,
              from: tx.from,
              to: tx.to,

              valueEth:
                formatEth(
                  tx.value
                ),

              time:
                formatTime(
                  tx.timeStamp
                ),

              direction:
                outgoing
                  ? "OUT"
                  : "IN",

              blockNumber:
                tx.blockNumber,
            };
          });

      try {
        const aiResponse = await fetch(
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

              anomalies:
                detected,

              transactions:
                evidenceTransactions,

              analyzedTransactionCount:
                items.length,

              evidenceTransactionCount:
                evidenceTransactions.length,
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
      } catch (aiError) {
        console.error(aiError);

        setAiReport(
          `## AI 调查报告生成失败

确定性链上分析已经完成，但 DeepSeek 调查报告暂时无法生成。

你仍然可以查看下面的异常检测结果和交易证据。`
        );
      } finally {
        setAiLoading(false);
      }

      setStatus(
        `Analysis complete. Retrieved ${items.length} transactions and detected ${detected.length} anomalies.`
      );
    } catch (error) {
      console.error(error);

      setStatus(
        error instanceof Error
          ? error.message
          : "Failed to retrieve Ethereum data."
      );
    } finally {
      setLoading(false);
    }
  }

  function detectAnomalies(
    txs: Transaction[],
    targetAddress: string
  ): Anomaly[] {
    const results: Anomaly[] = [];

    if (txs.length === 0) {
      return results;
    }

    const target =
      targetAddress.toLowerCase();

    const parsed = txs
      .map((tx) => {
        let ethValue = 0;
        let feeEth = 0;

        try {
          ethValue = Number(
            ethers.formatEther(
              tx.value || "0"
            )
          );
        } catch {
          ethValue = 0;
        }

        try {
          const gasUsed =
            BigInt(
              tx.gasUsed || "0"
            );

          const gasPrice =
            BigInt(
              tx.gasPrice || "0"
            );

          feeEth = Number(
            ethers.formatEther(
              gasUsed * gasPrice
            )
          );
        } catch {
          feeEth = 0;
        }

        return {
          ...tx,
          ethValue,
          feeEth,

          timestamp:
            Number(
              tx.timeStamp
            ),

          fromLower:
            tx.from?.toLowerCase() ||
            "",

          toLower:
            tx.to?.toLowerCase() ||
            "",

          isOutgoing:
            tx.from?.toLowerCase() ===
            target,

          isIncoming:
            tx.to?.toLowerCase() ===
            target,

          failed:
            tx.isError === "1",
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

    const outgoingValues =
      outgoing.map(
        (tx) =>
          tx.ethValue
      );

    const avgOutgoing =
      outgoingValues.length > 0
        ? outgoingValues.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
          outgoingValues.length
        : 0;

    // 1. 单笔大额交易

    const largeTransfers =
      outgoing.filter((tx) => {
        if (
          avgOutgoing <= 0
        ) {
          return false;
        }

        return (
          tx.ethValue >=
            avgOutgoing * 3 &&
          tx.ethValue >= 0.1
        );
      });

    if (
      largeTransfers.length >
      0
    ) {
      const largestTx =
        largeTransfers.reduce(
          (max, tx) =>
            tx.ethValue >
            max.ethValue
              ? tx
              : max,
          largeTransfers[0]
        );

      const high =
        largestTx.ethValue >=
        avgOutgoing * 8;

      results.push({
        type:
          "Large Transfer",

        severity: high
          ? "HIGH"
          : "MEDIUM",

        description:
          `${largeTransfers.length} unusually large outgoing transaction(s) detected. ` +
          `Largest transfer: ${largestTx.ethValue.toFixed(
            4
          )} ETH. ` +
          `Recent outgoing average: ${avgOutgoing.toFixed(
            4
          )} ETH.`,

        score:
          high ? 20 : 12,

        evidenceHash:
          largestTx.hash,
      });
    }

    // 2. 一小时累计转出激增

    let maxHourlyOutflow = 0;
    let hourlyEvidence = "";

    for (
      let i = 0;
      i < outgoing.length;
      i++
    ) {
      let total = 0;

      for (
        let j = i;
        j < outgoing.length;
        j++
      ) {
        if (
          outgoing[j]
            .timestamp -
            outgoing[i]
              .timestamp <=
          3600
        ) {
          total +=
            outgoing[j]
              .ethValue;
        } else {
          break;
        }
      }

      if (
        total >
        maxHourlyOutflow
      ) {
        maxHourlyOutflow =
          total;

        hourlyEvidence =
          outgoing[i].hash;
      }
    }

    if (
      avgOutgoing > 0 &&
      maxHourlyOutflow >=
        avgOutgoing * 5
    ) {
      results.push({
        type:
          "Outflow Surge",

        severity: "HIGH",

        description:
          `A 1-hour window contained ${maxHourlyOutflow.toFixed(
            4
          )} ETH of outgoing transfers, far above the recent average transaction size.`,

        score: 18,

        evidenceHash:
          hourlyEvidence,
      });
    }

    // 3. 交易频率突增

    let maxTx10m = 0;
    let frequencyEvidence = "";

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
        maxTx10m
      ) {
        maxTx10m = count;
        frequencyEvidence =
          parsed[i].hash;
      }
    }

    if (
      maxTx10m >= 8
    ) {
      const high =
        maxTx10m >= 15;

      results.push({
        type:
          "Transaction Frequency Spike",

        severity: high
          ? "HIGH"
          : "MEDIUM",

        description:
          `Detected up to ${maxTx10m} transactions within a 10-minute window.`,

        score:
          high ? 16 : 10,

        evidenceHash:
          frequencyEvidence,
      });
    }

    // 4. 新收款方大额转账

    const seenRecipients =
      new Set<string>();

    for (
      const tx of outgoing
    ) {
      if (!tx.toLower) {
        continue;
      }

      const newRecipient =
        !seenRecipients.has(
          tx.toLower
        );

      const large =
        avgOutgoing > 0 &&
        tx.ethValue >=
          avgOutgoing * 3 &&
        tx.ethValue >= 0.1;

      if (
        newRecipient &&
        large
      ) {
        results.push({
          type:
            "Large Transfer to New Recipient",

          severity: "HIGH",

          description:
            `A large transfer of ${tx.ethValue.toFixed(
              4
            )} ETH was sent to a recipient not previously observed in this transaction sample.`,

          score: 16,

          evidenceHash:
            tx.hash,
        });

        break;
      }

      seenRecipients.add(
        tx.toLower
      );
    }

    // 5. 资金流集中

    const recipientTotals =
      new Map<
        string,
        number
      >();

    let totalOutgoing = 0;

    for (
      const tx of outgoing
    ) {
      if (!tx.toLower) {
        continue;
      }

      totalOutgoing +=
        tx.ethValue;

      recipientTotals.set(
        tx.toLower,
        (recipientTotals.get(
          tx.toLower
        ) || 0) +
          tx.ethValue
      );
    }

    let largestRecipient =
      "";

    let largestTotal = 0;

    for (
      const [
        recipient,
        amount,
      ] of recipientTotals
    ) {
      if (
        amount >
        largestTotal
      ) {
        largestTotal =
          amount;

        largestRecipient =
          recipient;
      }
    }

    const concentration =
      totalOutgoing > 0
        ? largestTotal /
          totalOutgoing
        : 0;

    if (
      totalOutgoing > 0 &&
      concentration >= 0.7
    ) {
      results.push({
        type:
          "Fund Flow Concentration",

        severity: "MEDIUM",

        description:
          `${(
            concentration * 100
          ).toFixed(
            1
          )}% of recent outgoing ETH was sent to a single recipient (${shorten(
            largestRecipient
          )}).`,

        score: 10,
      });
    }

    // 6. 短时间大量收款方

    let maxRecipients = 0;
    let recipientEvidence = "";

    for (
      let i = 0;
      i < outgoing.length;
      i++
    ) {
      const recipients =
        new Set<string>();

      for (
        let j = i;
        j < outgoing.length;
        j++
      ) {
        if (
          outgoing[j]
            .timestamp -
            outgoing[i]
              .timestamp <=
          3600
        ) {
          if (
            outgoing[j]
              .toLower
          ) {
            recipients.add(
              outgoing[j]
                .toLower
            );
          }
        } else {
          break;
        }
      }

      if (
        recipients.size >
        maxRecipients
      ) {
        maxRecipients =
          recipients.size;

        recipientEvidence =
          outgoing[i].hash;
      }
    }

    if (
      maxRecipients >= 10
    ) {
      const high =
        maxRecipients >= 20;

      results.push({
        type:
          "Mass Recipient Distribution",

        severity: high
          ? "HIGH"
          : "MEDIUM",

        description:
          `Funds were sent to ${maxRecipients} different recipient addresses within a 1-hour window.`,

        score:
          high ? 16 : 10,

        evidenceHash:
          recipientEvidence,
      });
    }

    // 7. 长期不活跃后突然转出

    for (
      let i = 1;
      i < parsed.length;
      i++
    ) {
      const previous =
        parsed[i - 1];

      const current =
        parsed[i];

      const days =
        (current.timestamp -
          previous.timestamp) /
        86400;

      if (
        days >= 30 &&
        current.isOutgoing &&
        current.ethValue >=
          Math.max(
            avgOutgoing * 3,
            0.1
          )
      ) {
        results.push({
          type:
            "Dormant Wallet Reactivation",

          severity: "HIGH",

          description:
            `The address was inactive for approximately ${days.toFixed(
              0
            )} days before sending ${current.ethValue.toFixed(
              4
            )} ETH.`,

          score: 18,

          evidenceHash:
            current.hash,
        });

        break;
      }
    }

    // 8. 收款后快速转出

    for (
      const received of incoming
    ) {
      let outgoingSoon = 0;
      let evidence = "";

      for (
        const sent of outgoing
      ) {
        const delay =
          sent.timestamp -
          received.timestamp;

        if (
          delay >= 0 &&
          delay <= 1800
        ) {
          outgoingSoon +=
            sent.ethValue;

          if (!evidence) {
            evidence =
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
            "Rapid Fund Outflow",

          severity: "HIGH",

          description:
            `After receiving ${received.ethValue.toFixed(
              4
            )} ETH, approximately ${outgoingSoon.toFixed(
              4
            )} ETH was sent out within 30 minutes.`,

          score: 20,

          evidenceHash:
            evidence ||
            received.hash,
        });

        break;
      }
    }

    // 9A. 失败交易比例异常

    const failed =
      parsed.filter(
        (tx) =>
          tx.failed
      );

    const failureRate =
      parsed.length > 0
        ? failed.length /
          parsed.length
        : 0;

    if (
      parsed.length >= 5 &&
      failureRate >= 0.2
    ) {
      const high =
        failureRate >= 0.4;

      results.push({
        type:
          "High Transaction Failure Rate",

        severity: high
          ? "HIGH"
          : "MEDIUM",

        description:
          `${failed.length} of ${parsed.length} recent transactions failed (${(
            failureRate * 100
          ).toFixed(
            1
          )}% failure rate).`,

        score:
          high ? 14 : 8,

        evidenceHash:
          failed[0]?.hash,
      });
    }

    // 9B. 手续费异常

    const feeTxs =
      parsed.filter(
        (tx) =>
          tx.feeEth > 0
      );

    if (
      feeTxs.length >= 3
    ) {
      const avgFee =
        feeTxs.reduce(
          (sum, tx) =>
            sum +
            tx.feeEth,
          0
        ) /
        feeTxs.length;

      const highest =
        feeTxs.reduce(
          (max, tx) =>
            tx.feeEth >
            max.feeEth
              ? tx
              : max,
          feeTxs[0]
        );

      if (
        avgFee > 0 &&
        highest.feeEth >=
          avgFee * 3
      ) {
        results.push({
          type:
            "Abnormal Transaction Fee",

          severity: "MEDIUM",

          description:
            `A transaction fee of ${highest.feeEth.toFixed(
              6
            )} ETH was significantly higher than the recent average fee of ${avgFee.toFixed(
              6
            )} ETH.`,

          score: 8,

          evidenceHash:
            highest.hash,
        });
      }
    }

    return results;
  }

  function calculateRiskScore(
    items: Anomaly[]
  ) {
    const total =
      items.reduce(
        (
          sum,
          anomaly
        ) =>
          sum +
          anomaly.score,
        0
      );

    return Math.min(
      total,
      100
    );
  }

  function shorten(
    value: string
  ) {
    if (!value) {
      return "N/A";
    }

    if (
      value.length <= 16
    ) {
      return value;
    }

    return `${value.slice(
      0,
      8
    )}...${value.slice(
      -6
    )}`;
  }

  function formatEth(
    value: string
  ) {
    try {
      return Number(
        ethers.formatEther(
          value
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
      Number(timestamp) *
        1000
    ).toLocaleString();
  }

  function getRiskLevel(
    score: number | null
  ) {
    if (
      score === null
    ) {
      return {
        label: "WAITING",
        className:
          "text-slate-500",
      };
    }

    if (score >= 80) {
      return {
        label:
          "CRITICAL",
        className:
          "text-red-500",
      };
    }

    if (score >= 60) {
      return {
        label: "HIGH",
        className:
          "text-orange-400",
      };
    }

    if (score >= 30) {
      return {
        label:
          "MEDIUM",
        className:
          "text-yellow-400",
      };
    }

    return {
      label: "LOW",
      className:
        "text-emerald-400",
    };
  }

  const risk = useMemo(
    () =>
      getRiskLevel(
        riskScore
      ),
    [riskScore]
  );

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">

        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              ChainScope AI
            </h1>

            <p className="text-sm text-slate-400">
              AI-powered Ethereum anomaly investigation agent
            </p>
          </div>

          <div className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
            Ethereum Mainnet
          </div>
        </header>

        <section className="mt-24 text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.3em] text-cyan-400">
            On-chain Intelligence
          </p>

          <h2 className="text-5xl font-bold">
            Investigate Ethereum activity

            <span className="block text-cyan-400">
              with AI
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Analyze wallet behavior, detect abnormal fund movements and generate an evidence-based investigation report.
          </p>

          <div className="mx-auto mt-10 flex max-w-3xl gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-3">

            <input
              value={address}
              onChange={(e) =>
                setAddress(
                  e.target.value
                )
              }
              placeholder="Enter Ethereum address: 0x..."
              className="flex-1 bg-transparent px-4 py-4 outline-none"
            />

            <button
              onClick={
                startInvestigation
              }
              disabled={
                loading
              }
              className="rounded-xl bg-cyan-400 px-7 py-4 font-semibold text-slate-950 disabled:opacity-50"
            >
              {loading
                ? "Investigating..."
                : "Start Investigation"}
            </button>
          </div>

          <p className="mt-4 text-sm text-slate-400">
            {status}
          </p>
        </section>

        <section className="mt-20 grid gap-5 md:grid-cols-4">

          <MetricCard
            title="ETH Balance"
            value={balance}
            subtitle="ETH"
          />

          <MetricCard
            title="Transactions"
            value={
              transactions.length
                ? String(
                    transactions.length
                  )
                : "--"
            }
            subtitle="Transactions analyzed"
          />

          <MetricCard
            title="Anomalies"
            value={
              transactions.length
                ? String(
                    anomalies.length
                  )
                : "--"
            }
            subtitle="Suspicious patterns"
          />

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">

            <div className="text-sm text-slate-400">
              Risk Score
            </div>

            <div className="mt-5 flex items-end gap-3">

              <div className="text-4xl font-bold text-cyan-400">
                {riskScore ??
                  "--"}
              </div>

              {riskScore !==
                null && (
                <div
                  className={`pb-1 text-sm font-semibold ${risk.className}`}
                >
                  {risk.label}
                </div>
              )}
            </div>

            <div className="mt-2 text-sm text-slate-500">
              Experimental heuristic score
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">

          <div>
            <h3 className="text-xl font-semibold">
              人工智能调查报告
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              DeepSeek 基于确定性链上分析结果和真实交易证据生成。
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-slate-800 bg-[#0b1627] p-7">

            {aiLoading ? (
              <div className="flex items-center gap-3 text-cyan-400">
                <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                DeepSeek 正在分析链上证据...
              </div>
            ) : aiReport ? (
              <article className="max-w-none text-slate-300">

                <ReactMarkdown
                  remarkPlugins={[
                    remarkGfm,
                  ]}
                  components={{
                    h2: ({
                      children,
                    }) => (
                      <h2 className="mb-4 mt-10 border-b border-slate-800 pb-3 text-2xl font-bold text-white first:mt-0">
                        {children}
                      </h2>
                    ),

                    h3: ({
                      children,
                    }) => (
                      <h3 className="mb-3 mt-7 text-lg font-semibold text-cyan-300">
                        {children}
                      </h3>
                    ),

                    p: ({
                      children,
                    }) => (
                      <p className="my-4 leading-8 text-slate-300">
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
                      <ul className="my-4 list-disc space-y-2 pl-6 text-slate-300">
                        {children}
                      </ul>
                    ),

                    ol: ({
                      children,
                    }) => (
                      <ol className="my-4 list-decimal space-y-4 pl-6 text-slate-300">
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
                      <blockquote className="my-6 border-l-4 border-cyan-400 bg-cyan-400/5 px-5 py-3 text-slate-300">
                        {children}
                      </blockquote>
                    ),

                    code: ({
                      children,
                    }) => (
                      <code className="rounded bg-slate-800 px-2 py-1 font-mono text-sm text-cyan-300">
                        {children}
                      </code>
                    ),

                    table: ({
                      children,
                    }) => (
                      <div className="my-6 overflow-x-auto">
                        <table className="w-full border-collapse overflow-hidden rounded-xl border border-slate-800 text-left text-sm">
                          {children}
                        </table>
                      </div>
                    ),

                    thead: ({
                      children,
                    }) => (
                      <thead className="bg-slate-800/80 text-slate-200">
                        {children}
                      </thead>
                    ),

                    th: ({
                      children,
                    }) => (
                      <th className="border border-slate-700 px-4 py-3 font-semibold">
                        {children}
                      </th>
                    ),

                    td: ({
                      children,
                    }) => (
                      <td className="border border-slate-800 px-4 py-3 align-top text-slate-300">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {aiReport}
                </ReactMarkdown>

              </article>
            ) : (
              <div className="py-10 text-center text-slate-500">
                运行调查后，这里将生成 AI 调查报告。
              </div>
            )}

          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">

          <h3 className="text-xl font-semibold">
            Anomaly Detection
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Explainable heuristic analysis of recent Ethereum activity.
          </p>

          <div className="mt-6">

            {transactions.length ===
            0 ? (
              <div className="py-10 text-center text-slate-500">
                No analysis yet.
              </div>
            ) : anomalies.length ===
              0 ? (
              <div className="rounded-xl border border-emerald-900/40 bg-emerald-500/5 p-5 text-emerald-400">
                No major anomalies detected.
              </div>
            ) : (
              <div className="space-y-4">

                {anomalies.map(
                  (
                    anomaly,
                    index
                  ) => (
                    <div
                      key={`${anomaly.type}-${index}`}
                      className="rounded-xl border border-slate-800 bg-[#0b1627] p-5"
                    >

                      <div className="flex justify-between gap-4">

                        <div className="font-semibold">
                          {anomaly.type}
                        </div>

                        <div
                          className={
                            anomaly.severity ===
                            "HIGH"
                              ? "text-red-400"
                              : anomaly.severity ===
                                "MEDIUM"
                              ? "text-yellow-400"
                              : "text-emerald-400"
                          }
                        >
                          {anomaly.severity}
                        </div>
                      </div>

                      <p className="mt-3 text-slate-400">
                        {
                          anomaly.description
                        }
                      </p>

                      <div className="mt-3 text-xs text-slate-500">
                        Risk contribution: +
                        {
                          anomaly.score
                        }
                      </div>

                      {anomaly.evidenceHash && (
                        <div className="mt-2 font-mono text-xs text-slate-500">
                          Evidence:{" "}
                          {shorten(
                            anomaly.evidenceHash
                          )}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">

          <h3 className="text-xl font-semibold">
            Recent Transactions
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Recent Ethereum activity used by the investigation engine.
          </p>

          <div className="mt-6 space-y-4">

            {transactions.map(
              (tx) => {
                const outgoing =
                  tx.from?.toLowerCase() ===
                  address.toLowerCase();

                return (
                  <div
                    key={
                      tx.hash
                    }
                    className="rounded-xl border border-slate-800 bg-[#0b1627] p-5"
                  >

                    <div className="flex flex-col justify-between gap-4 md:flex-row">

                      <div className="flex items-center gap-4">

                        <div
                          className={
                            outgoing
                              ? "rounded-lg bg-orange-500/10 px-3 py-2 text-orange-400"
                              : "rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-400"
                          }
                        >
                          {outgoing
                            ? "OUT"
                            : "IN"}
                        </div>

                        <div>

                          <div className="font-semibold">
                            {formatEth(
                              tx.value
                            )}{" "}
                            ETH
                          </div>

                          <div className="text-sm text-slate-500">
                            {formatTime(
                              tx.timeStamp
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm text-slate-400">
                        Block #
                        {
                          tx.blockNumber
                        }
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-3">

                      <Info
                        label="Tx Hash"
                        value={shorten(
                          tx.hash
                        )}
                      />

                      <Info
                        label="From"
                        value={shorten(
                          tx.from
                        )}
                      />

                      <Info
                        label="To"
                        value={shorten(
                          tx.to
                        )}
                      />

                    </div>
                  </div>
                );
              }
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">

      <div className="text-sm text-slate-400">
        {title}
      </div>

      <div className="mt-5 text-3xl font-bold">
        {value}
      </div>

      <div className="mt-2 text-sm text-slate-500">
        {subtitle}
      </div>

    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>

      <div className="text-xs uppercase tracking-wider text-slate-600">
        {label}
      </div>

      <div className="mt-1 font-mono text-sm text-slate-300">
        {value}
      </div>

    </div>
  );
}