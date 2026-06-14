# DeepSeek GUI v0.3.1

这一版是 v0.3.0 之后的性能优化更新，重点放在**前端渲染性能、SSE传输效率、错误分类准确性**。

---

## 🚀 新增与优化

### 1. SSE 事件批量合并与背压控制
- 新增 `SseEventBatcher`，50ms 窗口内的事件自动合并
- 连续的 `assistant_text_delta` 事件自动合并为单条SSE消息，减少网络帧数
- 最大批量 20 条，缓冲区上限 256KB，超出自动 flush
- 背压控制：缓冲区满时拒绝新事件，防止内存溢出

### 2. 流式 Delta 节流优化
- `onDeltas` 回调从逐条触发改为 50ms 节流批量处理
- 字符串拼接从 `+=` 改为数组缓冲 `push + join`，减少 GC 压力
- 高频流式场景下 zustand store 更新频率降低 80%+

### 3. 模型客户端连接级超时
- HTTP 请求新增 10s 连接级超时，与 45s 流读取超时分离
- 防止服务端接受连接但不响应时请求无限挂起
- 使用 `AbortSignal` 组合，兼容用户手动取消

### 4. 错误分类优先使用结构化错误码
- 新增 `CODE_TO_CATEGORY` 映射表，优先使用 `error.code` 和 `error.status` 分类
- 覆盖所有 Kun 运行时返回的结构化错误码（`rate_limited`、`circuit_open`、`stream_idle_timeout` 等）
- HTTP 状态码直接映射，避免字符串匹配误判
- 字符串匹配降级为 fallback，提高分类准确性

### 5. withRetry 条件重试
- 新增 `retryIf` 参数，允许调用者指定哪些错误可重试
- 默认使用 `isRetryableError` 过滤，认证错误(401)、验证错误(400)不再无意义重试

### 6. toolCatalogSnapshots LRU 清理
- `AgentLoop` 中的 `toolCatalogSnapshots` Map 添加上限 32 条
- 超出上限时自动淘汰最早插入的条目，防止内存持续增长

---

## 📁 新增文件

| 文件 | 说明 |
|------|------|
| `kun/src/server/sse-batcher.ts` | SSE 事件批量合并与背压控制 |

---

## 🔄 修改文件

| 文件 | 变更 |
|------|------|
| `package.json` | 版本号 0.3.0 → 0.3.1 |
| `kun/src/server/routes/events.ts` | 集成 SseEventBatcher |
| `kun/src/adapters/model/deepseek-compat-model-client.ts` | 添加连接级超时 |
| `kun/src/loop/agent-loop.ts` | toolCatalogSnapshots LRU 清理 |
| `src/renderer/src/store/chat-store-runtime.ts` | onDeltas 节流与字符串缓冲优化 |
| `src/renderer/src/lib/error-handler.ts` | 结构化错误码分类、条件重试 |

---

## 总结

v0.3.1 是一次面向**性能和准确性**的优化版本。SSE 事件批量合并减少网络开销，流式 Delta 节流降低前端渲染压力，连接级超时防止请求挂起，结构化错误分类提高准确性，条件重试避免无意义重试。