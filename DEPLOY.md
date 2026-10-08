# DEPLOY — ChainScope AI 上线部署指南

把 ChainScope AI 部署到 **Vercel(通过 GitHub 仓库)**,得到一个公开网址。

## 部署相关架构说明

- `ETHERSCAN_API_KEY` / `DEEPSEEK_API_KEY` 都在**服务端** route handler 里读 `process.env`,不会泄露到浏览器。
- 云端 **不要** 配置 `HTTP_PROXY` / `HTTPS_PROXY` —— Vercel 服务器能直连 Etherscan / DeepSeek,代码会自动退化为直连。
- 已加 `in-memory` 限流(每 IP 每分钟 5 次)+ 相同地址报告缓存(10 分钟),防止 AI 接口被刷爆账单。
- 已移除 `next/font/google` 依赖,构建不依赖 Google Fonts(国内网络也能顺利构建)。

## 前置条件

- 一个 GitHub 账号
- 一个 Vercel 账号(可直接用 GitHub 账号登录)

## 第一步:推送代码到 GitHub

本地仓库已 `git init` 并完成首次提交。

### 方式 A:浏览器(无需安装任何工具)

1. 登录 <https://github.com>,点右上角 **New repository**
2. 仓库名填 `chainscope-ai`,选 **Private**(或 Public)
3. **不要**勾选 README / .gitignore(本地已有)
4. 创建后,复制仓库的 HTTPS 地址(形如 `https://github.com/你的用户名/chainscope-ai.git`)
5. 在项目目录执行:

```bash
git remote add origin https://github.com/你的用户名/chainscope-ai.git
git push -u origin main
```

首次 push 会弹出浏览器/窗口让你登录 GitHub(Windows 自带 Git Credential Manager)。

### 方式 B:GitHub CLI(推荐给熟练用户)

```bash
# 安装 gh(https://cli.github.com)后:
gh auth login
gh repo create chainscope-ai --private --source=. --push
```

## 第二步:Vercel 部署

1. 登录 <https://vercel.com>(用 GitHub 账号登录)
2. **Add New → Project**,选择刚导入的 `chainscope-ai` 仓库
3. 框架自动识别 Next.js,构建命令等保持默认即可
4. 配置环境变量(**关键一步**):

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `ETHERSCAN_API_KEY` | 你的 Etherscan key | 交易查询 |
| `DEEPSEEK_API_KEY` | 你的 DeepSeek key | AI 报告 |

> ⚠️ **不要**在 Vercel 配 `HTTP_PROXY` / `HTTPS_PROXY`,云端直连即可。配了反而会让服务器去连你本机的 `127.0.0.1:7892` 而失败。

5. 点 **Deploy**,等待构建完成

## 第三步:验证

- 部署完成后得到公开地址,形如 `https://chainscope-ai-xxxx.vercel.app`
- 输入一个真实 Ethereum 地址,验证完整流程:余额 → 交易 → 异常检测 → Risk Score → AI 报告
- 也可以在国内网络用浏览器直接访问(不依赖本地代理)

## 常见问题

| 现象 | 原因 / 处理 |
|------|-------------|
| 构建时报 `Failed to fetch Geist from Google Fonts` | 已修复:改用自托管字体(Manrope / Noto Sans SC),无需处理 |
| AI 报告返回 `请求过于频繁`(429) | 限流生效,等 1 分钟;或换 IP |
| AI 报告生成失败、其余正常 | 检查 Vercel 环境变量 `DEEPSEEK_API_KEY` 是否正确 |
| 交易查询失败、余额正常 | 检查 `ETHERSCAN_API_KEY`;余额走 publicnode RPC 与 Etherscan 无关 |

## 安全提醒

- `.env.local` 在 `.gitignore` 中,**不会**上传到 GitHub;`.env.example` 是脱敏模板,可以上传。
- 不要把 `DEEPSEEK_API_KEY` / `ETHERSCAN_API_KEY` 写进任何 `.ts` / `.tsx` 源码文件。
- 当前限流是「尽力而为」级别(Vercel Serverless 多实例)。正式对外或比赛评委大量使用时,建议:
  1. 升级为 Upstash Redis 限流(Vercel 生态原生支持)
  2. 在 DeepSeek 平台设置**用量上限 / 余额告警**,防止意外超支
