/**
 * Memory, drawn as a grid.
 *
 * Names in a column on the left, each one's object beside it, and a
 * collection's elements to the right of it in index order — see
 * `graphLayout` for the placement and for why it replaced a force layout.
 * Bindings and pointers are curved arrows.
 *
 * There is still no second view. Picking something does not open a panel:
 * the **camera** flies to frame that node together with everything it is
 * connected to, and everything else dims where it stands. Nothing moves
 * because you picked it. Zooming in *is* the detail view.
 *
 * Two layers share one camera transform: an SVG layer for the arrows and a
 * DOM layer for the cards. Text stays real text — selectable, styleable,
 * and reachable by a screen reader — while the arrows get to be SVG.
 *
 * React renders the graph's *shape*. The animation loop writes positions
 * straight to the elements as they ease to where the placement put them;
 * React is never asked to render the motion.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  approach,
  cameraDistance,
  curve,
  ease,
  frame,
  orderNames,
  overview,
  place,
  scrolled,
  slotLabel,
  svgTransformOf,
  transformOf,
  type Camera,
  type LayoutInput,
  type Size,
  type Viewport,
} from './graphLayout'
import type { MemorySnapshot, ObjectId } from '../memory/model'

export type GraphPick = { kind: 'name'; name: string; scope: string } | { kind: 'object'; id: ObjectId } | null

type Props = {
  snapshot: MemorySnapshot
  handles: Map<ObjectId, string>
  /** Reset positions and camera when a new run begins. */
  runKey: string
  picked: GraphPick
  onPick: (pick: GraphPick) => void
  /**
   * Frame everything, always. For a thumbnail — one of a reading
   * exercise's pictures to choose from — which is small, never grows and
   * is never picked in: the one place where fitting the content is right.
   * The memory panel never fits (invariant 15): there, the zoom depends on
   * the pane alone, so nothing moves when a line adds something.
   */
  fit?: boolean
}

type Edge = { from: string; to: string; label: string | null; key: string }

const nameId = (scope: string, name: string) => `n:${scope}:${name}`

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** Where a node is drawn now, where it is going, and how big it is. */
type Body = { x: number; y: number; tx: number; ty: number; w: number; h: number }

export function MemoryGraph({ snapshot, handles, runKey, picked, onPick, fit = false }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const worldRef = useRef<HTMLDivElement | null>(null)
  const edgeLayerRef = useRef<SVGGElement | null>(null)
  const pillRefs = useRef(new Map<string, HTMLButtonElement>())
  const edgeRefs = useRef(new Map<string, SVGPathElement>())
  const labelRefs = useRef(new Map<string, SVGTextElement>())

  const bodies = useRef(new Map<string, Body>())
  /** Card sizes, measured unpicked. A picked card grows in place, and if
   *  the placement used its grown size every column would widen and the
   *  whole grid would shift — picking would move the layout, which is the
   *  one thing it must not do. */
  const sizes = useRef(new Map<string, Size>())
  /** When each name was first seen, for the whole run. The name column's
   *  order is this, so a rebound name keeps its row. */
  const seen = useRef(new Map<string, number>())
  const viewport = useRef<Viewport>({ w: 800, h: 300 })
  const camera = useRef<Camera>({ x: 400, y: 150, k: 1 })
  const target = useRef<Camera>({ x: 400, y: 150, k: 1 })
  const raf = useRef<number | null>(null)
  const run = useRef(runKey)

  /* ------------------------------ the shape ------------------------------ */

  const model = useMemo(() => {
    const names = snapshot.bindings.map((b) => ({
      id: nameId(b.scope, b.name),
      scope: b.scope,
      target: `o:${b.target}`,
    }))
    const objects = Object.values(snapshot.objects).map((o) => `o:${o.id}`)
    const children = new Map<string, string[]>()
    /** The widest slot label into each object, for the gap in front of it. */
    const labelW = new Map<string, number>()
    const edges: Edge[] = []
    for (const n of names) edges.push({ from: n.id, to: n.target, label: null, key: `${n.id}>${n.target}` })
    for (const o of Object.values(snapshot.objects)) {
      const kids = (o.elements ?? []).map((e) => `o:${e.target}`)
      children.set(`o:${o.id}`, kids)
      // Slots of this collection that hold the same object are one arrow
      // drawn twice, so the first carries all their labels: `0, 2`.
      const shared = new Map<string, string[]>()
      for (const e of o.elements ?? []) if (e.label !== null) shared.set(e.target, [...(shared.get(e.target) ?? []), e.label])
      ;(o.elements ?? []).forEach((e, i) => {
        // Keyed by slot, not by target: `[1, 1]` is two pointers at one
        // object, and both arrows have to exist.
        const first = (o.elements ?? []).findIndex((x) => x.target === e.target) === i
        const label = e.label === null || !first ? null : slotLabel(shared.get(e.target)!.join(', '))
        edges.push({ from: `o:${o.id}`, to: `o:${e.target}`, label: label?.text ?? null, key: `o:${o.id}#${i}` })
        if (label) labelW.set(`o:${e.target}`, Math.max(labelW.get(`o:${e.target}`) ?? 0, label.w))
      })
    }
    return { names, objects, children, labelW, edges }
  }, [snapshot])

  const pickedId =
    picked === null
      ? null
      : picked.kind === 'name'
        ? nameId(picked.scope, picked.name)
        : `o:${picked.id}`

  /** Everything one edge away from the picked node, plus itself. */
  const near = useMemo(() => {
    if (pickedId === null) return null
    const ids = new Set<string>([pickedId])
    for (const e of model.edges) {
      if (e.from === pickedId) ids.add(e.to)
      if (e.to === pickedId) ids.add(e.from)
    }
    return ids
  }, [model.edges, pickedId])
  const nearRef = useRef(near)
  nearRef.current = near

  /* ------------------------------ the motion ------------------------------ */

  const edgesRef = useRef(model.edges)
  edgesRef.current = model.edges

  const paint = () => {
    const v = viewport.current
    if (worldRef.current) worldRef.current.style.transform = transformOf(camera.current, v)
    edgeLayerRef.current?.setAttribute('transform', svgTransformOf(camera.current, v))

    for (const [id, el] of pillRefs.current) {
      const b = bodies.current.get(id)
      if (b) el.style.transform = `translate(${b.x}px, ${b.y}px) translate(-50%, -50%)`
    }
    for (const e of edgesRef.current) {
      const path = edgeRefs.current.get(e.key)
      const a = bodies.current.get(e.from)
      const b = bodies.current.get(e.to)
      if (!path || !a || !b) continue
      const c = curve(a, b)
      path.setAttribute('d', c.d)
      const label = labelRefs.current.get(e.key)
      if (label) {
        label.setAttribute('x', String(c.label.x))
        label.setAttribute('y', String(c.label.y))
        label.setAttribute('text-anchor', c.label.anchor)
      }
    }
  }
  const paintRef = useRef(paint)
  paintRef.current = paint

  /** Runs until every node has arrived and the camera with them. */
  const loop = () => {
    if (raf.current !== null) return
    const step = () => {
      let moving = false
      for (const b of bodies.current.values()) {
        const to = { x: b.tx, y: b.ty }
        if (ease(b, to) > 0) moving = true
      }
      const v = viewport.current
      const far = cameraDistance(camera.current, target.current, v) > 0.6
      camera.current = far ? approach(camera.current, target.current) : target.current
      paintRef.current()
      raf.current = moving || far ? requestAnimationFrame(step) : null
    }
    raf.current = requestAnimationFrame(step)
  }
  const loopRef = useRef(loop)
  loopRef.current = loop

  /** Where the overview was last looking, so a new line or an unpick
   *  comes back to the same part of a memory too tall to show at once. */
  const scroll = useRef<{ x: number; y: number } | null>(null)

  const boxes = (ids: Set<string> | null) =>
    [...bodies.current.entries()]
      .filter(([id]) => ids === null || ids.has(id))
      .map(([, b]) => ({ x: b.tx, y: b.ty, w: b.w, h: b.h }))

  /** Frames the picked node's neighbourhood, or the overview. Aimed at
   *  where the nodes are *going*, so the camera heads straight for the
   *  final picture instead of chasing the tween. `reveal` are nodes that
   *  just arrived, which the overview scrolls to if it has to. */
  const aim = (reveal: string[] = []) => {
    const ids = nearRef.current
    if (fit) {
      target.current = frame(boxes(null), viewport.current, 16, 1)
    } else if (ids === null) {
      const show = boxes(new Set(reveal))
      target.current = overview(boxes(null), viewport.current, scroll.current, show)
      scroll.current = { x: target.current.x, y: target.current.y }
    } else {
      target.current = frame(boxes(ids), viewport.current, 60)
    }
    if (reduced()) camera.current = target.current
  }
  const aimRef = useRef(aim)
  aimRef.current = aim

  /* ------------------------------ placement ------------------------------ */

  useLayoutEffect(() => {
    const host = hostRef.current
    if (host && host.clientWidth > 0) viewport.current = { w: host.clientWidth, h: host.clientHeight }

    // A new run is a new memory: order and positions start over.
    const fresh = run.current !== runKey
    if (fresh) {
      run.current = runKey
      bodies.current.clear()
      seen.current.clear()
    }

    // Measure before placing: a column is as wide as its widest card.
    for (const [id, el] of pillRefs.current) {
      if (id === pickedId) continue
      // A hidden view reports zero; keeping the last real size is right.
      if (el.offsetWidth > 0) sizes.current.set(id, { w: el.offsetWidth, h: el.offsetHeight })
    }

    const input: LayoutInput = {
      names: orderNames(model.names, seen.current),
      children: model.children,
      labelW: model.labelW,
    }
    const placed = place(input, sizes.current)

    const live = new Set(placed.keys())
    for (const id of [...bodies.current.keys()]) if (!live.has(id)) bodies.current.delete(id)

    const first = bodies.current.size === 0
    if (first) scroll.current = null
    const arrived: string[] = []
    const snap = reduced()
    for (const [id, p] of placed) {
      const s = sizes.current.get(id) ?? { w: 70, h: 26 }
      const b = bodies.current.get(id)
      if (b) {
        b.tx = p.x
        b.ty = p.y
        b.w = s.w
        b.h = s.h
        if (snap) {
          b.x = p.x
          b.y = p.y
        }
      } else {
        // A newcomer appears where it belongs — it fades in there (CSS),
        // rather than flying in from somewhere it never was.
        bodies.current.set(id, { x: p.x, y: p.y, tx: p.x, ty: p.y, ...s })
        arrived.push(id)
      }
    }

    aimRef.current(first ? [] : arrived)
    if (first) camera.current = target.current
    paintRef.current()
    loopRef.current()
  }, [model, runKey, pickedId])

  // Picking moves the camera, and nothing else changes place.
  useLayoutEffect(() => {
    aimRef.current()
    loopRef.current()
  }, [near])

  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (host.clientWidth === 0) return
      viewport.current = { w: host.clientWidth, h: host.clientHeight }
      aimRef.current()
      loopRef.current()
    })
    ro.observe(host)

    // A memory taller than the pane scrolls. Not passive, because the page
    // must not scroll along with it.
    const onWheel = (e: WheelEvent) => {
      if (nearRef.current !== null) return
      const next = scrolled(target.current, e.deltaX, e.deltaY, boxes(null), viewport.current)
      if (next.x === target.current.x && next.y === target.current.y) return
      e.preventDefault()
      target.current = next
      camera.current = next
      scroll.current = { x: next.x, y: next.y }
      loopRef.current()
    }
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      host.removeEventListener('wheel', onWheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      if (raf.current === null) return
      cancelAnimationFrame(raf.current)
      // Clearing the handle is the whole point. React's dev double-invoke
      // tears these effects down and runs them again against the *same*
      // refs, so a handle left behind makes `loop`'s re-entry guard reject
      // every later start and nothing would ever move again.
      raf.current = null
    },
    [],
  )

  const pick = (id: string) => {
    if (id === pickedId) {
      onPick(null)
      return
    }
    if (id.startsWith('n:')) {
      const rest = id.slice(2)
      const cut = rest.indexOf(':')
      onPick({ kind: 'name', scope: rest.slice(0, cut), name: rest.slice(cut + 1) })
    } else {
      onPick({ kind: 'object', id: id.slice(2) })
    }
  }

  /* ------------------------------- rendering ------------------------------- */

  const nodes = [
    ...model.names.map((n) => ({ id: n.id, kind: 'name' as const })),
    ...model.objects.map((id) => ({ id, kind: 'object' as const })),
  ]

  return (
    <div
      className={`graph ${picked ? 'has-pick' : ''}`}
      ref={hostRef}
      data-testid="graph"
      data-picked={pickedId ?? ''}
      onPointerDown={(e) => {
        // A press on the background clears the selection.
        if (e.target === hostRef.current) onPick(null)
      }}
    >
      <svg className="edges" aria-hidden="true">
        <defs>
          <marker id="tip" markerWidth="8" markerHeight="8" refX="6.5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" />
          </marker>
        </defs>
        <g ref={edgeLayerRef}>
          {model.edges.map((e) => {
            const lit = pickedId !== null && (e.from === pickedId || e.to === pickedId)
            return (
              <g key={e.key} className={`edge ${lit ? 'lit' : ''}`}>
                <path
                  ref={(el) => {
                    if (el) edgeRefs.current.set(e.key, el)
                    else edgeRefs.current.delete(e.key)
                  }}
                  markerEnd="url(#tip)"
                />
                {/* Always drawn: an index or a key is what the slot
                    is, not a detail for when it is picked. Quiet until
                    its arrow is lit. */}
                {e.label !== null && (
                  <text
                    ref={(el) => {
                      if (el) labelRefs.current.set(e.key, el)
                      else labelRefs.current.delete(e.key)
                    }}
                    className="edge-label"
                    data-testid="slot-label"
                  >
                    {e.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="world" ref={worldRef}>
        {nodes.map((spec) => (
          <Pill
            key={spec.id}
            spec={spec}
            snapshot={snapshot}
            handles={handles}
            picked={pickedId === spec.id}
            dimmed={near !== null && !near.has(spec.id)}
            onPick={() => pick(spec.id)}
            register={(el) => {
              if (el) pillRefs.current.set(spec.id, el)
              else pillRefs.current.delete(spec.id)
            }}
          />
        ))}
      </div>
    </div>
  )
}

function Pill({
  spec,
  snapshot,
  handles,
  picked,
  dimmed,
  onPick,
  register,
}: {
  spec: { id: string; kind: 'name' | 'object' }
  snapshot: MemorySnapshot
  handles: Map<ObjectId, string>
  picked: boolean
  dimmed: boolean
  onPick: () => void
  register: (el: HTMLButtonElement | null) => void
}) {
  const common = {
    ref: register,
    type: 'button' as const,
    className: '',
    // A button already answers Enter and Space with a click.
    onClick: onPick,
    'aria-pressed': picked,
  }

  if (spec.kind === 'name') {
    const rest = spec.id.slice(2)
    const cut = rest.indexOf(':')
    const scope = rest.slice(0, cut)
    const name = rest.slice(cut + 1)
    return (
      <button
        {...common}
        className={`node name ${picked ? 'picked' : ''} ${dimmed ? 'dimmed' : ''}`}
        data-testid={`node-${name}`}
      >
        {scope !== 'global' && <span className="scope">{scope}</span>}
        {name}
      </button>
    )
  }

  const id = spec.id.slice(2)
  const object = snapshot.objects[id]
  if (!object) return null

  return (
    <button
      {...common}
      className={`node object ${object.kind} ${picked ? 'picked' : ''} ${dimmed ? 'dimmed' : ''}`}
      data-testid={`node-${id}`}
      data-type={object.type}
      // The pill caps a long repr with an ellipsis, so the whole of it has
      // to stay reachable somewhere.
      title={`${handles.get(id)} · ${object.type} ${object.repr}`}
      aria-label={`${object.repr}, ${object.type}, ${handles.get(id)}`}
    >
      {/* A top strip for the bookkeeping, then the value.
          
          The strip is in flow and its height is reserved, so the handle
          can appear and disappear without the card changing size — which
          it must not, because the layout measures these pills. The
          previous attempt positioned the handle absolutely to get the
          same guarantee and had it land on top of the value instead. */}
      <span className="meta" aria-hidden="true">
        <span className="handle">{handles.get(id)}</span>
        <span className="type">{object.type}</span>
      </span>
      <span className="repr">{object.repr}</span>
      {picked && object.partial && <span className="partial">partial</span>}
    </button>
  )
}
