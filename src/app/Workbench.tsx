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
import { extractMemory, reachedBy, runEvidence, runOf, thought, type RunEvidence } from '../memory/extract'
import { useHandles } from '../memory/handles'
import { EMPTY, type MemorySnapshot } from '../memory/model'
import { buildProgram, isExpression, type Entry } from '../repl/program'
import { events } from '../game/events'
import { useCast } from '../game/director'
import type { Activity } from '../../content/activities'
import {
  NO_CAST,
  lessonFor,
  castAt,
  cloud,
  script,
  staging as stageOf,
  type CloudFrom,
  type Heard,
  type Line,
  type LineMemory,
  type Pick,
  type Run,
  type ScriptItem,
  type Spoken,
  withCase,
  wipedBy,
} from '../../content/lessons'
import { NO_STAGING } from '../scene/props'
import { goToMap } from './router'
import { usePractice } from '../practice/usePractice'
import type { Attempt } from '../practice/exercises'
import { skillsOfUnit } from '../../content/concepts'
import { useReadLevel } from './useReadLevel'
import { ReadPanel } from '../panels/ReadPanel'
import { ReadSheet } from '../panels/ReadSheet'
import { IdeasSheet } from '../panels/IdeasSheet'
import { IdeasPanel } from '../panels/IdeasPanel'
import type { ReadEnv } from '../collection/useReadSession'
import type { Answer, Stage } from '../collection/model'
import { modelAnswer } from '../collection/runner'
import { finishedLevels, markDone } from '../progress/progress'
import { readScene } from '../scene/spec'
import { ScenePanel, type Telling } from '../panels/ScenePanel'
import { hasExamples, noteAt, raisedNote, readTo, sectionsOf, type Reach } from '../collection/voice'
import { MemoryPanel } from '../panels/MemoryPanel'
import { CROW_NAME } from '../../content/cast'
import { RobotPanel, type Transcript } from '../panels/RobotPanel'
import type { Demo, DemoLine } from '../ui/demo'
import type { Exchange } from '../ui/RobotConsole'
import type { EditorApi } from '../ui/CodeEditor'
import type { LineMarks } from '../ui/editorLines'
import { Gutter, STACKED, useRemembered, useStacked } from '../ui/Split'
import type { RoomView } from '../collab/useRoom'
import type { LessonEvent, LessonInput } from '../collab/room'
import { RoomBar } from '../collab/RoomBar'
import { setPeers, sharedEditor } from '../collab/editor'
import { pageSeed } from '../../content/lessons/seed'
import { useSyncedSize } from '../collab/sizes'

/** What one call to the engine came back with. `output` is everything the
 *  whole program printed — replay included. Separating out the part the
 *  new line is responsible for is the console's job, not the engine's. */
/** What the editor shows of a run, line by line (`ui/editorLines`). */
type Marks = LineMarks

type Outcome = {
  terminal: TerminalRecord | null
  threw: string | null
  output: string
  ok: boolean
}

export function Workbench({
  activity,
  roomView,
  onDiverged,
}: {
  activity: Activity
  /** The page's shared room (`collab/`), if any. */
  roomView?: RoomView | undefined
  /** Two peers' events crossed in the room's log: start over and replay. */
  onDiverged?: (() => void) | undefined
}) {
  const room = roomView?.room ?? null
  const boot = useRuntime()
  const cast = useCast()
  const talking = activity.mode === 'console'
  const reading = activity.mode === 'read'

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
  const [lineMemory, setLineMemory] = useState<LineMemory[]>([])
  /** Bumped per run. Object handles are assigned on first sight and kept
   *  for a whole run, so they must start over when a new one does. */
  const [runSeq, setRunSeq] = useState(0)
  /** Bumped when the console starts over inside one activity — a practice
   *  session gives every exercise a clean memory, and the handles and the
   *  grid must start over with it. */
  const [epoch, setEpoch] = useState(0)
  const [, rerender] = useReducer((x: number) => x + 1, 0)

  const [sceneW, setSceneW] = useRemembered('botgineer.wb.scene', 560)
  const benchRef = useRef<HTMLElement | null>(null)
  // In a shared room, the split moves on every screen (`collab/sizes`).
  const setSceneShared = useSyncedSize('scene', setSceneW, () => benchRef.current?.offsetWidth ?? 0)

  const stepsRef = useRef<StepRecord[]>([])
  const followingRef = useRef(true)
  const rafRef = useRef<number | null>(null)
  const editorRef = useRef<EditorApi | null>(null)
  const historyRef = useRef(history)
  historyRef.current = history
  /** Everything the accepted history prints when replayed. The next run
   *  starts by printing exactly this again. */
  const spokenRef = useRef('')
  /** Everything the robot has worked out, in order. Not memory: a bare
   *  expression's value is gone the moment the line ends, and only this
   *  description of it survives. The lessons about primitives and
   *  operations are judged on these. */
  const [thoughts, setThoughts] = useState<Heard[]>([])
  /** The last line typed, worked or not. A lesson's reply to a miss reads
   *  it, and so does the picture on the stage; progress never does. */
  const [lastLine, setLastLine] = useState<Line | null>(null)
  /** Multiple-choice answers picked, and the one just picked. Like
   *  `thoughts`, only grown within a visit, and never stored. */
  const [picks, setPicks] = useState<Pick[]>([])
  const [lastPick, setLastPick] = useState<Pick | null>(null)
  /** An editor lesson's runs of the player's program (`Evidence.runs`). */
  const [runs, setRuns] = useState<Run[]>([])
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
    setThoughts([])
    setLastLine(null)
    setPicks([])
    setLastPick(null)
    setRuns([])
    spokenRef.current = ''
    setProgram(activity.starter)
    editorRef.current?.replace(activity.starter)
    events.emit({ type: 'scenario-loaded', scenarioId: activity.id })
  }, [activity])

  const steps = stepsRef.current
  const shown = Math.min(index, Math.max(0, steps.length - 1))
  const live = useMemo(
    () => (steps.length === 0 ? EMPTY : extractMemory(steps[shown])),
    // The array is mutated in place during a run; `rerender` is what makes
    // this recompute, so the length and index are the honest dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps.length, shown],
  )
  // While the console replays, every view keeps showing memory as the last
  // accepted line left it. The replay starts from nothing and rebuilds
  // everything the player already has, one step at a time — true of the
  // engine, and not something anyone asked to watch. Shown live, memory
  // emptied and refilled on every Enter, and the scene flickered back to
  // its unset state with it.
  //
  // And after a line that failed, too. A failed line is never kept, so the
  // robot's memory is still what the last accepted line left: an
  // `IndentationError` never ran a step, and showing its empty run said
  // "Memory is empty" about a robot that still had everything. The console
  // has no scrubber, so the last accepted memory is simply what it shows.
  const snapshot = talking ? (lineMemory[lineMemory.length - 1]?.memory ?? EMPTY) : live
  /** A v2 editor lesson is judged on its runs, as a console lesson is on
   *  its lines: what memory a run *left*, not where the scrubber is. */
  const judgedOnRuns = activity.mode === 'editor' && activity.version === 2 && activity.lesson !== undefined

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

  /**
   * Reading runs more than one program per item — each snippet, Python's
   * own block finder, a checker after a repair — and some of them are not
   * for showing. They are queued, so a run the player asked to see and one
   * the grader needs can never be in flight at once (invariant 5: the
   * engine takes one run at a time, and the second would be rejected).
   */
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(fn, fn)
    queue.current = next.catch(() => {})
    return next
  }, [])

  /** A run nobody watches: its evidence, for grading. */
  const quiet = useCallback(
    (source: string, opts?: { max_steps?: number }): Promise<RunEvidence> =>
      enqueue(async () => {
        const steps: StepRecord[] = []
        let terminal: TerminalRecord | null = null
        try {
          const outcome = await session.run({
            source,
            options: { ...activity.options, ...(opts?.max_steps ? { max_steps: opts.max_steps } : {}) },
            onRecord: (r) => {
              if (r.kind === 'step') steps.push(r)
            },
          })
          terminal = outcome.terminal
        } catch {
          // A run that could not start is evidence of nothing; the grader
          // sees an engine error rather than a wrong answer.
        }
        return runEvidence(steps, terminal)
      }),
    [activity.options, enqueue],
  )

  /** A run the player watches: memory, the scrubber and the output. */
  const show = useCallback(
    (source: string): Promise<void> =>
      enqueue(async () => {
        setTranscript([])
        const outcome = await execute(source)
        setTranscript((t) => [...t, { kind: outcome.ok ? 'note' : 'err', text: outcomeLine(outcome.threw, outcome.terminal) }])
      }),
    [enqueue, execute],
  )

  const readEnv = useMemo<ReadEnv>(() => ({ evaluate: quiet, show, ready: boot.state === 'ready' }), [quiet, show, boot.state])
  const read = useReadLevel(activity, readEnv)
  // A new reading item opens with nothing shown (invariant 22): memory
  // empty, no scrubber, no output. The last item's run is cleared through
  // the queue, so a show still in flight finishes first and cannot land
  // on the new item — in the capstone, where every item shares one
  // program, the run before would show the answers. The quiet run the
  // pictures need is untouched.
  const itemKey = reading && read.level?.kind !== 'ideas' ? (read.session.current?.id ?? `done:${read.session.finished}`) : null
  useEffect(() => {
    if (itemKey === null) return
    void enqueue(async () => {
      stepsRef.current = []
      setIndex(0)
      setTranscript([])
      setRunSeq((n) => n + 1)
    })
  }, [itemKey, enqueue])
  const [ideasCode, setIdeasCode] = useState<string | null>(null)
  const [ideasNote, setIdeasNote] = useState<string | null>(null)
  /** The beat an example was run on, and what it stopped with. The crow
   *  points at what it changed for as long as that beat shows. */
  const [ideasRan, setIdeasRan] = useState<{ beat: number; raised: string | null } | null>(null)
  const ideasBeatRef = useRef(0)
  /** The example whose button was pressed, as written in the text. */
  const [ideasPicked, setIdeasPicked] = useState<string | null>(null)
  /**
   * Runs an example from the ideas. Many are fragments of a running
   * explanation — `same = original` after the text has said what
   * `original` is — so one that stops on a name it never saw is tried
   * again after the section's earlier examples. If it still cannot run,
   * the page says what it is rather than calling it a failure: the example
   * leans on names the prose defines.
   */
  const tryIdea = useCallback(
    async (code: string, context: string[]) => {
      setIdeasNote(null)
      setIdeasPicked(code.replace(/\n$/, ''))
      // Asked inside Python, so a fragment's NameError is caught there: a
      // run that ends on an uncaught exception costs the engine its worker,
      // and the next run would wait for a fresh one to boot.
      const unnamed = async (src: string) => (await quiet(nameProbe(src))).output.endsWith(NAME_PROBE)
      const alone = await unnamed(code)
      // An example that says which error it raises means to raise it
      // (`print(hidden)  # NameError`): that is the lesson, not a fragment.
      const meant = /\bNameError\b/.test(code)
      let source = code
      if (alone && !meant && context.length > 0) {
        // The shortest run of what came before that lets it run: the
        // nearest context first, widening until the name is found.
        for (let from = context.length - 1; from >= 0; from--) {
          const joined = [...context.slice(from), code.replace(/\n$/, '')].join('\n') + '\n'
          if (await unnamed(joined)) continue
          source = joined
          setIdeasNote('This example continues what the section set up before it, so that runs first.')
          break
        }
      }
      if (source === code && alone && !meant) {
        setIdeasNote('This one is a fragment: it uses a name the text sets up in words, so on its own Python stops with a NameError.')
      }
      setIdeasCode(source)
      const beat = ideasBeatRef.current
      setIdeasRan(null)
      // `show`, keeping what the example stopped with for the crow.
      void enqueue(async () => {
        setTranscript([])
        const outcome = await execute(source)
        setTranscript((t) => [...t, { kind: outcome.ok ? 'note' : 'err', text: outcomeLine(outcome.threw, outcome.terminal) }])
        setIdeasRan({ beat, raised: outcome.terminal?.exception?.type_name ?? null })
        // Stacked, memory is a screen below the stage: bring the robot's
        // pane up, where the example and what it built are, so the crow's
        // "look at memory" has something in view to point at.
        if (typeof matchMedia === 'function' && matchMedia(STACKED).matches) {
          const still = matchMedia('(prefers-reduced-motion: reduce)').matches
          document.querySelector('.robot-pane')?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
        }
      })
    },
    [quiet, enqueue, execute],
  )

  /** The editor's instrument: hand over the whole program. */
  const run = useCallback(async (given?: string) => {
    if (busy || boot.state !== 'ready') return
    // The editor owns the text. Asking React for it would run whatever was
    // last rendered, which is not necessarily what is on screen. A shared
    // lesson's run carries its own (the text that peer ran).
    const source = given ?? editorRef.current?.read() ?? programRef.current
    setTranscript([])
    const outcome = await execute(source)
    setTranscript((t) => [
      ...t,
      { kind: outcome.ok ? 'note' : 'err', text: outcomeLine(outcome.threw, outcome.terminal) },
    ])
    if (!judgedOnRuns) return
    // An editor lesson keeps the run as evidence: the program, how it
    // ended, the lines it reached, the memory it left. And, when the step
    // asks, the same program tried quietly on each of its cases.
    const summary = runOf(stepsRef.current, outcome.terminal)
    const asked = stepCasesRef.current
    const cases = asked
      ? await Promise.all(
          asked.map(async (given) => {
            const ev = await quiet(withCase(source, given))
            return { given, ok: ev.raised === null && ev.reason === 'completed', raised: ev.raised ?? (ev.reason === 'completed' ? null : 'steps'), final: ev.final }
          }),
        )
      : undefined
    const record: Run = { source, ...summary, cases }
    setRuns((r) => [...r, record])
    setLineMemory((m) => [...m, { source, memory: summary.final }])
    setLastLine({
      source,
      ok: summary.ok,
      error: summary.raised === null ? null : outcomeLine(outcome.threw, outcome.terminal),
      thought: null,
      memory: summary.final,
      run: record,
    })
    setLastPick(null)
  }, [boot.state, busy, execute, judgedOnRuns, quiet])

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
      // A demonstration's quiet run may still be in flight: the engine
      // takes one run at a time (invariant 5), so the line waits its turn.
      await queue.current
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
      // Only the pending line is asked to describe itself, so whatever is
      // here belongs to it. `None` is skipped: `print("hi")` is an
      // expression whose value is None, and a console that answered None
      // after every print would be noise.
      const said = outcome.ok && entry.echo ? thought(last) : null
      const made = said !== null && said.repr !== 'None'
      const echo = made ? said!.repr : null
      const error = outcome.ok ? null : outcomeLine(outcome.threw, outcome.terminal)

      setExchanges((xs) => [
        ...xs,
        {
          id: xs.length,
          source,
          echo,
          output: fresh,
          error,
        },
      ])
      // Only an accepted line joins the history, so only its output becomes
      // part of what the next replay is expected to repeat.
      const after = extractMemory(last)
      // The line carries the memory entry it adds (the same object), so a
      // lesson can take it back out and see whether the line moved it —
      // a binding does a step without thinking of anything.
      setLastLine({ source, ok: outcome.ok, error, thought: made ? said : null, memory: outcome.ok ? after : undefined })
      setLastPick(null)
      if (outcome.ok) {
        spokenRef.current = outcome.output
        setHistory((h) => [...h, entry])
        setLineMemory((m) => [...m, { source, memory: after }])
        if (made) setThoughts((t) => [...t, { ...said!, source }])
      }

      // A practice session judges every line, including one that failed:
      // forgetting the quotes round a word is an answer, and a wrong one.
      const attempt: Attempt = {
        source,
        ok: outcome.ok,
        error,
        thought: said,
        snapshot: after,
      }
      attemptRef.current?.(attempt)
    },
    [boot.state, busy, execute],
  )

  /**
   * Starts the console over, inside this activity, with `setup` already
   * run — for a practice exercise, which needs a clean memory and sometimes
   * a few names in it. The setup lines become the history, exactly as if
   * they had been typed, so replay carries them; they are shown as given.
   */
  const startOver = useCallback(
    async (setup: string[]) => {
      const entries: Entry[] = setup.map((source) => ({ source, echo: false }))
      stepsRef.current = []
      setIndex(0)
      setThoughts([])
      setLastLine(null)
      setLineMemory([])
      spokenRef.current = ''
      historyRef.current = entries
      setHistory(entries)
      setExchanges(entries.map((e, i) => ({ id: i, source: e.source, echo: null, output: '', error: null, given: true })))
      setEpoch((n) => n + 1)
      if (entries.length === 0) {
        rerender()
        return
      }
      const outcome = await execute(buildProgram(entries, null).source)
      spokenRef.current = outcome.output
      setLineMemory([{ source: setup.join('\n'), memory: extractMemory(stepsRef.current[stepsRef.current.length - 1]) }])
    },
    [execute],
  )

  /** How many times the console has started over, and the last start —
   *  so the test surface's `say` can wait for an exercise that is about
   *  to start rather than type into the one before it. */
  const restartsRef = useRef<{ n: number; running: Promise<void> }>({ n: 0, running: Promise.resolve() })
  const restart = useCallback(
    (setup: string[]): Promise<void> => {
      const running = startOver(setup)
      restartsRef.current = { n: restartsRef.current.n + 1, running }
      return running
    },
    [startOver],
  )

  /**
   * Wipes the robot's memory, for a lesson that asks the player to build a
   * memory and lets them start it again. The console starts over with
   * nothing to replay, and memory shows empty — but the evidence is kept:
   * the wipe is one more entry in it (an empty memory), so everything the
   * lesson has seen stays seen, and its progress, derived from all of it,
   * cannot go backwards (invariant 11).
   */
  const wipe = useCallback(() => {
    if (busy) return
    stepsRef.current = []
    setIndex(0)
    setLastLine(null)
    setLastPick(null)
    spokenRef.current = ''
    historyRef.current = []
    setHistory([])
    setExchanges([])
    setEpoch((n) => n + 1)
    setLineMemory((m) => [...m, { source: '', memory: EMPTY }])
  }, [busy])

  const pool = useMemo(
    () => (activity.practice ? skillsOfUnit(activity.practice.unit).map((s) => s.id) : null),
    [activity],
  )
  // An answered exercise's \`then\`, typed into the console like any line;
  // practice ignores them as answers, since the next exercise has not
  // started when they run.
  //
  // Practice asks for them from inside the answer's own run, so each line
  // waits for the robot to be free and then goes through the newest \`say\`
  // (the one of that moment still thinks the robot is busy, and the engine
  // runs one program at a time: invariant 5).
  const sayRef = useRef(say)
  sayRef.current = say
  const busyRef = useRef(busy)
  busyRef.current = busy
  const runLines = useCallback(async (lines: string[]) => {
    const free = async () => {
      for (let i = 0; i < 400 && busyRef.current; i++) await new Promise((r) => setTimeout(r, 25))
      // One more frame, so the render after the run has updated the refs.
      await new Promise((r) => setTimeout(r, 25))
    }
    for (const l of lines) {
      await free()
      await sayRef.current(l)
    }
  }, [])
  const practice = usePractice(pool, restart, boot.state === 'ready', runLines)
  const attemptRef = useRef<((a: Attempt) => void) | null>(null)
  attemptRef.current = practice?.onAttempt ?? null

  // The guide reads the same snapshot as everything else, so it rewinds
  // with the scrubber and cannot claim progress the robot does not have.
  // One numbering for every view that shows a handle — the rail and the
  // graph must not disagree about which object is `obj3`.
  //
  // A console session is one continuous memory, so handles have to
  // survive each submission; only the editor starts over per run.
  const runKey = talking ? `${activity.id}:talk:${epoch}` : `${activity.id}:${runSeq}`
  const handles = useHandles(snapshot, runKey)

  // In a shared room the lesson is drawn with the room's seed, so a helper
  // is asked what the learner was asked.
  const lesson = activity.lesson ? lessonFor(activity.lesson, room?.lesson()?.seed) : null
  /** A v2 lesson can be shared, and its inputs go through `act`. */
  const shareable = lesson !== null && !reading && activity.version === 2
  // A step may ask the player to *retrieve* something, which leaves no
  // trace in memory — so the evidence includes everything the robot has
  // said back. Both halves only ever grow.
  const evidence = useMemo(() => {
    const now = judgedOnRuns ? (lineMemory[lineMemory.length - 1]?.memory ?? EMPTY) : snapshot
    return {
      snapshot: now,
      thoughts,
      history: [...lineMemory.map((l) => l.memory), now],
      lines: lineMemory,
      last: lastLine,
      picks,
      lastPick,
      runs,
    }
  }, [snapshot, thoughts, lineMemory, lastLine, picks, lastPick, runs, judgedOnRuns])
  const ideas = read.level?.kind === 'ideas'
  // A lesson tells a script: beats, then its question (docs/PEDAGOGY.md
  // §4). Derived, like the step it is for.
  // Where the console is from the stage, for a line that says so
  // (`{CONSOLE}`): on the right, or below on a stacked layout.
  const layout = useStacked() ? 'stacked' : 'side'
  const told = useMemo(() => (lesson && !reading ? script(lesson, evidence, layout) : null), [lesson, reading, evidence, layout])
  /**
   * Takes the last line back: the console starts over from every accepted
   * line but that one, the way the next line would replay them (invariant
   * 7), and memory shows what they leave. For the learner who appended the
   * wrong item or made a name by a typo, and has not been taught how to
   * remove one: without it the only way back was to wipe everything.
   *
   * Like a wipe, it adds to the evidence and takes nothing out of it: the
   * memory before the line is one more entry, with no source, so nothing
   * the lesson has seen is unseen, and its progress cannot go backwards.
   */
  const canUndo = history.length > 0 && !busy
  const undo = useCallback(async () => {
    if (busy || historyRef.current.length === 0) return
    const entries = historyRef.current.slice(0, -1)
    const taken = historyRef.current[historyRef.current.length - 1]!
    historyRef.current = entries
    setHistory(entries)
    // Its exchange leaves the console with it, and any failed lines typed
    // after it (they were never kept).
    setExchanges((x) => {
      const at = x.map((e) => e.source === taken.source && e.error === null && !e.given).lastIndexOf(true)
      return at === -1 ? x : x.slice(0, at)
    })
    setLastLine(null)
    setLastPick(null)
    if (entries.length === 0) {
      stepsRef.current = []
      spokenRef.current = ''
      setEpoch((n) => n + 1)
      setLineMemory((m) => [...m, { source: '', memory: EMPTY }])
      return
    }
    const outcome = await execute(buildProgram(entries, null).source)
    spokenRef.current = outcome.output
    setLineMemory((m) => [...m, { source: '', memory: extractMemory(stepsRef.current[stepsRef.current.length - 1]) }])
  }, [busy, execute])

  // A step that starts from a clean memory (`LessonStep.wipeFirst`) has it
  // wiped for the player once, as the lesson reaches it. Once per visit to
  // the step, and never while a line runs.
  const wipedFor = useRef<string | null>(null)
  /** A wipe the lesson makes itself, by key (`act` below). */
  const autoWipeRef = useRef<(key: string) => void>(() => {})
  const stepAt = told ? told.at : null
  useEffect(() => {
    if (stepAt === null || busy || boot.state !== 'ready') return
    const key = `${activity.id}:${stepAt}`
    if (!lesson?.steps[stepAt]?.wipeFirst || wipedFor.current === key) return
    wipedFor.current = key
    autoWipeRef.current(`first:${key}`)
  }, [stepAt, busy, boot.state, activity.id, lesson])

  // The cases the step being asked tries a program on, read by `run`.
  const stepCasesRef = useRef<Record<string, string>[] | undefined>(undefined)
  stepCasesRef.current = stepAt !== null ? lesson?.steps[stepAt]?.cases : undefined

  // Everyone else says one line at a time, and may hand over a script of
  // their own once they have beats to tell.
  //
  // A stage's ideas are a script too: the crow's beats, one block of the
  // text a beat (`voice.ideaBeats`), ending on the close.
  const spoken: Spoken | undefined = reading
    ? ideas
      ? {
          text: read.ideas[read.ideas.length - 1]?.say ?? '',
          script: read.ideas.map((b, i) => ({
            kind: i === read.ideas.length - 1 ? ('outro' as const) : ('beat' as const),
            asking: false,
            text: b.say,
          })),
        }
      : read.guide
        ? { text: read.guide }
        : undefined
    : practice
      ? practice.guide
      : undefined
  const lines: ScriptItem[] = told
    ? told.items
    : (spoken?.script ?? (spoken ? [{ kind: 'ask', asking: true, text: spoken.text, speaker: spoken.speaker }] : []))
  const rest = told ? told.rest : lines.length - 1

  /**
   * Which of those lines is showing: the workbench's one piece of view
   * state for the guide. Not stored (invariant 19) and not progress
   * (invariant 11) — it is keyed on the step, so the moment the step
   * changes it is back at that step's first line, and a remount starts it
   * there too. Returning to a level mid-way therefore resumes at the
   * derived step and replays its beats.
   */
  const tellKey = told ? `${activity.id}:${told.at}` : practice ? `practice:${practice.meter.at}` : activity.id
  // A stage's ideas already read open told to the end, the whole sheet
  // there to re-read: the beats are for the first reading, not a toll on
  // every visit. (The same finished set the map reads; nothing new stored.)
  const [telling, setTelling] = useState<{ key: string; at: number }>(() =>
    ideas && finishedLevels().has(activity.id) ? { key: tellKey, at: Number.MAX_SAFE_INTEGER } : { key: '', at: 0 },
  )
  const beatAt = Math.max(0, Math.min(telling.key === tellKey ? telling.at : 0, lines.length - 1))
  ideasBeatRef.current = beatAt

  // A beat that announces a wipe (`Beat.wipe`) does it as it shows, so the
  // praise before it is read over what the player made. Once per visit to
  // the step, like `wipeFirst` (Back and Next past it again do nothing),
  // never while a line runs, and a skip straight to the ask has passed it.
  const beatWipedFor = useRef<string | null>(null)
  const wipeDue = told !== null && !told.finished && lesson?.wipe === true && wipedBy(told.items, beatAt)
  useEffect(() => {
    if (!wipeDue || busy || boot.state !== 'ready' || beatWipedFor.current === tellKey) return
    beatWipedFor.current = tellKey
    autoWipeRef.current(`beat:${tellKey}`)
  }, [wipeDue, busy, boot.state, tellKey])
  // The ideas: how far the sheet has got, and the words named so far.
  const ideasAt = ideas ? readTo(read.ideas, beatAt) : null
  // When an example has run on this beat, the crow points at what it
  // changed, read from the same steps memory draws (invariant 2), at the
  // scrubber. Stage 6 turns formal the moment `binding` has been named.
  const ideasVocab = read.stage?.stage === 6 ? (ideasAt?.terms.includes('binding') ? 'formal' : 'plain') : read.vocab
  const ranHere = ideas && ideasRan !== null && ideasRan.beat === beatAt && !busy && steps.length > 0
  const ideasSaid = useMemo(() => {
    if (!ranHere) return null
    if (ideasRan!.raised && shown === steps.length - 1) return raisedNote(ideasRan!.raised)
    return noteAt((i) => extractMemory(steps[i]), shown, ideasVocab)
    // `steps` is mutated in place; its length and the index are what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranHere, ideasRan, shown, steps.length, ideasVocab])
  const current: ScriptItem | undefined =
    ideasSaid && lines[beatAt] ? { ...lines[beatAt]!, text: ideasSaid, focus: 'memory' } : lines[beatAt]
  // Narration closes the console; the question opens it. A finished
  // lesson comes to rest on its last line, where the console is open
  // again for anything the player likes.
  const listening = lines.length > 0 && beatAt < rest
  // A multiple-choice question is answered on the stage, not to the robot:
  // the console stays closed while it waits.
  const choosing = !reading && current?.asking === true && current.choices !== undefined
  const actRef = useRef<(input: LessonInput) => Promise<void>>(async () => {})
  const choose = useCallback(
    (choice: string, item: ScriptItem | undefined = current) => {
      const c = item?.asking ? item.choices : undefined
      if (!c || !c.options.some((o) => o.id === choice)) return
      if (shareable) return void actRef.current({ kind: 'pick', ask: c.id, choice })
      const pick = { ask: c.id, choice }
      setPicks((p) => [...p, pick])
      setLastPick(pick)
      setLastLine(null)
    },
    [current, shareable],
  )
  const moveTo = useCallback(
    (at: number) => {
      setTelling({ key: tellKey, at })
      room?.shareBeat(tellKey, at)
    },
    [tellKey, room],
  )

  /* ------------------------------------------------------------------ */
  /* A lesson, shared (`collab/`)                                         */
  /* ------------------------------------------------------------------ */
  /**
   * Everything a player does to a v2 lesson is an event (`LessonEvent`):
   * a line typed, a program run, an option picked, Undo, a wipe. Alone,
   * each is applied as it is made, and kept in `logRef`. Shared, the log
   * goes into the room with it, and from then on an event is added to the
   * room's log and *every* peer, this one included, applies the log in the
   * document's order. The evidence is a function of the log, so every
   * peer derives the same step (invariant 11) with no new state.
   *
   * Two peers adding at once can each have applied their own first; the
   * document then settles on one order, the logs no longer agree, and the
   * workbench starts over and replays it (`onDiverged`). Rare, and slow
   * only by a few seconds.
   *
   * Which line is being told is shared too, like a run's step: whoever
   * presses Next moves everyone on.
   */
  const inRoom = room !== null && shareable
  const logRef = useRef<LessonEvent[]>([])
  const wipedKeys = useRef(new Set<string>())
  const chain = useRef<Promise<void>>(Promise.resolve())
  const [pending, setPending] = useState(0)
  const pendingRef = useRef(0)
  pendingRef.current = pending
  const settled = useRef(new Map<string, () => void>())
  const soloN = useRef(0)
  const readyRef = useRef(false)
  readyRef.current = boot.state === 'ready'
  const handlers = useRef({ say, run, undo, wipe })
  handlers.current = { say, run, undo, wipe }
  // A workbench that starts over (`onDiverged`) leaves its queue behind:
  // it must stop, or it would go on running Python beside its successor.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const applyOne = useCallback(async (e: LessonEvent) => {
    // One run at a time (invariant 5): wait for Python (a peer joining a
    // room replays the log while it is still booting), for the robot, and
    // a frame for the render after it, so the handlers are the newest ones.
    // The session too: a workbench that has just started over can find its
    // predecessor's last run still in flight.
    for (let i = 0; i < 2400 && alive.current && (busyRef.current || session.busy || !readyRef.current); i++)
      await new Promise((r) => setTimeout(r, 25))
    await new Promise((r) => setTimeout(r, 25))
    if (!alive.current) return
    const h = handlers.current
    if (e.kind === 'say') await h.say(e.source)
    else if (e.kind === 'run') await h.run(e.source)
    else if (e.kind === 'undo') await h.undo()
    else if (e.kind === 'wipe') {
      if (wipedKeys.current.has(e.key)) return
      wipedKeys.current.add(e.key)
      h.wipe()
    } else {
      const pick = { ask: e.ask, choice: e.choice }
      setPicks((p) => [...p, pick])
      setLastPick(pick)
      setLastLine(null)
    }
  }, [])
  const queueEvent = useCallback(
    (e: LessonEvent): Promise<void> => {
      logRef.current.push(e)
      setPending((n) => n + 1)
      const done = chain.current
        .then(() => applyOne(e))
        .catch(() => {})
        .finally(() => {
          setPending((n) => n - 1)
          settled.current.get(e.id)?.()
          settled.current.delete(e.id)
        })
      chain.current = done
      return done
    },
    [applyOne],
  )
  /** Does what the player did: at once alone, through the room shared.
   *  Resolves once it has been applied here. */
  const act = useCallback(
    (input: LessonInput): Promise<void> => {
      if (inRoom && room) return new Promise((resolve) => settled.current.set(room.push(input), resolve))
      return queueEvent({ ...input, id: `solo-${++soloN.current}`, by: 'solo' } as LessonEvent)
    },
    [inRoom, room, queueEvent],
  )
  actRef.current = act
  autoWipeRef.current = (key: string) => {
    if (!shareable) return void wipe()
    if (wipedKeys.current.has(key) || logRef.current.some((e) => e.kind === 'wipe' && e.key === key)) return
    // Every peer reaches the beat; one makes the wipe, or two would land in
    // the log at once and cross.
    if (inRoom && room && !room.leads()) return
    void act({ kind: 'wipe', key })
  }
  // The room's log, applied as it grows; joining, from the start.
  const divergedRef = useRef(onDiverged)
  divergedRef.current = onDiverged
  useEffect(() => {
    if (!inRoom || !room) return
    const sync = () => {
      const evs = room.events()
      const have = logRef.current
      const agree = evs.length >= have.length && have.every((e, i) => evs[i]!.id === e.id)
      if (!agree) return void divergedRef.current?.()
      for (let i = have.length; i < evs.length; i++) void queueEvent(JSON.parse(JSON.stringify(evs[i])) as LessonEvent)
    }
    sync()
    return room.subscribe(sync)
  }, [inRoom, room, queueEvent])
  // Another peer moved to a line of this step: so does this one. A peer
  // still catching up takes the line up when it reaches the step.
  const tellKeyRef = useRef(tellKey)
  tellKeyRef.current = tellKey
  useEffect(
    () =>
      room?.onBeat((key, at) => {
        if (key === tellKeyRef.current) setTelling({ key, at })
      }),
    [room],
  )
  useEffect(() => {
    const b = room?.lastBeat
    if (b && b.key === tellKey) setTelling(b)
  }, [room, tellKey])
  // Entering a room in step with its log (the learner, sharing), say
  // which line this is: a helper joining is shown it once they catch up.
  const beatAtRef = useRef(0)
  beatAtRef.current = beatAt
  useEffect(() => {
    if (inRoom && room && logRef.current.length === room.events().length) room.shareBeat(tellKeyRef.current, beatAtRef.current)
  }, [inRoom, room])
  const shareLesson = useCallback(() => {
    if (!roomView) return
    void roomView.share(
      editorRef.current?.read() ?? programRef.current,
      shareable ? { level: activity.id, seed: pageSeed(), events: logRef.current } : undefined,
    )
  }, [roomView, shareable, activity.id])
  // A practice session is paced by the line being told: its next exercise
  // starts (clean console, setup run) only once the praise for the last
  // one has been read (`usePractice`, "The praise is read over the
  // answer"). Reported, never decided here.
  const practiceTold = practice?.told
  useEffect(() => {
    practiceTold?.(beatAt)
  }, [practiceTold, beatAt])
  // The ideas read several blocks under one line; the bubble stays put for
  // them rather than typing the same words again.
  const sayKey = ideas && !ideasSaid ? read.ideas.findIndex((b, i) => i <= beatAt && read.ideas.slice(i, beatAt + 1).every((x) => x.say === b.say)) : beatAt
  const guide = current
    ? {
        text: current.text,
        speaker: current.speaker,
        kind: current.kind,
        tag: current.tag,
        key: `${tellKey}:${sayKey}`,
        choices: current.asking ? current.choices : undefined,
      }
    : undefined
  // Tells the director someone spoke, so the cast turns to listen. Emitted
  // only: nothing reads it back to decide anything.
  const said = guide?.text
  useEffect(() => {
    if (said) events.emit({ type: 'npc-spoke', text: said })
  }, [said])
  // The lesson's picture, and the last one leaving with its answer.
  // Nothing new is known here: it is the same evidence the guide reads,
  // at the line being told.
  const stage = useMemo(
    () => (practice ? practice.staging : lesson && !reading ? stageOf(lesson, evidence, beatAt) : NO_STAGING),
    [lesson, practice, reading, evidence, beatAt],
  )
  const onStage = useMemo(() => (lesson && !reading ? castAt(lesson, evidence, beatAt) : NO_CAST), [lesson, reading, evidence, beatAt])
  // The whole progression: the guide offers the next lesson once this one
  // is genuinely done. Derived like everything else, so scrubbing back
  // through the trace withdraws the offer too.
  const finished = told !== null && told.finished
  // Finished, by the same one-or-the-other rule the scene celebrates on
  // (invariant 9), and recorded so the map remembers it. This is the only
  // thing written down: the map derives everything else from it.
  const complete = reading
    ? ideas
      ? ideasAt?.end === true
      : read.complete
    : practice
      ? practice.done
      : lesson
        ? finished
        : readScene(activity.scene, snapshot).solved
  // A review and a single item are not levels on the path: what they
  // change is mastery, which the map reads for itself.
  const onPath = !(read.level?.kind === 'review' || read.level?.kind === 'single')
  useEffect(() => {
    if (complete && onPath) markDone(activity.id)
  }, [complete, activity.id, onPath])
  // The way on is back to the map, where finishing this shows as a level
  // done and the next one unlocking — the loop Duolingo made familiar, and
  // one every level has, the last included. The scene decides *when* to
  // offer it, because it is the thing that knows whether this activity is
  // finished (a lesson's last step, or a satisfied set of watches).
  const onAdvance = () => goToMap(activity.id)

  const currentStep = steps[shown]
  const traceLine = currentStep?.location.module === '__main__' ? currentStep.location.line : null

  // The latest of each, for the test surface's `say`, which waits across
  // renders and must act on the one it wakes up in, not the one it was
  // called from.
  const latest = useRef({ say, busy, run })
  latest.current = { say, busy, run }

  // A small, stable surface the browser tests drive.
  useEffect(() => {
    const api = {
      setProgram: (text: string) => editorRef.current?.replace(text),
      getProgram: () => editorRef.current?.read() ?? programRef.current,
      run: () => (shareable ? act({ kind: 'run', source: editorRef.current?.read() ?? programRef.current }) : run()),
      /** An editor lesson's equivalent of `say`: past any narration, the
       *  program in the editor, and Run — resolving once the run (and any
       *  cases) are in. */
      send: async (program: string) => {
        moveTo(rest)
        await new Promise((r) => setTimeout(r, 60))
        await until(() => !latest.current.busy)
        editorRef.current?.replace(program)
        return shareable ? actRef.current({ kind: 'run', source: program }) : latest.current.run()
      },
      /** The console's equivalent of typing a line and pressing Enter.
       *  Skips any narration first, as a player pressing Next through it
       *  would, so a journey can still answer a lesson by typing.
       *
       *  A practice praise is read over the answer, and the next exercise
       *  starts — clean console, setup run — only once it is passed. So
       *  this passes it and waits for that start to finish: typed at once,
       *  the line would run at the last exercise's memory, be refused as
       *  an answer to this one, and be lost. */
      say: async (line: string) => {
        const starting = practice !== null && practice.praising && practice.current !== null
        const starts = restartsRef.current.n
        moveTo(rest)
        if (starting) {
          await until(() => restartsRef.current.n > starts)
          await restartsRef.current.running
        }
        await until(() => !latest.current.busy)
        return shareable ? actRef.current({ kind: 'say', source: line }) : latest.current.say(line)
      },
      /** The line being told: where it is in this step's script, whether it
       *  is the question, and who says it. */
      beat: () => ({
        at: beatAt,
        of: lines.length,
        text: current?.text ?? '',
        asking: current?.asking ?? false,
        speaker: current?.speaker ?? 'crow',
        kind: current?.kind ?? null,
        listening,
        /** A multiple-choice question's option ids, and those tried. */
        choices: current?.asking && current.choices ? current.choices.options.map((o) => o.id) : null,
        tried: current?.asking && current.choices ? current.choices.tried : [],
      }),
      /** Pick an option of the multiple-choice question being asked. */
      choose: (id: string) => {
        // The question itself, not the line showing: a skip just made has
        // not rendered yet, and the pick would be read against narration.
        moveTo(rest)
        choose(id, lines[rest])
      },
      /** Next, without waiting for the line to finish typing. */
      next: () => moveTo(Math.min(beatAt + 1, rest)),
      /** Straight to the question (or a finished lesson's last line). */
      skip: () => moveTo(rest),
      snapshot: () => snapshot,
      /** Reading: the item being asked and where it is, and the moves a
       *  player makes — answer a part, commit, repair, mark, move on. */
      read: {
        state: () => ({
          item: read.session.current?.id ?? null,
          phase: read.session.state?.phase ?? null,
          at: read.session.at,
          of: read.session.items.length,
          results: read.session.results,
          canCommit: read.session.canCommit,
          resolved: read.session.resolved,
          finished: read.session.finished,
          outcome: read.session.state?.outcome ?? null,
          graded: read.session.state?.graded ?? [],
          parts: read.session.current?.spec.parts.map((p) => p.kind) ?? [],
          complete,
        }),
        answer: (part: number, a: Answer) => read.session.setAnswer(part, a),
        commit: () => read.session.commit(),
        submit: (part: number, source: string) => read.session.submit(part, source),
        mark: (part: number, m: 'right' | 'word' | 'missed') => read.session.mark(part, m),
        next: () => read.session.next(),
        /** The key's answer to each part, as a player would give it —
         *  so a journey can answer right (or change one to answer wrong)
         *  through the same path a player does. Null until the item has
         *  been run, and for a part whose answer is a program. */
        models: () => {
          const cur = read.session.current
          const truth = read.session.state?.truth
          if (!cur || !truth) return null
          return cur.spec.parts.map((p, i) => (p.kind === 'fix' || p.kind === 'write' ? null : modelAnswer(p, truth, i)))
        },
        /** The key's program for a repair or a write part. */
        program: (part: number) => {
          const p = read.session.current?.spec.parts[part]
          return p && (p.kind === 'fix' || p.kind === 'write') ? p.model : null
        },
      },
      /** The practice exercise being asked, so a test can answer it with
       *  the line the generator says works, and check the judge against
       *  what real Python does with it. */
      exercise: () =>
        practice?.current
          ? { skill: practice.current.skill, say: practice.current.say, answer: practice.current.answer, at: practice.meter.at }
          : null,
      state: () => ({
        boot: boot.state,
        busy,
        steps: stepsRef.current.length,
        mode: activity.mode,
        history: historyRef.current.map((e) => e.source),
        /** A shared lesson: events applied or queued here, and still to
         *  apply. */
        log: logRef.current.length,
        pending: pendingRef.current,
      }),
    }
    ;(window as unknown as { botgineer: typeof api }).botgineer = api
  }, [activity.mode, boot.state, busy, run, say, snapshot, practice, read.session, complete, moveTo, rest, beatAt, lines, current, listening, choose])

  // The beat controls the scene draws. Only a lesson has them: practice
  // and reading say one line at a time until they hand over a script.
  const firstOutro = lines.findIndex((l) => l.kind === 'outro')
  const tellingView: Telling | undefined = told
    ? {
        listening,
        back: beatAt > 0,
        steps: lesson!.steps.length,
        step: told.at,
        through: told.finished ? 1 : lines.length > 0 ? (beatAt + 1) / lines.length : 0,
        takeaway: lesson!.takeaway,
        resting: told.finished && beatAt === rest,
        onNext: () => moveTo(Math.min(beatAt + 1, rest)),
        onBack: () => moveTo(Math.max(0, beatAt - 1)),
        onReplay: () => moveTo(Math.max(0, firstOutro)),
      }
    : ideas && read.stage && ideasAt
      ? {
          // The ideas, told: Next and Back through the text, and the bar
          // along the top a segment per section of the sheet.
          listening,
          back: beatAt > 0,
          steps: sectionsOf(read.stage),
          step: ideasAt.end ? sectionsOf(read.stage) : (ideasAt.reach?.section ?? 0),
          through: ideasThrough(read.stage, ideasAt.reach),
          resting: ideasAt.end,
          onNext: () => moveTo(Math.min(beatAt + 1, rest)),
          onBack: () => moveTo(Math.max(0, beatAt - 1)),
          onReplay: () => moveTo(0),
        }
      : practice
      ? {
          // Practice tells a script the way a lesson step does — the
          // praise, a lead, the question — with no bar of steps (the meter
          // is its progress).
          listening,
          back: beatAt > 0,
          steps: 0,
          step: 0,
          through: 0,
          resting: practice.done,
          onNext: () => moveTo(Math.min(beatAt + 1, rest)),
          onBack: () => moveTo(Math.max(0, beatAt - 1)),
          onReplay: () => moveTo(0),
        }
      : undefined
  // A demonstration thought belongs to its beat alone. It is not evidence
  // and never joins `thoughts`: when the beat moves on, the cloud goes
  // back to what the robot really thought — if that belongs to this step
  // (`cloud`). Where the step's telling began is taken when the step
  // changes, the render its key does: the line that moved it is `lastLine`
  // in that same render, so it is known whether the newest thought is the
  // answer its praise is about.
  const newest = thoughts[thoughts.length - 1]
  const [cloudFrom, setCloudFrom] = useState<{ key: string } & CloudFrom>({ key: '', stale: undefined, answer: undefined })
  let from: CloudFrom = cloudFrom
  if (cloudFrom.key !== tellKey) {
    from = { stale: newest, answer: lastLine?.ok && lastLine.thought ? newest : undefined }
    setCloudFrom({ key: tellKey, ...from })
  }
  // A demonstration line (`Beat.types`): the crow types it into the
  // console, and it stays there for the rest of the step until the
  // question, the step's later demonstrations piling up under it, so
  // "Now another: `42`" still has the `7` above it. Narration, like a
  // beat's thought — never run, never evidence (`src/ui/demo.ts`). Only
  // the newest types itself in; the robot's answer reaches the cloud only
  // once it is in, which the console says when it is.
  const demoAts: number[] = []
  for (let i = beatAt; i >= 0 && talking && !reading && lines[i]?.kind !== 'ask' && lines[i]?.kind !== 'reply'; i--) {
    if (lines[i]?.types !== undefined) demoAts.unshift(i)
  }
  const demoLine = (i: number): DemoLine => {
    const l = lines[i]!
    return { source: l.types!, echo: l.stops ? null : l.thought || null, error: l.stops ?? null }
  }
  const demoAt = demoAts.length > 0 ? demoAts[demoAts.length - 1]! : -1
  const demoItem = demoAt >= 0 ? lines[demoAt] : undefined
  const demo: Demo | null = demoItem
    ? {
        key: `${tellKey}:${demoAt}`,
        ...demoLine(demoAt),
        before: demoAts.slice(0, -1).map(demoLine),
      }
    : null
  const [typed, setTyped] = useState('')
  const demoWaiting = demo !== null && typed !== demo.key
  const onDemoTyped = useCallback(() => {
    if (demo) setTyped(demo.key)
  }, [demo?.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const shownThought = demoWaiting ? null : cloud(current, newest, from, lastLine !== null && !lastLine.ok) || null
  const look = activity.version === 2 ? ('v2' as const) : ('v1' as const)

  // The crow's demonstration memory (`Beat.memory`): the latest one set at
  // or before this beat, within the step, until the question. Its lines
  // are run quietly by real Python from an empty memory and drawn in the
  // memory panel as the crow's; narration, never evidence. A line being
  // typed in has its effect only once it is in.
  let memoryAt = -1
  for (let i = beatAt; i >= 0 && !reading && lines[i]?.kind !== 'ask' && lines[i]?.kind !== 'reply'; i--) {
    if (lines[i]?.memory !== undefined) {
      memoryAt = i
      break
    }
  }
  const demoLines = memoryAt >= 0 ? lines[memoryAt]!.memory! : null
  const shownLines =
    demoLines && demoWaiting && memoryAt === demoAt && demoLines[demoLines.length - 1] === demoItem?.types
      ? demoLines.slice(0, -1)
      : demoLines
  const demoProgram = shownLines ? shownLines.join('\n') : null
  const [demoMemory, setDemoMemory] = useState<{ program: string; snapshot: MemorySnapshot } | null>(null)
  useEffect(() => {
    if (demoProgram === null || boot.state !== 'ready') return
    let live = true
    void quiet(demoProgram).then((ev) => {
      if (live) setDemoMemory({ program: demoProgram, snapshot: ev.final })
    })
    return () => {
      live = false
    }
  }, [demoProgram, boot.state, quiet])
  // Until the run is back, the last demonstration stays up, so memory does
  // not flash empty between one beat and the next.
  const demoSnapshot = demoProgram === null ? null : (demoMemory?.snapshot ?? EMPTY)
  const marked = current?.mark
  const demoHandles = useHandles(demoSnapshot ?? EMPTY, `${activity.id}:demo:${demoProgram === null ? '' : 'on'}`)

  // The crow's program in the editor (`Beat.code`): the latest set at or
  // before this beat, within the step, until the question — or through a
  // multiple-choice question, which is about the code on show, and its
  // replies. What it adds to the code before it types itself in.
  const editing = activity.mode === 'editor' && !reading
  let codeAt = -1
  let reachedStart = editing
  for (let i = beatAt; i >= 0 && editing; i--) {
    const l = lines[i]
    if ((l?.kind === 'ask' || l?.kind === 'reply') && (i !== beatAt || !l.choices)) {
      reachedStart = false
      break
    }
    if (l?.code !== undefined) {
      codeAt = i
      reachedStart = false
      break
    }
  }
  // A multiple-choice question about the crow's program keeps that program
  // up through its praise, and the next step's beats until one sets its
  // own: the praise explains the program, and beside the player's old one
  // it explained nothing. The player's program comes back at the next ask.
  // Derived from the lesson, like the rest of the script: the step before's
  // last `code`, and its last `run` from there.
  const prevStep = told && told.at > 0 && lines[0]?.kind === 'praise' ? lesson?.steps[told.at - 1] : undefined
  const carried = (() => {
    if (!reachedStart || current?.asking || !prevStep?.choices) return null
    const beats = prevStep.beats ?? []
    let at = -1
    for (let j = beats.length - 1; j >= 0; j--) {
      if (beats[j]!.code !== undefined) {
        at = j
        break
      }
    }
    if (at < 0) return null
    const ran = beats.slice(at).reverse().find((b) => b.run !== undefined)?.run
    return { text: beats[at]!.code!, run: ran }
  })()
  let before = ''
  for (let i = codeAt - 1; i >= 0; i--) {
    const l = lines[i]
    if (l?.kind === 'ask' || l?.kind === 'reply') break
    if (l?.code !== undefined) {
      before = l.code
      break
    }
  }
  const codeText = codeAt >= 0 ? lines[codeAt]!.code! : (carried?.text ?? null)
  let common = 0
  while (codeText !== null && common < before.length && common < codeText.length && before[common] === codeText[common]) common++
  const codeDemo =
    codeText === null
      ? null
      : codeAt >= 0
        ? { key: `${tellKey}:${codeAt}`, text: codeText, typeFrom: common }
        : // Carried over: already on screen, so nothing types in again.
          { key: `${tellKey}:carried`, text: codeText, typeFrom: codeText.length }
  const [codeTyped, setCodeTyped] = useState('')
  const codeWaiting = codeDemo !== null && codeTyped !== codeDemo.key
  const onCodeDemoTyped = useCallback(() => {
    if (codeDemo) setCodeTyped(codeDemo.key)
  }, [codeDemo?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // The crow running its program (`Beat.run`): one moment of a real run,
  // quietly — memory just after a line ran, that line lit, what had run
  // ticked; or the whole run, with what it skipped dimmed.
  const runItem = codeAt >= 0 && beatAt >= codeAt ? lines.slice(codeAt, beatAt + 1).reverse().find((l) => l.run !== undefined) : undefined
  const moment = codeAt >= 0 ? runItem?.run : carried ? (lines.slice(0, beatAt + 1).reverse().find((l) => l.run !== undefined)?.run ?? carried.run) : undefined
  const [demoRun, setDemoRun] = useState<{ program: string; ev: RunEvidence } | null>(null)
  useEffect(() => {
    if (codeText === null || moment === undefined || boot.state !== 'ready') return
    if (demoRun?.program === codeText) return
    let live = true
    void quiet(codeText).then((ev) => {
      if (live) setDemoRun({ program: codeText, ev })
    })
    return () => {
      live = false
    }
  }, [codeText, moment, boot.state, quiet]) // eslint-disable-line react-hooks/exhaustive-deps
  const runShown = moment !== undefined && !codeWaiting && demoRun?.program === codeText ? demoRun.ev : null
  let runMarks: Marks | null = null
  let runMemory: MemorySnapshot | null = null
  if (runShown && moment !== undefined) {
    const v = runShown.visits
    if (moment === 'end') {
      runMarks = {
        ran: v.map((x) => x.line),
        current: null,
        finished: true,
        error:
          runShown.raised || runShown.reason === 'step_limit'
            ? { line: v[v.length - 1]?.line ?? 1, text: runShown.raised ?? 'never finished' }
            : null,
      }
      runMemory = runShown.final
    } else {
      let seen = 0
      const i = v.findIndex((x) => x.line === moment.line && ++seen === (moment.pass ?? 1))
      if (i >= 0) {
        runMarks = { ran: v.slice(0, i + 1).map((x) => x.line), current: moment.line, finished: false, error: null }
        runMemory = runShown.afterVisit(i)
      }
    }
  }
  // The player's own run, walked with the scrubber: what had run by the
  // step shown, the line it was on, and once at the end, what it skipped.
  const lastRun = judgedOnRuns ? runs[runs.length - 1] : undefined
  const playerMarks: Marks | null =
    editing && !busy && look === 'v2' && steps.length === 0 && lastRun && !lastRun.ok && lastRun.raised && lastRun.line !== null
      ? // A program that never started (a `SyntaxError`) still has its line.
        { ran: [], current: null, finished: true, error: { line: lastRun.line, text: lastRun.raised } }
      : editing && !busy && steps.length > 0 && look === 'v2'
      ? (() => {
          const { ran, current } = reachedBy(steps, shown)
          const end = shown >= steps.length - 1
          const r = judgedOnRuns ? runs[runs.length - 1] : undefined
          return {
            ran,
            current: end ? null : current,
            finished: end,
            error: end && r && !r.ok && r.raised && r.line !== null ? { line: r.line, text: r.raised === 'steps' ? 'never finished' : r.raised } : null,
          }
        })()
      : null
  const lineMarks = codeDemo ? runMarks : playerMarks
  // While the crow's program is up and not run, memory is the crow's too,
  // and empty: not the player's last run, which sat beside a question about
  // a program that had not run (and offered its values as hints).
  const notRun = codeDemo !== null && runMemory === null && demoSnapshot === null
  const shownMemory = runMemory ?? demoSnapshot ?? (notRun ? EMPTY : null)
  const runHandles = useHandles(runMemory ?? EMPTY, `${activity.id}:run:${codeText ?? ''}`)

  // A step that hands the player a program (`LessonStep.code`) puts it in
  // the editor once, when the question is reached.
  const codedFor = useRef<string | null>(null)
  const atAsk = told !== null && beatAt === rest && !told.finished && !codeDemo
  useEffect(() => {
    if (!atAsk || stepAt === null) return
    const key = `${activity.id}:${stepAt}`
    const given = lesson?.steps[stepAt]?.code
    if (given === undefined || codedFor.current === key) return
    codedFor.current = key
    // In a room the editor's text is shared: one peer puts it in, or the
    // room would merge one copy per peer.
    if (inRoom && room && !room.leads()) return
    editorRef.current?.replace(given)
  }, [atAsk, stepAt, activity.id, lesson, inRoom, room])

  // A shared editor lesson: the text is the room's, the others' carets
  // show, and stepping through a run moves everyone.
  const sharedCode = useMemo(
    () => (inRoom && room && activity.mode === 'editor' ? { text: () => room.doc()?.code ?? '', extension: sharedEditor(room) } : null),
    [inRoom, room, activity.mode],
  )
  const peerKey = JSON.stringify(roomView?.peers ?? [])
  useEffect(() => {
    if (sharedCode) editorRef.current?.effects([setPeers.of(roomView?.peers ?? [])])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerKey, sharedCode])
  const runsRef = useRef(runs.length)
  runsRef.current = runs.length
  useEffect(
    () =>
      room?.onStep((runId, i) => {
        if (runId !== `run${runsRef.current}`) return
        followingRef.current = false
        setIndex(i)
      }),
    [room],
  )
  const roomBusy = inRoom && pending > 1 ? 'Catching up…' : null
  // Picking a card in memory picks it for everyone looking at the same
  // memory: the robot's, or the crow's demonstration.
  const robotPickSync = useMemo(
    () => (room ? { view: `${activity.id}:robot`, send: (v: string, p: unknown) => room.sharePick(v, p), listen: room.onPick.bind(room) } : null),
    [room, activity.id],
  )
  const demoPickSync = useMemo(
    () => (room ? { view: `${activity.id}:demo`, send: (v: string, p: unknown) => room.sharePick(v, p), listen: room.onPick.bind(room) } : null),
    [room, activity.id],
  )

  return (
    <main className="workbench" ref={benchRef} style={{ ['--scene-w' as string]: `${sceneW}px` }}>
      <section className="pane scene-pane">
        <div className="pane-head">
          <span className="pane-title">Scene</span>
        </div>
        <ScenePanel
          spec={activity.scene}
          snapshot={snapshot}
          moods={cast}
          // The options wait for the crow's program to finish typing in:
          // a question about a program half on screen is not yet asked.
          guide={guide?.choices && codeWaiting ? { ...guide, held: true } : guide}
          onChoose={choose}
          onAdvance={onAdvance}
          // The last thing the robot worked out. It lives nowhere else:
          // the value itself was collected when the line ended.
          thought={reading ? null : shownThought}
          // Reading has nothing to think aloud: the run is the answer, and
          // on the short stage a cloud would sit on the crow's words.
          thinking={reading ? false : busy}
          // `undefined` when there is no lesson, so the scene judges
          // itself instead of being told it has finished nothing.
          triumph={reading ? complete : practice ? practice.done : lesson ? finished : undefined}
          meter={practice?.meter}
          staging={stage}
          compact={reading}
          telling={tellingView}
          cast={onStage}
        >
          {reading && ideas && read.stage ? (
            <IdeasSheet
              stage={read.stage}
              running={ideasPicked}
              onTry={(code, context) => void tryIdea(code, context)}
              reach={ideasAt?.reach ?? null}
              now={ideasAt?.now ?? null}
              terms={ideasAt?.terms ?? []}
              end={ideasAt?.end === true}
            />
          ) : reading ? (
            <>
              <ReadSheet session={read.session} title={activity.title} />
              {read.session.finished && read.didPass === false && (
                <div className="card finish-card" data-testid="checkpoint-failed">
                  <p>{read.guide}</p>
                  <button type="button" className="primary" onClick={() => goToMap()} data-testid="to-review">
                    Back to the map
                  </button>
                </div>
              )}
            </>
          ) : undefined}
        </ScenePanel>
      </section>

      <Gutter
        orientation="vertical"
        value={sceneW}
        onChange={setSceneShared}
        min={320}
        max={900}
        label="Resize the scene"
      />

      <section className="pane robot-pane">
        <div className="pane-head">
          <span className="pane-title">Robot</span>
        </div>
        <RobotPanel
          mode={activity.mode}
          look={look}
          demo={demo}
          onDemoTyped={onDemoTyped}
          onReset={lesson?.wipe ? (shareable ? () => void act({ kind: 'wipe', key: `hand:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }) : wipe) : undefined}
          onUndo={lesson?.wipe ? () => void (shareable ? act({ kind: 'undo' }) : undo()) : undefined}
          banner={shareable && roomView ? <RoomBar view={roomView} onShare={shareLesson} busy={roomBusy} /> : undefined}
          shared={sharedCode}
          canUndo={canUndo}
          codeDemo={codeDemo}
          onCodeDemoTyped={onCodeDemoTyped}
          lineMarks={lineMarks}
          memory={
            <MemoryPanel
              look={look}
              snapshot={shownMemory ?? snapshot}
              handles={runMemory ? runHandles : demoSnapshot || notRun ? demoHandles : handles}
              runKey={runMemory ? `${activity.id}:run` : demoSnapshot || notRun ? `${activity.id}:demo` : runKey}
              demo={shownMemory !== null}
              sync={inRoom && room ? (shownMemory !== null ? demoPickSync : robotPickSync) : null}
              note={notRun ? 'not run yet' : undefined}
              marked={marked}
              emptyText={
                notRun
                  ? `${CROW_NAME}'s program has not run yet, so its memory is empty.`
                  : reading
                  ? ideas
                    ? read.stage && !hasExamples(read.stage)
                      ? 'No examples to run in this one: the robot runs the capstone program at the end of the stage.'
                      : 'Nothing has run yet. Pick “Run this” under an example and memory draws what it builds.'
                    : read.vocab === 'formal'
                      ? 'Empty until you commit. Then the robot runs the code and every binding and object appears here.'
                      : 'Empty until you commit. Then the robot runs the code, and every name and the object it points at appear here.'
                  : undefined
              }
            />
          }
          program={program}
          onProgram={setProgram}
          onReady={(api) => {
            editorRef.current = api
          }}
          onRun={() => void (shareable ? act({ kind: 'run', source: editorRef.current?.read() ?? programRef.current }) : run())}
          onStop={() => session.interrupt()}
          exchanges={exchanges}
          onSay={(line) => void (shareable ? act({ kind: 'say', source: line }) : say(line))}
          greeting={activity.greeting}
          busy={busy || pending > 0}
          disabled={boot.state !== 'ready'}
          // The crow's program has no run of the player's to walk or report.
          transcript={codeDemo ? [] : transcript}
          index={codeDemo ? 0 : shown}
          total={codeDemo ? 0 : steps.length}
          onIndex={(i) => {
            followingRef.current = false
            setIndex(i)
            if (inRoom) room?.shareStep(`run${runs.length}`, i)
          }}
          // The crow's program is not the run the scrubber walks.
          traceLine={codeDemo ? null : traceLine}
          // The console is closed while someone on the stage is talking,
          // and glows when they hand over a question.
          listening={(talking || (editing && look === 'v2')) && (listening || choosing)}
          asked={talking && current?.asking === true && !choosing && !reading}
          focus={current?.focus}
          instrument={
            reading ? (
              ideas ? (
                <IdeasPanel code={ideasCode} traceLine={traceLine} note={ideasNote} said={ideasSaid} runnable={read.stage ? hasExamples(read.stage) : true} />
              ) : (
                <ReadPanel session={read.session} traceLine={traceLine} onShow={(src) => void show(src)} busy={busy} />
              )
            ) : undefined
          }
        />
      </section>
    </main>
  )
}

/** Resolves once `holds` does, checked every frame's worth of time; gives
 *  up after `ms` rather than hang a journey that is already failing. */
function until(holds: () => boolean, ms = 30_000): Promise<void> {
  const end = Date.now() + ms
  return new Promise((done) => {
    const check = () => (holds() || Date.now() > end ? done() : void setTimeout(check, 16))
    check()
  })
}

/** Printed by `nameProbe` when the example stopped on a name it never saw. */
const NAME_PROBE = '__botgineer_NameError__\n'

/** Runs an example to ask one thing: does it stop on a name it never saw?
 *  Any other ending is not this question's business. JSON's string
 *  escapes are Python's, so the source goes in as a literal. */
const nameProbe = (src: string) =>
  [
    'try:',
    `    exec(compile(${JSON.stringify(src)}, "<example>", "exec"), {})`,
    // Exactly NameError: a subclass (UnboundLocalError) is a name the
    // example does define, just not yet, and is not this question.
    'except NameError as e:',
    '    if type(e) is NameError:',
    `        print(${JSON.stringify(NAME_PROBE.replace(/\n$/, ''))})`,
    'except BaseException:',
    '    pass',
    '',
  ].join('\n')

/** How far through its section the sheet is, 0..1, for the beat bar. */
function ideasThrough(stage: Stage, reach: Reach | null): number {
  if (!reach) return 0
  const blocks = reach.section === 0 ? stage.adds : (stage.ideas[reach.section - 1]?.blocks ?? stage.capstone?.intro ?? [])
  return blocks.length > 0 ? (reach.block + 1) / blocks.length : 1
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
