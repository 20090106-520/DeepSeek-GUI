# DeepSeek GUI v0.3.0

这一版是 v0.2.x 之后的一次重大功能更新，重点放在**系统弹性、自动恢复和性能优化**。通过引入工业级的弹性架构模式，让 DeepSeek GUI 在网络不稳定、API 限流、服务端异常等场景下更健壮、更智能、更少报错。

---

## 🚀 新增功能

### 1. 请求重试与指数退避
- API 调用失败时自动重试，最多 3 次
- 指数退避策略（1s → 2s → 4s → ...），最大延迟 30s
- 随机抖动（jitter）防止惊群效应
- 自动识别可重试错误：429 限流、5xx 服务端错误、超时、连接中断等

### 2. 响应缓存层
- TTL + LRU 双重淘汰策略，5 分钟过期，最多 64 条缓存
- 仅缓存纯文本请求（无工具调用、无附件），避免缓存污染
- 减少重复请求，降低 Token 消耗和响应延迟

### 3. 请求队列与并发控制
- 全局最大 4 个并发请求，每模型最大 2 个并发
- 120s 队列超时保护，防止请求无限堆积
- 有效防止 API 限流错误（429）

### 4. 熔断器模式
- 5 次连续失败后自动熔断，阻止对不可用服务的请求
- 30s 后进入半开状态，允许探测性请求
- 熔断期间直接返回友好错误，避免无效等待

### 5. 连接池与 Keep-Alive
- 最大 6 个连接池，30s Keep-Alive 超时
- DNS 缓存 60s，减少 DNS 解析开销
- 120s 请求超时保护，防止请求无限挂起
- 自动淘汰空闲连接，连接复用减少 TCP 握手

### 6. 工具调用预检
- 校验必填参数是否存在
- 校验参数类型是否匹配 schema
- 路径参数自动清洗（去除 `..`、双斜杠等危险字符）
- 参数大小检查（超过 256KB 发出警告）
- 减少无效工具调用，避免模型返回错误后重试浪费

### 7. SSE 断线重连
- 最多 5 次自动重连，指数退避（0.5s → 1s → 2s → ...）
- 60s 重连窗口后重置计数器
- 智能识别临时性网络错误（ECONNRESET、ETIMEDOUT 等）
- 状态监听回调，UI 可显示重连进度

### 8. 运行时健康监控与自动恢复
- 每 10s 健康检查 Kun 进程状态
- 3 次连续失败后自动重启 Kun 进程
- 最多 5 次自动重启，30s 冷却期防止重启风暴
- 启动宽限期 15s，避免误判

### 9. Kun 进程预热
- 启动后 2s 延迟等待，5 次健康检查重试
- 预加载运行时信息，首次交互更快响应
- 防止用户首次点击时冷启动延迟

### 10. 性能监控 API
- 新增 `GET /v1/performance` 端点
- 请求成功率/失败率统计
- P50/P95/P99 响应延迟百分位
- Token 使用量与成本追踪
- 熔断器状态、队列状态实时查询

### 11. 增强错误分类与优雅降级
- 新增 4 种错误类别：`rate_limit`（限流）、`circuit_open`（熔断）、`stream`（流中断）、`timeout`（超时）
- 优雅降级规则：限流→排队、熔断→降级、流断→重试、超时→重试
- 更精准的错误提示，帮助用户理解问题原因

### 12. 中英文国际化支持
- 新增所有错误类别的中英文翻译
- 限流、熔断、流中断、超时等场景的友好提示

---

## 🏗️ 架构改进

### 弹性模型客户端（ResilientModelClient）
所有弹性模块通过装饰器模式层层包装，在运行时工厂中一键启用：

```
DeepseekCompatModelClient
  → ConnectionPoolModelClient（连接池）
    → ResponseCacheModelClient（响应缓存）
      → RetryWithBackoffModelClient（重试退避）
        → RequestQueueModelClient（并发控制）
```

外层由 `ResilientModelClient` 统一管理熔断器和性能监控。

---

## 📁 新增文件

| 文件 | 说明 |
|------|------|
| `kun/src/adapters/model/retry-with-backoff.ts` | 重试与指数退避 |
| `kun/src/adapters/model/request-queue.ts` | 请求队列与并发控制 |
| `kun/src/adapters/model/response-cache.ts` | 响应缓存层 |
| `kun/src/adapters/model/circuit-breaker.ts` | 熔断器 |
| `kun/src/adapters/model/connection-pool.ts` | 连接池与 Keep-Alive |
| `kun/src/adapters/model/resilient-model-client.ts` | 弹性模型客户端（整合所有模块） |
| `kun/src/loop/tool-pre-checker.ts` | 工具调用预检 |
| `kun/src/telemetry/performance-monitor.ts` | 性能监控 |
| `kun/src/server/routes/performance.ts` | 性能监控 API 路由 |
| `src/renderer/src/agent/sse-reconnect.ts` | SSE 断线重连 |
| `src/main/runtime/runtime-health-monitor.ts` | 运行时健康监控 |
| `src/main/runtime/kun-warmup.ts` | Kun 进程预热 |

---

## 🔄 修改文件

| 文件 | 变更 |
|------|------|
| `package.json` | 版本号 0.2.56 → 0.3.0 |
| `kun/src/server/runtime-factory.ts` | 集成 ResilientModelClient |
| `kun/src/server/routes/index.ts` | 新增 /v1/performance 路由 |
| `kun/src/adapters/index.ts` | 导出新模块 |
| `kun/src/telemetry/index.ts` | 导出性能监控 |
| `src/renderer/src/lib/error-handler.ts` | 增强错误分类与降级规则 |
| `src/renderer/src/locales/en/common.json` | 英文翻译 |
| `src/renderer/src/locales/zh/common.json` | 中文翻译 |

---

## ⬆️ 升级说明

- 从 v0.2.x 升级无需额外配置，所有弹性模块默认启用
- 性能监控可通过 `GET /v1/performance` 查看
- 如需调整重试次数、缓存大小等参数，可在 `runtime-factory.ts` 中修改 `ResilientModelClient` 配置
- 熔断器阈值、重连次数等均可按需调整

---

## 总结

v0.3.0 是一次面向**生产稳定性**的重大更新。通过引入重试、缓存、队列、熔断、连接池、预检、健康监控、断线重连等工业级弹性模式，让 DeepSeek GUI 在各种异常场景下自动恢复、智能降级，大幅减少用户遇到的报错和卡顿。