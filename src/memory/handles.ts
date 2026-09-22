/**
 * Object handles: `obj1`, `obj2`, …
 *
 * Assigned on first sight and kept for the whole run. Numbering each
 * snapshot from scratch would renumber objects as you scrub — `obj3`
 * becoming `obj4` because something new appeared earlier in the sort —
 * and a handle that moves is worse than no handle at all.
 *
 * Lives here rather than inside a panel because more than one view shows
 * handles now, and two views numbering the same object differently would
 * be worse than either of them numbering it badly.
 */
import { useMemo, useRef } from 'react'
import { orderedObjectIds, type MemorySnapshot, type ObjectId } from './model'

export function useHandles(snapshot: MemorySnapshot, runKey: string): Map<ObjectId, string> {
  const store = useRef({ run: runKey, map: new Map<ObjectId, string>(), next: 1 })
  return useMemo(() => {
    if (store.current.run !== runKey) {
      store.current = { run: runKey, map: new Map(), next: 1 }
    }
    const s = store.current
    for (const id of orderedObjectIds(snapshot)) {
      if (!s.map.has(id)) s.map.set(id, `obj${s.next++}`)
    }
    return new Map(s.map)
  }, [snapshot, runKey])
}
