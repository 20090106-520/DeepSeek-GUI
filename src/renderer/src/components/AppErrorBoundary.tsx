import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '../i18n'
import { globalErrorHandler, type ErrorContext } from '../lib/error-handler'

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

  override render(): ReactNode {
    if (!this.state.error) return this.props.children

    const { errorContext } = this.state
    const canRetry = errorContext?.retryable && this.retryCount < this.maxRetries

    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center bg-ds-main px-6">
        <div className="w-full max-w-md rounded-2xl border border-amber-200/80 bg-amber-50/90 p-6 text-center shadow-[0_14px_32px_rgba(15,23,42,0.08)] dark:border-amber-800/60 dark:bg-amber-950/35">
          <h2 className="text-[16px] font-semibold text-amber-900 dark:text-amber-100">
            {i18n.t('appErrorTitle')}
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-amber-800/80 dark:text-amber-100/80">
            {this.state.error.message || String(this.state.error)}
          </p>
          {this.state.error.stack && (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-amber-100/50 p-2 text-[11px] text-left text-amber-900/70 dark:bg-amber-900/30 dark:text-amber-100/70 whitespace-pre-wrap break-all">{this.state.error.stack}</pre>
          )}
          {errorContext?.category && (
            <p className="mt-1 text-[12px] text-amber-700/70 dark:text-amber-200/70">
              {i18n.t(`errorCategory${errorContext.category.charAt(0).toUpperCase() + errorContext.category.slice(1)}`)}
            </p>
          )}
          <div className="mt-4 flex gap-3 justify-center">
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
