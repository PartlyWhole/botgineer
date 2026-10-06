/**
 * The sandbox (`#/code`; `#/sandbox` is v1's first level): the editor on the left, memory on the right,
 * and nothing else. No lesson, no scene, no crow.
 *
 * A run does not play itself. It runs to the end quietly, then opens on
 * its **first step**, and the learner walks it: the scrubber, or the step
 * buttons (first, back, forward, last). Memory, the line marks and the
 * output all show the run *as of the step shown*, so stepping forward is
 * watching each line happen to memory. Following the run live, as the
 * workbench does, would show only the end.
 *
 * Editing the program puts the run away: its marks and memory describe a
 * program that is no longer on screen.
 *
 * It is the same engine, the same `extract.ts` translation and the same
 * views as the workbench (invariants 2 and 3); only the layout and the
 * transport's starting point differ.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { session, useRuntime } from '../runtime/shared'
import type { StepRecord, TerminalRecord } from '../runtime/types'
import { extractMemory, reachedBy, runOf } from '../memory/extract'
import { useHandles } from '../memory/handles'
import { EMPTY } from '../memory/model'
import { CodeEditor, type EditorApi } from '../ui/CodeEditor'
import type { LineMarks } from '../ui/editorLines'
import { MemoryPanel } from '../panels/MemoryPanel'
import { EditorTransport, OutputLog, type Transcript } from '../panels/RobotPanel'
import { Gutter, useRemembered, useStacked } from '../ui/Split'

const STARTER = `backpack = ["map", "torch"]
coins = 12
for item in ["gem", "key"]:
    backpack.append(item)
    coins = coins + 5
bag = backpack
print(bag, coins)
`

const OPTIONS = { max_steps: 3000, wall_clock_s: 15 }

type Done = {
  /** The text that ran, so an edit can tell the run is stale. */
  source: string
  terminal: TerminalRecord | null
  threw: string | null
}

export function Sandbox() {
  const boot = useRuntime()
  const stacked = useStacked()
  const [codeW, setCodeW] = useRemembered('botgineer.sb.code', NaN)
  const codeRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<EditorApi | null>(null)

  const [program, setProgram] = useState(STARTER)
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState<StepRecord[]>([])
  const [done, setDone] = useState<Done | null>(null)
  const [index, setIndex] = useState(0)
  const [runSeq, setRunSeq] = useState(0)

  const run = useCallback(async () => {
    if (busy || boot.state !== 'ready') return
    // The editor owns the text (invariant 7).
    const source = editorRef.current?.read() ?? program
    setBusy(true)
    setSteps([])
    setDone(null)
    setIndex(0)
    // Records go to a plain array, and the views see them once, at the end:
    // the run is walked afterwards, never watched live (invariant 6).
    const got: StepRecord[] = []
    let terminal: TerminalRecord | null = null
    let threw: string | null = null
    try {
      const outcome = await session.run({
        source,
        options: OPTIONS,
        onRecord: (r) => {
          if (r.kind === 'step') got.push(r)
        },
      })
      terminal = outcome.terminal
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err)
    } finally {
      // Every path ends the run (invariant 5), and opens it on step 0.
      setSteps(got)
      setDone({ source, terminal, threw })
      setIndex(0)
      setRunSeq((n) => n + 1)
      setBusy(false)
    }
  }, [boot.state, busy, program])

  // An edit puts the run away.
  const onProgram = useCallback((next: string) => {
    setProgram(next)
    setDone((d) => (d && d.source !== next ? null : d))
  }, [])
  const live = done !== null
  const total = live ? steps.length : 0
  const shown = Math.min(index, Math.max(0, total - 1))
  const atEnd = total > 0 && shown >= total - 1

  const snapshot = useMemo(() => (live && total > 0 ? extractMemory(steps[shown]!) : EMPTY), [live, total, steps, shown])
  const handles = useHandles(snapshot, `sandbox:${runSeq}`)
  const summary = useMemo(() => (done ? runOf(steps, done.terminal) : null), [done, steps])

  const marks: LineMarks | null = useMemo(() => {
    if (!done || !summary) return null
    const stopped = summary.raised !== null && summary.line !== null
    const error = stopped ? { line: summary.line!, text: summary.raised === 'steps' ? 'never finished' : summary.raised! } : null
    // A program that never started (a `SyntaxError`) still has its line.
    if (total === 0) return error ? { ran: [], current: null, finished: true, error } : null
    const { ran, current } = reachedBy(steps, shown)
    return { ran, current: atEnd ? null : current, finished: atEnd, error: atEnd ? error : null }
  }, [done, summary, total, steps, shown, atEnd])

  // What the program had printed by the step shown, and at the end how it
  // ended. A step carries the output produced before it, so the last
  // step's own output is added once the end is reached.
  const transcript: Transcript[] = useMemo(() => {
    if (!done) return []
    const out: Transcript[] = []
    for (let i = 0; i <= shown && i < total; i++) {
      const { stdout_delta: o, stderr_delta: e } = steps[i]!.output
      if (o) out.push({ kind: 'out', text: o })
      if (e) out.push({ kind: 'err', text: e })
    }
    if (atEnd || total === 0) out.push({ kind: done.terminal?.reason === 'completed' ? 'note' : 'err', text: endLine(done) })
    return out
  }, [done, shown, total, steps, atEnd])

  const current = live && total > 0 ? steps[shown] : undefined
  const traceLine = current?.location.module === '__main__' ? current.location.line : null

  // A small surface for the browser tests, like the workbench's.
  const latest = useRef({ run, busy, shown, total, snapshot })
  latest.current = { run, busy, shown, total, snapshot }
  useEffect(() => {
    const api = {
      setProgram: (src: string) => editorRef.current?.replace(src),
      getProgram: () => editorRef.current?.read() ?? '',
      run: () => latest.current.run(),
      step: (i: number) => setIndex(i),
      snapshot: () => latest.current.snapshot,
      state: () => ({ boot: boot.state, busy: latest.current.busy, step: latest.current.shown, steps: latest.current.total, mode: 'sandbox' }),
    }
    ;(window as unknown as { botgineer: typeof api }).botgineer = api
  }, [boot.state])

  return (
    <main
      className="workbench sandbox"
      data-testid="code-sandbox"
      style={!stacked && Number.isFinite(codeW) ? { ['--code-w' as string]: `${codeW}px` } : undefined}
    >
      <section className="pane robot-panel" data-look="v2" data-mode="editor" data-busy={busy ? 'yes' : 'no'} aria-label="Sandbox">
        <div className="views">
          <div className="sandbox-code" ref={codeRef}>
            <div className="view instrument" data-testid="instrument">
              <CodeEditor
                solution={program}
                onSolution={onProgram}
                onReady={(api) => {
                  editorRef.current = api
                }}
                traceLine={traceLine}
                disabled={busy}
                look="v2"
                marks={marks}
                onRun={busy || boot.state !== 'ready' ? undefined : () => void run()}
              />
            </div>
            <EditorTransport
              onRun={() => void run()}
              onStop={() => session.interrupt()}
              busy={busy}
              canRun={!busy && boot.state === 'ready'}
              index={shown}
              total={total}
              onIndex={setIndex}
              pulse={false}
            />
            <OutputLog transcript={transcript} />
          </div>
          {!stacked && (
            <Gutter
              orientation="vertical"
              value={codeW}
              measure={() => codeRef.current?.offsetWidth ?? 520}
              onChange={setCodeW}
              min={320}
              max={1100}
              label="Resize the editor"
            />
          )}
          <div className="view memory-view" data-testid="memory-view">
            <MemoryPanel
              look="v2"
              snapshot={snapshot}
              handles={handles}
              runKey={`sandbox:${runSeq}`}
              emptyText={
                live && total > 0
                  ? shown === 0
                    ? 'Step 1: nothing has run yet. Step forward to watch memory fill.'
                    : 'Memory is empty at this step.'
                  : 'Press Run, then step through the program to watch memory fill.'
              }
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function endLine({ terminal, threw }: Done): string {
  if (threw) return threw
  switch (terminal?.reason) {
    case 'completed':
      return 'Done.'
    case 'uncaught_exception':
      return `${terminal.exception?.type_name ?? 'Error'}: the robot stopped there.`
    case 'step_limit':
    case 'trace_limit':
      return 'Ran out of steps. A loop probably never finished.'
    case 'interrupted':
    case 'killed':
      return 'Stopped.'
    default:
      return terminal ? `The run ended (${terminal.reason}).` : 'The run ended without saying how.'
  }
}
