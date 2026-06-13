import { useState, useCallback, useRef, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronUp,
  CircleDot,
  Loader2,
  Plus,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
  CheckCircle2,
  XCircle,
  Workflow
} from 'lucide-react'

type WorkflowStepStatus = 'pending' | 'running' | 'done' | 'error'

type WorkflowStep = {
  id: string
  prompt: string
  status: WorkflowStepStatus
  result: string | null
  error: string | null
}

type WorkflowProject = {
  steps: WorkflowStep[]
  status: 'idle' | 'running' | 'done' | 'error'
}

function makeStepId(): string {
  return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function makeEmptyStep(): WorkflowStep {
  return { id: makeStepId(), prompt: '', status: 'pending', result: null, error: null }
}

function makeEmptyProject(): WorkflowProject {
  return {
    steps: [makeEmptyStep(), makeEmptyStep(), makeEmptyStep()],
    status: 'idle'
  }
}

const STEP_STATUS_CONFIG: Record<WorkflowStepStatus, { icon: ReactElement; color: string }> = {
  pending: { icon: <CircleDot className="h-4 w-4" />, color: 'text-ds-muted' },
  running: { icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-purple-500' },
  done: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-emerald-500' },
  error: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-500' }
}

export function WorkflowView(): ReactElement {
  const { t } = useTranslation('common')
  const [project, setProject] = useState<WorkflowProject>(makeEmptyProject)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const updateStep = useCallback((stepId: string, patch: Partial<WorkflowStep>) => {
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

  const handleRun = useCallback(async () => {
    const settings = await window.dsGui?.getSettings()
    const agnes = settings?.agnesGeneration
    if (!agnes?.enabled || !agnes.apiKey.trim()) return

    setProject((prev) => ({ ...prev, status: 'running' }))
    const controller = new AbortController()
    abortRef.current = controller

    const baseUrl = agnes.baseUrl.replace(/\/+$/, '')

    for (const step of project.steps) {
      if (controller.signal.aborted) break
      if (!step.prompt.trim()) continue

      updateStep(step.id, { status: 'running', error: null, result: null })

      try {
        const prevResult = project.steps
          .filter((s) => s.id !== step.id && (s.status === 'done' || s.result))
          .map((s) => s.result)
          .filter(Boolean)
          .join('\n\n')

        const systemPrompt = 'You are an AI assistant executing a step in a workflow. Be concise and focused on the specific task. Output only the result, no explanations.'
        const userPrompt = prevResult
          ? `Previous step results:\n${prevResult}\n\nCurrent task: ${step.prompt}`
          : step.prompt

        const res = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${agnes.apiKey.trim()}`
          },
          body: JSON.stringify({
            model: agnes.imageModel || 'agnes-2.0-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 2048
          }),
          signal: controller.signal
        })

        if (!res.ok) {
          const text = await res.text()
          updateStep(step.id, { status: 'error', error: `API ${res.status}: ${text.slice(0, 200)}` })
          continue
        }

        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
        const content = data.choices?.[0]?.message?.content ?? ''
        updateStep(step.id, { status: 'done', result: content })
      } catch (e) {
        if (controller.signal.aborted) break
        updateStep(step.id, { status: 'error', error: e instanceof Error ? e.message : String(e) })
      }
    }

    setProject((prev) => ({ ...prev, status: 'done' }))
  }, [project, updateStep])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setProject((prev) => ({ ...prev, status: 'idle' }))
  }, [])

  const handleReset = useCallback(() => {
    setProject(makeEmptyProject())
  }, [])

  const isBusy = project.status === 'running'
  const completedCount = project.steps.filter((s) => s.status === 'done').length
  const totalCount = project.steps.length

  return (
    <div className="flex h-full flex-col bg-ds-main">
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Workflow className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t('workflowTitle')}</h1>
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
        <div className="mx-auto max-w-4xl space-y-4">
          {isBusy && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-900/20">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-teal-600 dark:text-teal-400" />
                <div>
                  <p className="text-sm font-medium text-teal-800 dark:text-teal-200">{t('workflowRunning')}</p>
                  <p className="text-xs text-teal-600 dark:text-teal-400">
                    {completedCount}/{totalCount} {t('dramaStepsCompleted')}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-teal-200 dark:bg-teal-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-700"
                  style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ds-ink">{t('workflowTitle')} ({totalCount})</h2>
              <button
                type="button"
                onClick={addStep}
                disabled={isBusy}
                className="flex items-center gap-1.5 rounded-lg bg-ds-subtle px-3 py-1.5 text-xs font-medium text-ds-muted transition hover:bg-ds-hover disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('workflowAddStep')}
              </button>
            </div>

            {project.steps.map((step, index) => {
              const config = STEP_STATUS_CONFIG[step.status]
              return (
                <div key={step.id} className="rounded-2xl border border-ds-border bg-ds-card shadow-sm">
                  <button
                    type="button"
                    onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ds-subtle text-xs font-bold text-ds-muted">
                        {index + 1}
                      </div>
                      <div className={`h-8 w-px bg-ds-border ${index === project.steps.length - 1 ? 'invisible' : ''}`} />
                    </div>
                    <div className={`flex h-6 w-6 items-center justify-center ${config.color}`}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-ds-ink">
                        {step.prompt || `${t('workflowStep', { n: index + 1 })}`}
                      </p>
                    </div>
                    {expandedStep === step.id ? <ChevronUp className="h-4 w-4 text-ds-muted" /> : <ChevronDown className="h-4 w-4 text-ds-muted" />}
                  </button>

                  {expandedStep === step.id && (
                    <div className="border-t border-ds-border px-4 py-3 space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-ds-muted">{t('workflowStep', { n: index + 1 })}</label>
                        <textarea
                          value={step.prompt}
                          onChange={(e) => updateStep(step.id, { prompt: e.target.value })}
                          placeholder="Describe what this step should do..."
                          className="h-20 w-full rounded-xl border border-ds-border bg-ds-main p-3 text-sm text-ds-ink placeholder-ds-faint outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 resize-none"
                          disabled={isBusy}
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => removeStep(step.id)}
                          disabled={isBusy || project.steps.length <= 1}
                          className="flex items-center gap-1 rounded-lg bg-ds-subtle px-2.5 py-1.5 text-xs font-medium text-ds-muted transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('dramaRemoveStep')}
                        </button>
                      </div>
                      {step.result && (
                        <div>
                          <p className="mb-1 text-xs font-medium text-ds-muted">{t('toolCallOutput')}</p>
                          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ds-main/50 p-3 text-xs text-ds-ink">
                            {step.result}
                          </pre>
                        </div>
                      )}
                      {step.error && <p className="text-xs text-red-500">{step.error}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={!project.steps.some((s) => s.prompt.trim()) || isBusy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-sm font-medium text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {isBusy ? t('workflowRunning') : t('workflowRun')}
          </button>
        </div>
      </div>
    </div>
  )
}