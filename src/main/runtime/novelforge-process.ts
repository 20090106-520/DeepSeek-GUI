import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { app } from 'electron'

type NovelForgeProcessState = 'stopped' | 'starting' | 'running' | 'error'

class NovelForgeProcessManager {
  private process: ChildProcess | null = null
  private state: NovelForgeProcessState = 'stopped'
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private readonly port = 54321
  private readonly healthUrl = `http://127.0.0.1:${this.port}/health`
  private lastError = ''

  async start(): Promise<{ success: boolean; message: string }> {
    if (this.state === 'running' || this.state === 'starting') {
      return { success: true, message: 'NovelForge already running or starting' }
    }

    const isHealthy = await this.checkHealth()
    if (isHealthy) {
      this.state = 'running'
      return { success: true, message: 'NovelForge already running' }
    }

    const pythonCmd = await this.findPython()
    if (!pythonCmd) {
      this.state = 'error'
      return {
        success: false,
        message: '未找到 Python 环境，请安装 Python 3.10+ 并确保已添加到 PATH'
      }
    }

    const backendDir = this.getBackendDir()
    if (!backendDir) {
      this.state = 'error'
      return {
        success: false,
        message: 'NovelForge 后端文件未找到，请重新安装应用'
      }
    }

    const mainPy = join(backendDir, 'main.py')
    if (!existsSync(mainPy)) {
      this.state = 'error'
      return {
        success: false,
        message: `NovelForge 入口文件不存在: ${mainPy}`
      }
    }

    this.state = 'starting'
    this.lastError = ''

    try {
      this.process = spawn(pythonCmd, [mainPy], {
        cwd: backendDir,
        stdio: 'pipe',
        env: { ...process.env, PORT: String(this.port) },
        windowsHide: true
      })

      let stderrOutput = ''
      this.process.stderr?.on('data', (data: Buffer) => {
        stderrOutput += data.toString()
        if (stderrOutput.length > 2000) {
          stderrOutput = stderrOutput.slice(-2000)
        }
      })

      this.process.on('error', (err) => {
        this.lastError = err.message
        this.state = 'error'
        this.process = null
      })

      this.process.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          this.lastError = stderrOutput.slice(-500) || `进程退出码: ${code}`
        }
        this.state = code === 0 ? 'stopped' : 'error'
        this.process = null
      })

      const started = await this.waitForHealth(20_000)
      if (started) {
        this.state = 'running'
        this.startHealthMonitoring()
        return { success: true, message: 'NovelForge started successfully' }
      } else {
        this.state = 'error'
        this.stop()
        const detail = this.lastError ? ` (${this.lastError.slice(0, 200)})` : ''
        return {
          success: false,
          message: `NovelForge 启动超时${detail}。请检查 Python 依赖: pip install -r requirements.txt`
        }
      }
    } catch (err) {
      this.state = 'error'
      return {
        success: false,
        message: `启动失败: ${err instanceof Error ? err.message : String(err)}`
      }
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

  getLastError(): string {
    return this.lastError
  }

  private getBackendDir(): string | null {
    if (app.isPackaged) {
      const resourcesDir = process.resourcesPath
      const packagedPath = join(resourcesDir, 'novelforge', 'backend')
      if (existsSync(packagedPath)) return packagedPath
    }

    const appPath = app.getAppPath()
    const devPath = join(appPath, 'novelforge', 'backend')
    if (existsSync(devPath)) return devPath

    return null
  }

  private findPython(): Promise<string | null> {
    return new Promise((resolve) => {
      const candidates = process.platform === 'win32'
        ? ['python', 'python3', 'py']
        : ['python3', 'python']

      let checked = 0
      const total = candidates.length

      for (const cmd of candidates) {
        execFile(cmd, ['--version'], (err, stdout) => {
          checked++
          if (!err && stdout && /Python 3\.(1[0-9]|[2-9][0-9])/.test(stdout)) {
            resolve(cmd)
            return
          }
          if (checked === total) {
            resolve(null)
          }
        })
      }
    })
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
