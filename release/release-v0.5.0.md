# DeepSeek GUI v0.5.0

这一版是 v0.4.0 之后的深度优化更新，重点放在**HTTP客户端增强、SSE解析效率、前端性能和离线能力**。

---

## 🚀 新增功能

### 1. ky HTTP 客户端适配器
- 基于 [ky](https://github.com/sindresorhus/ky) 开源库的增强HTTP模型客户端
- 内置重试（429/502/503/504 自动重试2次）
- 内置超时控制（30s）
- 自动设置 Authorization 头
- 可作为 DeepseekCompatModelClient 的替代方案

### 2. SSE 状态机解析器
- 替代低效的 `indexOf('\n\n')` + `slice` + `split` 字符串操作
- 逐行状态机解析，避免每次创建新字符串
- 支持 event/data/id/retry 四种SSE字段
- 零内存分配的增量解析

### 3. Pipeline Stage 批量写入
- Agent Loop 中的 pipeline stage 记录从逐条I/O改为批量写入
- 最多10条一批，200ms 刷新间隔
- 单个 modelStep 从8次I/O降低到1-2次
- 显著减少磁盘写入次数

### 4. 虚拟滚动 Hook
- `useVirtualScroll` 通用虚拟滚动Hook
- 二分查找定位可见区域，仅渲染可见DOM节点
- 支持 overscan 预渲染，滚动无闪烁
- 支持动态行高
- ResizeObserver 自动适配容器大小

### 5. IndexedDB 离线缓存
- `OfflineDB` 模块，基于浏览器 IndexedDB
- 线程和消息自动缓存到本地
- 断网时仍可查看历史对话
- 支持按线程查询、删除、清空
- 统计接口（线程数/消息数）

### 6. useDebounce / useThrottle Hooks
- 通用防抖和节流Hook
- `useDebounce` — 延迟执行，适合搜索输入
- `useThrottle` — 间隔执行，适合滚动/resize事件
- 自动清理定时器，无内存泄漏

---

## 📁 新增文件

| 文件 | 说明 |
|------|------|
| `kun/src/adapters/model/ky-model-client.ts` | ky HTTP客户端适配器 |
| `kun/src/adapters/model/sse-state-parser.ts` | SSE状态机解析器 |
| `kun/src/loop/pipeline-batch-recorder.ts` | Pipeline批量写入 |
| `src/renderer/src/hooks/use-virtual-scroll.ts` | 虚拟滚动Hook |
| `src/renderer/src/lib/offline-db.ts` | IndexedDB离线缓存 |
| `src/renderer/src/hooks/use-debounce-throttle.ts` | 防抖/节流Hook |

---

## ⬆️ 升级说明

- 所有新模块为可选集成，不影响现有功能
- ky 客户端可通过 `KyModelClient` 直接使用
- SSE 状态机解析器可在模型客户端中替换原有解析逻辑
- 虚拟滚动Hook可在消息列表等长列表场景中使用
- 离线缓存默认不启用，需主动调用 `getOfflineDB()`

---

## 总结

v0.5.0 是一次面向**性能深度优化和离线能力**的更新。ky HTTP客户端增强API调用稳定性，SSE状态机解析提升流式效率，虚拟滚动减少DOM节点，IndexedDB离线缓存让断网也能查看历史，防抖节流Hook统一前端性能模式。