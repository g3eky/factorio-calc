// Turns game data and settings into processes: every way of making something, with the
// per-machine rates after modules, beacons, research and the game's limits.

import type { EffectName, Effects, GameData, Machine, Recipe, Result } from '../db/types.ts'
import type { Amount, ModuleSetup, SolveRequest } from './types.ts'

export interface Process {
  key: string
  kind: 'recipe' | 'resource' | 'pump'
  id: string
  machine: Machine
  // Per machine, per second.
  inputs: Amount[]
  outputs: Amount[]
  power: number
  speed: number
  productivity: number
  consumption: number
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
function fits(effects: Effects, allowed: EffectName[]): boolean {
  return EFFECTS.every((e) => !(effects[e]! > 0) || allowed.includes(e))
}

export function moduleEffects(data: GameData, setup: ModuleSetup | undefined, machine: Machine, allowed: EffectName[], warnings: string[]): Effects {
  if (!setup) return {}
  const modules = new Map(data.modules.map((m) => [m.id, m]))
  let total: Effects = {}
  const inMachine = setup.modules.slice(0, machine.module_slots)
  for (const id of inMachine) {
    const module = modules.get(id)
    if (!module) warnings.push(`Unknown module "${id}"`)
    else if (!fits(module.effects, allowed)) warnings.push(`${module.name} can't be used in ${machine.name} for this`)
    else total = add(total, module.effects)
  }
  const beaconCount = setup.beacons.reduce((n, b) => n + b.count, 0)
  for (const placed of setup.beacons) {
    const beacon = data.beacons.find((b) => b.id === placed.id)
    if (!beacon || placed.count <= 0) continue
    // Each beacon passes on its modules at its effectivity, weakened by how many beacons
    // affect the machine (the 2.x beacon profile).
    const profile = beacon.profile[Math.min(beaconCount, beacon.profile.length) - 1] ?? 0
    for (const id of placed.modules.slice(0, beacon.module_slots)) {
      const module = modules.get(id)
      if (!module || !fits(module.effects, beacon.allowed_effects) || !fits(module.effects, allowed)) continue
      total = add(total, module.effects, placed.count * beacon.distribution_effectivity * profile)
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

// The fastest electric machine without surface restrictions, else the fastest.
export function defaultMachines(data: GameData): Record<string, string> {
  const choice: Record<string, Machine> = {}
  const rank = (m: Machine) => [m.energy.type === 'electric' && !m.surface_conditions ? 1 : 0, m.speed]
  for (const machine of data.machines) {
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
  const machines = new Map(data.machines.map((m) => [m.id, m]))
  const defaults = { ...defaultMachines(data), ...request.machines }
  const research = researchBonuses(data, request.research)
  const fuel = data.items.find((i) => i.id === request.fuel)?.fuel
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
    if (machine.energy.type === 'burner' && fuel && machine.energy.fuel_categories?.includes(fuel.category)) {
      inputs.push({ kind: 'item', id: request.fuel, rate: usage / fuel.value })
    }
    return 0
  }

  for (const recipe of data.recipes) {
    if (disabled.has(recipe.id)) continue
    const key = `recipe/${recipe.id}`
    const machine = pickMachine(key, recipe.categories)
    if (!machine) continue
    processes.push(recipeProcess(data, request, key, recipe, machine, research.recipes.get(recipe.id) ?? 0, energy, warnings))
  }

  for (const resource of data.resources) {
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
    processes.push({ key, kind: 'resource', id: resource.id, machine, inputs, outputs, power, speed: speed - 1, productivity, consumption: effects.consumption ?? 0 })
  }

  // Offshore pumps pump water. (Other fluids per planet come with planet support.)
  for (const machine of data.machines.filter((m) => m.kind === 'offshore-pump')) {
    if (!data.fluids.some((f) => f.id === 'water')) break
    processes.push({
      key: `pump/${machine.id}/water`,
      kind: 'pump',
      id: 'water',
      machine,
      inputs: [],
      outputs: [{ kind: 'fluid', id: 'water', rate: machine.speed }],
      power: energy(machine, 0, []),
      speed: 0,
      productivity: 0,
      consumption: 0,
    })
    break
  }
  return processes
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
  const crafts = (machine.speed * speed) / recipe.time
  const inputs: Amount[] = recipe.ingredients.map((i) => ({ kind: i.type, id: i.id, rate: crafts * i.amount }))
  const outputs = recipe.results.map((r) => {
    const { base, productive } = expected(r)
    return { kind: r.type, id: r.id, rate: crafts * (base + productive * productivity) }
  })
  const power = energy(machine, effects.consumption ?? 0, inputs)
  return { key, kind: 'recipe', id: recipe.id, machine, inputs, outputs, power, speed: speed - 1, productivity, consumption: effects.consumption ?? 0 }
}
