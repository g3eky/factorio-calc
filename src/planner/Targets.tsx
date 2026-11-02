import { useCallback, useMemo, useState } from 'react'
import { useGame } from '../db/GameProvider.tsx'
import { Button } from '../ui/Button/Button.tsx'
import { NumberInput, TextInput } from '../ui/Input/Input.tsx'
import { ItemPicker, type Pick } from '../ui/ItemPicker/ItemPicker.tsx'
import { Panel } from '../ui/Panel/Panel.tsx'
import { Popover } from '../ui/Popover/Popover.tsx'
import { ScrollPane } from '../ui/ScrollPane/ScrollPane.tsx'
import { Select } from '../ui/Select/Select.tsx'
import { Slot } from '../ui/Slot/Slot.tsx'
import { Tabs } from '../ui/Tabs/Tabs.tsx'
import { Window } from '../ui/Window/Window.tsx'
import { ItemInfo } from './ItemInfo.tsx'
import { QualitySelect } from './QualitySelect.tsx'
import type { Update } from './Planner.tsx'
import { usePersistentState } from '../settings/storage.ts'
import { isSavedLists, knownTargets, recipesFor, type Calculation, type SavedList, type TargetUnit } from './state.ts'
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
  // Picker open for changing a target, next to its slot.
  const [picking, setPicking] = useState<{ index: number; anchor: HTMLElement }>()
  const [tab, setTab] = useState<'items' | 'making'>('items')
  // Named build lists, per dataset since item ids differ between versions.
  const [saved, setSaved] = usePersistentState<SavedList[]>(`factorio-calc:v1:saved-lists:${game.dataset.id}`, () => [], (v) => (isSavedLists(v) ? v : undefined))
  const [saveName, setSaveName] = useState('')
  const targets = knownTargets(game, calc.targets)
  const name = (t: Pick) => (t.kind === 'fluid' ? game.fluids : game.items).get(t.id)?.name ?? t.id
  // Only offer things the calculator can make.
  const makeable = useCallback((p: Pick) => recipesFor(game, p.kind, p.id).length > 0, [game])
  const info = useCallback((p: Pick) => <ItemInfo kind={p.kind} id={p.id} />, [])
  const targetKeys = targets.map((t) => `${t.kind}/${t.id}`).join(',')
  // Changes only when what's being made changes, not when an amount is typed.
  const making = useMemo(() => targets.map((t) => ({ kind: t.kind, id: t.id })), [targetKeys])

  // Items in the panel toggle: click to make it, click again to stop. Picking from a target's
  // popover replaces that target.
  const toggle = useCallback(
    (p: Pick) =>
      update((c) => {
      const same = (t: Pick) => t.kind === p.kind && t.id === p.id
      return c.targets.some(same)
        ? { ...c, targets: c.targets.filter((t) => !same(t)) }
        : { ...c, targets: [...c.targets, { kind: p.kind, id: p.id, amount: 60, unit: c.unit }] }
      }),
    [update],
  )
  const replace = (p: Pick) => {
    const index = picking!.index
    update((c) => ({ ...c, targets: c.targets.map((t, i) => (i === index ? { ...t, kind: p.kind, id: p.id } : t)) }))
    setPicking(undefined)
  }
  // Saving under a name that's taken replaces that list.
  const save = () => {
    const list = { name: saveName.trim(), targets: calc.targets }
    setSaved((all) => (all.some((l) => l.name === list.name) ? all.map((l) => (l.name === list.name ? list : l)) : [...all, list]))
    setSaveName('')
  }
  const change = (index: number, patch: Partial<Calculation['targets'][number]>) =>
    update((c) => ({ ...c, targets: c.targets.map((t, i) => (i === index ? { ...t, ...patch } : t)) }))

  return (
    <Window title="Make" className={styles.targets}>
      <Tabs
        label="Make"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'items', label: 'Catalog' },
          { id: 'making', label: `Build list (${targets.length})` },
        ]}
      />
      {/* Both stay mounted, so switching doesn't rebuild the few hundred item slots. */}
      {/* Every item that can be made, by category; click one to make it. */}
      <div role="tabpanel" aria-label="Catalog" className={styles.panel} hidden={tab !== 'items'}>
        <ItemPicker onPick={toggle} filter={makeable} selected={making} details={info} />
      </div>
      <ScrollPane role="tabpanel" aria-label="Build list" className={styles.list} hidden={tab !== 'making'}>
        {targets.length === 0 && <p className={styles.hint}>Nothing yet. Click items in the Catalog to make them; click again to stop.</p>}
        {targets.map((t, i) => (
          <Panel key={`${t.kind}/${t.id}/${i}`} className={styles.target}>
            <Slot kind={t.kind} id={t.id} quality={t.quality} title={name(t)} aria-label={`Change ${name(t)}`} onClick={(e) => setPicking({ index: i, anchor: e.currentTarget })} />
            <div className={styles.fields}>
              <span className={styles.name}>{name(t)}</span>
              <span className={styles.amount}>
                <NumberInput value={t.amount} min={0} onChange={(amount) => change(i, { amount })} aria-label={`Amount of ${name(t)}`} />
                <Select label={`Unit for ${name(t)}`} value={t.unit} options={UNITS} onChange={(unit) => change(i, { unit })} className={styles.unit} />
              </span>
              {t.kind === 'item' && <QualitySelect label={`Quality of ${name(t)}`} value={t.quality} onChange={(quality) => change(i, { quality })} />}
            </div>
            <Button square variant="danger" aria-label={`Remove ${name(t)}`} onClick={() => update((c) => ({ ...c, targets: c.targets.filter((_, j) => j !== i) }))}>
              ✕
            </Button>
          </Panel>
        ))}
        <section className={styles.saved} aria-label="Saved lists">
          <h3 className={styles.savedHead}>Saved lists</h3>
          <form
            className={styles.saveRow}
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <TextInput placeholder="Name this list" aria-label="Name for this list" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            <Button type="submit" disabled={!saveName.trim() || targets.length === 0}>
              Save
            </Button>
          </form>
          {saved.length === 0 && <p className={styles.hint}>No saved lists yet.</p>}
          {saved.map((l, i) => (
            <div key={i} className={styles.saveRow}>
              <TextInput
                aria-label={`Rename ${l.name}`}
                value={l.name}
                onChange={(e) => setSaved((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <span className={styles.count}>{l.targets.length}</span>
              <Button title="Replace the build list with this one" onClick={() => update((c) => ({ ...c, targets: l.targets }))}>
                Load
              </Button>
              <Button square variant="danger" aria-label={`Delete ${l.name}`} onClick={() => setSaved((all) => all.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </div>
          ))}
        </section>
      </ScrollPane>
      {picking && (
        <Popover anchor={picking.anchor} title="Change item" onClose={() => setPicking(undefined)}>
          <ItemPicker onPick={replace} filter={makeable} selected={targets[picking.index]} rows={8} />
        </Popover>
      )}
    </Window>
  )
}
