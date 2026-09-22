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
import type { ReactNode } from 'react'
import { CodeEditor, type EditorApi } from '../ui/CodeEditor'
import { RobotConsole, type Exchange } from '../ui/RobotConsole'
import { Gutter, useRemembered } from '../ui/Split'

export type Transcript =
  | { kind: 'out'; text: string }
  | { kind: 'err'; text: string }
  | { kind: 'note'; text: string }

/** Which instrument the player has. The console is the beginner's; the
 *  editor is unlocked later, once a whole program is worth writing. */
export type RobotMode = 'console' | 'editor'

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
}: Props) {
  const talking = mode === 'console'
  // Remembered, because how much room memory deserves depends on what the
  // player is doing with it.
  const [memoryH, setMemoryH] = useRemembered('botgineer.rp.memory', 280)

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
      <div className="views">
        <div className="view instrument">
          {talking ? (
            <RobotConsole
              exchanges={exchanges}
              onSubmit={onSay}
              busy={busy}
              disabled={disabled}
              greeting={greeting}
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
          onChange={setMemoryH}
          min={120}
          max={620}
          invert
          label="Resize memory"
        />

        <div className="view memory-view">{memory}</div>
      </div>

      {/* The console answers inline, so it needs no Run button and no step
          slider — pressing Enter is the transport. All it can still want is
          a way out of a line that will not finish. */}
      {talking ? (
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
          className="primary"
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

      {!talking && (
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
