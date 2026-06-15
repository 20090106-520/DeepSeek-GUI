import type {
  ToolHostContext,
  ToolProviderKind,
  ToolProviderPolicy
} from '../../ports/tool-host.js'
import type { LocalTool } from './local-tool-host.js'

export type CapabilityToolRecord = {
  provider: ToolProviderPolicy
  tool: LocalTool
}

export type CapabilityToolProvider = ToolProviderPolicy & {
  tools: readonly LocalTool[]
}

export type CapabilityToolSpec = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  toolKind?: 'tool_call' | 'command_execution' | 'file_change'
  providerId: string
  providerKind: ToolProviderKind
}

export class CapabilityRegistry {
  private readonly providers = new Map<string, CapabilityToolProvider>()
  private readonly tools = new Map<string, CapabilityToolRecord>()
  private readonly toolNamesByProvider = new Map<string, Set<string>>()

  static fromLocalTools(tools: readonly LocalTool[]): CapabilityRegistry {
    return new CapabilityRegistry([
      {
        id: 'builtin',
        kind: 'built-in',
        enabled: true,
        available: true,
        tools
      }
    ])
  }

  constructor(providers: readonly CapabilityToolProvider[] = []) {
    for (const provider of providers) {
      this.registerProvider(provider)
    }
  }

  registerProvider(provider: CapabilityToolProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`duplicate tool provider: ${provider.id}`)
    }
    this.providers.set(provider.id, provider)
    const toolNames = new Set<string>()
    for (const tool of provider.tools) {
      if (this.tools.has(tool.name)) {
        const existing = this.tools.get(tool.name)
        console.warn(`Warning: duplicate tool name '${tool.name}' from provider '${provider.id}' (already registered by '${existing?.provider.id}')`)
        continue
      }
      this.tools.set(tool.name, { provider: providerPolicy(provider), tool })
      toolNames.add(tool.name)
    }
    this.toolNamesByProvider.set(provider.id, toolNames)
  }

  updateProvider(provider: CapabilityToolProvider): void {
    const existingTools = this.toolNamesByProvider.get(provider.id) ?? new Set()
    for (const toolName of existingTools) {
      this.tools.delete(toolName)
    }
    this.toolNamesByProvider.delete(provider.id)
    this.registerProvider(provider)
  }

  getAvailableToolNames(context?: ToolHostContext): string[] {
    const names: string[] = []
    for (const record of this.tools.values()) {
      if (!this.canUseProvider(record.provider, context)) continue
      if (!this.canUseTool(record.tool.name, context)) continue
      if (record.tool.shouldAdvertise) {
        if (!context || !record.tool.shouldAdvertise(context)) continue
      }
      names.push(record.tool.name)
    }
    return names
  }

  listTools(context?: ToolHostContext): CapabilityToolSpec[] {
    const specs: CapabilityToolSpec[] = []
    for (const record of this.tools.values()) {
      if (!this.canUseProvider(record.provider, context)) continue
      if (!this.canUseTool(record.tool.name, context)) continue
      if (record.tool.shouldAdvertise) {
        if (!context || !record.tool.shouldAdvertise(context)) continue
      }
      specs.push({
        name: record.tool.name,
        description: record.tool.description,
        inputSchema: record.tool.inputSchema,
        toolKind: record.tool.toolKind,
        providerId: record.provider.id,
        providerKind: record.provider.kind
      })
    }
    return specs
  }

  resolveTool(toolName: string, context: ToolHostContext, providerId?: string): CapabilityToolRecord {
    const record = this.tools.get(toolName)
    if (!record) {
      const availableTools = this.getAvailableToolNames(context)
      const suggestions = this.findSimilarToolNames(toolName, availableTools)
      const suggestionMsg = suggestions.length > 0 
        ? ` Did you mean: ${suggestions.join(', ')}?` 
        : ''
      throw new Error(`unknown tool: ${toolName}${suggestionMsg}`)
    }
    if (providerId && providerId !== record.provider.id) {
      const providerTools = this.toolNamesByProvider.get(providerId) ?? []
      throw new Error(`tool ${toolName} is not provided by ${providerId}. It is provided by ${record.provider.id}. Available tools from ${providerId}: ${[...providerTools].join(', ') || 'none'}`)
    }
    if (!this.canUseProvider(record.provider, context)) {
      const reason = !record.provider.enabled ? 'disabled' : !record.provider.available ? 'unavailable' : 'not allowed'
      throw new Error(`tool ${toolName} is not advertised by provider ${record.provider.id} (provider is ${reason})`)
    }
    if (!this.canUseTool(toolName, context)) {
      const allowedTools = context?.allowedToolNames
      throw new Error(`tool ${toolName} is not advertised by active tool policy. Allowed tools: ${allowedTools?.join(', ') || 'not restricted'}`)
    }
    if (record.tool.shouldAdvertise && !record.tool.shouldAdvertise(context)) {
      throw new Error(`tool ${toolName} is not advertised in this turn context (check shouldAdvertise predicate)`)
    }
    return record
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

  diagnostics(): ToolProviderPolicy[] {
    return [...this.providers.values()].map(providerPolicy)
  }

  private canUseProvider(provider: ToolProviderPolicy, context?: ToolHostContext): boolean {
    if (!provider.enabled || !provider.available) return false
    const allowed = context?.allowedProviderIds
    if (allowed && !allowed.includes(provider.id)) return false
    return true
  }

  private canUseTool(toolName: string, context?: ToolHostContext): boolean {
    const allowed = context?.allowedToolNames
    return !allowed || allowed.includes(toolName)
  }
}

function providerPolicy(provider: ToolProviderPolicy): ToolProviderPolicy {
  return {
    id: provider.id,
    kind: provider.kind,
    enabled: provider.enabled,
    available: provider.available,
    ...(provider.reason ? { reason: provider.reason } : {})
  }
}
