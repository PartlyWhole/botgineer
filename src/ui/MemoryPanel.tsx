/**
 * The memory model: names on the left, the objects they reach on the right.
 *
 * This renders a snapshot the interpreter produced. It is never computed
 * from the source, so it cannot show something Python did not do.
 *
 * Rendering is throttled by the caller to one frame (records arrive at
 * thousands per second); this component only ever draws one step.
 */
import { decodeValue, formatDecoded } from '../runtime/decode'
import type { StepRecord } from '../runtime/types'

type Props = {
  steps: StepRecord[]
  index: number
  onIndex: (i: number) => void
  solutionStartLine: number
  solutionEndLine: number
}

/** Names the harness owns. Hidden so the panel shows the player's world,
 *  not our plumbing. `answer` stays visible: it is the robot's answer. */
const HIDDEN = new Set(['report', 'respond', '__builtins__', '__name__'])

export function MemoryPanel({ steps, index, onIndex, solutionStartLine, solutionEndLine }: Props) {
  const step = steps[index]

  if (!step) {
    return (
      <div className="memory empty">
        <p>Run the robot to see what happens in memory.</p>
      </div>
    )
  }

  const frame = step.stack[step.stack.length - 1]
  const globals = step.globals.find((g) => g.module === '__main__')?.bindings ?? []
  const inSolution =
    step.location.line >= solutionStartLine && step.location.line <= solutionEndLine

  const rows = [
    ...(frame && frame.function !== '<module>'
      ? frame.locals.map((b) => ({ scope: frame.function, ...b }))
      : []),
    ...globals.filter((b) => !HIDDEN.has(b.name)).map((b) => ({ scope: 'global', ...b })),
  ]

  return (
    <div className="memory">
      <div className="memory-head">
        <label className="scrub">
          <span className="sr-only">Step</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, steps.length - 1)}
            value={index}
            onChange={(e) => onIndex(Number(e.target.value))}
            aria-label="Step through the trace"
            data-testid="scrubber"
          />
        </label>
        <span className="step-count" data-testid="step-label">
          step {index + 1} / {steps.length}
        </span>
        <span className={`where ${inSolution ? 'in-solution' : ''}`}>
          {/* The event word is only worth showing when it is not the
              ordinary line-by-line one. */}
          {step.event === 'line' ? '' : `${step.event} · `}
          line {step.location.line}
          {inSolution ? ' · your code' : ''}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="memory-note">Nothing is bound yet at this step.</p>
      ) : (
        <table className="names" data-testid="names">
          <thead>
            <tr>
              <th>where</th>
              <th>name</th>
              <th>value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.scope}:${r.name}`}>
                <td className="scope">{r.scope}</td>
                <td className="name">{r.name}</td>
                <td className="value">{formatDecoded(decodeValue(r.value, step.heap))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
