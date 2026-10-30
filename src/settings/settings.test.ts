import { expect, test } from 'vitest'
import { defaultSettings, loadSettings, saveSettings, STORAGE_KEY } from './settings.ts'

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
}

test('returns defaults when nothing is stored', () => {
  expect(loadSettings(memoryStore())).toEqual(defaultSettings)
})

test('returns defaults when the stored value is unreadable', () => {
  expect(loadSettings(memoryStore({ [STORAGE_KEY]: '{not json' }))).toEqual(defaultSettings)
  expect(loadSettings(memoryStore({ [STORAGE_KEY]: '[1,2]' }))).toEqual(defaultSettings)
})

test('round-trips saved settings', () => {
  const store = memoryStore()
  saveSettings({ rateUnit: 'h' }, store)
  expect(loadSettings(store)).toEqual({ rateUnit: 'h' })
})
