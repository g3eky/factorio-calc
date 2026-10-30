import { useEffect, useState } from 'react'
import { loadManifest, openDatabase } from '../db/database.ts'
import styles from './App.module.css'

export function App() {
  const [status, setStatus] = useState('Loading…')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const manifest = await loadManifest()
      const dataset = manifest.datasets[0]
      const db = await openDatabase(dataset.file)
      const count = db.exec('SELECT COUNT(*) FROM item')[0].values[0][0]
      db.close()
      if (!cancelled) setStatus(`${dataset.name} ${dataset.version}: ${count} items loaded`)
    })().catch((error) => {
      if (!cancelled) setStatus(`Failed to load data: ${error}`)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={styles.window}>
      <h1 className={styles.title}>Factorio calculator</h1>
      <div className={styles.panel}>{status}</div>
    </div>
  )
}
