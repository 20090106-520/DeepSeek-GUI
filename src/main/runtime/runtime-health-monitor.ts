import type { AppSettingsV1 } from '../../shared/app-settings'
import {
  getRuntimeBaseUrlForSettings,
  runtimeAuthHeaders
} from './kun-adapter'
import { isKunChildRunning, startKunChild, stopKunChildAndWait } from '../kun-process'

export type RuntimeHealthStatus = {
  healthy: boolean
  lastCheckAt: number
  consecutiveFailures: number
  lastError: string | null
  autoRestartCount: number
  uptimeMs: number
}

export type RuntimeHealthMonitorConfig = {
  checkIntervalMs?: number
  unhealthyThreshold?: number
  maxAutoRestarts?: number
  autoRestartCooldownMs?: number
  startupGraceMs?: number
}

const DEFAULT_CHECK_INTERVAL_MS = 10_000
const DEFAULT_UNHEALTHY_THRESHOLD = 3
const DEFAULT_MAX_AUTO_RESTARTS = 5
const DEFAULT_AUTO_RESTART_COOLDOWN_MS = 30_000
const DEFAULT_STARTUP_GRACE_MS = 15_000

export class RuntimeHealthMonitor {
  private readonly config: Required<RuntimeHealthMonitorConfig>
  private readonly settings: AppSettingsV1
  private consecutiveFailures = 0
  private lastCheckAt = 0
  private lastError: string | null = null
  private autoRestartCount = 0
  private lastAutoRestartAt = 0
  private startedAt = Date.now()
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(settings: AppSettingsV1, config?: RuntimeHealthMonitorConfig) {
    this.settings = settings
    this.config = {
      checkIntervalMs: config?.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS,
      unhealthyThreshold: config?.unhealthyThreshold ?? DEFAULT_UNHEALTHY_THRESHOLD,
      maxAutoRestarts: config?.maxAutoRestarts ?? DEFAULT_MAX_AUTO_RESTARTS,
      autoRestartCooldownMs: config?.autoRestartCooldownMs ?? DEFAULT_AUTO_RESTART_COOLDOWN_MS,
      startupGraceMs: config?.startupGraceMs ?? DEFAULT_STARTUP_GRACE_MS
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.startedAt = Date.now()
    this.timer = setInterval(() => {
      void this.check()
    }, this.config.checkIntervalMs)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  get status(): RuntimeHealthStatus {
    return {
      healthy: this.consecutiveFailures < this.config.unhealthyThreshold,
      lastCheckAt: this.lastCheckAt,
      consecutiveFailures: this.consecutiveFailures,
      lastError: this.lastError,
      autoRestartCount: this.autoRestartCount,
      uptimeMs: Date.now() - this.startedAt
    }
  }

  private async check(): Promise<void> {
    this.lastCheckAt = Date.now()

    const graceRemaining = this.config.startupGraceMs - (Date.now() - this.startedAt)
    if (graceRemaining > 0) return

    if (!isKunChildRunning()) {
      this.consecutiveFailures += 1
      this.lastError = 'Kun process is not running'
      await this.attemptAutoRestart('process not running')
      return
    }

    try {
      const base = getRuntimeBaseUrlForSettings(this.settings)
      const headers = runtimeAuthHeaders(this.settings)
      const response = await fetch(`${base}/health`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5_000)
      })

      if (response.ok) {
        this.consecutiveFailures = 0
        this.lastError = null
      } else {
        this.consecutiveFailures += 1
        this.lastError = `Health check returned HTTP ${response.status}`
        if (this.consecutiveFailures >= this.config.unhealthyThreshold) {
          await this.attemptAutoRestart(`unhealthy: ${this.consecutiveFailures} consecutive failures`)
        }
      }
    } catch (error) {
      this.consecutiveFailures += 1
      this.lastError = error instanceof Error ? error.message : String(error)
      if (this.consecutiveFailures >= this.config.unhealthyThreshold) {
        await this.attemptAutoRestart(`unhealthy: ${this.lastError}`)
      }
    }
  }

  private async attemptAutoRestart(reason: string): Promise<void> {
    if (this.autoRestartCount >= this.config.maxAutoRestarts) return

    const cooldownRemaining = this.config.autoRestartCooldownMs - (Date.now() - this.lastAutoRestartAt)
    if (cooldownRemaining > 0) return

    this.autoRestartCount += 1
    this.lastAutoRestartAt = Date.now()

    try {
      await stopKunChildAndWait()
      await startKunChild(this.settings)
      this.consecutiveFailures = 0
      this.lastError = null
      this.startedAt = Date.now()
    } catch (error) {
      this.lastError = `Auto-restart failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}