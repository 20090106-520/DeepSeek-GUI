export type PerformanceMetrics = {
  requestCount: number
  successCount: number
  failureCount: number
  retryCount: number
  cacheHitCount: number
  cacheMissCount: number
  averageResponseMs: number
  p50ResponseMs: number
  p95ResponseMs: number
  p99ResponseMs: number
  totalTokensUsed: number
  totalCostUsd: number
  circuitBreakerState: string
  queuePendingCount: number
  queueActiveCount: number
}

export type MetricEvent =
  | { kind: 'request_start'; model: string; timestamp: number }
  | { kind: 'request_end'; model: string; timestamp: number; durationMs: number; success: boolean }
  | { kind: 'retry'; model: string; attempt: number; code?: string }
  | { kind: 'cache_hit'; model: string }
  | { kind: 'cache_miss'; model: string }
  | { kind: 'token_usage'; model: string; promptTokens: number; completionTokens: number; costUsd?: number }
  | { kind: 'circuit_state_change'; newState: string }
  | { kind: 'queue_change'; pending: number; active: number }

type TimingEntry = {
  durationMs: number
  timestamp: number
}

const MAX_TIMING_ENTRIES = 1_000
const TIMING_WINDOW_MS = 300_000

export class PerformanceMonitor {
  private requestCount = 0
  private successCount = 0
  private failureCount = 0
  private retryCount = 0
  private cacheHitCount = 0
  private cacheMissCount = 0
  private totalTokensUsed = 0
  private totalCostUsd = 0
  private circuitBreakerState = 'closed'
  private queuePendingCount = 0
  private queueActiveCount = 0
  private readonly timings: TimingEntry[] = []
  private readonly now: () => number

  constructor(now?: () => number) {
    this.now = now ?? Date.now
  }

  record(event: MetricEvent): void {
    switch (event.kind) {
      case 'request_start':
        this.requestCount += 1
        break
      case 'request_end':
        if (event.success) this.successCount += 1
        else this.failureCount += 1
        this.timings.push({ durationMs: event.durationMs, timestamp: event.timestamp })
        this.pruneTimings()
        break
      case 'retry':
        this.retryCount += 1
        break
      case 'cache_hit':
        this.cacheHitCount += 1
        break
      case 'cache_miss':
        this.cacheMissCount += 1
        break
      case 'token_usage':
        this.totalTokensUsed += event.promptTokens + event.completionTokens
        if (event.costUsd) this.totalCostUsd += event.costUsd
        break
      case 'circuit_state_change':
        this.circuitBreakerState = event.newState
        break
      case 'queue_change':
        this.queuePendingCount = event.pending
        this.queueActiveCount = event.active
        break
    }
  }

  get metrics(): PerformanceMetrics {
    const durations = this.timings.map((t) => t.durationMs).sort((a, b) => a - b)
    return {
      requestCount: this.requestCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      retryCount: this.retryCount,
      cacheHitCount: this.cacheHitCount,
      cacheMissCount: this.cacheMissCount,
      averageResponseMs: durations.length > 0
        ? Math.floor(durations.reduce((sum, d) => sum + d, 0) / durations.length)
        : 0,
      p50ResponseMs: this.percentile(durations, 0.5),
      p95ResponseMs: this.percentile(durations, 0.95),
      p99ResponseMs: this.percentile(durations, 0.99),
      totalTokensUsed: this.totalTokensUsed,
      totalCostUsd: this.totalCostUsd,
      circuitBreakerState: this.circuitBreakerState,
      queuePendingCount: this.queuePendingCount,
      queueActiveCount: this.queueActiveCount
    }
  }

  reset(): void {
    this.requestCount = 0
    this.successCount = 0
    this.failureCount = 0
    this.retryCount = 0
    this.cacheHitCount = 0
    this.cacheMissCount = 0
    this.totalTokensUsed = 0
    this.totalCostUsd = 0
    this.circuitBreakerState = 'closed'
    this.queuePendingCount = 0
    this.queueActiveCount = 0
    this.timings.length = 0
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const index = Math.ceil(p * sorted.length) - 1
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))] ?? 0
  }

  private pruneTimings(): void {
    if (this.timings.length <= MAX_TIMING_ENTRIES) return
    const cutoff = this.now() - TIMING_WINDOW_MS
    while (this.timings.length > 0 && this.timings[0].timestamp < cutoff) {
      this.timings.shift()
    }
    while (this.timings.length > MAX_TIMING_ENTRIES) {
      this.timings.shift()
    }
  }
}

let globalMonitor: PerformanceMonitor | null = null

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor()
  }
  return globalMonitor
}

export function resetPerformanceMonitor(): void {
  if (globalMonitor) {
    globalMonitor.reset()
  }
}