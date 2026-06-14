import pRetry from 'p-retry'
import type { ModelClient, ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'

export type PRetryConfig = {
  retries?: number
  factor?: number
  minTimeout?: number
  maxTimeout?: number
  randomize?: boolean
}

const DEFAULT_RETRIES = 3
const DEFAULT_FACTOR = 2
const DEFAULT_MIN_TIMEOUT = 1_000
const DEFAULT_MAX_TIMEOUT = 30_000

const RETRYABLE_CODES = new Set([
  'rate_limited',
  'deepseek_http_500',
  'deepseek_http_502',
  'deepseek_http_503',
  'deepseek_http_504',
  'deepseek_unreachable',
  'stream_idle_timeout',
  'stream_read_error',
  'circuit_open'
])

export class PRetryModelClient implements ModelClient {
  readonly provider: string
  readonly model: string

  private readonly inner: ModelClient
  private readonly retries: number
  private readonly factor: number
  private readonly minTimeout: number
  private readonly maxTimeout: number
  private readonly randomize: boolean

  constructor(inner: ModelClient, config?: PRetryConfig) {
    this.inner = inner
    this.provider = inner.provider
    this.model = inner.model
    this.retries = config?.retries ?? DEFAULT_RETRIES
    this.factor = config?.factor ?? DEFAULT_FACTOR
    this.minTimeout = config?.minTimeout ?? DEFAULT_MIN_TIMEOUT
    this.maxTimeout = config?.maxTimeout ?? DEFAULT_MAX_TIMEOUT
    this.randomize = config?.randomize ?? true
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    const chunks: ModelStreamChunk[] = []

    await pRetry(
      async (attemptNumber) => {
        chunks.length = 0
        let hasError = false

        for await (const chunk of this.inner.stream(request)) {
          if (chunk.kind === 'error') {
            const code = (chunk as { code?: string }).code
            if (code && RETRYABLE_CODES.has(code)) {
              hasError = true
            }
            chunks.push(chunk)
          } else {
            chunks.push(chunk)
          }
        }

        if (hasError) {
          const errorChunk = chunks.find((c) => c.kind === 'error')
          const message = errorChunk ? (errorChunk as { message: string }).message : 'unknown error'
          throw new Error(message)
        }
      },
      {
        retries: this.retries,
        factor: this.factor,
        minTimeout: this.minTimeout,
        maxTimeout: this.maxTimeout,
        randomize: this.randomize,
        signal: request.abortSignal,
        onFailedAttempt: () => {
          // Continue retrying
        }
      }
    )

    for (const chunk of chunks) {
      yield chunk
    }
  }
}