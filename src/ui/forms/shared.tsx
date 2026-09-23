/**
 * What every answer widget shares: the part, the answer so far, whether it
 * is locked, and — once committed — how it was graded.
 */
import type { ReactNode } from 'react'
import type { Answer, Graded, Part } from '../../collection/model'
import type { Truth } from '../../collection/grade'
import { richText } from '../richText'

export type FormProps<K extends Answer['kind']> = {
  part: Extract<Part, { kind: K }>
  answer: Extract<Answer, { kind: K }> | null
  onAnswer: (a: Extract<Answer, { kind: K }>) => void
  /** Committed: shown, not editable. */
  locked: boolean
  graded: Graded | null
  truth: Truth | null
  index: number
  /** For the parts that are answered by clicking the code. */
  picking: boolean
  onPicking: (on: boolean) => void
}

/** Right or wrong, what was expected, and why — after the commit. */
/** `expected` of `null` says nothing about what was expected — for the
 *  widgets that mark the right answer in place. */
export function Verdict({ graded, expected }: { graded: Graded | null; expected?: ReactNode | null }) {
  if (!graded) return null
  return (
    <div className={`verdict ${graded.right ? 'right' : graded.soft ? 'soft' : 'wrong'}`} data-testid="verdict" data-right={graded.right ? 'yes' : 'no'}>
      <p className="verdict-head">{graded.right ? 'Right' : graded.soft ? 'Right idea, wrong word' : 'Not quite'}</p>
      {graded.why && <p className="verdict-why">{richText(graded.why)}</p>}
      {graded.note && <p className="verdict-note">{richText(graded.note)}</p>}
      {!graded.right && expected !== null && (expected ?? graded.expected) && (
        <div className="verdict-expected">
          <span className="verdict-label">Python:</span>
          {expected ?? <pre>{graded.expected}</pre>}
        </div>
      )}
    </div>
  )
}

/** A toggle that hands line clicks in the code to this part. */
export function PickToggle({ picking, onPicking, locked, label }: { picking: boolean; onPicking: (on: boolean) => void; locked: boolean; label: string }) {
  if (locked) return null
  return (
    <button type="button" className={`pick-toggle ${picking ? 'on' : ''}`} aria-pressed={picking} onClick={() => onPicking(!picking)}>
      {picking ? 'Clicking the code answers this' : label}
    </button>
  )
}
