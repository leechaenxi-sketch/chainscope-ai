# ChainScope AI 简化升级包 v2

这版只做一件事：

**变化 → 可能原因 → 简单验证 → 潜在影响**

没有新增第三跳，没有把项目改成协议风险平台。

## 直接覆盖 / 新增这些文件

完整替换：
- `app/page.tsx`
- `components/chain/Dashboard.tsx`
- `lib/types.ts`
- `app/api/investigate/route.ts`

新增：
- `lib/cause-verification.ts`
- `app/api/address-context/route.ts`

其他文件保持不变。

## 简化后的验证规则

### 自动化合约 / DeFi 活动

- 主要对手方存在已验证合约 → `SUPPORTED`
- 有合约代码，但没有已验证源码 / 合约名 → `PARTIAL`
- 没找到合约 → `UNRESOLVED`

`SUPPORTED` 只代表：
“新增独立证据与假设方向一致”。

**不是证明某个协议或业务目的。**

### 资金归集 / 钱包迁移

如果最大 ETH 转出对手方没有合约代码：

`PARTIAL`

因为这与资金流向普通账户的模式方向一致。

但不能证明两个地址属于同一实体，因此不设 `SUPPORTED`。

### 批量分发

如果当前样本至少有 3 个不同转出对手方：

`PARTIAL`

否则：

`UNRESOLVED`

## Address Context 怎么取

全部走 Etherscan V2，不再让服务端直接访问 PublicNode：

1. `module=proxy&action=eth_getCode`
2. 如果存在合约代码，再调用 `module=contract&action=getsourcecode`

这样本地继续复用：
- `HTTP_PROXY`
- `HTTPS_PROXY`
- `ProxyAgent`
- `ETHERSCAN_API_KEY`

Vercel 仍然不要配置 localhost proxy。

## getsourcecode 数据裁剪

后端只保留：
- `address`
- `isContract`
- `contractName`
- `sourceVerified`

不会把：
- ABI
- SourceCode
- CompilerVersion
- ConstructorArguments

传给前端或 AI。

## 限流保留

Address Context：
- 12 次 cache miss / 分钟 / IP
- 地址缓存 30 分钟
- 每次最多检查 5 个地址
- cache hit 不占限流

AI：
- 5 次 cache miss / 分钟 / IP
- 报告缓存 10 分钟
- cache hit 不占限流

## UI 展示只需要理解三种状态

- `SUPPORTED`：有额外证据支持
- `PARTIAL`：部分支持
- `UNRESOLVED`：仍待确认

你自己不用管背后的 Etherscan 请求细节。

## 运行

覆盖完成后：

```powershell
Ctrl + C
npm run dev
```

如果编译通过，先测试你之前一直使用的地址即可。
