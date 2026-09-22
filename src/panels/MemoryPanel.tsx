/**
 * (C) The memory panel.
 *
 * One grid. Names and objects are cards; bindings and pointers are
 * arrows; picking something flies the camera to frame it with everything it
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
import { useEffect, useState } from 'react'
import type { MemorySnapshot, ObjectId } from '../memory/model'
import { MemoryGraph, type GraphPick } from './MemoryGraph'

export function MemoryPanel({
  snapshot,
  handles,
  runKey = 'one',
}: {
  snapshot: MemorySnapshot
  /** Owned by the workbench, so every view that shows a handle shows the
   *  same one. See `memory/handles`. */
  handles: Map<ObjectId, string>
  runKey?: string
}) {
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

  const empty = snapshot.bindings.length === 0 && objectCount === 0

  // The graph stays mounted when memory is empty. Unmounting it threw away
  // every position, so the next thing to arrive rebuilt the whole picture
  // from nothing — which, on a console that replays every line, was every
  // line.
  return (
    <div
      className={`memory ${empty ? 'empty' : ''}`}
      data-testid="memory"
      data-picked={picked ? 'yes' : 'no'}
    >
      <MemoryGraph
        snapshot={snapshot}
        handles={handles}
        runKey={runKey}
        picked={picked}
        onPick={setPicked}
      />
      {empty && (
        <p className="memory-empty">
          Memory is empty. Send the robot some code and whatever it builds turns up here.
        </p>
      )}
    </div>
  )
}
