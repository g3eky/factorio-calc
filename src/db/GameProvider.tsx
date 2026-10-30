// Loads a dataset once and shares it, with lookups by id, through React context.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadGameData, loadIcons, type IconAtlas } from './gameData.ts'
import { dbUrl, loadManifest, openDatabase, type Manifest } from './database.ts'
import type { Fluid, GameData, Item, Machine, Recipe } from './types.ts'

export interface Game {
  dataset: Manifest['datasets'][number]
  // Every dataset the site has, for the version select.
  datasets: Manifest['datasets']
  data: GameData
  icons?: IconAtlas & { url: string }
  items: Map<string, Item>
  fluids: Map<string, Fluid>
  recipes: Map<string, Recipe>
  machines: Map<string, Machine>
}

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]))

export function createGame(dataset: Game['dataset'], data: GameData, icons?: IconAtlas, datasets: Game['datasets'] = [dataset]): Game {
  return {
    dataset,
    datasets,
    data,
    icons: icons && dataset.icons ? { ...icons, url: dbUrl(dataset.icons) } : undefined,
    items: byId(data.items),
    fluids: byId(data.fluids),
    recipes: byId(data.recipes),
    machines: byId(data.machines),
  }
}

// The newest Space Age dataset, else the newest of any.
export function defaultDataset(datasets: Manifest['datasets']): Manifest['datasets'][number] | undefined {
  const newest = (list: Manifest['datasets']) => [...list].sort((a, b) => b.version.localeCompare(a.version, 'en', { numeric: true }))[0]
  return newest(datasets.filter((d) => d.id.startsWith('space-age-'))) ?? newest(datasets)
}

// Datasets stay in memory once loaded, so switching back is instant.
const loaded = new Map<string, Promise<Game>>()
let manifest: Promise<Manifest> | undefined

export async function loadGame(datasetId?: string): Promise<Game> {
  manifest ??= loadManifest()
  const { datasets } = await manifest
  const dataset = datasets.find((d) => d.id === datasetId) ?? defaultDataset(datasets)
  if (!dataset) throw new Error('No datasets in the manifest')
  if (!loaded.has(dataset.id)) {
    const game = openDatabase(dataset.file).then((db) => {
      try {
        return createGame(dataset, loadGameData(db), loadIcons(db), datasets)
      } finally {
        db.close()
      }
    })
    game.catch(() => loaded.delete(dataset.id))
    loaded.set(dataset.id, game)
  }
  return loaded.get(dataset.id)!
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

export interface LoadState {
  // The game on screen: while another dataset loads, the previous one stays.
  game?: Game
  loading: boolean
  error?: string
}

export function useLoadGame(datasetId?: string): LoadState {
  const [state, setState] = useState<LoadState>({ loading: true })
  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: undefined }))
    loadGame(datasetId).then(
      (game) => !cancelled && setState({ game, loading: false }),
      (error) => !cancelled && setState((s) => ({ ...s, loading: false, error: String(error) })),
    )
    return () => {
      cancelled = true
    }
  }, [datasetId])
  return state
}
