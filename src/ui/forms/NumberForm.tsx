import { useId } from 'react'
import { richText } from '../richText'
import type { FormProps } from './shared'
import { Verdict } from './shared'

export function NumberForm({ part, answer, onAnswer, locked, graded }: FormProps<'number'>) {
  const id = useId()
  return (
    <div className="form number-form">
      <label htmlFor={id} className="form-label">
        {richText(part.prompt)}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="number-input"
        value={answer?.value ?? ''}
        readOnly={locked}
        onChange={(e) => onAnswer({ kind: 'number', value: e.target.value === '' ? null : Number(e.target.value) })}
      />
      <Verdict graded={graded} />
    </div>
  )
}
