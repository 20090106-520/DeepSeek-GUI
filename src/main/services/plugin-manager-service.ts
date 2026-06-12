import type { AppSettingsV1 } from '../../shared/app-settings'
import type {
  PluginInfo,
  PluginInstallPayload,
  PluginInstallResult,
  PluginKind,
  PluginListResult,
  PluginStatus,
  PluginTogglePayload,
  PluginToggleResult,
  PluginUninstallPayload,
  PluginUninstallResult
} from '../../shared/ds-gui-api'
import { listGuiSkills } from './skill-service'
import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { homedir } from 'node:os'

const PLUGIN_MANIFEST_FILE = 'plugin.json'

export async function listPlugins(
  settings: AppSettingsV1 | undefined
): Promise<PluginListResult> {
  try {
    const plugins: PluginInfo[] = []
    
    const skillsResult = settings ? await listGuiSkills(settings) : { ok: false, message: 'No settings' }
    if (skillsResult.ok) {
      const skills = skillsResult.skills
      for (const skill of skills) {
        plugins.push({
          id: skill.id,
          kind: 'skill',
          name: skill.name,
          description: skill.description,
          status: 'installed' as PluginStatus,
          source: skill.root,
          installedAt: undefined,
          lastUsed: undefined
        })
      }
    }

    const mcpPlugins = await discoverMcpPlugins()
    plugins.push(...mcpPlugins)

    return { ok: true, plugins }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

async function discoverMcpPlugins(): Promise<PluginInfo[]> {
  const plugins: PluginInfo[] = []
  const configPaths = [
    join(homedir(), '.deepseek', 'config.json'),
    join(homedir(), '.kun', 'config.json'),
    join(homedir(), '.modelcontext', 'config.json')
  ]

  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue
    
    try {
      const content = await readFile(configPath, 'utf8')
      const config = JSON.parse(content) as Record<string, unknown>
      
      if (config.servers && typeof config.servers === 'object') {
        const servers = config.servers as Record<string, unknown>
        for (const [id, server] of Object.entries(servers)) {
          if (typeof server === 'object' && server !== null) {
            const serverObj = server as Record<string, unknown>
            const status = serverObj.enabled === false ? 'disabled' : 'installed'
            
            plugins.push({
              id,
              kind: 'mcp',
              name: id,
              description: typeof serverObj.description === 'string' ? serverObj.description : undefined,
              status: status as PluginStatus,
              source: typeof serverObj.command === 'string' ? serverObj.command : typeof serverObj.url === 'string' ? serverObj.url : undefined,
              version: typeof serverObj.version === 'string' ? serverObj.version : undefined,
              errorMessage: typeof serverObj.lastError === 'string' ? serverObj.lastError : undefined,
              installedAt: undefined,
              lastUsed: undefined
            })
          }
        }
      }
    } catch {
      continue
    }
  }

  return plugins
}

export async function installPlugin(
  payload: PluginInstallPayload
): Promise<PluginInstallResult> {
  try {
    if (payload.kind === 'skill') {
      return await installSkillPlugin(payload)
    } else {
      return await installMcpPlugin(payload)
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

async function installSkillPlugin(payload: PluginInstallPayload): Promise<PluginInstallResult> {
  const skillsDir = join(homedir(), '.kun', 'skills', payload.id)
  
  if (!payload.source) {
    return { ok: false, message: 'Plugin source is required' }
  }

  await ensureDirectoryExists(skillsDir)

  const manifest: Record<string, unknown> = {
    id: payload.id,
    name: payload.id,
    description: undefined,
    version: payload.version || '1.0.0',
    entry: 'SKILL.md'
  }

  await writeFile(join(skillsDir, 'plugin.json'), JSON.stringify(manifest, null, 2))
  
  return {
    ok: true,
    plugin: {
      id: payload.id,
      kind: 'skill',
      name: payload.id,
      version: payload.version,
      status: 'installed',
      source: payload.source,
      installedAt: new Date().toISOString()
    }
  }
}

async function installMcpPlugin(payload: PluginInstallPayload): Promise<PluginInstallResult> {
  const configDir = join(homedir(), '.deepseek')
  await ensureDirectoryExists(configDir)
  
  const configPath = join(configDir, 'config.json')
  let config: Record<string, unknown> = { servers: {} }
  
  if (existsSync(configPath)) {
    const content = await readFile(configPath, 'utf8')
    config = JSON.parse(content) as Record<string, unknown>
  }
  
  if (!config.servers || typeof config.servers !== 'object') {
    config.servers = {}
  }
  
  ;(config.servers as Record<string, unknown>)[payload.id] = {
    enabled: true,
    transport: 'stdio',
    command: payload.source || 'npx',
    args: [] as string[],
    trustScope: 'user',
    timeoutMs: 30000
  }
  
  await writeFile(configPath, JSON.stringify(config, null, 2))
  
  return {
    ok: true,
    plugin: {
      id: payload.id,
      kind: 'mcp',
      name: payload.id,
      version: payload.version,
      status: 'installed',
      source: payload.source,
      installedAt: new Date().toISOString()
    }
  }
}

export async function uninstallPlugin(
  payload: PluginUninstallPayload
): Promise<PluginUninstallResult> {
  try {
    if (payload.kind === 'skill') {
      const skillsDir = join(homedir(), '.kun', 'skills', payload.id)
      if (existsSync(skillsDir)) {
        await rm(skillsDir, { recursive: true, force: true })
      }
    } else {
      const configPath = join(homedir(), '.deepseek', 'config.json')
      if (existsSync(configPath)) {
        const content = await readFile(configPath, 'utf8')
        const config = JSON.parse(content) as Record<string, unknown>
        
        if (config.servers && typeof config.servers === 'object') {
          delete (config.servers as Record<string, unknown>)[payload.id]
          await writeFile(configPath, JSON.stringify(config, null, 2))
        }
      }
    }
    
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export async function togglePlugin(
  payload: PluginTogglePayload
): Promise<PluginToggleResult> {
  try {
    if (payload.kind === 'mcp') {
      const configPath = join(homedir(), '.deepseek', 'config.json')
      if (existsSync(configPath)) {
        const content = await readFile(configPath, 'utf8')
        const config = JSON.parse(content) as Record<string, unknown>
        
        if (config.servers && 
            typeof config.servers === 'object' && 
            (config.servers as Record<string, unknown>)[payload.id]) {
          (config.servers as Record<string, unknown>)[payload.id] = {
            ...((config.servers as Record<string, unknown>)[payload.id] as Record<string, unknown>),
            enabled: payload.enabled
          }
          await writeFile(configPath, JSON.stringify(config, null, 2))
        }
      }
    }
    
    return { ok: true, enabled: payload.enabled }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

async function ensureDirectoryExists(path: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises')
  await mkdir(path, { recursive: true })
}

async function writeFile(path: string, content: string): Promise<void> {
  const { writeFile: fsWriteFile } = await import('node:fs/promises')
  await fsWriteFile(path, content, 'utf8')
}