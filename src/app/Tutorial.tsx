/**
 * The tutorial screen: a prompt, a crow, and the robot's memory.
 *
 * No customer and no request. The player types values, Python builds
 * objects, and the objects appear. Nothing is bound to a name — that is
 * the point, and it is also why the robot has to hold them (see
 * `src/game/repl.ts`).
 */
import { useCallback, useRef, useState } from 'react'
import { session, useRuntime } from '../runtime/shared'
import type { StepRecord, TerminalRecord } from '../runtime/types'
import { buildProgram, readMemory, type MemoryObject } from '../game/repl'
import { events } from '../game/events'
import { useCast } from '../game/director'
import { closing, firstObjects } from '../../content/tutorial/first-objects'
import { Crow } from '../ui/Crow'
import { ObjectTiles } from '../ui/ObjectTiles'
import { Repl, type ReplLine } from '../ui/Repl'
import { Gutter, useRemembered } from '../ui/Split'

const OPENING: ReplLine[] = [
  { kind: 'note', text: 'Python 3.14 — the robot is listening.' },
]

/** A tutorial line is short. The budget only has to stop a runaway. */
const OPTIONS = { max_steps: 2000, wall_clock_s: 15 }

export function Tutorial() {
  const boot = useRuntime()
  const cast = useCast()
  const [entries, setEntries] = useState<string[]>([])
  const [lines, setLines] = useState<ReplLine[]>(OPENING)
  const [memory, setMemory] = useState<MemoryObject[]>([])
  const [beatIndex, setBeatIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const attemptRef = useRef(0)

  const [tilesH, setTilesH] = useRemembered('botgineer.tutorial.tiles', 300)

  const beat = firstObjects[beatIndex] ?? null
  const done = beatIndex >= firstObjects.length

  const say = useCallback((line: ReplLine) => setLines((ls) => [...ls, line]), [])

  const submit = useCallback(
    async (source: string) => {
      if (busy || boot.state !== 'ready') return
      setBusy(true)
      say({ kind: 'input', text: source })

      attemptRef.current += 1
      events.emit({
        type: 'attempt-started',
        scenarioId: 'first-objects',
        attempt: attemptRef.current,
      })

      const steps: StepRecord[] = []
      let terminal: TerminalRecord | null = null
      let failure: string | null = null

      try {
        const outcome = await session.run({
          source: buildProgram([...entries, source]),
          options: OPTIONS,
          onRecord: (r) => {
            if (r.kind === 'step') steps.push(r)
          },
        })
        terminal = outcome.terminal
      } catch (err) {
        failure = err instanceof Error ? err.message : String(err)
      }

      if (failure !== null || terminal?.reason !== 'completed') {
        // A line that did not work is never committed, so the session
        // cannot accumulate debris that breaks every later entry.
        say({ kind: 'error', text: failure ?? describeFailure(terminal) })
        events.emit({
          type: 'attempt-graded',
          scenarioId: 'first-objects',
          passed: false,
          misconception: null,
        })
        setBusy(false)
        return
      }

      const next = readMemory(steps)
      const made = next[next.length - 1]
      setEntries((e) => [...e, source])
      setMemory(next)
      if (made) say({ kind: 'result', text: made.text })

      // Beat checking. An object that is not what this beat asked for is
      // still a real object: it stays in memory, and the crow just asks
      // again. Nothing is ever taken away for being wrong.
      let passed = false
      if (beat && made) {
        if (beat.accepts(made, next)) {
          passed = true
          say({ kind: 'note', text: beat.praise })
          const after = beatIndex + 1
          setBeatIndex(after)
          if (after >= firstObjects.length) say({ kind: 'note', text: closing })
          else say({ kind: 'note', text: firstObjects[after]?.say ?? '' })
        } else {
          say({ kind: 'note', text: beat.nudge })
        }
      }

      events.emit({
        type: 'attempt-graded',
        scenarioId: 'first-objects',
        passed: passed || done,
        misconception: null,
      })
      setBusy(false)
    },
    [beat, beatIndex, boot.state, busy, done, entries, say],
  )

  const restart = () => {
    setEntries([])
    setMemory([])
    setLines(OPENING)
    setBeatIndex(0)
  }

  return (
    <main className="layout tutorial" style={{ ['--left-w' as string]: '400px' }}>
      <div className="column left">
        <section className="scene guide">
          <div className="guide-top">
            {/* The crow occupies the cast's non-player slot: the same bus
                events that move a character's face move this one. */}
            <Crow mood={cast.npc} />
            <div className="bubbles">
              <p className="bubble npc" data-testid="crow-line">
                {done ? closing : (beat?.say ?? '')}
              </p>
            </div>
          </div>

          <div className="progress" data-testid="progress">
            <span className="quiet">
              {done ? 'lesson complete' : `step ${beatIndex + 1} of ${firstObjects.length}`}
            </span>
            <span className="pips" aria-hidden="true">
              {firstObjects.map((b, i) => (
                <i key={b.id} className={i < beatIndex ? 'pip done' : i === beatIndex ? 'pip now' : 'pip'} />
              ))}
            </span>
            <button type="button" onClick={restart} data-testid="restart">
              Start over
            </button>
          </div>
        </section>
      </div>

      <div className="spacer-col" />

      <div className="column right">
        <section className="pane grow">
          <div className="pane-head">
            <span className="pane-title">Prompt</span>
            <span className="pane-note">type a value, press Enter</span>
          </div>
          <Repl
            lines={lines}
            onSubmit={(s) => void submit(s)}
            busy={busy || boot.state !== 'ready'}
            suggestion={done ? null : (beat?.suggestion ?? null)}
          />
        </section>

        <Gutter
          orientation="horizontal"
          value={tilesH}
          onChange={setTilesH}
          min={140}
          max={640}
          invert
          label="Resize the robot's memory"
        />

        <section className="pane fixed" style={{ height: `${tilesH}px` }}>
          <div className="pane-head">
            <span className="pane-title">Robot memory</span>
            <span className="pane-note">
              {memory.length === 0
                ? 'what Python actually built'
                : `${memory.length} object${memory.length === 1 ? '' : 's'} — the robot is holding them for you`}
            </span>
          </div>
          <ObjectTiles objects={memory} newestSlot={memory.length ? memory.length - 1 : null} />
        </section>
      </div>
    </main>
  )
}

/** Turns a non-completed run into something worth reading at a prompt. */
function describeFailure(terminal: TerminalRecord | null): string {
  if (!terminal) return 'The robot did not answer. Try again.'
  if (terminal.reason === 'uncaught_exception') {
    const type = terminal.exception?.type_name ?? 'Error'
    if (type === 'SyntaxError') {
      return 'SyntaxError — that is not an expression. This lesson is about making objects, so type a value like 10 or "John".'
    }
    if (type === 'NameError') {
      return 'NameError — nothing here has a name yet. Type a value rather than a word.'
    }
    return `${type} — that did not make an object.`
  }
  if (terminal.reason === 'step_limit' || terminal.reason === 'trace_limit') {
    return 'That took too many steps to finish. Try something smaller.'
  }
  return `The run stopped (${terminal.reason}).`
}
