import { useMemo, useRef, useState } from 'react'
import { defaultMachines } from '../calculator/processes.ts'
import { defaultDisabled } from '../calculator/solve.ts'
import { useGame } from '../db/GameProvider.tsx'
import { exportPreferences, importPreferences, defaultPreferences, type Preferences } from '../settings/preferences.ts'
import { Button } from '../ui/Button/Button.tsx'
import { Checkbox } from '../ui/Checkbox/Checkbox.tsx'
import { Icon } from '../ui/Icon/Icon.tsx'
import { NumberInput, TextInput } from '../ui/Input/Input.tsx'
import { Modal } from '../ui/Modal/Modal.tsx'
import { Panel } from '../ui/Panel/Panel.tsx'
import { ScrollPane } from '../ui/ScrollPane/ScrollPane.tsx'
import { Select } from '../ui/Select/Select.tsx'
import { Slot } from '../ui/Slot/Slot.tsx'
import { Tabs } from '../ui/Tabs/Tabs.tsx'
import { ModuleSetupEditor } from './ModuleSetupEditor.tsx'
import { QualitySelect } from './QualitySelect.tsx'
import styles from './Settings.module.css'

type Tab = 'machines' | 'modules' | 'research' | 'recipes'
type SetPrefs = (change: (prefs: Preferences) => Preferences) => void

// "crafting-with-fluid" -> "Crafting with fluid"
const label = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ')

// Defaults for every calculation. Changes apply and save immediately, like the game's settings.
export function Settings({ prefs, setPrefs, onClose }: { prefs: Preferences; setPrefs: SetPrefs; onClose: () => void }) {
  const game = useGame()
  const [tab, setTab] = useState<Tab>('machines')
  const [message, setMessage] = useState<string>()
  const [confirmReset, setConfirmReset] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportPreferences(prefs, game.dataset.id)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `factorio-calc-settings-${game.dataset.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const upload = async (picked: File | undefined) => {
    if (!picked) return
    try {
      const imported = importPreferences(await picked.text())
      setPrefs(() => imported)
      setMessage('Settings imported.')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      <Tabs
        label="Settings"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'machines', label: 'Machines' },
          { id: 'modules', label: 'Modules' },
          { id: 'research', label: 'Research' },
          { id: 'recipes', label: 'Recipes' },
        ]}
      />
      <Panel className={styles.page}>
        <ScrollPane className={styles.scroll}>
          {tab === 'machines' && <MachinesTab prefs={prefs} setPrefs={setPrefs} />}
          {tab === 'modules' && <ModulesTab prefs={prefs} setPrefs={setPrefs} />}
          {tab === 'research' && <ResearchTab prefs={prefs} setPrefs={setPrefs} />}
          {tab === 'recipes' && <RecipesTab prefs={prefs} setPrefs={setPrefs} />}
        </ScrollPane>
      </Panel>
      <div className={styles.footer}>
        <Button onClick={download}>Export</Button>
        <Button onClick={() => file.current?.click()}>Import</Button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => upload(e.target.files?.[0])} />
        <span className={styles.message} role="status">
          {message}
        </span>
        {confirmReset ? (
          <Button
            variant="danger"
            onClick={() => {
              setPrefs(() => defaultPreferences())
              setConfirmReset(false)
              setMessage('Settings reset.')
            }}
          >
            Really reset everything?
          </Button>
        ) : (
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            Reset
          </Button>
        )}
      </div>
    </Modal>
  )
}

function MachinesTab({ prefs, setPrefs }: { prefs: Preferences; setPrefs: SetPrefs }) {
  const game = useGame()
  const defaults = useMemo(() => defaultMachines(game.data), [game])
  // Every category some recipe or resource needs, with the machines that serve it.
  const categories = useMemo(() => {
    const used = new Set([...game.data.recipes.flatMap((r) => r.categories), ...game.data.resources.map((r) => r.category)])
    return [...used]
      .sort()
      .map((c) => ({ id: c, machines: game.data.machines.filter((m) => m.categories.includes(c)) }))
      .filter((c) => c.machines.length > 1)
  }, [game])
  const fuels = game.data.items.filter((i) => i.fuel?.category === 'chemical')

  return (
    <div className={styles.rows}>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Fuel for burners</span>
        <Select label="Fuel" value={prefs.fuel} onChange={(fuel) => setPrefs((p) => ({ ...p, fuel }))} options={fuels.map((f) => ({ value: f.id, label: <><Icon kind="item" id={f.id} size={20} /> {f.name}</> }))} />
      </div>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Machine quality</span>
        <QualitySelect label="Machine quality" value={prefs.machineQuality} onChange={(machineQuality) => setPrefs((p) => ({ ...p, machineQuality }))} />
      </div>
      {categories.map((c) => {
        const current = prefs.machines[c.id] ?? defaults[c.id]
        return (
          <div key={c.id} className={styles.row}>
            <span className={styles.rowLabel}>{label(c.id)}</span>
            <div className={styles.choices}>
              {c.machines.map((m) => (
                <Slot
                  key={m.id}
                  kind="machine"
                  id={m.id}
                  title={m.name}
                  details={`Speed ${m.speed}${m.surface_conditions ? '. Only on some planets.' : ''}`}
                  aria-label={`${m.name} for ${label(c.id)}`}
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

function ModulesTab({ prefs, setPrefs }: { prefs: Preferences; setPrefs: SetPrefs }) {
  const game = useGame()
  return (
    <div className={styles.rows}>
      {game.data.machines
        .filter((m) => m.module_slots > 0)
        .map((m) => (
          <div key={m.id} className={styles.row}>
            <span className={styles.rowLabel}>
              <Icon kind="machine" id={m.id} size={24} /> {m.name}
            </span>
            <ModuleSetupEditor
              machine={m}
              allowed={m.allowed_effects}
              setup={prefs.setups[m.id] ?? { modules: [], beacons: [] }}
              onChange={(setup) => setPrefs((p) => ({ ...p, setups: { ...p.setups, [m.id]: setup } }))}
            />
          </div>
        ))}
    </div>
  )
}

function ResearchTab({ prefs, setPrefs }: { prefs: Preferences; setPrefs: SetPrefs }) {
  const game = useGame()
  const research = [...game.data.research].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'mining-productivity' ? -1 : 1))
  return (
    <div className={styles.rows}>
      {research.map((r) => {
        const level = prefs.research[r.id] ?? 0
        return (
          <div key={r.id} className={styles.row}>
            <span className={styles.rowLabel}>{r.name}</span>
            <NumberInput
              value={level}
              min={0}
              max={r.max_level}
              onChange={(n) => setPrefs((p) => ({ ...p, research: { ...p.research, [r.id]: Math.floor(n) } }))}
              aria-label={`${r.name} level`}
            />
            <span className={styles.note}>
              {r.max_level ? `of ${r.max_level}` : 'levels'} · +{Math.round(r.change * level * 1000) / 10}% {r.kind === 'mining-productivity' ? 'mining' : 'productivity'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function RecipesTab({ prefs, setPrefs }: { prefs: Preferences; setPrefs: SetPrefs }) {
  const game = useGame()
  const [query, setQuery] = useState('')
  const offByDefault = useMemo(() => new Set(defaultDisabled(game.data)), [game])
  const enabled = new Set(prefs.enabled)
  const disabled = new Set(prefs.disabled)
  const needle = query.trim().toLowerCase()
  const recipes = game.data.recipes.filter((r) => !needle || r.name.toLowerCase().includes(needle))

  const toggle = (id: string, on: boolean) =>
    setPrefs((p) =>
      offByDefault.has(id)
        ? { ...p, enabled: on ? [...p.enabled, id] : p.enabled.filter((x) => x !== id) }
        : { ...p, disabled: on ? p.disabled.filter((x) => x !== id) : [...p.disabled, id] },
    )

  return (
    <div className={styles.rows}>
      <TextInput placeholder="Search recipes" aria-label="Search recipes" value={query} onChange={(e) => setQuery(e.target.value)} />
      <p className={styles.note}>Recycling and barrel recipes are off unless you turn them on.</p>
      {recipes.map((r) => {
        const on = offByDefault.has(r.id) ? enabled.has(r.id) : !disabled.has(r.id)
        return (
          <Checkbox
            key={r.id}
            className={styles.recipe}
            checked={on}
            onChange={(e) => toggle(r.id, e.target.checked)}
            label={
              <>
                <Icon kind="recipe" id={r.id} size={20} /> {r.name}
              </>
            }
          />
        )
      })}
    </div>
  )
}
