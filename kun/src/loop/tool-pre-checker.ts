import type { ToolCallLike, ToolHost, ToolHostContext } from '../ports/tool-host.js'
import type { ModelToolSpec } from '../ports/model-client.js'

export type ToolPreCheckResult = {
  valid: boolean
  errors: string[]
  warnings: string[]
  correctedArguments?: Record<string, unknown>
  suggestions: string[]
}

export type ToolPreCheckConfig = {
  validateRequiredParams?: boolean
  validateTypes?: boolean
  maxArgumentSize?: number
  sanitizePaths?: boolean
  autoCorrectTypes?: boolean
  allowExtraParams?: boolean
}

const DEFAULT_MAX_ARGUMENT_SIZE = 256 * 1024

export class ToolPreChecker {
  private readonly config: Required<ToolPreCheckConfig>

  constructor(config?: ToolPreCheckConfig) {
    this.config = {
      validateRequiredParams: config?.validateRequiredParams ?? true,
      validateTypes: config?.validateTypes ?? true,
      maxArgumentSize: config?.maxArgumentSize ?? DEFAULT_MAX_ARGUMENT_SIZE,
      sanitizePaths: config?.sanitizePaths ?? true,
      autoCorrectTypes: config?.autoCorrectTypes ?? true,
      allowExtraParams: config?.allowExtraParams ?? false
    }
  }

  preCheck(
    call: ToolCallLike,
    toolSpecs: ModelToolSpec[]
  ): ToolPreCheckResult {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []
    let correctedArguments: Record<string, unknown> | undefined

    const spec = toolSpecs.find((tool) => tool.name === call.toolName)
    if (!spec) {
      const availableTools = toolSpecs.map(t => t.name)
      const similar = this.findSimilarToolNames(call.toolName, availableTools)
      if (similar.length > 0) {
        suggestions.push(`Did you mean: ${similar.join(', ')}?`)
      }
      return {
        valid: false,
        errors: [`Unknown tool: ${call.toolName}`],
        warnings: [],
        suggestions
      }
    }

    let args = call.arguments
    const argsSize = JSON.stringify(args).length
    if (argsSize > this.config.maxArgumentSize) {
      warnings.push(
        `Tool arguments size (${argsSize} bytes) exceeds recommended maximum (${this.config.maxArgumentSize} bytes)`
      )
    }

    if (this.config.validateRequiredParams && spec.inputSchema) {
      const required = spec.inputSchema.required as string[] | undefined
      if (Array.isArray(required)) {
        for (const param of required) {
          if (args[param] === undefined || args[param] === null) {
            errors.push(`Missing required parameter: '${param}'`)
            const defaultValue = this.getDefaultValue(spec.inputSchema, param)
            if (defaultValue !== undefined) {
              suggestions.push(`Using default value for '${param}': ${JSON.stringify(defaultValue)}`)
              if (!correctedArguments) correctedArguments = { ...args }
              correctedArguments[param] = defaultValue
            }
          }
        }
      }
    }

    if (this.config.sanitizePaths) {
      const sanitized = this.sanitizePathArguments(args, spec)
      if (sanitized.changed) {
        if (!correctedArguments) correctedArguments = { ...args }
        Object.assign(correctedArguments, sanitized.value)
        args = correctedArguments
      }
    }

    if (this.config.validateTypes && spec.inputSchema) {
      const typeResult = this.validateAndCorrectTypes(args, spec.inputSchema)
      errors.push(...typeResult.errors)
      if (typeResult.corrected) {
        if (!correctedArguments) correctedArguments = { ...args }
        Object.assign(correctedArguments, typeResult.corrected)
        args = correctedArguments
      }
    }

    if (!this.config.allowExtraParams && spec.inputSchema) {
      const extraParams = this.findExtraParameters(args, spec.inputSchema)
      if (extraParams.length > 0) {
        warnings.push(`Unexpected parameters: ${extraParams.join(', ')}`)
        suggestions.push(`Consider removing these parameters: ${extraParams.join(', ')}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      ...(correctedArguments ? { correctedArguments } : {})
    }
  }

  private findSimilarToolNames(target: string, available: string[]): string[] {
    const targetLower = target.toLowerCase()
    const threshold = 0.7
    const scores: Array<{ name: string; score: number }> = []
    
    for (const name of available) {
      const score = this.similarity(targetLower, name.toLowerCase())
      if (score >= threshold) {
        scores.push({ name, score })
      }
    }
    
    return scores.sort((a, b) => b.score - a.score).slice(0, 3).map(s => s.name)
  }

  private similarity(a: string, b: string): number {
    if (a === b) return 1
    if (a.length === 0 || b.length === 0) return 0
    
    const longer = a.length > b.length ? a : b
    const shorter = a.length > b.length ? b : a
    const longerLength = longer.length
    
    const edits = this.levenshteinDistance(longer, shorter)
    return (longerLength - edits) / longerLength
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[b.length][a.length]
  }

  private getDefaultValue(schema: Record<string, unknown>, param: string): unknown {
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined
    if (!properties) return undefined
    
    const prop = properties[param]
    if (!prop || typeof prop !== 'object') return undefined
    
    if ('default' in prop) return prop.default
    
    const type = prop.type as string
    switch (type) {
      case 'string': return ''
      case 'number': return 0
      case 'boolean': return false
      case 'array': return []
      case 'object': return {}
      default: return undefined
    }
  }

  private validateAndCorrectTypes(
    args: Record<string, unknown>,
    schema: Record<string, unknown>
  ): { errors: string[]; corrected?: Record<string, unknown> } {
    const errors: string[] = []
    let corrected: Record<string, unknown> | undefined
    
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined
    if (!properties) return { errors }

    for (const [key, value] of Object.entries(properties)) {
      if (typeof value !== 'object' || value === null) continue
      const expectedType = value.type as string | undefined
      if (!expectedType) continue

      const actual = args[key]
      if (actual === undefined || actual === null) continue

      const correction = this.tryCorrectType(actual, expectedType)
      if (correction.corrected) {
        if (!corrected) corrected = {}
        corrected[key] = correction.value
      } else if (!correction.valid) {
        errors.push(`Parameter '${key}' expected type '${expectedType}' but got '${typeof actual}'`)
      }
    }

    return { errors, corrected }
  }

  private tryCorrectType(value: unknown, expectedType: string): { valid: boolean; corrected: boolean; value?: unknown } {
    if (!this.config.autoCorrectTypes) {
      const valid = this.checkType(value, expectedType)
      return { valid, corrected: false }
    }

    switch (expectedType) {
      case 'string':
        if (typeof value === 'string') return { valid: true, corrected: false }
        return { valid: true, corrected: true, value: String(value) }
      case 'number':
      case 'integer':
        if (typeof value === 'number') return { valid: true, corrected: false }
        const numValue = Number(value)
        if (!isNaN(numValue)) return { valid: true, corrected: true, value: numValue }
        return { valid: false, corrected: false }
      case 'boolean':
        if (typeof value === 'boolean') return { valid: true, corrected: false }
        if (value === 'true' || value === 1) return { valid: true, corrected: true, value: true }
        if (value === 'false' || value === 0) return { valid: true, corrected: true, value: false }
        return { valid: false, corrected: false }
      case 'array':
        if (Array.isArray(value)) return { valid: true, corrected: false }
        return { valid: true, corrected: true, value: [value] }
      case 'object':
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return { valid: true, corrected: false }
        }
        try {
          const parsed = typeof value === 'string' ? JSON.parse(value) : null
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return { valid: true, corrected: true, value: parsed }
          }
        } catch {
          // Ignore parse errors
        }
        return { valid: false, corrected: false }
      default:
        return { valid: true, corrected: false }
    }
  }

  private findExtraParameters(args: Record<string, unknown>, schema: Record<string, unknown>): string[] {
    const properties = schema.properties as Record<string, unknown> | undefined
    if (!properties) return []
    
    const definedParams = new Set(Object.keys(properties))
    return Object.keys(args).filter(key => !definedParams.has(key))
  }

  private sanitizePathArguments(
    args: Record<string, unknown>,
    spec: ModelToolSpec
  ): { value: Record<string, unknown>; changed: boolean } {
    const pathParams = this.extractPathParamNames(spec.inputSchema)
    if (pathParams.length === 0) return { value: args, changed: false }

    let changed = false
    const next = { ...args }
    for (const param of pathParams) {
      const value = next[param]
      if (typeof value !== 'string') continue

      const sanitized = value
        .replace(/\.\./g, '')
        .replace(/\/\//g, '/')
        .replace(/\\/g, '/')

      if (sanitized !== value) {
        next[param] = sanitized
        changed = true
      }
    }
    return changed ? { value: next, changed: true } : { value: args, changed: false }
  }

  private extractPathParamNames(schema: Record<string, unknown>): string[] {
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined
    if (!properties) return []

    const names: string[] = []
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === 'object' && value !== null) {
        const description = (value.description as string ?? '').toLowerCase()
        if (
          key.toLowerCase().includes('path') ||
          key.toLowerCase().includes('file') ||
          key.toLowerCase().includes('dir') ||
          description.includes('path') ||
          description.includes('file') ||
          description.includes('directory')
        ) {
          names.push(key)
        }
      }
    }
    return names
  }

  private validateTypes(
    args: Record<string, unknown>,
    schema: Record<string, unknown>
  ): string[] {
    const errors: string[] = []
    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined
    if (!properties) return errors

    for (const [key, value] of Object.entries(properties)) {
      if (typeof value !== 'object' || value === null) continue
      const expectedType = value.type as string | undefined
      if (!expectedType) continue

      const actual = args[key]
      if (actual === undefined || actual === null) continue

      const typeMatch = this.checkType(actual, expectedType)
      if (!typeMatch) {
        errors.push(
          `Parameter '${key}' expected type '${expectedType}' but got '${typeof actual}'`
        )
      }
    }
    return errors
  }

  private checkType(value: unknown, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string'
      case 'number':
      case 'integer':
        return typeof value === 'number'
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      default:
        return true
    }
  }
}