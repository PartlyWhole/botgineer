import type { FormProps } from './shared'
import { Verdict } from './shared'

/** A trace table: one row per pass, as many rows as the learner thinks. */
export function TableForm({ part, answer, onAnswer, locked, graded }: FormProps<'table'>) {
  const cells = answer?.cells ?? [part.columns.map(() => '')]
  const set = (r: number, c: number, v: string) =>
    onAnswer({ kind: 'table', cells: cells.map((row, i) => (i === r ? row.map((x, k) => (k === c ? v : x)) : row)) })
  return (
    <div className="form table-form">
      <p className="form-label">{part.prompt ?? 'Fill in one row per pass — and a last row for the check that finds nothing left, if there is one.'}</p>
      <table className="trace-table">
        <thead>
          <tr>
            {part.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, r) => (
            <tr key={r}>
              {row.map((v, c) => (
                <td key={c}>
                  <input
                    value={v}
                    readOnly={locked}
                    aria-label={`Row ${r + 1}, ${part.columns[c]}`}
                    onChange={(e) => set(r, c, e.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!locked && (
        <div className="form-row">
          <button type="button" onClick={() => onAnswer({ kind: 'table', cells: [...cells, part.columns.map(() => '')] })}>
            Add a row
          </button>
          <button type="button" disabled={cells.length <= 1} onClick={() => onAnswer({ kind: 'table', cells: cells.slice(0, -1) })}>
            Remove the last row
          </button>
        </div>
      )}
      <Verdict graded={graded} />
    </div>
  )
}
