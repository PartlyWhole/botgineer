/**
 * The tutorial guide: a crow. Not a person, and not the robot — the player
 * is learning to program the robot, so the teacher should not be it.
 *
 * Same six expressions as the rest of the cast, same rule: an expression
 * is never the only signal. Everything the crow means is also in its text.
 */
import type { Mood } from '../game/director'
import { looks } from './Characters'

function face(mood: Mood) {
  switch (mood) {
    case 'thinking':
      return { eye: 'squint', head: -6 }
    case 'attentive':
      return { eye: 'wide', head: 0 }
    case 'pleased':
      return { eye: 'happy', head: -3 }
    case 'celebrate':
      return { eye: 'happy', head: -8 }
    case 'confused':
      return { eye: 'wide', head: 7 }
    default:
      return { eye: 'open', head: 0 }
  }
}

function Eye({ kind, x }: { kind: string; x: number }) {
  if (kind === 'happy') return <path d={`M ${x - 6} 0 q 6 -7 12 0`} className="eye-line" />
  if (kind === 'squint') return <path d={`M ${x - 6} 0 h 12`} className="eye-line" />
  const r = kind === 'wide' ? 7 : 6
  return (
    <g>
      <circle cx={x} cy={0} r={r} className="eye-white" />
      <circle cx={x} cy={kind === 'wide' ? -1 : 0} r={r * 0.5} className="eye-pupil" />
    </g>
  )
}

export function Crow({ mood }: { mood: Mood }) {
  const f = face(mood)
  return (
    <svg
      viewBox="-70 -80 140 160"
      className={`character crow mood-${mood}`}
      role="img"
      aria-label={`The crow looks ${looks(mood)}`}
    >
      {/* tail and body */}
      <path d="M 26 34 q 30 6 40 26 q -26 2 -44 -10 z" className="feather" />
      <ellipse cx="0" cy="28" rx="40" ry="42" className="body" />
      <path d="M -34 16 q -14 26 4 46 q 14 -10 18 -34 z" className="wing" />
      {/* head */}
      <g transform={`rotate(${f.head} 0 -24)`}>
        <circle cx="0" cy="-26" r="32" className="body" />
        <path d="M 28 -28 l 30 8 l -30 10 z" className="beak" />
        <g transform="translate(-2,-32)">
          <Eye kind={f.eye} x={-12} />
          <Eye kind={f.eye} x={14} />
        </g>
      </g>
      {/* feet */}
      <path d="M -14 66 v 10 M -20 76 h 12 M 14 66 v 10 M 8 76 h 12" className="feet" />
    </svg>
  )
}
