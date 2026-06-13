import {
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_MODEL_ENDPOINT_FORMAT,
  DEFAULT_MODEL_PROVIDER_ID,
  type AppSettingsV1,
  type KunRuntimeSettingsV1,
  type ModelProviderProfilePatchV1,
  type ModelProviderProfileV1,
  type ModelProviderSettingsPatchV1,
  type ModelProviderSettingsV1
} from './app-settings-types'
import { normalizeModelEndpointFormat } from '../../kun/src/contracts/model-endpoint-format.js'
import { getKunRuntimeSettings } from './app-settings-kun'
import { normalizeDeepseekBaseUrl } from './app-settings-normalizers'
import {
  ANTHROPIC_MODEL_IDS,
  DEFAULT_COMPOSER_MODEL_IDS,
  DEEPSEEK_MODEL_IDS,
  GEMINI_MODEL_IDS,
  OPENAI_MODEL_IDS,
  SAPIENS_MODEL_IDS,
  AGNES_MODEL_IDS,
  SILICONFLOW_MODEL_IDS,
  DOUBAO_MODEL_IDS,
  QWEN_MODEL_IDS,
  ERNIE_MODEL_IDS
} from './default-composer-models'

const DEFAULT_MODEL_PROVIDER_NAME = 'DeepSeek'

export const PRESET_PROVIDERS: Record<string, {
  id: string
  name: string
  baseUrl: string
  endpointFormat: 'chat_completions' | 'responses' | 'messages' | 'gemini'
  models: string[]
}> = {
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    endpointFormat: 'chat_completions',
    models: [...DEEPSEEK_MODEL_IDS]
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    endpointFormat: 'chat_completions',
    models: [...OPENAI_MODEL_IDS]
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    endpointFormat: 'messages',
    models: [...ANTHROPIC_MODEL_IDS]
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    endpointFormat: 'gemini',
    models: [...GEMINI_MODEL_IDS]
  },
  sapiens: {
    id: 'sapiens',
    name: 'Sapiens AI',
    baseUrl: 'https://api.siray.ai/v1',
    endpointFormat: 'chat_completions',
    models: [...SAPIENS_MODEL_IDS]
  },
  agnes: {
    id: 'agnes',
    name: 'Agnes AI',
    baseUrl: 'https://api.agnes.ai/v1',
    endpointFormat: 'chat_completions',
    models: [...AGNES_MODEL_IDS]
  },
  siliconflow: {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    endpointFormat: 'chat_completions',
    models: [...SILICONFLOW_MODEL_IDS]
  },
  doubao: {
    id: 'doubao',
    name: '豆包 火山方舟',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    endpointFormat: 'chat_completions',
    models: [...DOUBAO_MODEL_IDS]
  },
  qwen: {
    id: 'qwen',
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    endpointFormat: 'chat_completions',
    models: [...QWEN_MODEL_IDS]
  },
  ernie: {
    id: 'ernie',
    name: '文心一言',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    endpointFormat: 'chat_completions',
    models: [...ERNIE_MODEL_IDS]
  }
}

export type PresetProviderId = keyof typeof PRESET_PROVIDERS

export function createPresetProviderProfile(presetId: PresetProviderId, apiKey: string): ModelProviderProfileV1 {
  const preset = PRESET_PROVIDERS[presetId]
  return {
    id: preset.id,
    name: preset.name,
    apiKey: apiKey.trim(),
    baseUrl: normalizeDeepseekBaseUrl(preset.baseUrl),
    endpointFormat: preset.endpointFormat,
    models: [...preset.models]
  }
}

export function defaultModelProviderSettings(): ModelProviderSettingsV1 {
  const defaultProvider = defaultModelProviderProfile('', DEFAULT_DEEPSEEK_BASE_URL)
  return {
    apiKey: defaultProvider.apiKey,
    baseUrl: defaultProvider.baseUrl,
    providers: [defaultProvider]
  }
}

export function normalizeModelProviderSettings(
  input: ModelProviderSettingsPatchV1 | undefined
): ModelProviderSettingsV1 {
  const defaults = defaultModelProviderSettings()
  const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : defaults.apiKey
  const baseUrl =
    typeof input?.baseUrl === 'string' && input.baseUrl.trim()
      ? normalizeDeepseekBaseUrl(input.baseUrl)
      : defaults.baseUrl
  const rawProviders = Array.isArray(input?.providers) ? input.providers : []
  const providersById = new Map<string, ModelProviderProfileV1>()
  const defaultProvider = defaultModelProviderProfile(apiKey, baseUrl)
  providersById.set(defaultProvider.id, defaultProvider)
  for (const rawProvider of rawProviders) {
    const provider = normalizeModelProviderProfile(rawProvider)
    if (!provider) continue
    providersById.set(provider.id, provider.id === DEFAULT_MODEL_PROVIDER_ID
      ? {
          ...defaultProvider,
          ...provider,
          apiKey,
          baseUrl
        }
      : provider)
  }
  const providers = [...providersById.values()]
  return {
    apiKey,
    baseUrl,
    providers
  }
}

export function mergeModelProviderSettings(
  current: ModelProviderSettingsV1,
  patch: ModelProviderSettingsPatchV1 | undefined
): ModelProviderSettingsV1 {
  return normalizeModelProviderSettings({
    ...current,
    ...(patch ?? {})
  })
}

export function getModelProviderSettings(settings: AppSettingsV1): ModelProviderSettingsV1 {
  return normalizeModelProviderSettings((settings as { provider?: ModelProviderSettingsPatchV1 }).provider)
}

export function modelProviderSettingsPatch(
  provider: ModelProviderSettingsPatchV1 | undefined
): ModelProviderSettingsPatchV1 {
  return provider ? { ...provider } : {}
}

export function resolveModelProviderApiKey(settings: AppSettingsV1): string {
  return getDefaultModelProviderProfile(settings).apiKey.trim()
}

export function resolveModelProviderBaseUrl(settings: AppSettingsV1): string {
  return normalizeDeepseekBaseUrl(getDefaultModelProviderProfile(settings).baseUrl)
}

export function getDefaultModelProviderProfile(settings: AppSettingsV1): ModelProviderProfileV1 {
  return getModelProviderProfile(settings, DEFAULT_MODEL_PROVIDER_ID)
}

export function getModelProviderProfile(
  settings: AppSettingsV1,
  providerId: string | undefined
): ModelProviderProfileV1 {
  const provider = getModelProviderSettings(settings)
  const id = normalizeModelProviderId(providerId || DEFAULT_MODEL_PROVIDER_ID)
  return provider.providers.find((profile) => profile.id === id) ?? provider.providers[0] ?? defaultModelProviderProfile(provider.apiKey, provider.baseUrl)
}

export function listModelProviderModelIds(settings: AppSettingsV1): string[] {
  const ids = new Set<string>()
  for (const provider of getModelProviderSettings(settings).providers) {
    for (const model of provider.models) {
      const trimmed = model.trim()
      if (trimmed) ids.add(trimmed)
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b))
}

export function resolveKunRuntimeSettings(settings: AppSettingsV1): KunRuntimeSettingsV1 {
  const runtime = getKunRuntimeSettings(settings)
  const provider = getModelProviderProfile(settings, runtime.providerId)
  const runtimeApiKey = runtime.apiKey?.trim() ?? ''
  const runtimeBaseUrl = runtime.baseUrl?.trim() ?? ''
  const providerBaseUrl = provider.baseUrl.trim() || DEFAULT_DEEPSEEK_BASE_URL

  return {
    ...runtime,
    apiKey: runtimeApiKey || provider.apiKey.trim(),
    baseUrl:
      runtimeBaseUrl && runtimeBaseUrl !== DEFAULT_DEEPSEEK_BASE_URL
        ? normalizeDeepseekBaseUrl(runtimeBaseUrl)
        : normalizeDeepseekBaseUrl(providerBaseUrl),
    endpointFormat: provider.endpointFormat
  }
}

function defaultModelProviderProfile(apiKey: string, baseUrl: string): ModelProviderProfileV1 {
  return {
    id: DEFAULT_MODEL_PROVIDER_ID,
    name: DEFAULT_MODEL_PROVIDER_NAME,
    apiKey: apiKey.trim(),
    baseUrl: normalizeDeepseekBaseUrl(baseUrl),
    endpointFormat: DEFAULT_MODEL_ENDPOINT_FORMAT,
    models: DEFAULT_COMPOSER_MODEL_IDS.filter((id) => id !== 'auto')
  }
}

function normalizeModelProviderProfile(
  input: ModelProviderProfilePatchV1 | undefined
): ModelProviderProfileV1 | null {
  const id = normalizeModelProviderId(input?.id)
  if (!id) return null
  const name = typeof input?.name === 'string' && input.name.trim() ? input.name.trim() : id
  const baseUrl =
    typeof input?.baseUrl === 'string' && input.baseUrl.trim()
      ? normalizeDeepseekBaseUrl(input.baseUrl)
      : DEFAULT_DEEPSEEK_BASE_URL
  const models = normalizeProviderModels(input?.models)
  return {
    id,
    name,
    apiKey: typeof input?.apiKey === 'string' ? input.apiKey.trim() : '',
    baseUrl,
    endpointFormat: normalizeModelEndpointFormat(input?.endpointFormat),
    models
  }
}

function normalizeProviderModels(models: unknown): string[] {
  if (!Array.isArray(models)) return []
  const ids = new Set<string>()
  for (const model of models) {
    if (typeof model !== 'string') continue
    const trimmed = model.trim()
    if (trimmed) ids.add(trimmed)
  }
  return [...ids].sort((a, b) => a.localeCompare(b))
}

export function normalizeModelProviderId(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64)
    : ''
}
