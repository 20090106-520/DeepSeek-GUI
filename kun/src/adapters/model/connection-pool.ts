import type { ModelClient, ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'

export type ConnectionPoolConfig = {
  maxConnections?: number
  keepAliveTimeoutMs?: number
  requestTimeoutMs?: number
  dnsCacheTtlMs?: number
  enableHttp2?: boolean
}

type PooledConnection = {
  id: number
  lastUsedAt: number
  active: boolean
  requestCount: number
}

const DEFAULT_MAX_CONNECTIONS = 6
const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 30_000
const DEFAULT_REQUEST_TIMEOUT_MS = 120_000
const DEFAULT_DNS_CACHE_TTL_MS = 60_000

const dnsCache = new Map<string, { resolvedAt: number; address: string }>()

export class ConnectionPoolModelClient implements ModelClient {
  readonly provider: string
  readonly model: string

  private readonly inner: ModelClient
  private readonly maxConnections: number
  private readonly keepAliveTimeoutMs: number
  private readonly requestTimeoutMs: number
  private readonly dnsCacheTtlMs: number
  private readonly connections: PooledConnection[] = []
  private nextConnectionId = 0

  constructor(inner: ModelClient, config?: ConnectionPoolConfig) {
    this.inner = inner
    this.provider = inner.provider
    this.model = inner.model
    this.maxConnections = config?.maxConnections ?? DEFAULT_MAX_CONNECTIONS
    this.keepAliveTimeoutMs = config?.keepAliveTimeoutMs ?? DEFAULT_KEEP_ALIVE_TIMEOUT_MS
    this.requestTimeoutMs = config?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    this.dnsCacheTtlMs = config?.dnsCacheTtlMs ?? DEFAULT_DNS_CACHE_TTL_MS
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    const connection = this.acquireConnection()
    const timeoutController = new AbortController()
    const timeout = setTimeout(() => timeoutController.abort(), this.requestTimeoutMs)

    const combinedSignal = this.combineSignals(request.abortSignal, timeoutController.signal)

    try {
      const pooledRequest = { ...request, abortSignal: combinedSignal }
      for await (const chunk of this.inner.stream(pooledRequest)) {
        yield chunk
      }
      connection.requestCount += 1
    } finally {
      clearTimeout(timeout)
      this.releaseConnection(connection)
    }
  }

  get poolStats(): {
    totalConnections: number
    activeConnections: number
    idleConnections: number
    totalRequests: number
  } {
    const active = this.connections.filter((c) => c.active).length
    return {
      totalConnections: this.connections.length,
      activeConnections: active,
      idleConnections: this.connections.length - active,
      totalRequests: this.connections.reduce((sum, c) => sum + c.requestCount, 0)
    }
  }

  private acquireConnection(): PooledConnection {
    this.evictStaleConnections()

    const idle = this.connections.find((c) => !c.active)
    if (idle) {
      idle.active = true
      idle.lastUsedAt = Date.now()
      return idle
    }

    if (this.connections.length < this.maxConnections) {
      const connection: PooledConnection = {
        id: this.nextConnectionId++,
        lastUsedAt: Date.now(),
        active: true,
        requestCount: 0
      }
      this.connections.push(connection)
      return connection
    }

    const oldest = this.connections
      .filter((c) => !c.active)
      .sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0]
    if (oldest) {
      oldest.active = true
      oldest.lastUsedAt = Date.now()
      return oldest
    }

    return {
      id: this.nextConnectionId++,
      lastUsedAt: Date.now(),
      active: true,
      requestCount: 0
    }
  }

  private releaseConnection(connection: PooledConnection): void {
    connection.active = false
    connection.lastUsedAt = Date.now()
  }

  private evictStaleConnections(): void {
    const cutoff = Date.now() - this.keepAliveTimeoutMs
    for (let index = this.connections.length - 1; index >= 0; index--) {
      const connection = this.connections[index]
      if (!connection.active && connection.lastUsedAt < cutoff) {
        this.connections.splice(index, 1)
      }
    }
  }

  private combineSignals(primary: AbortSignal, secondary: AbortSignal): AbortSignal {
    if (primary.aborted) return primary
    if (secondary.aborted) return secondary

    const controller = new AbortController()
    const onAbort = (): void => controller.abort()

    primary.addEventListener('abort', onAbort, { once: true })
    secondary.addEventListener('abort', onAbort, { once: true })

    return controller.signal
  }

  static resolveDnsCached(hostname: string, resolve: () => string): string {
    const cached = dnsCache.get(hostname)
    if (cached && Date.now() - cached.resolvedAt < DEFAULT_DNS_CACHE_TTL_MS) {
      return cached.address
    }
    const address = resolve()
    dnsCache.set(hostname, { resolvedAt: Date.now(), address })
    return address
  }
}