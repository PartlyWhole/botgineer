/**
 * (B) The robot interface: where the player writes the robot's
 * instructions, runs them, and reads what came back.
 *
 * This is the only panel that *causes* anything. The other two are views
 * of the snapshot it produces. It is also the transport: Run, Stop, and
 * the step slider that moves every panel through the trace together.
 */
import { CodeEditor, type EditorApi } from '../ui/CodeEditor'

export type Transcript =
  | { kind: 'out'; text: string }
  | { kind: 'err'; text: string }
  | { kind: 'note'; text: string }

type Props = {
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
}

export function RobotPanel({
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
}: Props) {
  return (
    <div className="robot-panel" data-testid="robot-panel" data-busy={busy ? 'yes' : 'no'}>
      <CodeEditor
        solution={program}
        onSolution={onProgram}
        onReady={onReady}
        traceLine={traceLine}
        disabled={busy}
      />

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
          {total === 0 ? 'no run yet' : `step ${Math.min(index + 1, total)} / ${total}`}
        </span>
      </div>

      <div className="transcript" data-testid="transcript" aria-live="polite">
        {transcript.length === 0 ? (
          <p className="none">Nothing said yet.</p>
        ) : (
          transcript.map((t, i) => (
            <p key={i} className={`t-line ${t.kind}`}>
              {t.text}
            </p>
          ))
        )}
      </div>
    </div>
  )
}
