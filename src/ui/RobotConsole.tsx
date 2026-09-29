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
 *
 * Inside a block the line indents the way an editor does (`repl/indent`):
 * after a header the next line starts four spaces in, Tab adds four, and
 * Backspace in the indent takes four back. Tab outside a block still moves
 * focus; inside one, Escape hands it back, so the line never traps a
 * keyboard.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CROW_NAME } from '../../content/cast'
import { DemoTag } from './CrowTag'
import { asBlank, backspace, newline, tab, untab, type Edit } from '../repl/indent'
import { needsContinuation } from '../repl/program'
import type { Demo } from './demo'

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
  /**
   * `v2` is the robot's terminal: it says what state it is in by how it
   * looks (a live block cursor, a locked row, a processing strip) rather
   * than by a greeting and placeholders. `v1` is the original, unchanged.
   */
  look?: 'v1' | 'v2' | undefined
  /** A line typed *for* the player (`ui/demo`). While there is one the
   *  line is closed; it is typed, shown as the crow's, and never run. */
  demo?: Demo | null | undefined
  /** Called once per demonstration, when it has been typed and answered. */
  onDemoTyped?: (() => void) | undefined
}

export function RobotConsole({
  exchanges,
  onSubmit,
  busy,
  disabled,
  greeting,
  listening = false,
  asked = false,
  look = 'v1',
  demo = null,
  onDemoTyped,
}: Props) {
  const v2 = look === 'v2'
  const shown = useDemo(demo, onDemoTyped)
  /** The line takes nothing: not ready, someone talking, or a demonstration. */
  const locked = disabled || listening || demo !== null
  const [buffer, setBuffer] = useState('')
  const [recall, setRecall] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const continuing = needsContinuation(buffer)
  /** A block is being typed: Tab indents rather than moving focus. */
  const inBlock = continuing || buffer.includes('\n')
  /** Escape was pressed in a block: the next Tab leaves the line. Any
   *  other key takes Tab back. */
  const [released, setReleased] = useState(false)
  /** Where the caret goes once an edit made here has rendered. */
  const caretRef = useRef<number | null>(null)

  // Grow the input to fit a continuation rather than scrolling it. Done
  // before paint so the scrollback's stick-to-bottom sees the final height.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
    const caret = caretRef.current
    if (caret !== null) {
      caretRef.current = null
      el.setSelectionRange(caret, caret)
    }
  }, [buffer])

  const apply = (edit: Edit) => {
    caretRef.current = edit.caret
    setBuffer(edit.text)
  }

  // Stay at the bottom as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [exchanges.length, buffer, busy, shown?.typed, shown?.phase])

  // And when the console itself changes size — a window resized, a
  // phone's keyboard opening, the gutter dragged — which moves nothing
  // above and so re-ran none of the above: the prompt was left hidden
  // under the gutter. Only if it was at the bottom, so a player reading
  // back through the scrollback keeps their place.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let pinned = true
    const onScroll = () => {
      pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    }
    const ro = new ResizeObserver(() => {
      if (pinned) el.scrollTop = el.scrollHeight
    })
    el.addEventListener('scroll', onScroll, { passive: true })
    ro.observe(el)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Focus comes back whenever the line opens: after a run, and when the
  // narration hands the keyboard over at a question.
  useEffect(() => {
    if (!busy && !locked) inputRef.current?.focus()
  }, [busy, locked])

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
    const el = e.currentTarget
    const { selectionStart: from, selectionEnd: to } = el
    if (e.key !== 'Escape' && released) setReleased(false)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Inside a block, Enter usually adds a line. It sends when the line
      // it would add is the blank one that closes the block — so the
      // question is what the buffer becomes, not what it is. A line that
      // is only the indent put there for it counts as blank.
      if (continuing && needsContinuation(`${asBlank(buffer, from)}\n`)) {
        apply(newline(buffer, from, to))
        return
      }
      submit()
      return
    }
    if (e.key === 'Tab' && inBlock && !released && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      apply(e.shiftKey ? untab(buffer, from) : tab(buffer, from, to))
      return
    }
    if (e.key === 'Backspace' && inBlock) {
      const edit = backspace(buffer, from, to)
      if (edit) {
        e.preventDefault()
        apply(edit)
        return
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      // In a block, the first Escape only lets go of Tab — what was typed
      // is kept — and the next Tab moves focus on, as it does anywhere.
      if (inBlock && !released) {
        setReleased(true)
        return
      }
      setReleased(false)
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
    if (e.key === 'ArrowUp' && el.selectionStart === 0) {
      e.preventDefault()
      stepRecall(-1)
    }
    if (e.key === 'ArrowDown' && el.selectionStart === el.value.length) {
      e.preventDefault()
      stepRecall(1)
    }
  }

  if (v2) {
    const state = busy || shown?.phase === 'sent' ? 'busy' : demo !== null ? 'demo' : locked ? 'locked' : 'open'
    const typing = shown?.phase === 'typing'
    const label =
      state === 'busy'
        ? 'Instruction for the robot. The robot is working.'
        : state === 'demo'
          ? `Instruction for the robot. Locked while ${CROW_NAME} shows an example.`
          : state === 'locked'
            ? disabled
              ? 'Instruction for the robot. Starting up.'
              : 'Instruction for the robot. Locked while someone is talking: press Next.'
            : asked
              ? 'Instruction for the robot. Waiting for your answer.'
              : 'Instruction for the robot.'
    return (
      <div
        className="console v2"
        data-testid="console"
        data-listening={listening ? 'yes' : 'no'}
        data-state={state}
        data-asked={asked ? 'yes' : 'no'}
        data-empty={buffer === '' ? 'yes' : 'no'}
        onClick={() => inputRef.current?.focus()}
      >
        <span className="lamp" aria-hidden="true" />
        <div className="scrollback" ref={scrollRef} data-testid="scrollback">
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
              {x.echo !== null && <Echo text={x.echo} />}
              {x.error !== null && (
                <>
                  <span className="sr-only">The robot could not do that:</span>
                  <pre className="said err" data-testid="console-error">
                    <WarnMark />
                    {x.error}
                  </pre>
                </>
              )}
            </div>
          ))}

          {demo !== null && shown && shown.phase !== 'typing' && (
            <div className="exchange demo" data-testid="demo-exchange">
              <DemoTag />
              <span className="sr-only">Shown by {CROW_NAME}, not run: </span>
              <Typed source={demo.source} />
              {shown.phase === 'answered' && demo.echo !== null && <Echo text={demo.echo} demo />}
              {shown.phase === 'answered' && demo.error && (
                <>
                  <span className="sr-only">The robot could not do that:</span>
                  <pre className="said err" data-testid="demo-error">
                    <WarnMark />
                    {demo.error}
                  </pre>
                </>
              )}
            </div>
          )}

          <div
            className="prompt-row"
            data-continuing={continuing ? 'yes' : 'no'}
            data-tab={inBlock ? (released ? 'leaves' : 'indents') : 'leaves'}
          >
            <span className="prompt" aria-hidden="true">
              {continuing ? '...' : '>>>'}
            </span>
            <span className="line-wrap">
              {typing && (
                <span className="demo-typing" aria-hidden="true" data-testid="demo-typing">
                  {shown.typed}
                  <span className="cursor" />
                </span>
              )}
              <textarea
                ref={inputRef}
                className="line"
                value={buffer}
                rows={1}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                disabled={locked}
                readOnly={busy}
                hidden={typing}
                aria-label={label}
                aria-describedby={inBlock ? 'console-tab-hint' : undefined}
                data-testid="console-input"
                onChange={(e) => setBuffer(e.target.value)}
                onKeyDown={onKeyDown}
              />
              {!typing && buffer === '' && state !== 'busy' && <span className="cursor" aria-hidden="true" />}
              {state === 'locked' && !disabled && buffer === '' && <LockMark />}
              {state === 'busy' && (
                <span className="working" data-testid="thinking" role="status">
                  <span className="cell" aria-hidden="true" />
                  <span className="cell" aria-hidden="true" />
                  <span className="cell" aria-hidden="true" />
                  <span className="sr-only">The robot is working.</span>
                </span>
              )}
            </span>
            {state === 'locked' && !disabled && buffer !== '' && <LockMark />}
            {inBlock && (
              <span id="console-tab-hint" className="sr-only">
                {released ? 'Tab moves on.' : 'Tab indents. Escape, then Tab, to move on.'}
              </span>
            )}
          </div>
        </div>
      </div>
    )
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

        <div
          className="prompt-row"
          data-continuing={continuing ? 'yes' : 'no'}
          data-tab={inBlock ? (released ? 'leaves' : 'indents') : 'leaves'}
        >
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
            disabled={locked}
            readOnly={busy}
            placeholder={listening ? 'Listening… press Next' : asked ? 'Type your answer here' : undefined}
            aria-label="Say something to the robot"
            aria-describedby={inBlock ? 'console-tab-hint' : undefined}
            data-testid="console-input"
            onChange={(e) => setBuffer(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {inBlock && (
            <span id="console-tab-hint" className="sr-only">
              {released ? 'Tab moves on.' : 'Tab indents. Escape, then Tab, to move on.'}
            </span>
          )}
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

/** What the robot answered: its mark, then the value, on a lit band. */
function Echo({ text, demo = false }: { text: string; demo?: boolean }) {
  // The spoken prefix sits outside the `echo` element, so the element's
  // text is the value alone, as in v1 (tests read it).
  return (
    <>
      <span className="sr-only">The robot answers:</span>
      <pre className="said value" data-testid={demo ? 'demo-echo' : 'echo'}>
        <RobotMark />
        <span className="said-text">{text}</span>
      </pre>
    </>
  )
}

function RobotMark() {
  return (
    <svg className="mark robot-mark" viewBox="0 0 16 16" aria-hidden="true">
      <line x1="8" y1="1.5" x2="8" y2="4" />
      <circle cx="8" cy="1.5" r="1" className="fill" />
      <rect x="2.5" y="4" width="11" height="9" rx="2.5" />
      <circle cx="6" cy="8.5" r="1.2" className="fill" />
      <circle cx="10" cy="8.5" r="1.2" className="fill" />
    </svg>
  )
}

function WarnMark() {
  return (
    <svg className="mark warn-mark" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.8 15 14H1z" />
      <line x1="8" y1="6" x2="8" y2="9.6" />
      <circle cx="8" cy="11.8" r="0.9" className="fill" />
    </svg>
  )
}

function LockMark() {
  return (
    <svg className="mark lock-mark" viewBox="0 0 16 16" aria-hidden="true" data-testid="console-lock">
      <rect x="3" y="7" width="10" height="7.5" rx="1.6" />
      <path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" />
    </svg>
  )
}

type Shown = { key: string; typed: string; phase: 'typing' | 'sent' | 'answered' }

/** A pause before the first key, before Enter, and before the answer. */
const DEMO_START_MS = 450
const DEMO_SEND_MS = 380
const DEMO_ANSWER_MS = 320

/**
 * How long after the character before this one a demonstration types
 * `ch`: about ten a second, not a metronome. Deterministic in `i`, so the
 * same line types the same way every time it is shown.
 */
export function keyDelay(ch: string, i: number): number {
  const jitter = ((i * 37 + 11) % 53) - 26
  const pause = ch === ' ' ? 45 : /[=(),:"'[\]]/.test(ch) ? 30 : 0
  return 96 + jitter + pause
}

/**
 * Plays a demonstration: typed a key at a time, sent, answered, and then
 * `onDemoTyped` — once per demonstration, however often React runs the
 * effect. Restarts on a new `key`; gone when `demo` is. Reduced motion
 * shows it answered at once.
 */
function useDemo(demo: Demo | null, onDemoTyped: (() => void) | undefined): Shown | null {
  const [shown, setShown] = useState<Shown | null>(null)
  const latest = useRef({ demo, onDemoTyped })
  latest.current = { demo, onDemoTyped }
  const reported = useRef<string | null>(null)
  const key = demo?.key ?? null

  useEffect(() => {
    if (key === null) {
      reported.current = null
      setShown(null)
      return
    }
    if (reported.current !== key) reported.current = null
    const source = latest.current.demo?.source ?? ''
    const finish = () => {
      setShown({ key, typed: source, phase: 'answered' })
      if (reported.current !== key) {
        reported.current = key
        latest.current.onDemoTyped?.()
      }
    }
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || reported.current === key) {
      finish()
      return
    }
    setShown({ key, typed: '', phase: 'typing' })
    let timer: ReturnType<typeof setTimeout>
    let at = 0
    const typeNext = () => {
      at += 1
      setShown({ key, typed: source.slice(0, at), phase: 'typing' })
      timer = at < source.length ? setTimeout(typeNext, keyDelay(source[at]!, at)) : setTimeout(send, DEMO_SEND_MS)
    }
    const send = () => {
      setShown({ key, typed: source, phase: 'sent' })
      timer = setTimeout(finish, DEMO_ANSWER_MS)
    }
    timer = setTimeout(source.length > 0 ? typeNext : send, DEMO_START_MS)
    return () => clearTimeout(timer)
  }, [key])

  // A render between a new key and its effect must not show the old one.
  return shown && shown.key === key ? shown : null
}
