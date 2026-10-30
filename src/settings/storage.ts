// Typed JSON values in localStorage. Unreadable or invalid values fall back to the default
// instead of breaking the page.

import { useEffect, useState } from 'react'

type Store = Pick<Storage, 'getItem' | 'setItem'>

// `read` turns the stored JSON into a value (upgrading old versions), or undefined if it can't.
// A stored value that can't be read is kept under "<key>:backup" rather than lost.
export function loadJson<T>(key: string, fallback: T, read: (value: unknown) => T | undefined, store: Store = localStorage): T {
  const text = store.getItem(key)
  if (text === null) return fallback
  let value: T | undefined
  try {
    value = read(JSON.parse(text))
  } catch {
    value = undefined
  }
  if (value !== undefined) return value
  saveRaw(`${key}:backup`, text, store)
  return fallback
}

function saveRaw(key: string, text: string, store: Store) {
  try {
    store.setItem(key, text)
  } catch {
    // Storage full or blocked.
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
export function usePersistentState<T>(key: string, fallback: () => T, read: (value: unknown) => T | undefined) {
  const [value, setValue] = useState(() => loadJson(key, fallback(), read))
  useEffect(() => saveJson(key, value), [key, value])
  return [value, setValue] as const
}
