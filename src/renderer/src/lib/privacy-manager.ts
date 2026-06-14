export type PrivacyLevel = 'standard' | 'enhanced' | 'maximum'

export interface PrivacySettings {
  level: PrivacyLevel
  autoLock: boolean
  autoLockMinutes: number
  clearClipboard: boolean
  clearClipboardSeconds: number
  hideSensitiveData: boolean
  encryptLocalData: boolean
  anonymousAnalytics: boolean
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  level: 'standard',
  autoLock: false,
  autoLockMinutes: 5,
  clearClipboard: false,
  clearClipboardSeconds: 30,
  hideSensitiveData: true,
  encryptLocalData: false,
  anonymousAnalytics: true
}

const PRIVACY_STORAGE_KEY = 'deepseek-privacy-settings'

export function getPrivacySettings(): PrivacySettings {
  const stored = localStorage.getItem(PRIVACY_STORAGE_KEY)
  if (!stored) return { ...DEFAULT_PRIVACY_SETTINGS }
  
  try {
    const parsed = JSON.parse(stored)
    return { ...DEFAULT_PRIVACY_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_PRIVACY_SETTINGS }
  }
}

export function savePrivacySettings(settings: Partial<PrivacySettings>): PrivacySettings {
  const current = getPrivacySettings()
  let updated = { ...current, ...settings }
  
  if (updated.level === 'enhanced') {
    updated.autoLock = true
    updated.clearClipboard = true
  } else if (updated.level === 'maximum') {
    updated.autoLock = true
    updated.clearClipboard = true
    updated.anonymousAnalytics = false
    updated.encryptLocalData = true
    updated.hideSensitiveData = true
  }
  
  localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function resetPrivacySettings(): PrivacySettings {
  localStorage.removeItem(PRIVACY_STORAGE_KEY)
  return { ...DEFAULT_PRIVACY_SETTINGS }
}

export function clearSensitiveData(): void {
  localStorage.removeItem('deepseek-api-key')
  localStorage.removeItem('deepseek-conversation-history')
  localStorage.removeItem('deepseek-cache')
}

export function maskSensitiveValue(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars) return '*'.repeat(value?.length || 4)
  const masked = '*'.repeat(value.length - visibleChars)
  return masked + value.slice(-visibleChars)
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return '*'.repeat(apiKey.length)
  return apiKey.slice(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.slice(-4)
}

export function validatePrivacyLevel(level: string): PrivacyLevel {
  if (level === 'standard' || level === 'enhanced' || level === 'maximum') {
    return level
  }
  return 'standard'
}

export function getPrivacyLevelDescription(level: PrivacyLevel): string {
  switch (level) {
    case 'standard':
      return 'Standard privacy protection with basic data handling.'
    case 'enhanced':
      return 'Enhanced protection with auto-lock and clipboard clearing.'
    case 'maximum':
      return 'Maximum protection with encryption and no data retention.'
  }
}

export class PrivacyManager {
  private autoLockTimer: ReturnType<typeof setTimeout> | null = null
  private clipboardClearTimer: ReturnType<typeof setTimeout> | null = null
  private settings: PrivacySettings

  constructor() {
    this.settings = getPrivacySettings()
  }

  updateSettings(settings: Partial<PrivacySettings>): void {
    this.settings = { ...this.settings, ...settings }
    savePrivacySettings(this.settings)
    
    if (settings.autoLock !== undefined) {
      if (settings.autoLock) {
        this.startAutoLockTimer()
      } else {
        this.stopAutoLockTimer()
      }
    }
  }

  getSettings(): PrivacySettings {
    return { ...this.settings }
  }

  resetActivity(): void {
    if (this.settings.autoLock) {
      this.resetAutoLockTimer()
    }
  }

  private startAutoLockTimer(): void {
    this.stopAutoLockTimer()
    const ms = this.settings.autoLockMinutes * 60 * 1000
    this.autoLockTimer = setTimeout(() => {
      this.onAutoLock()
    }, ms)
  }

  private stopAutoLockTimer(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer)
      this.autoLockTimer = null
    }
  }

  private resetAutoLockTimer(): void {
    this.startAutoLockTimer()
  }

  private onAutoLock(): void {
    console.log('[PrivacyManager] Auto-lock triggered')
    if (typeof window.dsGui?.lockApp === 'function') {
      void window.dsGui.lockApp()
    }
  }

  setupClipboardMonitoring(): void {
    if (!this.settings.clearClipboard) return

    document.addEventListener('copy', this.handleClipboardCopy)
    document.addEventListener('cut', this.handleClipboardCopy)
  }

  removeClipboardMonitoring(): void {
    document.removeEventListener('copy', this.handleClipboardCopy)
    document.removeEventListener('cut', this.handleClipboardCopy)
    this.clearClipboardTimer()
  }

  private handleClipboardCopy = (): void => {
    if (!this.settings.clearClipboard) return
    this.clearClipboardTimer()
    this.clipboardClearTimer = setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => {
        console.log('[PrivacyManager] Could not clear clipboard')
      })
    }, this.settings.clearClipboardSeconds * 1000)
  }

  private clearClipboardTimer(): void {
    if (this.clipboardClearTimer) {
      clearTimeout(this.clipboardClearTimer)
      this.clipboardClearTimer = null
    }
  }
}

export const privacyManager = new PrivacyManager()