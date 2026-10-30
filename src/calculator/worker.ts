// Runs the solver off the main thread. Solving blocks this worker, so requests that arrive
// meanwhile queue up; only the newest is solved and the rest are dropped.

import highsLoader from 'highs'
import wasmUrl from 'highs/runtime?url'
import type { GameData } from '../db/types.ts'
import { solve } from './solve.ts'
import type { SolveRequest, SolveResponse } from './types.ts'

export type ToWorker = { type: 'init'; data: GameData } | { type: 'solve'; seq: number; request: SolveRequest }
export type FromWorker = { seq: number; response: SolveResponse }

const scope = self as unknown as { onmessage: (e: MessageEvent<ToWorker>) => void; postMessage: (message: FromWorker) => void }
const highs = highsLoader({ locateFile: () => wasmUrl })
let data: GameData | undefined
let latest: { seq: number; request: SolveRequest } | undefined

async function run() {
  const job = latest
  latest = undefined
  if (!job || !data) return
  const solver = await highs
  // A newer request arrived while HiGHS was loading; that one will run instead.
  if (latest) return
  let response: SolveResponse
  try {
    response = solve(data, job.request, (model) => solver.solve(model))
  } catch (error) {
    response = { ok: false, error: String(error) }
  }
  scope.postMessage({ seq: job.seq, response })
}

scope.onmessage = (e) => {
  if (e.data.type === 'init') {
    data = e.data.data
    return
  }
  const first = !latest
  latest = { seq: e.data.seq, request: e.data.request }
  // Let every queued message arrive before solving, so only the newest is solved.
  if (first) setTimeout(run, 0)
}
