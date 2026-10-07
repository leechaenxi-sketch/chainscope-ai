# ChainScope AI 前端拆分版

这次只拆前端与本地分析逻辑，不修改后端 API。

## 文件职责

### 核心开发（你）
- `lib/analysis.ts`：异常检测、Change → Cause → Impact、对手方、二跳目标选择
- `lib/types.ts`：前后端公共数据结构
- `app/api/*`：继续沿用你当前项目，不要被 UI 分支覆盖

### UI 开发（队友）
- `components/chain/Dashboard.tsx`：页面所有视觉与交互
- `app/globals.css`：全局视觉、字体、动画、响应式

### 尽量少动
- `app/page.tsx`：只做状态管理、API 请求和“控制器”编排
- `lib/copy.ts`：中英文文案
- `lib/format.ts`：格式化工具

## 并行开发建议

你：`dev/core`
UI 队友：`dev/ui`

UI 队友不要改 `lib/analysis.ts` 和 `app/api/*`。
你尽量不要改 `components/chain/Dashboard.tsx`。

这样两条线可以同时进行，Git 冲突会少很多。

## 后端保持不变

继续沿用你当前的：
- `app/api/transactions/route.ts`
- `app/api/tokentx/route.ts`
- `app/api/internal-transactions/route.ts`
- `app/api/second-hop/route.ts`
- `app/api/investigate/route.ts`

所以原有 AI 限流 / 缓存 / second-hop 限流不会受这次拆分影响。
