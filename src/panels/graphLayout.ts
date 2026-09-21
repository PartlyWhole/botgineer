/**
 * Memory as one live graph.
 *
 * Names and objects are nodes in a single field; bindings and pointers are
 * edges. Names are pulled gently to the left, objects to the right, so the
 * two collections read as two clouds without being two containers — the
 * pieces are all in one space, and they move in response to each other.
 *
 * ## Why this settles (and the row packer did not have to)
 *
 * A force layout has rules that genuinely disagree: springs pull
 * neighbours together, repulsion pushes everything apart, lanes pull
 * sideways. An earlier relaxation in this repo oscillated forever for
 * exactly that reason, so convergence here is **structural, not
 * negotiated**: every force that can inject energy is scaled by `alpha`,
 * and `alpha` decays to nothing. Whatever the forces want, the system
 * stops.
 *
 * Collision is the exception. It is applied as a *positional* correction
 * and is never scaled, so pile-ups still resolve at rest — it cannot add
 * energy, only remove overlap.
 *
 * ## What this promises, and what it does not
 *
 * Promised: it settles, it never produces NaN, connected nodes end nearer
 * each other than unconnected ones, names end left of objects, and the
 * same graph lays out the same way twice.
 *
 * Not promised: zero overlap. This is a graph, not a tag cloud; nodes may
 * touch when a hub has many neighbours, and forcing them apart would
 * distort the distances that carry the meaning.
 */

export type NodeKind = 'name' | 'object'

export type GraphNode = {
  id: string
  kind: NodeKind
  /** Measured pill size, in px. */
  w: number
  h: number
  x: number
  y: number
  vx: number
  vy: number
  /** Held by a pointer, or pinned after being dropped: exerts forces on
   *  everything else and receives none. */
  fixed: boolean
  /** Positioned at least once. */
  placed: boolean
}

export type GraphEdge = {
  from: string
  to: string
  /** List index or dict key, for a pointer out of a collection. */
  label: string | null
}

export type Viewport = { w: number; h: number }

export type Graph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Energy budget. Decays to nothing, which is what makes this stop. */
  alpha: number
}

/* Tuned by measurement, not taste. With weaker springs the lanes won and
 * connectivity stopped showing at all: the mean distance along an edge was
 * 0.88 of the mean distance between unconnected nodes, which is barely a
 * signal. These values give 0.82 while still leaving the two clouds ~165px
 * apart, which is the trade the layout is actually making. */
const LINK = 0.16
/** Clearance between the *edges* of two connected nodes, not between their
 *  centres. A fixed centre-to-centre length put a wide node's neighbours
 *  inside it, which hid the very edge the picking was meant to show. */
const LINK_CLEAR = 62
const REPEL = 2600
const REPEL_RANGE = 300
const LANE = 0.06
const Y_PULL = 0.016
const DAMPING = 0.86
const ALPHA_DECAY = 0.018
/** Below this, nothing that can inject energy is left. */
export const ALPHA_REST = 0.002
const GAP = 14

export function makeNode(id: string, kind: NodeKind, w = 70, h = 26): GraphNode {
  return { id, kind, w, h, x: 0, y: 0, vx: 0, vy: 0, fixed: false, placed: false }
}

/** Where each cloud sits. Not a wall — a preference the springs can pull
 *  against, which is what lets a connection visibly cross the gap. */
export const laneX = (kind: NodeKind, v: Viewport): number =>
  kind === 'name' ? v.w * 0.24 : v.w * 0.7

/**
 * Deterministic starting positions: a golden-angle spiral inside each
 * lane. No randomness anywhere, because a diagram that lands differently
 * each time you run the same program is not a diagram.
 */
export function seed(graph: Graph, v: Viewport): void {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const byKind: Record<NodeKind, number> = { name: 0, object: 0 }
  const counts = { name: 0, object: 0 }
  for (const n of graph.nodes) counts[n.kind]++

  // Slots are handed out in id order, not array order, so the layout
  // depends on the graph and not on however the snapshot happened to
  // enumerate it.
  const inOrder = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id))
  for (const n of inOrder) {
    const i = byKind[n.kind]++
    const total = Math.max(1, counts[n.kind])
    const spread = Math.min(v.w * 0.2, v.h * 0.42)
    const r = spread * Math.sqrt((i + 0.5) / total)
    const a = i * golden
    n.x = laneX(n.kind, v) + r * Math.cos(a)
    n.y = v.h / 2 + r * Math.sin(a)
    n.vx = 0
    n.vy = 0
    n.placed = true
  }
}

/** One step. Returns the remaining alpha, so a caller can stop. */
export function tick(graph: Graph, v: Viewport): number {
  const { nodes, edges, alpha } = graph
  const index = new Map(nodes.map((n) => [n.id, n]))
  const cy = v.h / 2

  // Lanes and vertical centring.
  for (const n of nodes) {
    if (n.fixed) continue
    n.vx += (laneX(n.kind, v) - n.x) * LANE * alpha
    n.vy += (cy - n.y) * Y_PULL * alpha
  }

  // Repulsion. Capped by range so a big graph stays cheap, and the
  // separation vector is never derived from a zero distance.
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]!
      let dx = b.x - a.x
      let dy = b.y - a.y
      let d = Math.hypot(dx, dy)
      if (d > REPEL_RANGE) continue
      if (d < 0.01) {
        // Coincident nodes have no direction to separate along. Nudging
        // by index keeps it deterministic and keeps d out of the divisor.
        dx = ((i % 7) - 3) * 0.5 || 0.5
        dy = ((j % 5) - 2) * 0.5 || 0.5
        d = Math.hypot(dx, dy)
      }
      const force = (REPEL / (d * d)) * alpha
      const fx = (dx / d) * force
      const fy = (dy / d) * force
      if (!a.fixed) {
        a.vx -= fx
        a.vy -= fy
      }
      if (!b.fixed) {
        b.vx += fx
        b.vy += fy
      }
    }
  }

  // Springs.
  for (const e of edges) {
    const a = index.get(e.from)
    const b = index.get(e.to)
    if (!a || !b || a === b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const d = Math.max(0.01, Math.hypot(dx, dy))
    const want = (a.w + b.w) / 2 + LINK_CLEAR
    const force = (d - want) * LINK * alpha
    const fx = (dx / d) * force
    const fy = (dy / d) * force
    if (!a.fixed) {
      a.vx += fx
      a.vy += fy
    }
    if (!b.fixed) {
      b.vx -= fx
      b.vy -= fy
    }
  }

  for (const n of nodes) {
    if (n.fixed) {
      n.vx = 0
      n.vy = 0
      continue
    }
    n.vx *= DAMPING
    n.vy *= DAMPING
    n.x += n.vx
    n.y += n.vy
  }

  // Collision: positional, and never scaled by alpha. It cannot add
  // energy, so it can keep working after everything else has stopped.
  separate(nodes)

  graph.alpha = alpha <= ALPHA_REST ? 0 : Math.max(0, alpha * (1 - ALPHA_DECAY))
  return graph.alpha
}

/**
 * Pushes overlapping nodes apart, along whichever axis needs least so
 * rows stay readable.
 *
 * Corrections are accumulated and applied after the pass, not written as
 * the pass walks the pairs. Writing them in place made the result depend
 * on the order the nodes happened to be stored in — a fixed pair could
 * end tens of pixels apart depending on which end of the array it was
 * read from, and a layout that depends on enumeration order is not a
 * layout of the graph.
 */
function separate(nodes: GraphNode[]): void {
  const n = nodes.length
  const dx = new Float64Array(n)
  const dy = new Float64Array(n)

  for (let i = 0; i < n; i++) {
    const a = nodes[i]!
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j]!
      const gapX = b.x - a.x
      const gapY = b.y - a.y
      const needX = (a.w + b.w) / 2 + GAP - Math.abs(gapX)
      const needY = (a.h + b.h) / 2 + GAP - Math.abs(gapY)
      if (needX <= 0 || needY <= 0) continue
      if (a.fixed && b.fixed) continue

      const bothFree = !a.fixed && !b.fixed
      if (needX < needY) {
        const dir = gapX < 0 ? -1 : 1
        const share = bothFree ? needX / 2 : needX
        if (!a.fixed) dx[i]! -= share * dir
        if (!b.fixed) dx[j]! += share * dir
      } else {
        const dir = gapY < 0 ? -1 : 1
        const share = bothFree ? needY / 2 : needY
        if (!a.fixed) dy[i]! -= share * dir
        if (!b.fixed) dy[j]! += share * dir
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const node = nodes[i]!
    if (node.fixed) continue
    node.x += dx[i]!
    node.y += dy[i]!
  }
}

/** Runs to rest without animating: the arrangement a fresh graph opens in. */
export function settle(graph: Graph, v: Viewport, maxTicks = 600): number {
  let n = 0
  while (graph.alpha > 0 && n++ < maxTicks) tick(graph, v)
  return n
}

/** Wakes a settled graph so it responds to a change. */
export function disturb(graph: Graph, to = 0.55): void {
  graph.alpha = Math.max(graph.alpha, to)
}

/* ------------------------------ the camera ------------------------------ */

/** The world point at the centre of the viewport, and the zoom. */
export type Camera = { x: number; y: number; k: number }

export const MIN_K = 0.35
export const MAX_K = 2.2

/** A camera that frames exactly these nodes. Focusing uses the node *and
 *  its neighbours*, because the point of focusing is to see what it is
 *  connected to, not to look at it alone. */
export function frame(nodes: GraphNode[], v: Viewport, pad = 90): Camera {
  if (nodes.length === 0 || v.w === 0 || v.h === 0) {
    return { x: v.w / 2, y: v.h / 2, k: 1 }
  }
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity
  for (const n of nodes) {
    left = Math.min(left, n.x - n.w / 2)
    right = Math.max(right, n.x + n.w / 2)
    top = Math.min(top, n.y - n.h / 2)
    bottom = Math.max(bottom, n.y + n.h / 2)
  }
  const w = Math.max(1, right - left + pad * 2)
  const h = Math.max(1, bottom - top + pad * 2)
  const k = clamp(Math.min(v.w / w, v.h / h), MIN_K, MAX_K)
  return { x: (left + right) / 2, y: (top + bottom) / 2, k }
}

/** Eases the camera. Returns how far it still has to go, in viewport
 *  pixels, so the caller can stop the loop. */
export function approach(from: Camera, to: Camera, rate = 0.16): Camera {
  return {
    x: from.x + (to.x - from.x) * rate,
    y: from.y + (to.y - from.y) * rate,
    k: from.k + (to.k - from.k) * rate,
  }
}

export function cameraDistance(a: Camera, b: Camera, v: Viewport): number {
  return Math.hypot((a.x - b.x) * a.k, (a.y - b.y) * a.k) + Math.abs(a.k - b.k) * v.w
}

/** The transform that puts the camera's world point at the viewport
 *  centre. Written to both layers, so edges and pills stay aligned. */
export function transformOf(c: Camera, v: Viewport): string {
  return `translate(${v.w / 2}px, ${v.h / 2}px) scale(${c.k}) translate(${-c.x}px, ${-c.y}px)`
}

/** The same transform in SVG's syntax, which takes no units. Both layers
 *  are given the same camera so edges and pills cannot drift apart. */
export function svgTransformOf(c: Camera, v: Viewport): string {
  return `translate(${v.w / 2} ${v.h / 2}) scale(${c.k}) translate(${-c.x} ${-c.y})`
}

/** Where a line into `to` should stop so an arrowhead lands on the edge of
 *  the node rather than under it. */
export function trimTo(
  from: { x: number; y: number },
  to: { x: number; y: number; w: number; h: number },
  inset = 6,
): { x: number; y: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return { x: to.x, y: to.y }
  const halfW = to.w / 2 + inset
  const halfH = to.h / 2 + inset
  // How far along the segment we can go before leaving the target's box.
  const tx = dx === 0 ? Infinity : halfW / Math.abs(dx)
  const ty = dy === 0 ? Infinity : halfH / Math.abs(dy)
  const t = Math.min(tx, ty)
  return { x: to.x - dx * t, y: to.y - dy * t }
}

/** Viewport point → world point, for turning a pointer position into a
 *  node position while dragging. */
export function toWorld(px: number, py: number, c: Camera, v: Viewport): { x: number; y: number } {
  return { x: (px - v.w / 2) / c.k + c.x, y: (py - v.h / 2) / c.k + c.y }
}

/* ------------------------------ for tests ------------------------------ */

export function neighboursOf(graph: Graph, id: string): GraphNode[] {
  const ids = new Set<string>()
  for (const e of graph.edges) {
    if (e.from === id) ids.add(e.to)
    if (e.to === id) ids.add(e.from)
  }
  return graph.nodes.filter((n) => ids.has(n.id))
}

export const distance = (a: GraphNode, b: GraphNode): number => Math.hypot(a.x - b.x, a.y - b.y)

export const isFinitePosition = (n: GraphNode): boolean =>
  Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.vx) && Number.isFinite(n.vy)

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
