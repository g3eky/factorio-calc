// Compare view: a crop of a reference screenshot of the game next to our version.
// Screenshots are in screenshots/ (dev only), taken at 2.5 screen pixels per game pixel
// (Retina at 125% UI scale), so crops are shown at 1 / 2.5 to match 1 game px = 1 CSS px.

import { useState, type ReactNode } from 'react'
import { Checkbox } from '../ui/Checkbox/Checkbox.tsx'
import styles from './Compare.module.css'

const SCALE = 1 / 2.5

interface Props {
  title: string
  // Screenshot number (name order) and the crop in screenshot pixels.
  shot: number
  crop: [x: number, y: number, width: number, height: number]
  children: ReactNode
}

export function Compare({ title, shot, crop: [x, y, width, height], children }: Props) {
  const [overlay, setOverlay] = useState(false)
  const reference = (
    <div className={styles.reference} style={{ width: width * SCALE, height: height * SCALE }} aria-hidden>
      <img src={`/__reference/${shot}.png`} alt="" style={{ zoom: SCALE, marginLeft: -x, marginTop: -y }} />
    </div>
  )
  return (
    <section className={styles.compare}>
      <h3 className={styles.title}>
        {title} <span className={styles.source}>screenshot {shot}</span>
        <Checkbox label="Overlay" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
      </h3>
      <div className={overlay ? styles.stacked : styles.sideBySide}>
        {reference}
        <div className={styles.ours}>{children}</div>
      </div>
    </section>
  )
}
