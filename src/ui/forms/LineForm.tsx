import { richText } from '../richText'
import type { FormProps } from './shared'
import { PickToggle, Verdict } from './shared'

/** One line of the code, picked by clicking it. */
export function LineForm({ part, answer, locked, graded, picking, onPicking }: FormProps<'line'>) {
  return (
    <div className="form line-form">
      <p className="form-label">{richText(part.prompt)}</p>
      <p className="form-value">
        {answer?.line ? <>You picked <strong>line {answer.line}</strong>.</> : <span className="quiet">No line picked yet.</span>}
      </p>
      <PickToggle picking={picking} onPicking={onPicking} locked={locked} label="Pick a line in the code" />
      <Verdict graded={graded} expected={graded?.expected ? <span>{graded.expected}</span> : undefined} />
    </div>
  )
}
