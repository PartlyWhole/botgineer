/**
 * A small value kept in this browser's localStorage and shared with React.
 *
 * Two things are stored, and nothing else: which levels are finished
 * (`progress.ts`) and how well each skill is known (`mastery/mastery.ts`).
 * Both need the same care: storage can throw (a private window, blocked
 * site data) or hold something that is not ours, and either way the answer
 * is the empty value, never a crash; another tab can write it; and React
 * must re-render when it changes. That care is written once, here.
 */
import { useSyncExternalStore } from 'react'

export type Stored<T> = {
  read: () => T
  write: (next: T) => void
  use: () => T
}

export function stored<T>(key: string, empty: T, parse: (raw: unknown) => T, serialise: (v: T) => unknown): Stored<T> {
  let cache: T | null = null
  const listeners = new Set<() => void>()

  const read = (): T => {
    if (cache !== null) return cache
    let value = empty
    try {
      const raw = window.localStorage.getItem(key)
      value = raw ? parse(JSON.parse(raw)) : empty
    } catch {
      value = empty
    }
    cache = value
    return value
  }

  const write = (next: T) => {
    cache = next
    try {
      window.localStorage.setItem(key, JSON.stringify(serialise(next)))
    } catch {
      // Not saved, but still true for this visit.
    }
    for (const fn of [...listeners]) fn()
  }

  const subscribe = (fn: () => void) => {
    listeners.add(fn)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key && e.key !== null) return
      cache = null
      fn()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(fn)
      window.removeEventListener('storage', onStorage)
    }
  }

  return { read, write, use: () => useSyncExternalStore(subscribe, read, read) }
}
