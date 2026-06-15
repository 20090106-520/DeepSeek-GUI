import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { app } from 'electron'

type NovelForgeProcessState = 'stopped' | 'starting' | 'running' | 'error'

class NovelForgeProcessManager {
  private process: ChildProcess | null = null
  private state: NovelForgeProcessState = 'stopped'
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private readonly port = 54321
  private readonly healthUrl = `http://127.0.0.1:${this.port}/health`

  async start(): Promise<{ success: boolean; message: string }> {
    if (this.state === 'running' || this.state === 'starting') {
      return { success: true, message: 'NovelForge already running or starting' }
    }

    const isHealthy = await this.checkHealth()
    if (isHealthy) {
      this.state = 'running'
      return { success: true, message: 'NovelForge already running' }
    }

    this.state = 'starting'

    const appPath = app.getAppPath()
    const backendDir = join(appPath, 'novelforge', 'backend')
    const mainPy = join(backendDir, 'main.py')

    try {
      this.process = spawn('python', [mainPy], {
        cwd: backendDir,
        stdio: 'pipe',
        env: { ...process.env, PORT: String(this.port) },
        windowsHide: true
      })

      this.process.on('error', (err) => {
        this.state = 'error'
        this.process = null
      })

      this.process.on('exit', (code) => {
        this.state = code === 0 ? 'stopped' : 'error'
        this.process = null
      })

      const started = await this.waitForHealth(15_000)
      if (started) {
        this.state = 'running'
        this.startHealthMonitoring()
        return { success: true, message: 'NovelForge started successfully' }
      } else {
        this.state = 'error'
        this.stop()
        return { success: false, message: 'NovelForge failed to start within timeout' }
      }
    } catch (err) {
      this.state = 'error'
      return { success: false, message: `Failed to start NovelForge: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    if (this.process) {
      try {
        this.process.kill('SIGTERM')
      } catch { /* ignore */ }
      this.process = null
    }
    this.state = 'stopped'
  }

  getState(): NovelForgeProcessState {
    return this.state
  }

  getPort(): number {
    return this.port
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3_000)
      const response = await fetch(this.healthUrl, { signal: controller.signal })
      clearTimeout(timeout)
      return response.ok
    } catch {
      return false
    }
  }

  private async waitForHealth(timeoutMs: number): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      if (await this.checkHealth()) return true
    }
    return false
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      const healthy = await this.checkHealth()
      if (!healthy && this.state === 'running') {
        this.state = 'error'
      }
    }, 30_000)
  }
}

let globalManager: NovelForgeProcessManager | null = null

export function getNovelForgeManager(): NovelForgeProcessManager {
  if (!globalManager) {
    globalManager = new NovelForgeProcessManager()
  }
  return globalManager
}