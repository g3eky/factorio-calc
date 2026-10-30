import { useId, type HTMLAttributes, type ReactNode } from 'react'
import { cx } from '../cx.ts'
import styles from './Window.module.css'

interface Props extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode
  // Buttons shown at the right of the title bar.
  actions?: ReactNode
}

// A game window: raised frame, bold title, the striped drag-handle filler, then content.
// A named region, so screen readers can jump between windows.
export function Window({ title, actions, className, children, ...props }: Props) {
  const id = useId()
  return (
    <section className={cx(styles.window, className)} aria-labelledby={id} {...props}>
      <header className={styles.titleBar}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        <span className={styles.filler} aria-hidden />
        {actions}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  )
}
