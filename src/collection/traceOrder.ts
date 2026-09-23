/**
 * The collection's execution-order numbering, from a trace.
 *
 * The collection asks "number every line in the order Python reaches it",
 * and the trace records exactly that: one `line` event per visit, a `for`
 * header once per pass plus once to find nothing left, execution
 * descending into a call and coming back. Checked against 5.2, 7.2, 8.1,
 * 9.4 and the capstone's 9.C2 before any of this was written.
 *
 * They disagree in one place, and the collection disagrees with itself
 * there. When a line makes a call, 9.4 numbers that line *again* after the
 * call returns ("`out.append(4)` — the call has returned; the append
 * happens"), while 8.1 and 9.C2 do not, and the trace never does — the
 * interpreter does not revisit a line, it finishes it. Rather than change
 * the content or pick a side, a return to the line that made the call is
 * **optional**: it is removed from both the learner's numbering and the
 * truth before they are compared. That is the only mapping, and it is here.
 */
import type { Visit } from '../memory/extract'

export type OrderWindow = {
  /** Only the first N visits. */
  first?: number | undefined
  /** Only what happens from the first visit of `lines[0]` until the
   *  program next reaches a top-level line past `lines[1]` — calls made in
   *  between included, as 9.C2 numbers them. */
  lines?: [number, number] | undefined
}

/** How deep each line runs: 1 at module level, more inside calls. Lines
 *  the run never reached are taken to be top level. */
export function depthOf(visits: readonly Visit[]): Map<number, number> {
  const out = new Map<number, number>()
  for (const v of visits) if (!out.has(v.line)) out.set(v.line, v.depth)
  return out
}

/**
 * Drops each return to the line that made a call.
 *
 * A line is a return-to-caller when it repeats the nearest earlier line
 * that is no deeper than it, and everything in between ran deeper — that
 * is, the only thing that happened since it was last reached was a call.
 */
export function withoutReturns(seq: readonly number[], depth: ReadonlyMap<number, number>): number[] {
  const d = (line: number) => depth.get(line) ?? 1
  const out: number[] = []
  for (const line of seq) {
    let j = out.length - 1
    while (j >= 0 && d(out[j]!) > d(line)) j--
    const descended = j < out.length - 1
    if (descended && j >= 0 && out[j] === line) continue
    out.push(line)
  }
  return out
}

/** The truth, in the collection's numbering, for a window of the run. */
export function collectionOrder(visits: readonly Visit[], window: OrderWindow = {}): number[] {
  let chosen: readonly Visit[] = visits
  if (window.lines) {
    const [from, to] = window.lines
    const start = visits.findIndex((v) => v.line === from)
    if (start < 0) return []
    const top = visits[start]!.depth
    let end = visits.length
    for (let i = start; i < visits.length; i++) {
      const v = visits[i]!
      if (v.depth <= top && v.line > to) {
        end = i
        break
      }
    }
    chosen = visits.slice(start, end)
  }
  const seq = withoutReturns(
    chosen.map((v) => v.line),
    depthOf(visits),
  )
  return window.first ? seq.slice(0, window.first) : seq
}

/** The learner's numbering against the truth. Returns the first place
 *  they part company, or null when they agree. */
export function compareOrder(
  learner: readonly number[],
  visits: readonly Visit[],
  window: OrderWindow = {},
): { at: number; expected: number | null; got: number | null } | null {
  const truth = collectionOrder(visits, window)
  const mine = withoutReturns(learner, depthOf(visits))
  const n = Math.max(truth.length, mine.length)
  for (let i = 0; i < n; i++) {
    if (truth[i] !== mine[i]) return { at: i, expected: truth[i] ?? null, got: mine[i] ?? null }
  }
  return null
}
