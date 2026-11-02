import { expect, test } from 'vitest'
import { readInterface, UI_SCALES } from './interface.ts'

test('only known UI scales are accepted', () => {
  expect(readInterface({ version: 1, uiScale: 1.25 })).toEqual({ version: 1, uiScale: 1.25, theme: 'system' })
  expect(readInterface({ version: 1, uiScale: 1, theme: 'dark' })).toEqual({ version: 1, uiScale: 1, theme: 'dark' })
  expect(readInterface({ version: 1, uiScale: 1, theme: 'pink' })?.theme).toBe('system')
  expect(readInterface({ version: 1, uiScale: 1.3 })).toBeUndefined()
  expect(readInterface({ version: 2, uiScale: 1 })).toBeUndefined()
  expect(readInterface('big')).toBeUndefined()
  expect(UI_SCALES).toContain(1)
})
