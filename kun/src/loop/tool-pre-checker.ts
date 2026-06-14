import type { ToolCallLike, ToolHost, ToolHostContext } from '../ports/tool-host.js'
import type { ModelToolSpec } from '../ports/model-client.js'

export type ToolPreCheckResult = {
  valid: boolean
  errors: string[]
  warnings: string[]
  correctedArguments?: Record<string, unknown>
}

export type ToolPreCheckConfig = {
  validateRequiredParams?: boolean
  validateTypes?: boolean
  maxArgumentSize?: number
  sanitizePaths?: boolean
}

const DEFAULT_MAX_ARGUMENT_SIZE = 256 * 1024

export class ToolPreChecker {
  private readonly config: Required<ToolPreCheckConfig>

  constructor(config?: ToolPreCheckConfig) {
    this.config = {
      validateRequiredParams: config?.validateRequiredParams ?? true,
      validateTypes: config?.validateTypes ?? true,
      maxArgumentSize: config?.maxArgumentSize ?? DEFAULT_MAX_ARGUMENT_SIZE,
      sanitizePaths: config?.sanitizePaths ?? true
    }
  }

  preCheck(
    call: ToolCallLike,
    toolSpecs: ModelToolSpec[]
  ): ToolPreCheckResult {
    const errors: string[] = []
    const warnings: string[] = []
    let correctedArguments: Record<string, unknown> | undefined

    const spec = toolSpecs.find((tool) => tool.name === call.toolName)
    if (!spec) {
      return {
        valid: false,
        errors: [`Unknown tool: ${call.toolName}`],
        warnings: []
      }
    }

    const args = call.arguments
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
            errors.push(`Missing required parameter: ${param}`)
          }
        }
      }
    }

    if (this.config.sanitizePaths) {
      const sanitized = this.sanitizePathArguments(args, spec)
      if (sanitized.changed) {
        correctedArguments = sanitized.value
      }
    }

    if (this.config.validateTypes && spec.inputSchema) {
      const typeErrors = this.validateTypes(args, spec.inputSchema)
      errors.push(...typeErrors)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      ...(correctedArguments ? { correctedArguments } : {})
    }
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