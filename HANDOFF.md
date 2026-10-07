# HANDOFF — ChainScope AI 交接说明

> 给下一位开发者看的，直接说重点。

## 1. 项目现在做到哪了

**Phase 1–5 已经全部打通，端到端闭环已经能跑。**

输入 Ethereum 地址 → 查真实余额 → 拉最近交易（Etherscan）→ 10 条规则做异常检测 → 算出 Risk Score（0–100）→ DeepSeek 生成带证据的 AI 调查报告 → Markdown 渲染展示。

也就是说：**调查 Agent 的核心链路已经完整可用**，只剩最后一块「BOT Chain 存证」没做。

## 2. 现在最主要的 Bug 是什么

**没有阻塞性 Bug 了。** 之前 Node 访问 Etherscan 超时的问题已经解决（用 `undici` 的 `ProxyAgent` 走本地代理）。

当前是「功能缺口」而不是 Bug：

- BOT Chain 存证没做（最后一个 Phase）
- 只分析 ETH 普通交易，ERC-20 / Internal tx 没纳入
- 异常阈值是 MVP 启发式，没调优

## 3. 如何启动项目

```bash
npm install
npm run dev
```

打开 http://localhost:3000

## 4. 哪个页面是主页面

`app/page.tsx` —— 所有逻辑（查询、异常检测、Risk Score、报告渲染）都在这个文件里。文件较大（1500+ 行），核心函数是 `startInvestigation`、`detectAnomalies`、`calculateRiskScore`。

## 5. 哪个文件负责交易 API

- `app/api/transactions/route.ts` —— Etherscan 交易查询
- `app/api/investigate/route.ts` —— DeepSeek AI 调查报告

两个都通过 `undici ProxyAgent` 走代理访问外网。

## 6. API Key 配置在哪里

`.env.local`，共 4 个变量：

```
ETHERSCAN_API_KEY   # 已填好，直接用
DEEPSEEK_API_KEY    # 需要自己填（打包里没有，见下）
HTTP_PROXY          # 127.0.0.1:7892（作者本机代理，改成你自己的端口）
HTTPS_PROXY         # 同上
```

> **DeepSeek key 不在打包里**（高价值计费密钥，安全起见脱敏了）。拿到代码后自己去 DeepSeek 开放平台申请一个填进去即可，其余功能（余额、交易、异常检测、Risk Score）不依赖它也能跑，只是 AI 报告会提示生成失败。

## 7. Node 网络问题是什么（已解决）

之前 `fetch('https://api.etherscan.io')` 超时，因为浏览器走了 VPN/代理、Node 没走。解法是给 Node 请求显式挂代理：

```ts
import { ProxyAgent, fetch as undiciFetch } from "undici";
const dispatcher = new ProxyAgent(process.env.HTTPS_PROXY || "");
undiciFetch(url, { dispatcher });
```

如果你的网络能直连 Etherscan/DeepSeek，删掉 `.env.local` 里两行代理即可（代码会自动退化为直连）。

## 8. 下一位开发者最适合从哪里接着做

**Phase 6：BOT Chain 存证。** 这是唯一没做的 Phase，也是把「调查」升级为「可信公共记录」的关键一步。目标：把调查报告 hash + 地址 + tx hash + 时间戳写进 BOT Chain。

## 9. 哪些功能不要重复做

- 首页 UI、地址校验、ETH 余额 —— 已做完
- 交易查询（Etherscan V2）—— 已做完
- 异常检测（10 条规则）—— 已做完
- Risk Score —— 已做完
- AI 调查报告（DeepSeek）—— 已做完

**别重写这些，往 Phase 6 和 ERC-20/Internal tx 扩展。**

## 10. 当前建议优先解决什么

按顺序：

1. **BOT Chain 存证**（补全「调查 → 存证」闭环，比赛拿名次的关键）
2. **ERC-20 / Internal tx 纳入**（当前只分析 ETH 普通交易，覆盖面有限）
3. **异常阈值调优**（用真实地址回归，别让 Risk Score 动不动就满格或恒为 0）

---

完整进度见 `PROJECT_STATUS.md`，功能与运行说明见 `README.md`。
