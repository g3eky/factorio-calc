import { memo, useMemo, useState, type ReactNode } from 'react'
import { onSurface } from '../calculator/processes.ts'
import type { Amount, ModuleSetup, ProcessResult, ProcessSettings, SolveResult } from '../calculator/types.ts'
import { useGame, type Game } from '../db/GameProvider.tsx'
import type { EffectName } from '../db/types.ts'
import type { Preferences } from '../settings/preferences.ts'
import { Button } from '../ui/Button/Button.tsx'
import { Icon } from '../ui/Icon/Icon.tsx'
import { Popover } from '../ui/Popover/Popover.tsx'
import { ScrollPane } from '../ui/ScrollPane/ScrollPane.tsx'
import { Slot } from '../ui/Slot/Slot.tsx'
import { cx } from '../ui/cx.ts'
import { Window } from '../ui/Window/Window.tsx'
import { long, power, short, UNIT_LABELS, UNIT_SECONDS } from './format.ts'
import { ModuleSetupEditor } from './ModuleSetupEditor.tsx'
import { QualitySelect } from './QualitySelect.tsx'
import type { Update } from './Planner.tsx'
import { recipesFor, type Calculation } from './state.ts'
import styles from './Results.module.css'

// Editors remember the process by key, so they show the newest result after each re-solve.
type Editing = { type: 'machine' | 'modules'; key: string; anchor: HTMLElement } | { type: 'recipe'; item: Amount; anchor: HTMLElement }

// Shows a value with a brief highlight whenever it changes.
export function Changed({ value, children }: { value: string; children?: ReactNode }) {
  return (
    <span key={value} className={styles.changed}>
      {children ?? value}
    </span>
  )
}

// Processes in production order: targets first, then what feeds them.
function inOrder(result: SolveResult, calc: Calculation): ProcessResult[] {
  const itemDepth = new Map(calc.targets.map((t) => [`${t.kind}/${t.id}`, 0]))
  const depth = new Map<string, number>()
  for (let pass = 0; pass < result.processes.length + 1; pass++) {
    let changed = false
    for (const p of result.processes) {
      const d = Math.min(...p.outputs.map((o) => itemDepth.get(`${o.kind}/${o.id}`) ?? Infinity))
      if (d === Infinity || depth.get(p.key) === d) continue
      depth.set(p.key, d)
      changed = true
      for (const i of p.inputs) {
        const key = `${i.kind}/${i.id}`
        if ((itemDepth.get(key) ?? Infinity) > d + 1) itemDepth.set(key, d + 1)
      }
    }
    if (!changed) break
  }
  return [...result.processes].sort((a, b) => (depth.get(a.key) ?? 99) - (depth.get(b.key) ?? 99) || a.key.localeCompare(b.key))
}

export function processName(game: Game, p: ProcessResult): string {
  if (p.kind === 'recipe') return game.recipes.get(p.id)?.name ?? p.id
  if (p.kind === 'resource') return `Mining ${(game.data.resources.find((r) => r.id === p.id)?.name ?? p.id).toLowerCase()}`
  return `Pumping ${(game.fluids.get(p.id)?.name ?? p.id).toLowerCase()}`
}

export const amountName = (game: Game, a: { kind: string; id: string; quality?: string }) => {
  const name = (a.kind === 'fluid' ? game.fluids : game.items).get(a.id)?.name ?? a.id
  const quality = a.quality && game.data.qualities.find((q) => q.id === a.quality)
  return quality ? `${quality.name} ${name.toLowerCase()}` : name
}

interface Props {
  result: SolveResult
  calc: Calculation
  prefs: Preferences
  update: Update
}

const sameTargets = (a: Calculation['targets'], b: Calculation['targets']) =>
  a.length === b.length && a.every((t, i) => t.kind === b[i].kind && t.id === b[i].id)

// The production chain: one row per process. Typing a target amount doesn't re-render it;
// only the new result does.
export const Results = memo(
  ResultsTable,
  (a: Props, b: Props) =>
    a.result === b.result &&
    a.update === b.update &&
    a.prefs === b.prefs &&
    a.calc.unit === b.calc.unit &&
    a.calc.overrides === b.calc.overrides &&
    a.calc.recipes === b.calc.recipes &&
    sameTargets(a.calc.targets, b.calc.targets),
)

function ResultsTable({ result, calc, prefs, update }: Props) {
  const game = useGame()
  const rows = useMemo(() => inOrder(result, calc), [result, calc])
  const [editing, setEditing] = useState<Editing>()
  const unit = UNIT_LABELS[calc.unit]
  const edited = editing && editing.type !== 'recipe' ? result.processes.find((p) => p.key === editing.key) : undefined

  return (
    <Window title="Production" className={styles.results}>
      <ScrollPane className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Recipe</th>
              <th>Machines</th>
              <th>Modules</th>
              <th>Inputs {unit}</th>
              <th>Outputs {unit}</th>
              <th>Power</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <Row
                key={p.key}
                process={p}
                override={calc.overrides[p.key.split('@')[0]]}
                setup={calc.overrides[p.key.split('@')[0]]?.setup ?? prefs.setups[p.machine]}
                unit={calc.unit}
                onEdit={setEditing}
              />
            ))}
          </tbody>
        </table>
      </ScrollPane>
      {editing?.type === 'machine' && edited && (
        <Popover anchor={editing.anchor} title="Machine" onClose={() => setEditing(undefined)}>
          <MachineChooser process={edited} calc={calc} update={update} done={() => setEditing(undefined)} />
        </Popover>
      )}
      {editing?.type === 'modules' && edited && (
        <Popover anchor={editing.anchor} title={`Modules for ${processName(game, edited)}`} onClose={() => setEditing(undefined)}>
          <ModuleEditor process={edited} calc={calc} prefs={prefs} update={update} />
        </Popover>
      )}
      {editing?.type === 'recipe' && (
        <Popover anchor={editing.anchor} title={`Make ${amountName(game, editing.item)} with`} onClose={() => setEditing(undefined)}>
          <RecipeChooser item={editing.item} calc={calc} update={update} done={() => setEditing(undefined)} />
        </Popover>
      )}
    </Window>
  )
}


interface RowProps {
  process: ProcessResult
  // This calculation's own settings for the process, if any.
  override: ProcessSettings | undefined
  // Modules and beacons in effect: the override's, else the preferences'.
  setup: ModuleSetup | undefined
  unit: Calculation['unit']
  onEdit: (editing: Editing) => void
}

// One process. Re-renders only when its numbers or settings change, not on every new result.
const Row = memo(
  function Row({ process: p, override, setup, unit: rateUnit, onEdit }: RowProps) {
    const game = useGame()
    const scale = UNIT_SECONDS[rateUnit]
    const unit = UNIT_LABELS[rateUnit]
    const machine = game.machines.get(p.machine)
    const name = processName(game, p)
    const editable = p.kind !== 'pump'

    const amounts = (list: Amount[]) =>
      list.map((a) => {
        const choices = recipesFor(game, a.kind, a.id)
        const label = `${amountName(game, a)}: ${long(a.rate * scale)}${unit}`
        return (
          <Slot
            key={`${a.kind}/${a.id}@${a.quality ?? ''}`}
            kind={a.kind}
            id={a.id}
            quality={a.quality}
            amount={short(a.rate * scale)}
            title={amountName(game, a)}
            details={`${long(a.rate * scale)}${unit}${choices.length > 1 ? '. Click to choose its recipe.' : ''}`}
            aria-label={label}
            className={choices.length > 1 ? undefined : styles.plain}
            onClick={choices.length > 1 ? (e) => onEdit({ type: 'recipe', item: a, anchor: e.currentTarget }) : undefined}
          />
        )
      })

    return (
      <tr className={styles.row}>
        <td>
          <span className={styles.recipe}>
            <Icon kind={p.kind === 'recipe' ? 'recipe' : p.outputs[0].kind} id={p.kind === 'recipe' ? p.id : p.outputs[0].id} />
            {name}
            {p.quality && <span className={styles.quality}>({game.data.qualities.find((q) => q.id === p.quality)?.name ?? p.quality})</span>}
          </span>
        </td>
        <td>
          <span className={cx(styles.machine, override?.machine && styles.custom)} title={override?.machine ? 'Set for this calculation' : undefined}>
            <Slot
              kind="machine"
              id={p.machine}
              quality={p.machineQuality}
              amount={Math.ceil(p.machines - 1e-9)}
              title={machine?.name}
              details={editable ? 'Click to change the machine.' : undefined}
              aria-label={`${machine?.name}: ${Math.ceil(p.machines - 1e-9)} (${long(p.machines)} running)`}
              className={editable ? undefined : styles.plain}
              onClick={editable ? (e) => onEdit({ type: 'machine', key: p.key, anchor: e.currentTarget }) : undefined}
            />
            <Changed value={`× ${long(p.machines)}`} />
          </span>
        </td>
        <td>
          {machine && machine.module_slots > 0 ? (
            <button
              type="button"
              className={cx(styles.modules, override?.setup && styles.custom)}
              title={override?.setup ? 'Set for this calculation' : undefined}
              aria-label={`Modules for ${name}: ${
                setup?.modules.length ? `${setup.modules.slice(0, machine.module_slots).length} ${game.data.modules.find((m) => m.id === setup.modules[0])?.name ?? ''}` : 'none'
              }${setup?.beacons.map((b) => `, +${b.count} beacons`).join('') ?? ''}`} onClick={(e) => onEdit({ type: 'modules', key: p.key, anchor: e.currentTarget })}>
              {setup?.modules.length ? (
                setup.modules.slice(0, machine.module_slots).map((m, i) => <Icon key={i} kind="item" id={m} size={20} />)
              ) : (
                <span className={styles.none}>none</span>
              )}
              {setup?.beacons.map((b) => (
                <span key={b.id} className={styles.beacon}>
                  +{b.count}
                  <Icon kind="item" id={b.id} size={20} />
                </span>
              ))}
            </button>
          ) : (
            <span className={styles.none}>–</span>
          )}
        </td>
        <td>
          <span className={styles.amounts}>{amounts(p.inputs)}</span>
        </td>
        <td>
          <span className={styles.amounts}>{amounts(p.outputs)}</span>
        </td>
        <td className={styles.power}>{p.power > 0 ? <Changed value={power(p.power)} /> : '–'}</td>
      </tr>
    )
  },
  (a, b) =>
    a.override === b.override && a.setup === b.setup && a.unit === b.unit && a.onEdit === b.onEdit && JSON.stringify(a.process) === JSON.stringify(b.process),
)

function MachineChooser({ process, calc, update, done }: { process: ProcessResult; calc: Calculation; update: Update; done: () => void }) {
  const game = useGame()
  const categories = process.kind === 'recipe' ? game.recipes.get(process.id)!.categories : [game.data.resources.find((r) => r.id === process.id)!.category]
  const planet = game.data.planets.find((p) => p.id === calc.planet)
  const machines = game.data.machines.filter((m) => m.categories.some((c) => categories.includes(c)) && onSurface(game.data, planet, m.surface_conditions))
  // Settings belong to the recipe, whatever quality it's running at in this row.
  const key = process.key.split('@')[0]
  const choose = (machine: string | undefined) => {
    update((c) => ({ ...c, overrides: { ...c.overrides, [key]: { ...c.overrides[key], machine } } }))
    done()
  }
  return (
    <>
      <div className={styles.choices}>
        {machines.map((m) => (
          <Slot key={m.id} kind="machine" id={m.id} title={m.name} details={`Speed ${m.speed}`} aria-label={m.name} selected={m.id === process.machine} onClick={() => choose(m.id)} />
        ))}
      </div>
      <QualitySelect
        label="Machine quality"
        value={calc.overrides[key]?.quality}
        onChange={(quality) => update((c) => ({ ...c, overrides: { ...c.overrides, [key]: { ...c.overrides[key], quality } } }))}
      />
      {calc.overrides[key]?.machine && <Button onClick={() => choose(undefined)}>Use the default</Button>}
    </>
  )
}

function ModuleEditor({ process, calc, prefs, update }: { process: ProcessResult; calc: Calculation; prefs: Preferences; update: Update }) {
  const game = useGame()
  const machine = game.machines.get(process.machine)!
  const recipe = process.kind === 'recipe' ? game.recipes.get(process.id) : undefined
  const allowed = machine.allowed_effects.filter((e) => !recipe || recipe.allowed_effects.includes(e)) as EffectName[]
  const key = process.key.split('@')[0]
  const override = calc.overrides[key]?.setup
  const save = (setup: ModuleSetup | undefined) => update((c) => ({ ...c, overrides: { ...c.overrides, [key]: { ...c.overrides[key], setup } } }))
  return (
    <>
      <ModuleSetupEditor machine={machine} allowed={allowed} setup={override ?? prefs.setups[machine.id] ?? { modules: [], beacons: [] }} onChange={save} />
      <span className={styles.effects}>
        Speed {pct(process.speed)}, productivity {pct(process.productivity)}, power {pct(process.consumption)}
        {process.qualityEffect > 0 && `, quality ${pct(process.qualityEffect)}`}
      </span>
      {override && <Button onClick={() => save(undefined)}>Use the default from settings</Button>}
    </>
  )
}

const pct = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n * 1000) / 10}%`

function RecipeChooser({ item, calc, update, done }: { item: Amount; calc: Calculation; update: Update; done: () => void }) {
  const game = useGame()
  const key = `${item.kind}/${item.id}`
  const choose = (recipe: string | undefined) => {
    update((c) => {
      const recipes = { ...c.recipes }
      if (recipe) recipes[key] = recipe
      else delete recipes[key]
      return { ...c, recipes }
    })
    done()
  }
  return (
    <div className={styles.recipeList}>
      <Button selected={!calc.recipes[key]} onClick={() => choose(undefined)}>
        Cheapest
      </Button>
      {recipesFor(game, item.kind, item.id).map((r) => (
        <Button key={r.id} selected={calc.recipes[key] === r.id} className={styles.recipeChoice} onClick={() => choose(r.id)}>
          <Icon kind="recipe" id={r.id} size={24} />
          <span className={styles.recipeName}>{r.name}</span>
          <span className={styles.ingredients}>
            {r.ingredients.map((i) => (
              <span key={i.id}>
                <Icon kind={i.type} id={i.id} size={20} />
                {short(i.amount)}
              </span>
            ))}
          </span>
        </Button>
      ))}
    </div>
  )
}
