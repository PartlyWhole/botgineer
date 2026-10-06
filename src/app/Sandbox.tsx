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
 *
 * **Shared** (`collab/`): Share puts the program in a room, and whoever
 * opens the link joins as a helper. The text is merged as both type; a
 * run is made by whoever pressed Run and shown to everyone, opening on
 * step 0; and moving through it moves everyone, so a helper can point at
 * "this step, here". Nobody can start a run while another's is going.
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
import { EditorTransport, ResizableOutput, type Transcript } from '../panels/RobotPanel'
import { useSyncedSize } from '../collab/sizes'
import { Gutter, useRemembered, useStacked } from '../ui/Split'
import type { RoomView } from '../collab/useRoom'
import { RoomBar } from '../collab/RoomBar'
import { setPeers, sharedEditor } from '../collab/editor'
import type { PackedRun } from '../collab/trace'

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
  runId: string
  /** The text that ran, so an edit can tell the run is stale. */
  source: string
  terminal: TerminalRecord | null
  threw: string | null
}

export function Sandbox({ roomView }: { roomView: RoomView }) {
  const boot = useRuntime()
  const stacked = useStacked()
  const [codeW, setCodeW] = useRemembered('botgineer.sb.code', NaN)
  const codeRef = useRef<HTMLDivElement | null>(null)
  const viewsRef = useRef<HTMLDivElement | null>(null)
  // In a shared room, the split moves on every screen (`collab/sizes`).
  const setCodeShared = useSyncedSize('code', setCodeW, () => viewsRef.current?.offsetWidth ?? 0)
  const editorRef = useRef<EditorApi | null>(null)

  const [program, setProgram] = useState(STARTER)
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState<StepRecord[]>([])
  const [done, setDone] = useState<Done | null>(null)
  const [index, setIndex] = useState(0)
  const [runSeq, setRunSeq] = useState(0)

  const room = roomView.room
  const shared = useMemo(() => (room ? { text: () => room.doc()?.code ?? '', extension: sharedEditor(room) } : null), [room])

  /** Shows a finished run, from this peer or another, on its first step. */
  const show = useCallback((runId: string, source: string, packed: PackedRun) => {
    setSteps(packed.steps)
    setDone({ runId, source, terminal: packed.terminal, threw: packed.threw })
    setIndex(0)
    setRunSeq((n) => n + 1)
  }, [])

  const run = useCallback(async () => {
    if (busy || boot.state !== 'ready' || (room && !room.canRun())) return
    // The editor owns the text (invariant 7).
    const source = editorRef.current?.read() ?? program
    const runId = `${room?.me.id ?? 'solo'}-${Date.now().toString(36)}`
    room?.startRun(runId, source)
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
      const packed = { steps: got, terminal, threw }
      show(runId, source, packed)
      setBusy(false)
      // In a room, everyone else is shown it too, unless another peer's run
      // won the room meanwhile; then that one arrives below like any other.
      if (room) void room.finishRun(runId, packed)
    }
  }, [boot.state, busy, program, room, show])

  // Another peer's run, once it is done: shown here the same way. A late
  // joiner is shown the room's last run as it enters.
  const applied = useRef<string | null>(null)
  useEffect(() => {
    if (!room) return
    const check = () => {
      const r = room.run()
      if (!r || r.status !== 'done' || r.runId === applied.current || r.runId === room.myRun) return
      applied.current = r.runId
      if (r.tooBig) {
        show(r.runId, r.source, { steps: [], terminal: null, threw: 'That run was too big to share. Press Run to see it here.' })
        return
      }
      void room.trace(r).then((packed) => {
        if (applied.current !== r.runId) return
        show(r.runId, r.source, packed ?? { steps: [], terminal: null, threw: 'That run could not be read.' })
      })
    }
    check()
    return room.subscribe(check)
  }, [room, show])

  // Moving through a run moves everyone in the room through it.
  const doneRef = useRef(done)
  doneRef.current = done
  useEffect(() => room?.onStep((runId, i) => {
    if (doneRef.current?.runId === runId) setIndex(i)
  }), [room])
  const goTo = useCallback(
    (i: number) => {
      setIndex(i)
      const d = doneRef.current
      if (room && d) room.shareStep(d.runId, i)
    },
    [room],
  )

  // Picking a card in memory picks it for everyone.
  const pickSync = useMemo(
    () => (room ? { view: 'sandbox', send: (v: string, p: unknown) => room.sharePick(v, p), listen: room.onPick.bind(room) } : null),
    [room],
  )

  // The others' carets, redrawn when one moves.
  const peerKey = JSON.stringify(roomView.peers)
  useEffect(() => {
    editorRef.current?.effects([setPeers.of(roomView.peers)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerKey, shared])

  // An edit puts the run away: it describes a program no longer on screen.
  // Derived rather than cleared, so a run arriving from the room for the
  // text everyone now has shows, and one for older text does not.
  const onProgram = useCallback((next: string) => setProgram(next), [])
  const live = done !== null && done.source === program
  const total = live ? steps.length : 0
  const shown = Math.min(index, Math.max(0, total - 1))
  const atEnd = total > 0 && shown >= total - 1

  // A peer's records passed `trace.ts`'s shape check, but a step this
  // page cannot read is drawn as empty memory rather than taking it down.
  const snapshot = useMemo(() => {
    if (!live || total === 0) return EMPTY
    try {
      return extractMemory(steps[shown]!)
    } catch {
      return EMPTY
    }
  }, [live, total, steps, shown])
  const handles = useHandles(snapshot, `sandbox:${runSeq}`)
  const summary = useMemo(() => (done ? runOf(steps, done.terminal) : null), [done, steps])

  const marks: LineMarks | null = useMemo(() => {
    if (!done || !summary || !live) return null
    const stopped = summary.raised !== null && summary.line !== null
    const error = stopped ? { line: summary.line!, text: summary.raised === 'steps' ? 'never finished' : summary.raised! } : null
    // A program that never started (a `SyntaxError`) still has its line.
    if (total === 0) return error ? { ran: [], current: null, finished: true, error } : null
    const { ran, current } = reachedBy(steps, shown)
    return { ran, current: atEnd ? null : current, finished: atEnd, error: atEnd ? error : null }
  }, [done, summary, live, total, steps, shown, atEnd])

  // What the program had printed by the step shown, and at the end how it
  // ended. A step carries the output produced before it, so the last
  // step's own output is added once the end is reached.
  const transcript: Transcript[] = useMemo(() => {
    if (!done || !live) return []
    const out: Transcript[] = []
    for (let i = 0; i <= shown && i < total; i++) {
      const { stdout_delta: o, stderr_delta: e } = steps[i]!.output
      if (o) out.push({ kind: 'out', text: o })
      if (e) out.push({ kind: 'err', text: e })
    }
    if (atEnd || total === 0) out.push({ kind: done.terminal?.reason === 'completed' ? 'note' : 'err', text: endLine(done) })
    return out
  }, [done, live, shown, total, steps, atEnd])

  const current = live && total > 0 ? steps[shown] : undefined
  const traceLine = current?.location.module === '__main__' ? current.location.line : null

  // A small surface for the browser tests, like the workbench's.
  const latest = useRef({ run, busy, shown, total, snapshot, done })
  latest.current = { run, busy, shown, total, snapshot, done }
  useEffect(() => {
    const api = {
      setProgram: (src: string) => editorRef.current?.replace(src),
      getProgram: () => editorRef.current?.read() ?? '',
      selection: () => editorRef.current?.selection() ?? null,
      run: () => latest.current.run(),
      step: (i: number) => goTo(i),
      snapshot: () => latest.current.snapshot,
      state: () => ({
        boot: boot.state,
        busy: latest.current.busy,
        step: latest.current.shown,
        steps: latest.current.total,
        runId: latest.current.done?.runId ?? null,
        mode: 'sandbox',
      }),
    }
    ;(window as unknown as { botgineer: typeof api }).botgineer = api
  }, [boot.state, goTo])

  const runner = room?.runningBy()
  const peerRunning = runner && runner.id !== room?.me.id ? runner : null
  const canRun = !busy && boot.state === 'ready' && !peerRunning

  return (
    <main
      className="workbench sandbox"
      data-testid="code-sandbox"
      style={!stacked && Number.isFinite(codeW) ? { ['--code-w' as string]: `${codeW}px` } : undefined}
    >
      <section className="pane robot-panel" data-look="v2" data-mode="editor" data-busy={busy ? 'yes' : 'no'} aria-label="Sandbox">
        <RoomBar
          view={roomView}
          onShare={() => void roomView.share(editorRef.current?.read() ?? program)}
          busy={peerRunning ? `${peerRunning.name} is running the program…` : null}
        />
        <div className="views" ref={viewsRef}>
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
                onRun={canRun ? () => void run() : undefined}
                shared={shared}
              />
            </div>
            <EditorTransport
              onRun={() => void run()}
              onStop={() => session.interrupt()}
              busy={busy}
              canRun={canRun}
              index={shown}
              total={total}
              onIndex={goTo}
              pulse={false}
            />
            <ResizableOutput transcript={transcript} space={() => codeRef.current?.offsetHeight ?? 0} />
          </div>
          {!stacked && (
            <Gutter
              orientation="vertical"
              value={codeW}
              measure={() => codeRef.current?.offsetWidth ?? 520}
              onChange={setCodeShared}
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
              sync={pickSync}
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
