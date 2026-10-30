import { memo } from 'react'
import type { Amount, SolveResult } from '../calculator/types.ts'
import { useGame } from '../db/GameProvider.tsx'
import { Panel } from '../ui/Panel/Panel.tsx'
import { Slot } from '../ui/Slot/Slot.tsx'
import { Window } from '../ui/Window/Window.tsx'
import { duration, long, power, short, UNIT_LABELS, UNIT_SECONDS } from './format.ts'
import { amountName, Changed } from './Results.tsx'
import type { Calculation } from './state.ts'
import styles from './Totals.module.css'

interface Props {
  result: SolveResult
  calc: Calculation
  solving: boolean
}

// Raw resources in, surplus out, power, and machines to build. Re-renders only when those change.
export const Totals = memo(
  TotalsPanel,
  (a: Props, b: Props) => a.result === b.result && a.solving === b.solving && a.calc.unit === b.calc.unit && a.calc.belt === b.calc.belt,
)

function TotalsPanel({ result, calc, solving }: Props) {
  const game = useGame()
  const scale = UNIT_SECONDS[calc.unit]
  const unit = UNIT_LABELS[calc.unit]
  const belt = game.data.belts.find((b) => b.id === calc.belt)
  const amounts = (list: Amount[]) =>
    list
      .slice()
      .sort((a, b) => b.rate - a.rate)
      .map((a) => (
        <Slot
          key={`${a.kind}/${a.id}@${a.quality ?? ''}`}
          kind={a.kind}
          id={a.id}
          quality={a.quality}
          amount={short(a.rate * scale)}
          title={amountName(game, a)}
          details={`${long(a.rate * scale)}${unit}${a.kind === 'item' && belt ? ` (${long(a.rate / belt.speed)} ${belt.name.toLowerCase()}s)` : ''}`}
          aria-label={`${amountName(game, a)}: ${long(a.rate * scale)}${unit}`}
        />
      ))
  const machines = Object.entries(result.machines).sort(([, a], [, b]) => b - a)
  // Items in the chain that spoil (Gleba), shortest first.
  const spoiling = [...new Set(result.processes.flatMap((p) => [...p.inputs, ...p.outputs]).filter((a) => a.kind === 'item').map((a) => a.id))]
    .map((id) => game.items.get(id))
    .filter((i) => i?.spoil)
    .sort((a, b) => a!.spoil!.time - b!.spoil!.time) as NonNullable<ReturnType<typeof game.items.get>>[]

  return (
    <Window title="Totals" actions={<span className={styles.solving} data-visible={solving}>Solving…</span>}>
      <div className={styles.totals}>
        <Panel className={styles.section}>
          <h3>Raw resources {unit}</h3>
          <div className={styles.slots}>{amounts(result.raw)}</div>
        </Panel>
        {result.imports.length > 0 && (
          <Panel className={styles.section}>
            <h3>Imports {unit}</h3>
            <div className={styles.slots}>{amounts(result.imports)}</div>
          </Panel>
        )}
        {result.surplus.length > 0 && (
          <Panel className={styles.section}>
            <h3>Surplus {unit}</h3>
            <div className={styles.slots}>{amounts(result.surplus)}</div>
          </Panel>
        )}
        <Panel className={styles.section}>
          <h3>Machines</h3>
          <div className={styles.slots}>
            {machines.map(([id, n]) => (
              <Slot key={id} kind="machine" id={id} amount={Math.ceil(n - 1e-9)} title={game.machines.get(id)?.name} details={`${long(n)} running`} aria-label={`${game.machines.get(id)?.name}: ${Math.ceil(n - 1e-9)}`} />
            ))}
          </div>
        </Panel>
        <Panel className={styles.section}>
          <h3>Power</h3>
          <span className={styles.power}>
            <Changed value={power(result.power)} />
          </span>
        </Panel>
      </div>
      {spoiling.length > 0 && (
        <Panel className={styles.warnings}>
          Spoils: {spoiling.map((i) => `${i.name} in ${duration(i.spoil!.time)}`).join(', ')}. Keep these moving.
        </Panel>
      )}
      {result.warnings.length > 0 && <Panel className={styles.warnings}>{result.warnings.join(' ')}</Panel>}
    </Window>
  )
}
