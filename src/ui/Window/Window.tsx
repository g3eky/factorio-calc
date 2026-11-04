import { useId, type HTMLAttributes, type ReactNode } from 'react'
import { cx } from '../cx.ts'
import styles from './Window.module.css'

interface Props extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode
  // Buttons shown at the right of the title bar.
  actions?: ReactNode
  // With onCollapse, the title is a button that hides and shows the content.
  collapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
}

// A game window: raised frame, bold title, the striped drag-handle filler, then content.
// A named region, so screen readers can jump between windows.
export function Window({ title, actions, collapsed = false, onCollapse, className, children, ...props }: Props) {
  const id = useId()
  return (
    <section className={cx(styles.window, collapsed && styles.collapsed, className)} aria-labelledby={id} {...props}>
      <header className={styles.titleBar}>
        <h2 id={id} className={styles.title}>
          {onCollapse ? (
            <button type="button" className={styles.toggle} aria-expanded={!collapsed} aria-controls={`${id}-body`} onClick={() => onCollapse(!collapsed)}>
              <svg className={styles.chevron} viewBox="0 0 10 10" aria-hidden>
                <path d="M2 3.5 5 6.5 8 3.5" />
              </svg>
              {title}
            </button>
          ) : (
            title
          )}
        </h2>
        <span className={styles.filler} aria-hidden />
        {actions}
      </header>
      <div id={`${id}-body`} className={styles.body} hidden={collapsed}>
        {children}
      </div>
    </section>
  )
}
