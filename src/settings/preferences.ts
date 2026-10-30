// The defaults every calculation starts from, saved per dataset in localStorage.

import type { ModuleSetup } from '../calculator/types.ts'

export interface Preferences {
  version: 1
  // Machine per crafting or resource category (missing: the calculator's default).
  machines: Record<string, string>
  // Modules and beacons per machine id.
  setups: Record<string, ModuleSetup>
  // Research id -> level researched.
  research: Record<string, number>
  // Recipes turned off on top of the defaults, and default-off recipes turned on.
  disabled: string[]
  enabled: string[]
  // Fuel item for burner machines.
  fuel: string
  // Default quality of machines; missing means normal. (Added after version 1; optional.)
  machineQuality?: string
}

export const CURRENT_VERSION = 1

export const defaultPreferences = (): Preferences => ({
  version: CURRENT_VERSION,
  machines: {},
  setups: {},
  research: {},
  disabled: [],
  enabled: [],
  fuel: 'coal',
})

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStringList = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string')
const isSetup = (v: unknown) =>
  isObject(v) &&
  isStringList(v.modules) &&
  Array.isArray(v.beacons) &&
  v.beacons.every((b) => isObject(b) && typeof b.id === 'string' && typeof b.count === 'number' && isStringList(b.modules))

export function isPreferences(v: unknown): v is Preferences {
  return (
    isObject(v) &&
    v.version === CURRENT_VERSION &&
    isObject(v.machines) &&
    Object.values(v.machines).every((m) => typeof m === 'string') &&
    isObject(v.setups) &&
    Object.values(v.setups).every(isSetup) &&
    isObject(v.research) &&
    Object.values(v.research).every((n) => typeof n === 'number' && n >= 0) &&
    isStringList(v.disabled) &&
    isStringList(v.enabled) &&
    typeof v.fuel === 'string' &&
    (v.machineQuality === undefined || typeof v.machineQuality === 'string')
  )
}

// Upgrades stored preferences from older versions. Each entry turns version n into n + 1.
// When the shape changes: bump CURRENT_VERSION and add the step here.
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {}

export function migrate(stored: unknown): Preferences | undefined {
  if (!isObject(stored) || typeof stored.version !== 'number') return undefined
  let value = stored
  for (let v = stored.version; v < CURRENT_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) return undefined
    value = { ...step(value), version: v + 1 }
  }
  return isPreferences(value) ? value : undefined
}

// Export file: the preferences plus which dataset they're for.
export function exportPreferences(prefs: Preferences, dataset: string): string {
  return JSON.stringify({ app: 'factorio-calc', dataset, preferences: prefs }, null, 2)
}

export function importPreferences(text: string): Preferences {
  let file: unknown
  try {
    file = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!isObject(file) || file.app !== 'factorio-calc') throw new Error('That is not a Factorio calculator settings file.')
  const prefs = migrate(file.preferences)
  if (!prefs) throw new Error('The settings in that file are damaged or from a newer version.')
  return prefs
}
