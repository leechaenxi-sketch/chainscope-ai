import type {
  AddressContext,
  ChangeAnalysis,
  Counterparty,
} from "./types";

export function applySimpleCauseVerification(
  analysis: ChangeAnalysis,
  contexts: AddressContext[],
  counterparties: Counterparty[]
): ChangeAnalysis {
  const contextMap = new Map(
    contexts.map((item) => [
      item.address.toLowerCase(),
      item,
    ])
  );

  const topFive = counterparties.slice(0, 5);

  const topContexts = topFive
    .map((item) =>
      contextMap.get(item.address.toLowerCase())
    )
    .filter(
      (item): item is AddressContext =>
        Boolean(item)
    );

  const contracts = topContexts.filter(
    (item) => item.isContract
  );

  const verifiedContracts =
    contracts.filter(
      (item) => item.sourceVerified
    );

  const causes = analysis.causes.map(
    (cause) => {
      if (
        cause.id ===
        "automated_contract_activity"
      ) {
        if (
          verifiedContracts.length > 0
        ) {
          const named =
            verifiedContracts.find(
              (item) =>
                item.contractName
            );

          return {
            ...cause,
            verification: {
              status:
                "SUPPORTED" as const,

              evidenceZh: [
                `前 5 个主要对手方中发现 ${contracts.length} 个合约地址。`,
                `其中 ${verifiedContracts.length} 个存在已验证源码。`,
                named?.contractName
                  ? `已验证合约名称：${named.contractName}。`
                  : "已验证合约存在，但没有足够信息确认具体协议。",
                "这些新增证据与“合约驱动活动增加”的假设方向一致，但不能证明具体业务目的。",
              ],

              evidenceEn: [
                `${contracts.length} of the top 5 counterparties are contract addresses.`,
                `${verifiedContracts.length} have verified source code.`,
                named?.contractName
                  ? `Verified contract name: ${named.contractName}.`
                  : "Verified contract code exists, but protocol attribution remains unavailable.",
                "This additional evidence is directionally consistent with increased contract-driven activity, but does not prove a specific business purpose.",
              ],
            },
          };
        }

        if (
          contracts.length > 0
        ) {
          return {
            ...cause,
            verification: {
              status:
                "PARTIAL" as const,

              evidenceZh: [
                `前 5 个主要对手方中发现 ${contracts.length} 个合约地址。`,
                "但没有取得已验证源码或明确合约名称。",
                "因此只能部分支持“合约活动增加”的解释。",
              ],

              evidenceEn: [
                `${contracts.length} of the top 5 counterparties are contract addresses.`,
                "No verified source code or clear contract name was obtained.",
                "This only partially supports increased contract activity.",
              ],
            },
          };
        }

        return {
          ...cause,
          verification: {
            status:
              "UNRESOLVED" as const,

            evidenceZh: [
              "当前主要对手方样本中没有识别到明确合约地址。",
              "现有地址上下文不能进一步验证该原因。",
            ],

            evidenceEn: [
              "No clear contract address was identified among the sampled major counterparties.",
              "Current address context does not further validate this cause.",
            ],
          },
        };
      }

      if (
        cause.id ===
        "fund_consolidation"
      ) {
        const largestReceiver =
          [...counterparties]
            .filter(
              (item) =>
                item.ethOut > 0
            )
            .sort(
              (a, b) =>
                b.ethOut -
                a.ethOut
            )[0];

        if (largestReceiver) {
          const context =
            contextMap.get(
              largestReceiver.address.toLowerCase()
            );

          if (
            context &&
            !context.isContract
          ) {
            return {
              ...cause,
              verification: {
                status:
                  "PARTIAL" as const,

                evidenceZh: [
                  `最大 ETH 转出对手方 ${shorten(
                    largestReceiver.address
                  )} 未检测到合约代码。`,
                  "这与资金归集到普通账户或钱包迁移的模式方向一致。",
                  "但 EOA 状态不能证明两个地址属于同一实体。",
                ],

                evidenceEn: [
                  `The largest ETH-out counterparty ${shorten(
                    largestReceiver.address
                  )} has no detected contract bytecode.`,
                  "This is directionally consistent with consolidation into a normal account or wallet migration.",
                  "EOA status does not prove common ownership.",
                ],
              },
            };
          }
        }

        return {
          ...cause,
          verification: {
            status:
              "UNRESOLVED" as const,

            evidenceZh: [
              "当前地址类型信息不足以进一步验证资金归集 / 钱包迁移。",
            ],

            evidenceEn: [
              "Current address-type information is insufficient to further validate consolidation or wallet migration.",
            ],
          },
        };
      }

      if (
        cause.id ===
        "rapid_distribution"
      ) {
        const outgoingCounterpartyCount =
          counterparties.filter(
            (item) =>
              item.outgoingCount > 0
          ).length;

        if (
          outgoingCounterpartyCount >= 3
        ) {
          return {
            ...cause,
            verification: {
              status:
                "PARTIAL" as const,

              evidenceZh: [
                `当前样本中存在 ${outgoingCounterpartyCount} 个发生转出关系的直接对手方。`,
                "这与批量分发的网络形态部分一致。",
                "但不能仅凭对手方数量证明这些转账属于同一业务批次。",
              ],

              evidenceEn: [
                `The sample contains ${outgoingCounterpartyCount} distinct outgoing counterparties.`,
                "This is partially consistent with a distribution pattern.",
                "Counterparty count alone does not prove one operational batch.",
              ],
            },
          };
        }

        return {
          ...cause,
          verification: {
            status:
              "UNRESOLVED" as const,

            evidenceZh: [
              "当前转出对手方数量不足，无法进一步验证批量分发假设。",
            ],

            evidenceEn: [
              "The current number of outgoing counterparties is insufficient to further validate a batch-distribution hypothesis.",
            ],
          },
        };
      }

      return {
        ...cause,
        verification: {
          status:
            "UNRESOLVED" as const,

          evidenceZh: [
            "当前额外上下文不足以验证该原因。",
          ],

          evidenceEn: [
            "Current additional context is insufficient to validate this cause.",
          ],
        },
      };
    }
  );

  return {
    ...analysis,
    causes,
  };
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
  )}...${value.slice(-6)}`;
}
