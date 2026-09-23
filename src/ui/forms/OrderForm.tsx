import type { FormProps } from './shared'
import { PickToggle, Verdict } from './shared'

/** Execution order: click lines in the order Python reaches them. */
export function OrderForm({ part, answer, onAnswer, locked, graded, picking, onPicking }: FormProps<'order'>) {
  const lines = answer?.lines ?? []
  const what = part.first ? `the first ${part.first} visits` : part.lines ? `lines ${part.lines[0]}–${part.lines[1]}, calls included` : 'every visit'
  return (
    <div className="form order-form">
      <p className="form-label">
        {part.prompt ?? `Click the lines in the order Python reaches them — ${what}. A line that runs again is clicked again.`}
      </p>
      <ol className="order-chips" aria-label="Your order">
        {lines.length === 0 && <li className="quiet none">Nothing yet.</li>}
        {lines.map((l, i) => (
          <li key={i} className="order-chip">
            <span className="order-n">{i + 1}</span> line {l}
          </li>
        ))}
      </ol>
      {!locked && (
        <div className="form-row">
          <PickToggle picking={picking} onPicking={onPicking} locked={locked} label="Number lines in the code" />
          <button type="button" disabled={lines.length === 0} onClick={() => onAnswer({ kind: 'order', lines: lines.slice(0, -1) })}>
            Undo
          </button>
          <button type="button" disabled={lines.length === 0} onClick={() => onAnswer({ kind: 'order', lines: [] })}>
            Clear
          </button>
        </div>
      )}
      <Verdict graded={graded} expected={graded?.expected ? <span className="mono">{graded.expected}</span> : undefined} />
    </div>
  )
}
