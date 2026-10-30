import type { HTMLAttributes } from 'react'
import { cx } from '../cx.ts'
import styles from './Panel.module.css'

interface Props extends HTMLAttributes<HTMLDivElement> {
  // Darker well, used behind grids of slots.
  deep?: boolean
}

// An inset content area inside a window.
export function Panel({ deep, className, ...props }: Props) {
  return <div className={cx(styles.panel, deep && styles.deep, className)} {...props} />
}
