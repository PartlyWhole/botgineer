/**
 * The workbench: one snapshot, several views.
 *
 *   (B) the robot interface is the only thing that causes anything
 *   (A) the scene and the memory view are views of what it produced
 *
 * Because they read the same extracted snapshot, they cannot disagree —
 * and the step slider moves them together, so scrubbing rewinds the
 * picture as well as the diagram.
 *
 * ## Two ways to talk to the robot
 *
 * A beginner gets a **console**: one line, one answer. Later activities
 * unlock the **editor**, which hands over a whole program at once.
 *
 * They are not two engines. The engine only ever runs whole programs, so
 * the console works by replay — it keeps the lines the robot accepted and
 * re-runs all of them plus the new one, every time (see `repl/program`).
 * The happy consequence is that the console's history *is* a program, so
 * unlocking the editor later is a change of instrument, not of substance.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { session, useRuntime } from '../runtime/shared'
import type { StepRecord, TerminalRecord } from '../runtime/types'
import { extractMemory, keptValues } from '../memory/extract'
import { useHandles } from '../memory/handles'
import { EMPTY, type MemorySnapshot } from '../memory/model'
import { buildProgram, isExpression, type Entry } from '../repl/program'
import { events } from '../game/events'
import { useCast } from '../game/director'
import type { Activity } from '../../content/activities'
import { LESSONS, guidance, progress } from '../../content/lessons'
import { goTo } from './router'
import { ScenePanel } from '../panels/ScenePanel'
import { MemoryPanel } from '../panels/MemoryPanel'
import { MemoryRail } from '../panels/MemoryRail'
import { RobotPanel, type RobotView, type Transcript } from '../panels/RobotPanel'
import type { Exchange } from '../ui/RobotConsole'
import type { EditorApi } from '../ui/CodeEditor'
import { Gutter, useRemembered } from '../ui/Split'

/** What one call to the engine came back with. `output` is everything the
 *  whole program printed — replay included. Separating out the part the
 *  new line is responsible for is the console's job, not the engine's. */
type Outcome = {
  terminal: TerminalRecord | null
  threw: string | null
  output: string
  ok: boolean
}

export function Workbench({ activity }: { activity: Activity }) {
  const boot = useRuntime()
  const cast = useCast()
  const talking = activity.mode === 'console'

  const [program, setProgram] = useState(activity.starter)
  const [busy, setBusy] = useState(false)
  const [index, setIndex] = useState(0)
  const [transcript, setTranscript] = useState<Transcript[]>([])
  /** Lines the robot accepted, replayed ahead of every new one. */
  const [history, setHistory] = useState<Entry[]>([])
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  /** Memory after each accepted line. A lesson step asks what was *ever*
   *  true, because memory itself is not monotonic — rebinding a name
   *  un-answers a question the player has already answered. */
  const [lineMemory, setLineMemory] = useState<MemorySnapshot[]>([])
  /** Bumped per run. Object handles are assigned on first sight and kept
   *  for a whole run, so they must start over when a new one does. */
  const [runSeq, setRunSeq] = useState(0)
  const [, rerender] = useReducer((x: number) => x + 1, 0)

  const [sceneW, setSceneW] = useRemembered('botgineer.wb.scene', 560)
  const [view, setView] = useState<RobotView>('code')

  const stepsRef = useRef<StepRecord[]>([])
  const followingRef = useRef(true)
  const rafRef = useRef<number | null>(null)
  const editorRef = useRef<EditorApi | null>(null)
  const historyRef = useRef(history)
  historyRef.current = history
  /** Everything the accepted history prints when replayed. The next run
   *  starts by printing exactly this again. */
  const spokenRef = useRef('')
  /** How many values the accepted history has kept. A line only has
   *  something to echo if it added one. */
  const keptRef = useRef(0)
  const programRef = useRef(program)
  programRef.current = program

  // A new activity is a new scene, a new program and a fresh memory.
  useEffect(() => {
    stepsRef.current = []
    setIndex(0)
    setTranscript([])
    setHistory([])
    setExchanges([])
    setLineMemory([])
    spokenRef.current = ''
    keptRef.current = 0
    setProgram(activity.starter)
    editorRef.current?.replace(activity.starter)
    events.emit({ type: 'scenario-loaded', scenarioId: activity.id })
  }, [activity])

  const steps = stepsRef.current
  const shown = Math.min(index, Math.max(0, steps.length - 1))
  const snapshot = useMemo(
    () => (steps.length === 0 ? EMPTY : extractMemory(steps[shown])),
    // The array is mutated in place during a run; `rerender` is what makes
    // this recompute, so the length and index are the honest dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps.length, shown],
  )

  /**
   * Runs one program to completion.
   *
   * The only thing that calls the engine. Both instruments go through it,
   * so the run guard, the frame pump and the "every path reaches a
   * terminal state" promise are written once.
   */
  const execute = useCallback(
    async (source: string): Promise<Outcome> => {
      setBusy(true)
      stepsRef.current = []
      followingRef.current = true
      setIndex(0)
      setRunSeq((n) => n + 1)
      events.emit({ type: 'attempt-started', scenarioId: activity.id, attempt: 1 })

      const pending: Transcript[] = []
      const flush = () => {
        if (pending.length === 0) return
        const batch = pending.splice(0, pending.length)
        setTranscript((t) => [...t, ...batch])
      }

      // Never render inside onRecord: records arrive far faster than frames.
      const pump = () => {
        flush()
        if (followingRef.current) setIndex(Math.max(0, stepsRef.current.length - 1))
        rerender()
        rafRef.current = requestAnimationFrame(pump)
      }
      rafRef.current = requestAnimationFrame(pump)

      let output = ''

      let terminal: TerminalRecord | null = null
      let threw: string | null = null
      try {
        const outcome = await session.run({
          source,
          options: activity.options,
          onRecord: (r) => {
            if (r.kind !== 'step') return
            stepsRef.current.push(r)
            const { stdout_delta: out, stderr_delta: err } = r.output
            output += out + err
            if (out) pending.push({ kind: 'out', text: out })
            if (err) pending.push({ kind: 'err', text: err })
          },
        })
        terminal = outcome.terminal
      } catch (err) {
        threw = err instanceof Error ? err.message : String(err)
      } finally {
        // Every path — success, throw, interrupt — ends the run.
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        flush()
        if (followingRef.current) setIndex(Math.max(0, stepsRef.current.length - 1))
        rerender()
        setBusy(false)
      }

      const ok = threw === null && terminal?.reason === 'completed'
      if (terminal) {
        events.emit({
          type: 'run-ended',
          reason: terminal.reason,
          traceComplete: terminal.trace_complete,
        })
      }
      events.emit({
        type: 'attempt-graded',
        scenarioId: activity.id,
        passed: ok,
        misconception: null,
      })

      return { terminal, threw, output, ok }
    },
    [activity],
  )

  /** The editor's instrument: hand over the whole program. */
  const run = useCallback(async () => {
    if (busy || boot.state !== 'ready') return
    // The editor owns the text. Asking React for it would run whatever was
    // last rendered, which is not necessarily what is on screen.
    const source = editorRef.current?.read() ?? programRef.current
    setTranscript([])
    const outcome = await execute(source)
    setTranscript((t) => [
      ...t,
      { kind: outcome.ok ? 'note' : 'err', text: outcomeLine(outcome.threw, outcome.terminal) },
    ])
  }, [boot.state, busy, execute])

  /**
   * The console's instrument: say one thing.
   *
   * A line that does not complete is *not* kept, so the history only ever
   * contains lines that worked — which is what makes replay safe, and is
   * also what a terminal REPL does.
   */
  const say = useCallback(
    async (source: string) => {
      if (busy || boot.state !== 'ready') return
      const entry: Entry = { source, echo: isExpression(source) }
      const built = buildProgram(historyRef.current, entry)

      const outcome = await execute(built.source)

      // Replay re-prints everything the history printed. Attributing
      // output by line number does not work — a step carries the output
      // produced *before* it, so the pending line's first step arrives
      // holding the previous line's text. What does work is that replay is
      // deterministic: this run's output begins with the last one's, and
      // the remainder is what the new line said. If the program is
      // nondeterministic the prefix will not match, and showing the whole
      // thing is the honest fallback.
      const before = spokenRef.current
      const fresh = outcome.output.startsWith(before)
        ? outcome.output.slice(before.length)
        : outcome.output

      const last = stepsRef.current[stepsRef.current.length - 1]
      const kept = keptValues(last)
      // Echo only what *this* line made. Counting is what distinguishes
      // `3 + 4`, which adds a value, from `print("hi")`, which evaluates
      // to None, keeps nothing, and in any REPL worth using says nothing.
      const made = outcome.ok && entry.echo && kept.length > keptRef.current
      const echo = made ? (kept[kept.length - 1] ?? null) : null

      setExchanges((xs) => [
        ...xs,
        {
          id: xs.length,
          source,
          echo,
          output: fresh,
          error: outcome.ok ? null : outcomeLine(outcome.threw, outcome.terminal),
        },
      ])
      // Only an accepted line joins the history, so only its output becomes
      // part of what the next replay is expected to repeat.
      if (outcome.ok) {
        spokenRef.current = outcome.output
        keptRef.current = kept.length
        setHistory((h) => [...h, entry])
        setLineMemory((m) => [...m, extractMemory(last)])
      }
    },
    [boot.state, busy, execute],
  )

  // The guide reads the same snapshot as everything else, so it rewinds
  // with the scrubber and cannot claim progress the robot does not have.
  // One numbering for every view that shows a handle — the rail and the
  // graph must not disagree about which object is `obj3`.
  //
  // A console session is one continuous memory, so handles have to
  // survive each submission; only the editor starts over per run.
  const runKey = talking ? `${activity.id}:talk` : `${activity.id}:${runSeq}`
  const handles = useHandles(snapshot, runKey)

  const lesson = activity.lesson ? (LESSONS[activity.lesson] ?? null) : null
  // A step may ask the player to *retrieve* something, which leaves no
  // trace in memory — so the evidence includes everything the robot has
  // said back. Both halves only ever grow.
  const evidence = useMemo(
    () => ({
      snapshot,
      echoed: exchanges.map((x) => x.echo).filter((e): e is string => e !== null),
      history: [...lineMemory, snapshot],
    }),
    [snapshot, exchanges, lineMemory],
  )
  const guide = lesson ? guidance(lesson, evidence) : undefined
  // The whole progression: the guide offers the next lesson once this one
  // is genuinely done. Derived like everything else, so scrubbing back
  // through the trace withdraws the offer too.
  const finished = lesson !== null && progress(lesson, evidence) === lesson.steps.length
  // Offered whenever there is somewhere to go; the scene decides *when* to
  // show it, because it is the thing that knows whether this activity is
  // finished (a lesson's last step, or a satisfied set of watches).
  const nextId = activity.next
  const onAdvance = nextId ? () => goTo(nextId) : undefined

  const currentStep = steps[shown]
  const traceLine = currentStep?.location.module === '__main__' ? currentStep.location.line : null

  // A small, stable surface the browser tests drive.
  useEffect(() => {
    const api = {
      setProgram: (text: string) => editorRef.current?.replace(text),
      getProgram: () => editorRef.current?.read() ?? programRef.current,
      run: () => run(),
      /** The console's equivalent of typing a line and pressing Enter. */
      say: (line: string) => say(line),
      snapshot: () => snapshot,
      state: () => ({
        boot: boot.state,
        busy,
        steps: stepsRef.current.length,
        mode: activity.mode,
        history: historyRef.current.map((e) => e.source),
      }),
    }
    ;(window as unknown as { botgineer: typeof api }).botgineer = api
  }, [activity.mode, boot.state, busy, run, say, snapshot])

  return (
    <main className="workbench" style={{ ['--scene-w' as string]: `${sceneW}px` }}>
      <section className="pane scene-pane">
        <div className="pane-head">
          <span className="pane-title">Scene</span>
        </div>
        <ScenePanel
          spec={activity.scene}
          snapshot={snapshot}
          mood={cast.robot}
          guide={guide}
          onAdvance={onAdvance}
          // `undefined` when there is no lesson, so the scene judges
          // itself instead of being told it has finished nothing.
          triumph={lesson ? finished : undefined}
        />
      </section>

      <Gutter
        orientation="vertical"
        value={sceneW}
        onChange={setSceneW}
        min={320}
        max={900}
        label="Resize the scene"
      />

      <section className="pane robot-pane">
        <div className="pane-head">
          <span className="pane-title">Robot</span>
          <span className="spacer" />
          <div className="views-switch" role="group" aria-label="Robot view">
            {(['code', 'memory'] as RobotView[]).map((v) => (
              <button
                key={v}
                type="button"
                className={v === view ? 'current' : ''}
                aria-pressed={v === view}
                data-testid={`view-${v}`}
                onClick={() => setView(v)}
              >
                {v === 'code' ? (talking ? 'Talk' : 'Code') : 'Memory'}
              </button>
            ))}
          </div>
        </div>
        <RobotPanel
          view={view}
          mode={activity.mode}
          memory={<MemoryPanel snapshot={snapshot} handles={handles} runKey={runKey} />}
          rail={<MemoryRail snapshot={snapshot} handles={handles} />}
          program={program}
          onProgram={setProgram}
          onReady={(api) => {
            editorRef.current = api
          }}
          onRun={() => void run()}
          onStop={() => session.interrupt()}
          exchanges={exchanges}
          onSay={(line) => void say(line)}
          greeting={activity.greeting}
          busy={busy}
          disabled={boot.state !== 'ready'}
          transcript={transcript}
          index={shown}
          total={steps.length}
          onIndex={(i) => {
            followingRef.current = false
            setIndex(i)
          }}
          traceLine={traceLine}
        />
      </section>
    </main>
  )
}

function outcomeLine(threw: string | null, terminal: TerminalRecord | null): string {
  if (threw) return threw
  if (!terminal) return 'The run ended without saying how.'
  switch (terminal.reason) {
    case 'completed':
      return 'Done.'
    case 'uncaught_exception':
      return `${terminal.exception?.type_name ?? 'Error'} — the robot stopped there.`
    case 'step_limit':
    case 'trace_limit':
      return 'Ran out of steps. A loop probably never finished.'
    case 'interrupted':
    case 'killed':
      return 'Stopped.'
    default:
      return `The run ended (${terminal.reason}).`
  }
}
