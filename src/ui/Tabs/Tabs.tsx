import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../cx.ts'
import styles from './Tabs.module.css'

interface Props<T extends string> {
  tabs: { id: T; label: ReactNode; title?: string }[]
  value: T
  onChange: (id: T) => void
  // Big square tabs, as for the item picker's groups.
  large?: boolean
  label: string
}

// A row of tabs. Arrow keys move between them, like a native tab list.
export function Tabs<T extends string>({ tabs, value, onChange, large, label }: Props<T>) {
  const list = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const index = (tabs.findIndex((t) => t.id === value) + step + tabs.length) % tabs.length
    onChange(tabs[index].id)
    list.current?.querySelectorAll<HTMLElement>('[role=tab]')[index]?.focus()
  }
  return (
    <div ref={list} role="tablist" aria-label={label} className={cx(styles.tabs, large && styles.large)} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          title={tab.title}
          aria-selected={tab.id === value}
          tabIndex={tab.id === value ? 0 : -1}
          className={cx(styles.tab, tab.id === value && styles.selected)}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
