import { join } from 'node:path'
import highsLoader from 'highs'
import { beforeAll, expect, test } from 'vitest'
import { readDataset } from '../../scripts/build-db.ts'
import { defaultDisabled, solve } from '../calculator/solve.ts'
import type { SolveResult } from '../calculator/types.ts'
import { flowGraph } from './flowGraph.ts'

let result: SolveResult

beforeAll(async () => {
  const data = await readDataset(join(process.cwd(), 'data/space-age/2.1.24'))
  const highs = await highsLoader()
  const response = solve(
    data,
    {
      targets: ['automation-science-pack', 'logistic-science-pack', 'military-science-pack'].map((id) => ({ kind: 'item' as const, id, rate: 1 })),
      machines: {},
      setups: {},
      overrides: {},
      disabled: defaultDisabled(data),
      research: {},
      fuel: 'coal',
      planet: 'nauvis',
    },
    (model) => highs.solve(model),
  )
  if (!response.ok) throw new Error(response.error)
  result = response.result
})

test('every production row, raw resource and import is a node', () => {
  const { nodes } = flowGraph(result)
  expect(nodes.filter((n) => n.kind === 'process')).toHaveLength(result.processes.length)
  expect(nodes.filter((n) => n.kind === 'raw')).toHaveLength(result.raw.length)
  expect(nodes.filter((n) => n.kind === 'import')).toHaveLength(result.imports.length)
  expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length)
})

test("the edges into each row add up to what it uses, and edges only join nodes that exist", () => {
  const { nodes, edges } = flowGraph(result)
  const ids = new Set(nodes.map((n) => n.id))
  for (const e of edges) expect(ids.has(e.from) && ids.has(e.to)).toBe(true)
  for (const p of result.processes) {
    for (const input of p.inputs) {
      const into = edges.filter((e) => e.to === p.key && e.item.kind === input.kind && e.item.id === input.id && (e.item.quality ?? '') === (input.quality ?? ''))
      expect(into.reduce((sum, e) => sum + e.item.rate, 0)).toBeCloseTo(input.rate, 9)
    }
  }
})

test('an item made in one row and used in several splits by what each uses', () => {
  const { edges } = flowGraph(result)
  const gears = edges.filter((e) => e.item.id === 'iron-gear-wheel')
  expect(new Set(gears.map((e) => e.to)).size).toBeGreaterThan(1)
  for (const e of gears) {
    const user = result.processes.find((p) => p.key === e.to)!
    expect(e.item.rate).toBeCloseTo(user.inputs.find((i) => i.id === 'iron-gear-wheel')!.rate, 9)
  }
})
