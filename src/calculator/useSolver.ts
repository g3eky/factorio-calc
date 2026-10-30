// Solves in a Web Worker and keeps the last answer on screen while a new one is worked out.

import { useEffect, useRef, useState } from 'react'
import type { GameData } from '../db/types.ts'
import type { SolveRequest, SolveResponse } from './types.ts'
import type { FromWorker, ToWorker } from './worker.ts'

export interface SolverState {
  response?: SolveResponse
  solving: boolean
}

export function useSolver(data: GameData, request: SolveRequest | undefined): SolverState {
  const [state, setState] = useState<SolverState>({ solving: false })
  const worker = useRef<Worker>(undefined)
  const seq = useRef(0)

  useEffect(() => {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    w.postMessage({ type: 'init', data } satisfies ToWorker)
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      if (e.data.seq === seq.current) setState({ response: e.data.response, solving: false })
    }
    worker.current = w
    return () => w.terminate()
  }, [data])

  useEffect(() => {
    if (!request || !worker.current) return
    const s = ++seq.current
    setState((current) => ({ ...current, solving: true }))
    worker.current.postMessage({ type: 'solve', seq: s, request } satisfies ToWorker)
  }, [request, data])

  return state
}
