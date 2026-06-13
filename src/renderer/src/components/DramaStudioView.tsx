import { useState, useCallback, useRef, useEffect, type ReactElement } from 'react'
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
  Wand2
} from 'lucide-react'
import { useChatStore } from '../store/chat-store'

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

type DramaProject = {
  title: string
  genre: DramaGenre
  steps: DramaStep[]
  status: 'idle' | 'generating_script' | 'generating_media' | 'done' | 'error'
  error: string | null
}

const GENRE_CONFIG: { id: DramaGenre; labelKey: string; emoji: string; color: string }[] = [
  { id: 'romance', labelKey: 'dramaGenreRomance', emoji: '💕', color: 'from-pink-500 to-rose-500' },
  { id: 'suspense', labelKey: 'dramaGenreSuspense', emoji: '🔍', color: 'from-gray-700 to-gray-900' },
  { id: 'comedy', labelKey: 'dramaGenreComedy', emoji: '😂', color: 'from-yellow-400 to-orange-500' },
  { id: 'sci-fi', labelKey: 'dramaGenreSciFi', emoji: '🚀', color: 'from-cyan-500 to-blue-600' },
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

export function DramaStudioView(): ReactElement {
  const { t } = useTranslation('common')
  const [project, setProject] = useState<DramaProject>(makeEmptyProject)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [selectedDuration, setSelectedDuration] = useState('5s')
  const abortRef = useRef<AbortController | null>(null)

  const updateProject = useCallback((patch: Partial<DramaProject>) => {
    setProject((prev) => ({ ...prev, ...patch }))
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
      const prompt = `你是一个专业的短剧编剧。请为以下短剧项目生成分镜脚本。

短剧标题：${project.title}
类型：${genreLabel} ${t(GENRE_CONFIG.find((g) => g.id === project.genre)?.labelKey ?? '')}

要求：
1. 生成 ${project.steps.length} 个分镜
2. 每个分镜包含：场景描述、人物动作、对白/旁白
3. 每个分镜用 "---" 分隔
4. 每个分镜第一行是场景标题（用【】包围）
5. 内容要紧凑、有悬念、吸引观众

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
  }, [project, t, updateProject])

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
      '10s': { numFrames: 241, frameRate: 24 }
    }
    const duration = durationMap[selectedDuration] ?? durationMap['5s']

    for (const step of project.steps) {
      if (controller.signal.aborted) break
      if (!step.script.trim()) continue

      updateStep(step.id, { status: 'generating_image', error: null })

      try {
        const imageResult = await window.dsGui?.agnesGenerateImage({
          prompt: `短剧分镜画面：${step.script.split('\n')[0]}\n\n电影级画面，专业构图，4K画质`,
          model: agnes.imageModel || 'agnes-image-2.1-flash',
          size: '1280x720',
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
  }, [project, selectedDuration, t, updateProject, updateStep])

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

  return (
    <div className="flex h-full flex-col bg-ds-main">
      {/* Header */}
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
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Project Config */}
          <div className="rounded-2xl border border-ds-border bg-ds-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-ds-ink">{t('dramaProjectConfig')}</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ds-ink">{t('dramaTitle')}</label>
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
                <label className="mb-1.5 block text-sm font-medium text-ds-ink">{t('dramaGenre')}</label>
                <div className="flex flex-wrap gap-2">
                  {GENRE_CONFIG.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => updateProject({ genre: g.id })}
                      disabled={isBusy}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
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

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ds-ink">{t('agnesDuration')}</label>
                <div className="flex flex-wrap gap-2">
                  {['3s', '5s', '8s', '10s'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDuration(d)}
                      disabled={isBusy}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        selectedDuration === d
                          ? 'bg-purple-500 text-white shadow-sm'
                          : 'bg-ds-subtle text-ds-muted hover:bg-ds-hover'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate Script Button */}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void handleGenerateScript()}
                disabled={!project.title.trim() || isBusy}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Wand2 className="h-4 w-4" />
                {t('dramaGenerateScript')}
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateAllMedia()}
                disabled={!project.steps.some((s) => s.script.trim()) || isBusy}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {t('dramaGenerateAllMedia')}
              </button>
            </div>
          </div>

          {/* Progress */}
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

          {/* Error */}
          {project.error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <XCircle className="h-4 w-4 shrink-0" />
              {project.error}
            </div>
          )}

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ds-ink">
                {t('dramaSteps')} ({project.steps.length})
              </h2>
              <button
                type="button"
                onClick={addStep}
                disabled={isBusy}
                className="flex items-center gap-1.5 rounded-lg bg-ds-subtle px-3 py-1.5 text-sm font-medium text-ds-muted transition hover:bg-ds-hover disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {t('dramaAddStep')}
              </button>
            </div>

            {project.steps.map((step, index) => (
              <div
                key={step.id}
                className="rounded-2xl border border-ds-border bg-ds-card shadow-sm transition hover:shadow-md"
              >
                {/* Step Header */}
                <button
                  type="button"
                  onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
                    step.status === 'done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    step.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    step.status !== 'pending' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                    'bg-ds-subtle text-ds-muted'
                  }`}>
                    {step.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> :
                     step.status === 'error' ? <XCircle className="h-4 w-4" /> :
                     step.status !== 'pending' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                     index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-ds-ink">
                      {step.script ? step.script.split('\n')[0].replace(/^[【\[]/, '').replace(/[】\]]$/, '') : `${t('dramaStep')} ${index + 1}`}
                    </p>
                    <p className="text-xs text-ds-muted">{t(STEP_STATUS_LABELS[step.status])}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {step.imageUrl && <ImageIcon className="h-4 w-4 text-violet-500" />}
                    {step.videoUrl && <VideoIcon className="h-4 w-4 text-fuchsia-500" />}
                    {expandedStep === step.id ? <ChevronUp className="h-4 w-4 text-ds-muted" /> : <ChevronDown className="h-4 w-4 text-ds-muted" />}
                  </div>
                </button>

                {/* Step Content (expanded) */}
                {expandedStep === step.id && (
                  <div className="border-t border-ds-border px-5 py-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <label className="mb-1.5 block text-xs font-medium text-ds-muted">{t('dramaStepScript')}</label>
                        <textarea
                          value={step.script}
                          onChange={(e) => updateStep(step.id, { script: e.target.value })}
                          placeholder={t('dramaStepScriptPlaceholder')}
                          className="h-28 w-full rounded-xl border border-ds-border bg-ds-main p-3 text-sm text-ds-ink placeholder-ds-faint outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                          disabled={isBusy}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeStep(step.id)}
                        disabled={isBusy || project.steps.length <= 1}
                        className="mt-6 rounded-lg p-2 text-ds-muted transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Generated Media */}
                    <div className="grid grid-cols-2 gap-3">
                      {step.imageUrl && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-ds-muted">{t('dramaStepImage')}</p>
                          <img src={step.imageUrl} alt="" className="w-full rounded-lg border border-ds-border object-cover" />
                        </div>
                      )}
                      {step.videoUrl && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-ds-muted">{t('dramaStepVideo')}</p>
                          <video src={step.videoUrl} controls className="w-full rounded-lg border border-ds-border" />
                        </div>
                      )}
                    </div>

                    {step.error && (
                      <p className="text-xs text-red-500">{step.error}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tips */}
          <div className="rounded-2xl border border-ds-border bg-ds-subtle p-5">
            <h3 className="mb-2 text-sm font-semibold text-ds-ink">{t('dramaTips')}</h3>
            <ul className="space-y-1.5 text-xs text-ds-muted">
              <li>• {t('dramaTip1')}</li>
              <li>• {t('dramaTip2')}</li>
              <li>• {t('dramaTip3')}</li>
              <li>• {t('dramaTip4')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}