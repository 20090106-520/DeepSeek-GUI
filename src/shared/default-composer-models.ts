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
export const SAPIENS_MODEL_IDS = [
  'sapiens-ai/agnes-1.5-pro',
  'sapiens-ai/agnes-image-2.0-flash',
  'sapiens-ai/agnes-image-2.1-flash',
  'sapiens-ai/agnes-video-2.0'
] as const

/** Default model IDs for Agnes AI providers */
export const AGNES_MODEL_IDS = [
  'agnes-1.5-pro',
  'agnes-1.5-flash',
  'agnes-image-2.0-flash',
  'agnes-image-2.1-flash',
  'agnes-image-3.0-flash',
  'agnes-video-2.0',
  'agnes-video-2.1'
] as const

/** Default model IDs for SiliconFlow (硅基流动) providers */
export const SILICONFLOW_MODEL_IDS = [
  'deepseek-ai/DeepSeek-V2.5',
  'deepseek-ai/DeepSeek-V2-Chat',
  'Qwen/Qwen2.5-7B-Instruct',
  'Qwen/Qwen2.5-14B-Instruct',
  'Qwen/Qwen2.5-32B-Instruct',
  'Qwen/Qwen2.5-72B-Instruct',
  'meta-llama/Llama-3.1-70B-Instruct',
  'meta-llama/Llama-3.1-8B-Instruct',
  'THUDM/glm-4-9b-chat',
  '01-ai/Yi-1.5-34B-Chat',
  '01-ai/Yi-1.5-9B-Chat'
] as const

/** Default model IDs for 豆包 (火山方舟/Doubao) providers */
export const DOUBAO_MODEL_IDS = [
  'doubao-1.5-pro-32k',
  'doubao-1.5-pro-256k',
  'doubao-1.5-lite-32k',
  'doubao-1.5-lite-128k',
  'doubao-pro-32k',
  'doubao-pro-128k',
  'doubao-lite-32k',
  'doubao-lite-128k'
] as const

/** Default model IDs for 通义千问 (Tongyi Qianwen) providers */
export const QWEN_MODEL_IDS = [
  'qwen-turbo',
  'qwen-plus',
  'qwen-max',
  'qwen-max-longcontext',
  'qwen-long',
  'qwen-vl-plus',
  'qwen-vl-max',
  'qwen-coder-plus',
  'qwen-coder-plus-latest'
] as const

/** Default model IDs for 文心一言 (ERNIE Bot) providers */
export const ERNIE_MODEL_IDS = [
  'ernie-4.0-8k',
  'ernie-4.0-turbo-8k',
  'ernie-3.5-8k',
  'ernie-speed-8k',
  'ernie-speed-128k',
  'ernie-lite-8k',
  'ernie-lite-pro-128k',
  'ernie-char-8k'
] as const

export const FREE_MODEL_IDS = [
  'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
  'deepseek-ai/DeepSeek-R1-Distill-Llama-70B',
  'deepseek-ai/DeepSeek-V3-0324',
  'Qwen/Qwen2.5-Coder-32B-Instruct',
  'Qwen/QwQ-32B',
  'meta-llama/Llama-3.3-70B-Instruct',
  'mistralai/Mistral-7B-Instruct-v0.3'
] as const
