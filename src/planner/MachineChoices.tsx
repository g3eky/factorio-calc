import { useMemo } from 'react'
import { defaultMachines, onSurface } from '../calculator/processes.ts'
import { useGame } from '../db/GameProvider.tsx'
import type { Preferences } from '../settings/preferences.ts'
import { Slot } from '../ui/Slot/Slot.tsx'
import { cx } from '../ui/cx.ts'
import styles from './MachineChoices.module.css'

// "crafting-with-fluid" -> "Crafting with fluid"
export const categoryLabel = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ')

interface Props {
  prefs: Preferences
  setPrefs: (change: (prefs: Preferences) => Preferences) => void
  // Only machines that work on this planet; all machines without one.
  planet?: string
  // One line of groups that wraps, for the main screen; a row per category otherwise.
  compact?: boolean
}

// The default machine for each crafting or mining category with more than one choice: click to pick.
export function MachineChoices({ prefs, setPrefs, planet, compact }: Props) {
  const game = useGame()
  const place = game.data.planets.find((p) => p.id === planet)
  const defaults = useMemo(() => defaultMachines(game.data, place), [game, place])
  const categories = useMemo(() => {
    const used = new Set([...game.data.recipes.flatMap((r) => r.categories), ...game.data.resources.map((r) => r.category)])
    return [...used]
      .sort()
      .map((c) => ({ id: c, machines: game.data.machines.filter((m) => m.categories.includes(c) && onSurface(game.data, place, m.surface_conditions)) }))
      .filter((c) => c.machines.length > 1)
  }, [game, place])

  return (
    <div className={cx(styles.choices, compact && styles.compact)}>
      {categories.map((c) => {
        const current = prefs.machines[c.id] && c.machines.some((m) => m.id === prefs.machines[c.id]) ? prefs.machines[c.id] : defaults[c.id]
        return (
          <div key={c.id} className={styles.category}>
            <span className={styles.label}>{categoryLabel(c.id)}</span>
            <div className={styles.slots}>
              {c.machines.map((m) => (
                <Slot
                  key={m.id}
                  kind="machine"
                  id={m.id}
                  title={m.name}
                  details={`Speed ${m.speed}${m.surface_conditions ? '. Only on some planets.' : ''}`}
                  aria-label={`${m.name} for ${categoryLabel(c.id)}`}
                  selected={m.id === current}
                  onClick={() => setPrefs((p) => ({ ...p, machines: { ...p.machines, [c.id]: m.id } }))}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
