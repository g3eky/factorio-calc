import { lazy, Suspense } from 'react'
import { GameProvider, useLoadGame } from '../db/GameProvider.tsx'
import { Planner } from '../planner/Planner.tsx'
import { Panel } from '../ui/Panel/Panel.tsx'
import { Window } from '../ui/Window/Window.tsx'
import styles from './App.module.css'

// Dev-only component gallery at #/gallery; left out of production builds.
const Gallery = import.meta.env.DEV ? lazy(() => import('../gallery/Gallery.tsx').then((m) => ({ default: m.Gallery }))) : null

export function App() {
  const state = useLoadGame()

  if (state.status !== 'ready') {
    return (
      <Window title="Factorio calculator" className={styles.status}>
        <Panel>{state.status === 'loading' ? 'Loading game data…' : `Failed to load game data: ${state.error}`}</Panel>
      </Window>
    )
  }

  const { game } = state
  return (
    <GameProvider game={game}>
      {Gallery && location.hash === '#/gallery' ? (
        <Suspense>
          <Gallery />
        </Suspense>
      ) : (
        <Planner />
      )}
    </GameProvider>
  )
}
