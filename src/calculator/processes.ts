// Turns game data and settings into processes: every way of making something, with the
// per-machine rates after modules, beacons, research and the game's limits.

import type { EffectName, Effects, GameData, Machine, Planet, Recipe, Result, SurfaceCondition } from '../db/types.ts'
import type { Amount, ModuleSetup, SolveRequest } from './types.ts'

export interface Process {
  key: string
  kind: 'recipe' | 'resource' | 'pump'
  id: string
  // Quality the recipe runs at; missing means normal.
  quality?: string
  machine: Machine
  machineQuality?: string
  // Per machine, per second.
  inputs: Amount[]
  outputs: Amount[]
  power: number
  speed: number
  productivity: number
  consumption: number
  qualityEffect: number
}

// The game never lets speed or consumption drop below -80%.
const MIN_MULTIPLIER = 0.2
const EFFECTS: EffectName[] = ['speed', 'productivity', 'consumption', 'pollution', 'quality']

const add = (a: Effects, b: Effects, scale = 1): Effects => {
  const out = { ...a }
  for (const e of EFFECTS) if (b[e]) out[e] = (out[e] ?? 0) + b[e]! * scale
  return out
}

// A module fits if every effect it improves is allowed; unwanted side effects (such as a
// speed module's quality penalty where quality isn't allowed) simply don't apply.
export function fits(effects: Effects, allowed: EffectName[]): boolean {
  return EFFECTS.every((e) => !(effects[e]! > 0) || allowed.includes(e))
}

// Quality level of a tier id (0 for normal or unknown).
export const qualityLevel = (data: GameData, id: string | undefined) => data.qualities.find((q) => q.id === id)?.level ?? 0

// Higher quality makes positive effects stronger, by 30% per level; penalties stay the same.
const QUALITY_BONUS = 0.3
const strengthen = (effects: Effects, level: number): Effects =>
  Object.fromEntries(Object.entries(effects).map(([e, v]) => [e, v! > 0 ? v! * (1 + QUALITY_BONUS * level) : v]))

// Where one craft's output ends up, by tier, when it's made at `from` with quality effect `chance`:
// one step up with that chance, then each further step with the tier's chain probability.
export function upgrades(data: GameData, from: number, chance: number): { tier: number; share: number }[] {
  const tiers = qualityTiers(data)
  const start = tiers[from]
  const up = Math.min(1, Math.max(0, chance)) * (start?.next_probability ?? 1)
  if (up <= 0 || from >= tiers.length - 1) return [{ tier: from, share: 1 }]
  const out = [{ tier: from, share: 1 - up }]
  let reach = up
  for (let tier = from + 1; tier < tiers.length; tier++) {
    const further = tier < tiers.length - 1 ? (tiers[tier].chain_probability ?? 0) : 0
    out.push({ tier, share: reach * (1 - further) })
    reach *= further
  }
  return out
}

export const qualityTiers = (data: GameData) => [...data.qualities].sort((a, b) => a.level - b.level)

export function moduleEffects(data: GameData, setup: ModuleSetup | undefined, machine: Machine, allowed: EffectName[], warnings: string[]): Effects {
  if (!setup) return {}
  const modules = new Map(data.modules.map((m) => [m.id, m]))
  let total: Effects = {}
  const inMachine = setup.modules.slice(0, machine.module_slots)
  for (const id of inMachine) {
    const module = modules.get(id)
    if (!module) warnings.push(`Unknown module "${id}"`)
    else if (!fits(module.effects, allowed)) warnings.push(`${module.name} can't be used in ${machine.name} for this`)
    else total = add(total, strengthen(module.effects, qualityLevel(data, setup.quality)))
  }
  const beaconCount = setup.beacons.reduce((n, b) => n + b.count, 0)
  for (const placed of setup.beacons) {
    const beacon = data.beacons.find((b) => b.id === placed.id)
    if (!beacon || placed.count <= 0) continue
    // Each beacon passes on its modules at its effectivity, weakened by how many beacons
    // affect the machine (the 2.x beacon profile).
    const profile = beacon.profile[Math.min(beaconCount, beacon.profile.length) - 1] ?? 0
    const effectivity = beacon.distribution_effectivity + beacon.distribution_effectivity_per_quality * qualityLevel(data, placed.quality)
    for (const id of placed.modules.slice(0, beacon.module_slots)) {
      const module = modules.get(id)
      if (!module || !fits(module.effects, beacon.allowed_effects) || !fits(module.effects, allowed)) continue
      total = add(total, strengthen(module.effects, qualityLevel(data, placed.moduleQuality)), placed.count * effectivity * profile)
    }
  }
  // Only effects the machine and recipe allow apply at all.
  return Object.fromEntries(Object.entries(total).filter(([e]) => allowed.includes(e as EffectName)))
}

// Expected amount of a result per craft, and the part productivity multiplies.
export function expected(result: Result): { base: number; productive: number } {
  const amount = result.amount ?? ((result.amount_min ?? 0) + (result.amount_max ?? 0)) / 2
  const probability = result.probability ?? 1
  const base = amount * probability + (result.extra_fraction ?? 0)
  const productive = Math.max(0, amount - (result.ignored_by_productivity ?? 0)) * probability + (result.extra_fraction ?? 0)
  return { base, productive }
}

// Whether something with these surface conditions works on the planet. Without a planet: yes.
export function onSurface(data: GameData, planet: Planet | undefined, conditions: SurfaceCondition[] | undefined): boolean {
  if (!planet || !conditions) return true
  return conditions.every((c) => {
    const value = planet.surface_properties[c.property] ?? data.surface_properties.find((p) => p.id === c.property)?.default_value ?? 0
    return (c.min === undefined || value >= c.min) && (c.max === undefined || value <= c.max)
  })
}

// The fastest electric machine without surface restrictions, else the fastest; only machines
// that work on the planet, when there is one.
export function defaultMachines(data: GameData, planet?: Planet): Record<string, string> {
  const choice: Record<string, Machine> = {}
  const rank = (m: Machine) => [m.energy.type === 'electric' && !m.surface_conditions ? 1 : 0, m.speed]
  for (const machine of data.machines) {
    if (!onSurface(data, planet, machine.surface_conditions)) continue
    for (const category of machine.categories) {
      const current = choice[category]
      const [a1, a2] = rank(machine)
      const [b1, b2] = current ? rank(current) : [-1, -1]
      if (a1 > b1 || (a1 === b1 && a2 > b2)) choice[category] = machine
    }
  }
  return Object.fromEntries(Object.entries(choice).map(([category, m]) => [category, m.id]))
}

// Productivity per recipe from research levels, and mining productivity.
export function researchBonuses(data: GameData, levels: Record<string, number>) {
  const recipes = new Map<string, number>()
  let mining = 0
  for (const research of data.research) {
    const level = Math.min(levels[research.id] ?? 0, research.max_level ?? Infinity)
    if (level <= 0) continue
    if (research.kind === 'mining-productivity') mining += research.change * level
    for (const recipe of research.recipes) recipes.set(recipe, (recipes.get(recipe) ?? 0) + research.change * level)
  }
  return { recipes, mining }
}

export function buildProcesses(data: GameData, request: SolveRequest, warnings: string[]): Process[] {
  const planet = data.planets.find((p) => p.id === request.planet)
  const machines = new Map(data.machines.filter((m) => onSurface(data, planet, m.surface_conditions)).map((m) => [m.id, m]))
  const defaults = { ...defaultMachines(data, planet), ...request.machines }
  const research = researchBonuses(data, request.research)
  // The preferred fuel where a burner accepts it; otherwise the first fuel it does accept
  // (biochambers burn nutrients, not coal).
  const fuels = data.items.filter((i) => i.fuel)
  const fuelFor = (machine: Machine) => {
    const accepts = (id: string) => fuels.find((i) => i.id === id && machine.energy.fuel_categories?.includes(i.fuel!.category))
    return accepts(request.fuel) ?? fuels.find((i) => machine.energy.fuel_categories?.includes(i.fuel!.category))
  }
  const disabled = new Set(request.disabled)
  const processes: Process[] = []

  const pickMachine = (key: string, categories: string[]): Machine | undefined => {
    const chosen = machines.get(request.overrides[key]?.machine ?? '')
    if (chosen && chosen.categories.some((c) => categories.includes(c))) return chosen
    for (const category of categories) {
      const machine = machines.get(defaults[category])
      if (machine?.categories.includes(category)) return machine
    }
    return undefined
  }

  // Power and fuel for one machine running with the given consumption effect.
  const energy = (machine: Machine, consumption: number, inputs: Amount[]) => {
    const usage = machine.energy.usage * Math.max(MIN_MULTIPLIER, 1 + consumption)
    if (machine.energy.type === 'electric') return usage + (machine.energy.drain ?? 0)
    const fuel = machine.energy.type === 'burner' ? fuelFor(machine) : undefined
    if (fuel) inputs.push({ kind: 'item', id: fuel.id, rate: usage / fuel.fuel!.value })
    return 0
  }

  for (const recipe of data.recipes) {
    if (disabled.has(recipe.id) || !onSurface(data, planet, recipe.surface_conditions)) continue
    const key = `recipe/${recipe.id}`
    const machine = pickMachine(key, recipe.categories)
    if (!machine) continue
    processes.push(recipeProcess(data, request, key, recipe, machine, research.recipes.get(recipe.id) ?? 0, energy, warnings))
  }

  for (const resource of data.resources) {
    if (planet && !planet.resources.includes(resource.id)) continue
    const key = `resource/${resource.id}`
    const machine = pickMachine(key, [resource.category])
    if (!machine) continue
    const allowed = machine.allowed_effects
    const effects = add(add(machine.base_effect ?? {}, moduleEffects(data, request.overrides[key]?.setup ?? request.setups[machine.id], machine, allowed, warnings)), {
      productivity: research.mining,
    })
    const speed = Math.max(MIN_MULTIPLIER, 1 + (effects.speed ?? 0))
    const productivity = Math.max(0, effects.productivity ?? 0)
    const ops = (machine.speed * speed) / resource.mining_time
    const inputs: Amount[] = resource.required_fluid ? [{ kind: 'fluid', id: resource.required_fluid.id, rate: ops * resource.required_fluid.amount }] : []
    const outputs = resource.results.map((r) => {
      const { base, productive } = expected(r)
      return { kind: r.type, id: r.id, rate: ops * (base + productive * productivity) }
    })
    const power = energy(machine, effects.consumption ?? 0, inputs)
    processes.push({
      key,
      kind: 'resource',
      id: resource.id,
      machine,
      inputs,
      outputs,
      power,
      speed: speed - 1,
      productivity,
      consumption: effects.consumption ?? 0,
      qualityEffect: Math.max(0, effects.quality ?? 0),
    })
  }

  // Offshore pumps pump the planet's fluids; without a planet, water.
  const pump = [...machines.values()].find((m) => m.kind === 'offshore-pump')
  const pumped = planet ? planet.fluids : data.fluids.some((f) => f.id === 'water') ? ['water'] : []
  for (const fluid of pump ? pumped : []) {
    processes.push({
      key: `pump/${pump!.id}/${fluid}`,
      kind: 'pump',
      id: fluid,
      machine: pump!,
      inputs: [],
      outputs: [{ kind: 'fluid', id: fluid, rate: pump!.speed }],
      power: energy(pump!, 0, []),
      speed: 0,
      productivity: 0,
      consumption: 0,
      qualityEffect: 0,
    })
  }
  return withQuality(data, request, processes)
}

// Spreads item outputs over quality tiers by each process's quality effect. When a target asks
// for a higher tier, also runs every item recipe at the higher tiers, with ingredients of that
// tier. Fluids have no quality.
function withQuality(data: GameData, request: SolveRequest, processes: Process[]): Process[] {
  const tiers = qualityTiers(data)
  if (tiers.length < 2) return processes
  const expand = request.targets.some((t) => t.quality && t.quality !== tiers[0].id)
  const recipes = new Map(data.recipes.map((r) => [r.id, r]))
  const out: Process[] = []
  for (const p of processes) {
    const recipe = p.kind === 'recipe' ? recipes.get(p.id) : undefined
    const ingredients = new Set(recipe?.ingredients.filter((i) => i.type === 'item').map((i) => i.id))
    const hasItems = !!recipe && (ingredients.size > 0 || recipe.results.some((r) => r.type === 'item'))
    const levels = expand && hasItems ? tiers.length : 1
    for (let tier = 0; tier < levels; tier++) {
      if (tier === 0 && p.qualityEffect <= 0) {
        out.push(p)
        continue
      }
      const quality = tier > 0 ? tiers[tier].id : undefined
      const split = upgrades(data, tier, p.qualityEffect)
      out.push({
        ...p,
        key: quality ? `${p.key}@${quality}` : p.key,
        quality,
        // Only the recipe's own ingredients take its quality; fuel stays normal.
        inputs: p.inputs.map((i) => (i.kind === 'item' && quality && ingredients.has(i.id) ? { ...i, quality } : i)),
        outputs: p.outputs.flatMap((o) =>
          o.kind === 'fluid'
            ? [o]
            : split
                .filter((s) => s.share > 0)
                .map((s) => (s.tier > 0 ? { ...o, rate: o.rate * s.share, quality: tiers[s.tier].id } : { ...o, rate: o.rate * s.share })),
        ),
      })
    }
  }
  return out
}

function recipeProcess(
  data: GameData,
  request: SolveRequest,
  key: string,
  recipe: Recipe,
  machine: Machine,
  researchProductivity: number,
  energy: (machine: Machine, consumption: number, inputs: Amount[]) => number,
  warnings: string[],
): Process {
  // Effects must be allowed by both the machine and the recipe.
  const allowed = machine.allowed_effects.filter((e) => recipe.allowed_effects.includes(e))
  const setup = request.overrides[key]?.setup ?? request.setups[machine.id]
  let effects = add(
    Object.fromEntries(Object.entries(machine.base_effect ?? {}).filter(([e]) => recipe.allowed_effects.includes(e as EffectName))),
    moduleEffects(data, setup, machine, allowed, warnings),
  )
  if (recipe.allowed_effects.includes('productivity')) effects = add(effects, { productivity: researchProductivity })
  const speed = Math.max(MIN_MULTIPLIER, 1 + (effects.speed ?? 0))
  const productivity = Math.min(recipe.max_productivity, Math.max(0, effects.productivity ?? 0))
  // Higher quality crafting machines craft faster: +30% per level.
  const machineQuality = request.overrides[key]?.quality ?? request.machineQuality
  const crafts = (machine.speed * (1 + QUALITY_BONUS * qualityLevel(data, machineQuality)) * speed) / recipe.time
  const inputs: Amount[] = recipe.ingredients.map((i) => ({ kind: i.type, id: i.id, rate: crafts * i.amount }))
  const outputs = recipe.results.map((r) => {
    const { base, productive } = expected(r)
    return { kind: r.type, id: r.id, rate: crafts * (base + productive * productivity) }
  })
  const power = energy(machine, effects.consumption ?? 0, inputs)
  return {
    key,
    kind: 'recipe',
    id: recipe.id,
    machine,
    machineQuality: machineQuality && machineQuality !== data.qualities[0]?.id ? machineQuality : undefined,
    inputs,
    outputs,
    power,
    speed: speed - 1,
    productivity,
    consumption: effects.consumption ?? 0,
    qualityEffect: Math.max(0, effects.quality ?? 0),
  }
}
