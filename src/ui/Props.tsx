/**
 * The pictures a lesson puts on the stage, drawn from the answer.
 *
 * Each is a small SVG in one coordinate space (200 × 130, the floor along
 * the bottom edge), sized by the scene's `props` slot. Every one takes a
 * `PropView` and nothing else, so what it shows is a function of the
 * lesson's step and the robot's last thought — the same evidence the
 * crow reads. Nothing here holds state or runs a timer.
 *
 * **Demonstrations** are CSS keyframes that play when a picture arrives:
 * the lamp flicks on and off, the lift rides down, water pours. They are
 * written as `from` states, so the resting picture is the plain style
 * and reduced motion simply skips to it. Pressing a picture replays its
 * demonstration through the Web Animations API — drawing, not state.
 *
 * **Answers** are drawn into the picture, so a wrong kind is something
 * the player sees go wrong: a lift stuck at `1.5`, a glass filled past
 * the brim, a phone number whose leading zero fell off. The kind of every
 * value is also named in words on its tag, so colour is never the only
 * thing carrying it.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { boolOf, clamp, kindOf, numberOf, textOf, type PropView } from '../scene/props'
import type { Thought } from '../memory/extract'

/** How long a right answer's picture stays before the next one arrives.
 *  Kept in step with `--beat` in props.css. */
const BEAT = '1.7s'

export function PropLayer({ view, role, beat }: { view: PropView; role: 'current' | 'leaving'; beat?: boolean }) {
  const ref = useRef<HTMLButtonElement | null>(null)
  // A picture that arrives after another's payoff waits for it. Decided
  // once, when it mounts, and written straight to the element: a later
  // render without the leaving picture must not restart anything.
  useLayoutEffect(() => {
    ref.current?.style.setProperty('--beat', beat ? BEAT : '0s')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const replay = () => {
    const el = ref.current
    if (!el || typeof el.getAnimations !== 'function') return
    el.style.setProperty('--beat', '0s')
    for (const a of el.getAnimations({ subtree: true })) {
      a.cancel()
      a.play()
    }
  }

  const said = view.answer
  return (
    <button
      ref={ref}
      type="button"
      className="prop-layer"
      data-role={role}
      data-prop={view.prop.kind}
      data-verdict={view.verdict ?? 'none'}
      data-testid={role === 'current' ? 'prop' : 'prop-leaving'}
      onClick={replay}
      tabIndex={role === 'current' ? 0 : -1}
      aria-hidden={role === 'leaving' ? true : undefined}
      aria-label={`${describe(view)} Press to watch it again.`}
    >
      <svg viewBox="0 0 200 130" className={`prop prop-${view.prop.kind}`} aria-hidden="true">
        {draw(view)}
      </svg>
      {said && <AnswerTag key={`${said.type}:${said.repr}`} thought={said} right={view.verdict === 'right'} />}
    </button>
  )
}

/** The value, and its kind in words. Coloured by kind, the way every
 *  picture in these lessons colours it, but never only by colour. */
function AnswerTag({ thought, right }: { thought: Thought; right: boolean }) {
  const kind = kindOf(thought) ?? 'other'
  return (
    <span className="answer-tag" data-kind={kind} data-testid="answer-tag">
      <span className="answer-value">{short(thought.repr, 14)}</span>
      <span className="answer-kind">{thought.type}</span>
      {right && (
        <span className="answer-right" aria-label="right">
          ✓
        </span>
      )}
    </span>
  )
}

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Breaks text into at most `lines` lines of about `width` characters. */
function wrap(text: string, width: number, lines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const out: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (next.length <= width) line = next
    else {
      if (line) out.push(line)
      line = w.length > width ? `${w.slice(0, width - 1)}…` : w
    }
  }
  if (line) out.push(line)
  return out.length > lines ? [...out.slice(0, lines - 1), `${short(out[lines - 1]!, width - 1)}…`] : out
}

/* ------------------------------ drawing ------------------------------ */

function draw(view: PropView): ReactNode {
  const p = view.prop
  switch (p.kind) {
    case 'lamp':
      return <Lamp view={view} />
    case 'fish':
      return <Fish view={view} />
    case 'basket':
      return <Basket view={view} apples={p.apples} />
    case 'lift':
      return <Lift view={view} lowest={p.lowest} highest={p.highest} />
    case 'glass':
      return <Glasses view={view} level={p.level} />
    case 'height':
      return <Height view={view} />
    case 'carton':
      return <Carton view={view} slots={p.slots} />
    case 'plate':
      return <Plate view={view} />
    case 'match':
      return <Match view={view} />
    case 'kinds':
      return <Kinds view={view} />
    case 'tiles':
      return <Tiles view={view} />
    case 'phone':
      return <Phone view={view} number={p.number} />
    case 'door':
      return <Door view={view} />
    case 'card':
      return <Card view={view} />
    case 'letter':
      return <Letter view={view} char={p.char} />
  }
}

/** One sentence a screen reader can say for the picture as it stands. */
export function describe(view: PropView): string {
  const p = view.prop
  const a = view.answer
  const n = numberOf(a)
  const b = boolOf(a)
  const t = textOf(a)
  switch (p.kind) {
    case 'lamp':
      return b === true ? 'A lamp, lit.' : t !== null ? `A lamp, dark, with a note on it that says ${t}.` : 'A lamp on a switch, dark.'
    case 'fish':
      return b === null ? 'A fish and a bird: are they the same?' : b ? 'A fish with wings drawn on: the robot said True.' : 'A fish, not a bird: the robot said False.'
    case 'basket':
      return `A basket with ${p.apples} apples.${n !== null ? ` The robot counted ${a!.repr}.` : ''}`
    case 'lift':
      return n === null
        ? `A building with floors ${p.lowest} to ${p.highest}. Floor 0 is the ground.`
        : Number.isInteger(n)
          ? `The lift is at floor ${n}.`
          : `The lift is stuck between floors at ${a!.repr}.`
    case 'glass':
      return `A glass filled halfway.${n !== null ? ` The other glass is filled to ${a!.repr}.` : ''}`
    case 'height':
      return n === null ? 'A height chart in metres.' : `A person ${a!.repr} metres tall on a height chart.`
    case 'carton':
      return `An egg box with ${p.slots} hollows.${n !== null ? ` ${Math.max(0, Math.floor(n))} eggs in it.` : ''}`
    case 'plate':
      return b === null ? 'A covered plate.' : b ? 'A plate with breakfast on it.' : 'An empty plate.'
    case 'match':
      return `A football match: two halves of 45 minutes on a line of hours.${n !== null ? ` The robot's bar reaches ${a!.repr} hours.` : ''}`
    case 'kinds':
      return 'Three boxes, one inside the next: bool inside int inside float, with every value said so far in its box.'
    case 'tiles':
      return t !== null ? `Letter tiles: ${[...t].join(', ')}.` : n !== null ? `A block of ${a!.repr}.` : 'Two blocks of 7.'
    case 'phone':
      return a ? `A phone showing ${t ?? a.repr}.` : 'A phone, waiting for a number.'
    case 'door':
      return `A locked door. The robot knows: True.${t !== null ? ` A note for Mira says: ${t}.` : ''}`
    case 'card':
      return t !== null ? `A card for Mira that says: ${t}.` : 'A blank card for Mira.'
    case 'letter':
      return n !== null ? `The letter ${p.char}, turned over: ${a!.repr}.` : `A tile with the letter ${p.char} on it.`
  }
}

/* --- lamp: a switch is a bool --- */

function Lamp({ view }: { view: PropView }) {
  const on = boolOf(view.answer) === true
  const note = textOf(view.answer)
  return (
    <g className={`lamp ${on ? 'on' : ''}`}>
      <circle cx="92" cy="50" r="40" className="lamp-glow" />
      <line x1="92" y1="46" x2="92" y2="126" className="pole" />
      <ellipse cx="92" cy="126" rx="18" ry="4" className="lamp-base" />
      <path d="M 70 20 h 44 l 12 28 h -68 z" className="shade" />
      <circle cx="92" cy="55" r="9" className="bulb-glass" />
      <path d="M 108 127 q 20 4 38 -4" className="cable" />
      <g transform="translate(159,101)">
        <rect x="-13" y="-25" width="26" height="50" rx="5" className="plate-switch" />
        <rect x="15" y="-24" width="26" height="11" rx="5.5" className="pill-true" />
        <text x="28" y="-15.8" className="switch-label">
          True
        </text>
        <rect x="15" y="13" width="26" height="11" rx="5.5" className="pill-false" />
        <text x="28" y="21.2" className="switch-label">
          False
        </text>
        <g className="lever">
          <rect x="-5" y="-4" width="10" height="16" rx="3" />
        </g>
      </g>
      {note !== null && (
        <g className="note" transform="translate(4,70) rotate(-6)">
          <rect x="0" y="0" width="52" height="30" rx="2" />
          <text x="26" y="19">
            {short(note, 9)}
          </text>
        </g>
      )}
    </g>
  )
}

/* --- fish: is it a bird? --- */

function Fish({ view }: { view: PropView }) {
  const b = boolOf(view.answer)
  return (
    <g className={`fishbowl ${b === true ? 'said-true' : b === false ? 'said-false' : ''}`}>
      <rect x="0" y="92" width="200" height="38" className="water" />
      <path d="M 0 92 q 12 -5 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0 t 25 0" className="wave" />
      <g className="fish" transform="translate(52,98)">
        <g className="fish-swim">
          <path d="M 26 0 l 16 -12 v 24 z" className="fish-tail" />
          <ellipse cx="0" cy="0" rx="30" ry="15" className="fish-body" />
          <path d="M -4 -14 q 8 -10 16 0" className="fish-fin" />
          <circle cx="-17" cy="-3" r="3" className="fish-eye" />
          <g className="fish-wings">
            <path d="M -2 -10 q -8 -26 12 -30 q 0 18 -4 30 z" />
            <path d="M 6 -10 q 6 -22 22 -22 q -6 16 -14 24 z" />
          </g>
        </g>
      </g>
      <text x="104" y="60" className="same-sign">
        {b === false ? '≠' : b === true ? '=' : '= ?'}
      </text>
      <g className="bird" transform="translate(158,50)">
        <ellipse cx="0" cy="0" rx="17" ry="12" className="bird-body" />
        <circle cx="-14" cy="-10" r="8" className="bird-body" />
        <path d="M -22 -11 l -9 3 l 9 3 z" className="beak" />
        <circle cx="-16" cy="-12" r="1.8" className="fish-eye" />
        <g className="bird-wing">
          <path d="M -2 -4 q 14 -22 26 -8 q -12 2 -26 10 z" />
        </g>
        <path d="M -3 12 v 10 M 5 12 v 10" className="legs" />
      </g>
    </g>
  )
}

/* --- basket: counted with an int --- */

const APPLE_AT: [number, number][] = [
  [80, 72],
  [120, 72],
  [100, 64],
  [90, 58],
  [110, 56],
  [100, 48],
]

function Basket({ view, apples }: { view: PropView; apples: number }) {
  const n = numberOf(view.answer)
  const whole = n === null ? 0 : clamp(Math.floor(Math.max(n, 0)), 0, 10)
  const part = n !== null && n > 0 && !Number.isInteger(n) && whole < 10
  const count = whole + (part ? 1 : 0)
  const x0 = 100 - ((count - 1) * 17) / 2
  return (
    <g className="basket">
      {APPLE_AT.slice(0, apples).map(([x, y], i) => (
        <g key={i} className="apple" style={{ ['--i' as string]: i }} transform={`translate(${x},${y})`}>
          <g className="apple-drop">
            <circle r="11" className="apple-skin" />
            <path d="M 0 -10 q 2 -6 6 -7" className="stalk" />
            <path d="M 1 -12 q 7 -6 11 -1 q -6 3 -11 1 z" className="leaf" />
          </g>
        </g>
      ))}
      <path d="M 56 80 h 88 l -10 40 h -68 z" className="basket-body" />
      <path d="M 60 92 h 80 M 63 104 h 74" className="weave" />
      {Array.from({ length: count }, (_, i) => {
        const extra = i >= apples
        const half = part && i === count - 1
        return (
          <g key={i} transform={`translate(${x0 + i * 17},16)`} className={`token ${extra ? 'extra' : ''} ${half ? 'half' : ''}`}>
            {half ? <path d="M 0 -7 a 7 7 0 0 0 0 14 z" /> : <circle r="7" />}
            <text y="3">{half ? '' : i + 1}</text>
          </g>
        )
      })}
      {n !== null && n > 10 && (
        <text x={x0 + count * 17} y="19" className="token-more">
          …
        </text>
      )}
    </g>
  )
}

/* --- lift: whole floors, below zero too --- */

function Lift({ view, lowest, highest }: { view: PropView; lowest: number; highest: number }) {
  const floors = highest - lowest + 1
  const h = 118 / floors
  /** The top edge of a floor's storey, in SVG units. */
  const top = (f: number) => 6 + (highest - f) * h
  const ground = top(0) + h
  const n = numberOf(view.answer)
  const at = n === null ? 0 : clamp(n, lowest, highest)
  const stuck = n !== null && !Number.isInteger(n) && n >= lowest && n <= highest
  const outside = n !== null && (n < lowest || n > highest)
  const list = Array.from({ length: floors }, (_, i) => highest - i)
  return (
    <g className="lift">
      <rect x="0" y={ground} width="200" height={130 - ground} className="earth" />
      <rect x="44" y="6" width="112" height={ground - 6} className="storeys" />
      <rect x="44" y={ground} width="112" height={124 - ground} className="storeys under" />
      {list.map((f) => (
        <g key={f}>
          <line x1="44" x2="156" y1={top(f) + h} y2={top(f) + h} className="floor-line" />
          <text x="36" y={top(f) + h / 2 + 3.5} className={`floor-num ${n !== null && !stuck && at === f ? 'here' : ''}`}>
            {f}
          </text>
          {f < 0 && (
            <text x="70" y={top(f) + h / 2 + 3.5} className="park">
              P
            </text>
          )}
        </g>
      ))}
      <line x1="0" x2="200" y1={ground} y2={ground} className="grass" />
      <text x="170" y={ground - 4} className="ground-label">
        ground
      </text>
      <rect x="116" y="6" width="30" height="118" className="shaft" />
      <g className="car-move" style={{ transform: `translateY(${top(at)}px)` }}>
        <g className="car-demo" style={{ ['--from' as string]: `${top(highest) - top(at)}px` }}>
          <rect x="118" y="2" width="26" height={h - 4} rx="3" className={`car ${stuck ? 'stuck' : ''}`} />
          <line x1="131" x2="131" y1="4" y2={h - 4} className="car-door" />
        </g>
      </g>
      {stuck && (
        <g transform={`translate(172,${top(at) + h / 2})`} className="warn">
          <path d="M 0 -9 l 9 16 h -18 z" />
          <text y="5">!</text>
        </g>
      )}
      {outside && (
        <text x="172" y={n! > highest ? 16 : 122} className="no-floor">
          no {view.answer!.repr}
        </text>
      )}
    </g>
  )
}

/* --- glass: measured with a float --- */

function Glass({ x, level, className, children }: { x: number; level: number; className?: string; children?: ReactNode }) {
  // Interior: 38 units wide at the top, 30 at the bottom, 76 tall.
  const clip = `glass-${className ?? 'g'}-${x}`
  const shown = clamp(level, 0, 1)
  return (
    <g className={`glass ${className ?? ''}`} transform={`translate(${x},0)`}>
      <clipPath id={clip}>
        <path d="M -19 40 h 38 l -4 76 h -30 z" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect x="-20" y="40" width="40" height="76" className="liquid" style={{ transform: `scaleY(${shown})` }} />
      </g>
      <path d="M -21 38 h 42 l -5 80 h -32 z" className="glass-edge" />
      {children}
    </g>
  )
}

function Glasses({ view, level }: { view: PropView; level: number }) {
  const n = numberOf(view.answer)
  const spill = n !== null && n > 1
  return (
    <g className="glasses">
      <line x1="46" x2="52" y1="40" y2="40" className="tick" />
      <text x="42" y="43" className="tick-label end">
        1
      </text>
      <line x1="46" x2="52" y1="78" y2="78" className="tick" />
      <line x1="46" x2="52" y1="116" y2="116" className="tick" />
      <text x="42" y="119" className="tick-label end">
        0
      </text>
      <line x1="72" x2="72" y1="0" y2="116" className="pour" />
      <Glass x={72} level={level} className="given" />
      <Glass x={150} level={n ?? 0} className={`yours ${n === null ? 'empty' : ''}`}>
        {spill && <path d="M 16 38 q 6 10 4 26 M -16 38 q -6 12 -3 30" className="spill" />}
      </Glass>
      <text x="150" y="128" className="glass-caption">
        {n === null ? 'your answer' : view.answer!.repr}
      </text>
    </g>
  )
}

/* --- height: metres, with a dot --- */

function Height({ view }: { view: PropView }) {
  const n = numberOf(view.answer)
  const perM = 44
  const floor = 122
  const shown = n === null ? 1.2 : clamp(n, 0.15, 2.6)
  const off = n !== null && n > 2.6
  const marks = Array.from({ length: 26 }, (_, i) => i / 10)
  return (
    <g className="height">
      <line x1="50" x2="50" y1={floor} y2={floor - 2.5 * perM} className="ruler" />
      {marks.map((m) => {
        const y = floor - m * perM
        const major = Math.round(m * 10) % 5 === 0
        return (
          <g key={m} className="mark" style={{ ['--i' as string]: Math.round(m * 10) }}>
            <line x1={major ? 40 : 45} x2="50" y1={y} y2={y} className={major ? 'major' : 'minor'} />
            {major && (
              <text x="36" y={y + 3} className="tick-label end">
                {m === 0 ? '0 m' : String(m)}
              </text>
            )}
          </g>
        )
      })}
      <rect x="148" y={floor - 2 * perM} width="34" height={2 * perM} className="door-frame" />
      <text x="165" y={floor - 2 * perM - 3} className="ref-label">
        door, 2 m
      </text>
      <g transform={`translate(183,${floor})`} className="cat">
        <path d="M -9 0 v -9 q 0 -4 4 -4 h 8 l 2 -5 l 2 5 q 3 1 3 5 v 8" />
      </g>
      <g className="figure-at" style={{ transform: `translate(100px, ${floor}px) scale(${shown})` }}>
        <g className={`figure ${n === null ? 'ghost' : ''}`}>
          <circle cx="0" cy={-perM + 6} r="6" />
          <path d={`M -8 ${-perM + 14} h 16 l 2 18 h -4 v 26 h -4 v -18 h -4 v 18 h -4 v -26 h -4 z`} />
        </g>
      </g>
      {n !== null && (
        <g className="height-mark">
          <line x1="52" x2="118" y1={floor - shown * perM} y2={floor - shown * perM} />
          <text x="120" y={floor - shown * perM + 3}>
            {off ? `↑ ${view.answer!.repr} m` : `${view.answer!.repr} m`}
          </text>
        </g>
      )}
    </g>
  )
}

/* --- carton: a dozen, counted --- */

function Carton({ view, slots }: { view: PropView; slots: number }) {
  const n = numberOf(view.answer)
  const eggs = n === null ? 0 : clamp(Math.floor(Math.max(n, 0)), 0, slots)
  const more = n !== null && n > slots ? Math.floor(n) - slots : 0
  const perRow = Math.ceil(slots / 2)
  return (
    <g className="carton">
      <path d="M 28 64 l 8 -30 h 128 l 8 30 z" className="lid" />
      <rect x="26" y="64" width="148" height="56" rx="8" className="box" />
      {Array.from({ length: slots }, (_, i) => {
        const x = 40 + (i % perRow) * 24
        const y = i < perRow ? 80 : 104
        return (
          <g key={i} transform={`translate(${x},${y})`} className="hollow" style={{ ['--i' as string]: i }}>
            <circle r="9" className="cup" />
            {i < eggs && <ellipse rx="7.5" ry="9.5" cy="-2" className="egg" />}
          </g>
        )
      })}
      {more > 0 && (
        <text x="180" y="30" className="token-more">
          +{more}
        </text>
      )}
    </g>
  )
}

/* --- plate: yes or no --- */

function Plate({ view }: { view: PropView }) {
  const b = boolOf(view.answer)
  return (
    <g className={`breakfast ${b === null ? 'covered' : b ? 'full' : 'empty'}`}>
      <line x1="10" x2="190" y1="112" y2="112" className="table" />
      <path d="M 40 104 v 8 M 36 96 v 8 M 44 96 v 8 M 36 104 h 8" className="cutlery" />
      <path d="M 160 94 q 5 8 0 18" className="cutlery" />
      <ellipse cx="100" cy="104" rx="50" ry="12" className="dish" />
      <ellipse cx="100" cy="102" rx="36" ry="7" className="dish-well" />
      <g className="food">
        <rect x="70" y="80" width="28" height="22" rx="6" className="toast" />
        <path d="M 108 98 q -4 -14 10 -14 q 16 -2 14 10 q 0 6 -24 4 z" className="egg-white" />
        <circle cx="119" cy="92" r="5" className="yolk" />
        <path d="M 82 72 q -4 -6 0 -12 M 116 72 q 4 -6 0 -12" className="steam" />
      </g>
      <g className="dome">
        <path d="M 54 102 q 0 -52 46 -52 q 46 0 46 52 z" className="dome-body" />
        <circle cx="100" cy="46" r="5" className="dome-knob" />
      </g>
    </g>
  )
}

/* --- match: hours, measured --- */

function Match({ view }: { view: PropView }) {
  const n = numberOf(view.answer)
  const x = (hours: number) => 20 + hours * 53.3
  const reach = n === null ? 0 : clamp(n, 0, 3)
  const off = n !== null && n > 3
  return (
    <g className="match">
      <g className="ball" transform="translate(20,40)">
        <g className="ball-roll" style={{ ['--to' as string]: `${x(1.5) - 20}px` }}>
          <circle r="9" className="ball-skin" />
          <path d="M 0 -4 l 4 3 l -1.5 4.5 h -5 l -1.5 -4.5 z" className="ball-patch" />
        </g>
      </g>
      <rect x={x(0)} y="58" width={x(0.75) - x(0)} height="24" rx="3" className="half first" />
      <text x={(x(0) + x(0.75)) / 2} y="74" className="half-label">
        45 min
      </text>
      <rect x={x(0.75)} y="58" width={x(1.5) - x(0.75)} height="24" rx="3" className="half second" />
      <text x={(x(0.75) + x(1.5)) / 2} y="74" className="half-label">
        45 min
      </text>
      <line x1={x(0)} x2={x(3)} y1="92" y2="92" className="axis" />
      {[0, 0.5, 1, 1.5, 2, 2.5, 3].map((hr) => (
        <g key={hr}>
          <line x1={x(hr)} x2={x(hr)} y1="88" y2={Number.isInteger(hr) ? 97 : 94} className="tick" />
          {Number.isInteger(hr) && (
            <text x={x(hr)} y="107" className="tick-label">
              {hr} h
            </text>
          )}
        </g>
      ))}
      {n !== null && (
        <g className="reach">
          <rect x={x(0)} y="112" width={Math.max(1, x(reach) - x(0))} height="9" rx="3" />
          <text x={Math.min(x(reach) + 4, 176)} y="120">
            {off ? `→ ${view.answer!.repr}` : view.answer!.repr}
          </text>
        </g>
      )}
    </g>
  )
}

/* --- kinds: each fits inside the next --- */

function Kinds({ view }: { view: PropView }) {
  const uniq = (type: string) => {
    const seen: string[] = []
    for (const t of view.heard) if (t.type === type && !seen.includes(t.repr)) seen.push(t.repr)
    return seen.slice(-6)
  }
  const ints = uniq('int')
  const floats = uniq('float')
  const bools = new Set(uniq('bool'))
  const last = view.answer
  const chips = (values: string[], kind: string, y: number, from: number, to: number) => {
    const w = 27
    const gap = 3
    const width = values.length * w + (values.length - 1) * gap
    const x0 = (from + to) / 2 - width / 2
    return values.map((v, i) => (
      <g
        key={v}
        className={`chip ${last?.type === kind && last.repr === v ? 'latest' : ''}`}
        data-kind={kind}
        transform={`translate(${x0 + i * (w + gap)},${y})`}
      >
        <rect width={w} height="12" rx="6" />
        <text x={w / 2} y="9">
          {short(v, 5)}
        </text>
      </g>
    ))
  }
  return (
    <g className="kinds">
      <g className="ring float" style={{ ['--i' as string]: 2 }}>
        <rect x="2" y="2" width="196" height="126" rx="14" />
        <text x="12" y="14">
          float · how much?
        </text>
      </g>
      <g className="ring int" style={{ ['--i' as string]: 1 }}>
        <rect x="16" y="19" width="168" height="91" rx="12" />
        <text x="26" y="31">
          int · how many?
        </text>
      </g>
      <g className="ring bool" style={{ ['--i' as string]: 0 }}>
        <rect x="34" y="36" width="132" height="55" rx="10" />
        <text x="44" y="48">
          bool · yes or no?
        </text>
      </g>
      {(['True', 'False'] as const).map((v, i) => (
        <g
          key={v}
          className={`chip fixed ${bools.has(v) ? 'said' : ''} ${last?.type === 'bool' && last.repr === v ? 'latest' : ''}`}
          data-kind="bool"
          transform={`translate(${62 + i * 44},60)`}
        >
          <rect width="36" height="14" rx="7" />
          <text x="18" y="10.5">
            {v}
          </text>
        </g>
      ))}
      {chips(ints, 'int', 95, 16, 184)}
      {chips(floats, 'float', 113, 2, 198)}
    </g>
  )
}

/* --- tiles: numbers add, text sticks together --- */

function Tiles({ view }: { view: PropView }) {
  const t = textOf(view.answer)
  const n = numberOf(view.answer)
  if (t !== null) {
    const chars = [...t].slice(0, 7)
    // As big as they fit: two tiles are the point of `"7" + "7"`, and
    // they should read from across the room.
    const w = Math.min(36, 180 / Math.max(chars.length, 1))
    const x0 = 100 - (chars.length * w) / 2
    return (
      <g className="tiles text">
        {chars.map((c, i) => (
          <g key={i} className="tile" transform={`translate(${x0 + i * w},${56 - w * 0.6})`} style={{ ['--i' as string]: i }}>
            <rect width={w - 2} height={w * 1.2} rx="4" />
            <text x={(w - 2) / 2} y={w * 0.82} style={{ fontSize: `${w * 0.66}px` }}>
              {c === ' ' ? '␣' : c}
            </text>
          </g>
        ))}
        <text x="100" y="100" className="tiles-caption">
          {[...t].length} character{[...t].length === 1 ? '' : 's'}, side by side
        </text>
      </g>
    )
  }
  if (n !== null && Number.isInteger(n) && n >= 0) {
    const dots = Math.min(n, 21)
    return (
      <g className="tiles number">
        <rect x="70" y="18" width="60" height="38" rx="8" className="block" />
        <text x="100" y="44" className="block-num">
          {view.answer!.repr}
        </text>
        {Array.from({ length: dots }, (_, i) => (
          <circle key={i} cx={73 + (i % 7) * 9} cy={70 + Math.floor(i / 7) * 10} r="3.4" className="dot" style={{ ['--i' as string]: i }} />
        ))}
        <text x="100" y="118" className="tiles-caption">
          {n > 21 ? 'a lot of things' : `${n} things, added up`}
        </text>
      </g>
    )
  }
  return (
    <g className="tiles blocks">
      <g className="block-left">
        <rect x="30" y="34" width="46" height="38" rx="8" className="block" />
        <text x="53" y="60" className="block-num">
          7
        </text>
      </g>
      <text x="100" y="61" className="plus">
        +
      </text>
      <g className="block-right">
        <rect x="124" y="34" width="46" height="38" rx="8" className="block" />
        <text x="147" y="60" className="block-num">
          7
        </text>
      </g>
      {n !== null && (
        <text x="100" y="100" className="tiles-caption">
          {view.answer!.repr}
        </text>
      )}
    </g>
  )
}

/* --- phone: a number that is really a name --- */

function Phone({ view, number }: { view: PropView; number: string }) {
  const a = view.answer
  const t = textOf(a)
  const calling = t !== null && t.replace(/\D/g, '') === number
  const asInt = a && (a.type === 'int' || a.type === 'float') ? a.repr : null
  const lostZero = asInt !== null && number.startsWith('0') && number.replace(/^0+/, '') === asInt
  const shown = t ?? asInt
  return (
    <g className={`phone ${calling ? 'calling' : ''}`}>
      <g className="phone-shake">
        <rect x="60" y="4" width="80" height="122" rx="12" className="phone-body" />
        <rect x="66" y="15" width="68" height="60" rx="5" className="screen" />
        {shown === null ? (
          <text x="100" y="48" className="screen-hint">
            type a number
          </text>
        ) : (
          <>
            {lostZero && (
              <g className="ghost-zero">
                <rect x="68" y="36" width="10" height="14" rx="2" />
                <text x="73" y="46.5">
                  0
                </text>
              </g>
            )}
            <text x={lostZero ? 106 : 100} y="47" className={`screen-text ${t !== null ? 'text' : 'num'}`}>
              {short(shown, 12)}
            </text>
            {calling && (
              <text x="100" y="66" className="screen-call">
                calling Mira…
              </text>
            )}
          </>
        )}
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={82 + (i % 3) * 18} cy={88 + Math.floor(i / 3) * 12} r="4.2" className="key" />
        ))}
      </g>
      {calling && (
        <g className="rings">
          <path d="M 150 40 q 8 12 0 24" />
          <path d="M 158 34 q 13 18 0 36" />
          <path d="M 50 40 q -8 12 0 24" />
          <path d="M 42 34 q -13 18 0 36" />
        </g>
      )}
    </g>
  )
}

/* --- door: the robot knows, Mira needs words --- */

function Door({ view }: { view: PropView }) {
  const t = textOf(view.answer)
  const lines = t === null ? [] : wrap(t, 13, 3)
  return (
    <g className="door">
      <rect x="112" y="16" width="62" height="112" rx="2" className="frame" />
      <rect x="118" y="22" width="50" height="106" rx="2" className="panel" />
      <circle cx="160" cy="80" r="3" className="knob" />
      <g className="padlock" transform="translate(143,86)">
        <path d="M -6 0 v -7 a 6 6 0 0 1 12 0 v 7" className="shackle" />
        <rect x="-9" y="0" width="18" height="15" rx="3" className="lock-body" />
      </g>
      <g className="knows" transform="translate(143,8)">
        <rect x="-22" y="-6" width="44" height="12" rx="6" data-kind="bool" />
        <text y="3.5">locked: True</text>
      </g>
      <g className={`note ${t === null ? 'blank' : ''}`} transform="translate(8,40)">
        <rect width="92" height="58" rx="4" />
        {t === null ? (
          <path d="M 12 20 h 68 M 12 32 h 68 M 12 44 h 44" className="blank-lines" />
        ) : (
          lines.map((l, i) => (
            <text key={i} x="46" y={22 + i * 14}>
              {l}
            </text>
          ))
        )}
      </g>
    </g>
  )
}

/* --- card: words for a person --- */

function Card({ view }: { view: PropView }) {
  const t = textOf(view.answer)
  const lines = t === null ? [] : wrap(t, 12, 3)
  return (
    <g className="card">
      <path d="M 70 128 l 14 -26 M 130 128 l -14 -26" className="easel" />
      <g className="card-flip">
        <rect x="26" y="12" width="148" height="92" rx="8" className="card-face" />
        {t === null ? (
          <path d="M 46 42 h 108 M 46 60 h 108 M 46 78 h 70" className="blank-lines" />
        ) : (
          lines.map((l, i) => (
            <text key={i} x="100" y={64 - (lines.length - 1) * 11 + i * 22} className="card-text">
              {l}
            </text>
          ))
        )}
      </g>
    </g>
  )
}

/* --- letter: every character is a number --- */

function Letter({ view, char }: { view: PropView; char: string }) {
  const n = view.answer?.type === 'int' ? view.answer.repr : null
  return (
    <g className={`letter ${n !== null ? 'turned' : ''}`}>
      <g className="letter-wiggle">
        <g className="face front">
          <rect x="66" y="12" width="68" height="78" rx="8" />
          <text x="100" y="68">
            {char}
          </text>
        </g>
        <g className="face back">
          <rect x="66" y="12" width="68" height="78" rx="8" />
          <text x="100" y="64">
            {n ?? ''}
          </text>
        </g>
      </g>
      <text x="100" y="114" className="letter-caption">
        {n === null ? `"${char}"` : `"${char}"  →  ${n}`}
      </text>
    </g>
  )
}
