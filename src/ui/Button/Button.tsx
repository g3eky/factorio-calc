import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../cx.ts'
import styles from './Button.module.css'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'confirm' | 'danger'
  selected?: boolean
  // Square button sized for an icon or a single symbol.
  square?: boolean
  // Dialog buttons pointing back (left) or forward (right), like the game's Back and Confirm.
  shape?: 'back' | 'forward'
}

// The game's grey button; green to confirm, red for destructive actions, orange when selected.
export function Button({ variant = 'default', selected, square, shape, className, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], selected && styles.selected, square && styles.square, shape && styles[shape], className)}
      aria-pressed={selected}
      {...props}
    />
  )
}
