// Interface preferences: one set for the whole site, not per game version.

export interface InterfacePreferences {
  version: 1
  // Page scale, like the game's UI scale: 1 = 100%.
  uiScale: number
}

export const INTERFACE_KEY = 'factorio-calc:v1:interface'

// The game's UI scale steps.
export const UI_SCALES = [0.75, 0.85, 1, 1.25, 1.5, 1.75, 2]

export const defaultInterface = (): InterfacePreferences => ({ version: 1, uiScale: 1 })

export function readInterface(value: unknown): InterfacePreferences | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const v = value as Record<string, unknown>
  return v.version === 1 && typeof v.uiScale === 'number' && UI_SCALES.includes(v.uiScale) ? { version: 1, uiScale: v.uiScale } : undefined
}

// Scales the whole page. index.html does the same before the app loads, so nothing jumps.
export function applyUiScale(scale: number): void {
  document.documentElement.style.zoom = String(scale)
  document.documentElement.style.setProperty('--ui-scale', String(scale))
}
