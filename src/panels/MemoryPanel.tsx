/**
 * (C) The memory panel.
 *
 * One live field. Names and objects are nodes; bindings and pointers are
 * edges; picking something flies the camera to frame it with everything it
 * touches. Nothing here opens a second view *of memory* — that is what
 * made the old panel disjoint, because you lost sight of the clouds
 * exactly when you wanted to see where the thing you picked sat in them.
 *
 * Memory itself is a view of the robot panel, which is where it is
 * mounted; see `RobotPanel`.
 *
 * All this component owns is the handles and the selection. The graph
 * owns everything else — including the description of what is selected,
 * which lives on the node itself rather than in prose underneath.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { orderedObjectIds, type MemorySnapshot, type ObjectId } from '../memory/model'
import { MemoryGraph, type GraphPick } from './MemoryGraph'

/**
 * Handles are assigned on first sight and kept for the whole run.
 *
 * Numbering each snapshot from scratch would renumber objects as you
 * scrub — `obj3` becoming `obj4` because something new appeared earlier in
 * the sort — and a handle that moves is worse than no handle at all.
 */
function useHandles(snapshot: MemorySnapshot, runKey: string): Map<ObjectId, string> {
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

export function MemoryPanel({
  snapshot,
  runKey = 'one',
}: {
  snapshot: MemorySnapshot
  runKey?: string
}) {
  const handles = useHandles(snapshot, runKey)
  const [picked, setPicked] = useState<GraphPick>(null)

  const objectCount = Object.keys(snapshot.objects).length

  // A selection the program no longer has would leave a node highlighted
  // that is not there any more.
  useEffect(() => {
    if (!picked) return
    const alive =
      picked.kind === 'object'
        ? !!snapshot.objects[picked.id]
        : snapshot.bindings.some((b) => b.name === picked.name && b.scope === picked.scope)
    if (!alive) setPicked(null)
  }, [picked, snapshot])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPicked(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (snapshot.bindings.length === 0 && objectCount === 0) {
    return (
      <div className="memory empty" data-testid="memory">
        <p>Memory is empty. Send the robot some code and whatever it builds turns up here.</p>
      </div>
    )
  }

  return (
    <div className="memory" data-testid="memory" data-picked={picked ? 'yes' : 'no'}>
      <MemoryGraph
        snapshot={snapshot}
        handles={handles}
        runKey={runKey}
        picked={picked}
        onPick={setPicked}
      />
    </div>
  )
}

