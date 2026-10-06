/**
 * The program console: a terminal emulator (xterm.js) drawing a run's
 * transcript, ported from PLP (`app/console.mjs`; the contract is PLP's
 * `app/CONSOLE.md`). Interleaved stdout and stderr, carriage returns that
 * overwrite (a progress line), ANSI colours, `input()` typed at the prompt
 * with editing and history, Ctrl+C to interrupt.
 *
 * **The store is the truth, the terminal is a view** (`console/store`).
 * `text()` and `engineText()` read the store, never the screen. Every redraw
 * is a reset and a replay of chunks, so showing a step and coming back to the
 * end draws the same screen.
 *
 * **Echo, exactly once.** With live input the engine's own echo is off
 * (`echo_stdin: false`). What is typed is a preview, erased on Enter; the
 * line enters the transcript only once the engine has accepted it, as an
 * `echo` chunk (`ProgramConsole`'s `provide`). Without live input (a page
 * that is not cross-origin isolated) there is no typing, and the engine
 * echoes what it was given.
 *
 * **Writes are asynchronous** in xterm. A reset clears the store at once and
 * holds back screen writes until the queue before it has drained, then
 * replays whatever arrived meanwhile; a later reset makes an earlier one's
 * callback do nothing.
 *
 * Not React: `ProgramConsole` mounts it and hands its methods out.
 */
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { IDLE, keyIn, refused, startWaiting, type LineState } from './lineDiscipline'
import { engineText, styled, sysLine, transcript, viewAt, type Chunk, type Stream } from './store'

export type ConsoleOptions = {
  /** A line typed to `input()`. Throws if the engine will not take it. */
  onInput: (line: string) => void
  onInterrupt: () => void
  /** The engine's `max_input_line_bytes`. */
  maxInputLineBytes?: number
}

export type ProgramTerminal = ReturnType<typeof createTerminal>

export function createTerminal(host: HTMLElement, { onInput, onInterrupt, maxInputLineBytes = 65536 }: ConsoleOptions) {
  const term = new Terminal({
    // The engine's output says `\n`; a lone `\r` passes through, so a
    // line that overwrites itself does.
    convertEol: true,
    scrollback: 5000,
    fontSize: 13,
    lineHeight: 1.25,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    cursorBlink: true,
    cursorInactiveStyle: 'none',
    // The robot's screen (`robot-v2.css`): the same ground and inks.
    theme: {
      background: '#050b15',
      foreground: '#e8f4ee',
      cursor: '#5dffa8',
      cursorAccent: '#050b15',
      selectionBackground: '#24457c',
      red: '#ff7a6b',
      brightRed: '#ff9d8e',
      green: '#5dffa8',
      brightGreen: '#7df0c9',
      yellow: '#ffc861',
      blue: '#61afef',
      cyan: '#5ad8ff',
      brightBlack: '#7c90a8',
    },
  })
  const fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.open(host)

  let chunks: Chunk[] = []
  /** The step being shown, or null for the live end (everything). */
  let shownAt: number | null = null
  /** How many steps the run has: a step past the last is the live end. */
  let steps = 0
  /** Where new chunks are recorded as arriving. */
  let now = 0
  let atLineStart = true
  let line: LineState = IDLE

  let generation = 0
  let resetPending = false
  let pendingRender: (() => void) | null = null

  const live = () => shownAt === null
  const writeLive = (text: string) => {
    if (!resetPending) term.write(text)
  }
  const draw = (list: readonly Chunk[]) => {
    const render = () => {
      term.reset()
      for (const c of list) term.write(styled(c))
      // A line being typed stays on screen through a redraw.
      if (line.waiting && line.line && live()) term.write(line.line)
    }
    if (resetPending) pendingRender = render
    else render()
  }

  function append(stream: Stream, text: string, at = now) {
    if (!text) return
    const c: Chunk = { stream, text, at }
    chunks.push(c)
    atLineStart = text.endsWith('\n')
    if (live()) writeLive(styled(c))
  }

  function system(text: string, at = now) {
    append('sys', sysLine(text, atLineStart), at)
  }

  term.onData((data) => {
    const { state, effects } = keyIn(line, data, maxInputLineBytes)
    line = state
    for (const e of effects) {
      if (e.kind === 'interrupt') onInterrupt()
      else if (e.kind === 'write') writeLive(e.text)
      else if (e.kind === 'notice') system(e.text)
      else {
        try {
          onInput(e.line)
        } catch (err) {
          // The engine stopped waiting meanwhile: say so, and give the line
          // back to be sent again.
          system(`input rejected: ${err instanceof Error ? err.message : String(err)}`)
          line = refused(line, e.line)
          writeLive(e.line)
        }
      }
    }
  })

  const fit = () => {
    try {
      fitAddon.fit()
    } catch {
      /* not laid out yet */
    }
  }
  const observer = new ResizeObserver(() => fit())
  observer.observe(host)
  fit()

  return {
    /** Starts over: an empty store, no input waiting, the live end shown.
     *  Resolves once the screen is empty of everything before it. */
    reset(): Promise<boolean> {
      chunks = []
      shownAt = null
      steps = 0
      now = 0
      atLineStart = true
      line = { ...IDLE, history: line.history }
      const mine = ++generation
      resetPending = true
      pendingRender = () => draw(chunks)
      term.reset()
      return new Promise((resolve) => {
        // Written after every write queued before the reset: once it is
        // parsed, wipe what they drew and replay what has arrived since.
        term.write('', () => {
          if (mine !== generation) return resolve(false)
          term.reset()
          resetPending = false
          const render = pendingRender
          pendingRender = null
          render?.()
          resolve(true)
        })
      })
    },
    /** Output arriving: recorded at the step the run has reached. */
    append,
    /** A page line, dim, starting on a line of its own. */
    system,
    /** The run has reached step `at` (its index among the steps walked). */
    reached(at: number) {
      now = at
      steps = Math.max(steps, at + 1)
    },
    /** The run is over, after `count` steps: closing lines go after them. */
    ended(count: number) {
      steps = count
      now = count
    },
    /** Shows the transcript as of step `index`, or the live end (null). */
    show(index: number | null) {
      shownAt = index === null || index >= steps - 1 ? null : index
      draw(viewAt(chunks, shownAt, steps))
    },
    /** Replaces the transcript with another (a shared room's run), live end. */
    load(list: readonly Chunk[], count: number) {
      chunks = [...list]
      steps = count
      now = count
      atLineStart = chunks.length === 0 || chunks[chunks.length - 1]!.text.endsWith('\n')
      shownAt = null
      draw(chunks)
    },
    /** An `input()` is waiting: type at the prompt. */
    showInput() {
      if (!live()) this.show(null)
      line = startWaiting(line)
      term.focus()
    },
    /** No longer waiting: anything typed and not sent is rubbed out. */
    hideInput() {
      if (line.waiting && line.line) writeLive('\b \b'.repeat([...line.line].length))
      line = { ...line, waiting: false, line: '' }
    },
    fit,
    focus: () => term.focus(),
    chunks: (): readonly Chunk[] => chunks,
    text: () => transcript(chunks),
    engineText: () => engineText(chunks),
    /** The screen, as text, for tests: trailing blank lines dropped. */
    buffer(): string {
      const buf = term.buffer.active
      const lines: string[] = []
      for (let y = 0; y < buf.length; y++) lines.push(buf.getLine(y)?.translateToString(true) ?? '')
      return lines.join('\n').replace(/\n+$/, '')
    },
    isWaiting: () => line.waiting,
    /** The emulator itself, for tests (cells, rows) only. */
    term,
    dispose() {
      observer.disconnect()
      term.dispose()
    },
  }
}
