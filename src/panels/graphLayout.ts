/**
 * Memory as a grid: names in a column on the left, objects in rows to the
 * right of them.
 *
 * ## Why a grid, and not a field
 *
 * This file used to be a force simulation — springs, repulsion, collision
 * and an energy budget that decayed so the field would stop. It did stop,
 * eventually, and that was the problem. Every console line replays the
 * whole program, so memory arrived from nothing one step at a time and
 * each step re-energised the field: measured over an eight-line session,
 * nodes landed up to 378px from where they had been, and adding a single
 * line moved the *existing* nodes by up to 160px and took five seconds to
 * settle. Nothing in it knew about order either, so a list's elements came
 * out in whatever order the forces left them, and arrows crossed more as
 * memory grew — twelve crossings on the test fixture.
 *
 * The layout is now **placed, not negotiated**. It is a pure function of
 * what memory holds and the order things were first seen in, the way
 * Python Tutor draws frames and heap:
 *
 *   - Names form one column, in the order they were made. A local frame's
 *     names follow the globals, after a gap.
 *   - Each name's object starts a row beside it. A collection's elements
 *     follow in the next column, in index order, one row each, and their
 *     own elements after them — a tree read left to right.
 *   - An object already drawn is not drawn again. A second name, or a
 *     second slot, that points at it gets an arrow to where it already is,
 *     so aliasing reads as two arrows converging on one card — which is the
 *     thing the whole panel exists to show.
 *
 * So the same memory always draws the same way, the relative order of
 * things never changes, and a new line only ever *adds* rows. What moves
 * when it does is what had to make room, and it moves straight down, in
 * the order it was already in. The component tweens between placements;
 * there is no simulation left to settle.
 *
 * What it costs: dragging, and the organic look. A card cannot be put
 * somewhere by hand when its place is a property of the program.
 */

export type NodeKind = 'name' | 'object'

/** What the placement needs to know about memory, and nothing else. */
export type LayoutInput = {
  /** Names in the order they should be listed. */
  names: { id: string; scope: string; target: string }[]
  /** Each object's pointers, in element order. */
  children: Map<string, string[]>
}

export type Size = { w: number; h: number }

export type Placed = { x: number; y: number; col: number; row: number }

export type Viewport = { w: number; h: number }

/** Space between rows, px. */
export const ROW_GAP = 10
/** Space between the name column and the first object column: room for a
 *  binding's arrow to be seen as an arrow. */
export const NAME_GAP = 72
/** Space between object columns. */
export const COL_GAP = 56
/** Rows left empty between one scope's names and the next scope's. */
const SCOPE_GAP_ROWS = 0.5

const FALLBACK: Size = { w: 70, h: 26 }

/**
 * The order names are listed in: scope by scope, globals first, and within
 * a scope by when each name was first seen.
 *
 * `seen` is kept by the caller for the whole run, like the object handles,
 * and is added to here. Order of first sight is what makes the column
 * stable: a name that is rebound keeps its place, and a new name joins at
 * the bottom of its scope rather than wherever the engine happened to
 * enumerate it.
 */
export function orderNames<T extends { id: string; scope: string }>(names: T[], seen: Map<string, number>): T[] {
  for (const n of names) if (!seen.has(n.id)) seen.set(n.id, seen.size)
  const scopeRank = new Map<string, number>()
  for (const n of [...names].sort((a, b) => seen.get(a.id)! - seen.get(b.id)!)) {
    if (!scopeRank.has(n.scope)) scopeRank.set(n.scope, n.scope === 'global' ? -1 : scopeRank.size)
  }
  return [...names].sort(
    (a, b) => scopeRank.get(a.scope)! - scopeRank.get(b.scope)! || seen.get(a.id)! - seen.get(b.id)!,
  )
}

/**
 * Assigns every node a column and a row.
 *
 * Walks the names in order. Each takes the next free row; if its object
 * has not been drawn yet, the object starts in that same row, one column
 * over, and its elements are laid out depth-first beside it. A parent sits
 * level with its first child, so the arrow to element 0 is flat and the
 * rest fan downward in index order.
 *
 * Returns grid cells, not pixels: see `place`.
 */
export function grid(input: LayoutInput): Map<string, { col: number; row: number }> {
  const cells = new Map<string, { col: number; row: number }>()

  // Returns the first row below everything this subtree placed.
  const visit = (id: string, col: number, row: number): number => {
    cells.set(id, { col, row })
    let cursor = row
    let any = false
    for (const child of input.children.get(id) ?? []) {
      if (cells.has(child)) continue // drawn already: an arrow, not a copy
      cursor = visit(child, col + 1, cursor)
      any = true
    }
    return any ? cursor : row + 1
  }

  let row = 0
  let scope: string | null = null
  for (const name of input.names) {
    if (scope !== null && name.scope !== scope) row += SCOPE_GAP_ROWS
    scope = name.scope
    cells.set(name.id, { col: 0, row })
    row = cells.has(name.target) ? row + 1 : visit(name.target, 1, row)
  }
  return cells
}

/**
 * Grid cells to pixels.
 *
 * Every row has the same pitch, the tallest card plus a gap, so rows line
 * up across columns and read as rows. Each column is as wide as its widest
 * card. Names are right-aligned against their column, so every binding's
 * arrow starts at the same x; objects are left-aligned, so every arrow
 * into a column ends at the same x.
 *
 * `x`/`y` are the card's centre, which is what the component positions by.
 */
export function place(input: LayoutInput, sizes: Map<string, Size>): Map<string, Placed> {
  const cells = grid(input)
  const size = (id: string) => sizes.get(id) ?? FALLBACK

  let pitch = 0
  const widths: number[] = []
  for (const [id, c] of cells) {
    const s = size(id)
    pitch = Math.max(pitch, s.h)
    widths[c.col] = Math.max(widths[c.col] ?? 0, s.w)
  }
  pitch += ROW_GAP

  const lefts: number[] = []
  let x = 0
  for (let c = 0; c < widths.length; c++) {
    lefts[c] = x
    x += (widths[c] ?? 0) + (c === 0 ? NAME_GAP : COL_GAP)
  }

  const out = new Map<string, Placed>()
  for (const [id, c] of cells) {
    const s = size(id)
    const left = lefts[c.col] ?? 0
    const cx = c.col === 0 ? left + (widths[0] ?? 0) - s.w / 2 : left + s.w / 2
    out.set(id, { x: cx, y: c.row * pitch + pitch / 2, col: c.col, row: c.row })
  }
  return out
}

/* ------------------------------ the arrows ------------------------------ */

type Box = { x: number; y: number; w: number; h: number }

export type Curve = {
  /** SVG path data. */
  d: string
  /** Where a pointer's label goes. */
  label: { x: number; y: number }
}

/** How close to its target a label sits along the curve, 0..1. Near the
 *  far end, so a list's indices land next to the elements they name
 *  instead of in a ring around the list. */
const LABEL_T = 0.8
/** Label height above the curve. */
const LABEL_OFF = 8
/** How far an arrowhead stops short of the card it points at. */
const TIP = 4

const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

/**
 * The arrow from one card to another.
 *
 * Forward — the usual case, left to right — it leaves the source's right
 * edge and enters the target's left edge, horizontal at both ends, so rows
 * read as rows and an arrow's direction is never in doubt.
 *
 * Backward — to something already drawn in the same column or further
 * left, which is what a shared object or a cycle produces — it loops out to
 * the right and comes into the target's *right* edge. That arrow is
 * different on purpose: it is the one that says "this was already here".
 *
 * A collection that holds itself gets a loop over its own top.
 */
export function curve(a: Box, b: Box): Curve {
  const ax = a.x + a.w / 2

  if (a === b || (a.x === b.x && a.y === b.y)) {
    const cx = a.x + a.w / 4
    const top = a.y - a.h / 2
    const d = `M ${ax} ${a.y} C ${ax + 44} ${a.y} ${cx + 10} ${top - 42} ${cx} ${top - TIP}`
    return { d, label: { x: ax + 20, y: top - 22 } }
  }

  const forward = b.x - b.w / 2 - TIP > ax + 8
  const ex = forward ? b.x - b.w / 2 - TIP : b.x + b.w / 2 + TIP
  const reach = forward ? Math.max(24, (ex - ax) * 0.5) : 56 + Math.abs(b.y - a.y) * 0.12
  const c1x = ax + reach
  const c2x = forward ? ex - reach : Math.max(ax, ex) + reach
  const d = `M ${ax} ${a.y} C ${c1x} ${a.y} ${c2x} ${b.y} ${ex} ${b.y}`
  const label = {
    x: cubic(ax, c1x, c2x, ex, LABEL_T),
    y: cubic(a.y, a.y, b.y, b.y, LABEL_T) - LABEL_OFF,
  }
  return { d, label }
}

/* ------------------------------ the tween ------------------------------ */

/** Fraction of the remaining distance covered per frame. About 250ms to
 *  arrive at 60fps, and it decelerates into place. */
export const EASE = 0.2
/** Closer than this, in px, and a node is simply where it is going. */
export const ARRIVED = 0.3

/** Moves `from` part of the way to `to`. Returns how far it still has to
 *  go, so the caller can stop the loop. */
export function ease(from: { x: number; y: number }, to: { x: number; y: number }, rate = EASE): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) < ARRIVED && Math.abs(dy) < ARRIVED) {
    from.x = to.x
    from.y = to.y
    return 0
  }
  from.x += dx * rate
  from.y += dy * rate
  return Math.max(Math.abs(dx), Math.abs(dy)) * (1 - rate)
}

/* ------------------------------ the camera ------------------------------ */

/** The world point at the centre of the viewport, and the zoom. */
export type Camera = { x: number; y: number; k: number }

export const MIN_K = 0.35
export const MAX_K = 2.2
/**
 * The overview's zoom, which depends on the pane and **never on memory**.
 *
 * Fitting the content was tried and it moved everything twice over. A
 * two-card memory framed to fill the pane came out at 2.2x, cards the size
 * of headlines; a twelve-row one in a short pane came out at 0.4x, where a
 * card's text is 5px. And in between, every line that added a row changed
 * the zoom, so every card on screen grew or shrank a little each time —
 * motion caused by nothing that happened to it.
 *
 * So the overview is shown at natural size, shrunk only when the pane is
 * too narrow to hold a couple of columns, and a memory bigger than the
 * pane scrolls, the way Python Tutor's does.
 */
export const overviewZoom = (v: Viewport): number => clamp(v.w / OVERVIEW_WIDTH, OVERVIEW_MIN_K, 1)
/** Pane width below which the overview starts to shrink. */
const OVERVIEW_WIDTH = 560
export const OVERVIEW_MIN_K = 0.8

/**
 * The overview camera: everything, if it fits at a readable size, and
 * otherwise a readable window onto it that scrolls.
 *
 * `at` is where the caller last had the camera, in world coordinates; it
 * is kept wherever it is still valid, so a new line does not throw the
 * view back to the top. `reveal` are boxes that must be on screen — the
 * nodes that just arrived — and the view moves the least it can to show
 * them.
 *
 * Anchored at the top left, like a page, and not centred. Centring moved
 * every card on screen whenever memory grew — a new column shifted the
 * whole grid left by half its width — which is the very motion this layout
 * exists to get rid of. Anchored, memory grows down and to the right and
 * what was already there stays exactly where it was.
 */
export function overview(
  nodes: Box[],
  v: Viewport,
  at: { x: number; y: number } | null,
  reveal: Box[] = [],
  pad = 40,
): Camera {
  if (nodes.length === 0 || v.w === 0 || v.h === 0) return { x: v.w / 2, y: v.h / 2, k: 1 }
  const b = bounds(nodes)
  const k = overviewZoom(v)
  const span = (lo: number, hi: number, view: number, want: number | undefined, show: [number, number][]) => {
    const min = lo - pad + view / 2
    const max = Math.max(min, hi + pad - view / 2)
    // Default to the start, where the first names are.
    let c = want ?? min
    for (const [a, z] of show) {
      if (z + pad > c + view / 2) c = z + pad - view / 2
      if (a - pad < c - view / 2) c = a - pad + view / 2
    }
    return clamp(c, min, max)
  }
  return {
    x: span(b.left, b.right, v.w / k, at?.x, reveal.map((r) => [r.x - r.w / 2, r.x + r.w / 2])),
    y: span(b.top, b.bottom, v.h / k, at?.y, reveal.map((r) => [r.y - r.h / 2, r.y + r.h / 2])),
    k,
  }
}

/** Moves an overview camera by a scroll delta given in screen pixels,
 *  kept inside what there is to see. */
export function scrolled(c: Camera, dx: number, dy: number, nodes: Box[], v: Viewport, pad = 40): Camera {
  return overview(nodes, v, { x: c.x + dx / c.k, y: c.y + dy / c.k }, [], pad)
}

function bounds(nodes: Box[]) {
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
  return { left, right, top, bottom }
}

/** A camera that frames exactly these boxes. Focusing uses the node *and
 *  its neighbours*, because the point of focusing is to see what it is
 *  connected to, not to look at it alone. */
export function frame(nodes: Box[], v: Viewport, pad = 60, maxK = MAX_K): Camera {
  if (nodes.length === 0 || v.w === 0 || v.h === 0) {
    return { x: v.w / 2, y: v.h / 2, k: 1 }
  }
  const { left, right, top, bottom } = bounds(nodes)
  const w = Math.max(1, right - left + pad * 2)
  const h = Math.max(1, bottom - top + pad * 2)
  const k = clamp(Math.min(v.w / w, v.h / h), MIN_K, Math.min(MAX_K, maxK))
  return { x: (left + right) / 2, y: (top + bottom) / 2, k }
}

/** Eases the camera one frame towards its target. */
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

/** The same transform in SVG's syntax, which takes no units. */
export function svgTransformOf(c: Camera, v: Viewport): string {
  return `translate(${v.w / 2} ${v.h / 2}) scale(${c.k}) translate(${-c.x} ${-c.y})`
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
