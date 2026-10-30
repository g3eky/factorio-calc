// User preferences, stored in localStorage under one versioned key.

export interface Settings {
  rateUnit: 's' | 'min' | 'h'
}

export const STORAGE_KEY = 'factorio-calc:v1'

export const defaultSettings: Settings = { rateUnit: 'min' }

type Store = Pick<Storage, 'getItem' | 'setItem'>

export function loadSettings(store: Store = localStorage): Settings {
  try {
    const stored = JSON.parse(store.getItem(STORAGE_KEY) ?? 'null')
    if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return defaultSettings
    return { ...defaultSettings, ...stored }
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings: Settings, store: Store = localStorage): void {
  store.setItem(STORAGE_KEY, JSON.stringify(settings))
}
