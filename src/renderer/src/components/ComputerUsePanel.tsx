import { useState, useEffect, useRef, type ReactElement, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Monitor,
  MousePointer2,
  Keyboard,
  Camera,
  ShieldAlert,
  History,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronRight,
  Power,
  PowerOff,
  Clock,
  Eye,
  ShieldCheck,
  ShieldX
} from 'lucide-react'

type ComputerUseAction = {
  id: string
  type: 'screenshot' | 'mouse_click' | 'mouse_move' | 'key_press' | 'key_type' | 'scroll'
  summary: string
  timestamp: number
  screenshotUrl?: string
  riskLevel?: 'low' | 'medium' | 'high'
  status?: 'pending' | 'confirmed' | 'executed' | 'failed' | 'rejected'
  details?: string
}

type PendingAction = {
  action: ComputerUseAction
  onConfirm: () => void
  onReject: () => void
}

type Props = {
  onClose: () => void
}

const SAFETY_TIPS = [
  'computerUseSafety1',
  'computerUseSafety2',
  'computerUseSafety3',
  'computerUseSafety4'
]

const CONFIRM_TIMEOUT_MS = 60_000

function ActionPreviewDialog({ pending, t }: { pending: PendingAction; t: (key: string) => string }): ReactElement {
  const [countdown, setCountdown] = useState(CONFIRM_TIMEOUT_MS / 1000)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          pending.onReject()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [pending])

  const riskColor = pending.action.riskLevel === 'high'
    ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
    : pending.action.riskLevel === 'medium'
      ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
      : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-ds-border bg-ds-main shadow-2xl">
        <div className="flex items-center gap-2.5 bg-gradient-to-r from-rose-500 to-orange-500 px-5 py-4 rounded-t-2xl text-white">
          <ShieldAlert className="h-5 w-5" />
          <h3 className="text-sm font-semibold">{t('computerUseConfirmTitle')}</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-ds-border bg-ds-surface p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-ds-primary-text">
              {pending.action.type === 'screenshot' && <Camera className="h-4 w-4 text-blue-500" />}
              {pending.action.type === 'mouse_click' && <MousePointer2 className="h-4 w-4 text-emerald-500" />}
              {pending.action.type === 'mouse_move' && <MousePointer2 className="h-4 w-4 text-amber-500" />}
              {(pending.action.type === 'key_press' || pending.action.type === 'key_type') && <Keyboard className="h-4 w-4 text-purple-500" />}
              {pending.action.type === 'scroll' && <MousePointer2 className="h-4 w-4 text-cyan-500" />}
              <span>{pending.action.summary}</span>
            </div>
            {pending.action.details && (
              <p className="text-xs text-ds-secondary-text">{pending.action.details}</p>
            )}
          </div>
          {pending.action.riskLevel && (
            <div className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${riskColor}`}>
              <AlertTriangle className="h-3.5 w-3.5" />
              {t(`computerUseRisk_${pending.action.riskLevel}`)}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-ds-secondary-text">
            <Clock className="h-3.5 w-3.5" />
            {t('computerUseConfirmTimeout', { seconds: countdown })}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-ds-border px-5 py-3">
          <button
            onClick={pending.onReject}
            className="flex items-center gap-1.5 rounded-lg bg-ds-surface px-4 py-2 text-sm font-medium text-ds-primary-text transition hover:bg-ds-hover"
          >
            <ShieldX className="h-4 w-4" />
            {t('computerUseConfirmReject')}
          </button>
          <button
            onClick={pending.onConfirm}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
          >
            <ShieldCheck className="h-4 w-4" />
            {t('computerUseConfirmAllow')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ComputerUsePanel({ onClose }: Props): ReactElement {
  const { t } = useTranslation('common')
  const [enabled, setEnabled] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSafety, setShowSafety] = useState(true)
  const [actionHistory, setActionHistory] = useState<ComputerUseAction[]>([])
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    }
  }, [])

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => !prev)
  }, [])

  const requestAction = useCallback((action: ComputerUseAction): Promise<boolean> => {
    if (!enabled) return Promise.resolve(false)
    if (action.riskLevel === 'high') {
      return new Promise<boolean>((resolve) => {
        setPendingAction({
          action,
          onConfirm: () => {
            setPendingAction(null)
            setActionHistory((prev) => [{ ...action, status: 'confirmed' }, ...prev])
            resolve(true)
          },
          onReject: () => {
            setPendingAction(null)
            setActionHistory((prev) => [{ ...action, status: 'rejected' }, ...prev])
            resolve(false)
          }
        })
        confirmTimerRef.current = setTimeout(() => {
          setPendingAction(null)
          setActionHistory((prev) => [{ ...action, status: 'rejected' }, ...prev])
          resolve(false)
        }, CONFIRM_TIMEOUT_MS)
      })
    }
    setActionHistory((prev) => [{ ...action, status: 'executed' }, ...prev])
    return Promise.resolve(true)
  }, [enabled])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      {pendingAction && <ActionPreviewDialog pending={pendingAction} t={t} />}
      {previewScreenshot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreviewScreenshot(null)}>
          <div className="relative max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewScreenshot(null)} className="absolute -top-3 -right-3 z-10 rounded-full bg-ds-surface p-1.5 shadow-lg transition hover:bg-ds-hover">
              <X className="h-4 w-4" />
            </button>
            <img src={previewScreenshot} alt="Screenshot" className="w-full rounded-xl border border-ds-border shadow-2xl" />
          </div>
        </div>
      )}
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-ds-border bg-ds-main shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Monitor className="h-5 w-5" />
            <h2 className="text-base font-semibold">{t('computerUseTitle')}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5 flex items-center justify-between rounded-xl border border-ds-border bg-ds-surface p-4">
            <div className="flex items-center gap-3">
              {enabled ? (
                <Power className="h-5 w-5 text-emerald-500" />
              ) : (
                <PowerOff className="h-5 w-5 text-ds-secondary-text" />
              )}
              <div>
                <div className="text-sm font-medium text-ds-primary-text">{t('computerUseToggle')}</div>
                <div className="text-xs text-ds-secondary-text">{t('computerUseToggleDesc')}</div>
              </div>
            </div>
            <button
              onClick={toggleEnabled}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                enabled ? 'bg-emerald-500' : 'bg-ds-border'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  enabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {!enabled && (
            <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">{t('computerUseDisabledWarning')}</span>
              </div>
              <p className="mt-1 text-xs text-ds-secondary-text">{t('computerUseDisabledDesc')}</p>
            </div>
          )}

          <div className="mb-5">
            <button
              onClick={() => setShowSafety(!showSafety)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-ds-primary-text transition hover:bg-ds-hover"
            >
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              {t('computerUseSafetyTitle')}
              {showSafety ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
            </button>
            {showSafety && (
              <div className="mt-2 space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                {SAFETY_TIPS.map((tipKey) => (
                  <div key={tipKey} className="flex items-start gap-2 text-xs text-ds-primary-text">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                    <span>{t(tipKey)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-5">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-ds-primary-text transition hover:bg-ds-hover"
            >
              <History className="h-4 w-4 text-blue-500" />
              {t('computerUseHistory')}
              {actionHistory.length > 0 && (
                <span className="ml-1 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                  {actionHistory.length}
                </span>
              )}
              {showHistory ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
            </button>
            {showHistory && (
              <div className="mt-2 rounded-lg border border-ds-border bg-ds-surface p-3">
                {actionHistory.length === 0 ? (
                  <p className="text-center text-xs text-ds-secondary-text py-4">{t('computerUseHistoryEmpty')}</p>
                ) : (
                  <div className="space-y-2">
                    {actionHistory.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-center gap-2 rounded-lg bg-ds-main p-2 text-xs cursor-pointer hover:bg-ds-hover transition"
                        onClick={() => action.screenshotUrl && setPreviewScreenshot(action.screenshotUrl)}
                      >
                        {action.type === 'screenshot' && <Camera className="h-3.5 w-3.5 text-blue-500" />}
                        {action.type === 'mouse_click' && <MousePointer2 className="h-3.5 w-3.5 text-emerald-500" />}
                        {action.type === 'mouse_move' && <MousePointer2 className="h-3.5 w-3.5 text-amber-500" />}
                        {(action.type === 'key_press' || action.type === 'key_type') && <Keyboard className="h-3.5 w-3.5 text-purple-500" />}
                        {action.type === 'scroll' && <MousePointer2 className="h-3.5 w-3.5 text-cyan-500" />}
                        <span className="flex-1 text-ds-primary-text">{action.summary}</span>
                        {action.screenshotUrl && (
                          <Eye className="h-3.5 w-3.5 text-ds-secondary-text" />
                        )}
                        {action.riskLevel && (
                          <span className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                            action.riskLevel === 'high' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                            action.riskLevel === 'medium' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}>{action.riskLevel}</span>
                        )}
                        <span className="text-ds-secondary-text">{new Date(action.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-ds-border bg-ds-surface p-4">
            <h3 className="mb-3 text-sm font-medium text-ds-primary-text">{t('computerUseCapabilities')}</h3>
            <div className="grid grid-cols-2 gap-2">
              {([
                { icon: <Camera className="h-4 w-4" />, label: t('computerUseCapScreenshot'), color: 'text-blue-500' },
                { icon: <MousePointer2 className="h-4 w-4" />, label: t('computerUseCapMouse'), color: 'text-emerald-500' },
                { icon: <Keyboard className="h-4 w-4" />, label: t('computerUseCapKeyboard'), color: 'text-purple-500' },
                { icon: <Monitor className="h-4 w-4" />, label: t('computerUseCapScreen'), color: 'text-amber-500' }
              ]).map((cap) => (
                <div key={cap.label} className="flex items-center gap-2 rounded-lg bg-ds-main p-2.5 text-xs text-ds-primary-text">
                  <span className={cap.color}>{cap.icon}</span>
                  <span>{cap.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ds-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-ds-surface px-4 py-2 text-sm font-medium text-ds-primary-text transition hover:bg-ds-hover"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
