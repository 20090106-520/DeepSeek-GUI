import ky, { type KyInstance, type Options as KyOptions } from 'ky'
import type { ModelClient, ModelRequest, ModelStreamChunk } from '../../ports/model-client.js'

export type KyModelClientConfig = {
  baseUrl: string
  apiKey?: string
  model: string
  endpointFormat?: string
  timeoutMs?: number
  retry?: KyOptions['retry']
  headers?: Record<string, string>
}

const DEFAULT_TIMEOUT_MS = 30_000

export class KyModelClient implements ModelClient {
  readonly provider = 'ky-http'
  readonly model: string

  private readonly kyInstance: KyInstance
  private readonly apiKey: string | undefined
  private readonly endpointFormat: string

  constructor(config: KyModelClientConfig) {
    this.model = config.model
    this.apiKey = config.apiKey
    this.endpointFormat = config.endpointFormat ?? 'chat'

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      ...config.headers
    }

    this.kyInstance = ky.create({
      prefix: config.baseUrl.replace(/\/+$/, ''),
      headers,
      timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      retry: config.retry ?? { limit: 2, methods: ['post'], statusCodes: [429, 502, 503, 504] }
    })
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    const endpoint = this.endpointFormat === 'messages' ? 'messages' : 'chat/completions'
    const body = this.buildRequestBody(request)

    try {
      const response = await this.kyInstance.post(endpoint, {
        json: body,
        signal: request.abortSignal
      })

      if (!response.ok) {
        const text = await response.text()
        yield {
          kind: 'error',
          message: `ky HTTP ${response.status}: ${text.slice(0, 500)}`,
          code: `http_${response.status}`
        }
        return
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        const json = await response.json() as Record<string, unknown>
        const result = this.parseNonStreamResponse(json)
        for (const chunk of result) yield chunk
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        yield { kind: 'error', message: 'no response body', code: 'no_body' }
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          if (request.abortSignal.aborted) break

          buffer += decoder.decode(value, { stream: true })
          let boundary: number
          while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            const dataLines = frame
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('')
            if (!dataLines || dataLines === '[DONE]') continue

            try {
              const payload = JSON.parse(dataLines) as Record<string, unknown>
              for (const chunk of this.parseStreamPayload(payload)) {
                yield chunk
              }
            } catch {
              continue
            }
          }
        }
      } finally {
        try { reader.releaseLock() } catch { /* ignore */ }
      }
    } catch (error) {
      if (request.abortSignal.aborted) {
        yield { kind: 'error', message: 'request was aborted', code: 'aborted' }
        return
      }
      yield {
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
        code: 'ky_request_failed'
      }
    }
  }

  private buildRequestBody(request: ModelRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.model,
      stream: true,
      messages: request.history.map((item) => this.mapItemToMessage(item)),
      ...(request.tools.length > 0 ? { tools: request.tools } : {}),
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.topP !== undefined ? { top_p: request.topP } : {}),
      ...(request.responseFormat ? { response_format: { type: request.responseFormat } } : {})
    }
    if (request.systemPrompt) {
      body.messages = [{ role: 'system', content: request.systemPrompt }, ...(body.messages as unknown[])]
    }
    return body
  }

  private mapItemToMessage(item: unknown): Record<string, unknown> {
    const i = item as Record<string, unknown>
    switch (i.kind) {
      case 'user_message':
        return { role: 'user', content: i.text ?? '' }
      case 'assistant_text':
        return { role: 'assistant', content: i.text ?? '' }
      case 'tool_call':
        return { role: 'assistant', tool_calls: [{ id: i.callId, type: 'function', function: { name: i.toolName, arguments: typeof i.arguments === 'string' ? i.arguments : JSON.stringify(i.arguments) } }] }
      case 'tool_result':
        return { role: 'tool', tool_call_id: i.callId, content: typeof i.output === 'string' ? i.output : JSON.stringify(i.output) }
      default:
        return { role: 'user', content: JSON.stringify(i) }
    }
  }

  private *parseStreamPayload(payload: Record<string, unknown>): Generator<ModelStreamChunk> {
    const choices = payload.choices as Array<Record<string, unknown>> | undefined
    if (!choices?.length) return

    const choice = choices[0]
    if (!choice) return

    const delta = choice.delta as Record<string, unknown> | undefined
    if (delta?.content && typeof delta.content === 'string') {
      yield { kind: 'assistant_text_delta', text: delta.content }
    }

    const finishReason = choice.finish_reason as string | undefined
    if (finishReason) {
      yield { kind: 'completed', stopReason: finishReason === 'tool_calls' ? 'tool_calls' : finishReason === 'length' ? 'length' : 'stop' }
    }
  }

  private *parseNonStreamResponse(payload: Record<string, unknown>): Generator<ModelStreamChunk> {
    const choices = payload.choices as Array<Record<string, unknown>> | undefined
    if (!choices?.length) return

    const choice = choices[0]
    if (!choice) return

    const message = choice.message as Record<string, unknown> | undefined
    if (message?.content && typeof message.content === 'string') {
      yield { kind: 'assistant_text_delta', text: message.content }
    }

    const finishReason = choice.finish_reason as string | undefined
    yield { kind: 'completed', stopReason: finishReason === 'tool_calls' ? 'tool_calls' : finishReason === 'length' ? 'length' : 'stop' }
  }
}