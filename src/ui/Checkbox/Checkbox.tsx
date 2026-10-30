import type { InputHTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx.ts'
import styles from './Checkbox.module.css'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
}

export function Checkbox({ label, className, ...props }: Props) {
  return (
    <label className={cx(styles.label, className)}>
      <input type="checkbox" className={styles.checkbox} {...props} />
      {label}
    </label>
  )
}

export function Radio({ label, className, ...props }: Props) {
  return (
    <label className={cx(styles.label, className)}>
      <input type="radio" className={cx(styles.checkbox, styles.radio)} {...props} />
      {label}
    </label>
  )
}
