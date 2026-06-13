import type { ReactElement } from 'react'
import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search,
  Zap,
  Brain,
  Eye,
  Video,
  Code,
  MessageSquare,
  Check,
  Sparkles,
  Layers,
  Gauge,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff
} from 'lucide-react'
import { PRESET_PROVIDERS, type PresetProviderId } from '@shared/app-settings-provider'
import { useChatStore } from '../store/chat-store'

type ModelCategory = 'all' | 'chat' | 'code' | 'vision' | 'video' | 'reasoning'

type ModelMeta = {
  id: string
  providerId: string
  providerName: string
  category: ModelCategory[]
  tags: string[]
  speedLabel: string
  paramSize: string
  description: string
  free: boolean
}

type ProviderTestStatus = {
  status: 'idle' | 'testing' | 'success' | 'error'
  modelCount?: number
  latencyMs?: number
  message?: string
}

const MODEL_META: Record<string, Partial<ModelMeta>> = {
  'deepseek-v4-pro': { category: ['chat', 'code', 'reasoning'], tags: ['flagship', 'reasoning'], speedLabel: 'medium', paramSize: '671B MoE', description: 'DeepSeek flagship reasoning model', free: false },
  'deepseek-v4-flash': { category: ['chat', 'code'], tags: ['fast', 'affordable'], speedLabel: 'fast', paramSize: '671B MoE', description: 'DeepSeek fast & affordable model', free: true },
  'gpt-4o': { category: ['chat', 'code', 'vision', 'reasoning'], tags: ['flagship', 'multimodal'], speedLabel: 'medium', paramSize: '~1.8T', description: 'OpenAI flagship multimodal model', free: false },
  'gpt-4o-mini': { category: ['chat', 'code'], tags: ['fast', 'affordable'], speedLabel: 'fast', paramSize: '~8B', description: 'OpenAI fast & affordable model', free: true },
  'gpt-4-turbo': { category: ['chat', 'code', 'reasoning'], tags: ['reasoning'], speedLabel: 'slow', paramSize: '~1.8T', description: 'OpenAI GPT-4 Turbo', free: false },
  'gpt-4': { category: ['chat', 'reasoning'], tags: ['reasoning'], speedLabel: 'slow', paramSize: '~1.8T', description: 'OpenAI GPT-4', free: false },
  'gpt-3.5-turbo': { category: ['chat'], tags: ['fast', 'legacy'], speedLabel: 'fast', paramSize: '~175B', description: 'OpenAI fast legacy model', free: true },
  'gpt-3.5-turbo-16k': { category: ['chat'], tags: ['fast', 'long-context'], speedLabel: 'fast', paramSize: '~175B', description: 'OpenAI fast model with 16K context', free: true },
  'claude-3-opus-20240229': { category: ['chat', 'code', 'reasoning'], tags: ['flagship', 'reasoning'], speedLabel: 'slow', paramSize: '~1T', description: 'Anthropic most powerful model', free: false },
  'claude-3-sonnet-20240229': { category: ['chat', 'code'], tags: ['balanced'], speedLabel: 'medium', paramSize: '~200B', description: 'Anthropic balanced model', free: false },
  'claude-3-haiku-20240307': { category: ['chat'], tags: ['fast', 'affordable'], speedLabel: 'fast', paramSize: '~20B', description: 'Anthropic fast & compact model', free: true },
  'claude-3-5-sonnet-20240620': { category: ['chat', 'code', 'reasoning'], tags: ['flagship', 'reasoning'], speedLabel: 'medium', paramSize: '~200B', description: 'Anthropic Claude 3.5 Sonnet', free: false },
  'gemini-pro': { category: ['chat', 'code'], tags: ['balanced'], speedLabel: 'medium', paramSize: '~540B', description: 'Google Gemini Pro', free: true },
  'gemini-1.0-pro': { category: ['chat', 'code'], tags: ['balanced'], speedLabel: 'medium', paramSize: '~540B', description: 'Google Gemini 1.0 Pro', free: true },
  'gemini-1.5-pro': { category: ['chat', 'code', 'reasoning'], tags: ['long-context', 'reasoning'], speedLabel: 'slow', paramSize: '~540B MoE', description: 'Google Gemini 1.5 Pro with 1M context', free: false },
  'gemini-1.5-flash': { category: ['chat', 'code'], tags: ['fast', 'long-context'], speedLabel: 'fast', paramSize: '~540B MoE', description: 'Google Gemini 1.5 Flash with 1M context', free: true },
  'sapiens-ai/agnes-1.5-pro': { category: ['chat', 'reasoning'], tags: ['reasoning'], speedLabel: 'medium', paramSize: '-', description: 'Sapiens AI Agnes Pro', free: false },
  'sapiens-ai/agnes-image-2.0-flash': { category: ['vision'], tags: ['image-gen'], speedLabel: 'fast', paramSize: '-', description: 'Sapiens AI image generation', free: false },
  'sapiens-ai/agnes-image-2.1-flash': { category: ['vision'], tags: ['image-gen'], speedLabel: 'fast', paramSize: '-', description: 'Sapiens AI image generation v2.1', free: false },
  'sapiens-ai/agnes-video-2.0': { category: ['video'], tags: ['video-gen'], speedLabel: 'slow', paramSize: '-', description: 'Sapiens AI video generation', free: false },
  'agnes-1.5-pro': { category: ['chat', 'reasoning'], tags: ['reasoning'], speedLabel: 'medium', paramSize: '-', description: 'Agnes AI Pro', free: false },
  'agnes-1.5-flash': { category: ['chat'], tags: ['fast'], speedLabel: 'fast', paramSize: '-', description: 'Agnes AI Flash', free: true },
  'agnes-image-2.0-flash': { category: ['vision'], tags: ['image-gen'], speedLabel: 'fast', paramSize: '-', description: 'Agnes AI image generation', free: false },
  'agnes-image-2.1-flash': { category: ['vision'], tags: ['image-gen'], speedLabel: 'fast', paramSize: '-', description: 'Agnes AI image generation v2.1', free: false },
  'agnes-image-3.0-flash': { category: ['vision'], tags: ['image-gen'], speedLabel: 'fast', paramSize: '-', description: 'Agnes AI image generation v3.0', free: false },
  'agnes-video-2.0': { category: ['video'], tags: ['video-gen'], speedLabel: 'slow', paramSize: '-', description: 'Agnes AI video generation', free: false },
  'agnes-video-2.1': { category: ['video'], tags: ['video-gen'], speedLabel: 'slow', paramSize: '-', description: 'Agnes AI video generation v2.1', free: false },
  'deepseek-ai/DeepSeek-V2.5': { category: ['chat', 'code'], tags: ['balanced'], speedLabel: 'medium', paramSize: '236B MoE', description: 'DeepSeek V2.5 on SiliconFlow', free: true },
  'deepseek-ai/DeepSeek-V2-Chat': { category: ['chat'], tags: ['balanced'], speedLabel: 'medium', paramSize: '236B MoE', description: 'DeepSeek V2 Chat on SiliconFlow', free: true },
  'Qwen/Qwen2.5-7B-Instruct': { category: ['chat'], tags: ['fast', 'lightweight'], speedLabel: 'fast', paramSize: '7B', description: 'Qwen 2.5 7B on SiliconFlow', free: true },
  'Qwen/Qwen2.5-14B-Instruct': { category: ['chat', 'code'], tags: ['balanced'], speedLabel: 'fast', paramSize: '14B', description: 'Qwen 2.5 14B on SiliconFlow', free: true },
  'Qwen/Qwen2.5-32B-Instruct': { category: ['chat', 'code'], tags: ['balanced'], speedLabel: 'medium', paramSize: '32B', description: 'Qwen 2.5 32B on SiliconFlow', free: true },
  'Qwen/Qwen2.5-72B-Instruct': { category: ['chat', 'code', 'reasoning'], tags: ['reasoning'], speedLabel: 'medium', paramSize: '72B', description: 'Qwen 2.5 72B on SiliconFlow', free: false },
  'meta-llama/Llama-3.1-70B-Instruct': { category: ['chat', 'code'], tags: ['open-source', 'reasoning'], speedLabel: 'medium', paramSize: '70B', description: 'Llama 3.1 70B on SiliconFlow', free: true },
  'meta-llama/Llama-3.1-8B-Instruct': { category: ['chat'], tags: ['fast', 'lightweight'], speedLabel: 'fast', paramSize: '8B', description: 'Llama 3.1 8B on SiliconFlow', free: true },
  'THUDM/glm-4-9b-chat': { category: ['chat'], tags: ['fast', 'lightweight'], speedLabel: 'fast', paramSize: '9B', description: 'GLM-4 9B on SiliconFlow', free: true },
  '01-ai/Yi-1.5-34B-Chat': { category: ['chat', 'code'], tags: ['balanced'], speedLabel: 'medium', paramSize: '34B', description: 'Yi 1.5 34B on SiliconFlow', free: true },
  '01-ai/Yi-1.5-9B-Chat': { category: ['chat'], tags: ['fast', 'lightweight'], speedLabel: 'fast', paramSize: '9B', description: 'Yi 1.5 9B on SiliconFlow', free: true },
  'doubao-1.5-pro-32k': { category: ['chat', 'code'], tags: ['flagship'], speedLabel: 'medium', paramSize: '-', description: 'Doubao 1.5 Pro 32K context', free: false },
  'doubao-1.5-pro-256k': { category: ['chat', 'code'], tags: ['flagship', 'long-context'], speedLabel: 'medium', paramSize: '-', description: 'Doubao 1.5 Pro 256K context', free: false },
  'doubao-1.5-lite-32k': { category: ['chat'], tags: ['fast', 'affordable'], speedLabel: 'fast', paramSize: '-', description: 'Doubao 1.5 Lite 32K', free: true },
  'doubao-1.5-lite-128k': { category: ['chat'], tags: ['fast', 'long-context'], speedLabel: 'fast', paramSize: '-', description: 'Doubao 1.5 Lite 128K', free: true },
  'doubao-pro-32k': { category: ['chat', 'code'], tags: ['balanced'], speedLabel: 'medium', paramSize: '-', description: 'Doubao Pro 32K', free: false },
  'doubao-pro-128k': { category: ['chat', 'code'], tags: ['long-context'], speedLabel: 'medium', paramSize: '-', description: 'Doubao Pro 128K', free: false },
  'doubao-lite-32k': { category: ['chat'], tags: ['fast', 'affordable'], speedLabel: 'fast', paramSize: '-', description: 'Doubao Lite 32K', free: true },
  'doubao-lite-128k': { category: ['chat'], tags: ['fast', 'long-context'], speedLabel: 'fast', paramSize: '-', description: 'Doubao Lite 128K', free: true },
  'qwen-turbo': { category: ['chat'], tags: ['fast', 'affordable'], speedLabel: 'fast', paramSize: '-', description: 'Qwen Turbo', free: true },
  'qwen-plus': { category: ['chat', 'code'], tags: ['balanced'], speedLabel: 'medium', paramSize: '-', description: 'Qwen Plus', free: false },
  'qwen-max': { category: ['chat', 'code', 'reasoning'], tags: ['flagship', 'reasoning'], speedLabel: 'slow', paramSize: '-', description: 'Qwen Max flagship model', free: false },
  'qwen-max-longcontext': { category: ['chat', 'reasoning'], tags: ['long-context', 'reasoning'], speedLabel: 'slow', paramSize: '-', description: 'Qwen Max with long context', free: false },
  'qwen-long': { category: ['chat'], tags: ['long-context'], speedLabel: 'medium', paramSize: '-', description: 'Qwen Long context model', free: false },
  'qwen-vl-plus': { category: ['vision'], tags: ['vision'], speedLabel: 'medium', paramSize: '-', description: 'Qwen VL Plus vision model', free: false },
  'qwen-vl-max': { category: ['vision'], tags: ['vision', 'flagship'], speedLabel: 'slow', paramSize: '-', description: 'Qwen VL Max vision model', free: false },
  'qwen-coder-plus': { category: ['code'], tags: ['code'], speedLabel: 'medium', paramSize: '-', description: 'Qwen Coder Plus', free: false },
  'qwen-coder-plus-latest': { category: ['code'], tags: ['code'], speedLabel: 'medium', paramSize: '-', description: 'Qwen Coder Plus Latest', free: false },
  'ernie-4.0-8k': { category: ['chat', 'reasoning'], tags: ['flagship', 'reasoning'], speedLabel: 'slow', paramSize: '-', description: 'ERNIE 4.0 flagship model', free: false },
  'ernie-4.0-turbo-8k': { category: ['chat', 'code'], tags: ['fast', 'flagship'], speedLabel: 'medium', paramSize: '-', description: 'ERNIE 4.0 Turbo', free: false },
  'ernie-3.5-8k': { category: ['chat'], tags: ['balanced'], speedLabel: 'medium', paramSize: '-', description: 'ERNIE 3.5', free: true },
  'ernie-speed-8k': { category: ['chat'], tags: ['fast', 'affordable'], speedLabel: 'fast', paramSize: '-', description: 'ERNIE Speed 8K', free: true },
  'ernie-speed-128k': { category: ['chat'], tags: ['fast', 'long-context'], speedLabel: 'fast', paramSize: '-', description: 'ERNIE Speed 128K', free: true },
  'ernie-lite-8k': { category: ['chat'], tags: ['lightweight'], speedLabel: 'fast', paramSize: '-', description: 'ERNIE Lite 8K', free: true },
  'ernie-lite-pro-128k': { category: ['chat'], tags: ['long-context'], speedLabel: 'fast', paramSize: '-', description: 'ERNIE Lite Pro 128K', free: true },
  'ernie-char-8k': { category: ['chat'], tags: ['lightweight', 'character'], speedLabel: 'fast', paramSize: '-', description: 'ERNIE Character 8K', free: true }
}

const PROVIDER_ICONS: Record<string, string> = {
  deepseek: '🔮',
  openai: '🟢',
  anthropic: '🟠',
  gemini: '💎',
  sapiens: '🧬',
  agnes: '✨',
  siliconflow: '🌊',
  doubao: '🌋',
  qwen: '🤖',
  ernie: '🔵'
}

function getCategoryIcon(cat: ModelCategory): ReactElement {
  switch (cat) {
    case 'chat': return <MessageSquare className="h-3.5 w-3.5" />
    case 'code': return <Code className="h-3.5 w-3.5" />
    case 'vision': return <Eye className="h-3.5 w-3.5" />
    case 'video': return <Video className="h-3.5 w-3.5" />
    case 'reasoning': return <Brain className="h-3.5 w-3.5" />
    default: return <Sparkles className="h-3.5 w-3.5" />
  }
}

function getSpeedColor(speed: string): string {
  switch (speed) {
    case 'fast': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
    case 'medium': return 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
    case 'slow': return 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
    default: return 'text-gray-600 dark:text-gray-400 bg-gray-500/10'
  }
}

function buildAllModels(): ModelMeta[] {
  const models: ModelMeta[] = []
  for (const [providerId, provider] of Object.entries(PRESET_PROVIDERS)) {
    for (const modelId of provider.models) {
      const meta = MODEL_META[modelId]
      models.push({
        id: modelId,
        providerId,
        providerName: provider.name,
        category: meta?.category ?? ['chat'],
        tags: meta?.tags ?? [],
        speedLabel: meta?.speedLabel ?? 'medium',
        paramSize: meta?.paramSize ?? '-',
        description: meta?.description ?? modelId,
        free: meta?.free ?? false
      })
    }
  }
  return models
}

const ALL_MODELS = buildAllModels()

const CATEGORY_TABS: { key: ModelCategory; icon: ReactElement; labelKey: string }[] = [
  { key: 'all', icon: <Layers className="h-4 w-4" />, labelKey: 'modelMarketCategoryAll' },
  { key: 'chat', icon: <MessageSquare className="h-4 w-4" />, labelKey: 'modelMarketCategoryChat' },
  { key: 'code', icon: <Code className="h-4 w-4" />, labelKey: 'modelMarketCategoryCode' },
  { key: 'reasoning', icon: <Brain className="h-4 w-4" />, labelKey: 'modelMarketCategoryReasoning' },
  { key: 'vision', icon: <Eye className="h-4 w-4" />, labelKey: 'modelMarketCategoryVision' },
  { key: 'video', icon: <Video className="h-4 w-4" />, labelKey: 'modelMarketCategoryVideo' }
]

export function ModelMarketView(): ReactElement {
  const { t } = useTranslation('common')
  const composerModel = useChatStore((s) => s.composerModel)
  const setComposerModel = useChatStore((s) => s.setComposerModel)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ModelCategory>('all')
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [providerTests, setProviderTests] = useState<Record<string, ProviderTestStatus>>({})

  const filteredModels = useMemo(() => {
    let result = ALL_MODELS
    if (selectedProvider) {
      result = result.filter((m) => m.providerId === selectedProvider)
    }
    if (activeCategory !== 'all') {
      result = result.filter((m) => m.category.includes(activeCategory))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((m) =>
        m.id.toLowerCase().includes(q) ||
        m.providerName.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    }
    return result
  }, [searchQuery, activeCategory, selectedProvider])

  const providerList = useMemo(() => {
    return Object.entries(PRESET_PROVIDERS).map(([id, provider]) => ({
      id,
      name: provider.name,
      icon: PROVIDER_ICONS[id] ?? '🤖',
      modelCount: provider.models.length,
      baseUrl: provider.baseUrl
    }))
  }, [])

  const handleSelectModel = useCallback((modelId: string) => {
    setComposerModel(modelId)
  }, [setComposerModel])

  const handleTestProvider = useCallback(async (providerId: string) => {
    setProviderTests((prev) => ({
      ...prev,
      [providerId]: { status: 'testing' }
    }))
    const start = Date.now()
    try {
      const response = await window.dsGui.fetchUpstreamModels()
      const latencyMs = Date.now() - start
      if (response.ok) {
        const matchingModels = response.modelIds.filter((id) => {
          const preset = PRESET_PROVIDERS[providerId as PresetProviderId]
          return preset?.models.includes(id)
        })
        setProviderTests((prev) => ({
          ...prev,
          [providerId]: {
            status: 'success',
            modelCount: response.modelIds.length,
            latencyMs,
            message: t('modelMarketTestSuccess', { count: response.modelIds.length, latency: latencyMs })
          }
        }))
      } else {
        setProviderTests((prev) => ({
          ...prev,
          [providerId]: {
            status: 'error',
            latencyMs,
            message: response.message
          }
        }))
      }
    } catch (error) {
      const latencyMs = Date.now() - start
      setProviderTests((prev) => ({
        ...prev,
        [providerId]: {
          status: 'error',
          latencyMs,
          message: error instanceof Error ? error.message : String(error)
        }
      }))
    }
  }, [t])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-ds-main">
      <div className="ds-no-drag shrink-0 border-b border-ds-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ds-primary-text">{t('modelMarketTitle')}</h1>
            <p className="text-sm text-ds-secondary-text">{t('modelMarketSubtitle')}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-secondary-text" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('modelMarketSearchPlaceholder')}
              className="w-full rounded-lg border border-ds-border bg-ds-surface py-2 pl-9 pr-3 text-sm text-ds-primary-text placeholder-ds-secondary-text outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
            />
          </div>
          {selectedProvider && (
            <button
              onClick={() => setSelectedProvider(null)}
              className="shrink-0 rounded-lg border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-secondary-text transition-colors hover:bg-ds-hover"
            >
              {t('modelMarketClearFilter')}
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === tab.key
                  ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                  : 'text-ds-secondary-text hover:bg-ds-hover hover:text-ds-primary-text'
              }`}
            >
              {tab.icon}
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="shrink-0 w-52 border-r border-ds-border overflow-y-auto py-3 px-2">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ds-secondary-text">
            {t('modelMarketProviders')}
          </div>
          {providerList.map((provider) => {
            const testStatus = providerTests[provider.id]
            return (
              <div key={provider.id} className="mb-0.5">
                <button
                  onClick={() => setSelectedProvider(selectedProvider === provider.id ? null : provider.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    selectedProvider === provider.id
                      ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
                      : 'text-ds-primary-text hover:bg-ds-hover'
                  }`}
                >
                  <span className="text-base">{provider.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{provider.name}</div>
                    <div className="text-[10px] text-ds-secondary-text">{provider.modelCount} {t('modelMarketModelCount')}</div>
                  </div>
                  {testStatus?.status === 'success' && (
                    <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  )}
                  {testStatus?.status === 'error' && (
                    <WifiOff className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  )}
                </button>
                <div className="flex items-center gap-1 px-2.5 pb-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleTestProvider(provider.id) }}
                    disabled={testStatus?.status === 'testing'}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-ds-secondary-text transition-colors hover:bg-ds-hover hover:text-ds-primary-text disabled:opacity-50"
                  >
                    {testStatus?.status === 'testing' ? (
                      <><Loader2 className="h-3 w-3 animate-spin" />{t('modelMarketTestTesting')}</>
                    ) : (
                      <><RefreshCw className="h-3 w-3" />{t('modelMarketTestBtn')}</>
                    )}
                  </button>
                  {testStatus?.status === 'success' && testStatus.latencyMs && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{testStatus.latencyMs}ms</span>
                  )}
                </div>
                {testStatus?.status === 'success' && testStatus.modelCount !== undefined && (
                  <div className="mx-2.5 mb-1 flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-700 dark:text-emerald-300">
                    <CheckCircle className="h-3 w-3" />
                    {t('modelMarketTestModelCount', { count: testStatus.modelCount })}
                  </div>
                )}
                {testStatus?.status === 'error' && testStatus.message && (
                  <div className="mx-2.5 mb-1 flex items-start gap-1 rounded bg-rose-500/10 px-2 py-1 text-[10px] text-rose-700 dark:text-rose-300">
                    <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span className="line-clamp-2">{testStatus.message}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-ds-secondary-text">
              {t('modelMarketResultCount', { count: filteredModels.length })}
            </span>
            {composerModel && (
              <span className="flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">
                <Zap className="h-3 w-3" />
                {t('modelMarketCurrentModel')}: {composerModel}
              </span>
            )}
          </div>

          {filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-ds-secondary-text">
              <Search className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">{t('modelMarketNoResults')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredModels.map((model) => {
                const isActive = composerModel === model.id
                return (
                  <button
                    key={`${model.providerId}-${model.id}`}
                    onClick={() => handleSelectModel(model.id)}
                    className={`group relative flex flex-col rounded-xl border p-4 text-left transition-all ${
                      isActive
                        ? 'border-violet-500 bg-violet-500/5 shadow-md shadow-violet-500/10'
                        : 'border-ds-border bg-ds-surface hover:border-violet-500/40 hover:shadow-sm hover:shadow-violet-500/5'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </div>
                    )}

                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 text-lg">{PROVIDER_ICONS[model.providerId] ?? '🤖'}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-ds-primary-text">{model.id}</span>
                          {model.free && (
                            <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                              {t('modelMarketFree')}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-ds-secondary-text">{model.providerName}</div>
                      </div>
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs text-ds-secondary-text">{model.description}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${getSpeedColor(model.speedLabel)}`}>
                        <Gauge className="h-3 w-3" />
                        {t(`modelMarketSpeed_${model.speedLabel}`)}
                      </span>
                      {model.paramSize !== '-' && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                          <Layers className="h-3 w-3" />
                          {model.paramSize}
                        </span>
                      )}
                      {model.category.slice(0, 3).map((cat) => (
                        <span key={cat} className="inline-flex items-center gap-0.5 rounded bg-ds-hover px-1.5 py-0.5 text-[10px] text-ds-secondary-text">
                          {getCategoryIcon(cat)}
                          {t(`modelMarketCat_${cat}`)}
                        </span>
                      ))}
                    </div>

                    {isActive && (
                      <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
                        <Check className="h-3 w-3" />
                        {t('modelMarketActive')}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}