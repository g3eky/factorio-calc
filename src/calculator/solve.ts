// Solves for how many machines each process needs, as a linear program:
//   variables   machines per process (>= 0), and supply of raw items (>= 0)
//   constraints each item's net output >= what the targets need (extra is surplus)
//   objective   use as few raw resources as possible; a tiny cost per machine breaks ties
// A linear program handles cycles (Kovarex, oil cracking, recycling) and byproducts.

import type { GameData } from '../db/types.ts'
import { buildProcesses, type Process } from './processes.ts'
import type { Amount, Kind, ProcessResult, SolveRequest, SolveResponse } from './types.ts'

// Solves an LP in CPLEX LP format. In the browser and in tests this is HiGHS.
export type LpSolver = (lp: string) => { Status: string; Columns: Record<string, object> }

// Cost of using one unit of a raw resource. Fluids come in bigger numbers, so weigh less.
const RAW_COST = { item: 1, fluid: 0.1 }
const PUMP_COST = 0.001
const MACHINE_COST = 1e-4
const EPSILON = 1e-9

const itemKey = (a: { kind: Kind; id: string }) => `${a.kind}/${a.id}`

// Recipes that would surprise people if the solver used them unasked.
export function defaultDisabled(data: GameData): string[] {
  const barrels = (ids: string[]) => ids.some((id) => id.endsWith('-barrel') || id === 'barrel')
  return data.recipes
    .filter(
      (r) =>
        r.categories.includes('recycling') ||
        (r.ingredients.some((i) => i.type === 'fluid') && barrels(r.results.map((x) => x.id))) ||
        (r.results.some((x) => x.type === 'fluid') && barrels(r.ingredients.map((i) => i.id))),
    )
    .map((r) => r.id)
}

// Raw items: nothing makes them except recipes disabled by default (recycling, barrels).
export function rawItems(data: GameData): Set<string> {
  const off = new Set(defaultDisabled(data))
  const made = new Set<string>()
  for (const recipe of data.recipes) if (!off.has(recipe.id)) for (const r of recipe.results) made.add(`${r.type}/${r.id}`)
  for (const resource of data.resources) for (const r of resource.results) made.add(`${r.type}/${r.id}`)
  if (data.machines.some((m) => m.kind === 'offshore-pump')) made.add('fluid/water')
  const raw = new Set<string>()
  for (const recipe of data.recipes) for (const i of recipe.ingredients) if (!made.has(`${i.type}/${i.id}`)) raw.add(`${i.type}/${i.id}`)
  for (const resource of data.resources)
    if (resource.required_fluid && !made.has(`fluid/${resource.required_fluid.id}`)) raw.add(`fluid/${resource.required_fluid.id}`)
  for (const item of data.items) if (!made.has(`item/${item.id}`)) raw.add(`item/${item.id}`)
  for (const fluid of data.fluids) if (!made.has(`fluid/${fluid.id}`)) raw.add(`fluid/${fluid.id}`)
  return raw
}

const term = (coefficient: number, variable: string) => `${coefficient < 0 ? '-' : '+'} ${Math.abs(coefficient).toPrecision(15)} ${variable}`

export function solve(data: GameData, request: SolveRequest, lp: LpSolver): SolveResponse {
  const warnings: string[] = []
  const processes = buildProcesses(data, request, warnings)
  const raw = rawItems(data)
  const names = new Map<string, string>([...data.items.map((i) => [`item/${i.id}`, i.name]), ...data.fluids.map((f) => [`fluid/${f.id}`, f.name])] as [string, string][])
  const name = (key: string) => names.get(key) ?? key

  const producers = new Map<string, Process[]>()
  for (const p of processes) {
    for (const o of p.outputs) {
      // Only count processes that make more of the item than they use.
      const used = p.inputs.filter((i) => itemKey(i) === itemKey(o)).reduce((n, i) => n + i.rate, 0)
      if (o.rate > used + EPSILON) {
        if (!producers.has(itemKey(o))) producers.set(itemKey(o), [])
        producers.get(itemKey(o))!.push(p)
      }
    }
  }

  // Walk back from the targets to every item and process they need.
  const demand = new Map<string, number>()
  for (const t of request.targets) if (t.rate > 0) demand.set(itemKey(t), (demand.get(itemKey(t)) ?? 0) + t.rate)
  if (!demand.size) return { ok: true, result: { processes: [], raw: [], surplus: [], power: 0, machines: {}, warnings } }

  // `explored`: items whose producers we've followed. `items`: every item a used process
  // touches, each of which gets a constraint (byproducts too).
  const explored = new Set<string>()
  const items = new Set<string>()
  const used = new Set<Process>()
  const missing: string[] = []
  const queue = [...demand.keys()]
  while (queue.length) {
    const key = queue.pop()!
    if (explored.has(key)) continue
    explored.add(key)
    items.add(key)
    const makers = producers.get(key) ?? []
    if (!makers.length && !raw.has(key)) missing.push(key)
    for (const p of makers) {
      if (used.has(p)) continue
      used.add(p)
      for (const i of p.inputs) queue.push(itemKey(i))
      for (const o of p.outputs) items.add(itemKey(o))
    }
  }
  if (missing.length) {
    const disabled = new Set(request.disabled)
    const offByDefault = new Set(defaultDisabled(data))
    const reasons = missing.map((key) => {
      // Name what the user turned off; recipes that are off by default only if that's all.
      const all = data.recipes.filter((r) => disabled.has(r.id) && r.results.some((x) => `${x.type}/${x.id}` === key))
      const chosen = all.filter((r) => !offByDefault.has(r.id))
      const off = chosen.length ? chosen : all
      return off.length
        ? `Nothing can make ${name(key)}: ${off.map((r) => r.name).join(', ')} ${off.length > 1 ? 'are' : 'is'} turned off.`
        : `Nothing can make ${name(key)}.`
    })
    return { ok: false, error: reasons.join(' ') }
  }

  // Build the linear program over just those processes and items.
  const list = [...used]
  const rawNeeded = [...items].filter((key) => raw.has(key))
  const objective: string[] = []
  const rows = new Map<string, string[]>([...items].map((key) => [key, []]))
  list.forEach((p, i) => {
    const v = `x${i}`
    const net = new Map<string, number>()
    for (const o of p.outputs) net.set(itemKey(o), (net.get(itemKey(o)) ?? 0) + o.rate)
    for (const input of p.inputs) net.set(itemKey(input), (net.get(itemKey(input)) ?? 0) - input.rate)
    for (const [key, rate] of net) if (Math.abs(rate) > EPSILON) rows.get(key)?.push(term(rate, v))
    let cost = MACHINE_COST
    if (p.kind === 'resource') cost += p.outputs.reduce((n, o) => n + o.rate * RAW_COST[o.kind], 0)
    if (p.kind === 'pump') cost += p.outputs.reduce((n, o) => n + o.rate * PUMP_COST, 0)
    objective.push(term(cost, v))
  })
  rawNeeded.forEach((key, i) => {
    rows.get(key)!.push(term(1, `s${i}`))
    objective.push(term(RAW_COST[key.split('/')[0] as Kind], `s${i}`))
  })
  const constraints = [...rows].filter(([, terms]) => terms.length).map(([key, terms], i) => ` c${i}: ${terms.join(' ')} >= ${(demand.get(key) ?? 0).toPrecision(15)}`)
  const model = `Minimize\n obj: ${objective.join(' ')}\nSubject To\n${constraints.join('\n')}\nEnd\n`

  const solution = lp(model)
  if (solution.Status !== 'Optimal') return { ok: false, error: `No solution found (${solution.Status}).` }
  const value = (v: string) => Math.max(0, (solution.Columns[v] as { Primal?: number } | undefined)?.Primal ?? 0)

  // Read the answer back.
  const scale = (amounts: Amount[], n: number) => amounts.map((a) => ({ ...a, rate: a.rate * n }))
  const results: ProcessResult[] = []
  const net = new Map<string, number>()
  const rawRates = new Map<string, number>()
  const machineCounts: Record<string, number> = {}
  let power = 0
  list.forEach((p, i) => {
    const n = value(`x${i}`)
    if (n < EPSILON) return
    const inputs = scale(p.inputs, n)
    const outputs = scale(p.outputs, n)
    for (const o of outputs) net.set(itemKey(o), (net.get(itemKey(o)) ?? 0) + o.rate)
    for (const input of inputs) net.set(itemKey(input), (net.get(itemKey(input)) ?? 0) - input.rate)
    if (p.kind !== 'recipe') for (const o of outputs) rawRates.set(itemKey(o), (rawRates.get(itemKey(o)) ?? 0) + o.rate)
    machineCounts[p.machine.id] = (machineCounts[p.machine.id] ?? 0) + n
    power += p.power * n
    results.push({
      key: p.key,
      kind: p.kind,
      id: p.id,
      machine: p.machine.id,
      machines: n,
      power: p.power * n,
      inputs,
      outputs,
      speed: p.speed,
      productivity: p.productivity,
      consumption: p.consumption,
    })
  })
  rawNeeded.forEach((key, i) => {
    const n = value(`s${i}`)
    if (n < EPSILON) return
    rawRates.set(key, (rawRates.get(key) ?? 0) + n)
    net.set(key, (net.get(key) ?? 0) + n)
  })

  const toAmount = ([key, rate]: [string, number]): Amount => {
    const [kind, ...id] = key.split('/')
    return { kind: kind as Kind, id: id.join('/'), rate }
  }
  const surplus = [...net]
    .map(([key, rate]) => [key, rate - (demand.get(key) ?? 0)] as [string, number])
    .filter(([, rate]) => rate > 1e-6)
    .map(toAmount)
  return {
    ok: true,
    result: {
      processes: results,
      raw: [...rawRates].filter(([, rate]) => rate > EPSILON).map(toAmount),
      surplus,
      power,
      machines: machineCounts,
      warnings: [...new Set(warnings)],
    },
  }
}
