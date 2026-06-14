import type { ModelClient, ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'

export type RetryWithBackoffConfig = {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  retryableCodes?: string[]
  retryableStatuses?: number[]
  jitter?: boolean
}

type RetryDecision =
  | { retry: true; delayMs: number; attempt: number }
  | { retry: false; reason: string }

const DEFAULT_MAX_RETRIES = 3
const DEFAULT_BASE_DELAY_MS = 1_000
const DEFAULT_MAX_DELAY_MS = 30_000
const DEFAULT_BACKOFF_MULTIPLIER = 2
const DEFAULT_RETRYABLE_CODES = [
  'rate_limited',
  'deepseek_http_500',
  'deepseek_http_502',
  'deepseek_http_503',
  'deepseek_http_504',
  'deepseek_unreachable',
  'http_500',
  'http_502',
  'http_503',
  'http_504',
  'stream_idle_timeout',
  'stream_read_error'
]
const DEFAULT_RETRYABLE_STATUSES = [429, 500, 502, 503, 504]

export class RetryWithBackoffModelClient implements ModelClient {
  readonly provider: string
  readonly model: string

  private readonly inner: ModelClient
  private readonly config: Required<Pick<RetryWithBackoffConfig, 'maxRetries' | 'baseDelayMs' | 'maxDelayMs' | 'backoffMultiplier' | 'jitter'>> & {
    retryableCodes: string[]
    retryableStatuses: number[]
  }

  constructor(inner: ModelClient, config?: RetryWithBackoffConfig) {
    this.inner = inner
    this.provider = inner.provider
    this.model = inner.model
    this.config = {
      maxRetries: config?.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseDelayMs: config?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
      maxDelayMs: config?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
      backoffMultiplier: config?.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER,
      jitter: config?.jitter ?? true,
      retryableCodes: config?.retryableCodes ?? DEFAULT_RETRYABLE_CODES,
      retryableStatuses: config?.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES
    }
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    let attempt = 0
    let collectedChunks: ModelStreamChunk[] = []
    let streamStarted = false

    while (attempt <= this.config.maxRetries) {
      attempt += 1
      collectedChunks = []
      streamStarted = false
      let lastError: ModelStreamChunk | null = null

      for await (const chunk of this.inner.stream(request)) {
        if (chunk.kind === 'error') {
          lastError = chunk
          if (!streamStarted) {
            const decision = this.shouldRetry(chunk, attempt)
            if (decision.retry) {
              yield { kind: 'retry_scheduled' as string, attempt, delayMs: decision.delayMs } as unknown as ModelStreamChunk
              await this.sleep(decision.delayMs, request.abortSignal)
              break
            }
          }
          yield chunk
          return
        }

        streamStarted = true
        collectedChunks.push(chunk)
        yield chunk
      }

      if (!lastError || streamStarted) return

      const decision = this.shouldRetry(lastError, attempt)
      if (!decision.retry) {
        yield lastError
        return
      }

      if (attempt > this.config.maxRetries) {
        yield lastError
        return
      }

      yield { kind: 'retry_scheduled' as string, attempt, delayMs: decision.delayMs } as unknown as ModelStreamChunk
      await this.sleep(decision.delayMs, request.abortSignal)
    }
  }

  private shouldRetry(errorChunk: ModelStreamChunk, attempt: number): RetryDecision {
    if (attempt > this.config.maxRetries) {
      return { retry: false, reason: 'max retries exceeded' }
    }

    if (errorChunk.kind !== 'error') {
      return { retry: false, reason: 'not an error chunk' }
    }

    const code = (errorChunk as { code?: string }).code
    const message = (errorChunk as { message: string }).message

    if (code && this.config.retryableCodes.includes(code)) {
      const delayMs = this.computeDelay(attempt)
      return { retry: true, delayMs, attempt }
    }

    const statusMatch = this.config.retryableStatuses.find((status) =>
      message.includes(`HTTP ${status}`) || message.includes(`status ${status}`)
    )
    if (statusMatch !== undefined) {
      const delayMs = this.computeDelay(attempt)
      return { retry: true, delayMs, attempt }
    }

    if (code === 'rate_limited' || message.includes('rate limit') || message.includes('429')) {
      const delayMs = this.computeDelay(attempt, 2)
      return { retry: true, delayMs, attempt }
    }

    return { retry: false, reason: `error code ${code} is not retryable` }
  }

  private computeDelay(attempt: number, extraMultiplier = 1): number {
    let delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1) * extraMultiplier
    delay = Math.min(delay, this.config.maxDelayMs)
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5)
    }
    return Math.floor(delay)
  }

  private async sleep(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms)
      const onAbort = (): void => {
        clearTimeout(timer)
        resolve()
      }
      signal.addEventListener('abort', onAbort, { once: true })
    })
  }
}