/**
 * Memory as one live field.
 *
 * There is no second view. Names and objects are nodes in a single graph,
 * bindings and pointers are edges, and picking something does not open a
 * panel — the **camera** flies to frame that node together with everything
 * it is connected to. Zooming in *is* the detail view.
 *
 * Two layers share one camera transform: an SVG layer for the edges and a
 * DOM layer for the pills. Text stays real text — selectable, styleable,
 * and reachable by a screen reader — while the arrows get to be SVG.
 *
 * The animation loop writes `transform` straight to the elements. React
 * renders the graph's *shape*; it is never asked to render its motion.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  approach,
  cameraDistance,
  disturb,
  frame,
  makeNode,
  relax,
  RELAX_BUDGET,
  RELAX_REST,
  seed,
  svgTransformOf,
  tick,
  toWorld,
  transformOf,
  trimTo,
  type Camera,
  type Graph,
  type GraphEdge,
  type GraphNode,
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
}

const nameId = (scope: string, name: string) => `n:${scope}:${name}`
/** Joins the two ends of an edge into one key. A NUL byte was
 *  invisible in tooling; object ids never contain a pipe. */
const EDGE_SEP = '|'
const DRAG_SLOP = 4

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export function MemoryGraph({ snapshot, handles, runKey, picked, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const worldRef = useRef<HTMLDivElement | null>(null)
  const edgeLayerRef = useRef<SVGGElement | null>(null)
  const pillRefs = useRef(new Map<string, HTMLButtonElement>())
  const edgeRefs = useRef(new Map<string, SVGPathElement>())
  const labelRefs = useRef(new Map<string, SVGTextElement>())

  const graphRef = useRef<Graph>({ nodes: [], edges: [], alpha: 0 })
  const byId = useRef(new Map<string, GraphNode>())
  const viewport = useRef<Viewport>({ w: 800, h: 300 })
  const camera = useRef<Camera>({ x: 400, y: 150, k: 1 })
  const target = useRef<Camera>({ x: 400, y: 150, k: 1 })
  const raf = useRef<number | null>(null)
  /** Collision-only frames still owed to the field after `alpha` dies.
   *  Refilled by every `wake`, spent by the loop, and bounded so a pile-up
   *  that cannot resolve still comes to a stop. */
  const relaxLeft = useRef(0)
  /** Which nodes the camera is framing. Held in a ref so the loop can
   *  re-aim as they move: a target computed once at pick time describes
   *  where they were, and the field is usually still settling. */
  const framedIds = useRef<Set<string> | null>(null)
  const run = useRef(runKey)
  const [, bump] = useState(0)

  /* ------------------------------ the shape ------------------------------ */

  const model = useMemo(() => {
    const nodes: { id: string; kind: 'name' | 'object' }[] = []
    const edges: GraphEdge[] = []

    for (const b of snapshot.bindings) {
      nodes.push({ id: nameId(b.scope, b.name), kind: 'name' })
      edges.push({ from: nameId(b.scope, b.name), to: `o:${b.target}`, label: null })
    }
    for (const o of Object.values(snapshot.objects)) {
      nodes.push({ id: `o:${o.id}`, kind: 'object' })
      for (const e of o.elements ?? []) {
        edges.push({ from: `o:${o.id}`, to: `o:${e.target}`, label: e.label })
      }
    }
    return { nodes, edges }
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

  /* ------------------------------ the motion ------------------------------ */

  /** Re-reads pill sizes from the DOM. A picked node grows, and a layout
   *  working from stale sizes lets it sit on top of its own neighbours —
   *  covering the connection that picking it was meant to reveal. */
  const measure = useCallback(() => {
    for (const [id, el] of pillRefs.current) {
      const n = byId.current.get(id)
      if (!n) continue
      // A hidden view reports zero. Keeping the last real size is right:
      // measuring zero would collapse every node and the layout with it.
      if (el.offsetWidth === 0) continue
      n.w = el.offsetWidth
      n.h = el.offsetHeight
    }
  }, [])

  const paint = useCallback(() => {
    const world = worldRef.current
    const layer = edgeLayerRef.current
    const v = viewport.current
    const t = transformOf(camera.current, v)
    if (world) world.style.transform = t
    if (layer) layer.setAttribute('transform', svgTransformOf(camera.current, v))

    for (const [id, el] of pillRefs.current) {
      const n = byId.current.get(id)
      if (n) el.style.transform = `translate(${n.x}px, ${n.y}px) translate(-50%, -50%)`
    }

    for (const [key, path] of edgeRefs.current) {
      const [from, to] = key.split(EDGE_SEP)
      const a = byId.current.get(from!)
      const b = byId.current.get(to!)
      if (!a || !b) continue
      const end = trimTo(a, b)
      path.setAttribute('d', `M ${a.x} ${a.y} L ${end.x} ${end.y}`)
      const label = labelRefs.current.get(key)
      if (label) {
        label.setAttribute('x', String((a.x + end.x) / 2))
        label.setAttribute('y', String((a.y + end.y) / 2 - 5))
      }
    }
  }, [])

  const loop = useCallback(() => {
    if (raf.current !== null) return
    const step = () => {
      const g = graphRef.current
      const v = viewport.current
      let busy = false
      if (g.alpha > 0) {
        tick(g, v)
        busy = true
      } else if (relaxLeft.current > 0) {
        // The forces are spent but pills may still be sitting on each
        // other. Collision is positional and unscaled precisely so it can
        // carry on here; the budget is what guarantees this still stops.
        relaxLeft.current--
        if (relax(g) > RELAX_REST) busy = true
        else relaxLeft.current = 0
      }
      if (busy) {
        const want = framedIds.current
        const subject = want === null ? g.nodes : g.nodes.filter((n) => want.has(n.id))
        target.current = frame(subject.length > 0 ? subject : g.nodes, v)
      }
      const far = cameraDistance(camera.current, target.current, v) > 0.6
      if (far) camera.current = approach(camera.current, target.current)
      paint()
      if (busy || far) {
        raf.current = requestAnimationFrame(step)
      } else {
        raf.current = null
      }
    }
    raf.current = requestAnimationFrame(step)
  }, [paint])

  /** Give the field energy *and* refill the collision budget. Every reason
   *  to re-energise the field is also a reason overlap may reappear, so the
   *  two always travel together. */
  const wake = useCallback(
    (to: number) => {
      disturb(graphRef.current, to)
      relaxLeft.current = RELAX_BUDGET
      loop()
    },
    [loop],
  )

  const aim = useCallback(
    (nodes: GraphNode[], ids: Set<string> | null) => {
      framedIds.current = ids
      target.current = frame(nodes, viewport.current)
      if (reduced()) camera.current = target.current
      loop()
    },
    [loop],
  )

  /* --------------------------- reconcile & measure --------------------------- */

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    // Same reason: a hidden view has no size, and a zero viewport would
    // seed every node on top of every other.
    if (host.clientWidth > 0) viewport.current = { w: host.clientWidth, h: host.clientHeight }

    // A new run is a new memory: positions and camera start over.
    if (run.current !== runKey) {
      run.current = runKey
      byId.current.clear()
      graphRef.current = { nodes: [], edges: [], alpha: 0 }
    }

    const live = new Set(model.nodes.map((n) => n.id))
    for (const id of [...byId.current.keys()]) if (!live.has(id)) byId.current.delete(id)

    const fresh: GraphNode[] = []
    for (const spec of model.nodes) {
      let n = byId.current.get(spec.id)
      if (!n) {
        n = makeNode(spec.id, spec.kind)
        byId.current.set(spec.id, n)
        fresh.push(n)
      }
      const el = pillRefs.current.get(spec.id)
      if (el && el.offsetWidth > 0) {
        n.w = el.offsetWidth
        n.h = el.offsetHeight
      }
    }

    const g: Graph = {
      nodes: [...byId.current.values()],
      edges: model.edges,
      alpha: graphRef.current.alpha,
    }
    graphRef.current = g

    if (fresh.length === g.nodes.length) {
      // First fill: lay the whole field out and frame it.
      seed(g, viewport.current)
      relaxLeft.current = RELAX_BUDGET
      disturb(g, 1)
      aim(g.nodes, null)
    } else if (fresh.length > 0) {
      // Newcomers drop into their lane and the field makes room.
      seed({ nodes: fresh, edges: [], alpha: 1 }, viewport.current)
      wake(0.6)
    } else {
      loop()
    }
    paint()
  }, [aim, loop, model, paint, runKey])

  // Picking moves the camera, and nothing else changes place.
  useLayoutEffect(() => {
    const g = graphRef.current
    if (g.nodes.length === 0) return
    if (near === null) {
      measure()
      wake(0.3)
      aim(g.nodes, null)
      return
    }
    measure()
    const subject = g.nodes.filter((n) => near.has(n.id))
    aim(subject.length > 0 ? subject : g.nodes, near)
    // The picked pill just changed size, so the field has to make room.
    wake(0.4)
  }, [aim, measure, near])

  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      viewport.current = { w: host.clientWidth, h: host.clientHeight }
      wake(0.3)
      aim(
        near === null
          ? graphRef.current.nodes
          : graphRef.current.nodes.filter((n) => near.has(n.id)),
        near,
      )
    })
    ro.observe(host)
    return () => ro.disconnect()
  }, [aim, near])

  useEffect(
    () => () => {
      if (raf.current === null) return
      cancelAnimationFrame(raf.current)
      // Clearing the handle is the whole point. React's dev double-invoke
      // tears these effects down and runs them again against the *same*
      // refs, so a handle left behind makes `loop`'s re-entry guard reject
      // every later start: the field never ticks, and what you see is the
      // seed positions painted once. That is a dev-only wedge, which is
      // why the production browser tests never caught it.
      raf.current = null
    },
    [],
  )

  /* ------------------------------- dragging ------------------------------- */

  const onPointerDown = (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const node = byId.current.get(id)
    const host = hostRef.current
    if (!node || !host) return

    const start = { x: e.clientX, y: e.clientY }
    let dragged = false
    node.fixed = true
    e.currentTarget.setPointerCapture(e.pointerId)

    const move = (ev: PointerEvent) => {
      if (!dragged && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_SLOP) return
      dragged = true
      host.classList.add('dragging-node')
      const box = host.getBoundingClientRect()
      const w = toWorld(ev.clientX - box.left, ev.clientY - box.top, camera.current, viewport.current)
      node.x = w.x
      node.y = w.y
      // Neighbours respond while the node is still moving.
      wake(0.35)
    }

    const up = () => {
      host.classList.remove('dragging-node')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (dragged) {
        // Dropped nodes stay put and the field arranges around them.
        // Releasing them back to the simulation sent them home, which
        // makes dragging pointless.
        wake(0.4)
        bump((n) => n + 1)
      } else {
        node.fixed = false
        pick(id)
      }
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

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

  const loosen = () => {
    for (const n of byId.current.values()) n.fixed = false
    wake(0.8)
    bump((n) => n + 1)
  }

  const anyPinned = [...byId.current.values()].some((n) => n.fixed)

  /* ------------------------------- rendering ------------------------------- */

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
            const key = `${e.from}${EDGE_SEP}${e.to}`
            const lit = pickedId !== null && (e.from === pickedId || e.to === pickedId)
            return (
              <g key={`${key}:${e.label ?? ''}`} className={`edge ${lit ? 'lit' : ''}`}>
                <path
                  ref={(el) => {
                    if (el) edgeRefs.current.set(key, el)
                    else edgeRefs.current.delete(key)
                  }}
                  markerEnd="url(#tip)"
                />
                {lit && e.label !== null && (
                  <text
                    ref={(el) => {
                      if (el) labelRefs.current.set(key, el)
                      else labelRefs.current.delete(key)
                    }}
                    className="edge-label"
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
        {model.nodes.map((spec) => (
          <Pill
            key={spec.id}
            spec={spec}
            snapshot={snapshot}
            handles={handles}
            picked={pickedId === spec.id}
            dimmed={near !== null && !near.has(spec.id)}
            onPointerDown={onPointerDown(spec.id)}
            onKeyPick={() => pick(spec.id)}
            register={(el) => {
              if (el) pillRefs.current.set(spec.id, el)
              else pillRefs.current.delete(spec.id)
            }}
          />
        ))}
      </div>

      {anyPinned && (
        <button type="button" className="loosen" onClick={loosen} data-testid="loosen">
          loosen
        </button>
      )}
    </div>
  )
}

function Pill({
  spec,
  snapshot,
  handles,
  picked,
  dimmed,
  onPointerDown,
  onKeyPick,
  register,
}: {
  spec: { id: string; kind: 'name' | 'object' }
  snapshot: MemorySnapshot
  handles: Map<ObjectId, string>
  picked: boolean
  dimmed: boolean
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void
  onKeyPick: () => void
  register: (el: HTMLButtonElement | null) => void
}) {
  const common = {
    ref: register,
    type: 'button' as const,
    className: '',
    onPointerDown,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onKeyPick()
      }
    },
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
    >
      <span className="handle">{handles.get(id)}</span>
      <span className="type">{object.type}</span>
      <span className="repr">{object.repr}</span>
      {picked && object.partial && <span className="partial">partial</span>}
    </button>
  )
}
