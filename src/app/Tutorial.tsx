/**
 * The tutorial screen: a conversation with the robot, and its memory.
 *
 * No customer and no request. The player tells the robot to make things,
 * Python builds them, and the objects appear. Nothing is bound to a name —
 * that is the point, and it is also why the robot has to hold them (see
 * `src/game/repl.ts`).
 *
 * Three voices, and the split is deliberate: the player writes Python, the
 * robot reports what it did, the crow teaches. The robot is never an
 * oracle; every word of interpretation belongs to the crow.
 */
import { useCallback, useRef, useState } from 'react'
import { session, useRuntime } from '../runtime/shared'
import type { StepRecord, TerminalRecord } from '../runtime/types'
import { buildProgram, identityLabels, readMemory, type MemoryObject } from '../game/repl'
import { crowOnError, GREETING, robotMade, robotRefused } from '../game/robotVoice'
import { events } from '../game/events'
import { useCast } from '../game/director'
import { closing, firstObjects } from '../../content/tutorial/first-objects'
import { Crow } from '../ui/Crow'
import { richText } from '../ui/richText'
import { ObjectTiles } from '../ui/ObjectTiles'
import { Conversation, type Message } from '../ui/Conversation'
import { Gutter, useRemembered } from '../ui/Split'

/** A tutorial line is short. The budget only has to stop a runaway. */
const OPTIONS = { max_steps: 2000, wall_clock_s: 15 }

const opening = (): Message[] => [
  { from: 'robot', text: GREETING },
  { from: 'crow', text: firstObjects[0]?.say ?? '' },
]

export function Tutorial() {
  const boot = useRuntime()
  const cast = useCast()
  const [entries, setEntries] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>(opening)
  const [memory, setMemory] = useState<MemoryObject[]>([])
  const [beatIndex, setBeatIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const attemptRef = useRef(0)

  const [tilesH, setTilesH] = useRemembered('botgineer.tutorial.tiles', 280)

  const beat = firstObjects[beatIndex] ?? null
  const done = beatIndex >= firstObjects.length

  const push = useCallback((...added: Message[]) => setMessages((m) => [...m, ...added]), [])

  const send = useCallback(
    async (source: string) => {
      if (busy || boot.state !== 'ready') return
      setBusy(true)
      push({ from: 'you', code: source })

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
        const errorType =
          terminal?.reason === 'uncaught_exception'
            ? (terminal.exception?.type_name ?? null)
            : null
        push(
          { from: 'robot', text: robotRefused(errorType), tone: 'error' },
          { from: 'crow', text: failure ?? crowOnError(errorType) },
        )
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

      if (made) {
        const label = identityLabels(next).get(made.slot) ?? null
        push({ from: 'robot', text: robotMade(made, label), code: made.text })
      }

      // Beat checking. An object that is not what this beat asked for is
      // still a real object: it stays in memory, and the crow just asks
      // again. Nothing is ever taken away for being wrong.
      let passed = false
      if (beat && made) {
        if (beat.accepts(made, next)) {
          passed = true
          const after = beatIndex + 1
          setBeatIndex(after)
          push({ from: 'crow', text: beat.praise })
          push({ from: 'crow', text: after >= firstObjects.length ? closing : (firstObjects[after]?.say ?? '') })
        } else {
          push({ from: 'crow', text: beat.nudge })
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
    [beat, beatIndex, boot.state, busy, done, entries, push],
  )

  const restart = () => {
    setEntries([])
    setMemory([])
    setMessages(opening())
    setBeatIndex(0)
  }

  return (
    <main className="layout tutorial" style={{ ['--left-w' as string]: '300px' }}>
      <div className="column left">
        <section className="scene guide">
          <Crow mood={cast.npc} />
          <h2 className="guide-name">Your guide</h2>
          <p className="guide-task" data-testid="crow-line">
            {done ? 'Lesson complete.' : richText(beat?.say ?? '')}
          </p>

          <div className="progress" data-testid="progress">
            <span className="quiet">
              {done ? 'lesson complete' : `step ${beatIndex + 1} of ${firstObjects.length}`}
            </span>
            <span className="pips" aria-hidden="true">
              {firstObjects.map((b, i) => (
                <i
                  key={b.id}
                  className={i < beatIndex ? 'pip done' : i === beatIndex ? 'pip now' : 'pip'}
                />
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
            <span className="pane-title">Talking to the robot</span>
            <span className="pane-note">in Python — every value you name, it builds</span>
          </div>
          <Conversation
            messages={messages}
            onSend={(s) => void send(s)}
            busy={busy}
            disabled={boot.state !== 'ready'}
            crowMood={cast.npc}
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
