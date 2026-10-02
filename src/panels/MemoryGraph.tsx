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
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  along,
  approach,
  beside,
  cameraDistance,
  curve,
  ease,
  frame,
  hidden,
  LEAVE_MS,
  lerpBox,
  orderNames,
  overview,
  place,
  REPLACE_CREEP,
  REPLACE_MS,
  REPLACE_WAIT,
  scrolled,
  SLIDE,
  SLIDE_MS,
  slotLabel,
  spread,
  svgTransformOf,
  swing,
  SWING_TO,
  transformOf,
  type Box,
  type Camera,
  type LayoutInput,
  type Trip,
  type Size,
  type Viewport,
} from './graphLayout'
import type { MemorySnapshot, ObjectId, PyObject } from '../memory/model'

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
  /**
   * Names to mark: their pills, the arrows from them and the objects they
   * point at wear a glow ring, the way a beat's `focus` pulses a pane.
   * Paint only — a ring is a shadow outside the card, so nothing is
   * measured differently, nothing moves and the camera stays (invariants
   * 15–17). Every scope's binding of a marked name is marked.
   */
  marked?: readonly string[] | undefined
}

/** Screen pixels of memory off an edge before the pane says so: a card's
 *  shadow or a sliver of padding is not "more". */
const EDGE_SLACK = 6

type Edge = { from: string; to: string; label: string | null; key: string }

const nameId = (scope: string, name: string) => `n:${scope}:${name}`

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** Where a node is drawn now, where it is going, and how big it is. A
 *  newcomer on its way in has a `trip`, timed, instead of the ease. */
type Body = { x: number; y: number; tx: number; ty: number; w: number; h: number; trip?: Trip }

/** A card whose object has just left memory, drawn where it stood while it
 *  fades (`graphLayout`, comings and goings). Not a node: nothing points at
 *  it, the camera does not frame it, and it cannot be picked or reached. */
type Ghost = { key: string; id: string; object: PyObject; handle: string; box: Box; until: number }

/** An arrow moving to a new target: where it is leaving from (a ghost's
 *  box, or a node still in memory), and since when. */
type Swing = { from: string; box: Box | null; t0: number }

const now = () => performance.now()

export function MemoryGraph({ snapshot, handles, runKey, picked, onPick, fit = false, marked }: Props) {
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

  /** Cards that just left memory, still drawn. React state, because they
   *  are elements the snapshot no longer has. */
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const ghostTimers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const swings = useRef(new Map<string, Swing>())
  /** What each arrow pointed at, and the objects, as last drawn: what a
   *  departure and a swing are measured against. Null until this run has
   *  drawn once, so the first picture simply appears. */
  const last = useRef<{ targets: Map<string, string>; objects: MemorySnapshot['objects'] } | null>(null)
  /** Until when something is arriving, leaving or swinging, so the loop
   *  keeps painting. */
  const busyUntil = useRef(0)

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
    // Keyed by the name alone, so a rebinding is the same arrow moving to
    // its new object (it swings, `Swing`), not one arrow going and another
    // fading in where it was.
    for (const n of names) edges.push({ from: n.id, to: n.target, label: null, key: `${n.id}>` })
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
  /** The marked names' pills and the objects they point at. */
  const markKey = (marked ?? []).join('\u0000')
  const marks = useMemo(() => {
    const want = new Set(markKey === '' ? [] : markKey.split('\u0000'))
    const ids = new Set<string>()
    for (const b of snapshot.bindings) {
      if (!want.has(b.name)) continue
      ids.add(nameId(b.scope, b.name))
      ids.add(`o:${b.target}`)
    }
    return ids
  }, [snapshot, markKey])

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
    // Every card is something an arrow must not pass through.
    const cards = [...bodies.current.values()]
    const labels: { el: SVGTextElement; x: number; y: number; w: number; anchor: string }[] = []
    const t = now()
    for (const e of edgesRef.current) {
      const path = edgeRefs.current.get(e.key)
      const a = bodies.current.get(e.from)
      let b: Box | undefined = bodies.current.get(e.to)
      if (!path || !a || !b) continue
      const sw = swings.current.get(e.key)
      if (sw) {
        const p = swing(t - sw.t0)
        const from = sw.box ?? bodies.current.get(sw.from)
        if (p >= 1 || !from) swings.current.delete(e.key)
        else b = lerpBox(from, b, p)
      }
      const c = curve(a, b, cards)
      path.setAttribute('d', c.d)
      const label = labelRefs.current.get(e.key)
      if (label && e.label !== null) labels.push({ el: label, ...c.label, w: slotLabel(e.label).w })
    }
    // And no label stands on another.
    const ys = spread(labels)
    labels.forEach((l, i) => {
      l.el.setAttribute('x', String(l.x))
      l.el.setAttribute('y', String(ys[i]))
      l.el.setAttribute('text-anchor', l.anchor)
    })
    // Whether memory runs off either side of the pane, for the fade and
    // the `more` button at that edge. Of where the camera is *going*, so
    // the cue does not flicker while it travels; and only for the
    // overview, which is the one view that cuts memory off.
    const host = hostRef.current
    if (host) {
      const off = fit || nearRef.current !== null ? { left: 0, right: 0 } : hidden(target.current, cards, v)
      host.dataset['moreLeft'] = off.left > EDGE_SLACK ? 'yes' : 'no'
      host.dataset['moreRight'] = off.right > EDGE_SLACK ? 'yes' : 'no'
    }
  }
  const paintRef = useRef(paint)
  paintRef.current = paint

  /** Runs until every node has arrived and the camera with them. */
  const loop = () => {
    if (raf.current !== null) return
    const step = () => {
      const t = now()
      let moving = t < busyUntil.current
      for (const b of bodies.current.values()) {
        const to = { x: b.tx, y: b.ty }
        if (b.trip) {
          const at = along(b.trip, to, t)
          b.x = at.x
          b.y = at.y
          if (at.done) delete b.trip
          moving = true
        } else if (ease(b, to) > 0) moving = true
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
      // Something new arrived (a line was typed): back to the names
      // column, which a sideways scroll may have left behind. Only across;
      // down is where the newcomer is revealed.
      if (reveal.length > 0 && scroll.current) scroll.current = { x: -Infinity, y: scroll.current.y }
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
      swings.current.clear()
      last.current = null
      setGhosts((g) => (g.length === 0 ? g : []))
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
    const snap = reduced()
    const t = now()
    // Comings and goings are shown only between two pictures of one run,
    // and never in a thumbnail or under reduced motion.
    const moving = last.current !== null && !snap && !fit
    const left = new Map<string, Ghost>()
    for (const [id, b] of [...bodies.current]) {
      if (live.has(id)) continue
      bodies.current.delete(id)
      const object = last.current?.objects[id.slice(2)]
      if (moving && id.startsWith('o:') && object) {
        left.set(id, {
          key: `${id}@${t}`,
          id,
          object,
          handle: handles.get(object.id) ?? '',
          box: { x: b.x, y: b.y, w: b.w, h: b.h },
          until: t + LEAVE_MS,
        })
      }
    }
    if (moving || left.size > 0) {
      setGhosts((g) => {
        const kept = g.filter((x) => x.until > t && !live.has(x.id) && !left.has(x.id))
        return kept.length === g.length && left.size === 0 ? g : [...kept, ...left.values()]
      })
    }
    if (left.size > 0) {
      const timer = setTimeout(() => {
        ghostTimers.current.delete(timer)
        setGhosts((g) => {
          const kept = g.filter((x) => x.until > now())
          return kept.length === g.length ? g : kept
        })
      }, LEAVE_MS + 20)
      ghostTimers.current.add(timer)
      busyUntil.current = Math.max(busyUntil.current, t + LEAVE_MS)
    }

    // An arrow whose target changed swings from the old one to the new;
    // a new object that replaces one that just left waits beside it.
    const replacing = new Map<string, Box>()
    if (moving) {
      for (const e of model.edges) {
        const was = last.current!.targets.get(e.key)
        if (was === undefined || was === e.to) continue
        const gone = left.get(was)
        swings.current.set(e.key, { from: was, box: gone?.box ?? null, t0: t })
        busyUntil.current = Math.max(busyUntil.current, t + SWING_TO)
        if (gone && !bodies.current.has(e.to) && !replacing.has(e.to)) replacing.set(e.to, gone.box)
      }
    }

    const first = bodies.current.size === 0
    if (first) scroll.current = null
    const arrived: string[] = []
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
        // A newcomer fades in (CSS) close to where it belongs. An object
        // that replaces one that just left starts beside it, so both are
        // seen; any other slides the last few px in from the right, the
        // side the robot's thought comes from. A name just appears.
        const old = replacing.get(id)
        const from = old ? beside(old, s) : { x: p.x + SLIDE, y: p.y }
        const body: Body = { x: p.x, y: p.y, tx: p.x, ty: p.y, ...s }
        if (moving && id.startsWith('o:')) {
          body.x = from.x
          body.y = from.y
          body.trip = old
            ? { ...from, t0: t, dur: REPLACE_MS, wait: REPLACE_WAIT, creep: REPLACE_CREEP }
            : { ...from, t0: t, dur: SLIDE_MS, wait: 0, creep: 0 }
        }
        bodies.current.set(id, body)
        arrived.push(id)
      }
    }

    last.current = {
      targets: new Map(model.edges.map((e) => [e.key, e.to])),
      objects: snapshot.objects,
    }

    aimRef.current(first ? [] : arrived)
    if (first) camera.current = target.current
    paintRef.current()
    loopRef.current()
    // `snapshot` and `handles` are read for what just left; `model` is
    // derived from the snapshot and is the change that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // A phone has no wheel. A sideways swipe pans a memory wider than the
    // pane (the overview never follows a card to the right on its own, so
    // this is how the right of a wide memory is reached); an upright one
    // is left to the page (`touch-action: pan-y`, styles.css), which has to
    // scroll past this pane.
    let swipe: { id: number; x: number } | null = null
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') swipe = { id: e.pointerId, x: e.clientX }
    }
    const onMove = (e: PointerEvent) => {
      if (swipe === null || e.pointerId !== swipe.id || nearRef.current !== null) return
      const next = scrolled(target.current, swipe.x - e.clientX, 0, boxes(null), viewport.current)
      swipe.x = e.clientX
      target.current = next
      camera.current = next
      scroll.current = { x: next.x, y: next.y }
      loopRef.current()
    }
    const onUp = (e: PointerEvent) => {
      if (swipe !== null && e.pointerId === swipe.id) swipe = null
    }
    host.addEventListener('pointerdown', onDown)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerup', onUp)
    host.addEventListener('pointercancel', onUp)
    return () => {
      ro.disconnect()
      host.removeEventListener('wheel', onWheel)
      host.removeEventListener('pointerdown', onDown)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointercancel', onUp)
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
  useEffect(() => {
    const timers = ghostTimers.current
    return () => {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  /** The `more` buttons: most of a pane sideways, eased like any other
   *  camera move, and never past what there is (`scrolled` clamps). */
  const pan = (dir: 1 | -1) => {
    const v = viewport.current
    const next = scrolled(target.current, dir * v.w * 0.7, 0, boxes(null), v)
    target.current = next
    scroll.current = { x: next.x, y: next.y }
    if (reduced()) camera.current = next
    loopRef.current()
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
          {/* A marker's paint is its own, not its arrow's, so a marked
              arrow needs a head of its own to wear the mark. */}
          <marker id="tip-marked" className="tip-marked" markerWidth="8" markerHeight="8" refX="6.5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" />
          </marker>
        </defs>
        <g ref={edgeLayerRef}>
          {model.edges.map((e) => {
            const lit = pickedId !== null && (e.from === pickedId || e.to === pickedId)
            const mark = e.from.startsWith('n:') && marks.has(e.from)
            return (
              <g key={e.key} className={`edge ${lit ? 'lit' : ''} ${mark ? 'marked' : ''}`} data-marked={mark ? 'yes' : undefined}>
                <path
                  ref={(el) => {
                    if (el) edgeRefs.current.set(e.key, el)
                    else edgeRefs.current.delete(e.key)
                  }}
                  markerEnd={mark ? 'url(#tip-marked)' : 'url(#tip)'}
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

      {/* A memory wider than the pane is cut at an edge (the overview
          stays anchored at the left, invariant 15), and a cut with nothing
          to say about it read as all there is. So the cut edge fades, and
          a small button there scrolls the rest into view — the same move a
          sideways wheel or swipe makes. Shown by `data-more-*` on the
          host, which `paint` keeps, never through React. */}
      {!fit && (
        <>
          <div className="graph-more left" data-testid="memory-more-left">
            <button type="button" onClick={() => pan(-1)} aria-label="Scroll memory left">
              ◂
            </button>
          </div>
          <div className="graph-more right" data-testid="memory-more-right">
            <button type="button" onClick={() => pan(1)} aria-label="Scroll memory right">
              more ▸
            </button>
          </div>
        </>
      )}

      <div className="world" ref={worldRef}>
        {ghosts.map((g) => (
          <GhostCard key={g.key} ghost={g} />
        ))}
        {nodes.map((spec) => (
          <Pill
            key={spec.id}
            spec={spec}
            snapshot={snapshot}
            handles={handles}
            picked={pickedId === spec.id}
            dimmed={near !== null && !near.has(spec.id)}
            marked={marks.has(spec.id)}
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

/** A card that has left memory, as it looked, standing where it stood
 *  while it fades out (`.node.ghost`). Inert and hidden from assistive
 *  technology: it is a picture of what went, not something in memory. */
function GhostCard({ ghost }: { ghost: Ghost }) {
  const { object, box } = ghost
  return (
    <button
      type="button"
      tabIndex={-1}
      inert
      aria-hidden="true"
      className={`node object ${object.kind} ghost`}
      data-ghost={object.id}
      style={{ transform: `translate(${box.x}px, ${box.y}px) translate(-50%, -50%)` }}
    >
      <span className="meta">
        <span className="handle">{ghost.handle}</span>
        <span className="type">{object.type}</span>
      </span>
      <span className="repr">{object.repr}</span>
    </button>
  )
}

function Pill({
  spec,
  snapshot,
  handles,
  picked,
  dimmed,
  marked,
  onPick,
  register,
}: {
  spec: { id: string; kind: 'name' | 'object' }
  snapshot: MemorySnapshot
  handles: Map<ObjectId, string>
  picked: boolean
  dimmed: boolean
  marked: boolean
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
    'data-marked': marked ? 'yes' : undefined,
  }
  const mark = marked ? 'marked' : ''

  if (spec.kind === 'name') {
    const rest = spec.id.slice(2)
    const cut = rest.indexOf(':')
    const scope = rest.slice(0, cut)
    const name = rest.slice(cut + 1)
    return (
      <button
        {...common}
        className={`node name ${picked ? 'picked' : ''} ${dimmed ? 'dimmed' : ''} ${mark}`}
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
      className={`node object ${object.kind} ${picked ? 'picked' : ''} ${dimmed ? 'dimmed' : ''} ${mark}`}
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
