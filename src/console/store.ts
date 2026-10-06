/**
 * The program console's transcript: what a run said, in arrival order.
 * Ported from PLP's console (`partlywhole/plp`, `app/console.mjs` and
 * `app/CONSOLE.md`), whose rule this keeps: **the store is the truth and the
 * terminal is a view of it.** The screen is never read back; it is redrawn by
 * replaying chunks, and the same chunks always draw the same screen.
 *
 * One addition: each chunk remembers the step it arrived at (`at`), so a run
 * walked a step at a time can show what had been said by then, the answers
 * typed to `input()` included. PLP's scrubbed view replays only the engine's
 * output, which left a step after `input("Name? ")` reading `Name? ` with the
 * answer missing.
 *
 * Pure: the terminal (`console/terminal.ts`) and the tests both use it.
 */

/** Where a chunk came from. */
export type Stream =
  /** The program's `print` and `sys.stdout`. */
  | 'stdout'
  /** `sys.stderr`, and the closing line of an exception. Red. */
  | 'stderr'
  /** A line typed to `input()`, accepted by the engine (`ProgramConsole`). */
  | 'echo'
  /** The page's own lines: a run starting, ending, a notice. Dim, and not
   *  part of the transcript (`transcript`). */
  | 'sys'

export type Chunk = {
  stream: Stream
  text: string
  /** The step the run had reached (its index among the steps walked) when
   *  this arrived; a run's closing lines carry the step count, after every
   *  step. */
  at: number
}

/** Each stream's colour, as SGR sequences around its text. Program output
 *  carries its own escapes, which the terminal interprets. */
export const SGR: Record<Stream, readonly [string, string]> = {
  stdout: ['', ''],
  stderr: ['\x1b[91m', '\x1b[0m'],
  echo: ['', ''],
  sys: ['\x1b[2m', '\x1b[0m'],
}

export const styled = (c: Chunk): string => SGR[c.stream][0] + c.text + SGR[c.stream][1]

/** What the program and its user said: output and typed answers, without
 *  the page's own lines. */
export const transcript = (chunks: readonly Chunk[]): string =>
  chunks
    .filter((c) => c.stream !== 'sys')
    .map((c) => c.text)
    .join('')

/** Exactly the engine's streams: what CPython would print with piped stdin
 *  (the prompt is the engine's; the typed answer is not). */
export const engineText = (chunks: readonly Chunk[]): string =>
  chunks
    .filter((c) => c.stream === 'stdout' || c.stream === 'stderr')
    .map((c) => c.text)
    .join('')

/**
 * The chunks to draw for step `index` of a run of `steps` steps: everything
 * said up to and including that step. `null`, or the last step, is the live
 * end, which is everything, closing lines included.
 */
export function viewAt(chunks: readonly Chunk[], index: number | null, steps: number): readonly Chunk[] {
  if (index === null || index >= steps - 1) return chunks
  return chunks.filter((c) => c.at <= index)
}

/** A page line, starting on a line of its own. */
export function sysLine(text: string, atLineStart: boolean): string {
  return (atLineStart ? '' : '\n') + text + (text.endsWith('\n') ? '' : '\n')
}

const STREAMS: readonly Stream[] = ['stdout', 'stderr', 'echo', 'sys']

/** Chunks from another browser (a shared room's run), if they are chunks:
 *  known streams, strings, bounded. Null if not. */
export function checkedChunks(raw: unknown, cap = 1_000_000): Chunk[] | null {
  if (!Array.isArray(raw) || raw.length > 100_000) return null
  let size = 0
  const out: Chunk[] = []
  for (const c of raw) {
    if (typeof c !== 'object' || c === null) return null
    const { stream, text, at } = c as Record<string, unknown>
    if (!STREAMS.includes(stream as Stream) || typeof text !== 'string' || typeof at !== 'number' || !Number.isFinite(at)) return null
    size += text.length
    if (size > cap) return null
    out.push({ stream: stream as Stream, text, at })
  }
  return out
}
