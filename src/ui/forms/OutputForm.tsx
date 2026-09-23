import { useId } from 'react'
import type { FormProps } from './shared'
import { Verdict } from './shared'

/** The exceptions a reading exercise can end in — the ones the collection
 *  uses, and the common ones a wrong guess would name. */
export const ERRORS = [
  'NameError',
  'TypeError',
  'KeyError',
  'IndexError',
  'AttributeError',
  'ValueError',
  'UnboundLocalError',
  'RuntimeError',
  'ZeroDivisionError',
  'StopIteration',
  'SyntaxError',
]

/** What it prints — typed as it would appear — and whether it stops. */
export function OutputForm({ part, answer, onAnswer, locked, graded }: FormProps<'output'>) {
  const id = useId()
  const a = answer ?? { kind: 'output' as const, text: '', raises: null }
  return (
    <div className="form output-form">
      <label htmlFor={id} className="form-label">
        {part.prompt ?? (part.snippet !== undefined ? `What does ${String(part.snippet)} print?` : 'What does it print?')}
      </label>
      <textarea
        id={id}
        className="output-input"
        value={a.text}
        readOnly={locked}
        spellCheck={false}
        rows={Math.max(2, a.text.split('\n').length)}
        placeholder="Type the output, one printed line per line"
        onChange={(e) => onAnswer({ ...a, text: e.target.value })}
        data-testid={`output-${String(part.snippet ?? 0)}`}
      />
      <div className="raises">
        <label>
          <input
            type="checkbox"
            checked={a.raises !== null}
            disabled={locked}
            onChange={(e) => onAnswer({ ...a, raises: e.target.checked ? 'NameError' : null })}
          />
          Then it stops with an error:
        </label>
        <select
          value={a.raises ?? ''}
          disabled={locked || a.raises === null}
          onChange={(e) => onAnswer({ ...a, raises: e.target.value })}
          aria-label="Which error"
        >
          {a.raises === null && <option value="">—</option>}
          {ERRORS.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </div>
      <Verdict graded={graded} />
    </div>
  )
}
