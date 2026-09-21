/**
 * Cloud layout: centred ragged rows, filled from the middle outwards.
 *
 * Pills are assigned to rows, biggest first, taking the row nearest the
 * middle that still has room; each row is then centred. Ragged centred
 * rows are what a tag cloud actually looks like, and because every pill
 * shares a row's baseline, nothing can overlap while there is capacity.
 *
 * ## Two approaches this replaced, and why
 *
 * **Relaxation** — drift toward the centre, push apart on overlap. The two
 * rules fought: pairs jammed against the edges, and pushing a pill out of
 * one collision shoved it into the next. Measured, it left 15px overlaps
 * in a cloud only 43% full.
 *
 * **Spiral packing** — place each pill at the first free point along a
 * spiral, the way word clouds are normally built. Better, but it scatters
 * pills at arbitrary `y`, and since these pills are all one height that
 * fragments the vertical space into slivers too short to use. Measured, 5
 * of 20 pills had nowhere to go at 61% fill.
 *
 * Rows have neither failure mode, and they are simpler.
 *
 * Placement is deterministic: the same pills land in the same arrangement
 * every time, because a diagram that reshuffles while you scrub a trace is
 * unreadable.
 *
 * Nothing here animates. `pack` sets each pill's target and `advance`
 * eases toward it, so movement is a render concern and correctness is not.
 */

export type CloudNode = {
  id: string
  /** Measured pill size, in px. */
  w: number
  h: number
  /** Where it is drawn now (centre, px, relative to the cloud box). */
  x: number
  y: number
  /** Where packing decided it belongs. */
  tx: number
  ty: number
  /** Under the pointer right now. */
  held: boolean
  /** Dropped by the player: keeps where it was put, and the rest of the
   *  cloud packs around it. Without this a drag did nothing — packing is
   *  deterministic, so releasing a pill sent it straight back to the spot
   *  it came from. */
  pinned: boolean
  /** Placed at least once, so a newcomer can be told apart. */
  placed: boolean
}

export type Bounds = { w: number; h: number }

/** Clear space kept between pills, and from the wall. */
const GAP = 7

export function makeNode(id: string, w = 60, h = 24): CloudNode {
  return { id, w, h, x: 0, y: 0, tx: 0, ty: 0, held: false, pinned: false, placed: false }
}

type Span = { from: number; to: number }
/** `run` is the widest stretch of the row left free by anything fixed in
 *  it; items are laid into that and nowhere else. Measuring capacity as
 *  "row width minus the fixed pill's width" was wrong: a pill in the
 *  middle splits the row into two shorter runs, and the budget did not
 *  know, so the last item overlapped. */
type Row = { y: number; used: number; items: CloudNode[]; run: Span }

/**
 * Decides where every pill belongs. Held pills keep their place and
 * everything else packs around them.
 */
export function pack(nodes: CloudNode[], bounds: Bounds): void {
  if (nodes.length === 0) return

  const fixed = nodes.filter((n) => n.held || n.pinned)
  const loose = nodes.filter((n) => !n.held && !n.pinned)
  for (const n of fixed) {
    n.tx = n.x
    n.ty = n.y
  }

  const rowH = Math.max(...nodes.map((n) => n.h)) + GAP
  const rowCount = Math.max(1, Math.floor(bounds.h / rowH))
  const cy = bounds.h / 2

  // Rows are built outward from the middle, so a small cloud is a tidy
  // clump in the centre rather than a column starting at the top.
  const rows: Row[] = middleOut(rowCount).map((slot) => {
    const y = cy + (slot - (rowCount - 1) / 2) * rowH
    // Whatever is fixed in this row carves it up; items go in what is left.
    const blocked = fixed
      .filter((f) => Math.abs(y - f.y) < (rowH + f.h) / 2)
      .map((f) => ({ from: f.x - f.w / 2 - GAP, to: f.x + f.w / 2 + GAP }))
    return { y, used: 0, items: [], run: widestRun(blocked, bounds.w) }
  })

  // Biggest first: wide pills are the hard ones to place, and leaving them
  // until last is how a packer ends up with nowhere to put them.
  const order = [...loose].sort(
    (a, b) => b.w - a.w || a.id.localeCompare(b.id), // ties by id, never by input order
  )

  for (const n of order) {
    const need = n.w + GAP
    const width = (r: Row) => r.run.to - r.run.from
    const row = rows.find((r) => r.used + need <= width(r)) ?? rows[rows.length - 1]!
    row.items.push(n)
    row.used += need
  }

  for (const row of rows) place(row, bounds)

  for (const n of nodes) {
    if (n.placed) continue
    // A newcomer starts where it belongs rather than sliding in from
    // wherever it happened to be created.
    n.x = n.tx
    n.y = n.ty
    n.placed = true
  }
}

/** Lays one row out left to right inside its free run, then centres it
 *  within that run. */
function place(row: Row, bounds: Bounds): void {
  if (row.items.length === 0) return

  const total = row.items.reduce((t, n) => t + n.w + GAP, 0) - GAP
  const span = row.run.to - row.run.from
  let cursor = row.run.from + Math.max(0, (span - total) / 2)

  for (const n of row.items) {
    n.tx = clamp(cursor + n.w / 2, n.w / 2 + 2, Math.max(n.w / 2 + 2, bounds.w - n.w / 2 - 2))
    n.ty = clamp(row.y, n.h / 2 + 2, Math.max(n.h / 2 + 2, bounds.h - n.h / 2 - 2))
    cursor += n.w + GAP
  }
}

/** The widest stretch of a row that nothing fixed is sitting in. */
function widestRun(blocked: Span[], width: number): Span {
  if (blocked.length === 0) return { from: GAP, to: width - GAP }
  const sorted = [...blocked].sort((a, b) => a.from - b.from)
  let best: Span = { from: GAP, to: GAP }
  let cursor = GAP
  for (const b of [...sorted, { from: width - GAP, to: width - GAP }]) {
    if (b.from - cursor > best.to - best.from) best = { from: cursor, to: b.from }
    cursor = Math.max(cursor, b.to)
  }
  return best
}

/** 0, 1, -1, 2, -2 … as row slots, so filling starts in the middle. */
function middleOut(count: number): number[] {
  const mid = Math.floor((count - 1) / 2)
  const out: number[] = [mid]
  for (let d = 1; out.length < count; d++) {
    if (mid + d < count) out.push(mid + d)
    if (out.length < count && mid - d >= 0) out.push(mid - d)
  }
  return out
}

/**
 * Eases every pill toward its target. Returns the largest distance still
 * to travel, so the caller can stop animating once the cloud has arrived.
 */
export function advance(nodes: CloudNode[], k = 0.22): number {
  let left = 0
  for (const n of nodes) {
    if (n.held || n.pinned) {
      n.tx = n.x
      n.ty = n.y
      continue
    }
    const dx = n.tx - n.x
    const dy = n.ty - n.y
    const d = Math.hypot(dx, dy)
    if (d < 0.4) {
      n.x = n.tx
      n.y = n.ty
      continue
    }
    n.x += dx * k
    n.y += dy * k
    left = Math.max(left, d)
  }
  return left
}

/** Places everything and puts it there immediately, with no animation. */
export function settle(nodes: CloudNode[], bounds: Bounds): void {
  pack(nodes, bounds)
  for (const n of nodes) {
    n.x = n.tx
    n.y = n.ty
  }
}

/** True when two pills are drawn on top of each other. Used by the tests,
 *  and by nothing else. */
export function anyOverlap(nodes: CloudNode[]): boolean {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!
      const b = nodes[j]!
      if (
        Math.abs(b.x - a.x) < (a.w + b.w) / 2 - 1 &&
        Math.abs(b.y - a.y) < (a.h + b.h) / 2 - 1
      ) {
        return true
      }
    }
  }
  return false
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
