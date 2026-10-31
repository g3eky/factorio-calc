import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { uiZoom } from '../zoom.ts'
import styles from './Popover.module.css'

interface Props {
  // The element to open next to.
  anchor: HTMLElement
  title: ReactNode
  onClose: () => void
  children: ReactNode
}

// A small game-style window next to an element. Closes on Escape or a click outside, and
// gives focus back to the anchor.
export function Popover({ anchor, title, onClose, children }: Props) {
  const box = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    // Screen pixels; the box's own size and the final position are in zoomed CSS pixels.
    const el = box.current!
    const zoom = uiZoom()
    const rect = anchor.getBoundingClientRect()
    const [width, height] = [el.offsetWidth * zoom, el.offsetHeight * zoom]
    const x = Math.max(4, Math.min(rect.left, window.innerWidth - width - 4))
    const below = rect.bottom + 4
    const y = below + height > window.innerHeight - 4 ? Math.max(4, rect.top - 4 - height) : below
    el.style.transform = `translate3d(${x / zoom}px, ${y / zoom}px, 0)`
    el.querySelector<HTMLElement>('button, input, [tabindex]')?.focus()
  }, [anchor])

  useEffect(() => {
    const close = () => {
      onClose()
      anchor.focus()
    }
    const onPointer = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchor, onClose])

  return createPortal(
    <div ref={box} role="dialog" aria-label={typeof title === 'string' ? title : undefined} className={styles.popover}>
      <div className={styles.title}>{title}</div>
      <div className={styles.body}>{children}</div>
    </div>,
    document.body,
  )
}
