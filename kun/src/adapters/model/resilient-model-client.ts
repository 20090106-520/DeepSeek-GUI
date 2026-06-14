import type { ModelClient, ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'
import type { RetryWithBackoffConfig } from './retry-with-backoff.js'
import type { RequestQueueConfig } from './request-queue.js'
import type { ResponseCacheConfig } from './response-cache.js'
import type { CircuitBreakerConfig, CircuitBreaker } from './circuit-breaker.js'
import type { ConnectionPoolConfig } from './connection-pool.js'
import { RetryWithBackoffModelClient } from './retry-with-backoff.js'
import { RequestQueueModelClient } from './request-queue.js'
import { ResponseCacheModelClient } from './response-cache.js'
import { ConnectionPoolModelClient } from './connection-pool.js'
import { CircuitBreaker as CircuitBreakerImpl } from './circuit-breaker.js'
import { getPerformanceMonitor } from '../../telemetry/performance-monitor.js'

export type ResilientModelClientConfig = {
  retry?: RetryWithBackoffConfig
  queue?: RequestQueueConfig
  cache?: ResponseCacheConfig
  circuitBreaker?: CircuitBreakerConfig
  connectionPool?: ConnectionPoolConfig
  performanceMonitoring?: boolean
}

export class ResilientModelClient implements ModelClient {
  readonly provider: string
  readonly model: string
  readonly circuitBreaker: CircuitBreakerImpl

  private readonly inner: ModelClient
  private readonly performanceMonitoring: boolean

  constructor(baseClient: ModelClient, config?: ResilientModelClientConfig) {
    this.performanceMonitoring = config?.performanceMonitoring ?? true
    this.circuitBreaker = new CircuitBreakerImpl(config?.circuitBreaker)

    let client: ModelClient = baseClient

    client = new ConnectionPoolModelClient(client, config?.connectionPool)

    client = new ResponseCacheModelClient(client, config?.cache)

    client = new RetryWithBackoffModelClient(client, config?.retry)

    client = new RequestQueueModelClient(client, config?.queue)

    this.inner = client
    this.provider = baseClient.provider
    this.model = baseClient.model
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    const monitor = getPerformanceMonitor()
    const startTime = Date.now()

    if (!this.circuitBreaker.canExecute()) {
      const stats = this.circuitBreaker.stats
      yield {
        kind: 'error',
        message: `circuit breaker is open; failures: ${stats.failureCount}, time until reset: ${stats.timeUntilReset}ms`,
        code: 'circuit_open'
      }
      return
    }

    if (this.performanceMonitoring) {
      monitor.record({ kind: 'request_start', model: request.model, timestamp: startTime })
    }

    let success = false
    try {
      for await (const chunk of this.inner.stream(request)) {
        if (chunk.kind === 'error') {
          const code = (chunk as { code?: string }).code
          this.circuitBreaker.recordFailure(code)
          if (this.performanceMonitoring) {
            monitor.record({ kind: 'retry', model: request.model, attempt: 1, code })
          }
        } else if (chunk.kind === 'usage') {
          const usage = (chunk as { usage: { promptTokens?: number; completionTokens?: number; costUsd?: number } }).usage
          if (this.performanceMonitoring && usage) {
            monitor.record({
              kind: 'token_usage',
              model: request.model,
              promptTokens: usage.promptTokens ?? 0,
              completionTokens: usage.completionTokens ?? 0,
              costUsd: usage.costUsd
            })
          }
        }

        yield chunk
      }
      success = true
    } finally {
      if (success) {
        this.circuitBreaker.recordSuccess()
      }
      if (this.performanceMonitoring) {
        monitor.record({
          kind: 'request_end',
          model: request.model,
          timestamp: Date.now(),
          durationMs: Date.now() - startTime,
          success
        })
      }
    }
  }

  get circuitState() {
    return this.circuitBreaker.currentState
  }

  get circuitStats() {
    return this.circuitBreaker.stats
  }
}

export function createResilientModelClient(
  baseClient: ModelClient,
  config?: ResilientModelClientConfig
): ResilientModelClient {
  return new ResilientModelClient(baseClient, config)
}