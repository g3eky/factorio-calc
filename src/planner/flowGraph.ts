// The production chain as a graph for the crafting tree: a node per production row, raw resource
// and import, and an edge per item from each node that makes it to each row that uses it.

import type { Amount, ProcessResult, SolveResult } from '../calculator/types.ts'

export type FlowNode =
  | { id: string; kind: 'process'; process: ProcessResult }
  | { id: string; kind: 'raw' | 'import'; amount: Amount }

export interface FlowEdge {
  id: string
  from: string
  to: string
  // The item, at the rate that goes along this edge.
  item: Amount
}

const itemKey = (a: Amount) => `${a.kind}/${a.id}@${a.quality ?? ''}`
const EPSILON = 1e-9

// When several nodes make an item and several rows use it, each edge carries a share in
// proportion: maker's output × user's input ÷ everything made.
export function flowGraph(result: SolveResult): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = [
    ...result.processes.map((process) => ({ id: process.key, kind: 'process' as const, process })),
    ...result.raw.map((amount) => ({ id: `raw:${itemKey(amount)}`, kind: 'raw' as const, amount })),
    ...result.imports.map((amount) => ({ id: `import:${itemKey(amount)}`, kind: 'import' as const, amount })),
  ]
  const makers = new Map<string, { node: string; rate: number }[]>()
  const add = (a: Amount, node: string) => {
    if (a.rate <= EPSILON) return
    const key = itemKey(a)
    if (!makers.has(key)) makers.set(key, [])
    makers.get(key)!.push({ node, rate: a.rate })
  }
  for (const node of nodes) {
    if (node.kind === 'process') node.process.outputs.forEach((o) => add(o, node.id))
    else add(node.amount, node.id)
  }
  const edges: FlowEdge[] = []
  for (const user of result.processes) {
    for (const input of user.inputs) {
      const from = makers.get(itemKey(input)) ?? []
      const made = from.reduce((sum, m) => sum + m.rate, 0)
      for (const maker of from) {
        const rate = (maker.rate * input.rate) / made
        if (rate > EPSILON && maker.node !== user.key) edges.push({ id: `${maker.node}>${user.key}>${itemKey(input)}`, from: maker.node, to: user.key, item: { ...input, rate } })
      }
    }
  }
  return { nodes, edges }
}
