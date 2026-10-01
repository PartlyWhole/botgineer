/**
 * What the v2 editor draws on each line of a program, worked out from the
 * text and the run's marks alone. Pure, so the rules are tested without a
 * DOM (`tests/unit/editorLines.test.ts`); `CodeEditor` only paints them.
 *
 * The trace reports one line per statement it executes, which is not the
 * same thing as "the lines that ran", in three ways this module repairs:
 *
 * - A statement spread over several lines (a list across lines, a
 *   backslash) is reported on its first line only. Its other lines share
 *   that line's fate, or a list that was built would draw half dimmed.
 * - `else:`, `try:` and `finally:` are never reported at all: they are
 *   not statements. An `else:` whose body ran is a branch taken, and
 *   dimming its header would say the opposite.
 * - Blank lines and comments do nothing, so they are never "skipped".
 *
 * "Skipped" is only said once the run is over: in the middle of a step
 * through, a line not reached yet may still be reached.
 */

export type LineMarks = {
  /** 1-based lines the run reached so far. A line listed more than once
   *  was reached more than once (a loop), and the gutter counts it. */
  ran: number[]
  /** The line running now (the trace's, or the crow's demo moment), lit. */
  current: number | null
  /** The run is over: lines never reached are dimmed as skipped. */
  finished: boolean
  /** The run stopped on this line with this error type name (e.g.
   *  'NameError', 'SyntaxError', 'IndentationError'). */
  error: { line: number; text: string } | null
}

export type LineState = {
  /** Visits: 0 if the run never reached this line's statement. */
  visits: number
  now: boolean
  skipped: boolean
  /** The error type, on every line of the statement that raised it. */
  error: string | null
  /** Blank, or only a comment: nothing to run. */
  quiet: boolean
}

type Shape = {
  /** 1-based line on which this line's statement starts. */
  start: number
  quiet: boolean
  /** Leading spaces (a tab counts as four). */
  indent: number
  blank: boolean
}

/**
 * Each line's statement start, and whether it is quiet. A small scanner,
 * not a parser: it tracks brackets, strings (triple-quoted ones span lines)
 * and comments, which is all that decides where a statement continues.
 * Unbalanced input — the player is mid-edit — degrades to "every line is
 * its own statement" rather than throwing.
 */
export function lineShapes(text: string): Shape[] {
  const lines = text.split('\n')
  const out: Shape[] = []
  let depth = 0
  let triple: string | null = null
  let backslash = false
  let start = 1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const n = i + 1
    const continuing = depth > 0 || triple !== null || backslash
    if (!continuing) start = n
    const trimmed = line.trim()
    const blank = trimmed === ''
    const indent = leading(line)
    let code = false
    backslash = false
    let j = 0
    while (j < line.length) {
      const ch = line[j]!
      if (triple !== null) {
        code = true
        if (line.startsWith(triple, j)) {
          j += 3
          triple = null
        } else j += ch === '\\' ? 2 : 1
        continue
      }
      if (ch === '#') break
      if (ch === ' ' || ch === '\t') {
        j++
        continue
      }
      code = true
      if (ch === '"' || ch === "'") {
        const three = ch.repeat(3)
        if (line.startsWith(three, j)) {
          triple = three
          j += 3
          continue
        }
        j++
        while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1
        j++
        continue
      }
      if (ch === '(' || ch === '[' || ch === '{') depth++
      else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1)
      else if (ch === '\\' && j === line.length - 1) backslash = true
      j++
    }
    out.push({ start, quiet: !continuing && !code, indent, blank })
  }
  // A program left with an open bracket is being typed: don't let one
  // missing `)` swallow every line after it.
  if (depth > 0 || triple !== null) {
    return lines.map((line, i) => {
      const trimmed = line.trim()
      return { start: i + 1, quiet: trimmed === '' || trimmed.startsWith('#'), indent: leading(line), blank: trimmed === '' }
    })
  }
  return out
}

function leading(line: string): number {
  let n = 0
  for (const ch of line) {
    if (ch === ' ') n++
    else if (ch === '\t') n += 4
    else break
  }
  return n
}

/** `else:`, `try:`, `finally:`: block headers the trace never reports. */
const SILENT_HEADER = /^\s*(else|try|finally)\s*:/

/** What each line (index 0 is line 1) is drawn as, for these marks. */
export function lineStates(text: string, marks: LineMarks): LineState[] {
  const shapes = lineShapes(text)
  const lines = text.split('\n')
  const count = new Map<number, number>()
  for (const n of marks.ran) count.set(n, (count.get(n) ?? 0) + 1)
  const visitsOf = (i: number) => count.get(shapes[i]!.start) ?? 0

  const visits = shapes.map((_, i) => visitsOf(i))
  // A silent header is reached as often as its body's first statement.
  for (let i = 0; i < shapes.length; i++) {
    if (!SILENT_HEADER.test(lines[i]!) || shapes[i]!.start !== i + 1) continue
    const own = shapes[i]!.indent
    for (let k = i + 1; k < shapes.length; k++) {
      const s = shapes[k]!
      if (s.quiet) continue
      if (s.indent <= own) break
      if (s.start === k + 1) {
        visits[i] = Math.max(visits[i]!, visits[k]!)
        break
      }
    }
  }

  const currentStart = marks.current !== null ? shapes[marks.current - 1]?.start ?? null : null
  const errorStart = marks.error ? shapes[marks.error.line - 1]?.start ?? null : null

  return shapes.map((s, i) => {
    const now = currentStart !== null && s.start === currentStart && !s.quiet
    const error = errorStart !== null && s.start === errorStart && !s.quiet ? marks.error!.text : null
    const v = visits[i]!
    return {
      visits: s.quiet ? 0 : v,
      now,
      skipped: marks.finished && !s.quiet && v === 0 && !now && error === null,
      error,
      quiet: s.quiet,
    }
  })
}

/**
 * How many indent guides each line wears: one per four columns of its
 * indentation. A blank line inside a block carries the block's guides
 * (the lesser of its neighbours'), so a guide does not break at every
 * empty line the way it would if it were drawn from the line's own text.
 */
export function guideDepths(text: string, unit = 4): number[] {
  const lines = text.split('\n')
  const own = lines.map((l) => (l.trim() === '' ? null : Math.floor(leading(l) / unit)))
  return own.map((d, i) => {
    if (d !== null) return d
    let before = 0
    for (let k = i - 1; k >= 0; k--) if (own[k] !== null && own[k] !== undefined) { before = own[k]!; break }
    let after = 0
    for (let k = i + 1; k < own.length; k++) if (own[k] !== null && own[k] !== undefined) { after = own[k]!; break }
    return Math.min(before, after)
  })
}

/** Whether a list of marks is the same as another, by value: a parent
 *  that rebuilds the object every render must not reset staleness. */
export function sameMarks(a: LineMarks | null | undefined, b: LineMarks | null | undefined): boolean {
  if (!a || !b) return !a && !b
  return (
    a.current === b.current &&
    a.finished === b.finished &&
    (a.error?.line ?? null) === (b.error?.line ?? null) &&
    (a.error?.text ?? null) === (b.error?.text ?? null) &&
    a.ran.length === b.ran.length &&
    a.ran.every((n, i) => n === b.ran[i])
  )
}

/** The key hint for Run: ⌘↵ on Apple keyboards, Ctrl↵ elsewhere. */
export function runKeyHint(platform: string): string {
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘↵' : 'Ctrl↵'
}
