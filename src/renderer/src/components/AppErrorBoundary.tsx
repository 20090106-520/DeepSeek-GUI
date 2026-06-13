import { Component, type ErrorInfo, type ReactNode } from 'react'
import { MessageSquareWarning } from 'lucide-react'
import i18n from '../i18n'
import { globalErrorHandler, type ErrorContext, getFriendlyErrorKey, getErrorReportBody } from '../lib/error-handler'

type Props = {
  children: ReactNode
}

type State = {
  error: Error | null
  errorContext: ErrorContext | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorContext: null }
  private retryCount = 0
  private maxRetries = 2

  static getDerivedStateFromError(error: Error): State {
    const context = globalErrorHandler.captureError(error)
    return { error, errorContext: context }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AppErrorBoundary] uncaught render error:', error, info.componentStack)
    
    globalErrorHandler.captureError(error, {
      componentStack: info.componentStack,
      retryCount: this.retryCount
    })

    if (typeof window !== 'undefined' && typeof window.dsGui?.logError === 'function') {
      void window.dsGui.logError('renderer', 'Uncaught render error', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        retryCount: this.retryCount
      }).catch(() => undefined)
    }
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleRetry = (): void => {
    if (this.retryCount >= this.maxRetries) {
      this.handleReload()
      return
    }
    
    this.retryCount++
    this.setState({ error: null, errorContext: null })
  }

  private handleReport = (): void => {
    const { error, errorContext } = this.state
    const reportBody = getErrorReportBody(error, errorContext)
    const categoryKey = errorContext?.category ? getFriendlyErrorKey(errorContext.category) : ''
    const categoryLabel = categoryKey ? i18n.t(categoryKey) : ''
    const title = error?.message ? `[Bug] ${error.message}` : '[Bug] Application error'
    const description = `${categoryLabel}\n\n${reportBody}`
    window.location.hash = `#/settings/general?feedbackType=bug&feedbackTitle=${encodeURIComponent(title)}&feedbackDescription=${encodeURIComponent(description)}`
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children

    const { errorContext } = this.state
    const canRetry = errorContext?.retryable && this.retryCount < this.maxRetries
    const friendlyKey = errorContext?.category ? getFriendlyErrorKey(errorContext.category) : ''

    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center bg-ds-main px-6">
        <div className="w-full max-w-md rounded-2xl border border-amber-200/80 bg-amber-50/90 p-6 text-center shadow-[0_14px_32px_rgba(15,23,42,0.08)] dark:border-amber-800/60 dark:bg-amber-950/35">
          <h2 className="text-[16px] font-semibold text-amber-900 dark:text-amber-100">
            {i18n.t('appErrorTitle')}
          </h2>
          {friendlyKey && (
            <p className="mt-2 text-[13px] leading-5 text-amber-800/90 dark:text-amber-100/90">
              {i18n.t(friendlyKey)}
            </p>
          )}
          <p className="mt-1 text-[12px] leading-4 text-amber-700/70 dark:text-amber-200/70">
            {this.state.error.message || String(this.state.error)}
          </p>
          {errorContext?.category && (
            <p className="mt-1 text-[11px] text-amber-700/50 dark:text-amber-200/50">
              {i18n.t(`errorCategory${errorContext.category.charAt(0).toUpperCase() + errorContext.category.slice(1)}`)}
            </p>
          )}
          <div className="mt-4 flex gap-3 justify-center flex-wrap">
            {canRetry && (
              <button
                type="button"
                onClick={this.handleRetry}
                className="rounded-full bg-amber-900/10 px-5 py-2 text-[13px] font-medium text-amber-900 transition hover:bg-amber-900/20 dark:bg-amber-100/10 dark:text-amber-100 dark:hover:bg-amber-100/20"
              >
                {i18n.t('appErrorRetry')} ({this.maxRetries - this.retryCount})
              </button>
            )}
            <button
              type="button"
              onClick={this.handleReport}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-900/10 px-5 py-2 text-[13px] font-medium text-amber-900 transition hover:bg-amber-900/20 dark:bg-amber-100/10 dark:text-amber-100 dark:hover:bg-amber-100/20"
            >
              <MessageSquareWarning className="h-3.5 w-3.5" strokeWidth={2} />
              {i18n.t('appErrorReport')}
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-full bg-amber-900/10 px-5 py-2 text-[13px] font-medium text-amber-900 transition hover:bg-amber-900/20 dark:bg-amber-100/10 dark:text-amber-100 dark:hover:bg-amber-100/20"
            >
              {i18n.t('appErrorReload')}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
