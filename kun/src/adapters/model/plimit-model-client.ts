import pLimit from 'p-limit'
import type { ModelClient, ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'

export type PLimitConcurrencyConfig = {
  maxConcurrent?: number
  perKeyMaxConcurrent?: number
}

const DEFAULT_MAX_CONCURRENT = 4
const DEFAULT_PER_KEY_MAX_CONCURRENT = 2

export class PLimitModelClient implements ModelClient {
  readonly provider: string
  readonly model: string

  private readonly inner: ModelClient
  private readonly globalLimiter: ReturnType<typeof pLimit>
  private readonly keyLimiters = new Map<string, ReturnType<typeof pLimit>>()

  constructor(inner: ModelClient, config?: PLimitConcurrencyConfig) {
    this.inner = inner
    this.provider = inner.provider
    this.model = inner.model
    this.globalLimiter = pLimit(config?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT)
    const perKeyMax = config?.perKeyMaxConcurrent ?? DEFAULT_PER_KEY_MAX_CONCURRENT
    this.getKeyLimiter = (key: string) => {
      let limiter = this.keyLimiters.get(key)
      if (!limiter) {
        limiter = pLimit(perKeyMax)
        this.keyLimiters.set(key, limiter)
      }
      return limiter
    }
  }

  private readonly getKeyLimiter: (key: string) => ReturnType<typeof pLimit>

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    const key = request.model || this.model
    const keyLimiter = this.getKeyLimiter(key)

    const streamPromise = this.globalLimiter(() =>
      keyLimiter(() => this.inner.stream(request))
    )

    const stream = await streamPromise
    for await (const chunk of stream) {
      yield chunk
    }
  }

  get pendingCount(): number {
    return this.globalLimiter.pendingCount
  }

  get activeCount(): number {
    return this.globalLimiter.activeCount
  }
}