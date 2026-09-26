/**
 * (B) The robot interface: where the player writes the robot's
 * instructions, runs them, and reads what came back.
 *
 * This is the only panel that *causes* anything. It is also the transport:
 * Run, Stop, and the step slider that moves the scene and the memory view
 * through the trace together.
 *
 * Memory is a **view of this panel**, not a panel of its own — the code
 * and the memory it produced are the same subject, and giving memory its
 * own box meant the two competed for height and both lost. Both views are
 * kept mounted, so switching back does not throw away where the graph's
 * nodes had settled; the hidden one is simply not displayed.
 *
 * The transport and the transcript stay put across both views, so a run
 * can be started and scrubbed while looking at either.
 */
import { useRef, type ReactNode } from 'react'
import { CodeEditor, type EditorApi } from '../ui/CodeEditor'
import { RobotConsole, type Exchange } from '../ui/RobotConsole'
import { Gutter, useRemembered } from '../ui/Split'

export type Transcript =
  | { kind: 'out'; text: string }
  | { kind: 'err'; text: string }
  | { kind: 'note'; text: string }

/** Which instrument the player has. The console is the beginner's; the
 *  editor is unlocked later, once a whole program is worth writing. */
export type RobotMode = 'console' | 'editor' | 'read'

type Props = {
  mode: RobotMode
  /** Console: the conversation so far, and how to add to it. */
  exchanges: Exchange[]
  onSay: (line: string) => void
  greeting?: string | undefined
  program: string
  onProgram: (next: string) => void
  onReady: (api: EditorApi) => void
  onRun: () => void
  onStop: () => void
  busy: boolean
  disabled: boolean
  transcript: Transcript[]
  /** Trace transport. `total` of 0 means there is nothing to step. */
  index: number
  total: number
  onIndex: (i: number) => void
  /** Line the trace is on, highlighted in the editor. */
  traceLine: number | null
  memory: ReactNode
  /** Read mode: the reading instrument, in place of the console or editor. */
  instrument?: ReactNode
  /** A lesson's narration is showing: the console is closed until the
   *  question. The editor stays open — a program is written at leisure. */
  listening?: boolean | undefined
  /** A question is waiting for a typed answer: the instrument glows. */
  asked?: boolean | undefined
  /** A beat points at part of this panel, which pulses while it shows. */
  focus?: 'console' | 'memory' | 'run' | undefined
}

export function RobotPanel({
  mode,
  exchanges,
  onSay,
  greeting,
  program,
  onProgram,
  onReady,
  onRun,
  onStop,
  busy,
  disabled,
  transcript,
  index,
  total,
  onIndex,
  traceLine,
  memory,
  instrument,
  listening = false,
  asked = false,
  focus,
}: Props) {
  const talking = mode === 'console'
  const reading = mode === 'read'
  // Remembered, because how much room memory deserves depends on what the
  // player is doing with it, and each mode keeps its own.
  // Reading: the questions need the room above memory, and memory stays
  // empty until the commit. The editor: a program wants the lines.
  // The console wants little — a line or two and what came back — while
  // memory is the picture a console lesson is about, and its names pile up
  // a line at a time: at a fixed 280px the stage-ideas lessons scrolled
  // their first names away by the fifth line. So until the player drags
  // it, the console's memory is a share of the column (`--memory-h` left
  // unset, `styles.css`) rather than a number of pixels.
  const [memoryH, setMemoryH] = useRemembered(
    reading ? 'botgineer.rp.memory.read' : talking ? 'botgineer.rp.memory.console' : 'botgineer.rp.memory',
    reading ? 220 : talking ? NaN : 280,
  )
  const memoryRef = useRef<HTMLDivElement | null>(null)

  return (
    <div
      className="robot-panel"
      data-testid="robot-panel"
      data-mode={mode}
      data-busy={busy ? 'yes' : 'no'}
    >
      {/* Both at once, not one or the other.
      
          A `Talk | Memory` switch meant the effect of an instruction was
          always on the tab you were not looking at — and the moment a
          beginner most needs to see an object appear is the moment they
          made it. A strip of memory under the console was the first
          attempt; the real view, resizable, is better than an abridgement
          of it, and it is the same snapshot either way. */}
      <div
        className="views"
        style={Number.isFinite(memoryH) ? { ['--memory-h' as string]: `${memoryH}px` } : undefined}
      >
        <div
          className={`view instrument ${focus === 'console' ? 'pulse' : ''} ${asked ? 'glow' : ''}`}
          data-testid="instrument"
          data-focus={focus === 'console' ? 'yes' : 'no'}
        >
          {reading ? (
            instrument
          ) : talking ? (
            <RobotConsole
              exchanges={exchanges}
              onSubmit={onSay}
              busy={busy}
              disabled={disabled}
              greeting={greeting}
              listening={listening}
              asked={asked}
            />
          ) : (
            <CodeEditor
              solution={program}
              onSolution={onProgram}
              onReady={onReady}
              traceLine={traceLine}
              disabled={busy}
            />
          )}
        </div>

        <Gutter
          orientation="horizontal"
          value={memoryH}
          measure={() => memoryRef.current?.offsetHeight ?? 280}
          onChange={setMemoryH}
          min={120}
          max={talking ? 900 : 620}
          invert
          label="Resize memory"
        />

        <div
          ref={memoryRef}
          className={`view memory-view ${focus === 'memory' ? 'pulse' : ''}`}
          data-testid="memory-view"
          data-focus={focus === 'memory' ? 'yes' : 'no'}>
          {memory}
        </div>
      </div>

      {/* The console answers inline, so it needs no Run button and no step
          slider — pressing Enter is the transport. All it can still want is
          a way out of a line that will not finish. */}
      {reading ? (
        // Reading has no Run: the robot runs the snippet when the answers
        // are committed, and the scrubber appears once there is a run.
        (total > 0 || busy) && (
          <div className="transport">
            <button type="button" onClick={onStop} disabled={!busy} data-testid="stop">
              Stop
            </button>
            <label className="scrub">
              <span className="sr-only">Step through the run</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, total - 1)}
                value={Math.min(index, Math.max(0, total - 1))}
                disabled={total === 0}
                onChange={(e) => onIndex(Number(e.target.value))}
                data-testid="scrubber"
                aria-label="Step through the run"
              />
            </label>
            <span className="step-label quiet" data-testid="step-label">
              {total === 0 ? '—' : `${Math.min(index + 1, total)} / ${total}`}
            </span>
          </div>
        )
      ) : talking ? (
        // Only while there is something to stop. `hidden` is not enough:
        // `.transport` sets `display: flex`, which wins against it.
        busy && (
          <div className="transport">
            <button type="button" onClick={onStop} data-testid="stop">
              Stop
            </button>
          </div>
        )
      ) : (
      <div className="transport">
        <button
          type="button"
          className={`primary ${focus === 'run' ? 'pulse' : ''}`}
          onClick={onRun}
          disabled={busy || disabled}
          data-testid="run"
        >
          {busy ? 'Running…' : 'Send to robot'}
        </button>
        <button type="button" onClick={onStop} disabled={!busy} data-testid="stop">
          Stop
        </button>

        <label className="scrub">
          <span className="sr-only">Step through the run</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={Math.min(index, Math.max(0, total - 1))}
            disabled={total === 0}
            onChange={(e) => onIndex(Number(e.target.value))}
            data-testid="scrubber"
            aria-label="Step through the run"
          />
        </label>
        <span className="step-label quiet" data-testid="step-label">
          {total === 0 ? '—' : `${Math.min(index + 1, total)} / ${total}`}
        </span>
      </div>
      )}

      {!talking && (!reading || total > 0) && (
        <div className="transcript" data-testid="transcript" aria-live="polite">
          {transcript.map((t, i) => (
            <p key={i} className={`t-line ${t.kind}`}>
              {t.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
