import { useId } from 'react'
import { richText } from '../richText'
import type { FormProps } from './shared'
import { Verdict } from './shared'

/** Pick one — or, when the key has several, all that apply. */
export function ChoiceForm({ part, answer, onAnswer, locked, graded, truth }: FormProps<'choice'>) {
  const name = useId()
  const want = typeof part.answer === 'function' ? (truth ? part.answer(truth.runs) : 0) : part.answer
  const multi = Array.isArray(want) && want.length !== 1
  const picked = answer?.picked ?? []
  const wants = Array.isArray(want) ? want : [want]
  const toggle = (i: number) => {
    if (locked) return
    const next = multi ? (picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i]) : [i]
    onAnswer({ kind: 'choice', picked: next })
  }
  return (
    <fieldset className="form choice-form">
      <legend className="form-label">
        {richText(part.prompt)}
        {multi && <span className="form-hint"> Pick every one that applies.</span>}
      </legend>
      {part.options.map((o, i) => (
        <label
          key={i}
          className={`choice ${picked.includes(i) ? 'picked' : ''} ${graded ? (wants.includes(i) ? 'key' : picked.includes(i) ? 'miss' : '') : ''}`}
        >
          <input
            type={multi ? 'checkbox' : 'radio'}
            name={name}
            checked={picked.includes(i)}
            disabled={locked}
            onChange={() => toggle(i)}
          />
          <span>{richText(o)}</span>
        </label>
      ))}
      <Verdict graded={graded} expected={null} />
    </fieldset>
  )
}
