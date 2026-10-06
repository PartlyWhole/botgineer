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
 *
 * ## Slot labels
 *
 * A list's arrows are labelled with their index and a dict's with their
 * key, always — not only when the card is picked, which is how it started.
 * Those labels are the whole of what indexing and keys *are* (Stages 3 and
 * 6 are about nothing else), so hiding them behind a click hid the lesson.
 * They sit halfway along the arrow. Not at its head: equal values are one
 * object (invariant 4), so `[10, 20, 10]` and an aliased element bring
 * several arrows into one card at one point, and labels there land on
 * each other. Not at its tail either, where a fan leaves from one point.
 * Halfway, arrows from one card to different rows, or from different
 * cards to one, are apart — a fan's indices step down the gap one half-row
 * at a time. Two slots of one collection holding the same object are one
 * arrow drawn twice, so they share one label, `0, 2`. The gap in front
 * of a column is widened to fit its longest label (`labelW`), which is a
 * property of memory like a card's width, and labels are cut short
 * (`slotLabel`) so one long key cannot push the grid across the pane.
 */

export type NodeKind = 'name' | 'object'

/** What the placement needs to know about memory, and nothing else. */
export type LayoutInput = {
  /** Names in the order they should be listed. */
  names: { id: string; scope: string; target: string }[]
  /** Each object's pointers, in element order. */
  children: Map<string, string[]>
  /** The widest slot label on an arrow into each object, px (`slotLabel`).
   *  Absent: no labels, and every gap is the plain `COL_GAP`. */
  labelW?: Map<string, number>
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
/** Room in a gap beyond its widest label: the arrowhead, and enough bare
 *  line before the label to read as an arrow. */
export const LABEL_ROOM = 26
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

  // The gap in front of each column holds the labels on the arrows into it.
  const labels: number[] = []
  for (const [id, c] of cells) labels[c.col] = Math.max(labels[c.col] ?? 0, input.labelW?.get(id) ?? 0)

  const lefts: number[] = []
  let x = 0
  for (let c = 0; c < widths.length; c++) {
    lefts[c] = x
    const room = (labels[c + 1] ?? 0) > 0 ? (labels[c + 1] ?? 0) + LABEL_ROOM : 0
    x += (widths[c] ?? 0) + Math.max(c === 0 ? NAME_GAP : COL_GAP, room)
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

export type Box = { x: number; y: number; w: number; h: number }

export type Curve = {
  /** SVG path data. */
  d: string
  /** Where a pointer's label goes, and which of its ends is there (SVG's
   *  `text-anchor`). */
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }
}

/** Where along the arrow a label stands, 0..1. */
const LABEL_T = 0.5
/** Label baseline above the arrow. */
const LABEL_OFF = 4
/** A slot label's width per character, px: the edge label's monospace at
 *  its larger (picked) size, 12px, so a picked label never outgrows its
 *  gap — which it straddles, centred. */
export const LABEL_CHAR = 7.3
/** Longest slot label drawn whole: enough for two attributes sharing one
 *  arrow (`.left, .right`), short of a key long enough to push the grid
 *  across the pane. */
const LABEL_MAX = 16

/** A slot label as drawn — cut short past `LABEL_MAX` characters — and
 *  the room it needs. */
export function slotLabel(label: string): { text: string; w: number } {
  const text = label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label
  return { text, w: Math.ceil(text.length * LABEL_CHAR) }
}

/** How far an arrowhead stops short of the card it points at. */
const TIP = 4

const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

/** Whether a box is crossed by the path through these points. The ends'
 *  own cards are left out by the caller. */
const crosses = (pts: [number, number][], o: Box, pad = 3): boolean => {
  const l = o.x - o.w / 2 - pad
  const r = o.x + o.w / 2 + pad
  const t = o.y - o.h / 2 - pad
  const btm = o.y + o.h / 2 + pad
  return pts.some(([x, y]) => x > l && x < r && y > t && y < btm)
}

/** Points along a cubic, for testing it against cards. */
const sample = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, n = 24) => {
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) pts.push([cubic(x0, x1, x2, x3, i / n), cubic(y0, y1, y2, y3, i / n)])
  return pts
}

/** A forward arrow's control points, from x `ax` to `ex`: the plain S. */
const plain = (ax: number, ex: number) => {
  const reach = Math.max(24, (ex - ax) * 0.5)
  return { c1x: ax + reach, c2x: ex - reach }
}

/**
 * The arrow from one card to another.
 *
 * Forward — the usual case, left to right — it leaves the source's right
 * edge and enters the target's left edge, horizontal at both ends, so rows
 * read as rows and an arrow's direction is never in doubt.
 *
 * A forward arrow that would pass through a card on its way (`obstacles`:
 * the other cards) is routed round it: it runs level along a lane — its
 * own row, the target's row, or the gap between two rows — past the cards
 * in the way, and only then bends into its target. Drawn straight through,
 * `total`'s arrow to a `0` that a list also held entered the list card and
 * came out on the list's own arrow, and read as `total` pointing at the
 * list.
 *
 * Backward — to something already drawn in the same column or further
 * left, which is what a shared object or a cycle produces — it loops out to
 * the right and comes into the target's *right* edge. That arrow is
 * different on purpose: it is the one that says "this was already here".
 *
 * A collection that holds itself gets a loop over its own top.
 */
export function curve(a: Box, b: Box, obstacles: Box[] = [], labelW = 0): Curve {
  const ax = a.x + a.w / 2

  if (a === b || (a.x === b.x && a.y === b.y)) {
    const cx = a.x + a.w / 4
    const top = a.y - a.h / 2
    const d = `M ${ax} ${a.y} C ${ax + 44} ${a.y} ${cx + 10} ${top - 42} ${cx} ${top - TIP}`
    return { d, label: { x: ax + 20, y: top - 22, anchor: 'middle' } }
  }

  const forward = b.x - b.w / 2 - TIP > ax + 8
  const ex = forward ? b.x - b.w / 2 - TIP : b.x + b.w / 2 + TIP
  if (forward && obstacles.length > 0) {
    const routed = around(a, b, ax, ex, obstacles)
    if (routed) return routed
  }
  const reach = forward ? Math.max(24, (ex - ax) * 0.5) : 56 + Math.abs(b.y - a.y) * 0.12
  const c1x = ax + reach
  const c2x = forward ? ex - reach : Math.max(ax, ex) + reach
  const d = `M ${ax} ${a.y} C ${c1x} ${a.y} ${c2x} ${b.y} ${ex} ${b.y}`
  const at = (t: number) => ({ x: cubic(ax, c1x, c2x, ex, t), y: cubic(a.y, a.y, b.y, b.y, t) - LABEL_OFF, anchor: 'middle' as const })
  // Halfway, unless that puts the label on a card: an arrow clear of every
  // card can still pass close enough under one that its label, standing
  // above the line, lands on it (an attribute's arrow skipping a column to
  // a `None` further right). Then the nearest clear point, the source's
  // side first, where the gap was sized for it.
  let label = at(LABEL_T)
  if (labelW > 0 && obstacles.length > 0 && forward) {
    const onCard = (l: { x: number; y: number }) =>
      obstacles.some((o) => l.x + labelW / 2 > o.x - o.w / 2 && l.x - labelW / 2 < o.x + o.w / 2 && l.y > o.y - o.h / 2 && l.y - LABEL_H < o.y + o.h / 2)
    if (onCard(label)) {
      const clear = LABEL_TRIES.map(at).find((l) => !onCard(l))
      if (clear) label = clear
    }
  }
  return { d, label }
}

/** Where else along an arrow its label may stand, nearest halfway first
 *  and the source's side before the target's. */
const LABEL_TRIES = [0.4, 0.6, 0.32, 0.68, 0.25, 0.75, 0.18]

/**
 * A forward arrow routed round the cards in its way, or null when the
 * plain S is clear (or no lane is).
 *
 * The lane is the first clear one of: the source's own row, the target's
 * row, then the gaps just above and below each card in the way, nearest
 * the source first. The arrow bends onto the lane before the first card
 * in the way, runs level past the last, and bends into the target.
 */
function around(a: Box, b: Box, ax: number, ex: number, obstacles: Box[]): Curve | null {
  const others = obstacles.filter(
    (o) => !(o.x === a.x && o.y === a.y) && !(o.x === b.x && o.y === b.y) && o.x + o.w / 2 > ax && o.x - o.w / 2 < ex,
  )
  if (others.length === 0) return null
  const { c1x, c2x } = plain(ax, ex)
  const straight = sample(ax, a.y, c1x, a.y, c2x, b.y, ex, b.y)
  const inWay = others.filter((o) => crosses(straight, o))
  if (inWay.length === 0) return null

  const xs = Math.min(...inWay.map((o) => o.x - o.w / 2)) - 10
  const xe = Math.max(...inWay.map((o) => o.x + o.w / 2)) + 10
  if (xs <= ax + 4 || xe >= ex - 16) return null

  const lanes = [a.y, b.y, ...inWay.flatMap((o) => [o.y - o.h / 2 - ROW_GAP / 2, o.y + o.h / 2 + ROW_GAP / 2])]
  const tried = new Set<number>()
  for (const lane of lanes) {
    if (tried.has(lane)) continue
    tried.add(lane)
    // Onto the lane, along it, and into the target.
    const k1 = Math.max(12, (xs - ax) * 0.5)
    const k2 = Math.max(12, (ex - xe) * 0.5)
    const pts = [
      ...sample(ax, a.y, ax + k1, a.y, xs - k1, lane, xs, lane),
      ...sample(xs, lane, xs + 1, lane, xe - 1, lane, xe, lane, 12),
      ...sample(xe, lane, xe + k2, lane, ex - k2, b.y, ex, b.y),
    ]
    if (others.some((o) => crosses(pts, o))) continue
    const d = `M ${ax} ${a.y} C ${ax + k1} ${a.y} ${xs - k1} ${lane} ${xs} ${lane} L ${xe} ${lane} C ${xe + k2} ${lane} ${ex - k2} ${b.y} ${ex} ${b.y}`
    // A slot label stands in the gap its arrow crosses first, above the
    // arrow where it leaves — that gap is the one sized for it.
    const label = {
      x: cubic(ax, ax + k1, xs - k1, xs, LABEL_T),
      y: cubic(a.y, a.y, lane, lane, LABEL_T) - LABEL_OFF,
      anchor: 'middle' as const,
    }
    return { d, label }
  }
  return null
}

/** A label as drawn, for keeping labels off each other. */
export type LabelBox = { x: number; y: number; w: number }

/** Label height, px, as far as overlapping goes. */
const LABEL_H = 12

/**
 * Moves labels so no two overlap: each one that would sit on another
 * (closer than a label's height, with their widths overlapping) is pushed
 * down clear of it. Where arrows converge, `0` and `1` stood on one spot
 * and read as `61`. Returns the new y of each, in the order given.
 */
export function spread(labels: LabelBox[]): number[] {
  const order = labels.map((_, i) => i).sort((i, j) => labels[i]!.y - labels[j]!.y || labels[i]!.x - labels[j]!.x)
  const ys = labels.map((l) => l.y)
  const placed: number[] = []
  for (const i of order) {
    const l = labels[i]!
    let y = l.y
    for (let moved = true, n = 0; moved && n < labels.length; n++) {
      moved = false
      for (const j of placed) {
        const o = labels[j]!
        const apart = Math.abs(l.x - o.x) >= (l.w + o.w) / 2 + 2
        if (!apart && Math.abs(y - ys[j]!) < LABEL_H) {
          y = ys[j]! + LABEL_H
          moved = true
        }
      }
    }
    ys[i] = y
    placed.push(i)
  }
  return ys
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

/* --------------------------- comings and goings --------------------------- */

/*
 * The placement says where things *are*; it cannot say that something
 * left. After `x = 1` then `x = 1 + 2` the `1` is not in memory, so `place`
 * puts the `3` at the head of x's row, exactly where the `1` stood, and a
 * card that vanished as another faded in on the same spot read as the box's
 * contents changing — the mutation model the binding lessons exist to
 * replace. So the component shows the change happening, and everything it
 * needs to time it is here, pure:
 *
 *   - the old card stays where it stood for `LEAVE_MS`, dimming and then
 *     fading out (CSS, `.node.ghost`), a picture of a thing, not a thing:
 *     inert and out of the accessibility tree;
 *   - the new one arrives *beside* it (`beside`), on the right, where the
 *     robot's thought comes from, creeps there while the arrow swings
 *     across to it (`swing`), and only then glides into its slot (`trip`);
 *   - any other newcomer slides the last `SLIDE` px in from the right.
 *
 * `place` is untouched by all of it, and nothing that stays in memory
 * moves because of it: only the cards arriving and leaving animate
 * (invariant 15). Under reduced motion the component skips all of it.
 */

/** How long a card that left memory stays drawn, ms. Matches `node-out`. */
export const LEAVE_MS = 1100
/** When an arrow moving to a new target leaves its old one and when it
 *  arrives, ms after the line landed. */
export const SWING_FROM = 200
export const SWING_TO = 650
/** A replacement's trip from beside the old card into its slot, ms, and
 *  the share of it spent creeping (`WAIT`, covering `CREEP` of the way)
 *  while the arrow swings and the old card dims. A creep, not a stop: a
 *  card that stood still would look settled to anything watching for it. */
export const REPLACE_MS = 1050
export const REPLACE_WAIT = 0.6
export const REPLACE_CREEP = 0.12
/** A plain newcomer slides this far in from the right, over `SLIDE_MS`. */
export const SLIDE = 28
export const SLIDE_MS = 320
/** Room between the old card and its replacement waiting beside it, px. */
export const BESIDE_GAP = 16

/** A time-based move: from here, to wherever its body is going. */
export type Trip = { x: number; y: number; t0: number; dur: number; wait: number; creep: number }

const easeOut = (p: number) => 1 - (1 - p) ** 3
const easeInOut = (p: number) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2)

/** How far along a trip is at `now`, 0..1, never going backwards. With no
 *  wait it simply decelerates; with one it creeps, then glides. */
export function tripProgress(t: Trip, now: number): number {
  const p = clamp((now - t.t0) / t.dur, 0, 1)
  if (t.wait <= 0) return easeOut(p)
  if (p < t.wait) return t.creep * (p / t.wait)
  return t.creep + (1 - t.creep) * easeInOut((p - t.wait) / (1 - t.wait))
}

/** Where a tripping card is at `now`, heading for `to`, and whether it is
 *  there. `to` is read each frame, so a target that moves is still met. */
export function along(t: Trip, to: { x: number; y: number }, now: number): { x: number; y: number; done: boolean } {
  const f = tripProgress(t, now)
  return { x: t.x + (to.x - t.x) * f, y: t.y + (to.y - t.y) * f, done: now - t.t0 >= t.dur }
}

/** How far below the old card's middle a replacement waits, as a share of
 *  the two cards' half-heights together: low enough that the arrow to it
 *  visibly turns and passes under the old card, not straight through it. */
export const BESIDE_DROP = 0.85

/** Where a replacement waits: just to the right of the card it replaces
 *  and a little below it, so both are seen at once and the arrow's swing
 *  from one to the other is a turn, not an arrow growing longer. */
export function beside(old: Box, size: Size): { x: number; y: number } {
  return { x: old.x + old.w / 2 + BESIDE_GAP + size.w / 2, y: old.y + ((old.h + size.h) / 2) * BESIDE_DROP }
}

/** How far an arrow has swung from its old target to its new one, 0..1. */
export function swing(elapsed: number): number {
  return easeInOut(clamp((elapsed - SWING_FROM) / (SWING_TO - SWING_FROM), 0, 1))
}

/** Part of the way from one box to another: where a swinging arrow points. */
export function lerpBox(a: Box, b: Box, p: number): Box {
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p }
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
 *
 * A newcomer is revealed **downwards only**. The names are the left
 * column, and they are where every arrow starts: following a card that
 * arrived to the right scrolled them off a phone's pane (s8's `add` and
 * its default list), leaving `unction add` and a grid of arrows from
 * nowhere under "Look below: …". So the view stays left unless the player
 * scrolls it there, and a memory wider than the pane is cut on the right,
 * where the least of it is.
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
    x: span(b.left, b.right, v.w / k, at?.x, []),
    y: span(b.top, b.bottom, v.h / k, at?.y, reveal.map((r) => [r.y - r.h / 2, r.y + r.h / 2])),
    k,
  }
}

/** Moves an overview camera by a scroll delta given in screen pixels,
 *  kept inside what there is to see. */
export function scrolled(c: Camera, dx: number, dy: number, nodes: Box[], v: Viewport, pad = 40): Camera {
  return overview(nodes, v, { x: c.x + dx / c.k, y: c.y + dy / c.k }, [], pad)
}

/**
 * How much of memory the overview camera leaves off each side of the
 * pane, in screen pixels — so a memory wider than its pane can *say* it
 * is, rather than being cut on the right with nothing to tell the player
 * that a sideways scroll or swipe would show the rest.
 *
 * Only a report: it moves nothing, and the overview stays anchored at the
 * left with its zoom set by the pane (invariant 15). Measured against the
 * cards themselves, not the overview's padding, so a memory that fits
 * reports nothing hidden.
 */
export function hidden(c: Camera, nodes: Box[], v: Viewport): { left: number; right: number } {
  if (nodes.length === 0 || v.w === 0) return { left: 0, right: 0 }
  const b = bounds(nodes)
  const half = v.w / 2 / c.k
  return {
    left: Math.max(0, (c.x - half - b.left) * c.k),
    right: Math.max(0, (b.right - (c.x + half)) * c.k),
  }
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
