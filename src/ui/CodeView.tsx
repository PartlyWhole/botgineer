/**
 * A snippet to read, not to edit: highlighted Python, one row per line.
 *
 * Reading exercises point at lines constantly — "click the first line
 * that differs", "number the lines in the order they run", "which lines
 * are the loop body" — so every line is its own element, and while a part
 * is asking for a line, every line is a button. That is why this is not
 * the CodeMirror editor: an editor's lines are not addressable, and a
 * reading exercise's lines are the whole interface.
 *
 * Highlighting comes from the same Lezer grammar the editor uses, so a
 * snippet looks the same here as it does once you are asked to fix it.
 */
import { Fragment, useMemo, type ReactNode } from 'react'
import { classHighlighter, highlightCode } from '@lezer/highlight'
import { parser } from '@lezer/python'

export type LineMark = {
  /** `pick` a line the learner chose; `right`/`wrong` after grading;
   *  `body` inside a marked block; `key` the key's answer. */
  tone?: 'pick' | 'right' | 'wrong' | 'body' | 'key'
  /** Shown at the end of the line: an order number, a run count. */
  badge?: ReactNode
}

type Props = {
  code: string
  /** The line the trace is showing, highlighted like the editor does. */
  traceLine?: number | null
  marks?: Map<number, LineMark>
  /** The collection's `# ←` marker. */
  marker?: { line: number; text: string } | undefined
  /** When set, lines are buttons and a click reports the line. */
  onLine?: ((line: number) => void) | undefined
  /** What clicking a line does, for its accessible name. */
  pickLabel?: string
  label?: string
}

type Token = { text: string; cls: string }

function tokens(code: string): Token[][] {
  const lines: Token[][] = [[]]
  highlightCode(
    code,
    parser.parse(code),
    classHighlighter,
    (text, cls) => lines[lines.length - 1]!.push({ text, cls }),
    () => lines.push([]),
  )
  return lines
}

export function CodeView({ code, traceLine = null, marks, marker, onLine, pickLabel = 'Pick line', label }: Props) {
  const text = code.replace(/\n+$/, '')
  const lines = useMemo(() => tokens(text), [text])

  return (
    <div className={`code-view ${onLine ? 'picking' : ''}`} data-testid="code-view" aria-label={label}>
      <ol className="code-lines">
        {lines.map((toks, i) => {
          const n = i + 1
          const mark = marks?.get(n)
          const blank = toks.every((t) => t.text.trim() === '')
          const body = (
            <>
              <span className="ln" aria-hidden="true">
                {n}
              </span>
              <code className="src">
                {toks.length === 0 ? ' ' : toks.map((t, k) => (
                  <Fragment key={k}>{t.cls ? <span className={t.cls}>{t.text}</span> : t.text}</Fragment>
                ))}
                {marker?.line === n && <span className="code-marker"> ← {marker.text}</span>}
              </code>
              {mark?.badge !== undefined && <span className="badge-slot">{mark.badge}</span>}
            </>
          )
          return (
            <li
              key={n}
              className={`code-line ${mark?.tone ?? ''} ${traceLine === n ? 'traced' : ''}`}
              data-line={n}
            >
              {onLine && !blank ? (
                <button
                  type="button"
                  className="code-line-button"
                  onClick={() => onLine(n)}
                  aria-label={`${pickLabel} ${n}: ${toks.map((t) => t.text).join('').trim()}`}
                  data-testid={`line-${n}`}
                >
                  {body}
                </button>
              ) : (
                <div className="code-line-body">{body}</div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
