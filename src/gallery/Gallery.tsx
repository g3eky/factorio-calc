// Every UI component in every state, for checking looks, keyboard use and smoothness.
// Dev builds only: open #/gallery.

import { useMemo, useState } from 'react'
import { defaultDisabled } from '../calculator/solve.ts'
import { useSolver } from '../calculator/useSolver.ts'
import { useGame } from '../db/GameProvider.tsx'
import { Button } from '../ui/Button/Button.tsx'
import { Checkbox, Radio } from '../ui/Checkbox/Checkbox.tsx'
import { Icon } from '../ui/Icon/Icon.tsx'
import { NumberInput, TextInput } from '../ui/Input/Input.tsx'
import { ItemPicker, type Pick } from '../ui/ItemPicker/ItemPicker.tsx'
import { Panel } from '../ui/Panel/Panel.tsx'
import { ScrollPane } from '../ui/ScrollPane/ScrollPane.tsx'
import { Select } from '../ui/Select/Select.tsx'
import { Slot } from '../ui/Slot/Slot.tsx'
import { Tabs } from '../ui/Tabs/Tabs.tsx'
import { Window } from '../ui/Window/Window.tsx'
import styles from './Gallery.module.css'

export function Gallery() {
  const game = useGame()
  const [picked, setPicked] = useState<Pick>({ kind: 'item', id: 'electronic-circuit' })
  const [tab, setTab] = useState<'machines' | 'modules' | 'research'>('machines')
  const [unit, setUnit] = useState('min')
  const [rate, setRate] = useState(60)
  const [checked, setChecked] = useState(true)
  const [radio, setRadio] = useState('a')
  const icons = game.icons ? [...game.icons.positions.keys()] : []

  return (
    <div className={styles.gallery}>
      <Window title="Buttons" actions={<Button square aria-label="Close">✕</Button>}>
        <div className={styles.row}>
          <Button>Default</Button>
          <Button variant="confirm">Confirm</Button>
          <Button variant="danger">Delete</Button>
          <Button selected>Selected</Button>
          <Button disabled>Disabled</Button>
          <Button square aria-label="Add">+</Button>
        </div>
      </Window>

      <Window title="Slots and tooltips">
        <Panel deep className={styles.row}>
          <Slot kind="item" id="iron-plate" title="Iron plate" details="Hover tooltip with details." />
          <Slot kind="item" id="electronic-circuit" amount="1.5k" title="Electronic circuit" />
          <Slot kind="fluid" id="petroleum-gas" amount={45} title="Petroleum gas" />
          <Slot kind="recipe" id="advanced-oil-processing" title="Advanced oil processing (own icon)" />
          <Slot kind="recipe" id="iron-gear-wheel" title="Iron gear wheel (product icon)" />
          <Slot kind="machine" id="foundry" title="Foundry" />
          <Slot kind="item" id="quantum-processor" quality="legendary" amount={3} title="Legendary quantum processor" />
          <Slot kind="item" id="speed-module" selected title="Selected" />
          <Slot kind="item" id="car" title="No wiki icon: initials" />
        </Panel>
      </Window>

      <Window title="Form controls">
        <Tabs
          label="Settings"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'machines', label: 'Machines' },
            { id: 'modules', label: 'Modules' },
            { id: 'research', label: 'Research' },
          ]}
        />
        <Panel className={styles.column}>
          <div className={styles.row}>
            <NumberInput value={rate} min={0} onChange={setRate} aria-label="Rate" />
            <Select
              label="Rate unit"
              value={unit}
              onChange={setUnit}
              options={[
                { value: 's', label: 'per second' },
                { value: 'min', label: 'per minute' },
                { value: 'h', label: 'per hour' },
              ]}
            />
            <span>
              = {rate} / {unit}
            </span>
          </div>
          <TextInput placeholder="Text input" aria-label="Text" />
          <Select
            label="Machine"
            value="assembling-machine-2"
            onChange={() => {}}
            options={game.data.machines
              .filter((m) => m.categories.includes('crafting'))
              .map((m) => ({ value: m.id, label: <><Icon kind="machine" id={m.id} size={20} /> {m.name}</> }))}
          />
          <Checkbox label="Checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <div className={styles.row}>
            <Radio label="Option A" name="radio" checked={radio === 'a'} onChange={() => setRadio('a')} />
            <Radio label="Option B" name="radio" checked={radio === 'b'} onChange={() => setRadio('b')} />
          </div>
        </Panel>
      </Window>

      <Window title="Item picker">
        <ItemPicker selected={picked} onPick={setPicked} />
        <p className={styles.note}>
          Picked: {picked.kind} {picked.id}
        </p>
      </Window>

      <SolverDemo target={picked} rate={rate} />

      <Window title={`Icon atlas (${icons.length})`} className={styles.wide}>
        <ScrollPane className={styles.atlas}>
          <Panel deep className={styles.icons}>
            {icons.map((key) => {
              const [kind, id] = key.split(/\/(.*)/) as ['item', string]
              return (
                <span key={key} title={key}>
                  <Icon kind={kind} id={id} />
                </span>
              )
            })}
          </Panel>
        </ScrollPane>
      </Window>
    </div>
  )
}

// Solves for the picked item at the rate above, in the worker.
function SolverDemo({ target, rate }: { target: Pick; rate: number }) {
  const game = useGame()
  const disabled = useMemo(() => defaultDisabled(game.data), [game])
  const request = useMemo(
    () => ({ targets: [{ ...target, rate: rate / 60 }], machines: {}, setups: {}, overrides: {}, disabled, research: {}, fuel: 'coal' }),
    [target, rate, disabled],
  )
  const { response, solving } = useSolver(game.data, request)
  return (
    <Window title="Solver (worker)">
      <Panel className={styles.column} data-testid="solver">
        <span>
          {rate}/min {target.id} {solving ? '(solving…)' : ''}
        </span>
        {response?.ok === false && <span>{response.error}</span>}
        {response?.ok &&
          response.result.processes.map((p) => (
            <span key={p.key} className={styles.row}>
              <Icon kind={p.kind === 'recipe' ? 'recipe' : 'machine'} id={p.kind === 'recipe' ? p.id : p.machine} size={20} />
              {p.key}: {p.machines.toFixed(2)} × {game.machines.get(p.machine)?.name}
            </span>
          ))}
      </Panel>
    </Window>
  )
}
