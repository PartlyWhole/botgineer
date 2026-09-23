import { useState } from 'react'
import { richText } from '../richText'
import type { FormProps } from './shared'
import { Verdict } from './shared'

/**
 * Label the code: put a role on each piece of a line.
 *
 * Roles can be dragged onto a piece, or picked from its menu — the menu is
 * the same answer by keyboard, and it is what a screen reader uses.
 */
export function LabelsForm({ part, answer, onAnswer, locked, graded }: FormProps<'labels'>) {
  const roles = answer?.roles ?? part.spans.map(() => null)
  const [dragging, setDragging] = useState<string | null>(null)
  const set = (i: number, role: string | null) => onAnswer({ kind: 'labels', roles: roles.map((r, k) => (k === i ? role : r)) })
  return (
    <div className="form labels-form">
      <p className="form-label">{part.prompt ?? 'Give each piece of the line its role.'}</p>
      <pre className="labels-line">
        <code>{part.line}</code>
      </pre>
      {!locked && (
        <ul className="role-chips" aria-label="Roles">
          {part.roles.map((r) => (
            <li
              key={r}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', r)
                setDragging(r)
              }}
              onDragEnd={() => setDragging(null)}
              className={`role-chip ${roles.includes(r) ? 'used' : ''} ${dragging === r ? 'dragging' : ''}`}
            >
              {richText(r)}
            </li>
          ))}
        </ul>
      )}
      <ul className="spans">
        {part.spans.map((s, i) => {
          const right = graded ? roles[i] === s.role : null
          return (
            <li
              key={i}
              className={`span-row ${right === true ? 'right' : right === false ? 'wrong' : ''}`}
              onDragOver={(e) => !locked && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (!locked) set(i, e.dataTransfer.getData('text/plain'))
              }}
            >
              <code className="span-text">{s.text}</code>
              <select value={roles[i] ?? ''} disabled={locked} onChange={(e) => set(i, e.target.value || null)} aria-label={`Role of ${s.text}`}>
                <option value="">Drop or choose a role…</option>
                {part.roles.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/`/g, '')}
                  </option>
                ))}
              </select>
              {graded && right === false && <p className="span-key">It is: {richText(s.role)}</p>}
            </li>
          )
        })}
      </ul>
      <Verdict graded={graded} expected={null} />
    </div>
  )
}
