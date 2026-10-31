import { cloneElement, useEffect, useId, useRef, useState, type FocusEvent, type PointerEvent, type ReactElement, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import styles from './Tooltip.module.css'

interface Props {
  title: ReactNode
  content?: ReactNode
  // The element the tooltip belongs to. It gets pointer and focus handlers.
  children: ReactElement<Record<string, unknown>>
}

const OFFSET = 16
const DELAY = 150

// Game-style tooltip that follows the pointer. Position updates go straight to the DOM, so
// moving the pointer never re-renders React.
export function Tooltip({ title, content, children }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const point = useRef({ x: 0, y: 0 })
  const timer = useRef<number>(undefined)

  const place = () => {
    const el = box.current
    if (!el) return
    const { innerWidth, innerHeight } = window
    let x = point.current.x + OFFSET
    let y = point.current.y + OFFSET
    if (x + el.offsetWidth > innerWidth - 4) x = point.current.x - OFFSET - el.offsetWidth
    if (y + el.offsetHeight > innerHeight - 4) y = Math.max(4, innerHeight - 4 - el.offsetHeight)
    el.style.transform = `translate3d(${Math.max(4, x)}px, ${y}px, 0)`
  }

  useEffect(() => {
    if (open) place()
  }, [open])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const show = (x: number, y: number) => {
    point.current = { x, y }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), DELAY)
  }
  const hide = () => {
    window.clearTimeout(timer.current)
    setOpen(false)
  }

  const child = cloneElement(children, {
    'aria-describedby': open ? id : undefined,
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') show(e.clientX, e.clientY)
    },
    onPointerMove: (e: PointerEvent) => {
      point.current = { x: e.clientX, y: e.clientY }
      place()
    },
    onPointerLeave: hide,
    onPointerDown: hide,
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.matches(':focus-visible')) return
      const rect = e.currentTarget.getBoundingClientRect()
      show(rect.right - OFFSET / 2, rect.bottom - OFFSET / 2)
    },
    onBlur: hide,
  })

  return (
    <>
      {child}
      {open &&
        createPortal(
          <TooltipBox ref={box} id={id} title={title} floating>
            {content}
          </TooltipBox>,
          document.body,
        )}
    </>
  )
}

// The tooltip's look: a cream title bar over a dark body (6). Floating ones follow the pointer;
// the gallery shows static ones.
export function TooltipBox({ title, children, floating, id, ref }: { title: ReactNode; children?: ReactNode; floating?: boolean; id?: string; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} id={id} role="tooltip" className={floating ? `${styles.tooltip} ${styles.floating}` : styles.tooltip}>
      <div className={styles.title}>{title}</div>
      {children && <div className={styles.content}>{children}</div>}
    </div>
  )
}
