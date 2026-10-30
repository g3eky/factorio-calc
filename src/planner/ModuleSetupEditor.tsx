import { fits } from '../calculator/processes.ts'
import type { ModuleSetup } from '../calculator/types.ts'
import { useGame } from '../db/GameProvider.tsx'
import type { EffectName, Machine } from '../db/types.ts'
import { Button } from '../ui/Button/Button.tsx'
import { NumberInput } from '../ui/Input/Input.tsx'
import { Slot } from '../ui/Slot/Slot.tsx'
import styles from './ModuleSetupEditor.module.css'

interface Props {
  machine: Machine
  // Effects allowed by both the machine and the recipe.
  allowed: EffectName[]
  setup: ModuleSetup
  onChange: (setup: ModuleSetup) => void
}

// Modules in a machine (all slots one type) and beacons around it (all holding one type).
export function ModuleSetupEditor({ machine, allowed, setup, onChange }: Props) {
  const game = useGame()
  const beacon = game.data.beacons[0]
  const placed = setup.beacons[0]
  const options = game.data.modules.filter((m) => fits(m.effects, allowed))
  const beaconOptions = beacon ? options.filter((m) => fits(m.effects, beacon.allowed_effects)) : []
  const setBeacons = (count: number, module: string | undefined) =>
    onChange({ ...setup, beacons: beacon && count > 0 && module ? [{ id: beacon.id, count, modules: Array(beacon.module_slots).fill(module) }] : [] })

  return (
    <div className={styles.editor}>
      <span>Fill {machine.module_slots} slots with:</span>
      <div className={styles.choices}>
        <Button square aria-label={`No modules in ${machine.name}`} selected={!setup.modules.length} onClick={() => onChange({ ...setup, modules: [] })}>
          ∅
        </Button>
        {options.map((m) => (
          <Slot
            key={m.id}
            kind="item"
            id={m.id}
            title={m.name}
            aria-label={`${m.name} in ${machine.name}`}
            selected={setup.modules[0] === m.id}
            onClick={() => onChange({ ...setup, modules: Array(machine.module_slots).fill(m.id) })}
          />
        ))}
      </div>
      {beacon && beaconOptions.length > 0 && (
        <>
          <span className={styles.beacons}>
            Beacons
            <NumberInput
              value={placed?.count ?? 0}
              min={0}
              max={24}
              onChange={(n) => setBeacons(n, placed?.modules[0] ?? beaconOptions[0].id)}
              aria-label={`Beacons around ${machine.name}`}
            />
            each with:
          </span>
          <div className={styles.choices}>
            {beaconOptions.map((m) => (
              <Slot
                key={m.id}
                kind="item"
                id={m.id}
                title={m.name}
                aria-label={`Beacons with ${m.name}`}
                selected={placed?.modules[0] === m.id}
                onClick={() => setBeacons(Math.max(placed?.count ?? 0, 1), m.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
