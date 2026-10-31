import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { cssColor, resolveStyle } from './theme.ts'

test('converts Factorio colours to CSS', () => {
  expect(cssColor({})).toBe('rgb(0 0 0)')
  expect(cssColor([1, 1, 1])).toBe('rgb(255 255 255)')
  expect(cssColor([255, 230, 192])).toBe('rgb(255 230 192)')
  expect(cssColor([1, 1, 1, 0.5])).toBe('rgb(255 255 255 / 0.5)')
  expect(cssColor({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 })).toBe('rgb(128 128 128 / 0.5)')
  expect(cssColor(undefined)).toBeUndefined()
})

test('styles inherit from their parents; padding replaces inherited side paddings', () => {
  const styles = {
    base: { left_padding: 8, right_padding: 8, font: 'default' },
    child: { parent: 'base', padding: 0, top_padding: 2 },
  }
  expect(resolveStyle(styles, 'child')).toMatchObject({ left_padding: 0, right_padding: 0, bottom_padding: 0, top_padding: 2, font: 'default' })
})

// The generated theme carries the game's own numbers.
const css = readFileSync(join(process.cwd(), 'src/theme/game.css'), 'utf8')

test.each([
  ['--game-button-min-width', '108px'],
  ['--game-button-min-height', '28px'],
  ['--game-button-padding', '0px 8px 0px 8px'],
  ['--game-button-font-weight', '600'],
  ['--game-button-pressed-offset', '1px'],
  ['--game-label-font-size', '14px'],
  ['--game-frame-title-color', 'rgb(255 230 192)'],
  ['--game-slot-width', '40px'],
  ['--game-tab-selected-color', 'rgb(255 230 192)'],
  ['--game-back-button-font-size', '18px'],
  ['--game-flow-spacing', '4px'],
  ['--game-header-spacing', '8px'],
  ['--game-padded-frame-padding', '12px 12px 12px 12px'],
  ['--game-frame-action-button-width', '24px'],
])('game.css: %s is %s', (name, value) => {
  expect(css).toContain(`${name}: ${value};`)
})
