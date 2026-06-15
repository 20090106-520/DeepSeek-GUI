# DeepSeek-GUI v0.6.0 — 深度集成

## 概述

v0.6.0 将之前创建但未集成的组件全部接入主流程，实现端到端功能闭环。

## 新增集成

### SSE状态机解析器 → 模型客户端
- `SseStateParser` 替代 `DeepseekCompatModelClient.streamSse()` 中的手写buffer分割逻辑
- 更健壮的SSE帧解析，正确处理 `event:`、`id:`、`retry:` 字段
- 修复边界条件下不完整帧的解析问题

### 虚拟滚动 → MessageTimeline
- 当对话turn数量超过50时自动启用虚拟滚动
- 使用 `useVirtualScroll` Hook，仅渲染可视区域内的turn
- 流式输出（busy状态）时自动禁用虚拟滚动，保证实时性
- 5个overscan缓冲，滚动流畅无闪烁

### IndexedDB离线缓存 → chat-store
- `selectThread` 成功加载后自动缓存到IndexedDB
- 网络失败时自动从IndexedDB恢复对话数据
- 显示"已从本地缓存加载"提示
- 中英文i18n翻译支持

### ky HTTP客户端 → DeepseekCompatModelClient
- 新增 `ky-fetch-adapter.ts`，将ky封装为标准 `fetch` 接口
- `DeepseekCompatConfig` 新增 `useKy`、`kyTimeoutMs`、`kyRetryLimit` 选项
- 环境变量 `KUN_USE_KY=true` 启用ky替代原生fetch
- ky内置429/502/503/504自动重试，30s超时

### NovelForge Python后端自动启动
- 新增 `novelforge-process.ts` 主进程模块
- IPC通道 `novelforge:start`、`novelforge:status`、`novelforge:stop`
- 自动检测Python环境，spawn子进程启动FastAPI后端
- 15s启动超时 + 30s健康检查监控
- NovelForgeView UI升级：启动/停止/打开界面三按钮

## 新增文件

- `kun/src/adapters/model/ky-fetch-adapter.ts`
- `src/main/runtime/novelforge-process.ts`

## 修改文件

- `kun/src/adapters/model/deepseek-compat-model-client.ts` — SSE状态机解析器 + ky适配
- `kun/src/server/runtime-factory.ts` — KUN_USE_KY环境变量支持
- `kun/src/adapters/index.ts` — 导出ky-fetch-adapter
- `src/renderer/src/components/chat/MessageTimeline.tsx` — 虚拟滚动集成
- `src/renderer/src/store/chat-store-thread-actions.ts` — IndexedDB离线缓存
- `src/renderer/src/components/NovelForgeView.tsx` — 自动启动 + 停止按钮
- `src/renderer/src/locales/zh/common.json` — 离线缓存中文翻译
- `src/renderer/src/locales/en/common.json` — 离线缓存英文翻译
- `src/main/ipc/register-app-ipc-handlers.ts` — NovelForge IPC处理器
- `package.json` — 版本号 0.5.0 → 0.6.0

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `KUN_USE_KY` | 使用ky HTTP客户端替代原生fetch | `false` |
| `KUN_USE_OPENSOURCE_LIBS` | 使用开源库弹性客户端 | `true` |