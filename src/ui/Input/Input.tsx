import { useEffect, useState, type ComponentProps, type InputHTMLAttributes } from 'react'
import { cx } from '../cx.ts'
import styles from './Input.module.css'

export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return <input type="text" className={cx(styles.input, className)} {...props} />
}

interface NumberProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max'> {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

// A number field that lets you type freely and only reports valid numbers. Invalid text is
// marked red and reverts to the last valid value when the field loses focus.
export function NumberInput({ value, onChange, min, max, className, onBlur, ...props }: NumberProps) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    if (Number(text) !== value) setText(String(value))
    // Only external changes should overwrite what's being typed.
  }, [value])
  const parsed = text.trim() === '' ? NaN : Number(text)
  const valid = Number.isFinite(parsed) && (min === undefined || parsed >= min) && (max === undefined || parsed <= max)
  return (
    <input
      type="text"
      inputMode="decimal"
      className={cx(styles.input, styles.number, !valid && styles.invalid, className)}
      aria-invalid={!valid}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const next = Number(e.target.value)
        if (e.target.value.trim() !== '' && Number.isFinite(next) && (min === undefined || next >= min) && (max === undefined || next <= max))
          onChange(next)
      }}
      onBlur={(e) => {
        if (!valid) setText(String(value))
        onBlur?.(e)
      }}
      {...props}
    />
  )
}
