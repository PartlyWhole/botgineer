/**
 * Typing a line to `input()` in the program console: PLP's line discipline
 * (`app/console.mjs`, `app/CONSOLE.md` "Input subsystem"), as a pure step
 * from one keypress to the next state and what to do about it.
 *
 * | key | does |
 * |---|---|
 * | printable, paste | added to the line and shown; a paste keeps its first line; control characters dropped; capped in bytes |
 * | Backspace | takes the last character back |
 * | Enter | erases the typed preview and submits the line (the accepted line comes back as an echo: `ProgramConsole`) |
 * | ↑ / ↓ | earlier lines typed, and back |
 * | Ctrl+C | interrupts the run, waiting or not |
 * | Ctrl+D | a notice: the engine has no end-of-file to send |
 * | other escapes | ignored |
 *
 * Only Ctrl+C does anything while no `input()` is waiting.
 */

export type LineState = {
  /** An `input()` is waiting for a line. */
  waiting: boolean
  /** The line typed so far: a preview, erased on Enter. */
  line: string
  /** Lines submitted, oldest first, for ↑ and ↓. */
  history: readonly string[]
  /** Where ↑/↓ is in the history; -1 for a fresh line. */
  pos: number
}

export type LineEffect =
  /** Draw on the terminal (the preview, or rubbing it out). */
  | { kind: 'write'; text: string }
  | { kind: 'submit'; line: string }
  | { kind: 'interrupt' }
  /** A page line, dim, on a line of its own. */
  | { kind: 'notice'; text: string }

export const IDLE: LineState = { waiting: false, line: '', history: [], pos: -1 }

const erase = (s: string) => '\b \b'.repeat([...s].length)
const encoder = new TextEncoder()

export function keyIn(state: LineState, data: string, maxBytes = 65536): { state: LineState; effects: LineEffect[] } {
  const same = { state, effects: [] as LineEffect[] }
  if (data === '\x03') return { state, effects: [{ kind: 'interrupt' }] }
  if (!state.waiting) return same
  if (data === '\r') {
    const line = state.line
    return {
      state: { waiting: false, line: '', history: line ? [...state.history, line] : state.history, pos: -1 },
      effects: [{ kind: 'write', text: erase(line) }, { kind: 'submit', line }],
    }
  }
  if (data === '\x7f' || data === '\b') {
    if (!state.line) return same
    const chars = [...state.line]
    chars.pop()
    return { state: { ...state, line: chars.join('') }, effects: [{ kind: 'write', text: '\b \b' }] }
  }
  if (data === '\x04')
    return { state, effects: [{ kind: 'notice', text: '⟨EOF (Ctrl+D) is not supported here: the program is still waiting for a line⟩' }] }
  if (data === '\x1b[A') {
    if (!state.history.length) return same
    const pos = state.pos === -1 ? state.history.length - 1 : Math.max(0, state.pos - 1)
    return recall(state, pos)
  }
  if (data === '\x1b[B') {
    if (state.pos === -1) return same
    const pos = state.pos + 1
    return pos >= state.history.length ? recall(state, -1) : recall(state, pos)
  }
  if (data.startsWith('\x1b')) return same
  // Printable, typed or pasted: the first line of a paste, no control
  // characters, and no more bytes than the engine takes.
  // eslint-disable-next-line no-control-regex
  const text = data.split(/[\r\n]/, 1)[0]!.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
  if (!text) return same
  const line = state.line + text
  if (encoder.encode(line).byteLength > maxBytes) return { state, effects: [{ kind: 'notice', text: `⟨input line limit reached (${maxBytes} bytes)⟩` }] }
  return { state: { ...state, line }, effects: [{ kind: 'write', text }] }
}

function recall(state: LineState, pos: number) {
  const line = pos === -1 ? '' : state.history[pos]!
  return { state: { ...state, line, pos }, effects: [{ kind: 'write', text: erase(state.line) + line }] as LineEffect[] }
}

/** An `input()` begins waiting: a fresh line, the history kept. */
export const startWaiting = (state: LineState): LineState => ({ ...state, waiting: true, line: '', pos: -1 })

/** The line was refused (the engine had stopped waiting meanwhile): wait
 *  again with it restored, so nothing typed is lost. */
export const refused = (state: LineState, line: string): LineState => ({ ...state, waiting: true, line })
