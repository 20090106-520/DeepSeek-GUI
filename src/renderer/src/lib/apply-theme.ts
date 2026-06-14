export type ThemePreference = 'system' | 'light' | 'dark'
export type UiFontScale = 'extraSmall' | 'small' | 'medium' | 'large' | 'extraLarge'

export const UI_FONT_SCALE_OPTIONS: { value: UiFontScale; label: string }[] = [
  { value: 'extraSmall', label: 'Extra Small' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'extraLarge', label: 'Extra Large' }
]

let removeSystemListener: (() => void) | null = null

function resolvedMode(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'dark') return 'dark'
  if (pref === 'light') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Applies `data-theme` on `<html>` for Tailwind `dark:` variants and CSS variables.
 */
export function applyTheme(pref: ThemePreference): void {
  removeSystemListener?.()
  removeSystemListener = null

  const root = document.documentElement
  const apply = (): void => {
    const mode = resolvedMode(pref)
    root.setAttribute('data-theme', mode)
  }

  if (pref === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => {
      apply()
    }
    mq.addEventListener('change', onChange)
    removeSystemListener = (): void => {
      mq.removeEventListener('change', onChange)
    }
  }

  apply()
}

export function applyUiFontScale(scale: UiFontScale): void {
  const root = document.documentElement
  const factor =
    scale === 'extraSmall'
      ? '0.75'
      : scale === 'small'
        ? '0.82'
        : scale === 'large'
          ? '1'
          : scale === 'extraLarge'
            ? '1.1'
            : '0.88'
  root.style.setProperty('--ds-ui-scale', factor)
}

export function applyUiZoom(zoom: number): void {
  const root = document.documentElement
  const clamped = Math.min(150, Math.max(80, zoom))
  const factor = (clamped / 100).toFixed(2)
  root.style.setProperty('--ds-ui-scale', factor)
}

export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'cyan'

export const ACCENT_COLORS: { value: AccentColor; label: string; hex: string }[] = [
  { value: 'blue', label: 'Blue', hex: '#3b82f6' },
  { value: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { value: 'green', label: 'Green', hex: '#22c55e' },
  { value: 'orange', label: 'Orange', hex: '#f97316' },
  { value: 'pink', label: 'Pink', hex: '#ec4899' },
  { value: 'cyan', label: 'Cyan', hex: '#06b6d4' }
]

export function applyAccentColor(color: AccentColor): void {
  const root = document.documentElement
  const accentColor = ACCENT_COLORS.find(c => c.value === color)?.hex || '#3b82f6'
  root.style.setProperty('--ds-accent', accentColor)
}

/**
 * Mirrors the active i18n locale onto `<html lang>` so screen readers,
 * browser spellcheck, and CSS `:lang()` selectors match the visible UI.
 */
export function applyDocumentLocale(locale: 'en' | 'zh'): void {
  const lang = locale === 'zh' ? 'zh-CN' : 'en'
  if (document.documentElement.getAttribute('lang') !== lang) {
    document.documentElement.setAttribute('lang', lang)
  }
}
