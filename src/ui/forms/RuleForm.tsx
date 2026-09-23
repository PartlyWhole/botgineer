import { useId } from 'react'
import { richText } from '../richText'
import type { FormProps } from './shared'

/**
 * State the rule: written first, then marked against the key.
 *
 * The self-mark is honest about the one mistake a machine cannot grade:
 * *right idea, wrong word* is recorded as a vocabulary-only miss, which is
 * the cheapest kind and never held against a checkpoint.
 */
export function RuleForm({
  part,
  answer,
  onAnswer,
  locked,
  graded,
  onMark,
}: FormProps<'rule'> & { onMark: (m: 'right' | 'word' | 'missed') => void }) {
  const id = useId()
  const text = answer?.text ?? ''
  return (
    <div className="form rule-form">
      <label htmlFor={id} className="form-label">
        {richText(part.prompt ?? 'Write the rule in your own words.')}
      </label>
      <textarea id={id} value={text} readOnly={locked} rows={3} onChange={(e) => onAnswer({ kind: 'rule', text: e.target.value, mark: null })} />
      {locked && !graded && (
        <div className="self-mark" role="group" aria-label="Mark yourself against the key">
          <p className="form-hint">Read the key’s answer, then mark yours:</p>
          <button type="button" onClick={() => onMark('right')} data-testid="mark-right">
            Right
          </button>
          <button type="button" onClick={() => onMark('word')} data-testid="mark-word">
            Right idea, wrong word
          </button>
          <button type="button" onClick={() => onMark('missed')} data-testid="mark-missed">
            Missed
          </button>
          {part.wrongWord && <p className="form-hint">Wrong word here means: {richText(part.wrongWord)}.</p>}
        </div>
      )}
      {graded && (
        <p className={`verdict-inline ${graded.right ? 'right' : graded.soft ? 'soft' : 'wrong'}`}>
          {graded.right ? 'Marked right.' : graded.soft ? 'Marked: right idea, wrong word — a vocabulary-only miss.' : 'Marked missed.'}
        </p>
      )}
    </div>
  )
}
