// Loads a dataset once and shares it, with lookups by id, through React context.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadGameData, loadIcons, type IconAtlas } from './gameData.ts'
import { dbUrl, loadManifest, openDatabase, type Manifest } from './database.ts'
import type { Fluid, GameData, Item, Machine, Recipe } from './types.ts'

export interface Game {
  dataset: Manifest['datasets'][number]
  data: GameData
  icons?: IconAtlas & { url: string }
  items: Map<string, Item>
  fluids: Map<string, Fluid>
  recipes: Map<string, Recipe>
  machines: Map<string, Machine>
}

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]))

export function createGame(dataset: Game['dataset'], data: GameData, icons?: IconAtlas): Game {
  return {
    dataset,
    data,
    icons: icons && dataset.icons ? { ...icons, url: dbUrl(dataset.icons) } : undefined,
    items: byId(data.items),
    fluids: byId(data.fluids),
    recipes: byId(data.recipes),
    machines: byId(data.machines),
  }
}

export async function loadGame(datasetId?: string): Promise<Game> {
  const manifest = await loadManifest()
  const dataset = manifest.datasets.find((d) => d.id === datasetId) ?? manifest.datasets[0]
  if (!dataset) throw new Error('No datasets in the manifest')
  const db = await openDatabase(dataset.file)
  try {
    return createGame(dataset, loadGameData(db), loadIcons(db))
  } finally {
    db.close()
  }
}

const GameContext = createContext<Game | null>(null)

export function GameProvider({ game, children }: { game: Game; children: ReactNode }) {
  return <GameContext.Provider value={game}>{children}</GameContext.Provider>
}

export function useGame(): Game {
  const game = useContext(GameContext)
  if (!game) throw new Error('useGame needs a GameProvider')
  return game
}

export type LoadState = { status: 'loading' } | { status: 'ready'; game: Game } | { status: 'error'; error: string }

export function useLoadGame(datasetId?: string): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    loadGame(datasetId).then(
      (game) => !cancelled && setState({ status: 'ready', game }),
      (error) => !cancelled && setState({ status: 'error', error: String(error) }),
    )
    return () => {
      cancelled = true
    }
  }, [datasetId])
  return state
}
