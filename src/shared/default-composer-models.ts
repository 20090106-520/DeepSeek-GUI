/** When upstream `GET /v1/models` fails, offer these ids in the composer (matches TUI picker + common IDs). */
export const DEFAULT_COMPOSER_MODEL_IDS = ['auto', 'deepseek-v4-pro', 'deepseek-v4-flash'] as const

/** Default model IDs for OpenAI compatible providers */
export const OPENAI_MODEL_IDS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k'
] as const

/** Default model IDs for Anthropic providers */
export const ANTHROPIC_MODEL_IDS = [
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  'claude-3-5-sonnet-20240620'
] as const

/** Default model IDs for Google Gemini providers */
export const GEMINI_MODEL_IDS = [
  'gemini-pro',
  'gemini-1.0-pro',
  'gemini-1.5-pro',
  'gemini-1.5-flash'
] as const

/** Default model IDs for DeepSeek providers */
export const DEEPSEEK_MODEL_IDS = ['deepseek-v4-pro', 'deepseek-v4-flash'] as const

/** Default model IDs for Sapiens AI providers */
export const SAPIENS_MODEL_IDS = ['sapiens-ai/agnes-1.5-pro'] as const
