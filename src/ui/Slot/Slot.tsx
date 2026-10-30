import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../cx.ts'
import { Icon, type IconKind } from '../Icon/Icon.tsx'
import { Tooltip } from '../Tooltip/Tooltip.tsx'
import styles from './Slot.module.css'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  kind: IconKind
  id: string
  // Shown in the corner with the game's outlined numbers.
  amount?: ReactNode
  // Quality name, shown as a badge for anything above normal.
  quality?: string
  selected?: boolean
  // Tooltip title and body. Without a title there is no tooltip.
  title?: ReactNode
  details?: ReactNode
}

// A square inventory slot with an icon, like the game's item slots.
export function Slot({ kind, id, amount, quality, selected, title, details, className, ...props }: Props) {
  const slot = (
    <button type="button" className={cx(styles.slot, selected && styles.selected, className)} aria-pressed={selected} {...props}>
      <Icon kind={kind} id={id} />
      {quality && quality !== 'normal' && <span className={cx(styles.quality, styles[quality])} title={quality} />}
      {amount !== undefined && <span className={styles.amount}>{amount}</span>}
    </button>
  )
  return title ? (
    <Tooltip title={title} content={details}>
      {slot}
    </Tooltip>
  ) : (
    slot
  )
}
