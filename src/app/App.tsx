/**
 * Wiring. One session, one scenario, one attempt at a time.
 *
 * The invariant that matters: every run reaches a terminal state on every
 * path. A run that never ends leaves `running` true and wedges every
 * control in the page.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { PythonSession } from '../runtime/session'
import type { StepRecord, TerminalRecord } from '../runtime/types'
import { formatDecoded } from '../runtime/decode'
import { assembleProgram } from '../game/scenario'
import { describeException, grade, type Verdict } from '../game/grader'
import { events } from '../game/events'
import { useCast } from '../game/director'
import { heavyParcels } from '../../content/scenarios/heavy-parcels'
import { Scene } from '../ui/Scene'
import { Editor } from '../ui/Editor'
import { MemoryPanel } from '../ui/MemoryPanel'
import { TerminalPane, useTerminal } from '../ui/Terminal'

const scenario = heavyParcels
const session = new PythonSession()

type Boot =
  | { state: 'booting' }
  | { state: 'ready'; isolated: boolean }
  | { state: 'failed'; message: string }

export function App() {
  const [boot, setBoot] = useState<Boot>({ state: 'booting' })
  const [solution, setSolution] = useState(scenario.starter)
  const [running, setRunning] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [index, setIndex] = useState(0)
  const [, rerender] = useReducer((x: number) => x + 1, 0)

  const stepsRef = useRef<StepRecord[]>([])
  const pendingOutRef = useRef<{ text: string; stream: 'stdout' | 'stderr' }[]>([])
  const followingRef = useRef(true)
  const rafRef = useRef<number | null>(null)
  const cast = useCast()
  const { containerRef, handle: term } = useTerminal()

  const { source, solutionStartLine, solutionEndLine } = assembleProgram(scenario, solution)

  // Boot eagerly with a trivial program: the first Run is then instant, boot
  // failure surfaces at load rather than mid-encounter, and the header tells
  // us the real isolation posture instead of us guessing at it.
  useEffect(() => {
    let cancelled = false
    events.emit({ type: 'runtime-booting' })
    session
      .run({ source: 'pass\n', options: { max_steps: 10, wall_clock_s: 30 }, onRecord: () => {} })
      .then((outcome) => {
        if (cancelled) return
        const isolated = outcome.header?.host.capabilities.cross_origin_isolated ?? false
        setBoot({ state: 'ready', isolated })
        events.emit({ type: 'runtime-ready', isolated })
        events.emit({ type: 'scenario-loaded', scenarioId: scenario.id })
        events.emit({ type: 'npc-spoke', text: scenario.npc.line })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setBoot({ state: 'failed', message })
        events.emit({ type: 'runtime-failed', message })
      })
    return () => {
      cancelled = true
    }
  }, [])

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
  }, [attempt, boot.state, running, source, solutionStartLine, term])

  const answer = verdict && 'answer' in verdict ? verdict.answer : null
  const robotLine =
    answer === null
      ? null
      : `These are over ${scenario.world.limit} kg: ${formatDecoded(answer)}`
  const highlighted = Array.isArray(answer)
    ? answer.filter((x): x is string => typeof x === 'string')
    : []

  return (
    <div className="app">
      <header className="topbar">
        <h1>BotGineer</h1>
        <span className="scenario-title">{scenario.title}</span>
        <span className="spacer" />
        <span className="badge" data-testid="boot-badge">
          {boot.state === 'booting' && 'starting Python…'}
          {boot.state === 'ready' && `Python ready · ${boot.isolated ? 'isolated' : 'degraded'}`}
          {boot.state === 'failed' && 'runtime failed'}
        </span>
      </header>

      {boot.state === 'failed' && (
        <p className="alert" role="alert">
          The Python runtime did not start: {boot.message}
        </p>
      )}

      <main className="layout">
        <div className="left">
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

        <div className="right">
          <div className="pane">
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
            <Editor
              preamble={scenario.preamble}
              harness={scenario.harness}
              solution={solution}
              disabled={running}
              onSolution={(next) => {
                setSolution(next)
                events.emit({ type: 'edited' })
              }}
            />
          </div>

          <div className="pane">
            <div className="pane-head">
              <span className="pane-title">Terminal</span>
            </div>
            <TerminalPane containerRef={containerRef} />
          </div>

          <div className="pane">
            <div className="pane-head">
              <span className="pane-title">Memory</span>
            </div>
            <MemoryPanel
              steps={stepsRef.current}
              index={Math.min(index, Math.max(0, stepsRef.current.length - 1))}
              onIndex={stopFollowing}
              solutionStartLine={solutionStartLine}
              solutionEndLine={solutionEndLine}
            />
          </div>
        </div>
      </main>
    </div>
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
