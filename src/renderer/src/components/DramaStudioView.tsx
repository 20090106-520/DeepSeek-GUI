import { useState, useCallback, useRef, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Clapperboard,
  Download,
  Film,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  VideoIcon,
  X,
  Music,
  ChevronDown,
  ChevronUp,
  Play,
  CheckCircle2,
  XCircle,
  Wand2,
  Mic,
  Type,
  Palette,
  Settings2,
  MonitorPlay,
  Volume2,
  GripVertical,
  Copy
} from 'lucide-react'

type DramaStep = {
  id: string
  script: string
  imageUrl: string | null
  videoUrl: string | null
  audioUrl: string | null
  status: 'pending' | 'generating_image' | 'generating_video' | 'generating_audio' | 'done' | 'error'
  error: string | null
}

type DramaGenre = 'romance' | 'suspense' | 'comedy' | 'scifi' | 'historical' | 'urban' | 'fantasy'
type AspectRatio = '9:16' | '16:9' | '1:1'
type VoiceId = 'alloy' | 'echo' | 'shimmer' | 'nova' | 'fable'
type SubtitlePosition = 'bottom' | 'center' | 'top'
type VideoSource = 'ai' | 'local'

const ASPECT_SIZE_MAP: Record<AspectRatio, { image: string; label: string }> = {
  '9:16': { image: '720x1280', label: '📱' },
  '16:9': { image: '1280x720', label: '🖥️' },
  '1:1': { image: '1024x1024', label: '⬜' }
}

const VOICE_OPTIONS: { id: VoiceId; label: string; desc: string }[] = [
  { id: 'alloy', label: 'Alloy', desc: '中性' },
  { id: 'echo', label: 'Echo', desc: '男声' },
  { id: 'shimmer', label: 'Shimmer', desc: '女声' },
  { id: 'nova', label: 'Nova', desc: '活力' },
  { id: 'fable', label: 'Fable', desc: '叙事' }
]

const SUBTITLE_FONTS = ['Default', 'Noto Sans SC', 'Microsoft YaHei', 'SimHei', 'KaiTi']
const SUBTITLE_COLORS = ['#FFFFFF', '#FFFF00', '#00FF00', '#00BFFF', '#FF6B6B', '#FF69B4']

type DramaProject = {
  title: string
  genre: DramaGenre
  steps: DramaStep[]
  status: 'idle' | 'generating_script' | 'generating_media' | 'done' | 'error'
  error: string | null
}

type DramaSettings = {
  aspectRatio: AspectRatio
  duration: string
  videoSource: VideoSource
  voiceEnabled: boolean
  voiceId: VoiceId
  voiceSpeed: number
  subtitleEnabled: boolean
  subtitleFont: string
  subtitleColor: string
  subtitleSize: number
  subtitlePosition: SubtitlePosition
  subtitleStroke: boolean
  bgmEnabled: boolean
  bgmVolume: number
}

const DEFAULT_DRAMA_SETTINGS: DramaSettings = {
  aspectRatio: '9:16',
  duration: '5s',
  videoSource: 'ai',
  voiceEnabled: false,
  voiceId: 'alloy',
  voiceSpeed: 1.0,
  subtitleEnabled: true,
  subtitleFont: 'Default',
  subtitleColor: '#FFFFFF',
  subtitleSize: 24,
  subtitlePosition: 'bottom',
  subtitleStroke: true,
  bgmEnabled: false,
  bgmVolume: 0.5
}

const GENRE_CONFIG: { id: DramaGenre; labelKey: string; emoji: string; color: string }[] = [
  { id: 'romance', labelKey: 'dramaGenreRomance', emoji: '💕', color: 'from-pink-500 to-rose-500' },
  { id: 'suspense', labelKey: 'dramaGenreSuspense', emoji: '🔍', color: 'from-gray-700 to-gray-900' },
  { id: 'comedy', labelKey: 'dramaGenreComedy', emoji: '😂', color: 'from-yellow-400 to-orange-500' },
  { id: 'scifi', labelKey: 'dramaGenreSciFi', emoji: '🚀', color: 'from-cyan-500 to-blue-600' },
  { id: 'historical', labelKey: 'dramaGenreHistorical', emoji: '🏯', color: 'from-amber-600 to-red-700' },
  { id: 'urban', labelKey: 'dramaGenreUrban', emoji: '🏙️', color: 'from-slate-500 to-zinc-700' },
  { id: 'fantasy', labelKey: 'dramaGenreFantasy', emoji: '🧙', color: 'from-violet-500 to-purple-700' }
]

function makeStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function makeEmptyStep(): DramaStep {
  return { id: makeStepId(), script: '', imageUrl: null, videoUrl: null, audioUrl: null, status: 'pending', error: null }
}

function makeEmptyProject(): DramaProject {
  return {
    title: '',
    genre: 'romance',
    steps: [makeEmptyStep(), makeEmptyStep(), makeEmptyStep()],
    status: 'idle',
    error: null
  }
}

const STEP_STATUS_LABELS: Record<DramaStep['status'], string> = {
  pending: 'dramaStepPending',
  generating_image: 'dramaStepGeneratingImage',
  generating_video: 'dramaStepGeneratingVideo',
  generating_audio: 'dramaStepGeneratingAudio',
  done: 'dramaStepDone',
  error: 'dramaStepError'
}

type SettingsTab = 'video' | 'voice' | 'subtitle' | 'bgm'

function SettingsPanel({ settings, onChange, disabled }: {
  settings: DramaSettings
  onChange: (patch: Partial<DramaSettings>) => void
  disabled: boolean
}): ReactElement {
  const { t } = useTranslation('common')
  const [activeTab, setActiveTab] = useState<SettingsTab>('video')

  const tabs: { id: SettingsTab; icon: ReactElement; label: string }[] = [
    { id: 'video', icon: <MonitorPlay className="h-4 w-4" />, label: t('dramaTabVideo') },
    { id: 'voice', icon: <Mic className="h-4 w-4" />, label: t('dramaTabVoice') },
    { id: 'subtitle', icon: <Type className="h-4 w-4" />, label: t('dramaTabSubtitle') },
    { id: 'bgm', icon: <Music className="h-4 w-4" />, label: t('dramaTabBgm') }
  ]

  return (
    <div className="rounded-2xl border border-ds-border bg-ds-card shadow-sm">
      <div className="flex border-b border-ds-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            disabled={disabled}
            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition ${
              activeTab === tab.id
                ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400'
                : 'text-ds-muted hover:text-ds-ink'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'video' && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-ds-muted">{t('dramaAspectRatio')}</label>
              <div className="flex gap-2">
                {(['9:16', '16:9', '1:1'] as AspectRatio[]).map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => onChange({ aspectRatio: ar })}
                    disabled={disabled}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                      settings.aspectRatio === ar
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'bg-ds-subtle text-ds-muted hover:bg-ds-hover'
                    }`}
                  >
                    <span>{ASPECT_SIZE_MAP[ar].label}</span>
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-ds-muted">{t('dramaDuration')}</label>
              <div className="flex flex-wrap gap-2">
                {['3s', '5s', '8s', '10s', '15s'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onChange({ duration: d })}
                    disabled={disabled}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      settings.duration === d
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'bg-ds-subtle text-ds-muted hover:bg-ds-hover'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-ds-muted">{t('dramaVideoSource')}</label>
              <div className="flex gap-2">
                {([
                  { id: 'ai' as VideoSource, label: t('dramaVideoSourceAI'), icon: <Sparkles className="h-3.5 w-3.5" /> },
                  { id: 'local' as VideoSource, label: t('dramaVideoSourceLocal'), icon: <Film className="h-3.5 w-3.5" /> }
                ]).map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => onChange({ videoSource: src.id })}
                    disabled={disabled}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                      settings.videoSource === src.id
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'bg-ds-subtle text-ds-muted hover:bg-ds-hover'
                    }`}
                  >
                    {src.icon}
                    {src.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ds-muted">{t('dramaVoiceEnabled')}</label>
              <button
                type="button"
                onClick={() => onChange({ voiceEnabled: !settings.voiceEnabled })}
                disabled={disabled}
                className={`relative h-5 w-9 rounded-full transition ${
                  settings.voiceEnabled ? 'bg-purple-500' : 'bg-ds-subtle'
                }`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                  settings.voiceEnabled ? 'left-[18px]' : 'left-0.5'
                }`} />
              </button>
            </div>

            {settings.voiceEnabled && (
              <>
                <div>
                  <label className="mb-2 block text-xs font-medium text-ds-muted">{t('dramaVoiceSelect')}</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {VOICE_OPTIONS.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => onChange({ voiceId: v.id })}
                        disabled={disabled}
                        className={`rounded-lg px-2 py-2 text-center text-xs font-medium transition ${
                          settings.voiceId === v.id
                            ? 'bg-purple-500 text-white shadow-sm'
                            : 'bg-ds-subtle text-ds-muted hover:bg-ds-hover'
                        }`}
                      >
                        <div>{v.label}</div>
                        <div className="text-[10px] opacity-70">{v.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ds-muted">
                    {t('dramaVoiceSpeed')}: {settings.voiceSpeed.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={settings.voiceSpeed}
                    onChange={(e) => onChange({ voiceSpeed: parseFloat(e.target.value) })}
                    disabled={disabled}
                    className="w-full accent-purple-500"
                  />
                  <div className="mt-0.5 flex justify-between text-[10px] text-ds-faint">
                    <span>0.5x</span>
                    <span>1.0x</span>
                    <span>2.0x</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'subtitle' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ds-muted">{t('dramaSubtitleEnabled')}</label>
              <button
                type="button"
                onClick={() => onChange({ subtitleEnabled: !settings.subtitleEnabled })}
                disabled={disabled}
                className={`relative h-5 w-9 rounded-full transition ${
                  settings.subtitleEnabled ? 'bg-purple-500' : 'bg-ds-subtle'
                }`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                  settings.subtitleEnabled ? 'left-[18px]' : 'left-0.5'
                }`} />
              </button>
            </div>

            {settings.subtitleEnabled && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ds-muted">{t('dramaSubtitleFont')}</label>
                  <select
                    value={settings.subtitleFont}
                    onChange={(e) => onChange({ subtitleFont: e.target.value })}
                    disabled={disabled}
                    className="w-full rounded-lg border border-ds-border bg-ds-main px-3 py-2 text-xs text-ds-ink outline-none focus:border-purple-500"
                  >
                    {SUBTITLE_FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ds-muted">{t('dramaSubtitleColor')}</label>
                  <div className="flex gap-2">
                    {SUBTITLE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onChange({ subtitleColor: c })}
                        disabled={disabled}
                        className={`h-7 w-7 rounded-full border-2 transition ${
                          settings.subtitleColor === c ? 'border-purple-500 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ds-muted">
                    {t('dramaSubtitleSize')}: {settings.subtitleSize}px
                  </label>
                  <input
                    type="range"
                    min="16"
                    max="48"
                    step="2"
                    value={settings.subtitleSize}
                    onChange={(e) => onChange({ subtitleSize: parseInt(e.target.value) })}
                    disabled={disabled}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ds-muted">{t('dramaSubtitlePosition')}</label>
                  <div className="flex gap-2">
                    {(['top', 'center', 'bottom'] as SubtitlePosition[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onChange({ subtitlePosition: p })}
                        disabled={disabled}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          settings.subtitlePosition === p
                            ? 'bg-purple-500 text-white shadow-sm'
                            : 'bg-ds-subtle text-ds-muted hover:bg-ds-hover'
                        }`}
                      >
                        {t(`dramaSubtitlePos${p.charAt(0).toUpperCase() + p.slice(1)}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-ds-muted">{t('dramaSubtitleStroke')}</label>
                  <button
                    type="button"
                    onClick={() => onChange({ subtitleStroke: !settings.subtitleStroke })}
                    disabled={disabled}
                    className={`relative h-5 w-9 rounded-full transition ${
                      settings.subtitleStroke ? 'bg-purple-500' : 'bg-ds-subtle'
                    }`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                      settings.subtitleStroke ? 'left-[18px]' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'bgm' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ds-muted">{t('dramaBgmEnabled')}</label>
              <button
                type="button"
                onClick={() => onChange({ bgmEnabled: !settings.bgmEnabled })}
                disabled={disabled}
                className={`relative h-5 w-9 rounded-full transition ${
                  settings.bgmEnabled ? 'bg-purple-500' : 'bg-ds-subtle'
                }`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                  settings.bgmEnabled ? 'left-[18px]' : 'left-0.5'
                }`} />
              </button>
            </div>

            {settings.bgmEnabled && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ds-muted">
                  <Volume2 className="mr-1 inline h-3.5 w-3.5" />
                  {t('dramaBgmVolume')}: {Math.round(settings.bgmVolume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.bgmVolume}
                  onChange={(e) => onChange({ bgmVolume: parseFloat(e.target.value) })}
                  disabled={disabled}
                  className="w-full accent-purple-500"
                />
                <div className="mt-0.5 flex justify-between text-[10px] text-ds-faint">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function DramaStudioView(): ReactElement {
  const { t } = useTranslation('common')
  const [project, setProject] = useState<DramaProject>(makeEmptyProject)
  const [dramaSettings, setDramaSettings] = useState<DramaSettings>(DEFAULT_DRAMA_SETTINGS)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const updateProject = useCallback((patch: Partial<DramaProject>) => {
    setProject((prev) => ({ ...prev, ...patch }))
  }, [])

  const updateDramaSettings = useCallback((patch: Partial<DramaSettings>) => {
    setDramaSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const updateStep = useCallback((stepId: string, patch: Partial<DramaStep>) => {
    setProject((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => s.id === stepId ? { ...s, ...patch } : s)
    }))
  }, [])

  const addStep = useCallback(() => {
    setProject((prev) => ({
      ...prev,
      steps: [...prev.steps, makeEmptyStep()]
    }))
  }, [])

  const duplicateStep = useCallback((stepId: string) => {
    setProject((prev) => {
      const idx = prev.steps.findIndex((s) => s.id === stepId)
      if (idx < 0) return prev
      const source = prev.steps[idx]
      const dup: DramaStep = {
        ...makeEmptyStep(),
        script: source.script
      }
      const newSteps = [...prev.steps]
      newSteps.splice(idx + 1, 0, dup)
      return { ...prev, steps: newSteps }
    })
  }, [])

  const removeStep = useCallback((stepId: string) => {
    setProject((prev) => ({
      ...prev,
      steps: prev.steps.length <= 1 ? prev.steps : prev.steps.filter((s) => s.id !== stepId)
    }))
  }, [])

  const handleGenerateScript = useCallback(async () => {
    if (!project.title.trim()) return
    updateProject({ status: 'generating_script', error: null })
    try {
      const settings = await window.dsGui?.getSettings()
      const agnes = settings?.agnesGeneration
      if (!agnes?.enabled || !agnes.apiKey.trim()) {
        updateProject({ status: 'error', error: t('dramaErrorNoAgnes') })
        return
      }
      const baseUrl = agnes.baseUrl.replace(/\/+$/, '')
      const genreLabel = GENRE_CONFIG.find((g) => g.id === project.genre)?.emoji ?? ''
      const arDesc = dramaSettings.aspectRatio === '9:16' ? '竖屏短视频' : dramaSettings.aspectRatio === '16:9' ? '横屏' : '方形'
      const prompt = `你是一个专业的短剧编剧。请为以下短剧项目生成分镜脚本。

短剧标题：${project.title}
类型：${genreLabel} ${t(GENRE_CONFIG.find((g) => g.id === project.genre)?.labelKey ?? '')}
画面比例：${arDesc}（${dramaSettings.aspectRatio}）
${dramaSettings.voiceEnabled ? '需要配音对白' : ''}
${dramaSettings.subtitleEnabled ? '需要字幕文本' : ''}

要求：
1. 生成 ${project.steps.length} 个分镜
2. 每个分镜包含：场景描述、人物动作、对白/旁白
3. 每个分镜用 "---" 分隔
4. 每个分镜第一行是场景标题（用【】包围）
5. 内容要紧凑、有悬念、吸引观众
6. ${dramaSettings.aspectRatio === '9:16' ? '竖屏构图，注意人物居中，上下留白' : '横屏构图，注意场景宽度'}
7. ${dramaSettings.voiceEnabled ? '对白要自然口语化，适合配音朗读' : '以画面叙事为主，减少对白'}

请直接输出分镜内容，不要额外解释。`

      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agnes.apiKey.trim()}`
        },
        body: JSON.stringify({
          model: agnes.imageModel || 'agnes-2.0-flash',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096
        })
      })

      if (!res.ok) {
        const text = await res.text()
        updateProject({ status: 'error', error: `API error ${res.status}: ${text.slice(0, 300)}` })
        return
      }

      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      const content = data.choices?.[0]?.message?.content ?? ''
      const parts = content.split(/\n*---\n*/).filter((s: string) => s.trim())

      const newSteps: DramaStep[] = parts.slice(0, project.steps.length).map((script: string, i: number) => ({
        ...(project.steps[i] ?? makeEmptyStep()),
        id: project.steps[i]?.id ?? makeStepId(),
        script: script.trim(),
        status: 'pending' as const,
        error: null,
        imageUrl: null,
        videoUrl: null,
        audioUrl: null
      }))

      while (newSteps.length < project.steps.length) {
        newSteps.push(project.steps[newSteps.length] ?? makeEmptyStep())
      }

      updateProject({ steps: newSteps, status: 'idle' })
    } catch (e) {
      updateProject({ status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }, [project, dramaSettings, t, updateProject])

  const handleGenerateAllMedia = useCallback(async () => {
    const settings = await window.dsGui?.getSettings()
    const agnes = settings?.agnesGeneration
    if (!agnes?.enabled || !agnes.apiKey.trim()) {
      updateProject({ status: 'error', error: t('dramaErrorNoAgnes') })
      return
    }

    updateProject({ status: 'generating_media', error: null })
    const controller = new AbortController()
    abortRef.current = controller

    const durationMap: Record<string, { numFrames: number; frameRate: number }> = {
      '3s': { numFrames: 73, frameRate: 24 },
      '5s': { numFrames: 121, frameRate: 24 },
      '8s': { numFrames: 193, frameRate: 24 },
      '10s': { numFrames: 241, frameRate: 24 },
      '15s': { numFrames: 361, frameRate: 24 }
    }
    const duration = durationMap[dramaSettings.duration] ?? durationMap['5s']
    const imageSize = ASPECT_SIZE_MAP[dramaSettings.aspectRatio].image

    for (const step of project.steps) {
      if (controller.signal.aborted) break
      if (!step.script.trim()) continue

      updateStep(step.id, { status: 'generating_image', error: null })

      try {
        const imageResult = await window.dsGui?.agnesGenerateImage({
          prompt: `短剧分镜画面：${step.script.split('\n')[0]}\n\n电影级画面，专业构图，4K画质，${dramaSettings.aspectRatio === '9:16' ? '竖屏构图' : dramaSettings.aspectRatio === '16:9' ? '横屏构图' : '方形构图'}`,
          model: agnes.imageModel || 'agnes-image-2.1-flash',
          size: imageSize,
          returnBase64: true
        })

        if (imageResult?.ok) {
          updateStep(step.id, {
            imageUrl: imageResult.imageUrl || (imageResult.imageBase64 ? `data:image/png;base64,${imageResult.imageBase64}` : null),
            status: 'generating_video'
          })

          const videoPayload: Record<string, unknown> = {
            prompt: step.script.split('\n').slice(0, 2).join('\n'),
            model: agnes.videoModel || 'agnes-video-v2.0',
            numFrames: duration.numFrames,
            frameRate: duration.frameRate
          }
          if (imageResult.imageBase64) {
            videoPayload.image = `data:image/png;base64,${imageResult.imageBase64}`
          }

          const videoResult = await window.dsGui?.agnesGenerateVideo(videoPayload as any)
          if (videoResult?.ok) {
            updateStep(step.id, { videoUrl: videoResult.videoUrl, status: 'done' })
          } else {
            updateStep(step.id, { status: 'done', error: videoResult?.message ?? 'Video generation failed' })
          }
        } else {
          updateStep(step.id, { status: 'error', error: imageResult?.message ?? 'Image generation failed' })
        }
      } catch (e) {
        updateStep(step.id, { status: 'error', error: e instanceof Error ? e.message : String(e) })
      }
    }

    updateProject({ status: 'done' })
  }, [project, dramaSettings, t, updateProject, updateStep])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    updateProject({ status: 'idle' })
  }, [updateProject])

  const handleReset = useCallback(() => {
    setProject(makeEmptyProject())
  }, [])

  const isBusy = project.status === 'generating_script' || project.status === 'generating_media'
  const completedCount = project.steps.filter((s) => s.status === 'done').length
  const totalCount = project.steps.length
  const hasAnyMedia = project.steps.some((s) => s.imageUrl || s.videoUrl)

  return (
    <div className="flex h-full flex-col bg-ds-main">
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 px-6 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.06),transparent_50%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Clapperboard className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('dramaStudioTitle')}</h1>
              <p className="text-sm text-white/70">{t('dramaStudioSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium backdrop-blur-sm transition ${
                showSettings ? 'bg-white/30 text-white' : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <Settings2 className="h-4 w-4" />
              {t('dramaSettings')}
            </button>
            {isBusy && (
              <button
                type="button"
                onClick={handleStop}
                className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/30"
              >
                <X className="h-4 w-4" />
                {t('cancel')}
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <RefreshCw className="h-4 w-4" />
              {t('dramaReset')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-5">
              <div className="rounded-2xl border border-ds-border bg-ds-card p-5 shadow-sm">
                <h2 className="mb-3 text-base font-semibold text-ds-ink">{t('dramaProjectConfig')}</h2>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ds-ink">{t('dramaTitle')}</label>
                    <input
                      type="text"
                      value={project.title}
                      onChange={(e) => updateProject({ title: e.target.value })}
                      placeholder={t('dramaTitlePlaceholder')}
                      className="w-full rounded-xl border border-ds-border bg-ds-main px-4 py-2.5 text-sm text-ds-ink placeholder-ds-faint outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                      disabled={isBusy}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ds-ink">{t('dramaGenre')}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {GENRE_CONFIG.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => updateProject({ genre: g.id })}
                          disabled={isBusy}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                            project.genre === g.id
                              ? `bg-gradient-to-r ${g.color} text-white shadow-sm`
                              : 'bg-ds-subtle text-ds-muted hover:bg-ds-hover'
                          }`}
                        >
                          <span>{g.emoji}</span>
                          {t(g.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleGenerateScript()}
                    disabled={!project.title.trim() || isBusy}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Wand2 className="h-4 w-4" />
                    {t('dramaGenerateScript')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleGenerateAllMedia()}
                    disabled={!project.steps.some((s) => s.script.trim()) || isBusy}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t('dramaGenerateAllMedia')}
                  </button>
                </div>
              </div>

              {isBusy && (
                <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400" />
                    <div>
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                        {project.status === 'generating_script' ? t('dramaGeneratingScript') : t('dramaGeneratingMedia')}
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">
                        {completedCount}/{totalCount} {t('dramaStepsCompleted')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-purple-200 dark:bg-purple-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-700"
                      style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {project.error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  <XCircle className="h-4 w-4 shrink-0" />
                  {project.error}
                </div>
              )}
            </div>

            <div className={showSettings ? 'block' : 'hidden lg:block'}>
              <SettingsPanel settings={dramaSettings} onChange={updateDramaSettings} disabled={isBusy} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ds-ink">
                {t('dramaSteps')} ({project.steps.length})
              </h2>
              <button
                type="button"
                onClick={addStep}
                disabled={isBusy}
                className="flex items-center gap-1.5 rounded-lg bg-ds-subtle px-3 py-1.5 text-xs font-medium text-ds-muted transition hover:bg-ds-hover disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('dramaAddStep')}
              </button>
            </div>

            {project.steps.map((step, index) => (
              <div
                key={step.id}
                className="rounded-2xl border border-ds-border bg-ds-card shadow-sm transition hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                    step.status === 'done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    step.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    step.status !== 'pending' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                    'bg-ds-subtle text-ds-muted'
                  }`}>
                    {step.status === 'done' ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                     step.status === 'error' ? <XCircle className="h-3.5 w-3.5" /> :
                     step.status !== 'pending' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                     index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-ds-ink">
                      {step.script ? step.script.split('\n')[0].replace(/^[【\[]/, '').replace(/[】\]]$/, '') : `${t('dramaStep')} ${index + 1}`}
                    </p>
                    <p className="text-xs text-ds-muted">{t(STEP_STATUS_LABELS[step.status])}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {step.imageUrl && <ImageIcon className="h-3.5 w-3.5 text-violet-500" />}
                    {step.videoUrl && <VideoIcon className="h-3.5 w-3.5 text-fuchsia-500" />}
                    {step.audioUrl && <Mic className="h-3.5 w-3.5 text-blue-500" />}
                    {expandedStep === step.id ? <ChevronUp className="h-4 w-4 text-ds-muted" /> : <ChevronDown className="h-4 w-4 text-ds-muted" />}
                  </div>
                </button>

                {expandedStep === step.id && (
                  <div className="border-t border-ds-border px-4 py-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ds-muted">{t('dramaStepScript')}</label>
                      <textarea
                        value={step.script}
                        onChange={(e) => updateStep(step.id, { script: e.target.value })}
                        placeholder={t('dramaStepScriptPlaceholder')}
                        className="h-28 w-full rounded-xl border border-ds-border bg-ds-main p-3 text-sm text-ds-ink placeholder-ds-faint outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none"
                        disabled={isBusy}
                      />
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => duplicateStep(step.id)}
                        disabled={isBusy}
                        className="flex items-center gap-1 rounded-lg bg-ds-subtle px-2.5 py-1.5 text-xs font-medium text-ds-muted transition hover:bg-ds-hover disabled:opacity-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {t('dramaDuplicateStep')}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(step.id)}
                        disabled={isBusy || project.steps.length <= 1}
                        className="flex items-center gap-1 rounded-lg bg-ds-subtle px-2.5 py-1.5 text-xs font-medium text-ds-muted transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('dramaRemoveStep')}
                      </button>
                    </div>

                    {(step.imageUrl || step.videoUrl) && (
                      <div className="grid grid-cols-2 gap-3">
                        {step.imageUrl && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-ds-muted">{t('dramaStepImage')}</p>
                            <img src={step.imageUrl} alt="" className="w-full rounded-lg border border-ds-border object-cover" />
                          </div>
                        )}
                        {step.videoUrl && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-ds-muted">{t('dramaStepVideo')}</p>
                            <video src={step.videoUrl} controls className="w-full rounded-lg border border-ds-border" />
                          </div>
                        )}
                      </div>
                    )}

                    {step.error && (
                      <p className="text-xs text-red-500">{step.error}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {hasAnyMedia && (
            <div className="rounded-2xl border border-ds-border bg-ds-card p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-ds-ink">{t('dramaPreviewTitle')}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {project.steps.map((step, i) => (
                  <div key={step.id} className="group relative overflow-hidden rounded-xl border border-ds-border">
                    {step.videoUrl ? (
                      <video src={step.videoUrl} className="aspect-video w-full object-cover" />
                    ) : step.imageUrl ? (
                      <img src={step.imageUrl} alt="" className="aspect-video w-full object-cover" />
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-ds-subtle">
                        <Film className="h-6 w-6 text-ds-faint" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="truncate text-[10px] font-medium text-white">
                        {t('dramaStep')} {i + 1}
                      </p>
                    </div>
                    {step.status === 'done' && (
                      <div className="absolute top-1.5 right-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 drop-shadow" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-ds-border bg-ds-subtle p-4">
            <h3 className="mb-2 text-xs font-semibold text-ds-ink">{t('dramaTips')}</h3>
            <ul className="space-y-1 text-[11px] text-ds-muted">
              <li>• {t('dramaTip1')}</li>
              <li>• {t('dramaTip2')}</li>
              <li>• {t('dramaTip3')}</li>
              <li>• {t('dramaTip4')}</li>
              <li>• {t('dramaTip5')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
