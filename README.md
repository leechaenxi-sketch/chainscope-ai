# ChainScope AI

## 项目简介

ChainScope AI 是一个 **Ethereum 链上异动调查 Agent**。

用户输入一个 Ethereum 地址后，系统获取真实链上数据、分析交易行为、识别异常，由 AI Agent 生成带证据的调查报告。

## 比赛方向

- **GCC 公共物品赛道**：以太坊链上异动调查 Agent
- **扩展方向**：BOT Chain BUILD BEYOND 2026

## 核心流程

```
Ethereum Address
  → Blockchain Data
  → Transaction Analysis
  → Anomaly Detection
  → Risk Score
  → AI Investigation
  → Evidence Report
  → BOT Chain Proof   (待开发)
```

## 当前已实现功能

- Next.js 16 App Router 项目（TypeScript + Tailwind CSS v4）
- 首页 UI：标题 + Ethereum Mainnet 标识 + 地址输入框 + Start Investigation 按钮
- Ethereum 地址格式校验（`ethers.isAddress`）
- ETH 余额查询（真实链上数据，`ethereum-rpc.publicnode.com` RPC）
- 最近交易查询（Etherscan API V2，单次最多 100 笔，走代理）
- 交易列表 UI：Tx Hash / From / To / Value / Block / Timestamp / IN-OUT 方向
- **10 条启发式异常检测规则**（详见 [PROJECT_STATUS.md](PROJECT_STATUS.md)）
- **Risk Score**（0–100，分级 LOW / MEDIUM / HIGH / CRITICAL）
- **AI 调查报告**（DeepSeek，反幻觉约束 prompt，Markdown 渲染，含执行摘要 / 主要发现 / 关键证据 / 风险解释 / 建议 / 置信度）

## 当前开发状态

**Done**

- Phase 1 — 网络问题已解决（undici ProxyAgent + 本地代理）
- Phase 2 — 最近交易查询 + 列表 UI
- Phase 3 — 异常检测（10 条启发式规则）
- Phase 4 — Risk Score
- Phase 5 — AI 调查报告（DeepSeek）

**In Progress**

- （无硬阻塞）

**TODO**

- Phase 6 — BOT Chain 可信存证（合约 + 主网部署）
- ERC-20 / Internal Transactions 纳入分析
- 异常阈值调优（当前为 MVP 启发式）

## 技术栈

- Next.js（App Router）
- React
- TypeScript
- Tailwind CSS
- ethers.js
- Ethereum RPC（publicnode）
- Etherscan API V2
- DeepSeek API（AI 调查报告）
- undici（带代理的网络请求）
- react-markdown + remark-gfm（报告渲染）
- Solidity（后续）
- BOT Chain（后续）

## 本地运行方式

```bash
npm install
npm run dev
```

访问：<http://localhost:3000>

## 环境配置

项目根目录需要 `.env.local`：

```
ETHERSCAN_API_KEY=...            # Etherscan 交易查询
DEEPSEEK_API_KEY=...             # AI 调查报告（需自行申请）
HTTP_PROXY=http://127.0.0.1:7892   # 本地代理（按需改成自己的端口）
HTTPS_PROXY=http://127.0.0.1:7892  # 本地代理
```

> - `ETHERSCAN_API_KEY` 已随包提供。
> - `DEEPSEEK_API_KEY` 是高价值计费密钥，**未随包提供**，需队友自行申请后填入。
> - 代理地址 `127.0.0.1:7892` 是作者本机端口，队友需改成自己的代理端口（或删除这两行直连）。

## 当前已知问题

~~Node.js 访问 Etherscan 超时~~ —— **已解决**。通过 `undici` 的 `ProxyAgent` 走本地代理访问 Etherscan / DeepSeek。

当前主要局限（非阻塞）：

- BOT Chain 存证尚未开发
- 仅分析 ETH 普通交易，ERC-20 / Internal Transactions 未纳入
- 异常阈值是 MVP 启发式，未做数据调优
- Risk Score 为实验性评分，非正式安全评级

## Roadmap

- **Phase 1** — ✅ 解决 Node.js 请求 Etherscan 超时问题
- **Phase 2** — ✅ 最近交易查询 + 列表 UI
- **Phase 3** — ✅ 基础异常检测（大额 / 高频 / 快速转出等 10 条规则）
- **Phase 4** — ✅ Risk Score
- **Phase 5** — ✅ 接入 AI Agent（DeepSeek），基于真实分析生成调查报告
- **Phase 6** — ⬜ BOT Chain 可信存证：写入 Report Hash、Address、Tx Hash、Timestamp

## 团队协作建议

建议分工：

1. **Blockchain Data** — 交易查询、ERC-20 / Internal tx 扩展
2. **Anomaly Detection** — 规则调优与阈值
3. **AI Agent** — Prompt 调优、报告质量
4. **Frontend / UX** — 结果展示与交互
5. **BOT Chain / Solidity** — 存证合约与部署

更多细节见 [PROJECT_STATUS.md](PROJECT_STATUS.md) 与 [HANDOFF.md](HANDOFF.md)。
