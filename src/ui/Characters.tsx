/**
 * SVG cast. Six discrete expressions each, no tweening.
 *
 * Expressions are never the only signal: every verdict is carried by text
 * too (DESIGN.md §10), so a player who cannot read faces loses nothing.
 */
import type { Mood } from '../game/director'

type Props = { mood: Mood; className?: string }

/** Eyes and mouth are the whole vocabulary. Keeping them in one table makes
 *  the expression set auditable at a glance. */
function face(mood: Mood) {
  switch (mood) {
    case 'thinking':
      return { eye: 'squint', mouth: 'M -8 8 q 8 -4 16 0', brow: -3 }
    case 'attentive':
      return { eye: 'wide', mouth: 'M -7 7 q 7 3 14 0', brow: -1 }
    case 'pleased':
      return { eye: 'happy', mouth: 'M -9 5 q 9 9 18 0', brow: 0 }
    case 'celebrate':
      return { eye: 'happy', mouth: 'M -11 3 q 11 14 22 0', brow: 0 }
    case 'confused':
      return { eye: 'wide', mouth: 'M -8 10 q 8 -7 16 0', brow: 2 }
    default:
      return { eye: 'open', mouth: 'M -7 7 q 7 2 14 0', brow: 0 }
  }
}

function Eye({ kind, x }: { kind: string; x: number }) {
  if (kind === 'happy') {
    return <path d={`M ${x - 7} 0 q 7 -8 14 0`} className="eye-line" />
  }
  if (kind === 'squint') {
    return <path d={`M ${x - 7} 0 h 14`} className="eye-line" />
  }
  const r = kind === 'wide' ? 8 : 7
  return (
    <g>
      <circle cx={x} cy={0} r={r} className="eye-white" />
      <circle cx={x} cy={kind === 'wide' ? -1 : 1} r={r * 0.45} className="eye-pupil" />
    </g>
  )
}

export function Robot({ mood, className }: Props) {
  const f = face(mood)
  return (
    <svg
      viewBox="-70 -90 140 170"
      className={`character robot mood-${mood} ${className ?? ''}`}
      role="img"
      aria-label={`The robot looks ${mood}`}
    >
      <line x1="0" y1="-62" x2="0" y2="-80" className="antenna" />
      <circle cx="0" cy="-84" r="7" className="antenna-tip" />
      <rect x="-56" y="-62" width="112" height="104" rx="26" className="body" />
      <rect x="-40" y="-44" width="80" height="58" rx="18" className="visor" />
      <g transform="translate(0,-16)">
        <Eye kind={f.eye} x={-18} />
        <Eye kind={f.eye} x={18} />
      </g>
      <path d={f.mouth} transform="translate(-1,-4)" className="mouth" />
      <rect x="-34" y="46" width="24" height="16" rx="7" className="foot" />
      <rect x="10" y="46" width="24" height="16" rx="7" className="foot" />
    </svg>
  )
}

export function Courier({ mood, className }: Props) {
  const f = face(mood)
  return (
    <svg
      viewBox="-70 -100 140 180"
      className={`character courier mood-${mood} ${className ?? ''}`}
      role="img"
      aria-label={`Mira looks ${mood}`}
    >
      <path d="M -44 28 q 0 -34 44 -34 q 44 0 44 34 l 0 44 l -88 0 z" className="torso" />
      <circle cx="0" cy="-34" r="44" className="skin" />
      <path d="M -46 -44 q 10 -44 46 -44 q 36 0 46 44 q -20 -16 -46 -16 q -26 0 -46 16 z" className="hair" />
      <path d="M -50 -42 h 100 l -6 -12 h -88 z" className="cap" />
      <g transform="translate(0,-34)">
        <Eye kind={f.eye} x={-16} />
        <Eye kind={f.eye} x={16} />
      </g>
      <path d={f.mouth} transform="translate(-1,-20)" className="mouth" />
    </svg>
  )
}
