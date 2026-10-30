// Typed JSON values in localStorage. Unreadable or invalid values fall back to the default
// instead of breaking the page.

import { useEffect, useState } from 'react'

type Store = Pick<Storage, 'getItem' | 'setItem'>

export function loadJson<T>(key: string, fallback: T, valid: (value: unknown) => value is T, store: Store = localStorage): T {
  try {
    const value = JSON.parse(store.getItem(key) ?? 'null')
    return value !== null && valid(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown, store: Store = localStorage): void {
  try {
    store.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked (private mode): the page keeps working, it just won't remember.
  }
}

// React state that's loaded from and saved to localStorage under `key`.
export function usePersistentState<T>(key: string, fallback: () => T, valid: (value: unknown) => value is T) {
  const [value, setValue] = useState(() => loadJson(key, fallback(), valid))
  useEffect(() => saveJson(key, value), [key, value])
  return [value, setValue] as const
}
