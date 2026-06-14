import PQueue from 'p-queue'
import type { ModelClient, ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'

export type PQueueConfig = {
  concurrency?: number
  interval?: number
  intervalCap?: number
  timeout?: number
  throwOnTimeout?: boolean
}

const DEFAULT_CONCURRENCY = 4
const DEFAULT_INTERVAL = 0
const DEFAULT_INTERVAL_CAP = Infinity

export class PQueueModelClient implements ModelClient {
  readonly provider: string
  readonly model: string

  private readonly inner: ModelClient
  private readonly queue: PQueue

  constructor(inner: ModelClient, config?: PQueueConfig) {
    this.inner = inner
    this.provider = inner.provider
    this.model = inner.model
    this.queue = new PQueue({
      concurrency: config?.concurrency ?? DEFAULT_CONCURRENCY,
      interval: config?.interval ?? DEFAULT_INTERVAL,
      intervalCap: config?.intervalCap ?? DEFAULT_INTERVAL_CAP,
      timeout: config?.timeout
    })
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    const streamFactory = () => this.inner.stream(request)
    const stream = await this.queue.add(streamFactory, { signal: request.abortSignal })
    if (!stream) return
    for await (const chunk of stream) {
      yield chunk
    }
  }

  get pendingCount(): number {
    return this.queue.pending
  }

  get size(): number {
    return this.queue.size
  }

  get isPaused(): boolean {
    return this.queue.isPaused
  }

  pause(): void {
    this.queue.pause()
  }

  start(): void {
    this.queue.start()
  }

  clear(): void {
    this.queue.clear()
  }
}