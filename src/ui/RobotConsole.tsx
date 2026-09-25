/**
 * The robot's console: one line at a time.
 *
 * This is the beginner's whole interface to the robot, and it is
 * deliberately not an editor. An editor asks you to compose a program and
 * then hand it over; a console asks you to say one thing and hear one
 * thing back. For a player who does not yet know that `10` is an object,
 * the second is a conversation and the first is homework.
 *
 * It owns the caret and the input history and nothing else. What a line
 * *does* is the workbench's business — this component cannot run anything,
 * which is why it can be rendered in a test without a Python runtime.
 *
 * Multi-line input exists but stays out of the way: a block header opens a
 * continuation, and a blank line closes it, exactly as a terminal REPL
 * does. The player is never asked to learn that; they discover it the
 * first time they type `def f():`.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { needsContinuation } from '../repl/program'

export type Exchange = {
  id: number
  /** Exactly what the player typed, newlines and all. */
  source: string
  /** `repr` of the value, when the line was a bare expression. */
  echo: string | null
  /** Anything the line printed. */
  output: string
  /** Why it did not complete. A failed line is not kept. */
  error: string | null
  /** Run for the player, not by them: an exercise's setup. */
  given?: boolean
}

type Props = {
  exchanges: Exchange[]
  onSubmit: (source: string) => void
  busy: boolean
  disabled: boolean
  /** Shown once, above the first prompt. The robot introducing itself. */
  greeting?: string | undefined
  /**
   * Someone on the stage is talking: the line is closed until they hand
   * over, and says so. Closed, not hidden — the prompt stays where the
   * answer will go, so the eye knows where to come back to.
   */
  listening?: boolean | undefined
  /** A question is waiting: the prompt itself says where the answer goes. */
  asked?: boolean | undefined
}

export function RobotConsole({ exchanges, onSubmit, busy, disabled, greeting, listening = false, asked = false }: Props) {
  const [buffer, setBuffer] = useState('')
  const [recall, setRecall] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const continuing = needsContinuation(buffer)

  // Grow the input to fit a continuation rather than scrolling it. Done
  // before paint so the scrollback's stick-to-bottom sees the final height.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [buffer])

  // Stay at the bottom as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [exchanges.length, buffer, busy])

  // Focus comes back whenever the line opens: after a run, and when the
  // narration hands the keyboard over at a question.
  useEffect(() => {
    if (!busy && !disabled && !listening) inputRef.current?.focus()
  }, [busy, disabled, listening])

  const submit = () => {
    const source = buffer.replace(/\s+$/, '')
    if (source.trim() === '') {
      setBuffer('')
      return
    }
    onSubmit(source)
    setBuffer('')
    setRecall(null)
  }

  /** Walks back through what was typed before, newest first. Only the
   *  player's own lines — the robot's replies are not re-sendable. */
  const stepRecall = (delta: number) => {
    if (exchanges.length === 0) return
    const next = recall === null ? (delta < 0 ? exchanges.length - 1 : null) : recall + delta
    if (next === null || next >= exchanges.length) {
      setRecall(null)
      setBuffer('')
      return
    }
    const at = Math.max(0, next)
    setRecall(at)
    setBuffer(exchanges[at]!.source)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Inside a block, Enter usually adds a line. It sends when the line
      // it would add is the blank one that closes the block — so the
      // question is what the buffer becomes, not what it is.
      if (continuing && needsContinuation(`${buffer}\n`)) return
      e.preventDefault()
      submit()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      if (buffer !== '') {
        setBuffer('')
        setRecall(null)
      } else {
        inputRef.current?.blur()
      }
      return
    }
    // Recall only from the edges of the buffer, so arrow keys still move
    // the caret through a multi-line block.
    const el = e.currentTarget
    if (e.key === 'ArrowUp' && el.selectionStart === 0) {
      e.preventDefault()
      stepRecall(-1)
    }
    if (e.key === 'ArrowDown' && el.selectionStart === el.value.length) {
      e.preventDefault()
      stepRecall(1)
    }
  }

  return (
    <div
      className="console"
      data-testid="console"
      data-listening={listening ? 'yes' : 'no'}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="scrollback" ref={scrollRef} data-testid="scrollback">
        {greeting && <p className="says">{greeting}</p>}

        {exchanges.map((x) => (
          <div
            key={x.id}
            className={`exchange ${x.given ? 'given' : ''}`}
            data-testid={x.given ? 'given' : 'exchange'}
            title={x.given ? 'Already run for you' : undefined}
          >
            {x.given && <span className="given-tag">given</span>}
            <Typed source={x.source} />
            {x.output !== '' && <pre className="said out">{x.output.replace(/\n$/, '')}</pre>}
            {x.echo !== null && (
              <pre className="said value" data-testid="echo">
                {x.echo}
              </pre>
            )}
            {x.error !== null && (
              <pre className="said err" data-testid="console-error">
                {x.error}
              </pre>
            )}
          </div>
        ))}

        <div className="prompt-row" data-continuing={continuing ? 'yes' : 'no'}>
          <span className="prompt" aria-hidden="true">
            {continuing ? '...' : '>>>'}
          </span>
          <textarea
            ref={inputRef}
            className="line"
            value={buffer}
            rows={1}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            disabled={disabled || listening}
            readOnly={busy}
            placeholder={listening ? 'Listening… press Next' : asked ? 'Type your answer here' : undefined}
            aria-label="Say something to the robot"
            data-testid="console-input"
            onChange={(e) => setBuffer(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>

        {busy && (
          <p className="says thinking" data-testid="thinking">
            the robot is thinking…
          </p>
        )}
      </div>
    </div>
  )
}

/** The player's own line, re-shown with the prompt it was typed at. */
function Typed({ source }: { source: string }) {
  const lines = source.split('\n')
  return (
    <pre className="typed">
      {lines.map((line, i) => (
        <span key={i} className="typed-line">
          <span className="prompt" aria-hidden="true">
            {i === 0 ? '>>>' : '...'}
          </span>
          {line}
          {'\n'}
        </span>
      ))}
    </pre>
  )
}
