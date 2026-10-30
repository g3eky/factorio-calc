import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../Button/Button.tsx'
import { Window } from '../Window/Window.tsx'
import styles from './Modal.module.css'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

// A game window over a dimmed page. Escape or the close button closes it.
export function Modal({ title, onClose, children }: Props) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    box.current?.querySelector<HTMLElement>('[role=tab], button, input')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [onClose])
  return createPortal(
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} className={styles.modal}>
        <Window title={title} className={styles.window} actions={<Button square aria-label="Close" onClick={onClose}>✕</Button>}>
          {children}
        </Window>
      </div>
    </div>,
    document.body,
  )
}
