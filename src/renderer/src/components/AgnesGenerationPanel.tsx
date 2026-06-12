import { useState, type ReactElement, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Download,
  ImageIcon,
  ImagePlus,
  Loader2,
  RefreshCw,
  Send,
  VideoIcon,
  X,
  Eye,
  Pencil,
  FileImage,
  Sparkles,
  Upload
} from 'lucide-react'
import { useChatStore } from '../store/chat-store'

type GenerationType = 'image' | 'video' | 'edit' | 'understand'

type ImageModel = 'agnes-image-2.0-flash' | 'agnes-image-2.1-flash' | 'agnes-image-3.0-flash'
type VideoModel = 'agnes-video-2.0' | 'agnes-video-2.1'
type EditModel = 'agnes-image-3.0-flash' | 'agnes-image-2.1-flash'
type UnderstandModel = 'agnes-vision-2.0' | 'agnes-vision-2.1'

type AnyModel = ImageModel | VideoModel | EditModel | UnderstandModel

const IMAGE_MODELS: { id: ImageModel; name: string; desc: string }[] = [
  { id: 'agnes-image-3.0-flash', name: 'Image 3.0 Flash', desc: '最新高清图像生成' },
  { id: 'agnes-image-2.1-flash', name: 'Image 2.1 Flash', desc: '增强图像生成' },
  { id: 'agnes-image-2.0-flash', name: 'Image 2.0 Flash', desc: '快速图像生成' }
]

const VIDEO_MODELS: { id: VideoModel; name: string; desc: string }[] = [
  { id: 'agnes-video-2.1', name: 'Video 2.1', desc: '增强视频生成，支持音视频同步' },
  { id: 'agnes-video-2.0', name: 'Video 2.0', desc: 'AI 视频生成' }
]

const EDIT_MODELS: { id: EditModel; name: string; desc: string }[] = [
  { id: 'agnes-image-3.0-flash', name: 'Image 3.0 Flash', desc: '最佳图像编辑质量' },
  { id: 'agnes-image-2.1-flash', name: 'Image 2.1 Flash', desc: '快速图像编辑' }
]

const UNDERSTAND_MODELS: { id: UnderstandModel; name: string; desc: string }[] = [
  { id: 'agnes-vision-2.1', name: 'Vision 2.1', desc: '增强多模态理解' },
  { id: 'agnes-vision-2.0', name: 'Vision 2.0', desc: '图片/视频理解分析' }
]

const GENERATION_TYPES: { id: GenerationType; icon: ReactElement; labelKey: string; color: string }[] = [
  { id: 'image', icon: <ImageIcon className="h-4 w-4" />, labelKey: 'agnesImage', color: 'from-violet-500 to-purple-500' },
  { id: 'edit', icon: <Pencil className="h-4 w-4" />, labelKey: 'agnesEdit', color: 'from-blue-500 to-cyan-500' },
  { id: 'video', icon: <VideoIcon className="h-4 w-4" />, labelKey: 'agnesVideo', color: 'from-purple-500 to-pink-500' },
  { id: 'understand', icon: <Eye className="h-4 w-4" />, labelKey: 'agnesUnderstand', color: 'from-emerald-500 to-teal-500' }
]

interface AgnesGenerationPanelProps {
  onClose: () => void
}

function getDefaultModel(type: GenerationType): AnyModel {
  switch (type) {
    case 'image': return 'agnes-image-3.0-flash'
    case 'video': return 'agnes-video-2.1'
    case 'edit': return 'agnes-image-3.0-flash'
    case 'understand': return 'agnes-vision-2.1'
  }
}

function getModels(type: GenerationType) {
  switch (type) {
    case 'image': return IMAGE_MODELS
    case 'video': return VIDEO_MODELS
    case 'edit': return EDIT_MODELS
    case 'understand': return UNDERSTAND_MODELS
  }
}

function getHeaderGradient(type: GenerationType): string {
  const found = GENERATION_TYPES.find(g => g.id === type)
  return found?.color ?? 'from-purple-500 to-pink-500'
}

export function AgnesGenerationPanel({ onClose }: AgnesGenerationPanelProps): ReactElement {
  const { t } = useTranslation()
  const addComposerMessage = useChatStore((s) => s.addComposerMessage)
  const [generationType, setGenerationType] = useState<GenerationType>('image')
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<AnyModel>('agnes-image-3.0-flash')
  const [generating, setGenerating] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedImageName, setUploadedImageName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleTypeChange = useCallback((type: GenerationType) => {
    setGenerationType(type)
    setSelectedModel(getDefaultModel(type))
    setPrompt('')
    setUploadedImage(null)
    setUploadedImageName('')
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return
    setUploadedImageName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      setUploadedImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return
    if ((generationType === 'edit' || generationType === 'understand') && !uploadedImage) return

    setGenerating(true)

    try {
      const model = selectedModel
      let typeLabel: string
      let systemPrompt: string

      switch (generationType) {
        case 'image':
          typeLabel = t('agnesImageGeneration')
          systemPrompt = 'You are an AI image generation assistant. Generate a high-quality image based on the user prompt.'
          break
        case 'video':
          typeLabel = t('agnesVideoGeneration')
          systemPrompt = 'You are an AI video generation assistant. Generate a high-quality video based on the user prompt. Support audio-video sync when applicable.'
          break
        case 'edit':
          typeLabel = t('agnesImageEdit')
          systemPrompt = 'You are an AI image editing assistant. Modify the provided image according to the user instructions while preserving the original structure.'
          break
        case 'understand':
          typeLabel = t('agnesMultimodalUnderstand')
          systemPrompt = 'You are a multimodal AI assistant. Analyze and understand the provided image or video content in detail.'
          break
      }

      const hasImage = generationType === 'edit' || generationType === 'understand'
      const imageInfo = hasImage && uploadedImageName ? `\n**${t('agnesReferenceImage')}**: ${uploadedImageName}` : ''

      const message = `[Agnes AI - ${typeLabel}]\n\n**${t('agnesModel')}**: ${model}\n**${t('agnesPrompt')}**: ${prompt}${imageInfo}\n\n[Processing...]`

      addComposerMessage({
        role: 'user',
        content: message
      })

      setTimeout(() => {
        addComposerMessage({
          role: 'assistant',
          content: `[Agnes AI ${typeLabel}]\n\n${t('agnesRequestSubmitted')}\n\n**${t('agnesModel')}**: ${model}\n**${t('agnesPrompt')}**: ${prompt}${imageInfo}\n\n${t('agnesApiNote')}`
        })
        setGenerating(false)
        setPrompt('')
      }, 1000)
    } catch {
      setGenerating(false)
    }
  }, [prompt, selectedModel, generationType, addComposerMessage, generating, uploadedImage, uploadedImageName, t])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleGenerate()
    }
  }, [handleGenerate])

  const models = getModels(generationType)
  const needsImage = generationType === 'edit' || generationType === 'understand'
  const gradient = getHeaderGradient(generationType)
  const canSubmit = prompt.trim() && !generating && (!needsImage || !!uploadedImage)

  const getPlaceholder = (): string => {
    switch (generationType) {
      case 'image': return t('agnesImagePromptPlaceholder')
      case 'video': return t('agnesVideoPromptPlaceholder')
      case 'edit': return t('agnesEditPromptPlaceholder')
      case 'understand': return t('agnesUnderstandPromptPlaceholder')
    }
  }

  const getSubmitLabel = (): string => {
    if (generating) return t('agnesGenerating')
    switch (generationType) {
      case 'image': return t('agnesGenerateImage')
      case 'video': return t('agnesGenerateVideo')
      case 'edit': return t('agnesEditImage')
      case 'understand': return t('agnesAnalyze')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-ds-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ds-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}>
              {generationType === 'image' ? <ImageIcon className="h-5 w-5 text-white" /> :
               generationType === 'video' ? <VideoIcon className="h-5 w-5 text-white" /> :
               generationType === 'edit' ? <Pencil className="h-5 w-5 text-white" /> :
               <Eye className="h-5 w-5 text-white" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ds-ink">
                {generationType === 'image' ? t('agnesImageGeneration') :
                 generationType === 'video' ? t('agnesVideoGeneration') :
                 generationType === 'edit' ? t('agnesImageEdit') :
                 t('agnesMultimodalUnderstand')}
              </h2>
              <p className="text-sm text-ds-muted">Agnes AI</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Type Selector */}
        <div className="flex gap-1.5 border-b border-ds-border px-4 py-2.5">
          {GENERATION_TYPES.map((gt) => (
            <button
              key={gt.id}
              type="button"
              onClick={() => handleTypeChange(gt.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                generationType === gt.id
                  ? `bg-gradient-to-r ${gt.color} text-white shadow-sm`
                  : 'bg-ds-subtle text-ds-muted hover:bg-ds-hover'
              }`}
            >
              {gt.icon}
              {t(gt.labelKey)}
            </button>
          ))}
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Model Selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-ds-ink">
              {t('agnesModel')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedModel(model.id)}
                  className={`rounded-lg border p-3 text-left transition ${
                    selectedModel === model.id
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-ds-border bg-ds-subtle hover:border-ds-border/80'
                  }`}
                >
                  <div className="text-sm font-medium text-ds-ink">{model.name}</div>
                  <div className="mt-1 text-xs text-ds-muted">{model.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Image Upload for Edit / Understand */}
          {needsImage && (
            <div>
              <label className="mb-2 block text-sm font-medium text-ds-ink">
                {generationType === 'edit' ? t('agnesUploadImageToEdit') : t('agnesUploadImageToUnderstand')}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              {uploadedImage ? (
                <div className="relative rounded-xl border border-ds-border bg-ds-subtle p-2">
                  <div className="flex items-center gap-3">
                    {uploadedImageName.match(/\.(mp4|webm|mov)$/i) ? (
                      <VideoIcon className="h-8 w-8 text-ds-muted" />
                    ) : (
                      <img src={uploadedImage} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-ds-ink">{uploadedImageName}</p>
                      <p className="text-xs text-ds-muted">{t('agnesImageUploaded')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setUploadedImage(null); setUploadedImageName('') }}
                      className="rounded-lg p-1.5 text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ds-border bg-ds-subtle p-6 text-ds-muted transition hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                >
                  <Upload className="h-8 w-8" />
                  <span className="text-sm font-medium">{t('agnesClickToUpload')}</span>
                  <span className="text-xs">{t('agnesSupportedFormats')}</span>
                </button>
              )}
            </div>
          )}

          {/* Prompt Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-ds-ink">
              {t('agnesPrompt')}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              className="h-32 w-full rounded-xl border border-ds-border bg-ds-card p-4 text-sm text-ds-ink placeholder-ds-faint outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
            />
            <p className="mt-1 text-xs text-ds-muted">
              {t('agnesPromptHint')}
            </p>
          </div>

          {/* Scenario suggestions */}
          <div>
            <label className="mb-2 block text-sm font-medium text-ds-ink">
              {t('agnesScenarios')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {generationType === 'image' && [
                t('agnesScenarioTextToImage'), t('agnesScenarioProduct'), t('agnesScenarioPoster'), t('agnesScenarioCharacter'), t('agnesScenarioSocial')
              ].map((s) => (
                <button key={s} type="button" onClick={() => setPrompt(s)}
                  className="rounded-full bg-ds-subtle px-3 py-1 text-xs text-ds-muted transition hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/20 dark:hover:text-purple-300">
                  {s}
                </button>
              ))}
              {generationType === 'video' && [
                t('agnesScenarioAITextToVideo'), t('agnesScenarioImageToVideo'), t('agnesScenarioShortVideo'), t('agnesScenarioAd'), t('agnesScenarioCharacterAnim'), t('agnesScenarioAudioSync')
              ].map((s) => (
                <button key={s} type="button" onClick={() => setPrompt(s)}
                  className="rounded-full bg-ds-subtle px-3 py-1 text-xs text-ds-muted transition hover:bg-pink-100 hover:text-pink-700 dark:hover:bg-pink-900/20 dark:hover:text-pink-300">
                  {s}
                </button>
              ))}
              {generationType === 'edit' && [
                t('agnesScenarioStyleTransfer'), t('agnesScenarioOptimize'), t('agnesScenarioRemoveBg'), t('agnesScenarioRetouch'), t('agnesScenarioColorAdjust')
              ].map((s) => (
                <button key={s} type="button" onClick={() => setPrompt(s)}
                  className="rounded-full bg-ds-subtle px-3 py-1 text-xs text-ds-muted transition hover:bg-cyan-100 hover:text-cyan-700 dark:hover:bg-cyan-900/20 dark:hover:text-cyan-300">
                  {s}
                </button>
              ))}
              {generationType === 'understand' && [
                t('agnesScenarioImageUnderstand'), t('agnesScenarioVideoUnderstand'), t('agnesScenarioCreativeWorkflow'), t('agnesScenarioAISocial'), t('agnesScenarioMultimodalAssistant')
              ].map((s) => (
                <button key={s} type="button" onClick={() => setPrompt(s)}
                  className="rounded-full bg-ds-subtle px-3 py-1 text-xs text-ds-muted transition hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-ds-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-ds-border bg-ds-subtle px-4 py-2 text-sm font-medium text-ds-ink transition hover:bg-ds-hover"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!canSubmit}
            className={`flex items-center gap-2 rounded-xl bg-gradient-to-r ${gradient} px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {getSubmitLabel()}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {getSubmitLabel()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
