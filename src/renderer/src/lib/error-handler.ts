export type ErrorCategory =
  | 'network'
  | 'api'
  | 'validation'
  | 'runtime'
  | 'authentication'
  | 'resource'
  | 'unknown'

export interface ErrorContext {
  category: ErrorCategory
  code?: string
  message: string
  originalError?: Error
  metadata?: Record<string, unknown>
  retryable?: boolean
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
    if (message.includes('network') || message.includes('timeout') || message.includes('etimedout')) {
      return 'network'
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
    if (message.includes('500') || message.includes('server error')) {
      return 'api'
    }
  }
  return 'unknown'
}

export function createErrorContext(error: unknown, metadata?: Record<string, unknown>): ErrorContext {
  const category = categorizeError(error)
  const isRetryable = ['network', 'api'].includes(category)
  
  return {
    category,
    message: error instanceof Error ? error.message : String(error),
    originalError: error instanceof Error ? error : undefined,
    metadata,
    retryable: isRetryable
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

export const globalErrorHandler = new ErrorBoundaryHandler()