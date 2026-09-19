/**
 * A prompt that behaves like the Python one.
 *
 * Not xterm: this is an input surface, and xterm's job here is program
 * output. What it borrows from a real REPL is the part that matters —
 * `>>>`, an echoed repr, recallable history, and errors that sit in the
 * transcript instead of a dialog.
 */
import { useEffect, useRef, useState } from 'react'

export type ReplLine =
  | { kind: 'input'; text: string }
  | { kind: 'result'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'note'; text: string }

type Props = {
  lines: ReplLine[]
  onSubmit: (source: string) => void
  busy: boolean
  /** Offered by the guide; clicking it fills the prompt rather than
   *  submitting, so the player still types Enter themselves. */
  suggestion?: string | null
}

export function Repl({ lines, onSubmit, busy, suggestion }: Props) {
  const [draft, setDraft] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [recall, setRecall] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // The transcript follows the newest line, the way a terminal does.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const submit = () => {
    const source = draft.trim()
    if (!source || busy) return
    setHistory((h) => [...h, source])
    setRecall(null)
    setDraft('')
    onSubmit(source)
  }

  return (
    <div
      className="repl"
      onClick={() => inputRef.current?.focus()}
      data-testid="repl"
      data-busy={busy ? 'yes' : 'no'}
    >
      <div className="repl-scroll" ref={scrollRef}>
        {lines.map((line, i) => (
          <p key={i} className={`repl-line ${line.kind}`}>
            {line.kind === 'input' && <span className="prompt">&gt;&gt;&gt;</span>}
            <span className="repl-text">{line.text}</span>
          </p>
        ))}

        <p className="repl-line entry">
          <label className="prompt" htmlFor="repl-input">
            &gt;&gt;&gt;
          </label>
          <input
            id="repl-input"
            ref={inputRef}
            className="repl-input"
            value={draft}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            aria-label="Type a Python expression"
            data-testid="repl-input"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
                return
              }
              // Up and Down walk the history, as they do in a real shell.
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                if (history.length === 0) return
                e.preventDefault()
                const at = recall ?? history.length
                const next =
                  e.key === 'ArrowUp'
                    ? Math.max(0, at - 1)
                    : Math.min(history.length, at + 1)
                setRecall(next)
                setDraft(next === history.length ? '' : (history[next] ?? ''))
              }
            }}
          />
        </p>
      </div>

      {suggestion && !busy && (
        <div className="repl-suggest">
          <span>try</span>
          <button
            type="button"
            className="chip"
            data-testid="suggestion"
            onClick={(e) => {
              e.stopPropagation()
              setDraft(suggestion)
              inputRef.current?.focus()
            }}
          >
            {suggestion}
          </button>
          <span className="quiet">then press Enter</span>
        </div>
      )}
    </div>
  )
}
