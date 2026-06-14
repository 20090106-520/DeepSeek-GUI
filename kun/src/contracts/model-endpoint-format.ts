export const MODEL_ENDPOINT_FORMATS = ['chat_completions', 'responses', 'messages', 'gemini'] as const
export type ModelEndpointFormat = (typeof MODEL_ENDPOINT_FORMATS)[number]
export const DEFAULT_MODEL_ENDPOINT_FORMAT: ModelEndpointFormat = 'chat_completions'

export function normalizeModelEndpointFormat(value: unknown): ModelEndpointFormat {
  if (typeof value !== 'string') return DEFAULT_MODEL_ENDPOINT_FORMAT
  const normalized = value.trim().toLowerCase().replace(/^\/+/, '')
  switch (normalized) {
    case 'chat':
    case 'chat-completions':
    case 'chat_completions':
    case 'v1/chat/completions':
    case 'chat/completions':
    case '/v1/chat/completions':
      return 'chat_completions'
    case 'response':
    case 'responses':
    case 'v1/responses':
    case '/v1/responses':
      return 'responses'
    case 'message':
    case 'messages':
    case 'v1/messages':
    case '/v1/messages':
      return 'messages'
    case 'gemini':
    case 'gemini-pro':
    case 'v1/models':
    case '/v1/models':
      return 'gemini'
    default:
      return DEFAULT_MODEL_ENDPOINT_FORMAT
  }
}

export function modelEndpointPath(format: ModelEndpointFormat): string {
  switch (format) {
    case 'responses':
      return 'responses'
    case 'messages':
      return 'messages'
    case 'gemini':
      return 'models/gemini-pro:generateContent'
    case 'chat_completions':
    default:
      return 'chat/completions'
  }
}
