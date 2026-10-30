import type { ComponentProps } from 'react'
import { cx } from '../cx.ts'
import styles from './ScrollPane.module.css'

// A scrolling area with the game's scrollbars.
export function ScrollPane({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cx(styles.pane, className)} {...props} />
}
