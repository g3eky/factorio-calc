// What's on the calculator screen, and how it turns into a solver request.

import type { Game } from '../db/GameProvider.tsx'
import { buildProcesses } from '../calculator/processes.ts'
import { defaultDisabled } from '../calculator/solve.ts'
import type { Kind, ProcessSettings, SolveRequest } from '../calculator/types.ts'
import type { Recipe } from '../db/types.ts'
import type { Preferences } from '../settings/preferences.ts'
import { UNIT_SECONDS, type RateUnit } from './format.ts'

export type TargetUnit = RateUnit | 'belts' | 'machines'

export interface Target {
  kind: Kind
  id: string
  amount: number
  unit: TargetUnit
}

export interface Calculation {
  targets: Target[]
  // Per process ("recipe/<id>", "resource/<id>"): machine, modules and beacons.
  overrides: Record<string, ProcessSettings>
  // Item ("item/<id>") -> the recipe chosen to make it.
  recipes: Record<string, string>
  // How rates are shown.
  unit: RateUnit
  // Belt used for "belts" targets and belt counts.
  belt: string
}

export const emptyCalculation = (game: Game): Calculation => ({
  targets: [],
  overrides: {},
  recipes: {},
  unit: 'min',
  belt: game.data.belts[0]?.id ?? '',
})

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// Checks a stored calculation's shape. Items the dataset no longer has are dropped when it's used.
export function isCalculation(value: unknown): value is Calculation {
  return (
    isObject(value) &&
    Array.isArray(value.targets) &&
    value.targets.every((t) => isObject(t) && typeof t.id === 'string' && typeof t.amount === 'number' && typeof t.unit === 'string') &&
    isObject(value.overrides) &&
    isObject(value.recipes) &&
    typeof value.unit === 'string' &&
    typeof value.belt === 'string'
  )
}

// Keeps only targets for items and fluids this dataset has.
export function knownTargets(game: Game, targets: Target[]): Target[] {
  return targets.filter((t) => (t.kind === 'fluid' ? game.fluids : game.items).has(t.id))
}

// Recipes whose main product is the item: the choices offered for making it.
const recipeIndex = new WeakMap<Game, Map<string, Recipe[]>>()
export function recipesFor(game: Game, kind: Kind, id: string): Recipe[] {
  let index = recipeIndex.get(game)
  if (!index) {
    index = new Map()
    const off = new Set(defaultDisabled(game.data))
    for (const r of game.data.recipes) {
      const main = r.main_product ?? (r.results.length === 1 ? r.results[0].id : undefined)
      const result = r.results.find((x) => x.id === main)
      if (off.has(r.id) || !result) continue
      const key = `${result.type}/${result.id}`
      if (!index.has(key)) index.set(key, [])
      index.get(key)!.push(r)
    }
    recipeIndex.set(game, index)
  }
  return index.get(`${kind}/${id}`) ?? []
}

export function toRequest(game: Game, calc: Calculation, prefs: Preferences): SolveRequest {
  const disabled = new Set(defaultDisabled(game.data))
  for (const id of prefs.enabled) disabled.delete(id)
  for (const id of prefs.disabled) disabled.add(id)
  // Choosing a recipe for an item turns off the other recipes that mainly make it.
  for (const [key, recipe] of Object.entries(calc.recipes)) {
    const [kind, ...id] = key.split('/')
    for (const r of recipesFor(game, kind as Kind, id.join('/'))) if (r.id !== recipe) disabled.add(r.id)
  }
  const base: SolveRequest = {
    targets: [],
    machines: prefs.machines,
    setups: prefs.setups,
    overrides: calc.overrides,
    disabled: [...disabled],
    research: prefs.research,
    fuel: prefs.fuel,
  }
  const beltSpeed = game.data.belts.find((b) => b.id === calc.belt)?.speed ?? 15
  // For "machines" targets: output of one machine of the recipe that would make the item.
  const processes = calc.targets.some((t) => t.unit === 'machines') ? buildProcesses(game.data, base, []) : []
  base.targets = knownTargets(game, calc.targets).map((t) => {
    let rate = 0
    if (t.unit === 'belts') rate = t.amount * beltSpeed
    else if (t.unit === 'machines') {
      const recipe = calc.recipes[`${t.kind}/${t.id}`] ?? recipesFor(game, t.kind, t.id)[0]?.id
      const process = processes.find((p) => p.kind === 'recipe' && p.id === recipe)
      rate = t.amount * (process?.outputs.find((o) => o.kind === t.kind && o.id === t.id)?.rate ?? 0)
    } else rate = t.amount / UNIT_SECONDS[t.unit]
    return { kind: t.kind, id: t.id, rate }
  })
  return base
}
