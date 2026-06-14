import pTimeout from 'p-timeout'
import type { ModelClient, ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'

export type PTimeoutConfig = {
  connectTimeoutMs?: number
  readTimeoutMs?: number
}

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000
const DEFAULT_READ_TIMEOUT_MS = 120_000

export class PTimeoutModelClient implements ModelClient {
  readonly provider: string
  readonly model: string

  private readonly inner: ModelClient
  private readonly connectTimeoutMs: number
  private readonly readTimeoutMs: number

  constructor(inner: ModelClient, config?: PTimeoutConfig) {
    this.inner = inner
    this.provider = inner.provider
    this.model = inner.model
    this.connectTimeoutMs = config?.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS
    this.readTimeoutMs = config?.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    const connectPromise = async (): Promise<AsyncIterable<ModelStreamChunk>> => {
      return this.inner.stream(request)
    }

    const stream = await pTimeout(connectPromise(), {
      milliseconds: this.connectTimeoutMs,
      message: `model connection timed out after ${this.connectTimeoutMs}ms`,
      fallback: () => {
        const error: ModelStreamChunk = {
          kind: 'error',
          message: `model connection timed out after ${this.connectTimeoutMs}ms`,
          code: 'connect_timeout'
        }
        return (async function* (): AsyncIterable<ModelStreamChunk> {
          yield error
        })()
      }
    })

    let lastChunkAt = Date.now()
    for await (const chunk of stream) {
      lastChunkAt = Date.now()
      yield chunk
    }

    const elapsed = Date.now() - lastChunkAt
    if (elapsed > this.readTimeoutMs) {
      yield {
        kind: 'error',
        message: `model read timed out after ${this.readTimeoutMs}ms`,
        code: 'read_timeout'
      }
    }
  }
}