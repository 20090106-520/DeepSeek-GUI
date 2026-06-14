export type CircuitState = 'closed' | 'open' | 'half_open'

export type CircuitBreakerConfig = {
  failureThreshold?: number
  resetTimeoutMs?: number
  halfOpenMaxAttempts?: number
  monitorWindowMs?: number
}

type FailureRecord = {
  timestamp: number
  code?: string
}

const DEFAULT_FAILURE_THRESHOLD = 5
const DEFAULT_RESET_TIMEOUT_MS = 30_000
const DEFAULT_HALF_OPEN_MAX_ATTEMPTS = 1
const DEFAULT_MONITOR_WINDOW_MS = 60_000

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private readonly failures: FailureRecord[] = []
  private openedAt = 0
  private halfOpenAttempts = 0
  private readonly failureThreshold: number
  private readonly resetTimeoutMs: number
  private readonly halfOpenMaxAttempts: number
  private readonly monitorWindowMs: number
  private readonly now: () => number

  constructor(config?: CircuitBreakerConfig & { now?: () => number }) {
    this.failureThreshold = config?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD
    this.resetTimeoutMs = config?.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS
    this.halfOpenMaxAttempts = config?.halfOpenMaxAttempts ?? DEFAULT_HALF_OPEN_MAX_ATTEMPTS
    this.monitorWindowMs = config?.monitorWindowMs ?? DEFAULT_MONITOR_WINDOW_MS
    this.now = config?.now ?? Date.now
  }

  get currentState(): CircuitState {
    this.updateState()
    return this.state
  }

  canExecute(): boolean {
    this.updateState()
    if (this.state === 'closed') return true
    if (this.state === 'half_open') {
      return this.halfOpenAttempts < this.halfOpenMaxAttempts
    }
    return false
  }

  recordSuccess(): void {
    if (this.state === 'half_open') {
      this.state = 'closed'
      this.failures.length = 0
      this.halfOpenAttempts = 0
    }
  }

  recordFailure(code?: string): void {
    this.failures.push({ timestamp: this.now(), code })
    this.pruneFailures()

    if (this.state === 'half_open') {
      this.state = 'open'
      this.openedAt = this.now()
      this.halfOpenAttempts = 0
      return
    }

    if (this.failures.length >= this.failureThreshold) {
      this.state = 'open'
      this.openedAt = this.now()
    }
  }

  get failureCount(): number {
    this.pruneFailures()
    return this.failures.length
  }

  get stats(): {
    state: CircuitState
    failureCount: number
    openedAt: number | null
    timeUntilReset: number | null
  } {
    this.updateState()
    return {
      state: this.state,
      failureCount: this.failures.length,
      openedAt: this.state !== 'closed' ? this.openedAt : null,
      timeUntilReset: this.state === 'open'
        ? Math.max(0, this.resetTimeoutMs - (this.now() - this.openedAt))
        : null
    }
  }

  reset(): void {
    this.state = 'closed'
    this.failures.length = 0
    this.openedAt = 0
    this.halfOpenAttempts = 0
  }

  private updateState(): void {
    if (this.state === 'open') {
      const elapsed = this.now() - this.openedAt
      if (elapsed >= this.resetTimeoutMs) {
        this.state = 'half_open'
        this.halfOpenAttempts = 0
      }
    }
  }

  private pruneFailures(): void {
    const cutoff = this.now() - this.monitorWindowMs
    while (this.failures.length > 0 && this.failures[0].timestamp < cutoff) {
      this.failures.shift()
    }
  }
}

export class CircuitBreakerModelClient {
  static wrap<T extends { stream(...args: unknown[]): AsyncIterable<{ kind: string; code?: string }> }>(
    inner: T,
    circuit: CircuitBreaker
  ): T {
    const originalStream = inner.stream.bind(inner)
    inner.stream = async function* (this: T, ...args: unknown[]): AsyncIterable<{ kind: string; code?: string }> {
      if (!circuit.canExecute()) {
        const stats = circuit.stats
        yield {
          kind: 'error',
          code: 'circuit_open',
          message: `circuit breaker is open; time until reset: ${stats.timeUntilReset}ms`
        } as { kind: string; code?: string }
        return
      }

      let hasError = false
      let errorCode: string | undefined
      try {
        for await (const chunk of originalStream(...args)) {
          if (chunk.kind === 'error') {
            hasError = true
            errorCode = chunk.code
          }
          yield chunk
        }
      } catch (error) {
        hasError = true
        circuit.recordFailure('exception')
        throw error
      }

      if (hasError) {
        circuit.recordFailure(errorCode)
      } else {
        circuit.recordSuccess()
      }
    }.bind(inner)
    return inner
  }
}