import type { AppSettingsV1 } from '../../shared/app-settings'
import {
  getRuntimeBaseUrlForSettings,
  runtimeAuthHeaders
} from './kun-adapter'
import { isKunChildRunning, startKunChild } from '../kun-process'

export type WarmupConfig = {
  enabled?: boolean
  warmupDelayMs?: number
  healthCheckRetries?: number
  healthCheckIntervalMs?: number
  preloadModelInfo?: boolean
}

const DEFAULT_WARMUP_DELAY_MS = 2_000
const DEFAULT_HEALTH_CHECK_RETRIES = 5
const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 1_000

export class KunWarmupManager {
  private readonly config: Required<WarmupConfig>
  private readonly settings: AppSettingsV1
  private warmedUp = false
  private warmingUp = false

  constructor(settings: AppSettingsV1, config?: WarmupConfig) {
    this.settings = settings
    this.config = {
      enabled: config?.enabled ?? true,
      warmupDelayMs: config?.warmupDelayMs ?? DEFAULT_WARMUP_DELAY_MS,
      healthCheckRetries: config?.healthCheckRetries ?? DEFAULT_HEALTH_CHECK_RETRIES,
      healthCheckIntervalMs: config?.healthCheckIntervalMs ?? DEFAULT_HEALTH_CHECK_INTERVAL_MS,
      preloadModelInfo: config?.preloadModelInfo ?? true
    }
  }

  get isWarmedUp(): boolean {
    return this.warmedUp
  }

  get isWarmingUp(): boolean {
    return this.warmingUp
  }

  async warmup(): Promise<boolean> {
    if (!this.config.enabled || this.warmedUp || this.warmingUp) {
      return this.warmedUp
    }

    this.warmingUp = true

    try {
      await this.delay(this.config.warmupDelayMs)

      const healthy = await this.waitForHealthy()
      if (!healthy) {
        return false
      }

      if (this.config.preloadModelInfo) {
        await this.preloadRuntimeInfo()
      }

      this.warmedUp = true
      return true
    } finally {
      this.warmingUp = false
    }
  }

  reset(): void {
    this.warmedUp = false
    this.warmingUp = false
  }

  private async waitForHealthy(): Promise<boolean> {
    for (let attempt = 0; attempt < this.config.healthCheckRetries; attempt += 1) {
      if (!isKunChildRunning()) {
        try {
          await startKunChild(this.settings)
        } catch {
          return false
        }
      }

      try {
        const base = getRuntimeBaseUrlForSettings(this.settings)
        const headers = runtimeAuthHeaders(this.settings)
        const response = await fetch(`${base}/health`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(3_000)
        })
        if (response.ok) return true
      } catch {
        // Continue retrying
      }

      if (attempt < this.config.healthCheckRetries - 1) {
        await this.delay(this.config.healthCheckIntervalMs)
      }
    }
    return false
  }

  private async preloadRuntimeInfo(): Promise<void> {
    try {
      const base = getRuntimeBaseUrlForSettings(this.settings)
      const headers = runtimeAuthHeaders(this.settings)
      await fetch(`${base}/v1/runtime/info`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5_000)
      })
    } catch {
      // Preload is best-effort
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}