/**
 * Wiring. One session, one scenario, one attempt at a time.
 *
 * The invariant that matters: every run reaches a terminal state on every
 * path. A run that never ends leaves `running` true and wedges every
 * control in the page.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { session, useRuntime } from '../runtime/shared'
import type { StepRecord, TerminalRecord } from '../runtime/types'
import { formatDecoded } from '../runtime/decode'
import { assembleProgram } from '../game/scenario'
import { describeException, grade, type Verdict } from '../game/grader'
import { events } from '../game/events'
import { useCast } from '../game/director'
import { heavyParcels } from '../../content/scenarios/heavy-parcels'
import { Scene } from '../ui/Scene'
import { CodeEditor, type EditorApi } from '../ui/CodeEditor'
import { MemoryPanel } from '../ui/MemoryPanel'
import { TerminalPane, useTerminal } from '../ui/Terminal'
import { Gutter, useRemembered } from '../ui/Split'

const scenario = heavyParcels

export function Scenario() {
  const boot = useRuntime()
  const [solution, setSolution] = useState(scenario.starter)
  const [running, setRunning] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [index, setIndex] = useState(0)
  const [, rerender] = useReducer((x: number) => x + 1, 0)

  // Three panes in one column always squeezes something, so the split is
  // the player's, and it is remembered.
  const [leftW, setLeftW] = useRemembered('botgineer.split.left', 470)
  const [termH, setTermH] = useRemembered('botgineer.split.terminal', 150)
  const [memH, setMemH] = useRemembered('botgineer.split.memory', 240)

  const stepsRef = useRef<StepRecord[]>([])
  const pendingOutRef = useRef<{ text: string; stream: 'stdout' | 'stderr' }[]>([])
  const followingRef = useRef(true)
  const rafRef = useRef<number | null>(null)
  const editorRef = useRef<EditorApi | null>(null)
  const cast = useCast()
  const { containerRef, handle: term } = useTerminal()

  // The editor owns the program text after mount, so the head/tail it locks
  // must be the same strings the runtime runs. Both come from here.
  const program = useMemo(() => assembleProgram(scenario, solution), [solution])
  const { head, tail, source, solutionStartLine, solutionEndLine } = program

  // The runtime boots once for the whole page; this screen only opens the
  // encounter when it is up.
  useEffect(() => {
    if (boot.state !== 'ready') return
    events.emit({ type: 'scenario-loaded', scenarioId: scenario.id })
    events.emit({ type: 'npc-spoke', text: scenario.npc.line })
  }, [boot.state])

  const stopFollowing = useCallback((i: number) => {
    followingRef.current = false
    setIndex(i)
  }, [])

  const run = useCallback(async () => {
    if (running || boot.state !== 'ready') return

    // Reset per-run state only after we know we are allowed to run.
    setRunning(true)
    setVerdict(null)
    stepsRef.current = []
    pendingOutRef.current = []
    followingRef.current = true
    setIndex(0)
    term.clear()

    const next = attempt + 1
    setAttempt(next)
    events.emit({ type: 'attempt-started', scenarioId: scenario.id, attempt: next })

    // Never render inside onRecord: records arrive at thousands per second.
    // The frame loop shows the latest step at most once per animation frame.
    const flushOutput = () => {
      for (const chunk of pendingOutRef.current) term.write(chunk.text, chunk.stream)
      pendingOutRef.current = []
    }
    const pump = () => {
      flushOutput()
      if (followingRef.current) setIndex(Math.max(0, stepsRef.current.length - 1))
      rerender()
      rafRef.current = requestAnimationFrame(pump)
    }
    rafRef.current = requestAnimationFrame(pump)

    let terminal: TerminalRecord | null = null
    try {
      const outcome = await session.run({
        source,
        options: scenario.options,
        onRecord: (r) => {
          if (r.kind !== 'step') return
          stepsRef.current.push(r)
          // Program output rides on the step, as a delta. Queue it and let
          // the frame loop flush: a print-heavy program emits thousands of
          // these, and writing per record is how the tab locks up.
          const { stdout_delta: out, stderr_delta: err } = r.output
          if (out) pendingOutRef.current.push({ text: out, stream: 'stdout' })
          if (err) pendingOutRef.current.push({ text: err, stream: 'stderr' })
        },
      })
      terminal = outcome.terminal
    } catch (err) {
      term.write(`\n${err instanceof Error ? err.message : String(err)}\n`, 'stderr')
    } finally {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      flushOutput()
      if (followingRef.current) setIndex(Math.max(0, stepsRef.current.length - 1))
      rerender()
      setRunning(false)
    }

    // PyTrace reports an uncaught exception in the terminal record, not on
    // stderr, so the console would otherwise stay silent on a crash.
    if (terminal?.reason === 'uncaught_exception') {
      term.write(
        `\n${describeException(terminal.exception, stepsRef.current, solutionStartLine)}\n`,
        'stderr',
      )
    }

    const v = grade(scenario, stepsRef.current, terminal, solutionStartLine)
    setVerdict(v)
    if (terminal) {
      events.emit({
        type: 'run-ended',
        reason: terminal.reason,
        traceComplete: terminal.trace_complete,
      })
    }
    events.emit({
      type: 'attempt-graded',
      scenarioId: scenario.id,
      passed: v.status === 'passed',
      misconception: v.status === 'failed' ? v.misconception : null,
    })
  }, [attempt, boot.state, running, solutionStartLine, source, term])

  const steps = stepsRef.current
  const shown = Math.min(index, Math.max(0, steps.length - 1))
  const currentStep = steps[shown]
  // The trace drives the editor highlight; the editor never drives the trace.
  const traceLine =
    currentStep && currentStep.location.module === '__main__' ? currentStep.location.line : null

  // A small, stable debug surface. The browser tests assert through this
  // instead of typing into a contenteditable; keep the shape stable.
  useEffect(() => {
    const api = {
      setSolution: (text: string) => editorRef.current?.replace(text),
      getSolution: () => solution,
      run: () => run(),
      state: () => ({
        boot: boot.state,
        running,
        verdict: verdict?.status ?? null,
        steps: stepsRef.current.length,
      }),
    }
    ;(window as unknown as { botgineer: typeof api }).botgineer = api
  }, [boot.state, run, running, solution, verdict])

  const answer = verdict && 'answer' in verdict ? verdict.answer : null
  const robotLine =
    answer === null ? null : `These are over ${scenario.world.limit} kg: ${formatDecoded(answer)}`
  const highlighted = Array.isArray(answer)
    ? answer.filter((x): x is string => typeof x === 'string')
    : []

  return (
    <>
      <main className="layout" style={{ ['--left-w' as string]: `${leftW}px` }}>
        <div className="column left">
          <Scene
            cast={cast}
            npcName={scenario.npc.name}
            npcLine={scenario.npc.line}
            robotLine={robotLine}
            world={scenario.world}
            highlighted={highlighted}
          />
          {verdict && <Feedback verdict={verdict} />}
        </div>

        <Gutter
          orientation="vertical"
          value={leftW}
          onChange={setLeftW}
          min={320}
          max={900}
          label="Resize the scene"
        />

        <div className="column right">
          <section className="pane grow">
            <div className="pane-head">
              <span className="pane-title">Your code</span>
              <button
                className="primary"
                onClick={() => void run()}
                disabled={running || boot.state !== 'ready'}
                data-testid="run"
              >
                {running ? 'Running…' : 'Run the robot'}
              </button>
              <button onClick={() => session.interrupt()} disabled={!running} data-testid="stop">
                Stop
              </button>
            </div>
            <CodeEditor
              head={head}
              tail={tail}
              solution={solution}
              disabled={running}
              traceLine={traceLine}
              onReady={(api) => {
                editorRef.current = api
              }}
              onSolution={(next) => {
                setSolution(next)
                events.emit({ type: 'edited' })
              }}
            />
          </section>

          <Gutter
            orientation="horizontal"
            value={termH}
            onChange={setTermH}
            min={80}
            max={520}
            invert
            label="Resize the terminal"
          />

          <section className="pane fixed" style={{ height: `${termH}px` }}>
            <div className="pane-head">
              <span className="pane-title">Terminal</span>
              <span className="pane-note">what the robot printed</span>
            </div>
            <TerminalPane containerRef={containerRef} />
          </section>

          <Gutter
            orientation="horizontal"
            value={memH}
            onChange={setMemH}
            min={120}
            max={640}
            invert
            label="Resize the memory panel"
          />

          <section className="pane fixed" style={{ height: `${memH}px` }}>
            <div className="pane-head">
              <span className="pane-title">Memory</span>
              <span className="pane-note">what Python actually did</span>
            </div>
            <MemoryPanel
              steps={steps}
              index={shown}
              onIndex={stopFollowing}
              solutionStartLine={solutionStartLine}
              solutionEndLine={solutionEndLine}
            />
          </section>
        </div>
      </main>
    </>
  )
}

/** Every verdict is text. Character expressions are redundant with this,
 *  never a substitute for it. */
function Feedback({ verdict }: { verdict: Verdict }) {
  const tone = verdict.status === 'passed' ? 'good' : verdict.status === 'crashed' ? 'bad' : 'warn'
  const text =
    verdict.status === 'passed'
      ? 'Correct. Mira has what she needs.'
      : verdict.status === 'crashed'
        ? `${verdict.message} (${verdict.detail})`
        : verdict.message
  return (
    <p
      className={`feedback ${tone}`}
      role="status"
      data-testid="feedback"
      data-status={verdict.status}
    >
      {text}
    </p>
  )
}
