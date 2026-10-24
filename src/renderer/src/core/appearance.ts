import type { Appearance, Settings } from '@shared/types'

/** Convert "#rrggbb" into an rgba() string. */
export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '').trim()
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  const num = Number.parseInt(full.slice(0, 6) || '000000', 16)
  if (Number.isNaN(num)) return `rgba(137, 180, 250, ${alpha})`
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Relative luminance of a colour, used to pick readable foregrounds. */
export function luminance(hex: string): number {
  const value = hex.replace('#', '').trim()
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  const num = Number.parseInt(full.slice(0, 6) || '000000', 16)
  if (Number.isNaN(num)) return 0.5
  const r = ((num >> 16) & 255) / 255
  const g = ((num >> 8) & 255) / 255
  const b = (num & 255) / 255
  const channel = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export const DEFAULT_APPEARANCE: Appearance = {
  cornerRadius: 10,
  glassTopBar: true,
  glassBlur: 18,
  glassOpacity: 0.72,
  gradient: true,
  gradientFrom: '#2f3350',
  gradientTo: '#1b1d2b',
  accentColor: '#3574f0',
  density: 'cozy',
  tabStyle: 'rounded',
  showToolbarIcons: true,
  softShadows: true,
  animations: true,
}

/** Push the appearance settings into CSS custom properties. */
export function applyAppearance(settings: Settings): void {
  const root = document.documentElement
  // Every value falls back to the default: an older settings file must never
  // produce an invalid stylesheet.
  const stored = (settings.appearance ?? {}) as Partial<Appearance>
  const a: Appearance = { ...DEFAULT_APPEARANCE, ...stored }
  const radius = Math.max(0, Math.min(18, Number(a.cornerRadius) || 0))
  const accent = /^#[0-9a-f]{3,8}$/i.test(a.accentColor) ? a.accentColor : DEFAULT_APPEARANCE.accentColor
  const gradientFrom = /^#[0-9a-f]{3,8}$/i.test(a.gradientFrom) ? a.gradientFrom : DEFAULT_APPEARANCE.gradientFrom
  const gradientTo = /^#[0-9a-f]{3,8}$/i.test(a.gradientTo) ? a.gradientTo : DEFAULT_APPEARANCE.gradientTo

  root.style.setProperty('--radius', `${radius}px`)
  root.style.setProperty('--radius-sm', `${Math.max(0, radius - 3)}px`)
  root.style.setProperty('--radius-lg', `${radius + 6}px`)
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--accent-soft', hexToRgba(accent, 0.18))
  root.style.setProperty('--accent-softer', hexToRgba(accent, 0.1))
  root.style.setProperty('--accent-contrast', luminance(accent) > 0.55 ? '#0b0d12' : '#ffffff')
  root.style.setProperty('--glass-blur', `${Math.max(0, Number(a.glassBlur) || 0)}px`)
  root.style.setProperty('--gradient-from', gradientFrom)
  root.style.setProperty('--gradient-to', gradientTo)
  root.setAttribute('data-density', a.density ?? DEFAULT_APPEARANCE.density)
  root.setAttribute('data-tab-style', a.tabStyle ?? DEFAULT_APPEARANCE.tabStyle)
  root.setAttribute('data-glass', a.glassTopBar ? 'on' : 'off')
  root.setAttribute('data-gradient', a.gradient ? 'on' : 'off')
  root.setAttribute('data-animations', a.animations ? 'on' : 'off')
  root.setAttribute('data-shadows', a.softShadows ? 'on' : 'off')
  root.setAttribute('data-syntax-theme', settings.syntaxTheme ?? 'darcula')
}

/** Read the appearance back out of the CSS (used by the settings preview). */
export function currentRadius(): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--radius')
  return Number.parseFloat(value) || 0
}
