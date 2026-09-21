/**
 * The workbench: one snapshot, three panels.
 *
 *   (B) the robot interface is the only thing that causes anything
 *   (A) the scene and (C) the memory panel are views of what it produced
 *
 * Because both views read the same extracted snapshot, they cannot
 * disagree — and the step slider moves all three together, so scrubbing
 * rewinds the picture as well as the diagram.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { session, useRuntime } from '../runtime/shared'
import type { StepRecord, TerminalRecord } from '../runtime/types'
import { extractMemory } from '../memory/extract'
import { EMPTY } from '../memory/model'
import { events } from '../game/events'
import { useCast } from '../game/director'
import type { Activity } from '../../content/activities'
import { ScenePanel } from '../panels/ScenePanel'
import { MemoryPanel } from '../panels/MemoryPanel'
import { RobotPanel, type Transcript } from '../panels/RobotPanel'
import type { EditorApi } from '../ui/CodeEditor'
import { Gutter, useRemembered } from '../ui/Split'

export function Workbench({ activity }: { activity: Activity }) {
  const boot = useRuntime()
  const cast = useCast()

  const [program, setProgram] = useState(activity.starter)
  const [busy, setBusy] = useState(false)
  const [index, setIndex] = useState(0)
  const [transcript, setTranscript] = useState<Transcript[]>([])
  const [, rerender] = useReducer((x: number) => x + 1, 0)

  const [sceneW, setSceneW] = useRemembered('botgineer.wb.scene', 560)
  const [memoryH, setMemoryH] = useRemembered('botgineer.wb.memory', 330)

  const stepsRef = useRef<StepRecord[]>([])
  const followingRef = useRef(true)
  const rafRef = useRef<number | null>(null)
  const editorRef = useRef<EditorApi | null>(null)
  const programRef = useRef(program)
  programRef.current = program

  // A new activity is a new scene, a new program and a fresh memory.
  useEffect(() => {
    stepsRef.current = []
    setIndex(0)
    setTranscript([])
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

  const run = useCallback(async () => {
    if (busy || boot.state !== 'ready') return
    // The editor owns the text. Asking React for it would run whatever was
    // last rendered, which is not necessarily what is on screen.
    const source = editorRef.current?.read() ?? programRef.current

    setBusy(true)
    stepsRef.current = []
    followingRef.current = true
    setIndex(0)
    setTranscript([])
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
          if (out) pending.push({ kind: 'out', text: out })
          if (err) pending.push({ kind: 'err', text: err })
        },
      })
      terminal = outcome.terminal
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err)
    } finally {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      flush()
      if (followingRef.current) setIndex(Math.max(0, stepsRef.current.length - 1))
      rerender()
      setBusy(false)
    }

    setTranscript((t) => [...t, { kind: threw || terminal?.reason !== 'completed' ? 'err' : 'note', text: outcomeLine(threw, terminal) }])
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
      passed: !threw && terminal?.reason === 'completed',
      misconception: null,
    })
  }, [activity, boot.state, busy])

  const currentStep = steps[shown]
  const traceLine = currentStep?.location.module === '__main__' ? currentStep.location.line : null

  // A small, stable surface the browser tests drive.
  useEffect(() => {
    const api = {
      setProgram: (text: string) => editorRef.current?.replace(text),
      getProgram: () => editorRef.current?.read() ?? programRef.current,
      run: () => run(),
      snapshot: () => snapshot,
      state: () => ({ boot: boot.state, busy, steps: stepsRef.current.length }),
    }
    ;(window as unknown as { botgineer: typeof api }).botgineer = api
  }, [boot.state, busy, run, snapshot])

  return (
    <main className="workbench" style={{ ['--scene-w' as string]: `${sceneW}px`, ['--memory-h' as string]: `${memoryH}px` }}>
      <section className="pane scene-pane">
        <div className="pane-head">
          <span className="pane-title">Scene</span>
          <span className="pane-note">{activity.scene.title}</span>
        </div>
        <ScenePanel spec={activity.scene} snapshot={snapshot} mood={cast.robot} />
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
          <span className="pane-note">tell it what to do, in Python</span>
        </div>
        <p className="brief" data-testid="brief">
          {activity.brief}
        </p>
        <RobotPanel
          program={program}
          onProgram={setProgram}
          onReady={(api) => {
            editorRef.current = api
          }}
          onRun={() => void run()}
          onStop={() => session.interrupt()}
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

      <Gutter
        orientation="horizontal"
        value={memoryH}
        onChange={setMemoryH}
        min={180}
        max={720}
        invert
        label="Resize memory"
      />

      <section className="pane memory-pane">
        <div className="pane-head">
          <span className="pane-title">Memory</span>
          <span className="pane-note">
            {snapshot.line === null
              ? 'names, and the objects they point at'
              : `names and objects, as they were at line ${snapshot.line}`}
          </span>
        </div>
        <MemoryPanel snapshot={snapshot} />
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
