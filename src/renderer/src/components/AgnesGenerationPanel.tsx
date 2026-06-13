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
  Upload,
  CheckCircle2,
  Play,
  ExternalLink
} from 'lucide-react'


type GenerationType = 'image' | 'video' | 'edit' | 'understand'

type GenerationStatus = 'idle' | 'uploading' | 'submitting' | 'processing' | 'polling' | 'done' | 'error'

interface ProgressInfo {
  status: GenerationStatus
  percent: number
  message: string
  elapsed: number
}

const GENERATION_TYPES: { id: GenerationType; icon: ReactElement; labelKey: string; color: string; bg: string }[] = [
  { id: 'image', icon: <ImageIcon className="h-4 w-4" />, labelKey: 'agnesImage', color: 'from-violet-500 to-purple-500', bg: 'bg-violet-500' },
  { id: 'edit', icon: <Pencil className="h-4 w-4" />, labelKey: 'agnesEdit', color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500' },
  { id: 'video', icon: <VideoIcon className="h-4 w-4" />, labelKey: 'agnesVideo', color: 'from-purple-500 to-pink-500', bg: 'bg-purple-500' },
  { id: 'understand', icon: <Eye className="h-4 w-4" />, labelKey: 'agnesUnderstand', color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-500' }
]

interface AgnesGenerationPanelProps {
  onClose: () => void
  initialType?: GenerationType
}

function getHeaderGradient(type: GenerationType): string {
  const found = GENERATION_TYPES.find(g => g.id === type)
  return found?.color ?? 'from-purple-500 to-pink-500'
}

function getProgressBg(type: GenerationType): string {
  const found = GENERATION_TYPES.find(g => g.id === type)
  return found?.bg ?? 'bg-purple-500'
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

async function saveModelToSettings(type: GenerationType, model: string): Promise<void> {
  try {
    const patch: Record<string, Record<string, string>> = type === 'video'
      ? { agnesGeneration: { videoModel: model } }
      : { agnesGeneration: { imageModel: model } }
    await window.dsGui?.setSettings(patch)
  } catch { /* ignore */ }
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m${s > 0 ? ` ${s}s` : ''}`
}

const STATUS_LABELS: Record<GenerationStatus, string> = {
  idle: '',
  uploading: 'agnesStatusUploading',
  submitting: 'agnesStatusSubmitting',
  processing: 'agnesStatusProcessing',
  polling: 'agnesStatusPolling',
  done: 'agnesStatusDone',
  error: 'agnesStatusError'
}

export function AgnesGenerationPanel({ onClose, initialType }: AgnesGenerationPanelProps): ReactElement {
  const { t } = useTranslation()
  const [generationType, setGenerationType] = useState<GenerationType>(initialType ?? 'image')
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedSize, setSelectedSize] = useState('1024x1024')
  const [selectedDuration, setSelectedDuration] = useState('5s')
  const [generating, setGenerating] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedImageName, setUploadedImageName] = useState('')
  const [resultContent, setResultContent] = useState<string | null>(null)
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null)
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null)
  const [resultError, setResultError] = useState<string | null>(null)
  const [progress, setProgress] = useState<ProgressInfo>({ status: 'idle', percent: 0, message: '', elapsed: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const startElapsedTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    elapsedTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setProgress(prev => ({ ...prev, elapsed }))
    }, 1000)
  }, [])

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => { stopElapsedTimer() }
  }, [stopElapsedTimer])

  const handleModelChange = useCallback((value: string) => {
    setSelectedModel(value)
    if (modelSaveTimerRef.current) clearTimeout(modelSaveTimerRef.current)
    modelSaveTimerRef.current = setTimeout(() => {
      void saveModelToSettings(generationType, value)
    }, 800)
  }, [generationType])

  useEffect(() => {
    void getSettingsModel(generationType).then((m) => { if (m) setSelectedModel(m) })
  }, [])

  const handleTypeChange = useCallback((type: GenerationType) => {
    setGenerationType(type)
    void getSettingsModel(type).then((m) => setSelectedModel(m))
    setPrompt('')
    setUploadedImage(null)
    setUploadedImageName('')
    setResultContent(null)
    setResultImageUrl(null)
    setResultVideoUrl(null)
    setResultError(null)
    setProgress({ status: 'idle', percent: 0, message: '', elapsed: 0 })
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
    startElapsedTimer()

    try {
      const model = selectedModel
      const dsGui = window.dsGui

      if (generationType === 'image' || generationType === 'edit') {
        setProgress({ status: 'submitting', percent: 15, message: t('agnesStatusSubmitting'), elapsed: 0 })
        const isImg2Img = generationType === 'edit' && !!uploadedImage
        setProgress(prev => ({ ...prev, status: 'processing', percent: 40, message: t('agnesStatusProcessing') }))
        const result = await dsGui.agnesGenerateImage({
          prompt,
          model,
          size: selectedSize,
          ...(isImg2Img ? { image: [uploadedImage!] } : {}),
          returnBase64: true
        })

        if (result.ok) {
          setProgress(prev => ({ ...prev, status: 'done', percent: 100, message: t('agnesStatusDone') }))
          setResultImageUrl(result.imageUrl || (result.imageBase64 ? `data:image/png;base64,${result.imageBase64}` : null))
          setResultContent(`${generationType === 'edit' ? t('agnesImageEdit') : t('agnesImageGeneration')} — ${model}`)
        } else {
          setProgress(prev => ({ ...prev, status: 'error', percent: 0, message: t('agnesStatusError') }))
          setResultError(result.message)
        }
      } else if (generationType === 'video') {
        setProgress({ status: 'submitting', percent: 10, message: t('agnesStatusSubmitting'), elapsed: 0 })
        const durationMap: Record<string, { numFrames: number; frameRate: number }> = {
          '3s': { numFrames: 73, frameRate: 24 },
          '5s': { numFrames: 121, frameRate: 24 },
          '8s': { numFrames: 193, frameRate: 24 },
          '10s': { numFrames: 241, frameRate: 24 },
          '15s': { numFrames: 361, frameRate: 24 }
        }
        const duration = durationMap[selectedDuration] ?? durationMap['5s']
        const videoPayload: Record<string, unknown> = {
          prompt,
          model,
          numFrames: duration.numFrames,
          frameRate: duration.frameRate
        }
        if (uploadedImage) {
          videoPayload.image = uploadedImage
        }
        setProgress(prev => ({ ...prev, status: 'polling', percent: 20, message: t('agnesStatusPolling') }))
        const result = await dsGui.agnesGenerateVideo(videoPayload as any)

        if (result.ok) {
          setProgress(prev => ({ ...prev, status: 'done', percent: 100, message: t('agnesStatusDone') }))
          setResultVideoUrl(result.videoUrl)
          setResultContent(`${t('agnesVideoGeneration')} — ${model}`)
        } else {
          setProgress(prev => ({ ...prev, status: 'error', percent: 0, message: t('agnesStatusError') }))
          setResultError(result.message)
        }
      } else {
        setResultContent(`${t('agnesMultimodalUnderstand')} — ${model}`)
        setResultError(t('agnesApiNote'))
      }
    } catch (e) {
      setProgress(prev => ({ ...prev, status: 'error', percent: 0, message: t('agnesStatusError') }))
      setResultError(e instanceof Error ? e.message : String(e))
    } finally {
      setGenerating(false)
      stopElapsedTimer()
      setPrompt('')
    }
  }, [prompt, selectedModel, generationType, generating, uploadedImage, t, selectedSize, selectedDuration, startElapsedTimer, stopElapsedTimer])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void handleGenerate()
    }
  }, [handleGenerate])

  const handleDownload = useCallback(async () => {
    if (!resultImageUrl && !resultVideoUrl) return
    const url = resultImageUrl || resultVideoUrl
    if (!url) return
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = `agnes-${generationType}-${Date.now()}.${resultVideoUrl ? 'mp4' : 'png'}`
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch { /* ignore */ }
  }, [resultImageUrl, resultVideoUrl, generationType])

  const needsImage = generationType === 'edit' || generationType === 'understand' || generationType === 'video'
  const gradient = getHeaderGradient(generationType)
  const progressBg = getProgressBg(generationType)
  const canSubmit = prompt.trim() && !generating && ((generationType === 'edit' || generationType === 'understand') ? !!uploadedImage : true)
  const isActive = progress.status !== 'idle' && progress.status !== 'error'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-ds-card shadow-2xl border border-ds-border/50" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`relative overflow-hidden rounded-t-2xl bg-gradient-to-r ${gradient} px-6 py-4`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_70%)]" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                {generationType === 'image' ? <ImageIcon className="h-5 w-5 text-white" /> :
                 generationType === 'video' ? <VideoIcon className="h-5 w-5 text-white" /> :
                 generationType === 'edit' ? <Pencil className="h-5 w-5 text-white" /> :
                 <Eye className="h-5 w-5 text-white" />}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {generationType === 'image' ? t('agnesImageGeneration') :
                   generationType === 'video' ? t('agnesVideoGeneration') :
                   generationType === 'edit' ? t('agnesImageEdit') :
                   t('agnesMultimodalUnderstand')}
                </h2>
                <p className="text-sm text-white/70">Agnes AI</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/70 transition hover:bg-white/20 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
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
          {/* Progress Bar */}
          {isActive && (
            <div className="space-y-2 rounded-xl border border-ds-border bg-ds-subtle p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className={`h-4 w-4 animate-spin text-purple-500`} />
                  <span className="text-sm font-medium text-ds-ink">{progress.message}</span>
                </div>
                {progress.elapsed > 0 && (
                  <span className="text-xs text-ds-muted">{formatElapsed(progress.elapsed)}</span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ds-border/50">
                <div
                  className={`h-full rounded-full ${progressBg} transition-all duration-700 ease-out`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ds-muted">{progress.percent}%</span>
                {generationType === 'video' && progress.status === 'polling' && (
                  <span className="text-xs text-ds-muted">{t('agnesVideoPollingHint')}</span>
                )}
              </div>
            </div>
          )}

          {/* Model Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-ds-ink">
              {t('agnesModel')}
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-ds-border bg-ds-card px-4 py-2.5 text-sm text-ds-ink placeholder-ds-faint outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
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

          {/* Duration Selector for Video */}
          {generationType === 'video' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-ds-ink">
                {t('agnesDuration')}
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '3s', numFrames: 73, frameRate: 24 },
                  { label: '5s', numFrames: 121, frameRate: 24 },
                  { label: '8s', numFrames: 193, frameRate: 24 },
                  { label: '10s', numFrames: 241, frameRate: 24 },
                  { label: '15s', numFrames: 361, frameRate: 24 }
                ].map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setSelectedDuration(d.label)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      selectedDuration === d.label
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'bg-ds-subtle text-ds-muted hover:bg-ds-hover'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-ds-muted">{t('agnesDurationHint')}</p>
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
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <p className="text-sm font-medium text-ds-ink">{resultContent}</p>
                  </div>
                  {resultImageUrl && (
                    <div className="relative group">
                      <img src={resultImageUrl} alt={resultContent ?? ''} className="w-full max-h-80 rounded-lg object-contain border border-ds-border" />
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-medium text-ds-ink shadow-lg transition hover:bg-white"
                        >
                          <Download className="h-4 w-4" />
                          {t('agnesDownload')}
                        </button>
                      </div>
                    </div>
                  )}
                  {resultVideoUrl && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <a href={resultVideoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-1.5 text-sm font-medium text-purple-600 transition hover:bg-purple-500/20 dark:text-purple-400">
                          <ExternalLink className="h-4 w-4" />
                          {t('agnesVideoLink')}
                        </a>
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-ds-subtle px-3 py-1.5 text-sm font-medium text-ds-ink transition hover:bg-ds-hover"
                        >
                          <Download className="h-4 w-4" />
                          {t('agnesDownload')}
                        </button>
                      </div>
                      <video
                        src={resultVideoUrl}
                        controls
                        className="w-full max-h-80 rounded-lg border border-ds-border"
                      />
                    </div>
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
            className={`flex items-center gap-2 rounded-xl bg-gradient-to-r ${gradient} px-5 py-2 text-sm font-medium text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {getSubmitLabel()}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {getSubmitLabel()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
