import type { ModelClient, ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'
import type { PLimitConcurrencyConfig } from './plimit-model-client.js'
import type { PRetryConfig } from './pretry-model-client.js'
import type { PQueueConfig } from './pqueue-model-client.js'
import type { PTimeoutConfig } from './ptimeout-model-client.js'
import type { QuickLruCacheConfig } from './quick-lru-cache-model-client.js'
import type { CircuitBreakerConfig } from './circuit-breaker.js'
import { PLimitModelClient } from './plimit-model-client.js'
import { PRetryModelClient } from './pretry-model-client.js'
import { PQueueModelClient } from './pqueue-model-client.js'
import { PTimeoutModelClient } from './ptimeout-model-client.js'
import { QuickLruCacheModelClient } from './quick-lru-cache-model-client.js'
import { CircuitBreaker as CircuitBreakerImpl } from './circuit-breaker.js'
import { getPerformanceMonitor } from '../../telemetry/performance-monitor.js'

export type OpenSourceResilientConfig = {
  concurrency?: PLimitConcurrencyConfig
  retry?: PRetryConfig
  queue?: PQueueConfig
  timeout?: PTimeoutConfig
  cache?: QuickLruCacheConfig
  circuitBreaker?: CircuitBreakerConfig
  performanceMonitoring?: boolean
}

export class OpenSourceResilientModelClient implements ModelClient {
  readonly provider: string
  readonly model: string
  readonly circuitBreaker: CircuitBreakerImpl
  readonly queueClient: PQueueModelClient

  private readonly inner: ModelClient
  private readonly performanceMonitoring: boolean

  constructor(baseClient: ModelClient, config?: OpenSourceResilientConfig) {
    this.performanceMonitoring = config?.performanceMonitoring ?? true
    this.circuitBreaker = new CircuitBreakerImpl(config?.circuitBreaker)

    let client: ModelClient = baseClient

    client = new PTimeoutModelClient(client, config?.timeout)

    client = new QuickLruCacheModelClient(client, config?.cache)

    client = new PRetryModelClient(client, config?.retry)

    client = new PLimitModelClient(client, config?.concurrency)

    const queueClient = new PQueueModelClient(client, config?.queue)
    this.queueClient = queueClient
    client = queueClient

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

  get queueStats() {
    return {
      pending: this.queueClient.pendingCount,
      size: this.queueClient.size,
      paused: this.queueClient.isPaused
    }
  }
}

export function createOpenSourceResilientModelClient(
  baseClient: ModelClient,
  config?: OpenSourceResilientConfig
): OpenSourceResilientModelClient {
  return new OpenSourceResilientModelClient(baseClient, config)
}