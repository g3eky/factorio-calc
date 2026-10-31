import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { uiZoom } from '../zoom.ts'
import { cx } from '../cx.ts'
import styles from './Select.module.css'

interface Props<T extends string> {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (value: T) => void
  label: string
  className?: string
}

// A game-style drop-down. Keyboard: arrows, Home/End, Enter or Space to pick, Escape to close.
// The list opens in the drop-down layer, outside the page's panels, so scrolling panels can't clip
// it; it sits under the button (or above, if there's no room) and follows it when things scroll.
export function Select<T extends string>({ value, options, onChange, label, className }: Props<T>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node) && !list.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    // Screen pixels in, zoomed CSS pixels out (see ../zoom.ts).
    const place = () => {
      const el = list.current
      const anchor = button.current?.getBoundingClientRect()
      if (!el || !anchor) return
      const zoom = uiZoom()
      const height = el.offsetHeight * zoom
      const below = anchor.bottom + 2
      const y = below + height > window.innerHeight - 4 && anchor.top - 2 - height > 4 ? anchor.top - 2 - height : below
      el.style.minWidth = `${anchor.width / zoom}px`
      el.style.transform = `translate3d(${anchor.left / zoom}px, ${y / zoom}px, 0)`
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  const openList = () => {
    setActive(selectedIndex)
    setOpen(true)
  }
  const pick = (index: number) => {
    onChange(options[index].value)
    setOpen(false)
    button.current?.focus()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    const last = options.length - 1
    const moves: Record<string, number> = { ArrowDown: Math.min(active + 1, last), ArrowUp: Math.max(active - 1, 0), Home: 0, End: last }
    if (e.key in moves) {
      e.preventDefault()
      setActive(moves[e.key])
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(active)
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={root} className={cx(styles.select, className)}>
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span id={`${id}-label`} className={styles.hidden}>
          {label}
        </span>
        <span id={`${id}-value`} className={styles.value}>
          {options[selectedIndex]?.label}
        </span>
        <span className={styles.arrow} aria-hidden />
      </button>
      {open &&
        createPortal(
        <ul ref={list} id={id} role="listbox" aria-label={label} className={styles.list}>
          {options.map((option, i) => (
            <li
              key={option.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={option.value === value}
              className={cx(styles.option, i === active && styles.active)}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              {option.label}
            </li>
          ))}
        </ul>,
          document.body,
        )}
    </div>
  )
}
