import { join } from 'node:path'
import highsLoader from 'highs'
import { beforeAll, describe, expect, test } from 'vitest'
import { readDataset } from '../../scripts/build-db.ts'
import type { GameData } from '../db/types.ts'
import { onSurface } from './processes.ts'
import { defaultDisabled, solve, type LpSolver } from './solve.ts'
import type { SolveRequest, SolveResult } from './types.ts'

let fixture: GameData
let spaceAge: GameData
let lp: LpSolver

beforeAll(async () => {
  fixture = await readDataset(join(process.cwd(), 'scripts/fixtures/basic'))
  spaceAge = await readDataset(join(process.cwd(), 'data/space-age/2.1.24'))
  const highs = await highsLoader()
  lp = (model) => highs.solve(model)
})

const request = (data: GameData, overrides: Partial<SolveRequest>): SolveRequest => ({
  targets: [],
  machines: {},
  setups: {},
  overrides: {},
  disabled: defaultDisabled(data),
  research: {},
  fuel: 'coal',
  ...overrides,
})

function solved(data: GameData, overrides: Partial<SolveRequest>): SolveResult {
  const response = solve(data, request(data, overrides), lp)
  if (!response.ok) throw new Error(response.error)
  return response.result
}

const machinesFor = (result: SolveResult, key: string) => result.processes.find((p) => p.key === key)?.machines ?? 0
const rate = (list: { id: string; rate: number }[], id: string) => list.find((a) => a.id === id)?.rate ?? 0

test('plain chain: 3 cable assemblers to 2 circuit assemblers', () => {
  const result = solved(fixture, { targets: [{ kind: 'item', id: 'electronic-circuit', rate: 1 }], machines: { crafting: 'assembling-machine-2', smelting: 'stone-furnace' } })
  const circuits = machinesFor(result, 'recipe/electronic-circuit')
  const cables = machinesFor(result, 'recipe/copper-cable')
  expect(circuits).toBeCloseTo(2 / 3, 9)
  expect(cables).toBeCloseTo(1, 9)
  expect(cables / circuits).toBeCloseTo(3 / 2, 9)
  expect(rate(result.raw, 'iron-ore')).toBeCloseTo(1, 9)
  expect(rate(result.raw, 'copper-ore')).toBeCloseTo(1.5, 9)
  // Stone furnaces burn coal: 90 kW / 4 MJ per coal, per furnace.
  const furnaces = machinesFor(result, 'recipe/iron-plate') + machinesFor(result, 'recipe/copper-plate')
  expect(rate(result.raw, 'coal')).toBeCloseTo((furnaces * 90000) / 4e6, 9)
  // Electric power: assemblers at 150 kW + 5 kW drain, drills at 90 kW.
  const drills = machinesFor(result, 'resource/iron-ore') + machinesFor(result, 'resource/copper-ore') + machinesFor(result, 'resource/coal')
  expect(result.power).toBeCloseTo((circuits + cables) * 155000 + drills * 90000, 3)
})

test('advanced oil processing and cracking turn all crude into petroleum gas', () => {
  const result = solved(fixture, { targets: [{ kind: 'fluid', id: 'petroleum-gas', rate: 10 }] })
  // Per 100 crude: 55 gas, plus 25 heavy -> 18.75 light, 63.75 light -> 42.5 gas: 97.5 gas.
  expect(rate(result.raw, 'crude-oil')).toBeCloseTo((10 / 97.5) * 100, 9)
  expect(machinesFor(result, 'recipe/advanced-oil-processing')).toBeCloseTo(10 / 97.5 / 0.2, 9)
  expect(result.surplus).toEqual([])
})

test('Kovarex: solves the cycle with the least uranium ore', () => {
  const result = solved(fixture, { targets: [{ kind: 'item', id: 'uranium-235', rate: 1 }] })
  // Processing a/s and Kovarex k/s: 0.007a + k = 1, and 0.993a = 3k. So a = 1 / 0.338.
  const a = 1 / (0.007 + 0.993 / 3)
  expect(rate(result.raw, 'uranium-ore')).toBeCloseTo(10 * a, 6)
  expect(machinesFor(result, 'recipe/uranium-processing')).toBeCloseTo(a * 12, 6)
  expect(machinesFor(result, 'recipe/kovarex-enrichment-process')).toBeCloseTo(((0.993 * a) / 3) * 60, 6)
  // Uranium mining needs 1 sulfuric acid per ore, which nothing in the fixture makes.
  expect(rate(result.raw, 'sulfuric-acid')).toBeCloseTo(10 * a, 6)
})

test('modules, beacons and research combine like the game', () => {
  const setup = {
    modules: ['productivity-module', 'productivity-module', 'productivity-module'],
    beacons: [{ id: 'beacon', count: 1, modules: ['speed-module', 'speed-module'] }],
  }
  const result = solved(fixture, {
    targets: [{ kind: 'item', id: 'electronic-circuit', rate: 2.88 }],
    machines: { crafting: 'assembling-machine-2' },
    overrides: { 'recipe/electronic-circuit': { setup } },
    research: { 'electronic-circuit-productivity': 2 },
  })
  const circuit = result.processes.find((p) => p.key === 'recipe/electronic-circuit')!
  // Two module slots, so only two productivity modules count: speed 1 - 0.1 + 2 x 0.2 x 1.5,
  // productivity 0.08 + 0.2 research, consumption 0.8 + 2 x 0.5 x 1.5.
  expect(circuit.speed).toBeCloseTo(0.5, 9)
  expect(circuit.productivity).toBeCloseTo(0.28, 9)
  expect(circuit.consumption).toBeCloseTo(2.3, 9)
  // 0.75 x 1.5 / 0.5 = 2.25 crafts/s x 1.28 = 2.88 circuits/s from one machine.
  expect(circuit.machines).toBeCloseTo(1, 9)
  expect(circuit.power).toBeCloseTo(150000 * 3.3 + 5000, 3)
})

test('beacons get weaker the more there are (beacon profile)', () => {
  const beacons = (count: number) =>
    solved(fixture, {
      targets: [{ kind: 'item', id: 'copper-cable', rate: 1 }],
      machines: { crafting: 'assembling-machine-2' },
      setups: { 'assembling-machine-2': { modules: [], beacons: [{ id: 'beacon', count, modules: ['speed-module', 'speed-module'] }] } },
    }).processes.find((p) => p.key === 'recipe/copper-cable')!.speed
  expect(beacons(1)).toBeCloseTo(0.6, 9)
  expect(beacons(2)).toBeCloseTo(2 * 0.6 * 0.7071, 9)
  expect(beacons(4)).toBeCloseTo(4 * 0.6 * 0.5, 9)
})

test('built-in productivity of the foundry, and the productivity cap', () => {
  const result = solved(fixture, { targets: [{ kind: 'item', id: 'iron-plate', rate: 1.875 }], machines: { smelting: 'foundry' } })
  expect(machinesFor(result, 'recipe/iron-plate')).toBeCloseTo(1, 9)
  expect(rate(result.raw, 'iron-ore')).toBeCloseTo(1.25, 9)

  const capped = solved(fixture, {
    targets: [{ kind: 'item', id: 'electronic-circuit', rate: 1 }],
    research: { 'electronic-circuit-productivity': 50 },
  })
  expect(capped.processes.find((p) => p.key === 'recipe/electronic-circuit')!.productivity).toBe(3)
})

test('modules that the recipe forbids are left out, with a warning', () => {
  const result = solved(fixture, {
    targets: [{ kind: 'item', id: 'uranium-235', rate: 1 }],
    overrides: { 'recipe/kovarex-enrichment-process': { setup: { modules: ['productivity-module'], beacons: [] } } },
  })
  expect(result.processes.find((p) => p.key === 'recipe/kovarex-enrichment-process')!.productivity).toBe(0)
  expect(result.warnings).toEqual(["Productivity module can't be used in Centrifuge for this"])
})

test('turning off a needed recipe explains what is missing', () => {
  const response = solve(fixture, request(fixture, { targets: [{ kind: 'item', id: 'electronic-circuit', rate: 1 }], disabled: [...defaultDisabled(fixture), 'copper-cable'] }), lp)
  expect(response).toEqual({ ok: false, error: 'Nothing can make Copper cable: Copper cable is turned off.' })
})

test('Space Age: every science pack at once, quickly', () => {
  const packs = spaceAge.items.filter((i) => i.id.endsWith('-science-pack')).map((i) => ({ kind: 'item' as const, id: i.id, rate: 1 }))
  expect(packs).toHaveLength(12)
  const started = performance.now()
  const result = solved(spaceAge, { targets: packs })
  const elapsed = performance.now() - started
  for (const pack of packs) expect(rate(result.processes.flatMap((p) => p.outputs), pack.id)).toBeGreaterThanOrEqual(1 - 1e-9)
  expect(result.processes.length).toBeGreaterThan(30)
  expect(elapsed).toBeLessThan(50)
})

describe('planets', () => {
  const on = (planet: string, id: string, rate = 1) => solved(spaceAge, { planet, targets: [{ kind: 'item', id, rate }] })
  const keys = (result: SolveResult) => result.processes.map((p) => p.key)

  test('Vulcanus: iron plates from pumped lava, no iron ore', () => {
    const result = on('vulcanus', 'iron-plate')
    expect(keys(result)).toContain('pump/offshore-pump/lava')
    expect(keys(result)).toContain('recipe/molten-iron-from-lava')
    expect(keys(result)).not.toContain('resource/iron-ore')
    expect(result.imports).toEqual([])
  })

  test('Fulgora: holmium from mined and recycled scrap, with byproducts', () => {
    const result = on('fulgora', 'holmium-plate')
    expect(keys(result)).toContain('resource/scrap')
    expect(keys(result)).toContain('recipe/scrap-recycling')
    expect(result.surplus.length).toBeGreaterThan(0)
    expect(result.imports).toEqual([])
  })

  test('Space platform: iron from crushed asteroid chunks', () => {
    const result = on('space-platform', 'iron-plate')
    expect(keys(result)).toContain('recipe/metallic-asteroid-crushing')
    expect(rate(result.raw, 'metallic-asteroid-chunk')).toBeGreaterThan(0)
    expect(result.imports).toEqual([])
  })

  test('Gleba: bioflux from gathered fruit', () => {
    const result = on('gleba', 'bioflux')
    expect(result.raw.map((r) => r.id).sort()).toEqual(expect.arrayContaining(['jellynut', 'yumako']))
    expect(result.imports).toEqual([])
  })

  test('burners use a fuel they accept: biochambers burn nutrients', () => {
    const result = on('gleba', 'bioflux')
    const biochambers = result.processes.filter((p) => p.machine === 'biochamber')
    expect(biochambers.length).toBeGreaterThan(0)
    for (const p of biochambers) expect(p.inputs.map((i) => i.id)).toContain('nutrients')
  })

  test('what a planet lacks is imported, not invented', () => {
    const result = on('nauvis', 'tungsten-plate')
    expect(result.imports.length).toBeGreaterThan(0)
    expect(keys(result)).not.toContain('resource/tungsten-ore')
  })

  test('recipes and machines whose surface conditions fail are never used', () => {
    const packs = spaceAge.items.filter((i) => i.id.endsWith('-science-pack')).map((i) => ({ kind: 'item' as const, id: i.id, rate: 1 }))
    for (const planet of spaceAge.planets) {
      const result = solved(spaceAge, { planet: planet.id, targets: packs })
      for (const p of result.processes) {
        if (p.kind === 'recipe') expect(onSurface(spaceAge, planet, spaceAge.recipes.find((r) => r.id === p.id)!.surface_conditions), `${p.id} on ${planet.id}`).toBe(true)
        expect(onSurface(spaceAge, planet, spaceAge.machines.find((m) => m.id === p.machine)!.surface_conditions), `${p.machine} on ${planet.id}`).toBe(true)
      }
    }
  })
})
