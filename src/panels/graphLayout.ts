/**
 * Memory as one live graph.
 *
 * Names and objects are nodes in a single field; bindings and pointers are
 * edges. Each kind is kept inside a *band* — names left, objects right — so
 * the two collections read as two clouds without being two containers: the
 * pieces are all in one space, and they move in response to each other. The
 * bands are sized to the pane's aspect ratio, because a cloud shaped
 * differently from the space it lives in is a cloud the camera has to shrink
 * (see `bands`).
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
 * That "at rest" is load-bearing and was, for a while, a lie. The animation
 * loop stopped calling `tick` the moment `alpha` hit zero, so collision got
 * no frames after the forces died and whatever overlap was left simply
 * froze: the crowded fixture opened with 36 pairs of pills sitting on top of
 * each other, text cut off mid-word. `relax` is the pass on its own, for the
 * caller to keep running afterwards under a frame budget.
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

/* Tuned by measurement, not taste. With weaker springs the bands won and
 * connectivity stopped showing at all: the mean distance along an edge was
 * 0.88 of the mean distance between unconnected nodes, which is barely a
 * signal. On the 53-object fixture these values give 0.65, which is a
 * signal, while still leaving the two clouds plainly apart — that is the
 * trade the layout is actually making. (Measured on the six-node test graph
 * the same layout scores 0.96, but with five linked pairs out of fifteen
 * that number says more about the graph than about the layout.) */
const LINK = 0.16
/** Clearance between the *edges* of two connected nodes, not between their
 *  centres. A fixed centre-to-centre length put a wide node's neighbours
 *  inside it, which hid the very edge the picking was meant to show. */
const LINK_CLEAR = 62
const REPEL = 2600
const REPEL_RANGE = 300
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

/** The patch of world a cloud is asked to stay inside. */
export type Band = { x0: number; x1: number; y0: number; y1: number }

/** How much of a band's area the pills in it actually claim. Below this the
 *  band is too tight and the cloud spills out of it; above it, the field is
 *  bigger than it needs to be and the camera has to zoom out. */
const PACK = 0.6
/** Clear world between the two bands. Wide enough that the clouds read as
 *  two, narrow enough that a binding still crosses in one glance. */
const BAND_GAP = 80
const BAND_PULL = 0.05

/**
 * Two rectangles, sized so that **together** they have the pane's aspect
 * ratio, and placed names-left of objects-right.
 *
 * This replaced a pull toward a single x per kind, and it is the difference
 * between a legible crowd and an illegible one. A line attractor can only
 * ever produce a column: the cloud's width is fixed by how hard the lane
 * pull fights repulsion, while its height grows freely with the node count.
 * On the 53-object fixture that column came out 513x600 in a 844x635 pane,
 * so the camera had to zoom to 0.35 and the pill text landed at 3.7px —
 * unreadable, in a pane that was two-thirds empty. Collision cannot rescue
 * it either: it separates along whichever axis needs least, and for pills
 * that are wide and short that is always the vertical one, so every pass
 * makes the column *taller*.
 *
 * Sizing the bands from the node count and the pane's aspect makes the
 * cloud the shape of the space it has to live in, and the width stops going
 * to waste.
 */
export function bands(nodes: GraphNode[], v: Viewport): Record<NodeKind, Band> {
  const area = (kind: NodeKind): number => {
    let n = 0
    let w = 0
    let h = 0
    for (const node of nodes) {
      if (node.kind !== kind) continue
      n++
      w += node.w + GAP
      h += node.h + GAP
    }
    return n === 0 ? 0 : ((w / n) * (h / n) * n) / PACK
  }

  const an = area('name')
  const ao = area('object')
  const total = an + ao
  const r = v.h > 0 ? Math.max(0.25, v.w / v.h) : 1.33
  // Solve for the shared height that gives the pair the pane's aspect,
  // then give each band the width its own area needs at that height.
  const h = Math.max(1, Math.sqrt(Math.max(total, 1) / r))
  const wn = an / h
  const wo = ao / h
  const spanW = wn + BAND_GAP + wo
  const left = v.w / 2 - spanW / 2
  const cy = v.h / 2
  return {
    name: { x0: left, x1: left + wn, y0: cy - h / 2, y1: cy + h / 2 },
    object: { x0: left + wn + BAND_GAP, x1: left + spanW, y0: cy - h / 2, y1: cy + h / 2 },
  }
}

/** Nearest point of a band, on one axis. Inside the band there is no pull
 *  at all — the band is a place to be, not a point to be at. */
const towards = (p: number, lo: number, hi: number): number =>
  p < lo ? lo - p : p > hi ? hi - p : 0

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

  // Each cloud is kept inside its band, and left alone inside it.
  const box = bands(nodes, v)
  for (const n of nodes) {
    if (n.fixed) continue
    const b = box[n.kind]
    n.vx += towards(n.x, b.x0, b.x1) * BAND_PULL * alpha
    n.vy += towards(n.y, b.y0, b.y1) * BAND_PULL * alpha
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
 * rows stay readable. Returns the largest correction it applied, in px.
 *
 * Each correction is applied **as the pass walks the pairs**, so the next
 * pair already sees it. Accumulating the whole pass and applying it at the
 * end — which is what this did — deadlocks in exactly the case it exists
 * for: in a dense crowd a node is told to move up by the neighbour above
 * and down by the one below, the two cancel, nothing moves, and the pass
 * reports itself finished. Measured on the 53-object fixture, accumulating
 * left 60 overlapping pairs and never got below it however long it ran;
 * applying in place leaves 35 in a tenth of the passes.
 *
 * The reason that was avoided is real and is handled here: written in
 * array order, in-place corrections make the result depend on however the
 * snapshot happened to enumerate the nodes. So the pass walks the pairs in
 * **id order**, which is a property of the graph. Reversing the array
 * moves no node by more than 0px — there is a test.
 */
function separate(nodes: GraphNode[]): number {
  const n = nodes.length
  const order = orderByIdInto(nodes)
  let worst = 0

  for (let ii = 0; ii < n; ii++) {
    const a = nodes[order[ii]!]!
    for (let jj = ii + 1; jj < n; jj++) {
      const b = nodes[order[jj]!]!
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
        if (!a.fixed) a.x -= share * dir
        if (!b.fixed) b.x += share * dir
        worst = Math.max(worst, share)
      } else {
        const dir = gapY < 0 ? -1 : 1
        const share = bothFree ? needY / 2 : needY
        if (!a.fixed) a.y -= share * dir
        if (!b.fixed) b.y += share * dir
        worst = Math.max(worst, share)
      }
    }
  }
  return worst
}

/** Indices into `nodes`, sorted by id: the pair order the collision pass
 *  walks, so it depends on the graph and not on the array. */
function orderByIdInto(nodes: GraphNode[]): number[] {
  return nodes.map((_, i) => i).sort((p, q) => nodes[p]!.id.localeCompare(nodes[q]!.id))
}

/**
 * One collision-only pass, for after the forces have stopped.
 *
 * This is the other half of the promise in the header. Collision is
 * positional and unscaled *so that* it can keep working once `alpha` is
 * gone — but it only actually does so if something keeps calling it. It
 * returns the largest correction it applied, in px, so a caller can stop
 * as soon as there is nothing left to fix; the caller also owns a frame
 * budget, so the field stops whether or not the overlaps resolve.
 */
export function relax(graph: Graph): number {
  return separate(graph.nodes)
}

/** Below this much movement in a pass, collision has nothing left to do. */
export const RELAX_REST = 0.08

/** Frames of collision-only work a settled field is allowed. Bounded, so
 *  a pile-up that cannot resolve still comes to a stop. */
export const RELAX_BUDGET = 180

/**
 * Pairs of nodes whose boxes (plus the gap) still intersect — what the
 * collision pass exists to drive down.
 *
 * `slack` is why this is not a naive box test. Two pills that the pass has
 * pushed to exactly their clearance sit a hair inside it forever, because
 * each correction is a fraction of what is left; counting a 0.01px
 * encroachment as an overlap would report a perfectly separated field as a
 * pile-up. Resting in contact is not overlapping.
 */
export function overlapCount(nodes: GraphNode[], gap = GAP, slack = 0.5): number {
  let hits = 0
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]!
      if (
        (a.w + b.w) / 2 + gap - Math.abs(b.x - a.x) > slack &&
        (a.h + b.h) / 2 + gap - Math.abs(b.y - a.y) > slack
      ) {
        hits++
      }
    }
  }
  return hits
}

/** Runs to rest without animating: the arrangement a fresh graph opens in.
 *  Includes the collision-only tail, so what this returns is the same
 *  arrangement the animated loop lands on. */
export function settle(graph: Graph, v: Viewport, maxTicks = 600): number {
  let n = 0
  while (graph.alpha > 0 && n++ < maxTicks) tick(graph, v)
  for (let i = 0; i < RELAX_BUDGET; i++) {
    n++
    if (relax(graph) <= RELAX_REST) break
  }
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
