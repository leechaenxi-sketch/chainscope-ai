# ChainScope AI

> **溯迹·观微** —— 所有的隐匿，终有迹可循

ChainScope AI 是一个 **Ethereum 链上资金行为调查 Agent**。输入一个地址，它会拉取真实链上数据、识别资金行为变化、分析可能原因、验证关键证据，并生成一份带证据链的 AI 调查报告。

## ✨ 核心能力

- **三类链上数据源**：ETH 普通交易、ERC-20 代币转账、Internal 内部交易
- **对手方聚合 + 二跳追踪**：自动构建直接对手方关系网络，并对主要对手方做进一步调查
- **异常检测 + Risk Score**：覆盖 ETH / Token / Internal / 对手方多类启发式规则，输出 0–100 风险分
- **行为变化分析**：对比「近期窗口」与「基准窗口」，找出真正发生变化的指标
- **原因假设 + 确定性验证**：基于证据形成原因假设，并通过地址上下文（合约 bytecode / 源码验证）给出 `SUPPORTED` / `PARTIAL` / `UNRESOLVED` 三级验证状态
- **AI 调查报告**：DeepSeek 生成中英双语报告，反幻觉约束，只解释程序计算出的证据
- **限流 + 缓存**：每个 API 路由独立限流与缓存，防止密钥被盗刷

## 🔍 调查流程

```
输入地址
  → 余额查询（链上 RPC）
  → 三数据源采集（Etherscan V2）
  → 对手方构建
  → 异常检测 → Risk Score
  → 变化分析（基准 vs 近期）
  → 原因假设 → 地址上下文验证
  → 二跳追踪
  → 证据汇总 → AI 调查报告
```

## 🛠 技术栈

- **框架**：Next.js 16（App Router, Turbopack）+ React 19 + TypeScript（strict）
- **样式**：Tailwind CSS v4，单色主题，自托管 Manrope + Noto Sans SC 字体
- **链上数据**：ethers.js v6、Etherscan API V2、Ethereum RPC（publicnode）
- **AI**：DeepSeek（`deepseek-chat`）
- **网络**：undici + ProxyAgent（本地代理）
- **渲染**：react-markdown + remark-gfm

## 🚀 快速开始

```bash
npm install
cp .env.example .env.local   # 然后填入你的 API Key
npm run dev
```

打开 <http://localhost:3000>。

## 🔑 环境变量

在项目根目录创建 `.env.local` 并配置：

| 变量 | 说明 |
|------|------|
| `ETHERSCAN_API_KEY` | Etherscan API Key（<https://etherscan.io/apis>） |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（<https://platform.deepseek.com>） |
| `HTTP_PROXY` | 本地代理（仅本地开发需要，部署到 Vercel 时不要设置） |
| `HTTPS_PROXY` | 同上 |

> `.env.local` 已在 `.gitignore` 中，不会上传到 GitHub。模板见 [`.env.example`](.env.example)。

## 📡 API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/transactions` | GET | ETH 普通交易 |
| `/api/tokentx` | GET | ERC-20 代币转账 |
| `/api/internal-transactions` | GET | Internal 内部交易 |
| `/api/second-hop` | GET | 二跳追踪调查 |
| `/api/address-context` | POST | 地址上下文验证（合约 / 源码） |
| `/api/investigate` | POST | AI 调查报告 |

## 📁 项目结构

```
app/
  api/
    transactions/          # ETH 交易查询
    tokentx/               # ERC-20 转账查询
    internal-transactions/ # 内部交易查询
    second-hop/            # 二跳调查
    address-context/       # 合约 / 源码验证
    investigate/           # AI 报告生成
  layout.tsx               # 根布局 + 自托管字体
  page.tsx                 # 首页控制器（状态编排 + API 调用）
  globals.css              # 全局视觉
components/chain/
  Dashboard.tsx            # 全部 UI 组件
lib/
  analysis.ts              # 异常检测 / 变化分析 / 对手方 / Risk Score
  cause-verification.ts    # 原因假设确定性验证
  types.ts                 # 共享类型
  format.ts                # 格式化工具
  copy.ts                  # 中英文案
```

## ⚠️ 安全与免责声明

- 所有 API Key 只在服务端 route handler 中读取，不会暴露到浏览器
- 各路由内置限流与缓存，降低密钥被盗刷风险
- 本项目输出的调查报告仅用于链上调查辅助，**不构成对任何地址所有者身份、意图、责任或合法性的判断**

## 📦 部署

部署到 Vercel 的完整步骤见 [DEPLOY.md](DEPLOY.md)。

## 🗺 Roadmap

- [ ] BOT Chain 可信存证（调查报告 hash / 地址 / tx hash / 时间戳上链）
- [ ] 异常阈值数据调优
- [ ] 报告导出与历史记录
