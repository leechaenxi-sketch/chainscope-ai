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
  contractAddress?: string;
  gas?: string;
  gasUsed?: string;
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

  const [tokenTransfers, setTokenTransfers] =
    useState<TokenTransfer[]>([]);

  const [internalTransactions, setInternalTransactions] =
    useState<InternalTransaction[]>([]);

  const [anomalies, setAnomalies] =
    useState<Anomaly[]>([]);

  const [riskScore, setRiskScore] =
    useState<number | null>(null);

  const [aiReport, setAiReport] =
    useState("");

  async function startInvestigation() {
    if (!ethers.isAddress(address)) {
      setStatus("Please enter a valid Ethereum address.");
      return;
    }

    try {
      setLoading(true);
      setAiLoading(false);

      setTransactions([]);
      setTokenTransfers([]);
      setInternalTransactions([]);
      setAnomalies([]);
      setRiskScore(null);
      setAiReport("");

      setStatus("Fetching Ethereum balance...");

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

      setStatus("Fetching ETH transactions...");

      const txResponse = await fetch(
        `/api/transactions?address=${encodeURIComponent(address)}`
      );

      const txData =
        await txResponse.json();

      if (!txResponse.ok) {
        throw new Error(
          txData.error ||
            "Failed to retrieve ETH transactions"
        );
      }

      const txItems: Transaction[] =
        Array.isArray(txData.items)
          ? txData.items
          : [];

      setTransactions(txItems);

      setStatus("Fetching ERC-20 token transfers...");

      const tokenResponse = await fetch(
        `/api/tokentx?address=${encodeURIComponent(address)}`
      );

      const tokenData =
        await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(
          tokenData.error ||
            "Failed to retrieve token transfers"
        );
      }

      const tokenItems: TokenTransfer[] =
        Array.isArray(tokenData.items)
          ? tokenData.items
          : [];

      setTokenTransfers(tokenItems);

      setStatus("Fetching internal transactions...");

      const internalResponse = await fetch(
        `/api/internal-transactions?address=${encodeURIComponent(
          address
        )}`
      );

      const internalData =
        await internalResponse.json();

      if (!internalResponse.ok) {
        throw new Error(
          internalData.error ||
            "Failed to retrieve internal transactions"
        );
      }

      const internalItems: InternalTransaction[] =
        Array.isArray(internalData.items)
          ? internalData.items
          : [];

      setInternalTransactions(internalItems);

      setStatus(
        "Running multi-source anomaly detection..."
      );

      const ethAnomalies =
        detectEthAnomalies(
          txItems,
          address
        );

      const tokenAnomalies =
        detectTokenAnomalies(
          tokenItems,
          address
        );

      const internalAnomalies =
        detectInternalAnomalies(
          internalItems,
          address
        );

      const detected = [
        ...ethAnomalies,
        ...tokenAnomalies,
        ...internalAnomalies,
      ];

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
        txItems
          .slice(0, 20)
          .map((tx) => {
            const outgoing =
              tx.from?.toLowerCase() ===
              address.toLowerCase();

            return {
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              valueEth: formatEth(tx.value),
              time: formatTime(tx.timeStamp),
              direction: outgoing ? "OUT" : "IN",
              blockNumber: tx.blockNumber,
            };
          });

      const evidenceTokens =
        tokenItems
          .slice(0, 20)
          .map((tx) => {
            const outgoing =
              tx.from?.toLowerCase() ===
              address.toLowerCase();

            return {
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              direction: outgoing ? "OUT" : "IN",
              amount: formatTokenAmount(
                tx.value,
                tx.tokenDecimal
              ),
              symbol:
                tx.tokenSymbol || "TOKEN",
              tokenName:
                tx.tokenName || "Unknown Token",
              contractAddress:
                tx.contractAddress,
              time: formatTime(tx.timeStamp),
              blockNumber: tx.blockNumber,
            };
          });

      const evidenceInternal =
        internalItems
          .slice(0, 20)
          .map((tx) => {
            const outgoing =
              tx.from?.toLowerCase() ===
              address.toLowerCase();

            return {
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              direction: outgoing ? "OUT" : "IN",
              valueEth: formatEth(tx.value),
              type: tx.type || "unknown",
              time: formatTime(tx.timeStamp),
              blockNumber: tx.blockNumber,
              isError: tx.isError,
            };
          });

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
                balance: formattedBalance,
                riskScore: score,
                riskLevel,

                anomalies: detected,

                transactions:
                  evidenceTransactions,

                tokenTransfers:
                  evidenceTokens,

                internalTransactions:
                  evidenceInternal,

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
          `## AI 调查报告生成失败

确定性链上分析已经完成，但 DeepSeek 暂时无法生成调查报告。

你仍然可以查看下面的异常检测和三类链上证据。`
        );
      } finally {
        setAiLoading(false);
      }

      setStatus(
        `Analysis complete. ${txItems.length} ETH transactions, ${tokenItems.length} token transfers, ${internalItems.length} internal transactions and ${detected.length} anomalies analyzed.`
      );
    } catch (error) {
      console.error(error);

      setStatus(
        error instanceof Error
          ? error.message
          : "Investigation failed."
      );
    } finally {
      setLoading(false);
    }
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

    const parsed = txs
      .map((tx) => {
        let ethValue = 0;

        try {
          ethValue = Number(
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
          tx.ethValue >=
            0.1
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

      results.push({
        type:
          "Large ETH Transfer",

        severity:
          biggest.ethValue >=
          avgOutgoing * 8
            ? "HIGH"
            : "MEDIUM",

        description:
          `${biggest.ethValue.toFixed(
            4
          )} ETH transfer was significantly larger than the recent outgoing average of ${avgOutgoing.toFixed(
            4
          )} ETH.`,

        score:
          biggest.ethValue >=
          avgOutgoing * 8
            ? 18
            : 10,

        evidenceHash:
          biggest.hash,
      });
    }

    let max10m = 0;
    let evidence = "";

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
        evidence =
          parsed[i].hash;
      }
    }

    if (max10m >= 8) {
      results.push({
        type:
          "ETH Transaction Frequency Spike",

        severity:
          max10m >= 15
            ? "HIGH"
            : "MEDIUM",

        description:
          `${max10m} normal Ethereum transactions occurred within a 10-minute window.`,

        score:
          max10m >= 15
            ? 14
            : 8,

        evidenceHash:
          evidence,
      });
    }

    for (
      const received of incoming
    ) {
      let outgoingSoon = 0;
      let evidenceHash = "";

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

          if (!evidenceHash) {
            evidenceHash =
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
            "Rapid ETH Outflow",

          severity: "HIGH",

          description:
            `After receiving ${received.ethValue.toFixed(
              4
            )} ETH, approximately ${outgoingSoon.toFixed(
              4
            )} ETH was sent out within 30 minutes.`,

          score: 18,

          evidenceHash:
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
            Number(
              tx.timeStamp
            ),

          isOutgoing:
            tx.from
              ?.toLowerCase() ===
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

    for (
      const tx of outgoing
    ) {
      const key =
        tx.contractAddress
          ?.toLowerCase() ||
        tx.tokenSymbol;

      const group =
        byToken.get(key) ||
        [];

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
      if (
        group.length < 3
      ) {
        continue;
      }

      const average =
        group.reduce(
          (sum, tx) =>
            sum +
            tx.amount,
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
        results.push({
          type:
            "Large ERC-20 Transfer",

          severity:
            biggest.amount >=
            average * 8
              ? "HIGH"
              : "MEDIUM",

          description:
            `${biggest.amount.toLocaleString()} ${biggest.tokenSymbol} was significantly larger than the recent transfer average for this token.`,

          score:
            biggest.amount >=
            average * 8
              ? 16
              : 9,

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

      if (
        count >
        max10m
      ) {
        max10m =
          count;

        evidenceHash =
          parsed[i].hash;
      }
    }

    if (max10m >= 8) {
      results.push({
        type:
          "ERC-20 Activity Spike",

        severity:
          max10m >= 15
            ? "HIGH"
            : "MEDIUM",

        description:
          `${max10m} ERC-20 transfer events occurred within a 10-minute window.`,

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
              formatEth(
                tx.value
              )
            ),

          timestamp:
            Number(
              tx.timeStamp
            ),

          isOutgoing:
            tx.from
              ?.toLowerCase() ===
            target,

          isIncoming:
            tx.to
              ?.toLowerCase() ===
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
        results.push({
          type:
            "Large Internal ETH Transfer",

          severity:
            biggest.ethValue >=
            average * 8
              ? "HIGH"
              : "MEDIUM",

          description:
            `An internal transfer of ${biggest.ethValue.toFixed(
              4
            )} ETH was significantly larger than the recent internal outgoing average.`,

          score:
            biggest.ethValue >=
            average * 8
              ? 16
              : 9,

          evidenceHash:
            biggest.hash,
        });
      }
    }

    let max10m = 0;
    let evidence = "";

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
        max10m
      ) {
        max10m = count;
        evidence =
          parsed[i].hash;
      }
    }

    if (
      max10m >= 8
    ) {
      results.push({
        type:
          "Internal Transaction Activity Spike",

        severity:
          max10m >= 15
            ? "HIGH"
            : "MEDIUM",

        description:
          `${max10m} internal transactions occurred within a 10-minute window.`,

        score:
          max10m >= 15
            ? 14
            : 8,

        evidenceHash:
          evidence,
      });
    }

    for (
      const received of incoming
    ) {
      let sentSoon = 0;
      let evidenceHash = "";

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
          sentSoon +=
            sent.ethValue;

          if (!evidenceHash) {
            evidenceHash =
              sent.hash;
          }
        }
      }

      if (
        received.ethValue >=
          0.1 &&
        sentSoon >=
          received.ethValue *
            0.7
      ) {
        results.push({
          type:
            "Rapid Internal Fund Outflow",

          severity: "HIGH",

          description:
            `After receiving ${received.ethValue.toFixed(
              4
            )} ETH internally, approximately ${sentSoon.toFixed(
              4
            )} ETH was internally transferred out within 30 minutes.`,

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
        (sum, anomaly) =>
          sum +
          anomaly.score,
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
      Number(timestamp) *
        1000
    ).toLocaleString();
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

  function getRiskLevel(
    score: number | null
  ) {
    if (score === null) {
      return {
        label: "WAITING",
        className:
          "text-slate-500",
      };
    }

    if (score >= 80) {
      return {
        label: "CRITICAL",
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
        label: "MEDIUM",
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

  const risk =
    useMemo(
      () =>
        getRiskLevel(
          riskScore
        ),
      [riskScore]
    );

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">

        <header className="flex items-center justify-between">

          <div>
            <h1 className="text-2xl font-bold">
              ChainScope AI
            </h1>

            <p className="text-sm text-slate-400">
              Multi-source Ethereum anomaly investigation agent
            </p>
          </div>

          <div className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
            Ethereum Mainnet
          </div>

        </header>

        <section className="mt-20 text-center">

          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">
            Multi-source On-chain Intelligence
          </p>

          <h2 className="mt-4 text-5xl font-bold">
            Investigate Ethereum activity

            <span className="block text-cyan-400">
              with AI
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-400">
            Analyze ETH transactions, ERC-20 transfers and internal contract fund movements in one investigation.
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
              onClick={startInvestigation}
              disabled={loading}
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

        <section className="mt-16 grid gap-5 md:grid-cols-6">

          <MetricCard
            title="ETH Balance"
            value={balance}
            subtitle="ETH"
          />

          <MetricCard
            title="ETH Tx"
            value={
              transactions.length
                ? String(
                    transactions.length
                  )
                : "--"
            }
            subtitle="Normal tx"
          />

          <MetricCard
            title="ERC-20"
            value={
              tokenTransfers.length
                ? String(
                    tokenTransfers.length
                  )
                : "--"
            }
            subtitle="Token transfers"
          />

          <MetricCard
            title="Internal"
            value={
              internalTransactions.length
                ? String(
                    internalTransactions.length
                  )
                : "--"
            }
            subtitle="Internal tx"
          />

          <MetricCard
            title="Anomalies"
            value={
              transactions.length ||
              tokenTransfers.length ||
              internalTransactions.length
                ? String(
                    anomalies.length
                  )
                : "--"
            }
            subtitle="Signals"
          />

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">

            <div className="text-sm text-slate-400">
              Risk Score
            </div>

            <div className="mt-5">

              <div className="text-4xl font-bold text-cyan-400">
                {riskScore ??
                  "--"}
              </div>

              {riskScore !==
                null && (
                <div
                  className={`mt-1 text-sm font-semibold ${risk.className}`}
                >
                  {risk.label}
                </div>
              )}

            </div>

          </div>

        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">

          <h3 className="text-xl font-semibold">
            人工智能调查报告
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            DeepSeek 基于 ETH、ERC-20、Internal Transactions 与异常检测证据生成。
          </p>

          <div className="mt-6 rounded-xl border border-slate-800 bg-[#0b1627] p-7">

            {aiLoading ? (
              <div className="text-cyan-400">
                DeepSeek 正在进行多来源证据调查...
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
                      <h2 className="mb-4 mt-10 border-b border-slate-800 pb-3 text-2xl font-bold first:mt-0">
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
                      <strong className="text-white">
                        {children}
                      </strong>
                    ),

                    ul: ({
                      children,
                    }) => (
                      <ul className="my-4 list-disc space-y-2 pl-6">
                        {children}
                      </ul>
                    ),

                    ol: ({
                      children,
                    }) => (
                      <ol className="my-4 list-decimal space-y-3 pl-6">
                        {children}
                      </ol>
                    ),

                    li: ({
                      children,
                    }) => (
                      <li className="leading-7 text-slate-300">
                        {children}
                      </li>
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
                        <table className="w-full border-collapse text-sm">
                          {children}
                        </table>
                      </div>
                    ),

                    th: ({
                      children,
                    }) => (
                      <th className="border border-slate-700 bg-slate-800 px-4 py-3 text-left">
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
                Run an investigation to generate the report.
              </div>
            )}

          </div>

        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">

          <h3 className="text-xl font-semibold">
            Anomaly Detection
          </h3>

          <div className="mt-6 space-y-4">

            {!anomalies.length ? (
              <div className="py-8 text-center text-slate-500">
                No anomaly data loaded yet.
              </div>
            ) : (
              anomalies.map(
                (
                  anomaly,
                  index
                ) => (
                  <div
                    key={`${anomaly.type}-${index}`}
                    className="rounded-xl border border-slate-800 bg-[#0b1627] p-5"
                  >

                    <div className="flex justify-between">

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

                    <p className="mt-3 leading-7 text-slate-400">
                      {anomaly.description}
                    </p>

                    <div className="mt-3 text-xs text-slate-500">
                      Risk contribution: +{anomaly.score}
                    </div>

                    {anomaly.evidenceHash && (
                      <div className="mt-2 font-mono text-xs text-slate-500">
                        Evidence: {shorten(anomaly.evidenceHash)}
                      </div>
                    )}

                  </div>
                )
              )
            )}

          </div>

        </section>

        <EvidenceSection
          title="Internal Transactions"
          subtitle="ETH movements generated inside smart contract execution."
        >
          {internalTransactions.length ===
          0 ? (
            <EmptyText text="No internal transactions loaded." />
          ) : (
            internalTransactions
              .slice(0, 30)
              .map((tx, index) => {
                const outgoing =
                  tx.from
                    ?.toLowerCase() ===
                  address.toLowerCase();

                return (
                  <EvidenceCard
                    key={`${tx.hash}-${index}`}
                    direction={
                      outgoing
                        ? "OUT"
                        : "IN"
                    }
                    title={`${formatEth(
                      tx.value
                    )} ETH`}
                    subtitle={`Internal type: ${
                      tx.type ||
                      "unknown"
                    }`}
                    time={formatTime(
                      tx.timeStamp
                    )}
                    fields={[
                      [
                        "Tx Hash",
                        shorten(
                          tx.hash
                        ),
                      ],
                      [
                        "From",
                        shorten(
                          tx.from
                        ),
                      ],
                      [
                        "To",
                        shorten(
                          tx.to
                        ),
                      ],
                      [
                        "Block",
                        tx.blockNumber,
                      ],
                    ]}
                  />
                );
              })
          )}
        </EvidenceSection>

        <EvidenceSection
          title="ERC-20 Token Transfers"
          subtitle="Recent token movements associated with this address."
        >
          {tokenTransfers.length ===
          0 ? (
            <EmptyText text="No token transfers loaded." />
          ) : (
            tokenTransfers
              .slice(0, 30)
              .map((tx, index) => {
                const outgoing =
                  tx.from
                    ?.toLowerCase() ===
                  address.toLowerCase();

                return (
                  <EvidenceCard
                    key={`${tx.hash}-${index}`}
                    direction={
                      outgoing
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
                    time={formatTime(
                      tx.timeStamp
                    )}
                    fields={[
                      [
                        "Tx Hash",
                        shorten(
                          tx.hash
                        ),
                      ],
                      [
                        "From",
                        shorten(
                          tx.from
                        ),
                      ],
                      [
                        "To",
                        shorten(
                          tx.to
                        ),
                      ],
                    ]}
                  />
                );
              })
          )}
        </EvidenceSection>

        <EvidenceSection
          title="ETH Transactions"
          subtitle="Recent normal Ethereum transactions."
        >
          {transactions.length ===
          0 ? (
            <EmptyText text="No ETH transactions loaded." />
          ) : (
            transactions
              .slice(0, 30)
              .map((tx) => {
                const outgoing =
                  tx.from
                    ?.toLowerCase() ===
                  address.toLowerCase();

                return (
                  <EvidenceCard
                    key={tx.hash}
                    direction={
                      outgoing
                        ? "OUT"
                        : "IN"
                    }
                    title={`${formatEth(
                      tx.value
                    )} ETH`}
                    subtitle={`Block #${tx.blockNumber}`}
                    time={formatTime(
                      tx.timeStamp
                    )}
                    fields={[
                      [
                        "Tx Hash",
                        shorten(
                          tx.hash
                        ),
                      ],
                      [
                        "From",
                        shorten(
                          tx.from
                        ),
                      ],
                      [
                        "To",
                        shorten(
                          tx.to
                        ),
                      ],
                    ]}
                  />
                );
              })
          )}
        </EvidenceSection>

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

      <div className="mt-2 text-xs text-slate-500">
        {subtitle}
      </div>

    </div>
  );
}

function EvidenceSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children:
    React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">

      <h3 className="text-xl font-semibold">
        {title}
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {subtitle}
      </p>

      <div className="mt-6 space-y-4">
        {children}
      </div>

    </section>
  );
}

function EvidenceCard({
  direction,
  title,
  subtitle,
  time,
  fields,
}: {
  direction:
    | "IN"
    | "OUT";
  title: string;
  subtitle: string;
  time: string;
  fields: [
    string,
    string
  ][];
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0b1627] p-5">

      <div className="flex flex-col justify-between gap-4 md:flex-row">

        <div className="flex items-center gap-4">

          <div
            className={
              direction ===
              "OUT"
                ? "rounded-lg bg-orange-500/10 px-3 py-2 text-orange-400"
                : "rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-400"
            }
          >
            {direction}
          </div>

          <div>

            <div className="font-semibold">
              {title}
            </div>

            <div className="text-sm text-slate-500">
              {subtitle}
            </div>

          </div>

        </div>

        <div className="text-sm text-slate-500">
          {time}
        </div>

      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">

        {fields.map(
          (
            [label, value]
          ) => (
            <div key={label}>

              <div className="text-xs uppercase tracking-wider text-slate-600">
                {label}
              </div>

              <div className="mt-1 font-mono text-sm text-slate-300">
                {value}
              </div>

            </div>
          )
        )}

      </div>

    </div>
  );
}

function EmptyText({
  text,
}: {
  text: string;
}) {
  return (
    <div className="py-8 text-center text-slate-500">
      {text}
    </div>
  );
}