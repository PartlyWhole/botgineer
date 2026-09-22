/**
 * SVG cast.
 *
 * Every part that moves is its own `<g>`, and its pose comes from CSS
 * under the `mood-*` class rather than from an attribute — so a change of
 * mood eases instead of snapping. A `transform` attribute is invisible to
 * CSS transitions, which is why the old tilt never animated. Placement
 * (where an eye sits on the face) stays an attribute on an outer group;
 * pose goes on an inner one, so the two cannot fight over one property.
 *
 * Shapes that genuinely differ are not swapped. An eye is always drawn
 * open *and* as a happy arc, and the mood cross-fades between them; a
 * mouth is one curve whose vertical scale runs from a smile through flat
 * to a frown, which is the in-between a real face has.
 *
 * Idle life (breathing, blinks, the antenna's bob) is CSS keyframes too,
 * on further wrappers, timed per actor by custom properties the scene
 * sets. Nothing here holds state or runs a timer.
 *
 * Expressions are never the only signal: every verdict is carried by text
 * too (DESIGN.md §10), so a player who cannot read faces loses nothing.
 */
import type { Mood } from '../game/director'

type Props = {
  mood: Mood
  className?: string
  /** The line this character is saying, while it is theirs to say. The
   *  mouth is keyed on it, so a new line restarts a finite flap and no
   *  timer has to decide when it stops. */
  talk?: string | undefined
}

/**
 * The mood as an adjective. `celebrate` is the name of a face, not a word
 * that follows "looks", and an accessible name is prose or it is nothing:
 * "The robot looks celebrate" was what a screen reader read out.
 */
export const looks = (mood: Mood): string => (mood === 'celebrate' ? 'delighted' : mood)

/**
 * One eye, in every pose at once. The open eye blinks inside `.blink`
 * and takes its mood pose on `.eye-open` (wide, squint, gone); the happy
 * arc fades in over it. Placement is the only attribute transform.
 */
export function Eye({ x, r, pupil = 0.45 }: { x: number; r: number; pupil?: number }) {
  return (
    <g transform={`translate(${x},0)`} className="eye">
      <g className="blink">
        <g className="eye-open">
          <circle r={r} className="eye-white" />
          <g className="pupil">
            <circle r={r * pupil} className="eye-pupil" />
          </g>
        </g>
      </g>
      <path d={`M ${-r} 0 q ${r} ${-r - 1} ${r * 2} 0`} className="eye-line eye-happy" />
    </g>
  )
}

/**
 * The mouth: one smile, scaled by the mood. Negative vertical scale is a
 * frown, and the transition passes through a flat line on the way — the
 * face goes neutral before it goes cross, which is what faces do.
 *
 * The open mouth under it only shows while talking.
 */
function Mouth({ at, talk }: { at: [number, number]; talk?: string | undefined }) {
  return (
    <g transform={`translate(${at[0]},${at[1]})`}>
      {talk !== undefined && (
        <ellipse key={talk} cx="0" cy="3" rx="6" ry="4.5" className="mouth-open talking" />
      )}
      <g className="mouth-shape">
        <path d="M -9 0 q 9 8 18 0" className="mouth" />
      </g>
    </g>
  )
}

export function Robot({ mood, className, talk }: Props) {
  return (
    <svg
      viewBox="-70 -90 140 170"
      className={`character robot mood-${mood} ${className ?? ''}`}
      role="img"
      aria-label={`The robot looks ${looks(mood)}`}
    >
      <g className="react">
        <g className="breathe">
          <g className="antenna">
            <line x1="0" y1="-62" x2="0" y2="-80" className="antenna-stem" />
            <circle cx="0" cy="-84" r="7" className="antenna-tip" />
          </g>
          <rect x="-56" y="-62" width="112" height="104" rx="26" className="body" />
          <rect x="-40" y="-44" width="80" height="58" rx="18" className="visor" />
          <g className="face">
            <g transform="translate(0,-16)">
              <Eye x={-18} r={7} />
              <Eye x={18} r={7} />
            </g>
            <Mouth at={[-1, 3]} talk={talk} />
          </g>
        </g>
        <rect x="-34" y="46" width="24" height="16" rx="7" className="foot" />
        <rect x="10" y="46" width="24" height="16" rx="7" className="foot" />
      </g>
    </svg>
  )
}

export function Courier({ mood, className, talk }: Props) {
  return (
    <svg
      viewBox="-70 -100 140 180"
      className={`character courier mood-${mood} ${className ?? ''}`}
      role="img"
      aria-label={`Mira looks ${looks(mood)}`}
    >
      <g className="react">
        <g className="breathe">
          <path d="M -44 28 q 0 -34 44 -34 q 44 0 44 34 l 0 44 l -88 0 z" className="torso" />
          <g className="head">
            <circle cx="0" cy="-34" r="44" className="skin" />
            <path
              d="M -46 -44 q 10 -44 46 -44 q 36 0 46 44 q -20 -16 -46 -16 q -26 0 -46 16 z"
              className="hair"
            />
            <path d="M -50 -42 h 100 l -6 -12 h -88 z" className="cap" />
            <g transform="translate(0,-34)">
              <Eye x={-16} r={7} />
              <Eye x={16} r={7} />
            </g>
            <Mouth at={[-1, -13]} talk={talk} />
          </g>
        </g>
      </g>
    </svg>
  )
}
