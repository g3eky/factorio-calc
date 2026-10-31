import type { CSSProperties } from 'react'
import styles from './Slider.module.css'

interface Props {
  // The allowed values, in order; the slider moves between them.
  steps: number[]
  value: number
  onChange: (value: number) => void
  label: string
}

// The game's slider (18): a dark groove filled orange up to a grey thumb, with a tick per step.
// A native range input underneath, so keyboard and screen readers work as usual.
export function Slider({ steps, value, onChange, label }: Props) {
  const index = Math.max(0, steps.indexOf(value))
  const fill = steps.length > 1 ? (index / (steps.length - 1)) * 100 : 0
  return (
    <span className={styles.slider} style={{ '--fill': `${fill}%`, '--ticks': steps.length - 1 } as CSSProperties}>
      <input
        type="range"
        className={styles.input}
        min={0}
        max={steps.length - 1}
        step={1}
        value={index}
        aria-label={label}
        aria-valuetext={String(value)}
        onChange={(e) => onChange(steps[Number(e.target.value)])}
      />
    </span>
  )
}
