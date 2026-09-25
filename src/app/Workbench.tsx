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
import { extractMemory, runEvidence, thought, type RunEvidence } from '../memory/extract'
import { useHandles } from '../memory/handles'
import { EMPTY, type MemorySnapshot } from '../memory/model'
import { buildProgram, isExpression, type Entry } from '../repl/program'
import { events } from '../game/events'
import { useCast } from '../game/director'
import type { Activity } from '../../content/activities'
import {
  LESSONS,
  NO_CAST,
  castAt,
  script,
  staging as stageOf,
  type Heard,
  type Line,
  type ScriptItem,
  type Spoken,
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
import type { Answer } from '../collection/model'
import { modelAnswer } from '../collection/runner'
import { markDone } from '../progress/progress'
import { readScene } from '../scene/spec'
import { ScenePanel, type Telling } from '../panels/ScenePanel'
import { MemoryPanel } from '../panels/MemoryPanel'
import { RobotPanel, type Transcript } from '../panels/RobotPanel'
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
  const [lineMemory, setLineMemory] = useState<MemorySnapshot[]>([])
  /** Bumped per run. Object handles are assigned on first sight and kept
   *  for a whole run, so they must start over when a new one does. */
  const [runSeq, setRunSeq] = useState(0)
  /** Bumped when the console starts over inside one activity — a practice
   *  session gives every exercise a clean memory, and the handles and the
   *  grid must start over with it. */
  const [epoch, setEpoch] = useState(0)
  const [, rerender] = useReducer((x: number) => x + 1, 0)

  const [sceneW, setSceneW] = useRemembered('botgineer.wb.scene', 560)

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
  const snapshot = talking && busy ? (lineMemory[lineMemory.length - 1] ?? EMPTY) : live

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
  const [ideasCode, setIdeasCode] = useState<string | null>(null)
  const [ideasRead, setIdeasRead] = useState(false)
  const [ideasNote, setIdeasNote] = useState<string | null>(null)
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
      const alone = await quiet(code)
      let source = code
      if (alone.raised === 'NameError' && context.length > 0) {
        // The shortest run of what came before that lets it run: the
        // nearest context first, widening until the name is found.
        for (let from = context.length - 1; from >= 0; from--) {
          const joined = [...context.slice(from), code.replace(/\n$/, '')].join('\n') + '\n'
          const withContext = await quiet(joined)
          if (withContext.raised === 'NameError') continue
          source = joined
          setIdeasNote('This example continues what the section set up before it, so that runs first.')
          break
        }
      }
      if (source === code && alone.raised === 'NameError') {
        setIdeasNote('This one is a fragment: it uses a name the text sets up in words, so on its own Python stops with a NameError.')
      }
      setIdeasCode(source)
      void show(source)
    },
    [quiet, show],
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
      setLastLine({ source, ok: outcome.ok, error, thought: made ? said : null })
      // Only an accepted line joins the history, so only its output becomes
      // part of what the next replay is expected to repeat.
      const after = extractMemory(last)
      if (outcome.ok) {
        spokenRef.current = outcome.output
        setHistory((h) => [...h, entry])
        setLineMemory((m) => [...m, after])
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
  const restart = useCallback(
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
      setLineMemory([extractMemory(stepsRef.current[stepsRef.current.length - 1])])
    },
    [execute],
  )

  const pool = useMemo(
    () => (activity.practice ? skillsOfUnit(activity.practice.unit).map((s) => s.id) : null),
    [activity],
  )
  const practice = usePractice(pool, restart, boot.state === 'ready')
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

  const lesson = activity.lesson ? (LESSONS[activity.lesson] ?? null) : null
  // A step may ask the player to *retrieve* something, which leaves no
  // trace in memory — so the evidence includes everything the robot has
  // said back. Both halves only ever grow.
  const evidence = useMemo(
    () => ({ snapshot, thoughts, history: [...lineMemory, snapshot], last: lastLine }),
    [snapshot, thoughts, lineMemory, lastLine],
  )
  const ideas = read.level?.kind === 'ideas'
  // A lesson tells a script: beats, then its question (docs/PEDAGOGY.md
  // §4). Derived, like the step it is for.
  const told = useMemo(() => (lesson && !reading ? script(lesson, evidence) : null), [lesson, reading, evidence])
  // Everyone else says one line at a time, and may hand over a script of
  // their own once they have beats to tell.
  const spoken: Spoken | undefined = reading
    ? ideas
      ? { text: ideasRead ? 'That is the idea. The exercises are next — back to the map.' : 'Read it through. Every example can be run — watch what it builds.' }
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
  const [telling, setTelling] = useState<{ key: string; at: number }>({ key: '', at: 0 })
  const beatAt = Math.max(0, Math.min(telling.key === tellKey ? telling.at : 0, lines.length - 1))
  const current = lines[beatAt]
  // Narration closes the console; the question opens it. A finished
  // lesson comes to rest on its last line, where the console is open
  // again for anything the player likes.
  const listening = lines.length > 0 && beatAt < rest
  const moveTo = useCallback((at: number) => setTelling({ key: tellKey, at }), [tellKey])
  const guide = current
    ? { text: current.text, speaker: current.speaker, kind: current.kind, tag: current.tag, key: `${tellKey}:${beatAt}` }
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
      ? ideasRead
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

  // A small, stable surface the browser tests drive.
  useEffect(() => {
    const api = {
      setProgram: (text: string) => editorRef.current?.replace(text),
      getProgram: () => editorRef.current?.read() ?? programRef.current,
      run: () => run(),
      /** The console's equivalent of typing a line and pressing Enter.
       *  Skips any narration first, as a player pressing Next through it
       *  would, so a journey can still answer a lesson by typing. */
      say: (line: string) => {
        moveTo(rest)
        return say(line)
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
      }),
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
      }),
    }
    ;(window as unknown as { botgineer: typeof api }).botgineer = api
  }, [activity.mode, boot.state, busy, run, say, snapshot, practice, read.session, complete, moveTo, rest, beatAt, lines, current, listening])

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
        // The editor has its own way to hand over (Send to robot), and a
        // program is written at leisure: no pointer there.
        prompt: activity.mode === 'console' ? 'Type your answer →' : '',
        takeaway: lesson!.takeaway,
        resting: told.finished && beatAt === rest,
        onNext: () => moveTo(Math.min(beatAt + 1, rest)),
        onBack: () => moveTo(Math.max(0, beatAt - 1)),
        onReplay: () => moveTo(Math.max(0, firstOutro)),
      }
    : practice
      ? {
          // Practice has no beats yet, so nothing to step through: only
          // the pointer at the console while a question waits.
          listening,
          back: false,
          steps: 0,
          step: 0,
          through: 0,
          prompt: 'Type your answer →',
          resting: practice.done,
          onNext: () => moveTo(Math.min(beatAt + 1, rest)),
          onBack: () => moveTo(Math.max(0, beatAt - 1)),
          onReplay: () => moveTo(0),
        }
      : undefined
  // A demonstration thought belongs to its beat alone. It is not evidence
  // and never joins `thoughts`: when the beat moves on, the cloud goes
  // back to what the robot really thought last.
  const shownThought = current?.thought ?? (thoughts.length > 0 ? (thoughts[thoughts.length - 1]?.repr ?? null) : null)

  return (
    <main className="workbench" style={{ ['--scene-w' as string]: `${sceneW}px` }}>
      <section className="pane scene-pane">
        <div className="pane-head">
          <span className="pane-title">Scene</span>
        </div>
        <ScenePanel
          spec={activity.scene}
          snapshot={snapshot}
          moods={cast}
          guide={guide}
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
              onEnd={() => setIdeasRead(true)}
              {...(read.stage.stage === 1 ? { lead: 'The console lessons on names came first; this is the same idea, written down.' } : {})}
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
        onChange={setSceneW}
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
          memory={
            <MemoryPanel
              snapshot={snapshot}
              handles={handles}
              runKey={runKey}
              emptyText={
                reading
                  ? ideas
                    ? 'Nothing has run yet. Pick “Run this” under an example and memory draws what it builds.'
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
          // The console is closed while someone on the stage is talking,
          // and glows when they hand over a question.
          listening={talking && listening}
          asked={talking && current?.asking === true && !reading}
          focus={current?.focus}
          instrument={
            reading ? (
              ideas ? (
                <IdeasPanel code={ideasCode} traceLine={traceLine} note={ideasNote} />
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
