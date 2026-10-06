/**
 * The room's strip, along the top of a page that can be shared: Share
 * when alone; once shared, everyone here as a coloured dot with a name,
 * Copy link and Leave.
 *
 * The roles are said in words beside the names (learner, helper), because
 * a helper who joins needs to know whose session this is.
 */
import { useState } from 'react'
import type { RoomView } from './useRoom'

export function RoomBar({ view, onShare, busy }: { view: RoomView; onShare: () => void; busy?: string | null | undefined }) {
  const [copied, setCopied] = useState(false)
  const { status, room, peers } = view

  if (status === 'solo')
    return (
      <div className="room-bar" data-testid="room-bar" data-room="solo">
        <button type="button" className="room-share" onClick={onShare} data-testid="room-share">
          <PeopleIcon />
          Share
        </button>
        <span className="room-hint">Invite a helper to code with you</span>
      </div>
    )

  if (status === 'connecting')
    return (
      <div className="room-bar" data-testid="room-bar" data-room="connecting">
        <span className="room-hint">Connecting to the room…</span>
      </div>
    )

  if (status === 'unreachable')
    return (
      <div className="room-bar" data-testid="room-bar" data-room="unreachable" role="alert">
        <span className="room-hint warn">That room couldn't be reached. You're coding on your own.</span>
        <button type="button" className="room-leave" onClick={() => void view.leave().then(() => window.location.reload())}>
          OK
        </button>
      </div>
    )

  const everyone = room ? [{ ...room.me, you: true }, ...peers.map((p) => ({ ...p, you: false }))] : []
  const copy = async () => {
    const link = view.link()
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('Copy this link:', link)
    }
  }

  return (
    <div className="room-bar" data-testid="room-bar" data-room="live" data-peers={everyone.length}>
      <ul className="room-people" aria-label="In this room">
        {everyone.map((p) => (
          <li
            key={p.id}
            style={{ ['--peer' as string]: p.color }}
            title={`${p.name}${p.you ? ' (you)' : ''}, ${p.role}`}
            data-testid="room-person"
          >
            <span className="dot" aria-hidden="true" />
            <span className="who">
              {p.name}
              {p.you ? ' (you)' : ''}
            </span>
            <span className="role">{p.role}</span>
          </li>
        ))}
      </ul>
      <span className="room-count">{everyone.length} here</span>
      {busy && (
        <span className="room-hint" data-testid="room-busy">
          {busy}
        </span>
      )}
      <span className="spacer" />
      <button type="button" className="room-copy" onClick={() => void copy()} data-testid="room-copy">
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <button type="button" className="room-leave" onClick={() => void view.leave()} data-testid="room-leave">
        Leave
      </button>
    </div>
  )
}

const PeopleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
    <circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M15.5 5.2a3 3 0 0 1 0 5.6M17 14.3c1.9.6 3.1 2.2 3.5 4.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
