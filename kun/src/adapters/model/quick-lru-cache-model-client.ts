import QuickLRU from 'quick-lru'
import type { ModelClient, ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'

export type QuickLruCacheConfig = {
  enabled?: boolean
  maxSize?: number
  ttlMs?: number
  cacheablePred?: (request: ModelRequest) => boolean
}

type CacheEntry = {
  chunks: ModelStreamChunk[]
  createdAt: number
}

const DEFAULT_MAX_SIZE = 64
const DEFAULT_TTL_MS = 5 * 60 * 1_000

function defaultCacheablePred(request: ModelRequest): boolean {
  if (request.tools.length > 0) return false
  if (request.attachments?.length) return false
  if (request.reasoningEffort) return false
  return true
}

export class QuickLruCacheModelClient implements ModelClient {
  readonly provider: string
  readonly model: string

  private readonly inner: ModelClient
  private readonly enabled: boolean
  private readonly cache: QuickLRU<string, CacheEntry>
  private readonly cacheablePred: (request: ModelRequest) => boolean

  constructor(inner: ModelClient, config?: QuickLruCacheConfig) {
    this.inner = inner
    this.provider = inner.provider
    this.model = inner.model
    this.enabled = config?.enabled ?? false
    this.cache = new QuickLRU<string, CacheEntry>({
      maxSize: config?.maxSize ?? DEFAULT_MAX_SIZE,
      maxAge: config?.ttlMs ?? DEFAULT_TTL_MS
    })
    this.cacheablePred = config?.cacheablePred ?? defaultCacheablePred
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    if (!this.enabled || !this.cacheablePred(request)) {
      yield* this.inner.stream(request)
      return
    }

    const key = this.computeCacheKey(request)
    const cached = this.cache.get(key)
    if (cached) {
      for (const chunk of cached.chunks) {
        yield chunk
      }
      return
    }

    const chunks: ModelStreamChunk[] = []
    for await (const chunk of this.inner.stream(request)) {
      chunks.push(chunk)
      yield chunk
    }

    if (chunks.length > 0 && !chunks.some((c) => c.kind === 'error')) {
      this.cache.set(key, { chunks, createdAt: Date.now() })
    }
  }

  get stats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.cache.maxSize }
  }

  clear(): void {
    this.cache.clear()
  }

  private computeCacheKey(request: ModelRequest): string {
    const parts = [
      request.model,
      request.systemPrompt ?? '',
      request.modeInstruction ?? '',
      (request.contextInstructions ?? []).join('\n'),
      request.history.map((item) => `${item.kind}:${item.id}`).join(','),
      request.maxTokens?.toString() ?? '',
      request.temperature?.toString() ?? '',
      request.topP?.toString() ?? '',
      request.responseFormat ?? ''
    ]
    const raw = parts.join('|')
    let hash = 0
    for (let index = 0; index < raw.length; index += 1) {
      const char = raw.charCodeAt(index)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return `qlru_${Math.abs(hash).toString(36)}`
  }
}