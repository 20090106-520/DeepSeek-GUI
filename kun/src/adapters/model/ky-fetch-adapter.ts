import ky, { type KyInstance } from 'ky'

export type KyFetchAdapterOptions = {
  timeoutMs?: number
  retryLimit?: number
  retryStatusCodes?: number[]
}

export function createKyFetchAdapter(options: KyFetchAdapterOptions = {}): typeof fetch {
  const timeoutMs = options.timeoutMs ?? 30_000
  const retryLimit = options.retryLimit ?? 2
  const retryStatusCodes = options.retryStatusCodes ?? [429, 502, 503, 504]

  const kyInstance: KyInstance = ky.create({
    timeout: timeoutMs,
    retry: {
      limit: retryLimit,
      methods: ['post'],
      statusCodes: retryStatusCodes
    }
  })

  const adapter: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = init?.method ?? 'GET'
    const headers = init?.headers as Record<string, string> | undefined
    const body = init?.body as string | undefined
    const signal = init?.signal

    const response = await kyInstance(url, {
      method,
      headers,
      body,
      signal,
      throwHttpErrors: false
    })

    return response as unknown as Response
  }

  return adapter
}