// Our components next to the game, one comparison per reference crop. Dev builds only: #/compare.
// data-force="hover" shows a hover state without the pointer, to match the screenshots.

import { useState } from 'react'
import { Button } from '../ui/Button/Button.tsx'
import { Checkbox } from '../ui/Checkbox/Checkbox.tsx'
import { NumberInput } from '../ui/Input/Input.tsx'
import { ItemPicker } from '../ui/ItemPicker/ItemPicker.tsx'
import { Panel } from '../ui/Panel/Panel.tsx'
import { Select } from '../ui/Select/Select.tsx'
import { Slot } from '../ui/Slot/Slot.tsx'
import { Tabs } from '../ui/Tabs/Tabs.tsx'
import { TooltipBox } from '../ui/Tooltip/Tooltip.tsx'
import { Icon } from '../ui/Icon/Icon.tsx'
import { Window } from '../ui/Window/Window.tsx'
import { Compare } from './Compare.tsx'
import styles from './CompareGallery.module.css'

export function CompareGallery() {
  const [group, setGroup] = useState('logistics')
  return (
    <div className={styles.page}>
      <Compare title="Window, title bar, buttons" shot={2} crop={[0, 0, 914, 1272]}>
        <Window title="Main menu" style={{ width: 366 }}>
          <Panel deep className={styles.stack}>
            <Button variant="confirm" className={styles.wide}>
              Continue
            </Button>
          </Panel>
          <Panel deep className={styles.stack}>
            <Button className={styles.wide} data-force="hover">
              Single player
            </Button>
            {['Multiplayer', 'Map editor', 'Settings', 'Mods', 'About'].map((label) => (
              <Button key={label} className={styles.wide}>
                {label}
              </Button>
            ))}
          </Panel>
          <div className={styles.row}>
            <Button variant="danger" shape="back">
              Exit
            </Button>
          </div>
        </Window>
      </Compare>

      <Compare title="Dialog buttons" shot={18} crop={[0, 2240, 2144, 200]}>
        <div className={styles.row} style={{ width: 858 }}>
          <Button shape="back">Back</Button>
          <span className={styles.filler} />
          <Button variant="confirm" shape="forward">
            Confirm
          </Button>
        </div>
      </Compare>

      <Compare title="Slots" shot={4} crop={[0, 0, 1384, 292]}>
        <Panel deep className={styles.slots}>
          <Slot kind="item" id="iron-chest" data-force="hover" aria-label="Hovered" />
          {Array.from({ length: 9 }, (_, i) => (
            <Slot key={i} kind="item" id={['wooden-chest', 'transport-belt', 'inserter'][i] ?? 'iron-plate'} amount={i < 3 ? 10 * (i + 1) : undefined} aria-label="Slot" />
          ))}
        </Panel>
      </Compare>

      <Compare title="Crafting window: group tabs, slot grid, tooltip" shot={6} crop={[0, 0, 1136, 1226]}>
        <div className={styles.crafting}>
          <Window title="Crafting" style={{ width: 440 }}>
            <Tabs
              large
              label="Groups"
              value={group}
              onChange={setGroup}
              tabs={['logistics', 'production', 'intermediate-products', 'combat'].map((id, i) => ({
                id,
                title: id,
                label: <Icon kind="item" id={['inserter', 'assembling-machine-1', 'electronic-circuit', 'submachine-gun'][i]} size={64} />,
              }))}
            />
            <Panel deep className={styles.grid}>
              {['wooden-chest', 'iron-chest', 'transport-belt', 'inserter'].map((id, i) => (
                <Slot key={id} kind="item" id={id} amount={i ? i : undefined} data-force={i === 1 ? 'hover' : undefined} aria-label={id} />
              ))}
            </Panel>
          </Window>
          <TooltipBox title="Iron chest (Recipe)">
            <strong className={styles.heading}>Ingredients:</strong>
            <span>
              <Icon kind="item" id="iron-plate" size={24} /> 8 × Iron plate
            </span>
          </TooltipBox>
        </div>
      </Compare>

      <Compare title="Settings: dropdown, values" shot={18} crop={[1050, 0, 1094, 1000]}>
        <Panel className={styles.stack} style={{ width: 420 }}>
          <Select label="Language" value="en" onChange={() => {}} options={[{ value: 'en', label: 'Auto (English)' }]} />
          <NumberInput value={250} onChange={() => {}} aria-label="Scale" />
        </Panel>
      </Compare>

      <Compare title="Settings: checkboxes" shot={18} crop={[0, 0, 1000, 640]}>
        <Window title="Interface settings" style={{ width: 400 }}>
          <Panel className={styles.stack}>
            <strong className={styles.heading}>Visualization</strong>
            <Checkbox label="Show minimap" />
            <Checkbox label="Show mouse and keyboard control hints" />
            <Checkbox label="Show tips and tricks notifications" defaultChecked data-force="hover" />
            <Checkbox label="Show rail block visualization" defaultChecked />
          </Panel>
        </Window>
      </Compare>

      <Compare title="Item picker vs Factoriopedia" shot={9} crop={[0, 0, 1150, 1300]}>
        <ItemPicker onPick={() => {}} />
      </Compare>
    </div>
  )
}
