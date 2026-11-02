import { lazy, Suspense, useState } from 'react'
import { GameProvider, useLoadGame } from '../db/GameProvider.tsx'
import { Planner, PlannerSkeleton } from '../planner/Planner.tsx'
import { usePersistentState } from '../settings/storage.ts'
import { Button } from '../ui/Button/Button.tsx'
import { Panel } from '../ui/Panel/Panel.tsx'
import styles from './App.module.css'

// Dev-only component gallery at #/gallery; left out of production builds.
const Gallery = import.meta.env.DEV ? lazy(() => import('../gallery/Gallery.tsx').then((m) => ({ default: m.Gallery }))) : null

export function App() {
  // The chosen game version; empty means the newest Space Age.
  const [datasetId, setDatasetId] = usePersistentState('factorio-calc:v1:dataset', () => '', (v) => (typeof v === 'string' ? v : undefined))
  const [attempt, setAttempt] = useState(0)
  const { game, loading, error } = useLoadGame(datasetId || undefined, attempt)

  if (!game) {
    return (
      <PlannerSkeleton>
        {error ? (
          <>
            <Panel role="alert">Couldn't load the game data. Check your connection and try again.</Panel>
            <p className={styles.detail}>{error}</p>
            <Button variant="confirm" className={styles.retry} onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </>
        ) : (
          <Panel>Loading game data…</Panel>
        )}
      </PlannerSkeleton>
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
