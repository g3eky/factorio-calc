// Converts Factorio's data.raw (as dumped by dump.lua) into GameData.
// Keeps only what the calculator needs, fills in the game's defaults, and drops what no
// machine can make or use.

import type {
  EffectName,
  Effects,
  Energy,
  Fluid,
  GameData,
  Group,
  Ingredient,
  Item,
  Machine,
  Recipe,
  Research,
  Resource,
  Result,
  SurfaceCondition,
} from '../../src/db/types.ts'

type Proto = Record<string, any>
export type Raw = Record<string, Record<string, Proto>>

const ALL_EFFECTS: EffectName[] = ['speed', 'productivity', 'consumption', 'pollution', 'quality']
const TICKS_PER_SECOND = 60
// Item types that aren't real items for a calculator (tools for blueprints, planners).
const NON_ITEM_TYPES = new Set([
  'blueprint',
  'blueprint-book',
  'copy-paste-tool',
  'deconstruction-item',
  'upgrade-item',
  'selection-tool',
  'spidertron-remote',
])

const UNITS: Record<string, number> = { '': 1, k: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15 }

// "150kW" -> 150000, "4MJ" -> 4000000.
export function parseEnergy(value: string | number | undefined): number {
  if (value === undefined) return 0
  if (typeof value === 'number') return value
  const match = /^([\d.]+)\s*([kMGTP]?)[WJ]$/.exec(value)
  if (!match) throw new Error(`Unknown energy value "${value}"`)
  return round(Number(match[1]) * UNITS[match[2]])
}

// Removes floating point noise such as 0.30000000000000004.
const round = (n: number) => Number(n.toPrecision(12))

// "iron-plate" -> "Iron plate", for anything the wiki has no name for.
export function nameFromId(id: string): string {
  const words = id.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const list = <T>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : [])
// Lua has no empty list, so an empty table can arrive as {}. Missing means use the default.
const luaList = <T>(value: T[] | Proto | undefined, fallback: T[]): T[] => (value === undefined ? fallback : list(value as T[]))
const all = (raw: Raw, ...types: string[]): Proto[] => types.flatMap((t) => Object.values(raw[t] ?? {}))

function effects(effect: Proto | undefined): Effects | undefined {
  if (!effect) return undefined
  const result: Effects = {}
  for (const name of ALL_EFFECTS) if (typeof effect[name] === 'number' && effect[name] !== 0) result[name] = round(effect[name])
  return Object.keys(result).length ? result : undefined
}

function surfaceConditions(conditions: Proto[] | undefined): SurfaceCondition[] | undefined {
  const result = list(conditions).map((c) => {
    const condition: SurfaceCondition = { property: c.property }
    if (c.min !== undefined) condition.min = c.min
    if (c.max !== undefined) condition.max = c.max
    return condition
  })
  return result.length ? result : undefined
}

function result(r: Proto): Result {
  const out: Result = { type: r.type === 'fluid' ? 'fluid' : 'item', id: r.name }
  if (r.amount !== undefined) out.amount = round(r.amount)
  if (r.amount_min !== undefined) out.amount_min = round(r.amount_min)
  if (r.amount_max !== undefined) out.amount_max = round(r.amount_max)
  if (r.amount === undefined && r.amount_min === undefined) out.amount = 1
  // 2.1 splits probability into independent rolls and slices {min, max} of one shared roll;
  // either way the chance of this result is a single number.
  const shared = r.shared_probability
  const probability = r.probability ?? r.independent_probability ?? (shared && typeof shared === 'object' ? shared.max - shared.min : shared)
  if (probability !== undefined && probability !== 1) out.probability = round(probability)
  if (r.extra_count_fraction) out.extra_fraction = round(r.extra_count_fraction)
  if (r.ignored_by_productivity) out.ignored_by_productivity = round(r.ignored_by_productivity)
  return out
}

export function convert(raw: Raw, game: GameData['game'], names: Map<string, string>): GameData {
  const name = (id: string) => names.get(id) ?? nameFromId(id)

  // Machines first: they decide which recipes and resources are usable.
  const machines: Machine[] = []
  const energy = (p: Proto, usage: number, crafting: boolean): Energy => {
    const source = p.energy_source ?? { type: 'void' }
    const e: Energy = { type: source.type, usage: source.type === 'void' ? 0 : usage }
    if (source.type === 'electric') {
      // Crafting machines draw 1/30 of their power when idle unless told otherwise.
      const drain = source.drain !== undefined ? parseEnergy(source.drain) : crafting ? round(usage / 30) : 0
      if (drain) e.drain = drain
    }
    if (source.type === 'burner') e.fuel_categories = list(source.fuel_categories ?? (source.fuel_category ? [source.fuel_category] : ['chemical']))
    return e
  }
  const machine = (p: Proto, kind: Machine['kind'], categories: string[], speed: number, usage: number): Machine => {
    const m: Machine = {
      id: p.name,
      name: name(p.name),
      kind,
      categories,
      speed: round(speed),
      energy: energy(p, usage, kind === 'crafting'),
      module_slots: p.module_slots ?? 0,
      allowed_effects: luaList(p.allowed_effects, p.module_slots ? ALL_EFFECTS : []),
    }
    const base = effects(p.effect_receiver?.base_effect)
    if (base) m.base_effect = base
    const conditions = surfaceConditions(p.surface_conditions)
    if (conditions) m.surface_conditions = conditions
    return m
  }
  for (const p of all(raw, 'assembling-machine', 'furnace', 'rocket-silo')) {
    if (p.hidden) continue
    machines.push(machine(p, 'crafting', list(p.crafting_categories), p.crafting_speed, parseEnergy(p.energy_usage)))
  }
  for (const p of all(raw, 'mining-drill')) {
    if (p.hidden) continue
    machines.push(machine(p, 'mining', list(p.resource_categories), p.mining_speed, parseEnergy(p.energy_usage)))
  }
  for (const p of all(raw, 'offshore-pump')) {
    if (p.hidden) continue
    machines.push(machine(p, 'offshore-pump', [], p.pumping_speed * TICKS_PER_SECOND, parseEnergy(p.energy_usage)))
  }
  for (const p of all(raw, 'boiler')) {
    if (p.hidden || !p.fluid_box?.filter || !p.output_fluid_box?.filter) continue
    const m = machine(p, 'boiler', [], 1, parseEnergy(p.energy_consumption))
    m.boiler = { input_fluid: p.fluid_box.filter, output_fluid: p.output_fluid_box.filter, target_temperature: p.target_temperature }
    machines.push(m)
  }
  const craftingCategories = new Set(machines.filter((m) => m.kind === 'crafting').flatMap((m) => m.categories))
  const resourceCategories = new Set(machines.filter((m) => m.kind === 'mining').flatMap((m) => m.categories))

  // Items and fluids.
  const items: Item[] = []
  for (const [type, protos] of Object.entries(raw)) {
    if (NON_ITEM_TYPES.has(type)) continue
    for (const p of Object.values(protos)) {
      if (p.stack_size === undefined || p.hidden || p.parameter) continue
      const item: Item = { id: p.name, name: name(p.name), subgroup: p.subgroup ?? 'other', order: p.order ?? '', stack_size: p.stack_size }
      if (p.fuel_value && parseEnergy(p.fuel_value) > 0) {
        item.fuel = { category: list(p.fuel_categories)[0] ?? p.fuel_category ?? 'chemical', value: parseEnergy(p.fuel_value) }
        if (p.burnt_result) item.fuel.burnt_result = p.burnt_result
      }
      if (p.spoil_ticks) {
        item.spoil = { time: round(p.spoil_ticks / TICKS_PER_SECOND) }
        if (p.spoil_result) item.spoil.result = p.spoil_result
      }
      items.push(item)
    }
  }
  const fluids: Fluid[] = all(raw, 'fluid')
    .filter((p) => !p.hidden && !p.parameter)
    .map((p) => {
      const fluid: Fluid = { id: p.name, name: name(p.name), subgroup: p.subgroup ?? 'fluid', order: p.order ?? '', default_temperature: p.default_temperature }
      if (p.fuel_value && parseEnergy(p.fuel_value) > 0) fluid.fuel_value = parseEnergy(p.fuel_value)
      return fluid
    })
  const itemIds = new Set(items.map((i) => i.id))
  const fluidIds = new Set(fluids.map((f) => f.id))
  const known = (x: { type: string; id: string }) => (x.type === 'fluid' ? fluidIds : itemIds).has(x.id)

  // Recipes a machine can make, using only known items and fluids.
  const recipes: Recipe[] = []
  for (const p of all(raw, 'recipe')) {
    if (p.parameter) continue
    const categories: string[] = p.categories ?? [p.category ?? 'crafting']
    if (!categories.some((c) => craftingCategories.has(c))) continue
    const ingredients: Ingredient[] = list<Proto>(p.ingredients).map((x) => ({
      type: x.type === 'fluid' ? 'fluid' : 'item',
      id: x.name,
      amount: round(x.amount),
    }))
    const results = list<Proto>(p.results).map(result)
    if (!results.length || ![...ingredients, ...results].every(known)) continue
    const mainProduct = p.main_product || (results.length === 1 ? results[0].id : undefined)
    const recipe: Recipe = {
      id: p.name,
      name: name(p.name),
      categories: categories.filter((c) => craftingCategories.has(c)),
      time: round(p.energy_required ?? 0.5),
      ingredients,
      results,
      order: p.order ?? '',
      allowed_effects: ALL_EFFECTS.filter((e) => p[`allow_${e}`] ?? e !== 'productivity'),
      max_productivity: p.maximum_productivity ?? 3,
    }
    if (mainProduct) recipe.main_product = mainProduct
    if (p.subgroup) recipe.subgroup = p.subgroup
    if (p.hidden) recipe.hidden = true
    const conditions = surfaceConditions(p.surface_conditions)
    if (conditions) recipe.surface_conditions = conditions
    recipes.push(recipe)
  }

  // Resources some drill can mine.
  const resources: Resource[] = []
  for (const p of all(raw, 'resource')) {
    const category = p.category ?? 'basic-solid'
    if (!p.minable || !resourceCategories.has(category)) continue
    const results = p.minable.results
      ? list<Proto>(p.minable.results).map(result)
      : [{ type: 'item' as const, id: p.minable.result, amount: p.minable.count ?? 1 }]
    if (!results.every(known)) continue
    const resource: Resource = { id: p.name, name: name(p.name), category, mining_time: round(p.minable.mining_time), results }
    // fluid_amount is per 10 mining operations.
    if (p.minable.required_fluid) resource.required_fluid = { id: p.minable.required_fluid, amount: round(p.minable.fluid_amount / 10) }
    if (p.infinite) resource.infinite = true
    resources.push(resource)
  }
  const resourceIds = new Set(resources.map((r) => r.id))

  // Groups: only the subgroups something uses, and only groups with such subgroups.
  const usedSubgroups = new Set([...items, ...fluids, ...recipes].map((x) => x.subgroup).filter(Boolean) as string[])
  const groups: Group[] = all(raw, 'item-group')
    .map((g) => ({
      id: g.name,
      name: name(g.name),
      order: g.order ?? '',
      subgroups: all(raw, 'item-subgroup')
        .filter((s) => s.group === g.name && usedSubgroups.has(s.name))
        .map((s) => ({ id: s.name, order: s.order ?? '' })),
    }))
    .filter((g) => g.subgroups.length)
  const subgroupIds = new Set(groups.flatMap((g) => g.subgroups.map((s) => s.id)))
  for (const x of [...items, ...fluids]) {
    if (!subgroupIds.has(x.subgroup)) throw new Error(`${x.id}: subgroup "${x.subgroup}" is in no item group`)
  }

  const surfaceProperties = all(raw, 'surface-property').map((p) => ({ id: p.name, name: name(p.name), default_value: p.default_value }))

  const planets: GameData['planets'] = [
    ...all(raw, 'planet').map((p) => ({
      id: p.name,
      name: name(p.name),
      kind: 'planet' as const,
      surface_properties: p.surface_properties ?? {},
      resources: Object.keys(p.map_gen_settings?.autoplace_settings?.entity?.settings ?? {})
        .filter((r) => resourceIds.has(r))
        .sort(),
    })),
    ...all(raw, 'surface').map((p) => ({
      id: p.name,
      name: name(p.name),
      kind: 'platform' as const,
      surface_properties: p.surface_properties ?? {},
      resources: [],
    })),
  ]

  const qualities = all(raw, 'quality')
    .filter((q) => !q.hidden)
    .sort((a, b) => a.level - b.level)
    .map((q) => {
      const quality: GameData['qualities'][number] = { id: q.name, name: name(q.name), level: q.level }
      if (q.next) {
        quality.next = q.next
        quality.next_probability = q.next_probability
      }
      return quality
    })

  const recipeIds = new Set(recipes.map((r) => r.id))
  const research: Research[] = []
  for (const t of all(raw, 'technology')) {
    const effectsList = list<Proto>(t.effects)
    const maxLevel = t.max_level === 'infinite' ? undefined : (t.max_level ?? 1)
    const recipeEffects = effectsList.filter((e) => e.type === 'change-recipe-productivity' && recipeIds.has(e.recipe))
    const mining = effectsList.find((e) => e.type === 'mining-drill-productivity-bonus')
    if (!recipeEffects.length && !mining) continue
    const entry: Research = mining
      ? { id: t.name, name: name(t.name), kind: 'mining-productivity', recipes: [], change: round(mining.modifier) }
      : { id: t.name, name: name(t.name), kind: 'recipe-productivity', recipes: recipeEffects.map((e) => e.recipe), change: round(recipeEffects[0].change) }
    if (maxLevel !== undefined) entry.max_level = maxLevel
    research.push(entry)
  }

  const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id)
  return {
    game,
    groups: groups.sort((a, b) => a.order.localeCompare(b.order) || a.id.localeCompare(b.id)),
    items: items.sort(byId),
    fluids: fluids.sort(byId),
    recipes: recipes.sort(byId),
    machines: machines.sort(byId),
    resources: resources.sort(byId),
    modules: all(raw, 'module')
      .filter((m) => !m.hidden && itemIds.has(m.name))
      .map((m) => ({ id: m.name, name: name(m.name), category: m.category, tier: m.tier, effects: effects(m.effect) ?? {} }))
      .sort(byId),
    beacons: all(raw, 'beacon')
      .filter((b) => !b.hidden)
      .map((b) => ({
        id: b.name,
        name: name(b.name),
        distribution_effectivity: b.distribution_effectivity,
        distribution_effectivity_per_quality: b.distribution_effectivity_bonus_per_quality_level ?? 0,
        profile: list<number>(b.profile).length ? b.profile : [1],
        module_slots: b.module_slots ?? 0,
        power: parseEnergy(b.energy_usage),
        allowed_effects: luaList(b.allowed_effects, ALL_EFFECTS),
      }))
      .sort(byId),
    belts: all(raw, 'transport-belt')
      .filter((b) => !b.hidden)
      // Speed is tiles per tick; a full belt carries 8 items per tile across both lanes.
      .map((b) => ({ id: b.name, name: name(b.name), speed: round(b.speed * TICKS_PER_SECOND * 8) }))
      .sort((a, b) => a.speed - b.speed),
    planets: planets.sort(byId),
    surface_properties: surfaceProperties.sort(byId),
    qualities,
    research: research.sort(byId),
  }
}
