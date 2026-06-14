# DeepSeek GUI v0.4.0

这一版是 v0.3.x 之后的一次重大更新，重点放在**集成开源生态**。通过引入 6 个成熟的开源库替代手写实现，让系统更健壮、更智能、更少报错。

---

## 📦 集成的开源库

### 1. [p-limit](https://github.com/sindresorhus/p-limit) — 并发控制
- 替代手写的 `RequestQueueModelClient`
- Sindre Sorhus 维护，周下载量 5000万+
- 每模型独立限流器，全局+按Key双层并发控制
- 比 Promise 队列更轻量，零依赖

### 2. [p-retry](https://github.com/sindresorhus/p-retry) — 指数退避重试
- 替代手写的 `RetryWithBackoffModelClient`
- 内置指数退避算法，支持 `factor`、`minTimeout`、`maxTimeout`、`randomize`
- 自动识别可重试错误，3次重试 + 随机抖动
- 与 AbortSignal 无缝集成

### 3. [p-queue](https://github.com/sindresorhus/p-queue) — 请求队列
- 替代手写的并发队列
- 支持并发限制、速率限制（interval + intervalCap）
- 支持暂停/恢复/清空队列
- 优先级队列支持

### 4. [p-timeout](https://github.com/sindresorhus/p-timeout) — 超时控制
- 替代手写的连接超时逻辑
- 10s 连接超时 + 120s 读取超时
- 优雅的 fallback 机制，超时时返回结构化错误
- 与 AbortSignal 兼容

### 5. [quick-lru](https://github.com/sindresorhus/quick-lru) — LRU 缓存
- 替代手写的 `ResponseCacheModelClient`
- 内置 maxAge（TTL）+ maxSize 双重淘汰
- 64 条缓存，5 分钟过期
- 比 Map + 手动清理更高效

### 6. [ky](https://github.com/sindresorhus/ky) — HTTP 客户端（已安装，备用）
- 基于 fetch 的轻量级 HTTP 客户端
- 内置重试、超时、钩子
- 未来可用于替代原始 fetch 调用

### 7. [eventsource](https://github.com/EventSource/eventsource) — SSE 客户端（已安装，备用）
- 成熟的 SSE 客户端库
- 自动重连、事件ID追踪
- 未来可用于增强前端 SSE 连接管理

---

## 🏗️ 架构改进

### OpenSourceResilientModelClient
基于开源库的增强版弹性模型客户端，装饰器链：

```
DeepseekCompatModelClient
  → PTimeoutModelClient（p-timeout 超时控制）
    → QuickLruCacheModelClient（quick-lru 缓存）
      → PRetryModelClient（p-retry 重试）
        → PLimitModelClient（p-limit 并发控制）
          → PQueueModelClient（p-queue 请求队列）
```

### 双模式切换
通过环境变量 `KUN_USE_OPENSOURCE_LIBS` 控制使用开源库版还是手写版：
- `KUN_USE_OPENSOURCE_LIBS=true`（默认）— 使用开源库
- `KUN_USE_OPENSOURCE_LIBS=false` — 使用手写实现

---

## 📁 新增文件

| 文件 | 说明 |
|------|------|
| `kun/src/adapters/model/plimit-model-client.ts` | p-limit 并发控制适配器 |
| `kun/src/adapters/model/pretry-model-client.ts` | p-retry 重试适配器 |
| `kun/src/adapters/model/pqueue-model-client.ts` | p-queue 请求队列适配器 |
| `kun/src/adapters/model/ptimeout-model-client.ts` | p-timeout 超时控制适配器 |
| `kun/src/adapters/model/quick-lru-cache-model-client.ts` | quick-lru 缓存适配器 |
| `kun/src/adapters/model/opensource-resilient-model-client.ts` | 开源库弹性客户端 |

---

## ⬆️ 升级说明

- 默认使用开源库版弹性客户端，无需额外配置
- 如需回退到手写版，设置环境变量 `KUN_USE_OPENSOURCE_LIBS=false`
- 所有开源库均为零/低依赖，不影响包体积
- p-limit、p-retry、p-queue、p-timeout 均由 Sindre Sorhus 维护，质量有保障

---

## 总结

v0.4.0 是一次面向**开源生态融合**的重大更新。通过引入 6 个成熟的开源库替代手写实现，让 DeepSeek GUI 的弹性架构站在巨人肩膀上，更健壮、更智能、更少报错。