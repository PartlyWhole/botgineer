/**
 * (C) The memory panel.
 *
 * One live field, not two boxes and a stage. Names and objects are nodes;
 * bindings and pointers are edges; picking something flies the camera to
 * frame it with everything it touches. There is no second view to switch
 * to, because switching views is what made the old panel disjoint: you
 * lost sight of the clouds exactly when you wanted to see where the thing
 * you picked sat in them.
 *
 * All this component owns is the handles, the selection, and one line of
 * text summarising it. The graph owns everything else.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  holdersOf,
  namesFor,
  orderedObjectIds,
  type MemorySnapshot,
  type ObjectId,
} from '../memory/model'
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

  // A selection the program no longer has would linger as a dead caption.
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
      <p className="caption" data-testid="caption">
        {caption(snapshot, handles, picked, objectCount)}
      </p>
    </div>
  )
}

/**
 * One line, and a summary rather than a copy of the graph. The graph
 * already shows *which* things are connected; this says how many, which
 * is the thing a picture of a hub is bad at.
 */
function caption(
  snapshot: MemorySnapshot,
  handles: Map<ObjectId, string>,
  picked: GraphPick,
  objectCount: number,
): string {
  if (picked === null) {
    return `${snapshot.bindings.length} name${plural(snapshot.bindings.length)} and ${objectCount} object${plural(objectCount)}. Drag to rearrange, click to follow a connection.`
  }

  if (picked.kind === 'name') {
    const binding = snapshot.bindings.find(
      (b) => b.name === picked.name && b.scope === picked.scope,
    )
    const object = binding ? snapshot.objects[binding.target] : undefined
    if (!object) return `${picked.name} points at nothing the robot can show.`
    return `${picked.name} points at ${handles.get(object.id)} — ${object.type} ${object.repr}.`
  }

  const object = snapshot.objects[picked.id]
  if (!object) return 'That object is gone.'
  const out = object.elements?.length ?? 0
  const names = namesFor(snapshot, picked.id).length
  const holders = holdersOf(snapshot, picked.id).length
  const inbound = names + holders
  const kind =
    object.kind === 'value'
      ? 'an immutable value — equal values are one object here'
      : 'an object with its own identity'

  return [
    `${handles.get(object.id)} is ${kind}.`,
    object.elements === null
      ? ''
      : `Points at ${out} object${plural(out)}.`,
    `Pointed at by ${inbound} thing${plural(inbound)}` +
      (names > 0 ? ` (${names} name${plural(names)})` : '') +
      '.',
    object.partial ? 'The robot could not show all of it.' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

const plural = (n: number) => (n === 1 ? '' : 's')
