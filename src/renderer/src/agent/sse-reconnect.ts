export type SseReconnectConfig = {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  jitter?: boolean
  reconnectWindowMs?: number
}

type ReconnectState = {
  attempt: number
  lastError: string | null
  lastReconnectAt: number
}

const DEFAULT_MAX_RETRIES = 5
const DEFAULT_BASE_DELAY_MS = 500
const DEFAULT_MAX_DELAY_MS = 15_000
const DEFAULT_BACKOFF_MULTIPLIER = 2
const DEFAULT_JITTER = true
const DEFAULT_RECONNECT_WINDOW_MS = 60_000

export class SseReconnectManager {
  private readonly config: Required<SseReconnectConfig>
  private state: ReconnectState = {
    attempt: 0,
    lastError: null,
    lastReconnectAt: 0
  }
  private readonly listeners = new Set<(state: ReconnectState) => void>()

  constructor(config?: SseReconnectConfig) {
    this.config = {
      maxRetries: config?.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseDelayMs: config?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
      maxDelayMs: config?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
      backoffMultiplier: config?.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER,
      jitter: config?.jitter ?? DEFAULT_JITTER,
      reconnectWindowMs: config?.reconnectWindowMs ?? DEFAULT_RECONNECT_WINDOW_MS
    }
  }

  shouldReconnect(error: string): boolean {
    if (this.state.attempt >= this.config.maxRetries) return false

    const now = Date.now()
    if (this.state.lastReconnectAt > 0) {
      const elapsed = now - this.state.lastReconnectAt
      if (elapsed > this.config.reconnectWindowMs) {
        this.state.attempt = 0
      }
    }

    const transientErrors = [
      'network',
      'timeout',
      'aborted',
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'socket hang up',
      'fetch failed',
      'stream_idle_timeout',
      'stream_read_error'
    ]

    const lowerError = error.toLowerCase()
    return transientErrors.some((pattern) => lowerError.includes(pattern.toLowerCase()))
  }

  getReconnectDelayMs(): number {
    let delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, this.state.attempt)
    delay = Math.min(delay, this.config.maxDelayMs)
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5)
    }
    return Math.floor(delay)
  }

  recordReconnectAttempt(error: string): void {
    this.state.attempt += 1
    this.state.lastError = error
    this.state.lastReconnectAt = Date.now()
    this.notifyListeners()
  }

  recordReconnectSuccess(): void {
    this.state.attempt = 0
    this.state.lastError = null
    this.notifyListeners()
  }

  recordReconnectFailure(error: string): void {
    this.state.lastError = error
    this.notifyListeners()
  }

  reset(): void {
    this.state = { attempt: 0, lastError: null, lastReconnectAt: 0 }
    this.notifyListeners()
  }

  get currentState(): ReconnectState {
    return { ...this.state }
  }

  get canRetry(): boolean {
    return this.state.attempt < this.config.maxRetries
  }

  onStateChange(listener: (state: ReconnectState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    const snapshot = { ...this.state }
    for (const listener of this.listeners) {
      try {
        listener(snapshot)
      } catch {
        // Listener errors should not break the notification chain
      }
    }
  }
}