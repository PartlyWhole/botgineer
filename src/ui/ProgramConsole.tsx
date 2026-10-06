/**
 * The program console, as a React component: mounts the terminal
 * (`console/terminal`) once and hands its methods to the page (`onReady`),
 * the way the code editor hands over its own. The page drives it: appends a
 * run's output as records arrive, never through React state (invariant 6),
 * and shows the step being walked.
 */
import { useEffect, useRef } from 'react'
import '@xterm/xterm/css/xterm.css'
import { createTerminal, type ConsoleOptions, type ProgramTerminal } from '../console/terminal'
import type { TerminalRecord } from '../runtime/types'

export function ProgramConsole({
  onReady,
  onInput,
  onInterrupt,
  height,
}: ConsoleOptions & {
  onReady: (api: ProgramTerminal) => void
  /** Its height in pixels; the terminal refits to it. */
  height?: number | undefined
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  // Read through refs: the terminal is built once, and its handlers must
  // reach the page's newest ones.
  const handlers = useRef({ onInput, onInterrupt, onReady })
  handlers.current = { onInput, onInterrupt, onReady }
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const api = createTerminal(host, {
      onInput: (line) => handlers.current.onInput(line),
      onInterrupt: () => handlers.current.onInterrupt(),
    })
    handlers.current.onReady(api)
    return () => api.dispose()
  }, [])
  return (
    <div
      className="program-console"
      data-testid="program-console"
      style={height !== undefined && Number.isFinite(height) ? { height } : undefined}
    >
      <div className="program-console-term" ref={hostRef} />
    </div>
  )
}

/** How a run ended, as a terminal says it (PLP's `END_NOTES`). */
export const END_NOTES: Record<string, string> = {
  completed: '── program finished ──',
  uncaught_exception: '── program crashed ──',
  interrupted: '── program stopped ──',
  killed: '── program stopped (hard kill: trace incomplete) ──',
  needs_input: '── the program asked for input, but this page cannot take typing (it is not cross-origin isolated) ──',
  step_limit: '── stopped: the robot ran out of steps (a loop that never ends?) ──',
  trace_limit: '── stopped: the run got too big to record ──',
  engine_error: '── the robot hit an internal error ──',
}

/** Diagnostics every browser run has (no CPU or memory limits in wasm):
 *  not worth a line. */
export const QUIET_DIAGNOSTICS = new Set(['host_limit_unavailable'])

/** The closing lines: the exception, if one stopped the program, then how
 *  it ended (PLP's `renderRunEnd`). `line` is where the run stopped, for an
 *  exception the engine did not place. */
export function writeRunEnd(con: ProgramTerminal, terminal: TerminalRecord | null, threw: string | null, line?: number | null): void {
  if (threw) return void con.system(`run failed: ${threw}`)
  const ex = terminal?.exception
  // The engine does not always say where; the run's own last line does.
  const at = ex?.location?.module === '__main__' ? ex.location.line : (line ?? null)
  if (ex) con.append('stderr', `${ex.type_name}${ex.safe_message ? `: ${ex.safe_message}` : ''}${at !== null ? ` (line ${at})` : ''}\n`)
  const reason = terminal?.reason ?? 'engine_error'
  con.system(END_NOTES[reason] ?? `── ended: ${reason} ──`)
}
