import { useState } from 'react'
import { useGame } from '../db/GameProvider.tsx'
import { Button } from '../ui/Button/Button.tsx'
import { NumberInput } from '../ui/Input/Input.tsx'
import { ItemPicker, type Pick } from '../ui/ItemPicker/ItemPicker.tsx'
import { Panel } from '../ui/Panel/Panel.tsx'
import { Popover } from '../ui/Popover/Popover.tsx'
import { ScrollPane } from '../ui/ScrollPane/ScrollPane.tsx'
import { Select } from '../ui/Select/Select.tsx'
import { Slot } from '../ui/Slot/Slot.tsx'
import { Window } from '../ui/Window/Window.tsx'
import type { Update } from './Planner.tsx'
import { knownTargets, recipesFor, type Calculation, type TargetUnit } from './state.ts'
import styles from './Targets.module.css'

const UNITS: { value: TargetUnit; label: string }[] = [
  { value: 's', label: '/s' },
  { value: 'min', label: '/min' },
  { value: 'h', label: '/h' },
  { value: 'belts', label: 'belts' },
  { value: 'machines', label: 'machines' },
]

// What to make, and how much.
export function Targets({ calc, update }: { calc: Calculation; update: Update }) {
  const game = useGame()
  // Picker open for adding (index -1) or changing a target, next to the clicked button.
  const [picking, setPicking] = useState<{ index: number; anchor: HTMLElement }>()
  const targets = knownTargets(game, calc.targets)
  const name = (t: Pick) => (t.kind === 'fluid' ? game.fluids : game.items).get(t.id)?.name ?? t.id
  // Only offer things the calculator can make.
  const makeable = (p: Pick) => recipesFor(game, p.kind, p.id).length > 0

  const pick = (p: Pick) => {
    const index = picking!.index
    update((c) => ({
      ...c,
      targets:
        index < 0
          ? [...c.targets, { kind: p.kind, id: p.id, amount: 60, unit: c.unit }]
          : c.targets.map((t, i) => (i === index ? { ...t, kind: p.kind, id: p.id } : t)),
    }))
    setPicking(undefined)
  }
  const change = (index: number, patch: Partial<Calculation['targets'][number]>) =>
    update((c) => ({ ...c, targets: c.targets.map((t, i) => (i === index ? { ...t, ...patch } : t)) }))

  return (
    <Window title="Make" className={styles.targets}>
      <ScrollPane className={styles.list}>
        {targets.length === 0 && <p className={styles.hint}>Nothing yet. Add an item to make.</p>}
        {targets.map((t, i) => (
          <Panel key={`${t.kind}/${t.id}/${i}`} className={styles.target}>
            <Slot kind={t.kind} id={t.id} title={name(t)} aria-label={`Change ${name(t)}`} onClick={(e) => setPicking({ index: i, anchor: e.currentTarget })} />
            <div className={styles.fields}>
              <span className={styles.name}>{name(t)}</span>
              <span className={styles.amount}>
                <NumberInput value={t.amount} min={0} onChange={(amount) => change(i, { amount })} aria-label={`Amount of ${name(t)}`} />
                <Select label={`Unit for ${name(t)}`} value={t.unit} options={UNITS} onChange={(unit) => change(i, { unit })} className={styles.unit} />
              </span>
            </div>
            <Button square variant="danger" aria-label={`Remove ${name(t)}`} onClick={() => update((c) => ({ ...c, targets: c.targets.filter((_, j) => j !== i) }))}>
              ✕
            </Button>
          </Panel>
        ))}
      </ScrollPane>
      <Button variant="confirm" onClick={(e) => setPicking({ index: -1, anchor: e.currentTarget })}>
        Add item
      </Button>
      {picking && (
        <Popover anchor={picking.anchor} title={picking.index < 0 ? 'Add item' : 'Change item'} onClose={() => setPicking(undefined)}>
          <ItemPicker onPick={pick} filter={makeable} selected={picking.index >= 0 ? targets[picking.index] : undefined} />
        </Popover>
      )}
    </Window>
  )
}
