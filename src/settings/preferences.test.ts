import { expect, test } from 'vitest'
import { defaultPreferences, exportPreferences, importPreferences, migrate } from './preferences.ts'
import { loadJson } from './storage.ts'

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
}

const prefs = { ...defaultPreferences(), machines: { crafting: 'assembling-machine-2' }, research: { 'mining-productivity-3': 4 }, enabled: ['scrap-recycling'] }

test('reads current preferences and rejects damaged ones', () => {
  expect(migrate(prefs)).toEqual(prefs)
  expect(migrate({ ...prefs, research: { x: -1 } })).toBeUndefined()
  expect(migrate({ ...prefs, version: 99 })).toBeUndefined()
  expect(migrate('nope')).toBeUndefined()
})

test('broken stored data falls back to defaults and is kept as a backup', () => {
  const store = memoryStore({ key: '{"version": 1, "machines": [' })
  expect(loadJson('key', defaultPreferences(), migrate, store)).toEqual(defaultPreferences())
  expect(store.data.get('key:backup')).toBe('{"version": 1, "machines": [')

  const valid = memoryStore({ key: JSON.stringify(prefs) })
  expect(loadJson('key', defaultPreferences(), migrate, valid)).toEqual(prefs)
  expect(valid.data.has('key:backup')).toBe(false)
})

test('export then import gives the same preferences', () => {
  expect(importPreferences(exportPreferences(prefs, 'space-age-2.1.24'))).toEqual(prefs)
})

test('import explains what is wrong with a bad file', () => {
  expect(() => importPreferences('not json')).toThrow('not valid JSON')
  expect(() => importPreferences('{"app": "something-else"}')).toThrow('not a Factorio calculator settings file')
  expect(() => importPreferences('{"app": "factorio-calc", "preferences": {"version": 1}}')).toThrow('damaged')
})
