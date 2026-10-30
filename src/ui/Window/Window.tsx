import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx.ts'
import styles from './Window.module.css'

interface Props extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode
  // Buttons shown at the right of the title bar.
  actions?: ReactNode
}

// A game window: raised frame, bold title, the striped drag-handle filler, then content.
export function Window({ title, actions, className, children, ...props }: Props) {
  return (
    <section className={cx(styles.window, className)} {...props}>
      <header className={styles.titleBar}>
        <h2 className={styles.title}>{title}</h2>
        <span className={styles.filler} aria-hidden />
        {actions}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  )
}
