// Interface preferences: one set for the whole site, not per game version.

export interface InterfacePreferences {
  version: 1
  // Page scale, like the game's UI scale: 1 = 100%.
  uiScale: number
  // Colour theme; "system" follows the device's light or dark setting.
  theme: Theme
}

export type Theme = 'system' | 'light' | 'dark'
export const THEMES: Theme[] = ['system', 'light', 'dark']

export const INTERFACE_KEY = 'factorio-calc:v1:interface'

// The game's UI scale steps.
export const UI_SCALES = [0.75, 0.85, 1, 1.25, 1.5, 1.75, 2]

export const defaultInterface = (): InterfacePreferences => ({ version: 1, uiScale: 1, theme: 'system' })

export function readInterface(value: unknown): InterfacePreferences | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const v = value as Record<string, unknown>
  if (v.version !== 1 || typeof v.uiScale !== 'number' || !UI_SCALES.includes(v.uiScale)) return undefined
  // Saved before themes existed: follow the system.
  const theme = THEMES.includes(v.theme as Theme) ? (v.theme as Theme) : 'system'
  return { version: 1, uiScale: v.uiScale, theme }
}

// Scales the whole page. index.html does the same before the app loads, so nothing jumps.
// Sets data-theme on the root (tokens.css); "system" removes it. index.html does the same before
// the app loads, so the other theme never flashes.
export function applyTheme(theme: Theme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

export function applyUiScale(scale: number): void {
  document.documentElement.style.zoom = String(scale)
  document.documentElement.style.setProperty('--ui-scale', String(scale))
}
