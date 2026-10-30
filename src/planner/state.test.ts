import { beforeAll, expect, test } from 'vitest'
import type { Game } from '../db/GameProvider.tsx'
import { fixtureGame } from '../test/fixtureGame.tsx'
import { long, power, short } from './format.ts'
import { emptyCalculation, isCalculation, recipesFor, toRequest, type Calculation } from './state.ts'

let game: Game
beforeAll(async () => {
  game = await fixtureGame()
})

const calc = (patch: Partial<Calculation>): Calculation => ({ ...emptyCalculation(game), ...patch })

test('targets in any unit become rates per second', () => {
  const request = toRequest(
    game,
    calc({
      targets: [
        { kind: 'item', id: 'iron-plate', amount: 120, unit: 'min' },
        { kind: 'item', id: 'copper-plate', amount: 2, unit: 'belts' },
        { kind: 'item', id: 'copper-cable', amount: 7200, unit: 'h' },
        { kind: 'item', id: 'electronic-circuit', amount: 2, unit: 'machines' },
        { kind: 'item', id: 'no-such-item', amount: 1, unit: 's' },
      ],
    }),
  )
  expect(request.targets).toEqual([
    { kind: 'item', id: 'iron-plate', rate: 2 },
    { kind: 'item', id: 'copper-plate', rate: 30 },
    { kind: 'item', id: 'copper-cable', rate: 2 },
    // The fastest crafting machine in the fixture is assembling machine 2: 0.75 / 0.5 per second each.
    { kind: 'item', id: 'electronic-circuit', rate: 3 },
  ])
})

test('choosing a recipe turns off the other recipes for that item', () => {
  expect(recipesFor(game, 'item', 'uranium-235').map((r) => r.id)).toEqual(['uranium-processing', 'kovarex-enrichment-process'])
  const request = toRequest(game, calc({ recipes: { 'item/uranium-235': 'uranium-processing' } }))
  expect(request.disabled).toContain('kovarex-enrichment-process')
  expect(request.disabled).not.toContain('uranium-processing')
  // Recycling stays off by default.
  expect(request.disabled).toContain('electronic-circuit-recycling')
})

test('stored calculations are checked before use', () => {
  expect(isCalculation(calc({}))).toBe(true)
  expect(isCalculation({ targets: 'oops' })).toBe(false)
  expect(isCalculation(null)).toBe(false)
})

test('numbers are formatted like the game', () => {
  expect([0.125, 2.5, 25.55, 250.4, 2500, 25000, 2.5e6].map(short)).toEqual(['0.13', '2.5', '25.6', '250', '2.5k', '25k', '2.5M'])
  expect(long(1234.5678)).toBe('1,234.6')
  expect(long(0.12345)).toBe('0.123')
  expect(power(155000)).toBe('155 kW')
  expect(power(1906000)).toBe('1.906 MW')
})
