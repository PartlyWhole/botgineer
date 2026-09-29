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
import { CROW_NAME } from '../../content/cast'
import { DemoTag } from '../ui/CrowTag'

export function MemoryPanel({
  snapshot,
  handles,
  runKey = 'one',
  emptyText,
  look = 'v1',
  marked,
  demo = false,
}: {
  snapshot: MemorySnapshot
  /** Owned by the workbench, so every view that shows a handle shows the
   *  same one. See `memory/handles`. */
  handles: Map<ObjectId, string>
  runKey?: string
  /** What an empty memory says. Reading has its own reason to be empty. */
  emptyText?: string | undefined
  /** `v2` shows an empty memory as an empty storage bank, waiting to be
   *  filled, instead of a sentence (`robot-v2.css`). */
  look?: 'v1' | 'v2' | undefined
  /** Names whose pills, arrows and objects wear a glow ring: what a
   *  beat is pointing at. Paint only (`MemoryGraph`). */
  marked?: readonly string[] | undefined
  /** The memory shown is the crow's demonstration, not the robot's own:
   *  framed dashed and tagged with the crow's name, as the console
   *  frames the crow's demonstration line. */
  demo?: boolean | undefined
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
      className={`memory ${empty ? 'empty' : ''} ${demo ? 'demo' : ''}`}
      data-testid="memory"
      data-picked={picked ? 'yes' : 'no'}
      data-demo={demo ? 'yes' : undefined}
    >
      <MemoryGraph
        snapshot={snapshot}
        handles={handles}
        runKey={runKey}
        picked={picked}
        onPick={setPicked}
        marked={marked}
      />
      {demo && (
        <div className="memory-demo-frame" data-testid="memory-demo">
          <DemoTag />
          <p className="sr-only">This is {CROW_NAME}'s example of a memory, not the robot's own.</p>
        </div>
      )}
      {empty && look === 'v2' && <EmptyBank text={emptyText ?? 'Memory is empty.'} />}
      {empty && look !== 'v2' && (
        <p className="memory-empty">
          {emptyText ?? 'Nothing kept yet. The robot lets each thought go, and what it keeps shows up here.'}
        </p>
      )}
    </div>
  )
}

/**
 * An empty memory, drawn: rows of empty sockets, a name's socket wired to
 * an object's, in the places the grid will put them (names in the first
 * column, each name's object beside it). What memory will hold is shown
 * by the shape of where it will go; the sentence is for a screen reader.
 */
function EmptyBank({ text }: { text: string }) {
  return (
    <div className="bank-empty" data-testid="memory-empty">
      <p className="sr-only">{text}</p>
      <div className="sockets" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="socket-row" style={{ ['--i' as string]: i }}>
            <span className="socket name" />
            <span className="wire" />
            <span className="socket object" />
          </div>
        ))}
      </div>
    </div>
  )
}
