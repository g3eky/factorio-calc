import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SolveResult } from '../calculator/types.ts'
import { useSolver } from '../calculator/useSolver.ts'
import { useGame } from '../db/GameProvider.tsx'
import { defaultPreferences, migrate } from '../settings/preferences.ts'
import { usePersistentState } from '../settings/storage.ts'
import { Button } from '../ui/Button/Button.tsx'
import { Icon } from '../ui/Icon/Icon.tsx'
import { Panel } from '../ui/Panel/Panel.tsx'
import { Select } from '../ui/Select/Select.tsx'
import { UNIT_LABELS, type RateUnit } from './format.ts'
import { Results } from './Results.tsx'
import { Settings } from './Settings.tsx'
import { emptyCalculation, isCalculation, toRequest, type Calculation } from './state.ts'
import { Targets } from './Targets.tsx'
import { Totals } from './Totals.tsx'
import styles from './Planner.module.css'

export type Update = (change: (calc: Calculation) => Calculation) => void

// The calculator screen: targets on the left, the production chain on the right.
export function Planner({ onDataset, switching }: { onDataset: (id: string) => void; switching: boolean }) {
  const game = useGame()
  const [calc, setCalc] = usePersistentState(`factorio-calc:v1:calculation:${game.dataset.id}`, () => emptyCalculation(game), (v) =>
    isCalculation(v) ? { ...emptyCalculation(game), ...v } : undefined,
  )
  const [prefs, setPrefs] = usePersistentState(`factorio-calc:v1:preferences:${game.dataset.id}`, defaultPreferences, migrate)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const request = useMemo(() => toRequest(game, calc, prefs), [game, calc, prefs])
  const { response, solving } = useSolver(game.data, request)

  // Keep the last good result on screen while solving, and when a change has no solution.
  const [result, setResult] = useState<SolveResult>()
  useEffect(() => {
    if (response?.ok) setResult(response.result)
  }, [response])
  const error = response && !response.ok ? response.error : undefined
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  return (
    <div className={styles.planner}>
      <header className={styles.header}>
        <h1 className={styles.title}>Factorio calculator</h1>
        {game.datasets.length > 1 ? (
          <Select
            label="Game version"
            value={game.dataset.id}
            onChange={onDataset}
            options={game.datasets.map((d) => ({ value: d.id, label: `${d.name} ${d.version}` }))}
          />
        ) : (
          <span className={styles.dataset}>
            {game.dataset.name} {game.dataset.version}
          </span>
        )}
        {switching && <span className={styles.dataset}>Loading…</span>}
        <span className={styles.spacer} />
        {game.data.planets.length > 1 && (
          <label className={styles.setting}>
            Build on
            <Select
              label="Planet"
              value={calc.planet}
              onChange={(planet) => setCalc((c) => ({ ...c, planet }))}
              options={game.data.planets.map((p) => ({ value: p.id, label: <><Icon kind="planet" id={p.id} size={20} /> {p.name}</> }))}
            />
          </label>
        )}
        <label className={styles.setting}>
          Rates
          <Select
            label="Show rates"
            value={calc.unit}
            onChange={(unit: RateUnit) => setCalc((c) => ({ ...c, unit }))}
            options={(Object.keys(UNIT_LABELS) as RateUnit[]).map((u) => ({ value: u, label: `per ${{ s: 'second', min: 'minute', h: 'hour' }[u]}` }))}
          />
        </label>
        <label className={styles.setting}>
          Belt
          <Select
            label="Belt"
            value={calc.belt}
            onChange={(belt) => setCalc((c) => ({ ...c, belt }))}
            options={game.data.belts.map((b) => ({ value: b.id, label: b.name }))}
          />
        </label>
        <Button onClick={() => setSettingsOpen(true)}>Settings</Button>
      </header>
      {settingsOpen && <Settings prefs={prefs} setPrefs={setPrefs} onClose={closeSettings} />}
      <Targets calc={calc} update={setCalc} />
      <main className={styles.main}>
        {error && (
          <Panel className={styles.error} role="alert">
            {error}
            {result && ' Showing the last result that worked.'}
          </Panel>
        )}
        {calc.targets.length === 0 ? (
          <Panel className={styles.empty}>Add something to make, on the left, to see how to build it.</Panel>
        ) : (
          result && (
            <>
              <Totals result={result} calc={calc} solving={solving} />
              <Results result={result} calc={calc} prefs={prefs} update={setCalc} />
            </>
          )
        )}
      </main>
    </div>
  )
}
