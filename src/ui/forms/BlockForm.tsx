import type { FormProps } from './shared'
import { PickToggle, Verdict } from './shared'

/** Mark the block: which lines are its body, and how often each line runs. */
export function BlockForm({ part, answer, onAnswer, locked, graded, truth, picking, onPicking }: FormProps<'block'>) {
  const a = answer ?? { kind: 'block' as const, body: [], counts: {} }
  const source = truth?.sources[typeof part.snippet === 'number' ? part.snippet : 0] ?? ''
  const lines = source.replace(/\n+$/, '').split('\n')
  return (
    <div className="form block-form">
      <p className="form-label">
        {part.prompt ?? `Which lines belong to the block opened on line ${part.header}? Click them in the code.`}
      </p>
      <p className="form-value">
        {a.body.length ? <>Body: line {[...a.body].sort((x, y) => x - y).join(', ')}</> : <span className="quiet">No lines marked yet.</span>}
      </p>
      <PickToggle picking={picking} onPicking={onPicking} locked={locked} label="Mark lines in the code" />
      {part.counts && (
        <table className="count-table">
          <caption>How many times is each line reached?</caption>
          <tbody>
            {lines.map((text, i) =>
              text.trim() === '' ? null : (
                <tr key={i}>
                  <th scope="row">
                    <span className="ln">{i + 1}</span> <code>{text.trim()}</code>
                  </th>
                  <td>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={a.counts[i + 1] ?? ''}
                      readOnly={locked}
                      aria-label={`Times line ${i + 1} runs`}
                      onChange={(e) => {
                        const counts = { ...a.counts }
                        if (e.target.value === '') delete counts[i + 1]
                        else counts[i + 1] = Number(e.target.value)
                        onAnswer({ ...a, counts })
                      }}
                    />
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
      <Verdict graded={graded} expected={graded?.expected ? <span>{graded.expected}</span> : undefined} />
    </div>
  )
}
