import type { ModelClient, ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'

export type RequestQueueConfig = {
  maxConcurrent?: number
  perKeyMaxConcurrent?: number
  queueTimeoutMs?: number
}

type QueuedRequest = {
  request: ModelRequest
  resolve: () => void
  reject: (error: Error) => void
  enqueuedAt: number
}

const DEFAULT_MAX_CONCURRENT = 4
const DEFAULT_PER_KEY_MAX_CONCURRENT = 2
const DEFAULT_QUEUE_TIMEOUT_MS = 120_000

export class RequestQueueModelClient implements ModelClient {
  readonly provider: string
  readonly model: string

  private readonly inner: ModelClient
  private readonly maxConcurrent: number
  private readonly perKeyMaxConcurrent: number
  private readonly queueTimeoutMs: number
  private _activeCount = 0
  private readonly activePerKey = new Map<string, number>()
  private readonly queue: QueuedRequest[] = []

  constructor(inner: ModelClient, config?: RequestQueueConfig) {
    this.inner = inner
    this.provider = inner.provider
    this.model = inner.model
    this.maxConcurrent = config?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT
    this.perKeyMaxConcurrent = config?.perKeyMaxConcurrent ?? DEFAULT_PER_KEY_MAX_CONCURRENT
    this.queueTimeoutMs = config?.queueTimeoutMs ?? DEFAULT_QUEUE_TIMEOUT_MS
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    const key = request.model || this.model
    await this.acquireSlot(key, request.abortSignal)

    try {
      for await (const chunk of this.inner.stream(request)) {
        yield chunk
      }
    } finally {
      this.releaseSlot(key)
      this.drainQueue()
    }
  }

  get pendingCount(): number {
    return this.queue.length
  }

  get activeCount(): number {
    return this._activeCount
  }

  private async acquireSlot(key: string, signal: AbortSignal): Promise<void> {
    if (this.canProceed(key)) {
      this.incrementActive(key)
      return
    }

    return new Promise<void>((resolve, reject) => {
      const entry: QueuedRequest = {
        request: { abortSignal: signal } as ModelRequest,
        resolve: () => {
          this.incrementActive(key)
          resolve()
        },
        reject,
        enqueuedAt: Date.now()
      }
      this.queue.push(entry)

      const timeout = setTimeout(() => {
        const index = this.queue.indexOf(entry)
        if (index >= 0) {
          this.queue.splice(index, 1)
          reject(new Error('request queue timeout: too many concurrent requests'))
        }
      }, this.queueTimeoutMs)

      signal.addEventListener('abort', () => {
        clearTimeout(timeout)
        const index = this.queue.indexOf(entry)
        if (index >= 0) {
          this.queue.splice(index, 1)
          reject(new Error('request aborted while queued'))
        }
      }, { once: true })
    })
  }

  private canProceed(key: string): boolean {
    if (this._activeCount >= this.maxConcurrent) return false
    const keyActive = this.activePerKey.get(key) ?? 0
    if (keyActive >= this.perKeyMaxConcurrent) return false
    return true
  }

  private incrementActive(key: string): void {
    this._activeCount += 1
    this.activePerKey.set(key, (this.activePerKey.get(key) ?? 0) + 1)
  }

  private releaseSlot(key: string): void {
    this._activeCount = Math.max(0, this._activeCount - 1)
    const current = this.activePerKey.get(key) ?? 0
    if (current <= 1) {
      this.activePerKey.delete(key)
    } else {
      this.activePerKey.set(key, current - 1)
    }
  }

  private drainQueue(): void {
    while (this.queue.length > 0) {
      const entry = this.queue[0]
      if (!entry) break
      const key = entry.request.model || this.model
      if (!this.canProceed(key)) break
      this.queue.shift()
      entry.resolve()
    }
  }
}
