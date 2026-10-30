import { lazy, Suspense } from 'react'
import { GameProvider, useLoadGame } from '../db/GameProvider.tsx'
import { Planner } from '../planner/Planner.tsx'
import { usePersistentState } from '../settings/storage.ts'
import { Panel } from '../ui/Panel/Panel.tsx'
import { Window } from '../ui/Window/Window.tsx'
import styles from './App.module.css'

// Dev-only component gallery at #/gallery; left out of production builds.
const Gallery = import.meta.env.DEV ? lazy(() => import('../gallery/Gallery.tsx').then((m) => ({ default: m.Gallery }))) : null

export function App() {
  // The chosen game version; empty means the newest Space Age.
  const [datasetId, setDatasetId] = usePersistentState('factorio-calc:v1:dataset', () => '', (v) => (typeof v === 'string' ? v : undefined))
  const { game, loading, error } = useLoadGame(datasetId || undefined)

  if (!game) {
    return (
      <Window title="Factorio calculator" className={styles.status}>
        <Panel>{error ? `Failed to load game data: ${error}` : 'Loading game data…'}</Panel>
      </Window>
    )
  }

  return (
    <GameProvider game={game}>
      {Gallery && location.hash === '#/gallery' ? (
        <Suspense>
          <Gallery />
        </Suspense>
      ) : (
        // Keyed by dataset so each version gets its own saved calculation and settings.
        <Planner key={game.dataset.id} onDataset={setDatasetId} switching={loading} />
      )}
    </GameProvider>
  )
}
