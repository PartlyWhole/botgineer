/**
 * The tutorial guide: a crow. Not a person, and not the robot — the player
 * is learning to program the robot, so the teacher should not be it.
 *
 * Same moods as the rest of the cast, same rule: an expression is never
 * the only signal. Everything the crow means is also in its text.
 *
 * Built like the others (see Characters.tsx): the head's tilt is a CSS
 * transform on its own group, so it eases between moods — as an SVG
 * attribute it snapped, and no transition could reach it. The idle tilt
 * wraps the mood tilt, so the two add up rather than overwrite.
 */
import type { Mood } from '../game/director'
import { Eye, looks } from './Characters'

export function Crow({ mood, talk }: { mood: Mood; talk?: string | undefined }) {
  return (
    <svg
      viewBox="-70 -80 140 160"
      className={`character crow mood-${mood}`}
      role="img"
      aria-label={`The crow looks ${looks(mood)}`}
    >
      <g className="react">
        <g className="breathe">
          {/* tail and body */}
          <g className="tail">
            <path d="M 26 34 q 30 6 40 26 q -26 2 -44 -10 z" className="feather" />
          </g>
          <ellipse cx="0" cy="28" rx="40" ry="42" className="body" />
          <g className="wing">
            <path d="M -34 16 q -14 26 4 46 q 14 -10 18 -34 z" />
          </g>
          {/* head: the idle glance around the mood's tilt */}
          <g className="head-idle">
            <g className="head">
              <circle cx="0" cy="-26" r="32" className="body" />
              {/* Two halves, so the lower one can move while it talks.
                  Keyed on the line: a new line restarts a finite flap. */}
              <g key={talk ?? ''} className={`beak-lower ${talk !== undefined ? 'talking' : ''}`}>
                <path d="M 28 -21 l 27 -1 l -27 6 z" className="beak" />
              </g>
              <path d="M 28 -28 l 30 8 l -30 -1 z" className="beak" />
              <g transform="translate(-2,-32)">
                <Eye x={-12} r={6} pupil={0.5} />
                <Eye x={14} r={6} pupil={0.5} />
              </g>
            </g>
          </g>
        </g>
        {/* feet */}
        <path d="M -14 66 v 10 M -20 76 h 12 M 14 66 v 10 M 8 76 h 12" className="feet" />
      </g>
    </svg>
  )
}
