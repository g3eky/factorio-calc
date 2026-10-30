import { useGame } from '../db/GameProvider.tsx'
import { Select } from '../ui/Select/Select.tsx'
import styles from './QualitySelect.module.css'

// Picks a quality tier. Reports undefined for normal, which is how settings store it.
export function QualitySelect({ value, onChange, label }: { value: string | undefined; onChange: (quality: string | undefined) => void; label: string }) {
  const game = useGame()
  const tiers = [...game.data.qualities].sort((a, b) => a.level - b.level)
  if (tiers.length < 2) return null
  const normal = tiers[0].id
  return (
    <Select
      label={label}
      className={styles.select}
      value={value ?? normal}
      onChange={(q) => onChange(q === normal ? undefined : q)}
      options={tiers.map((q) => ({ value: q.id, label: <><span className={styles.dot} data-quality={q.id} /> {q.name}</> }))}
    />
  )
}
