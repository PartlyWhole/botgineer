/**
 * Where things go on the roadmap. Pure: the screen asks, this answers.
 *
 * The path is one column of round buttons that sways from side to side,
 * the way Duolingo's does — a straight column reads as a list, and a list
 * is a menu, not a journey. Each unit's stretch starts on the centre line
 * and swings out to one side; the next unit swings the other way, so the
 * whole path snakes down the page and every unit's character has the open
 * side to stand in.
 */

/** Vertical distance between node centres, px. */
export const PITCH = 122
/** How far the path swings from the centre line at its widest, px. */
export const SWING = 78
/** Where a unit's character stands, px from the centre line. On the side
 *  the path is *not* swinging to, so it has room. */
export const MASCOT_X = 132

export type Stop = {
  /** Offset from the centre line, px. Positive is right. */
  x: number
  /** Centre, px from the top of the unit's stretch. */
  y: number
}

/** Which way a unit swings: right, then left, then right. */
export const swingOf = (unitIndex: number): 1 | -1 => (unitIndex % 2 === 0 ? 1 : -1)

/**
 * The stops of one unit's stretch: its levels, then its trophy.
 *
 * A quarter of a sine per stop, so the path leaves the centre, reaches its
 * widest two stops later and comes back — the same curve whether a unit has
 * two stops or eight. Rounded to whole pixels so the buttons land on the
 * pixel grid and their outlines stay crisp.
 */
export function stops(count: number, unitIndex: number): Stop[] {
  const dir = swingOf(unitIndex)
  return Array.from({ length: count }, (_, i) => ({
    x: Math.round(Math.sin((i * Math.PI) / 4) * SWING * dir),
    y: i * PITCH + PITCH / 2,
  }))
}

/** Height of a unit's stretch, px. */
export const stretchHeight = (count: number): number => count * PITCH

/** Where the unit's character stands: opposite the swing, level with the
 *  middle of the stretch. */
export function mascotAt(count: number, unitIndex: number): Stop {
  return { x: -swingOf(unitIndex) * MASCOT_X, y: stretchHeight(count) / 2 }
}

/**
 * The trail between stops, as SVG path data in the stretch's own
 * coordinates (x from the centre line).
 *
 * A Catmull-Rom spline through the stop centres, converted to cubic
 * Béziers, so the dotted trail curves through every button instead of
 * zigzagging between them. The trail starts above the first stop and ends
 * below the last, so consecutive units' trails meet across the banner.
 */
export function trail(points: Stop[], lead = PITCH / 2): string {
  if (points.length === 0) return ''
  const first = points[0]!
  const last = points[points.length - 1]!
  const pts = [{ x: first.x, y: first.y - lead }, ...points, { x: last.x, y: last.y + lead }]
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${p2.x} ${p2.y}`
  }
  return d
}

const round = (n: number) => Math.round(n * 10) / 10
