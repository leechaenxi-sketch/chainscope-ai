# PROJECT_STATUS — ChainScope AI

> 本文档记录项目真实状态（截至 2026-10-07）。以实际代码为准，供团队内部同步。

## 1. 项目目标

ChainScope AI 是一个 Ethereum 链上异动调查 Agent。

用户输入 Ethereum 地址 → 获取真实链上数据 → 交易分析 → 异常检测 → Risk Score → AI 调查 → 生成带证据的调查报告 →（后续）BOT Chain 可信存证。

- 比赛方向：GCC 公共物品赛道——以太坊链上异动调查 Agent
- 扩展方向：BOT Chain BUILD BEYOND 2026

## 2. 当前架构

- **前端**：Next.js 16 App Router（`app/` 目录），首页为 Client Component
- **余额查询**：前端直接通过 `ethers.JsonRpcProvider` 连接 `https://ethereum-rpc.publicnode.com`
- **交易 API**：`app/api/transactions/route.ts`（服务端 fetch Etherscan V2，走 `undici ProxyAgent` 代理）
- **AI 调查 API**：`app/api/investigate/route.ts`（调用 DeepSeek chat completions，走代理）
- **异常检测 / Risk Score**：在前端 `app/page.tsx` 内以纯函数实现（`detectAnomalies` / `calculateRiskScore`）
- **环境变量**：`.env.local`（Etherscan key / DeepSeek key / 代理地址）

## 3. 当前目录结构

```
chainscope-ai/
├── app/
│   ├── api/
│   │   ├── transactions/route.ts   # Etherscan V2 交易查询（走代理）
│   │   └── investigate/route.ts    # DeepSeek AI 调查报告（走代理）
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx                  # 根布局 + metadata（title: ChainScope AI）
│   └── page.tsx                    # 首页：查询 + 异常检测 + Risk Score + 报告渲染
├── public/
├── .env.local                      # Etherscan key + DeepSeek key + 代理
├── .gitignore
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
└── tsconfig.json
```

## 4. 已完成功能

- Next.js 16 + TypeScript + Tailwind CSS v4 项目
- 首页 UI：标题、Ethereum Mainnet 标识、地址输入、Start Investigation
- Ethereum 地址格式校验（`ethers.isAddress`）
- ETH 余额查询（真实数据，publicnode RPC）
- 最近交易查询（Etherscan V2，offset=100，代理直连）
- 交易列表 UI（Tx Hash / From / To / Value / Block / Timestamp / IN-OUT）
- **10 条启发式异常检测规则**（见第 5 节）
- **Risk Score**（各异常贡献分求和，封顶 100；分级 LOW <30 / MEDIUM 30–59 / HIGH 60–79 / CRITICAL ≥80）
- **AI 调查报告**（DeepSeek `deepseek-chat`，反幻觉 system prompt，结构化输出，Markdown 渲染）

## 5. 异常检测规则清单（实际代码）

| # | 规则 | 说明 |
|---|------|------|
| 1 | Large Transfer | 单笔转出 ≥ 均值的 3 倍且 ≥ 0.1 ETH |
| 2 | Outflow Surge | 1 小时窗口累计转出 ≥ 均值的 5 倍 |
| 3 | Transaction Frequency Spike | 10 分钟窗口 ≥ 8 笔交易 |
| 4 | Large Transfer to New Recipient | 向样本中未出现过的收款方大额转账 |
| 5 | Fund Flow Concentration | 单收款方占转出总额 ≥ 70% |
| 6 | Mass Recipient Distribution | 1 小时内向 ≥ 10 个收款方转账 |
| 7 | Dormant Wallet Reactivation | 沉寂 ≥ 30 天后突然大额转出 |
| 8 | Rapid Fund Outflow | 收款后 30 分钟内转出 ≥ 70% |
| 9 | High Transaction Failure Rate | 失败交易占比 ≥ 20% |
| 10 | Abnormal Transaction Fee | 单笔手续费 ≥ 均值的 3 倍 |

## 6. 当前进行中的功能

- 无硬阻塞项。下一目标为 Phase 6（BOT Chain 存证）。

## 7. 当前阻塞问题

- ~~Node.js 访问 Etherscan 超时~~ —— **已解决**（undici `ProxyAgent` + 本地代理 `127.0.0.1:7892`）。
- 当前无阻塞性技术问题。

## 8. 当前 API 使用情况

| 服务 | 用途 | 状态 |
|------|------|------|
| Etherscan API V2 | 交易查询（`account` / `txlist`） | ✅ 可用（走代理） |
| DeepSeek API | AI 调查报告（`deepseek-chat`） | ✅ 可用（走代理） |
| publicnode RPC | ETH 余额 | ✅ 可用 |
| Blockscout API | 曾尝试 | 已废弃，代码中无痕迹 |

## 9. 当前 RPC 使用情况

| RPC | 用途 | 状态 |
|-----|------|------|
| `https://ethereum-rpc.publicnode.com` | 读取 ETH 余额 | ✅ 可用 |

## 10. 当前环境变量

`.env.local` 包含 4 个变量：

```
ETHERSCAN_API_KEY   # Etherscan 交易查询（随包提供）
DEEPSEEK_API_KEY    # DeepSeek AI 报告（高价值计费密钥，不随包提供，需自行申请）
HTTP_PROXY          # 本地代理地址
HTTPS_PROXY         # 本地代理地址
```

## 11. 下一阶段任务

1. **BOT Chain 存证（Phase 6）** —— 合约 + 主网部署，写入 Report Hash / Address / Tx Hash / Timestamp
2. ERC-20 Token 转账纳入分析
3. Internal Transactions 纳入分析
4. 异常阈值调优（用真实地址做回归）
5. 报告存证 hash 与前端联动

## 12. BOT Chain 后续接入方案

将以下信息写入 BOT Chain Mainnet 作为可信存证：

- Investigation Report Hash
- Ethereum Address
- Ethereum Tx Hash
- Timestamp

需要：Solidity 合约 + BOT Chain 主网部署（尚未开始）。

## 13. 队友可以直接接手的任务

- **BOT Chain / Solidity**：存证合约开发与部署（当前最高优先级，也是最后一个未闭环的 Phase）
- **Blockchain Data**：ERC-20 / Internal tx 数据源接入
- **Anomaly Detection**：规则阈值调优、新增规则
- **AI Agent**：Prompt 打磨、报告质量与结构化优化
- **Frontend / UX**：报告导出、地址收藏、历史记录

## 14. 当前可演示内容

- 完整端到端流程：输入地址 → 真实余额 → 真实交易 → 异常检测 → Risk Score → AI 调查报告
- 报告含执行摘要、主要发现、关键证据表、风险解释、建议、置信度与局限性

## 15. 当前不可演示内容

- BOT Chain 可信存证（未开发）
- ERC-20 / Internal Transactions 分析（未纳入）

## 16. 推荐开发顺序

当前 Phase 1–5 已闭环，推荐顺序：

1. **Phase 6 BOT Chain 存证**（补全最后一个环节，形成「调查 → 存证」完整闭环，是拿名次的关键）
2. ERC-20 / Internal tx 纳入（显著提升调查覆盖度）
3. 阈值调优 + Prompt 打磨（提升报告质量）
