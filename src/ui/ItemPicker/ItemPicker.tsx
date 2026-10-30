import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useGame } from '../../db/GameProvider.tsx'
import { TextInput } from '../Input/Input.tsx'
import { Icon } from '../Icon/Icon.tsx'
import { ScrollPane } from '../ScrollPane/ScrollPane.tsx'
import { Slot } from '../Slot/Slot.tsx'
import { Tabs } from '../Tabs/Tabs.tsx'
import styles from './ItemPicker.module.css'

export interface Pick {
  kind: 'item' | 'fluid'
  id: string
}

interface Entry extends Pick {
  name: string
  order: string
}

interface Props {
  onPick: (pick: Pick) => void
  // Which items and fluids to offer. Defaults to all.
  filter?: (pick: Pick) => boolean
  selected?: Pick
}

// The game's item picker: a tab per item group, a row per subgroup, and search by name.
export function ItemPicker({ onPick, filter, selected }: Props) {
  const game = useGame()
  // Open on the group of the selected item, like the game.
  const [group, setGroup] = useState(() => {
    const subgroup = selected && (selected.kind === 'item' ? game.items : game.fluids).get(selected.id)?.subgroup
    return game.data.groups.find((g) => g.subgroups.some((s) => s.id === subgroup))?.id
  })
  const [query, setQuery] = useState('')
  const search = useRef<HTMLInputElement>(null)
  const grid = useRef<HTMLDivElement>(null)

  // Groups -> subgroup rows -> entries, in the game's order.
  const groups = useMemo(() => {
    const bySubgroup = new Map<string, Entry[]>()
    const add = (entry: Entry, subgroup: string) => {
      if (filter && !filter(entry)) return
      if (!bySubgroup.has(subgroup)) bySubgroup.set(subgroup, [])
      bySubgroup.get(subgroup)!.push(entry)
    }
    for (const item of game.data.items) add({ kind: 'item', id: item.id, name: item.name, order: item.order }, item.subgroup)
    for (const fluid of game.data.fluids) add({ kind: 'fluid', id: fluid.id, name: fluid.name, order: fluid.order }, fluid.subgroup)
    const sortKey = (x: { order: string; id: string }) => `${x.order}\u0000${x.id}`
    const compare = (a: { order: string; id: string }, b: { order: string; id: string }) => (sortKey(a) < sortKey(b) ? -1 : 1)
    return [...game.data.groups]
      .sort(compare)
      .map((g) => ({
        id: g.id,
        name: g.name,
        rows: [...g.subgroups]
          .sort(compare)
          .map((s) => (bySubgroup.get(s.id) ?? []).sort(compare))
          .filter((row) => row.length),
      }))
      .filter((g) => g.rows.length)
  }, [game, filter])

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? groups
        .map((g) => ({ ...g, rows: g.rows.map((row) => row.filter((e) => e.name.toLowerCase().includes(needle))).filter((row) => row.length) }))
        .filter((g) => g.rows.length)
    : groups
  const current = visible.find((g) => g.id === group) ?? visible[0]

  // Arrow keys move to the nearest slot in that direction; typing jumps to the search box.
  const onGridKeyDown = (e: KeyboardEvent) => {
    const slots = [...(grid.current?.querySelectorAll<HTMLElement>('button') ?? [])]
    const from = slots.indexOf(document.activeElement as HTMLElement)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      search.current?.focus()
      return
    }
    if (from < 0) return
    const rect = slots[from].getBoundingClientRect()
    let target: HTMLElement | undefined
    if (e.key === 'ArrowRight') target = slots[from + 1]
    else if (e.key === 'ArrowLeft') target = slots[from - 1]
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const down = e.key === 'ArrowDown'
      const lines = slots
        .map((s) => s.getBoundingClientRect())
        .filter((r) => (down ? r.top > rect.top + 1 : r.top < rect.top - 1))
      if (lines.length) {
        const line = down ? Math.min(...lines.map((r) => r.top)) : Math.max(...lines.map((r) => r.top))
        target = slots
          .filter((s) => Math.abs(s.getBoundingClientRect().top - line) < 1)
          .sort((a, b) => Math.abs(a.getBoundingClientRect().left - rect.left) - Math.abs(b.getBoundingClientRect().left - rect.left))[0]
      } else if (!down) {
        search.current?.focus()
      }
    } else return
    e.preventDefault()
    target?.focus()
  }

  const onSearchKeyDown = (e: KeyboardEvent) => {
    const first = current?.rows[0]?.[0]
    if (e.key === 'Enter' && first) onPick(first)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      grid.current?.querySelector<HTMLElement>('button')?.focus()
    }
  }

  return (
    <div className={styles.picker}>
      <TextInput
        ref={search}
        className={styles.search}
        placeholder="Search"
        aria-label="Search items"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onSearchKeyDown}
      />
      {visible.length > 0 && current ? (
        <>
          <Tabs
            large
            label="Item groups"
            value={current.id}
            onChange={setGroup}
            tabs={visible.map((g) => ({ id: g.id, title: g.name, label: <Icon kind={g.rows[0][0].kind} id={g.rows[0][0].id} size={48} /> }))}
          />
          <ScrollPane ref={grid} className={styles.grid} role="group" aria-label={current.name} onKeyDown={onGridKeyDown}>
            {current.rows.map((row) => (
              <div key={`${row[0].kind}/${row[0].id}`} className={styles.row}>
                {row.map((entry) => (
                  <Slot
                    key={`${entry.kind}/${entry.id}`}
                    kind={entry.kind}
                    id={entry.id}
                    title={entry.name}
                    aria-label={entry.name}
                    selected={selected?.kind === entry.kind && selected.id === entry.id}
                    onClick={() => onPick(entry)}
                  />
                ))}
              </div>
            ))}
          </ScrollPane>
        </>
      ) : (
        <p className={styles.empty}>Nothing matches "{query}".</p>
      )}
    </div>
  )
}
