// Registers the service worker (production only) and offers to reload when a new version of
// the site is ready.

import { useEffect, useState } from 'react'
import { Button } from '../ui/Button/Button.tsx'
import styles from './updates.module.css'

export function registerServiceWorker(onUpdate: (worker: ServiceWorker) => void) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
    const waiting = () => registration.waiting && navigator.serviceWorker.controller && onUpdate(registration.waiting)
    waiting()
    registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', waiting))
  })
  // Keep for offline what this page loaded before the worker was in control (game data, solver).
  navigator.serviceWorker.ready.then((registration) => {
    const urls = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((url) => url.startsWith(location.origin + import.meta.env.BASE_URL))
    registration.active?.postMessage({ type: 'cache', urls })
  })
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) location.reload()
    reloading = true
  })
}

export function UpdateNotice() {
  const [worker, setWorker] = useState<ServiceWorker>()
  useEffect(() => registerServiceWorker(setWorker), [])
  if (!worker) return null
  return (
    <div className={styles.notice} role="status">
      A new version of the calculator is ready.
      <Button variant="confirm" onClick={() => worker.postMessage({ type: 'skip-waiting' })}>
        Reload
      </Button>
      <Button onClick={() => setWorker(undefined)}>Later</Button>
    </div>
  )
}
