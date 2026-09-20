/**
 * Talking to the robot.
 *
 * The frame is a conversation; the content is still real Python. What the
 * player types is shown as code, because it *is* code — the point is that
 * writing Python is how you talk to this machine, not that the Python has
 * been hidden behind a chat toy.
 *
 * Three voices, and they are never interchangeable: the player, the robot
 * (which reports), and the crow (which teaches).
 */
import { useEffect, useRef, useState } from 'react'
import { Robot } from './Characters'
import { richText } from './richText'
import { Crow } from './Crow'
import type { Mood } from '../game/director'

export type Message =
  | { from: 'you'; code: string }
  | { from: 'robot'; text: string; code?: string; tone?: 'ok' | 'error' }
  | { from: 'crow'; text: string }

type Props = {
  messages: Message[]
  onSend: (source: string) => void
  busy: boolean
  disabled: boolean
  crowMood: Mood
  /** Offered by the crow. Clicking it fills the box rather than sending,
   *  so the player still commits to it themselves. */
  suggestion?: string | null
}

export function Conversation({
  messages,
  onSend,
  busy,
  disabled,
  crowMood,
  suggestion,
}: Props) {
  const [draft, setDraft] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [recall, setRecall] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  const send = () => {
    const source = draft.trim()
    if (!source || busy || disabled) return
    setHistory((h) => [...h, source])
    setRecall(null)
    setDraft('')
    onSend(source)
  }

  return (
    <div className="convo" data-testid="conversation" data-busy={busy ? 'yes' : 'no'}>
      <div className="convo-scroll" ref={scrollRef} role="log" aria-live="polite">
        {messages.map((m, i) => (
          <Bubble key={i} message={m} crowMood={crowMood} />
        ))}
        {busy && (
          <div className="turn robot">
            <span className="avatar" aria-hidden="true">
              <Robot mood="thinking" />
            </span>
            <div className="says thinking" data-testid="thinking">
              <span className="who">Robot</span>
              <p className="line">
                <span className="dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="sr-only">The robot is working on it</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="composer">
        {suggestion && !busy && !disabled && (
          <div className="quick">
            <span className="quiet">suggested</span>
            <button
              type="button"
              className="chip"
              data-testid="suggestion"
              onClick={() => {
                setDraft(suggestion)
                inputRef.current?.focus()
              }}
            >
              {suggestion}
            </button>
          </div>
        )}

        <div className="composer-row">
          <input
            ref={inputRef}
            className="composer-input"
            value={draft}
            disabled={busy || disabled}
            autoComplete="off"
            spellCheck={false}
            placeholder={disabled ? 'Waiting for the robot to wake up…' : 'Say something to the robot…'}
            aria-label="Say something to the robot, in Python"
            data-testid="composer-input"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                send()
                return
              }
              // Up and Down walk back through what you have said, the way
              // every prompt a programmer has ever used does.
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                if (history.length === 0) return
                e.preventDefault()
                const at = recall ?? history.length
                const next =
                  e.key === 'ArrowUp' ? Math.max(0, at - 1) : Math.min(history.length, at + 1)
                setRecall(next)
                setDraft(next === history.length ? '' : (history[next] ?? ''))
              }
            }}
          />
          <button
            type="button"
            className="primary send"
            onClick={send}
            disabled={busy || disabled || draft.trim() === ''}
            data-testid="send"
          >
            Say it
          </button>
        </div>
        <p className="composer-hint quiet">
          You are talking to the robot in Python. Press <kbd>Enter</kbd> to send, <kbd>↑</kbd> for
          what you said before.
        </p>
      </div>
    </div>
  )
}

function Bubble({ message, crowMood }: { message: Message; crowMood: Mood }) {
  if (message.from === 'you') {
    return (
      <div className="turn you">
        <div className="says">
          <span className="who">You</span>
          <p className="line">
            <code>{message.code}</code>
          </p>
        </div>
      </div>
    )
  }

  if (message.from === 'crow') {
    return (
      <div className="turn crow-turn">
        <span className="avatar" aria-hidden="true">
          <Crow mood={crowMood} />
        </span>
        <div className="says">
          <span className="who">Crow</span>
          <p className="line">{richText(message.text)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="turn robot">
      <span className="avatar" aria-hidden="true">
        <Robot mood={message.tone === 'error' ? 'confused' : 'pleased'} />
      </span>
      <div className={`says ${message.tone === 'error' ? 'bad' : ''}`}>
        <span className="who">Robot</span>
        <p className="line">
          {richText(message.text)}
          {message.code !== undefined && <code className="made">{message.code}</code>}
        </p>
      </div>
    </div>
  )
}
