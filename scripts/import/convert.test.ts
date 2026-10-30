import { expect, test } from 'vitest'
import { convert, nameFromId, parseEnergy, type Raw } from './convert.ts'

const game = { name: 'Test', version: '0', mods: ['base'], source: 'test' }

// A minimal data.raw with the shapes Factorio 2.1 uses.
const raw: Raw = {
  'item-group': { intermediate: { name: 'intermediate', order: 'c' } },
  'item-subgroup': { plates: { name: 'plates', group: 'intermediate', order: 'a' }, fluid: { name: 'fluid', group: 'intermediate', order: 'b' } },
  item: {
    'iron-ore': { name: 'iron-ore', subgroup: 'plates', stack_size: 50 },
    'iron-plate': { name: 'iron-plate', subgroup: 'plates', order: 'b', stack_size: 100 },
    scrap: { name: 'scrap', subgroup: 'plates', stack_size: 50 },
    coal: { name: 'coal', subgroup: 'plates', stack_size: 50, fuel_value: '4MJ', fuel_categories: ['chemical'] },
    bacteria: { name: 'bacteria', subgroup: 'plates', stack_size: 50, spoil_ticks: 3600, spoil_result: 'iron-ore' },
    secret: { name: 'secret', subgroup: 'plates', stack_size: 1, hidden: true },
  },
  fluid: { 'sulfuric-acid': { name: 'sulfuric-acid', subgroup: 'fluid', default_temperature: 25 } },
  'assembling-machine': {
    assembler: { name: 'assembler', crafting_categories: ['crafting'], crafting_speed: 0.75, energy_usage: '150kW', energy_source: { type: 'electric' }, module_slots: 2 },
  },
  furnace: {
    furnace: { name: 'furnace', crafting_categories: ['smelting'], crafting_speed: 2, energy_usage: '90kW', energy_source: { type: 'burner', fuel_categories: ['chemical'] }, allowed_effects: {} },
  },
  'mining-drill': {
    drill: { name: 'drill', resource_categories: ['basic-solid'], mining_speed: 0.5, energy_usage: '90kW', energy_source: { type: 'electric' }, module_slots: 3 },
  },
  recipe: {
    'iron-plate': {
      name: 'iron-plate',
      categories: ['smelting'],
      energy_required: 3.2,
      ingredients: [{ type: 'item', name: 'iron-ore', amount: 1 }],
      results: [{ type: 'item', name: 'iron-plate', amount: 1 }],
      allow_productivity: true,
    },
    'scrap-recycling': {
      name: 'scrap-recycling',
      categories: ['crafting'],
      ingredients: [{ type: 'item', name: 'scrap', amount: 1 }],
      results: [
        { type: 'item', name: 'iron-plate', amount: 1, shared_probability: { min: 0, max: 0.2 } },
        { type: 'item', name: 'coal', amount: 1, independent_probability: 0.05 },
      ],
    },
    'hand-only': { name: 'hand-only', categories: ['hand-crafting'], ingredients: [], results: [{ type: 'item', name: 'coal', amount: 1 }] },
    'uses-hidden': { name: 'uses-hidden', categories: ['crafting'], ingredients: [{ type: 'item', name: 'secret', amount: 1 }], results: [{ type: 'item', name: 'coal', amount: 1 }] },
  },
  resource: {
    'iron-ore': { name: 'iron-ore', minable: { mining_time: 1, result: 'iron-ore' } },
    uranium: { name: 'uranium', minable: { mining_time: 2, result: 'iron-ore', required_fluid: 'sulfuric-acid', fluid_amount: 10 } },
  },
  technology: {
    'mining-productivity-3': { name: 'mining-productivity-3', effects: [{ type: 'mining-drill-productivity-bonus', modifier: 0.1 }], max_level: 'infinite' },
    'plate-productivity': { name: 'plate-productivity', effects: [{ type: 'change-recipe-productivity', recipe: 'iron-plate', change: 0.1 }] },
  },
}

const names = new Map([['iron-plate', 'Iron plate (wiki)']])
const data = convert(raw, game, names)
const byId = <T extends { id: string }>(list: T[], id: string) => list.find((x) => x.id === id)!

test('parses energy values', () => {
  expect(parseEnergy('150kW')).toBe(150000)
  expect(parseEnergy('4MJ')).toBe(4000000)
  expect(parseEnergy('2.5GW')).toBe(2500000000)
  expect(() => parseEnergy('lots')).toThrow()
})

test('names come from the wiki, else from the id', () => {
  expect(byId(data.items, 'iron-plate').name).toBe('Iron plate (wiki)')
  expect(byId(data.items, 'iron-ore').name).toBe('Iron ore')
  expect(nameFromId('assembling-machine-2')).toBe('Assembling machine 2')
})

test('converts items, fuel and spoiling, and drops hidden items', () => {
  expect(byId(data.items, 'coal').fuel).toEqual({ category: 'chemical', value: 4000000 })
  expect(byId(data.items, 'bacteria').spoil).toEqual({ time: 60, result: 'iron-ore' })
  expect(data.items.find((i) => i.id === 'secret')).toBeUndefined()
})

test('fills in recipe defaults and turns 2.1 probabilities into one chance', () => {
  const recycling = byId(data.recipes, 'scrap-recycling')
  expect(recycling.time).toBe(0.5)
  expect(recycling.allowed_effects).not.toContain('productivity')
  expect(recycling.results).toEqual([
    { type: 'item', id: 'iron-plate', amount: 1, probability: 0.2 },
    { type: 'item', id: 'coal', amount: 1, probability: 0.05 },
  ])
  expect(byId(data.recipes, 'iron-plate').allowed_effects).toContain('productivity')
})

test('drops recipes no machine can make or that use dropped items', () => {
  expect(data.recipes.map((r) => r.id).sort()).toEqual(['iron-plate', 'scrap-recycling'])
})

test('machines get default drain, and an empty Lua table means an empty list', () => {
  expect(byId(data.machines, 'assembler').energy).toEqual({ type: 'electric', usage: 150000, drain: 5000 })
  expect(byId(data.machines, 'assembler').allowed_effects).toHaveLength(5)
  expect(byId(data.machines, 'furnace').allowed_effects).toEqual([])
  expect(byId(data.machines, 'drill').energy.drain).toBeUndefined()
})

test('resources: default category, fluid per mining operation', () => {
  expect(byId(data.resources, 'iron-ore').category).toBe('basic-solid')
  expect(byId(data.resources, 'uranium').required_fluid).toEqual({ id: 'sulfuric-acid', amount: 1 })
})

test('productivity research', () => {
  expect(byId(data.research, 'mining-productivity-3')).toEqual({ id: 'mining-productivity-3', name: 'Mining productivity 3', kind: 'mining-productivity', recipes: [], change: 0.1 })
  expect(byId(data.research, 'plate-productivity')).toMatchObject({ kind: 'recipe-productivity', recipes: ['iron-plate'], change: 0.1, max_level: 1 })
})
