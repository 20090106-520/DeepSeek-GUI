export type ErrorCategory =
  | 'network'
  | 'api'
  | 'validation'
  | 'runtime'
  | 'authentication'
  | 'resource'
  | 'rate_limit'
  | 'circuit_open'
  | 'stream'
  | 'timeout'
  | 'unknown'

export type GracefulDegradationAction =
  | 'retry'
  | 'fallback'
  | 'queue'
  | 'notify'
  | 'disable_feature'
  | 'none'

export interface DegradationRule {
  category: ErrorCategory
  action: GracefulDegradationAction
  maxOccurrences: number
  windowMs: number
  cooldownMs: number
}

export interface ErrorContext {
  category: ErrorCategory
  code?: string
  message: string
  originalError?: Error
  metadata?: Record<string, unknown>
  retryable?: boolean
  appVersion?: string
  platformInfo?: string
  capturedAt?: number
}

export interface RetryConfig {
  maxRetries: number
  delayMs: number
  backoffFactor: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  delayMs: 1000,
  backoffFactor: 2
}

function categorizeError(error: unknown): ErrorCategory {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes('network') || message.includes('econnrefused') || message.includes('econnreset') || message.includes('enotfound')) {
      return 'network'
    }
    if (message.includes('timeout') || message.includes('etimedout') || message.includes('timed out')) {
      return 'timeout'
    }
    if (message.includes('429') || message.includes('rate limit') || message.includes('rate_limited')) {
      return 'rate_limit'
    }
    if (message.includes('circuit_open') || message.includes('circuit breaker')) {
      return 'circuit_open'
    }
    if (message.includes('stream_idle_timeout') || message.includes('stream_read_error') || message.includes('stream stalled')) {
      return 'stream'
    }
    if (message.includes('401') || message.includes('unauthorized') || message.includes('invalid token')) {
      return 'authentication'
    }
    if (message.includes('403') || message.includes('forbidden')) {
      return 'authentication'
    }
    if (message.includes('404') || message.includes('not found')) {
      return 'resource'
    }
    if (message.includes('400') || message.includes('bad request') || message.includes('validation')) {
      return 'validation'
    }
    if (message.includes('500') || message.includes('server error') || message.includes('502') || message.includes('503') || message.includes('504')) {
      return 'api'
    }
  }
  return 'unknown'
}

export function createErrorContext(error: unknown, metadata?: Record<string, unknown>): ErrorContext {
  const category = categorizeError(error)
  const isRetryable = ['network', 'api', 'rate_limit', 'circuit_open', 'stream', 'timeout'].includes(category)
  
  return {
    category,
    message: error instanceof Error ? error.message : String(error),
    originalError: error instanceof Error ? error : undefined,
    metadata,
    retryable: isRetryable,
    capturedAt: Date.now()
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, delayMs, backoffFactor } = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error | undefined
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt >= maxRetries) {
        throw lastError
      }
      
      const delay = delayMs * Math.pow(backoffFactor, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError || new Error('Unknown error')
}

export function logError(
  source: string,
  message: string,
  context?: ErrorContext
): void {
  const logData = {
    source,
    message,
    timestamp: new Date().toISOString(),
    ...context
  }
  
  console.error(`[ErrorHandler] ${source}:`, logData)
  
  if (typeof window !== 'undefined' && typeof window.dsGui?.logError === 'function') {
    void window.dsGui.logError(source, message, logData).catch(() => undefined)
  }
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function isRetryableError(error: unknown): boolean {
  const context = createErrorContext(error)
  return context.retryable ?? false
}

export class ErrorBoundaryHandler {
  private errors: ErrorContext[] = []
  private maxErrors = 50
  
  captureError(error: unknown, metadata?: Record<string, unknown>): ErrorContext {
    const context = createErrorContext(error, metadata)
    this.errors.unshift(context)
    
    if (this.errors.length > this.maxErrors) {
      this.errors.pop()
    }
    
    logError('ErrorBoundary', context.message, context)
    return context
  }
  
  getRecentErrors(count: number = 10): ErrorContext[] {
    return this.errors.slice(0, count)
  }
  
  clearErrors(): void {
    this.errors = []
  }
}

export const FRIENDLY_ERROR_MAP: Record<ErrorCategory, string> = {
  network: 'errorFriendlyNetwork',
  api: 'errorFriendlyApi',
  validation: 'errorFriendlyValidation',
  runtime: 'errorFriendlyRuntime',
  authentication: 'errorFriendlyAuth',
  resource: 'errorFriendlyResource',
  rate_limit: 'errorFriendlyRateLimit',
  circuit_open: 'errorFriendlyCircuitOpen',
  stream: 'errorFriendlyStream',
  timeout: 'errorFriendlyTimeout',
  unknown: 'errorFriendlyUnknown'
}

export const DEGRADATION_RULES: DegradationRule[] = [
  { category: 'rate_limit', action: 'queue', maxOccurrences: 3, windowMs: 60_000, cooldownMs: 5_000 },
  { category: 'circuit_open', action: 'fallback', maxOccurrences: 1, windowMs: 30_000, cooldownMs: 30_000 },
  { category: 'stream', action: 'retry', maxOccurrences: 3, windowMs: 30_000, cooldownMs: 2_000 },
  { category: 'timeout', action: 'retry', maxOccurrences: 2, windowMs: 60_000, cooldownMs: 3_000 },
  { category: 'network', action: 'retry', maxOccurrences: 3, windowMs: 30_000, cooldownMs: 1_000 },
  { category: 'api', action: 'retry', maxOccurrences: 2, windowMs: 60_000, cooldownMs: 5_000 }
]

export function getDegradationAction(category: ErrorCategory): GracefulDegradationAction {
  const rule = DEGRADATION_RULES.find((r) => r.category === category)
  return rule?.action ?? 'notify'
}

export function getFriendlyErrorKey(category: ErrorCategory): string {
  return FRIENDLY_ERROR_MAP[category] ?? FRIENDLY_ERROR_MAP.unknown
}

export function maskApiKey(text: string): string {
  return text.replace(/(sk-|api[_-]?key[=:]\s*)[a-zA-Z0-9_-]{8,}/gi, '$1****')
}

export function getErrorReportBody(error: Error | null, errorContext: ErrorContext | null): string {
  const parts: string[] = []
  if (errorContext?.appVersion) {
    parts.push(`App Version: ${errorContext.appVersion}`)
  }
  if (errorContext?.platformInfo) {
    parts.push(`Platform: ${errorContext.platformInfo}`)
  }
  if (errorContext?.capturedAt) {
    parts.push(`Captured At: ${new Date(errorContext.capturedAt).toISOString()}`)
  }
  if (errorContext?.category) {
    parts.push(`Category: ${errorContext.category}`)
  }
  if (error?.message) {
    parts.push(`Error: ${maskApiKey(error.message)}`)
  }
  if (error?.stack) {
    parts.push(`Stack:\n${maskApiKey(error.stack)}`)
  }
  if (errorContext?.metadata?.componentStack) {
    parts.push(`Component Stack:\n${maskApiKey(String(errorContext.metadata.componentStack))}`)
  }
  return parts.join('\n\n')
}

export const globalErrorHandler = new ErrorBoundaryHandler()