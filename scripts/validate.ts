// Checks a dataset's YAML: each file's shape, then every reference between files.
// Errors carry the file and line, and all of them are reported at once.

import type { GameData } from '../src/db/types.ts'

export type Path = (string | number)[]
type Report = (path: Path, message: string) => void
type Check = (value: unknown, path: Path, report: Report) => void

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const text: Check = (v, p, r) => {
  if (typeof v !== 'string') r(p, 'expected text')
}
const id: Check = (v, p, r) => {
  if (typeof v !== 'string' || !/^[a-z0-9][a-z0-9_.-]*$/.test(v)) r(p, 'expected an id (lowercase letters, digits, - _ .)')
}
const number: Check = (v, p, r) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) r(p, 'expected a number')
}
const positive: Check = (v, p, r) => {
  if (typeof v !== 'number' || !(v > 0) || !Number.isFinite(v)) r(p, 'expected a number above 0')
}
const nonNegative: Check = (v, p, r) => {
  if (typeof v !== 'number' || !(v >= 0) || !Number.isFinite(v)) r(p, 'expected a number of at least 0')
}
const boolean: Check = (v, p, r) => {
  if (typeof v !== 'boolean') r(p, 'expected true or false')
}
const oneOf =
  (...values: string[]): Check =>
  (v, p, r) => {
    if (!values.includes(v as string)) r(p, `expected one of: ${values.join(', ')}`)
  }
const list =
  (of: Check): Check =>
  (v, p, r) => {
    if (!Array.isArray(v)) return r(p, 'expected a list')
    v.forEach((item, i) => of(item, [...p, i], r))
  }
const record =
  (of: Check): Check =>
  (v, p, r) => {
    if (!isObject(v)) return r(p, 'expected a map')
    for (const [key, value] of Object.entries(v)) of(value, [...p, key], r)
  }
// Fields ending in "?" are optional. Unknown fields are errors, to catch typos.
const object =
  (fields: Record<string, Check>): Check =>
  (v, p, r) => {
    if (!isObject(v)) return r(p, 'expected a map')
    const known = new Map(Object.entries(fields).map(([k, check]) => [k.replace(/\?$/, ''), { check, optional: k.endsWith('?') }]))
    for (const [key, { check, optional }] of known) {
      if (v[key] === undefined) {
        if (!optional) r(p, `missing field "${key}"`)
      } else check(v[key], [...p, key], r)
    }
    for (const key of Object.keys(v)) if (!known.has(key)) r([...p, key], `unknown field "${key}"`)
  }

const effects = record(number)
const effectNames = list(oneOf('speed', 'productivity', 'consumption', 'pollution', 'quality'))
const surfaceConditions = list(object({ property: id, 'min?': number, 'max?': number }))
const ingredient = object({ type: oneOf('item', 'fluid'), id, amount: positive })
const result = object({
  type: oneOf('item', 'fluid'),
  id,
  'amount?': nonNegative,
  'amount_min?': nonNegative,
  'amount_max?': nonNegative,
  'probability?': nonNegative,
  'extra_fraction?': nonNegative,
  'ignored_by_productivity?': nonNegative,
})

export const SCHEMAS: Record<keyof GameData, Check> = {
  game: object({ name: text, version: text, mods: list(id), source: text }),
  groups: list(object({ id, name: text, order: text, subgroups: list(object({ id, order: text })) })),
  items: list(
    object({
      id,
      name: text,
      subgroup: id,
      order: text,
      stack_size: positive,
      'fuel?': object({ category: id, value: positive, 'burnt_result?': id }),
      'spoil?': object({ time: positive, 'result?': id }),
    }),
  ),
  fluids: list(object({ id, name: text, subgroup: id, order: text, default_temperature: number, 'fuel_value?': positive })),
  recipes: list(
    object({
      id,
      name: text,
      categories: list(id),
      time: positive,
      ingredients: list(ingredient),
      results: list(result),
      'main_product?': id,
      'subgroup?': id,
      order: text,
      'hidden?': boolean,
      allowed_effects: effectNames,
      max_productivity: nonNegative,
      'surface_conditions?': surfaceConditions,
    }),
  ),
  machines: list(
    object({
      id,
      name: text,
      kind: oneOf('crafting', 'mining', 'offshore-pump', 'boiler'),
      categories: list(id),
      speed: positive,
      energy: object({
        type: oneOf('electric', 'burner', 'heat', 'fluid', 'void'),
        usage: nonNegative,
        'drain?': nonNegative,
        'fuel_categories?': list(id),
      }),
      module_slots: nonNegative,
      allowed_effects: effectNames,
      'base_effect?': effects,
      'surface_conditions?': surfaceConditions,
      'boiler?': object({ input_fluid: id, output_fluid: id, target_temperature: number }),
    }),
  ),
  resources: list(
    object({
      id,
      name: text,
      category: id,
      mining_time: positive,
      results: list(result),
      'required_fluid?': object({ id, amount: positive }),
      'infinite?': boolean,
    }),
  ),
  modules: list(object({ id, name: text, category: id, tier: nonNegative, effects })),
  beacons: list(
    object({
      id,
      name: text,
      distribution_effectivity: nonNegative,
      distribution_effectivity_per_quality: nonNegative,
      profile: list(nonNegative),
      module_slots: nonNegative,
      power: nonNegative,
      allowed_effects: effectNames,
    }),
  ),
  belts: list(object({ id, name: text, speed: positive })),
  planets: list(
    object({ id, name: text, kind: oneOf('planet', 'platform'), surface_properties: record(number), resources: list(id), fluids: list(id), gathered: list(id) }),
  ),
  surface_properties: list(object({ id, name: text, default_value: number })),
  qualities: list(
    object({ id, name: text, level: nonNegative, 'next?': id, 'next_probability?': nonNegative, 'chain_probability?': nonNegative, 'beacon_power_multiplier?': nonNegative }),
  ),
  research: list(
    object({
      id,
      name: text,
      kind: oneOf('recipe-productivity', 'mining-productivity'),
      recipes: list(id),
      change: number,
      'max_level?': positive,
    }),
  ),
}

// Checks references between files. Only call once every file has passed its schema.
export function checkReferences(data: GameData, report: (key: keyof GameData, path: Path, message: string) => void): void {
  const ids = <T extends { id: string }>(list: T[]) => new Set(list.map((x) => x.id))
  const items = ids(data.items)
  const fluids = ids(data.fluids)
  const subgroups = new Set(data.groups.flatMap((g) => g.subgroups.map((s) => s.id)))
  const properties = ids(data.surface_properties)
  const craftingCategories = new Set(data.machines.filter((m) => m.kind === 'crafting').flatMap((m) => m.categories))
  const resourceCategories = new Set(data.machines.filter((m) => m.kind === 'mining').flatMap((m) => m.categories))

  const exists = (type: 'item' | 'fluid', value: string) => (type === 'item' ? items : fluids).has(value)

  for (const key of Object.keys(data) as (keyof GameData)[]) {
    const list = data[key]
    if (!Array.isArray(list)) continue
    const seen = new Set<string>()
    list.forEach((entry, i) => {
      if (seen.has(entry.id)) report(key, [i, 'id'], `duplicate id "${entry.id}"`)
      seen.add(entry.id)
    })
  }

  data.items.forEach((item, i) => {
    if (!subgroups.has(item.subgroup)) report('items', [i, 'subgroup'], `unknown subgroup "${item.subgroup}"`)
    if (item.fuel?.burnt_result && !items.has(item.fuel.burnt_result))
      report('items', [i, 'fuel', 'burnt_result'], `unknown item "${item.fuel.burnt_result}"`)
    if (item.spoil?.result && !items.has(item.spoil.result)) report('items', [i, 'spoil', 'result'], `unknown item "${item.spoil.result}"`)
  })
  data.fluids.forEach((fluid, i) => {
    if (!subgroups.has(fluid.subgroup)) report('fluids', [i, 'subgroup'], `unknown subgroup "${fluid.subgroup}"`)
  })
  data.recipes.forEach((recipe, i) => {
    if (!recipe.categories.some((c) => craftingCategories.has(c)))
      report('recipes', [i, 'categories'], `no machine can craft any of: ${recipe.categories.join(', ')}`)
    recipe.ingredients.forEach((x, j) => {
      if (!exists(x.type, x.id)) report('recipes', [i, 'ingredients', j, 'id'], `unknown ${x.type} "${x.id}"`)
    })
    recipe.results.forEach((x, j) => {
      if (!exists(x.type, x.id)) report('recipes', [i, 'results', j, 'id'], `unknown ${x.type} "${x.id}"`)
      if ((x.amount === undefined) === (x.amount_min === undefined || x.amount_max === undefined))
        report('recipes', [i, 'results', j], 'needs either "amount" or both "amount_min" and "amount_max"')
    })
    if (recipe.subgroup && !subgroups.has(recipe.subgroup)) report('recipes', [i, 'subgroup'], `unknown subgroup "${recipe.subgroup}"`)
    recipe.surface_conditions?.forEach((c, j) => {
      if (!properties.has(c.property)) report('recipes', [i, 'surface_conditions', j, 'property'], `unknown surface property "${c.property}"`)
    })
  })
  data.machines.forEach((machine, i) => {
    if (machine.boiler) {
      for (const field of ['input_fluid', 'output_fluid'] as const)
        if (!fluids.has(machine.boiler[field])) report('machines', [i, 'boiler', field], `unknown fluid "${machine.boiler[field]}"`)
    }
    machine.surface_conditions?.forEach((c, j) => {
      if (!properties.has(c.property)) report('machines', [i, 'surface_conditions', j, 'property'], `unknown surface property "${c.property}"`)
    })
  })
  data.resources.forEach((resource, i) => {
    if (!resourceCategories.has(resource.category)) report('resources', [i, 'category'], `no mining drill can mine "${resource.category}"`)
    resource.results.forEach((x, j) => {
      if (!exists(x.type, x.id)) report('resources', [i, 'results', j, 'id'], `unknown ${x.type} "${x.id}"`)
    })
    if (resource.required_fluid && !fluids.has(resource.required_fluid.id))
      report('resources', [i, 'required_fluid', 'id'], `unknown fluid "${resource.required_fluid.id}"`)
  })
  data.modules.forEach((module, i) => {
    if (!items.has(module.id)) report('modules', [i, 'id'], `no item "${module.id}" for this module`)
  })
  const resources = ids(data.resources)
  data.planets.forEach((planet, i) => {
    for (const property of Object.keys(planet.surface_properties))
      if (!properties.has(property)) report('planets', [i, 'surface_properties', property], `unknown surface property "${property}"`)
    planet.resources.forEach((r, j) => {
      if (!resources.has(r)) report('planets', [i, 'resources', j], `unknown resource "${r}"`)
    })
    planet.fluids.forEach((f, j) => {
      if (!fluids.has(f)) report('planets', [i, 'fluids', j], `unknown fluid "${f}"`)
    })
    planet.gathered.forEach((x, j) => {
      if (!items.has(x)) report('planets', [i, 'gathered', j], `unknown item "${x}"`)
    })
  })
  const qualities = ids(data.qualities)
  data.qualities.forEach((quality, i) => {
    if (quality.next && !qualities.has(quality.next)) report('qualities', [i, 'next'], `unknown quality "${quality.next}"`)
  })
  const recipes = ids(data.recipes)
  data.research.forEach((research, i) => {
    research.recipes.forEach((r, j) => {
      if (!recipes.has(r)) report('research', [i, 'recipes', j], `unknown recipe "${r}"`)
    })
  })
}
