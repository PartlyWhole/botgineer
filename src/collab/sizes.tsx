/**
 * Pane sizes, shared in a room: drag a gutter and every screen in the room
 * moves its own gutter with it.
 *
 * A size goes as a fraction of the space the gutter divides, not in pixels,
 * because the screens are not the same size: a code pane 900px wide on a
 * big monitor is most of a laptop. Each receiver turns it back into pixels
 * for its own space, and the gutter's own limits still hold.
 *
 * Outside a room there is no provider, and a gutter is just a gutter.
 */
import { createContext, useCallback, useContext, useEffect, useRef } from 'react'

export type SizeSync = {
  share: (key: string, frac: number) => void
  listen: (fn: (key: string, frac: number) => void) => () => void
}

export const SizeSyncContext = createContext<SizeSync | null>(null)

/**
 * The setter a gutter calls for pane `key`: it sets the size here and, in a
 * room, tells the others. A size from another peer is set here through
 * `set` directly, so it is not sent back. `space` measures what the gutter
 * divides, in pixels, now.
 */
export function useSyncedSize(key: string, set: (px: number) => void, space: () => number): (px: number) => void {
  const sync = useContext(SizeSyncContext)
  const setRef = useRef(set)
  setRef.current = set
  const spaceRef = useRef(space)
  spaceRef.current = space
  useEffect(() => {
    if (!sync) return
    return sync.listen((k, frac) => {
      const total = spaceRef.current()
      if (k === key && total > 0) setRef.current(Math.round(frac * total))
    })
  }, [sync, key])
  return useCallback(
    (px: number) => {
      setRef.current(px)
      const total = spaceRef.current()
      if (sync && total > 0) sync.share(key, px / total)
    },
    [sync, key],
  )
}
