import { useState, type ReactElement, useCallback, useRef, useEffect } from 'react'
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
  XCircle,
  Eye,
  Pencil,
  FileImage,
  Sparkles,
  Upload
} from 'lucide-react'


type GenerationType = 'image' | 'video' | 'edit' | 'understand'


const GENERATION_TYPES: { id: GenerationType; icon: ReactElement; labelKey: string; color: string }[] = [
  { id: 'image', icon: <ImageIcon className="h-4 w-4" />, labelKey: 'agnesImage', color: 'from-violet-500 to-purple-500' },
  { id: 'edit', icon: <Pencil className="h-4 w-4" />, labelKey: 'agnesEdit', color: 'from-blue-500 to-cyan-500' },
  { id: 'video', icon: <VideoIcon className="h-4 w-4" />, labelKey: 'agnesVideo', color: 'from-purple-500 to-pink-500' },
  { id: 'understand', icon: <Eye className="h-4 w-4" />, labelKey: 'agnesUnderstand', color: 'from-emerald-500 to-teal-500' }
]

interface AgnesGenerationPanelProps {
  onClose: () => void
}

function getHeaderGradient(type: GenerationType): string {
  const found = GENERATION_TYPES.find(g => g.id === type)
  return found?.color ?? 'from-purple-500 to-pink-500'
}

async function getSettingsModel(type: GenerationType): Promise<string> {
  try {
    const settings = await window.dsGui?.getSettings()
    if (!settings?.agnesGeneration) return ''
    if (type === 'image' || type === 'edit') return settings.agnesGeneration.imageModel || ''
    if (type === 'video') return settings.agnesGeneration.videoModel || ''
    return settings.agnesGeneration.imageModel || ''
  } catch { return '' }
}

export function AgnesGenerationPanel({ onClose }: AgnesGenerationPanelProps): ReactElement {
  const { t } = useTranslation()
  const [generationType, setGenerationType] = useState<GenerationType>('image')
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedSize, setSelectedSize] = useState('1024x1024')
  const [generating, setGenerating] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedImageName, setUploadedImageName] = useState('')
  const [resultContent, setResultContent] = useState<string | null>(null)
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null)
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null)
  const [resultError, setResultError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getSettingsModel(generationType).then((m) => { if (m) setSelectedModel(m) })
  }, [])

  const handleTypeChange = useCallback((type: GenerationType) => {
    setGenerationType(type)
    void getSettingsModel(type).then((m) => setSelectedModel(m))
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
    setResultContent(null)
    setResultImageUrl(null)
    setResultVideoUrl(null)
    setResultError(null)

    try {
      const model = selectedModel
      const dsGui = window.dsGui

      if (generationType === 'image' || generationType === 'edit') {
        const isImg2Img = generationType === 'edit' && !!uploadedImage
        const result = await dsGui.agnesGenerateImage({
          prompt,
          model,
          size: selectedSize,
          ...(isImg2Img ? { image: [uploadedImage!] } : {}),
          returnBase64: true
        })

        if (result.ok) {
          setResultImageUrl(result.imageUrl || (result.imageBase64 ? `data:image/png;base64,${result.imageBase64}` : null))
          setResultContent(`${generationType === 'edit' ? t('agnesImageEdit') : t('agnesImageGeneration')} — ${model}`)
        } else {
          setResultError(result.message)
        }
      } else if (generationType === 'video') {
        const videoPayload: Record<string, unknown> = {
          prompt,
          model,
          numFrames: 121,
          frameRate: 24
        }
        if (uploadedImage) {
          videoPayload.image = uploadedImage
        }
        const result = await dsGui.agnesGenerateVideo(videoPayload as any)

        if (result.ok) {
          setResultVideoUrl(result.videoUrl)
          setResultContent(`${t('agnesVideoGeneration')} — ${model}`)
        } else {
          setResultError(result.message)
        }
      } else {
        setResultContent(`${t('agnesMultimodalUnderstand')} — ${model}`)
        setResultError(t('agnesApiNote'))
      }
    } catch (e) {
      setResultError(e instanceof Error ? e.message : String(e))
    } finally {
      setGenerating(false)
      setPrompt('')
    }
  }, [prompt, selectedModel, generationType, generating, uploadedImage, t])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleGenerate()
    }
  }, [handleGenerate])


  const needsImage = generationType === 'edit' || generationType === 'understand' || generationType === 'video'
  const gradient = getHeaderGradient(generationType)
  const canSubmit = prompt.trim() && !generating && ((generationType === 'edit' || generationType === 'understand') ? !!uploadedImage : true)

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-ds-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
          {/* Model Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-ds-ink">
              {t('agnesModel')}
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-ds-border bg-ds-card px-4 py-2.5 text-sm text-ds-ink placeholder-ds-faint outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              placeholder="agnes-image-2.1-flash"
            />
            <p className="mt-1 text-xs text-ds-muted">
              {t('agnesModelHint')}
            </p>
          </div>

          {/* Size Selector */}
          {(generationType === 'image' || generationType === 'edit') && (
            <div>
              <label className="mb-2 block text-sm font-medium text-ds-ink">
                {t('agnesSize')}
              </label>
              <div className="flex flex-wrap gap-2">
                {['1024x1024', '1024x768', '768x1024', '1280x720', '720x1280', '1536x1024', '1024x1536'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSize(s)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      selectedSize === s
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'bg-ds-subtle text-ds-muted hover:bg-ds-hover'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Image Upload for Edit / Understand */}
          {needsImage && (
            <div>
              <label className="mb-2 block text-sm font-medium text-ds-ink">
                {generationType === 'edit' ? t('agnesUploadImageToEdit') :
                 generationType === 'video' ? t('agnesUploadImageForVideo') :
                 t('agnesUploadImageToUnderstand')}
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

          {/* Result Display */}
          {(resultContent || resultError) && (
            <div className="rounded-xl border border-ds-border bg-ds-subtle p-4">
              {resultError ? (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>{resultError}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-ds-ink">{resultContent}</p>
                  {resultImageUrl && (
                    <img src={resultImageUrl} alt={resultContent ?? ''} className="max-h-64 rounded-lg object-contain" />
                  )}
                  {resultVideoUrl && (
                    <a href={resultVideoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-purple-500 hover:underline">
                      <VideoIcon className="h-4 w-4" />
                      {t('agnesVideoLink')}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

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
