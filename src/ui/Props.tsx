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
import {
  SLOTS,
  SLOT_EXAMPLES,
  boolOf,
  chipText,
  clamp,
  codeLine,
  kindOf,
  numberOf,
  shelved,
  slotOf,
  textOf,
  type ContrastSide,
  type Prop,
  type PropView,
  type TypeSlot,
} from '../scene/props'
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

  // A narration beat that changes the picture in place (`sameProp`: the
  // lamp switched on, one more slot on the shelf) is a new moment, not a
  // late arrival: whatever it sets off plays now, not after the payoff
  // this layer once waited for. And from then on the layer has been
  // *told* — its arrival demonstration is spent, so a demonstration that
  // a narration field had replaced must not come back when the ask
  // clears that field (the lamp's flicking, restarting under the
  // question). Written straight to the element, like `--beat`, and keyed
  // on the prop's text so React's double-invoked effects are idempotent.
  const sig = JSON.stringify(view.prop)
  const seen = useRef(sig)
  useLayoutEffect(() => {
    if (seen.current === sig) return
    seen.current = sig
    const el = ref.current
    if (!el) return
    el.style.setProperty('--beat', '0s')
    el.dataset['told'] = ''
  }, [sig])

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
      return <Lamp view={view} demo={p.demo} />
    case 'fish':
      return <Fish view={view} />
    case 'basket':
      return <Basket view={view} apples={p.apples} demo={p.demo} />
    case 'lift':
      return <Lift view={view} lowest={p.lowest} highest={p.highest} demo={p.demo} />
    case 'glass':
      return p.demo === 'fill' ? <Filling level={p.level} /> : <Glasses view={view} level={p.level} />
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
      return <Tiles view={view} parts={p.parts ?? ['7', '+', '7']} stamp={p.demo === 'stamp'} />
    case 'crates':
      return <Crates view={view} crates={p.crates} each={p.each} />
    case 'share':
      return <Share view={view} litres={p.litres} robots={p.robots} />
    case 'bolts':
      return <Bolts view={view} have={p.have} use={p.use} />
    case 'balance':
      return <Balance view={view} left={p.left} right={p.right} op={p.op} lamp={p.lamp === true} />
    case 'expr':
      return <Expr view={view} text={p.text} first={p.first} then={p.then} />
    case 'phone':
      return <Phone view={view} number={p.number} />
    case 'door':
      return <Door view={view} />
    case 'card':
      return <Card view={view} />
    case 'letter':
      return <Letter view={view} char={p.char} />
    case 'shelf':
      return <Shelf view={view} p={p} />
    case 'numberline':
      return <NumberLine view={view} p={p} />
    case 'letters':
      return <Letters chars={p.chars} />
    case 'char':
      return <Char char={p.char} clasps={p.clasps === true} />
    case 'contrast':
      return <Contrast left={p.left} right={p.right} />
    case 'beads':
      return <Beads text={p.text} glow={p.glow === true} />
    case 'pointer':
      return <Pointer label={p.label} />
    case 'lamps':
      return <Lamps on={p.on} />
    case 'codes':
      return <Codes chars={p.chars} />
    case 'scale':
      return <Scale view={view} parcels={p.parcels} each={p.each} />
  }
}

/** The word for a slot's kind, as the picture writes it under a value. A
 *  char is Python's str one character long, and says so: the shelf shows
 *  five ideas, but Python has four types (R8). */
const kindWord = (k: TypeSlot): string => (k === 'char' ? 'str · length 1' : k)

/** One sentence a screen reader can say for the picture as it stands. */
export function describe(view: PropView): string {
  const p = view.prop
  const a = view.answer
  const n = numberOf(a)
  const b = boolOf(a)
  const t = textOf(a)
  switch (p.kind) {
    case 'lamp':
      return b === true || (a === null && p.demo === 'on')
        ? `A lamp, lit${a === null ? ': the switch says True' : ''}.`
        : t !== null
          ? `A lamp, dark, with a note on it that says ${t}.`
          : p.demo === 'off'
            ? 'A lamp, dark: the switch says False.'
            : 'A lamp on a switch, dark.'
    case 'fish':
      return t !== null
        ? `A fish with a note stuck on it that says ${t}. Nothing happens.`
        : b === null
          ? 'A fish and a bird: are they the same?'
          : b
            ? 'A fish with wings drawn on: the robot said True.'
            : 'A fish, not a bird: the robot said False.'
    case 'basket':
      return `A basket with ${p.apples} apples.${
        p.demo === 'count' ? ` Counted in one at a time: ${p.apples}.` : p.demo === 'half' ? ` Half an apple bounces off; the count stays ${p.apples}.` : ''
      }${n !== null ? ` The robot counted ${a!.repr}.` : ''}`
    case 'lift':
      return n === null
        ? p.demo !== undefined
          ? `The lift goes to floor ${p.demo}.`
          : `A building with floors ${p.lowest} to ${p.highest}. Floor 0 is the ground.`
        : Number.isInteger(n)
          ? `The lift is at floor ${n}.`
          : `The lift is stuck between floors at ${a!.repr}.`
    case 'glass':
      return p.demo === 'fill'
        ? 'A glass filling smoothly, with no steps on the way.'
        : `A glass filled halfway.${n !== null ? ` The other glass is filled to ${a!.repr}.` : ''}`
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
      return t !== null
        ? `Letter tiles: ${[...t].join(', ')}.`
        : n !== null
          ? `A block of ${a!.repr}.`
          : `Blocks: ${(p.parts ?? ['7', '+', '7']).join(' ')}.${p.demo === 'stamp' ? ' The word stamps itself that many times.' : ''}`
    case 'crates':
      return `${p.crates} crates with ${p.each} bolts in each.${n !== null ? ` ${a!.repr} bolts lit.` : ''}`
    case 'share':
      return `A jug of ${p.litres} litres and ${p.robots} tanks.${n !== null ? ` Each tank gets ${a!.repr}.` : ''}`
    case 'bolts':
      return `${p.have} bolts, ${p.use} of them used.${n !== null ? ` The robot says ${a!.repr} are left.` : ''}`
    case 'balance':
      return `A balance: ${p.left} ${p.op} ${p.right}?${p.lamp ? ` A lamp beside it says ${holds(p.left, p.op, p.right) ? 'True' : 'False'}.` : ''}${
        b !== null ? ` The robot says ${a!.repr}.` : ''
      }`
    case 'expr':
      return `${p.text}: ${p.first} first, then ${p.then.join(', then ')}.`
    case 'phone':
      return a ? `A phone showing ${t ?? a.repr}.` : 'A phone, waiting for a number.'
    case 'door':
      return `A locked door. The robot knows: True.${t !== null ? ` A note for Mira says: ${t}.` : ''}`
    case 'card':
      return t !== null ? `A card for Mira that says: ${t}.` : 'A blank card for Mira.'
    case 'letter':
      return n !== null ? `The letter ${p.char}, turned over: ${a!.repr}.` : `A tile with the letter ${p.char} on it.`
    case 'shelf': {
      const s = shelved(p.filled, view.heard, p.examples ?? {})
      const slots = SLOTS.map((k) =>
        p.filled.includes(k) ? `${k}: ${[...s[k].examples.map((e) => e.text), ...s[k].heard].join(', ')}` : `a slot marked ?${s[k].heard.length ? ` holding ${s[k].heard.join(', ')}` : ''}`,
      )
      return `A shelf of five slots${p.title ? ', labelled Data types' : ''}. ${slots.join('; ')}.${p.later ? ' Beside it, empty chips in square brackets, for later.' : ''}`
    }
    case 'numberline': {
      const at = n ?? p.mark
      return `A number line from ${p.from} to ${p.to}.${at !== undefined ? ` A marker stops at ${p.unnamed && n === null ? 'a point between the ticks' : at}.` : ''}`
    }
    case 'letters':
      return `Letters floating up: ${p.chars.join(', ')}.`
    case 'char':
      return `One character, ${p.char}${p.clasps ? ', held by its quotes like clasps' : ''}.`
    case 'contrast': {
      const side = (s: ContrastSide) => `${s.text}${s.result !== undefined ? ` makes ${s.result}` : ''}, ${kindWord(s.resultKind ?? s.kind)}`
      return `Side by side: ${side(p.left)}; and ${side(p.right)}.`
    }
    case 'beads':
      return `The characters of ${p.text} as beads on a thread, a quote at each end${p.glow ? ', glowing: where it starts and stops' : ''}.`
    case 'pointer':
      return `An arrow to the console: ${p.label}.`
    case 'lamps':
      return `${p.on} lit lamps, each True, each a 1: added up, ${p.on}.`
    case 'codes':
      return `Letters on a number line at their codes: ${codeLine(p.chars)
        .map((c) => `${c.char} at ${c.code}`)
        .join(', ')}.`
    case 'scale':
      return `${p.parcels} parcels of ${p.each} kg and a scale.${n !== null ? ` On the scale, it reads ${a!.repr} kg.` : ''}`
  }
}

/** Whether `left op right` holds: the balance's own truth. */
const holds = (left: number, op: '>' | '<' | '==', right: number): boolean => (op === '==' ? left === right : op === '>' ? left > right : left < right)

/* --- lamp: a switch is a bool --- */

function Lamp({ view, demo }: { view: PropView; demo: 'on' | 'off' | undefined }) {
  // The narration's switch holds only while nothing has been answered:
  // an answer is always drawn as itself. The demo's class stays either
  // way, because taking it away would change which animation the lamp
  // runs, and a changed animation starts again.
  const on = view.answer ? boolOf(view.answer) === true : demo === 'on'
  const note = textOf(view.answer)
  return (
    <g className={`lamp ${on ? 'on' : ''} ${demo ? `demo-${demo}` : ''}`}>
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
  // A word is for people: stuck on the fish, it grows no wings and
  // settles nothing — the sign still asks.
  const note = textOf(view.answer)
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
      {note !== null && (
        <g className="note" transform="translate(30,84) rotate(-7)">
          <rect x="0" y="0" width="46" height="22" rx="2" />
          <text x="23" y="14.5">
            {short(note, 8)}
          </text>
        </g>
      )}
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

function Basket({ view, apples, demo }: { view: PropView; apples: number; demo: 'count' | 'half' | undefined }) {
  const n = numberOf(view.answer)
  const whole = n === null ? 0 : clamp(Math.floor(Math.max(n, 0)), 0, 10)
  const part = n !== null && n > 0 && !Number.isInteger(n) && whole < 10
  const count = whole + (part ? 1 : 0)
  const x0 = 100 - ((count - 1) * 17) / 2
  const shown = Math.min(apples, APPLE_AT.length)
  return (
    <g className={`basket ${demo ? `demo-${demo}` : ''}`}>
      {demo && (
        // The counter. Its digits are a column behind a window, rolled
        // one step as each apple lands (`steps()` in the CSS), so it can
        // only ever show a whole number: there is no frame at 2½. At rest
        // it shows the last.
        <g className="counter" transform="translate(170,98)">
          <clipPath id="basket-counter">
            <rect x="-12" y="-11" width="24" height="22" rx="6" />
          </clipPath>
          <rect x="-14" y="-13" width="28" height="26" rx="8" className="counter-face" />
          <g clipPath="url(#basket-counter)">
            <g className="counter-roll" style={{ ['--n' as string]: shown }}>
              {Array.from({ length: shown + 1 }, (_, k) => (
                <text key={k} y={5.5 + (k - shown) * 22} className="counter-num">
                  {k === 0 ? '' : k}
                </text>
              ))}
            </g>
          </g>
        </g>
      )}
      {APPLE_AT.slice(0, apples).map(([x, y], i) => (
        <g key={i} className="apple" style={{ ['--i' as string]: i }} transform={`translate(${x},${y})`}>
          <g className="apple-drop">
            <circle r="11" className="apple-skin" />
            <path d="M 0 -10 q 2 -6 6 -7" className="stalk" />
            <path d="M 1 -12 q 7 -6 11 -1 q -6 3 -11 1 z" className="leaf" />
          </g>
        </g>
      ))}
      {demo === 'half' && (
        // Half an apple comes down on the rim beside the others and
        // bounces off. At rest it is gone; the whole of its visit is the
        // demonstration.
        <g className="half-apple" transform="translate(146,69)">
          <g className="half-apple-fly">
            <path d="M 0 -11 a 11 11 0 0 0 0 22 z" className="apple-skin" />
            <path d="M 0 -11 v 22" className="apple-cut" />
          </g>
        </g>
      )}
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

function Lift({ view, lowest, highest, demo }: { view: PropView; lowest: number; highest: number; demo: number | undefined }) {
  const floors = highest - lowest + 1
  const h = 118 / floors
  /** The top edge of a floor's storey, in SVG units. */
  const top = (f: number) => 6 + (highest - f) * h
  const ground = top(0) + h
  // An answer is drawn as itself; the narration's floor only stands in
  // for one, and it is always a whole floor.
  const answered = numberOf(view.answer)
  const n = answered ?? (view.answer === null && demo !== undefined ? Math.round(demo) : null)
  const at = n === null ? 0 : clamp(n, lowest, highest)
  const stuck = n !== null && !Number.isInteger(n) && n >= lowest && n <= highest
  const outside = answered !== null && (answered < lowest || answered > highest)
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
        <text x="172" y={answered! > highest ? 16 : 122} className="no-floor">
          no {view.answer!.repr}
        </text>
      )}
    </g>
  )
}

/* --- glass: measured with a float --- */

function Glass({ x, level, className, children }: { x: number; level: number; className?: string; children?: ReactNode }) {
  // Interior: 38 units wide at the top, 30 at the bottom, 76 tall.
  const clip = `glass-${(className ?? 'g').replace(/\s+/g, '-')}-${x}`
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
      {[1, 2, 3, 4, 6, 7, 8, 9].map((k) => (
        <line key={k} x1="49" x2="52" y1={116 - 7.6 * k} y2={116 - 7.6 * k} className="tick minor" />
      ))}
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

/** One glass filling, slowly and smoothly: a measurement has no steps
 *  to stop on, which is the whole difference from counting. No scale is
 *  drawn, because a scale's marks would be steps. */
function Filling({ level }: { level: number }) {
  return (
    <g className="glasses filling">
      <g transform="translate(100,126) scale(1.25) translate(-100,-118)">
        <line x1="100" x2="100" y1="16" y2="116" className="pour slow" />
        <Glass x={100} level={level} className="given slow" />
      </g>
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

function Tiles({ view, parts, stamp }: { view: PropView; parts: string[]; stamp: boolean }) {
  const t = textOf(view.answer)
  const n = numberOf(view.answer)
  if (stamp && t === null && n === null) return <Stamps parts={parts} />
  if (t !== null) {
    const chars = [...t].slice(0, 10)
    // As big as they fit: two tiles are the point of `"7" + "7"`, and
    // they should read from across the room.
    const w = Math.min(36, 190 / Math.max(chars.length, 1))
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
      <Parts parts={parts} />
      {n !== null && (
        <text x="100" y="104" className="tiles-caption">
          {view.answer!.repr}
        </text>
      )}
    </g>
  )
}

/** Python literals and operators laid out in a row: a str as letter
 *  tiles, an int as a block, an operator as itself. Scaled to fit. */
function Parts({ parts }: { parts: string[] }) {
  const T = 16
  const laid = parts.map((part) => {
    if (/^".*"$/.test(part)) return { part, kind: 'str' as const, chars: [...part.slice(1, -1)], w: [...part.slice(1, -1)].length * T }
    if (/^-?\d+$/.test(part)) return { part, kind: 'int' as const, chars: [], w: Math.max(40, part.length * 14 + 18) }
    return { part, kind: 'op' as const, chars: [], w: 22 }
  })
  const gap = 6
  const total = laid.reduce((sum, x) => sum + x.w, 0) + gap * (laid.length - 1)
  const k = Math.min(1, 190 / total)
  let x = 0
  return (
    <g transform={`translate(${100 - (total * k) / 2},0) scale(${k})`}>
      {laid.map((p, i) => {
        const at = x
        x += p.w + gap
        const side = i === 0 ? 'block-left' : i === laid.length - 1 ? 'block-right' : ''
        if (p.kind === 'op')
          return (
            <text key={i} x={at + p.w / 2} y="61" className="plus">
              {p.part}
            </text>
          )
        if (p.kind === 'int')
          return (
            <g key={i} className={side}>
              <rect x={at} y="34" width={p.w} height="38" rx="8" className="block" />
              <text x={at + p.w / 2} y="60" className="block-num">
                {p.part}
              </text>
            </g>
          )
        return (
          <g key={i} className={`${side} tiles-word`}>
            {p.chars.map((c, j) => (
              <g key={j} className="tile" transform={`translate(${at + j * T},38)`}>
                <rect width={T - 1.5} height="26" rx="3" />
                <text x={(T - 1.5) / 2} y="18.5" style={{ fontSize: '14px' }}>
                  {c}
                </text>
              </g>
            ))}
          </g>
        )
      })}
    </g>
  )
}

/**
 * A str times an int, done where it can be seen: the sum on top, and
 * under it the word stamping itself down, once per count, side by side.
 * Only the first str and the first int of `parts` are read; anything
 * else in the sum is drawn, not stamped.
 */
function Stamps({ parts }: { parts: string[] }) {
  const word = parts.find((x) => /^".*"$/.test(x))
  const times = Number(parts.find((x) => /^\d+$/.test(x)) ?? 0)
  const chars = word ? [...word.slice(1, -1)] : []
  const count = clamp(times, 0, 6)
  const T = 16
  const gap = 5
  const one = chars.length * T
  const total = count * one + Math.max(0, count - 1) * gap
  const k = Math.min(1, 186 / Math.max(total, 1))
  return (
    <g className="tiles blocks stamping">
      <g transform="translate(0,-22)">
        <Parts parts={parts} />
      </g>
      <g transform={`translate(${100 - (total * k) / 2},76) scale(${k})`}>
        {Array.from({ length: count }, (_, i) => (
          <g key={i} className="stamp" style={{ ['--i' as string]: i }} transform={`translate(${i * (one + gap)},0)`}>
            {chars.map((c, j) => (
              <g key={j} className="stamp-tile" transform={`translate(${j * T},0)`}>
                <rect width={T - 1.5} height="26" rx="3" />
                <text x={(T - 1.5) / 2} y="18.5" style={{ fontSize: '14px' }}>
                  {c}
                </text>
              </g>
            ))}
          </g>
        ))}
      </g>
      <text x="100" y="122" className="tiles-caption stamp-caption">
        {word ?? '""'}, {count} time{count === 1 ? '' : 's'}
      </text>
    </g>
  )
}

/* --- crates: times, as an array --- */

function Crates({ view, crates, each }: { view: PropView; crates: number; each: number }) {
  const n = numberOf(view.answer)
  const lit = n === null ? 0 : clamp(Math.floor(n), 0, crates * each)
  const cw = Math.min(24, 180 / crates)
  const x0 = 100 - (crates * cw) / 2
  const pitch = 78 / each
  return (
    <g className="crates">
      {Array.from({ length: crates }, (_, c) => (
        <g key={c} className="crate" style={{ ['--i' as string]: c }} transform={`translate(${x0 + c * cw},0)`}>
          <rect x="1" y="34" width={cw - 2} height="86" rx="3" className="crate-box" />
          {Array.from({ length: each }, (_, b) => {
            const index = c * each + b
            return (
              <circle
                key={b}
                cx={cw / 2}
                cy={112 - b * pitch}
                r={Math.min(4.2, cw / 5)}
                className={`bolt ${index < lit ? 'lit' : ''}`}
                style={{ ['--i' as string]: index }}
              />
            )
          })}
        </g>
      ))}
      <text x="100" y="22" className="crates-label">
        {n === null ? `${crates} crates × ${each} bolts` : `${view.answer!.repr} bolts`}
      </text>
    </g>
  )
}

/* --- share: division, and what is left over --- */

function Share({ view, litres, robots }: { view: PropView; litres: number; robots: number }) {
  const n = numberOf(view.answer)
  const each = n === null ? 0 : Math.max(0, n)
  const left = n === null ? litres : Math.max(0, litres - each * robots)
  const scale = 6
  const tankH = 72
  // Three tanks sit closer than two, so the last stays on the stage.
  const gap = robots > 2 ? 40 : 48
  const tanks = Array.from({ length: robots }, (_, i) => 146 - ((robots - 1) * gap) / 2 + i * gap)
  return (
    <g className="share">
      <g className="jug" transform="translate(40,0)">
        <path d="M -24 40 h 48 v 76 a 6 6 0 0 1 -6 6 h -36 a 6 6 0 0 1 -6 -6 z" className="jug-body" />
        <clipPath id="jug-clip">
          <path d="M -23 41 h 46 v 75 a 5 5 0 0 1 -5 5 h -36 a 5 5 0 0 1 -5 -5 z" />
        </clipPath>
        <g clipPath="url(#jug-clip)">
          <rect x="-24" y="40" width="48" height="82" className="oil" style={{ transform: `scaleY(${clamp(left / litres, 0, 1)})` }} />
        </g>
        <path d="M 24 52 q 12 2 12 14 q 0 12 -12 14" className="jug-handle" />
        <text y="34" className="jug-label">
          {n === null ? `${litres} L` : `${Number.isInteger(left) ? left : left.toFixed(1)} L left`}
        </text>
      </g>
      {tanks.map((x, i) => (
        <g key={i} className="tank" transform={`translate(${x},0)`}>
          <rect x="-16" y={120 - tankH} width="32" height={tankH} rx="4" className="tank-body" />
          <rect x="-15" y={120 - tankH} width="30" height={tankH - 1} className="oil tank-oil" style={{ transform: `scaleY(${clamp(each / scale, 0, 1)})` }} />
          {Array.from({ length: scale + 1 }, (_, k) => (
            <line key={k} x1="10" x2="16" y1={120 - (k / scale) * tankH} y2={120 - (k / scale) * tankH} className="tick" />
          ))}
          {i === robots - 1 &&
            [0, 2, 4, 6].map((k) => (
              <text key={k} x="26" y={123 - (k / scale) * tankH} className="tick-label">
                {k}
              </text>
            ))}
          {n !== null && (
            <text y={114 - clamp(each / scale, 0, 1) * tankH} className="tank-label">
              {view.answer!.repr}
            </text>
          )}
        </g>
      ))}
    </g>
  )
}

/* --- bolts: taking away --- */

function Bolts({ view, have, use }: { view: PropView; have: number; use: number }) {
  const n = numberOf(view.answer)
  const perRow = 10
  const ringed = n === null ? 0 : clamp(Math.floor(n), 0, have)
  const at = (i: number) => [19 + (i % perRow) * 18, 58 + Math.floor(i / perRow) * 30] as const
  return (
    <g className="bolts">
      {Array.from({ length: have }, (_, i) => {
        const [x, y] = at(i)
        const used = i >= have - use
        return (
          <g key={i} transform={`translate(${x},${y})`} className={`bolt-icon ${used ? 'used' : ''} ${i < ringed ? 'ringed' : ''}`} style={{ ['--i' as string]: i - (have - use) }}>
            <g className="bolt-shape">
              <path d="M -5 -9 h 10 l 2 4 h -14 z" />
              <rect x="-2" y="-5" width="4" height="13" rx="1" />
            </g>
            {i < ringed && <circle r="8.5" className="ring" />}
          </g>
        )
      })}
      <text x="100" y="22" className="bolts-label">
        {n === null ? `${have} bolts, ${use} used` : `${view.answer!.repr} left?`}
      </text>
    </g>
  )
}

/* --- balance: a question makes a bool --- */

function Balance({ view, left, right, op, lamp }: { view: PropView; left: number; right: number; op: '>' | '<' | '=='; lamp: boolean }) {
  const truth = holds(left, op, right)
  const b = boolOf(view.answer)
  const tilt = left === right ? 0 : left > right ? -8 : 8
  const stack = (count: number, x: number, split?: number) =>
    Array.from({ length: count }, (_, i) => (
      <rect
        key={i}
        x={x - 13 + (i % 3) * 9}
        y={-12 - Math.floor(i / 3) * 9}
        width="8"
        height="8"
        rx="1.5"
        className={`weight ${split !== undefined && i >= split ? 'other' : ''}`}
      />
    ))
  const question = op === '==' ? '2 + 2 == 4' : `${left} ${op} ${right}`
  return (
    <g className="balance">
      <path d="M 100 70 l -14 50 h 28 z" className="stand" />
      <g className="beam" style={{ ['--tilt' as string]: `${tilt}deg` }}>
        <rect x="30" y="66" width="140" height="6" rx="3" className="beam-bar" />
        <g transform="translate(46,66)">
          <path d="M -18 0 h 36 l -4 6 h -28 z" className="pan" />
          {stack(left, 0, op === '==' ? 2 : undefined)}
        </g>
        <g transform="translate(154,66)">
          <path d="M -18 0 h 36 l -4 6 h -28 z" className="pan" />
          {stack(right, 0)}
        </g>
      </g>
      <circle cx="100" cy="69" r="4" className="pivot" />
      <text x="46" y="94" className="pan-label">
        {op === '==' ? '2 + 2' : left}
      </text>
      <text x="154" y="94" className="pan-label">
        {right}
      </text>
      {/* The answer joins the question only when it answers *this*
          question: `5 > 3` is True, and "3 > 5 → True" would be a lie. */}
      <g className={`question ${b !== null && view.verdict === 'right' ? 'answered' : ''}`} transform="translate(100,22)">
        <rect x="-44" y="-11" width="88" height="20" rx="10" />
        <text y="3.5">{b !== null && view.verdict === 'right' ? `${question} → ${view.answer!.repr}` : `${question} ?`}</text>
      </g>
      {lamp && (
        // The comparison's answer, as the thing it is: a lamp, on or off.
        // It lights once the beam has settled, because the answer is
        // what the weighing *found*.
        <g className={`verdict-lamp ${truth ? 'on' : ''}`} transform="translate(180,12)">
          <circle r="13" className="lamp-glow" />
          <path d="M -7 -10 h 14 l 4 8 h -22 z" className="shade" />
          <circle cy="2" r="5" className="bulb-glass" />
          <rect x="-15" y="10" width="30" height="12" rx="6" className="verdict-pill" />
          <text y="19">{truth ? 'True' : 'False'}</text>
        </g>
      )}
    </g>
  )
}

/* --- expr: one operation at a time --- */

function Expr({ view, text, first, then }: { view: PropView; text: string; first: string; then: string[] }) {
  // The working is the payoff, so it waits for the robot to have worked it
  // out: shown on a miss, it would hand over the answer to the question.
  const shown = view.verdict === 'right'
  const cw = 9.6
  const x0 = 100 - (text.length * cw) / 2
  const at = text.indexOf(first)
  return (
    <g className={`expr ${shown ? 'shown' : ''}`}>
      {at >= 0 && shown && <rect x={x0 + at * cw - 2} y="14" width={first.length * cw + 4} height="24" rx="5" className="first" />}
      <text x="100" y="31" className="expr-text">
        {text}
      </text>
      {then.map((line, i) => (
        <g key={i} className="step" style={{ ['--i' as string]: i }}>
          <path d={`M 100 ${44 + i * 30} v 8`} className="step-arrow" />
          <text x="100" y={68 + i * 30} className={`expr-text ${i === then.length - 1 ? 'result' : ''}`}>
            {line}
          </text>
        </g>
      ))}
      {!shown && (
        <text x="100" y="80" className="expr-hint">
          = ?
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

/* --- shelf: five data types, each in its slot --- */

const CUBBY_W = 37
const CUBBY_PITCH = 40.75
/** The first chip's top, inside its slot, and the distance between. */
const CHIP_TOP = 20
const CHIP_PITCH = 13
/** How many rows a slot has under its label. */
const CHIP_ROWS = 5

type ShelfRow = { key: string; text: string; cls: string; tag?: boolean }

function Shelf({ view, p }: { view: PropView; p: Extract<Prop, { kind: 'shelf' }> }) {
  const examples = p.examples ?? {}
  const named = (k: TypeSlot) => p.filled.includes(k)
  // The char slot's tag (`str · length 1`) takes two rows of its own.
  const tagRows = (k: TypeSlot) => (k === 'char' && named(k) ? 2 : 0)
  const room: Partial<Record<TypeSlot, number>> = {}
  for (const k of SLOTS) room[k] = Math.max(0, CHIP_ROWS - (named(k) ? (examples[k] ?? SLOT_EXAMPLES[k]).length : 0) - tagRows(k))
  const s = shelved(p.filled, view.heard, examples, room)
  // Only the newcomer flies in. A shelf drawn again from nothing — a
  // new element, a remount — shows the others already standing.
  const newest = p.filled[p.filled.length - 1]
  const latest = view.answer ? { slot: slotOf(view.answer), text: chipText(view.answer) } : null
  const isLatest = (slot: TypeSlot, text: string) => latest !== null && latest.slot === slot && latest.text === text
  const rows = (k: TypeSlot): ShelfRow[] => [
    ...s[k].examples.map((e) => ({ key: `x:${e.text}`, text: e.text, cls: `example ${e.said ? 'said' : ''}` })),
    ...(tagRows(k) ? [{ key: 'tag', text: '', cls: '', tag: true }] : []),
    ...s[k].heard.map((h) => ({ key: `h:${h}`, text: h, cls: 'heard' })),
  ]
  return (
    <g className={`shelf ${p.pulse ? 'pulse' : ''} ${p.cheer ? 'cheer' : ''}`}>
      {p.title && (
        <g className="shelf-title">
          <path d="M 34 7 h 30 M 136 7 h 30" />
          <text x="100" y="10.5">
            Data types
          </text>
        </g>
      )}
      <rect x="-2" y="104" width="204" height="5" rx="2" className="plank" />
      {SLOTS.map((k, i) => {
        const list = rows(k)
        const empty = !named(k) && list.length === 0
        let row = 0
        return (
          <g
            key={k}
            className={`cubby ${named(k) ? 'named' : ''} ${k === newest ? 'fresh' : ''}`}
            data-kind={k}
            transform={`translate(${0.5 + i * CUBBY_PITCH},16)`}
            style={{ ['--i' as string]: i }}
          >
            <rect width={CUBBY_W} height="88" rx="4" className="cubby-box" />
            {empty ? (
              <text x={CUBBY_W / 2} y="54" className="q">
                ?
              </text>
            ) : (
              <text x={CUBBY_W / 2} y="13" className={named(k) ? 'slot-label' : 'q small'}>
                {named(k) ? k : '?'}
              </text>
            )}
            {list.map((r) => {
              const at = row
              row += r.tag ? tagRows(k) : 1
              const y = CHIP_TOP + at * CHIP_PITCH
              return r.tag ? (
                <g key={r.key} className="char-tag" transform={`translate(${CUBBY_W / 2},${y})`} style={{ ['--j' as string]: at }}>
                  <text y="8">str ·</text>
                  <text y="17">length 1</text>
                </g>
              ) : (
                <g
                  key={r.key}
                  className={`chip ${r.cls} ${isLatest(k, r.text) ? 'latest' : ''}`}
                  data-kind={k}
                  transform={`translate(3,${y})`}
                  style={{ ['--j' as string]: at }}
                >
                  <rect width={CUBBY_W - 6} height="11" rx="5.5" />
                  <text x={(CUBBY_W - 6) / 2} y="8">
                    {short(r.text, 8)}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}
      {p.later && (
        <g className="later">
          <text x="60" y="122" className="bracket">
            [
          </text>
          {[0, 1, 2].map((j) => (
            <rect key={j} x={68 + j * 22} y="113" width="18" height="10" rx="5" className="ghost" style={{ ['--j' as string]: j }} />
          ))}
          <text x="136" y="122" className="bracket">
            ]
          </text>
          <g transform="translate(160,118)" className="later-tag">
            <rect x="-17" y="-6.5" width="34" height="13" rx="6.5" />
            <text y="3">later</text>
          </g>
        </g>
      )}
    </g>
  )
}

/* --- numberline: a measurement lands between the whole numbers --- */

function NumberLine({ view, p }: { view: PropView; p: Extract<Prop, { kind: 'numberline' }> }) {
  const span = Math.max(p.to - p.from, 1e-9)
  const x = (v: number) => 20 + ((v - p.from) / span) * 160
  const n = numberOf(view.answer)
  const value = n ?? p.mark
  const at = value === undefined ? null : clamp(value, p.from, p.to)
  const whole: number[] = []
  const step = span > 20 ? Math.ceil(span / 10) : 1
  for (let v = Math.ceil(p.from); v <= p.to; v += step) whole.push(v)
  const tenths: number[] = []
  if (span <= 2) for (let v = Math.ceil(p.from * 10); v <= p.to * 10; v++) if (v % 10 !== 0) tenths.push(v / 10)
  const written = n !== null ? view.answer!.repr : p.unnamed || p.mark === undefined ? null : String(p.mark)
  const fraction = at === null ? 0 : (at - p.from) / span
  return (
    <g className="numberline">
      <rect x="20" y="72" width="160" height="10" rx="5" className="track" />
      {/* The measured stretch: grows smoothly with the marker, never in steps. */}
      <rect x="20" y="72" width="160" height="10" rx="5" className="measured" style={{ transform: `scaleX(${fraction})` }} />
      {tenths.map((v) => (
        <line key={v} x1={x(v)} x2={x(v)} y1="84" y2="89" className="tick minor" />
      ))}
      {whole.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1="84" y2="94" className="tick" />
          <text x={x(v)} y="108" className="whole-label">
            {v}
          </text>
        </g>
      ))}
      {at !== null && (
        <g className="marker" style={{ translate: `${x(at)}px 0`, ['--from-x' as string]: `${x(p.from)}px` }}>
          <path d="M 0 70 l -7 -12 h 14 z" />
          {written !== null && (
            <text y="50" className="mark-value">
              {written}
            </text>
          )}
        </g>
      )}
    </g>
  )
}

/* --- letters: what a person reads --- */

/** Where each letter comes to rest: spread across the slot in a loose
 *  wave, a little tilted, the same every time. */
const LETTER_Y = [34, 56, 40, 62, 30, 52, 44]
const LETTER_TILT = [-8, 5, -3, 9, -6, 3, -10]

function Letters({ chars }: { chars: string[] }) {
  const shown = chars.slice(0, 10)
  const pitch = Math.min(30, 180 / Math.max(shown.length, 1))
  const x0 = 100 - ((shown.length - 1) * pitch) / 2
  const size = Math.min(24, pitch - 3)
  return (
    <g className="letters">
      {shown.map((c, i) => (
        <g key={i} transform={`translate(${x0 + i * pitch},${LETTER_Y[i % LETTER_Y.length]}) rotate(${LETTER_TILT[i % LETTER_TILT.length]})`}>
          <g className="letter-float" style={{ ['--i' as string]: i }}>
            <rect x={-size / 2} y={-size * 0.6} width={size} height={size * 1.2} rx="4" />
            <text y={size * 0.3} style={{ fontSize: `${size * 0.72}px` }}>
              {c === ' ' ? '␣' : c}
            </text>
          </g>
        </g>
      ))}
    </g>
  )
}

/* --- char: one character, held by its quotes --- */

function Char({ char, clasps }: { char: string; clasps: boolean }) {
  return (
    <g className={`char-prop ${clasps ? 'clasped' : ''}`}>
      <g className="char-tile">
        <rect x="74" y="20" width="52" height="64" rx="8" />
        <text x="100" y="67">
          {char}
        </text>
      </g>
      {clasps ? (
        <>
          {/* The quotes themselves as the clasps: Python's straight
              quotes, grown thick and closed over the tile's top corners.
              Not brackets round it — brackets are a list's. */}
          {[
            { side: 'left', x: 74 },
            { side: 'right', x: 126 },
          ].map((c) => (
            <g key={c.side} className={`clasp ${c.side}`}>
              <rect x={c.x - 9} y="12" width="7" height="22" rx="3.5" />
              <rect x={c.x + 2} y="12" width="7" height="22" rx="3.5" />
            </g>
          ))}
        </>
      ) : (
        <>
          <text x="62" y="46" className="plain-quote">
            "
          </text>
          <text x="138" y="46" className="plain-quote">
            "
          </text>
        </>
      )}
      <text x="100" y="112" className="char-caption">
        one character
      </text>
    </g>
  )
}

/* --- contrast: two things, one difference --- */

function Contrast({ left, right }: { left: ContrastSide; right: ContrastSide }) {
  return (
    <g className="contrast">
      <Side side={left} x={50} i={0} />
      <text x="100" y="58" className="versus">
        ≠
      </text>
      <Side side={right} x={150} i={1} />
    </g>
  )
}

function Side({ side, x, i }: { side: ContrastSide; x: number; i: number }) {
  const W = 84
  // As large as fits: the one difference should read from across the room.
  const fit = (text: string, max: number, width: number) => Math.min(max, width / Math.max([...text].length * 0.62, 1))
  const shownKind = side.resultKind ?? side.kind
  return (
    <g className="side" transform={`translate(${x},0)`}>
      {side.result === undefined ? (
        <g className="side-card" style={{ ['--i' as string]: i }} data-kind={side.kind}>
          <rect x={-W / 2} y="14" width={W} height="66" rx="10" />
          <text y={47 + fit(side.text, 34, W - 12) * 0.36} style={{ fontSize: `${fit(side.text, 34, W - 12)}px` }}>
            {side.text}
          </text>
        </g>
      ) : (
        <>
          <g className="side-card expr" style={{ ['--i' as string]: i }} data-kind={side.kind}>
            <rect x={-W / 2} y="8" width={W} height="30" rx="8" />
            <text y={23 + fit(side.text, 15, W - 8) * 0.36} style={{ fontSize: `${fit(side.text, 15, W - 8)}px` }}>
              {side.text}
            </text>
          </g>
          <path d="M 0 42 v 10 m -4 -4 l 4 4 l 4 -4" className="makes" />
          <g className="side-card result" style={{ ['--i' as string]: i }} data-kind={shownKind}>
            <rect x={-W / 2 + 10} y="58" width={W - 20} height="32" rx="8" />
            <text y={74 + fit(side.result, 20, W - 28) * 0.36} style={{ fontSize: `${fit(side.result, 20, W - 28)}px` }}>
              {side.result}
            </text>
          </g>
        </>
      )}
      <text y={side.result === undefined ? 95 : 104} className="side-kind" data-kind={shownKind}>
        {kindWord(shownKind)}
      </text>
      {side.label && (
        <text y={side.result === undefined ? 109 : 118} className="side-label">
          {short(side.label, 20)}
        </text>
      )}
    </g>
  )
}

/* --- beads: a string is characters in a row, clasped by its quotes --- */

function Beads({ text, glow }: { text: string; glow: boolean }) {
  const chars = [...text].slice(0, 12)
  const pitch = Math.min(24, 136 / Math.max(chars.length, 1))
  const r = Math.min(10.5, pitch / 2 - 0.5)
  const x0 = 100 - ((chars.length - 1) * pitch) / 2
  const first = x0 - r - 11
  const last = x0 + (chars.length - 1) * pitch + r + 11
  return (
    <g className={`beads ${glow ? 'glow' : ''}`}>
      <path d={`M 8 58 Q 100 ${chars.length ? 66 : 62} 192 58`} className="thread" />
      {chars.map((c, i) => {
        const x = x0 + i * pitch
        return (
          <g key={i} transform={`translate(${x},62)`}>
            <g className="bead" style={{ ['--i' as string]: i, ['--dx' as string]: `${8 - x}px` }}>
              <circle r={r} />
              <text y={r * 0.38} style={{ fontSize: `${r * 1.15}px` }}>
                {c === ' ' ? '␣' : c}
              </text>
            </g>
          </g>
        )
      })}
      {[
        { x: first, word: 'starts', side: 'left' },
        { x: last, word: 'stops', side: 'right' },
      ].map((c) => (
        <g key={c.side} transform={`translate(${c.x},62)`}>
          {/* A quote, as Python writes it — two straight strokes — made
              into a clasp that closes the thread. */}
          <g className={`clasp ${c.side}`} style={{ ['--n' as string]: chars.length }}>
            <circle r="14" className="halo" />
            <rect x="-6" y="-13" width="4.5" height="26" rx="2.25" />
            <rect x="1.5" y="-13" width="4.5" height="26" rx="2.25" />
          </g>
          {glow && (
            <text y="36" className="clasp-word">
              {c.word}
            </text>
          )}
        </g>
      ))}
      <text x="100" y="118" className="beads-caption">
        "{short(text, 16)}"
      </text>
    </g>
  )
}

/* --- pointer: your instructions go over there --- */

function Pointer({ label }: { label: string }) {
  const lines = wrap(label, 18, 3)
  const w = Math.max(...lines.map((l) => l.length)) * 6.4 + 22
  const h = lines.length * 14 + 12
  // The chevrons run on past the picture's own box, off the stage's edge
  // (which clips them) towards the console beside it; however wide the
  // stage is, they read as a direction.
  const from = 100 + w / 2 + 8
  const chevrons = Array.from({ length: 40 }, (_, i) => from + i * 14)
  return (
    <g className="pointer">
      <g className="pointer-tag">
        <rect x={100 - w / 2} y={62 - h / 2} width={w} height={h} rx={h / 2 > 14 ? 12 : h / 2} />
        {lines.map((l, i) => (
          <text key={i} x="100" y={62 - (lines.length - 1) * 7 + i * 14 + 4}>
            {l}
          </text>
        ))}
      </g>
      {chevrons.map((cx, i) => (
        <path key={i} d={`M ${cx} 55 l 7 7 l -7 7`} className="chevron" style={{ ['--i' as string]: i }} />
      ))}
    </g>
  )
}

/* --- lamps: True is 1 --- */

function Lamps({ on }: { on: number }) {
  const n = clamp(Math.round(on), 1, 4)
  const LW = 30
  const OW = 22
  const RW = 36
  const total = n * LW + (n - 1) * OW + OW + RW
  const x0 = 100 - total / 2
  const lampX = (i: number) => x0 + i * (LW + OW) + LW / 2
  const plusX = (i: number) => lampX(i) + LW / 2 + OW / 2
  const arrowX = lampX(n - 1) + LW / 2 + OW / 2
  const resultX = arrowX + OW / 2 + RW / 2
  return (
    <g className="lamps">
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${lampX(i)},0)`} className="one-lamp" style={{ ['--i' as string]: i }}>
          <circle cy="30" r="17" className="lamp-glow" />
          <path d="M -9 12 h 18 l 5 11 h -28 z" className="shade" />
          <circle cy="30" r="7" className="bulb-glass" />
          <rect x="-15" y="46" width="30" height="13" rx="6.5" className="true-pill" />
          <text y="55.5" className="true-text">
            True
          </text>
          <g className="as-one">
            <rect x="-11" y="74" width="22" height="22" rx="5" className="one-block" />
            <text y="89.5" className="one-text">
              1
            </text>
          </g>
        </g>
      ))}
      {Array.from({ length: n - 1 }, (_, i) => (
        <g key={i}>
          <text x={plusX(i)} y="57" className="op">
            +
          </text>
          <text x={plusX(i)} y="90" className="op as-one-op" style={{ ['--n' as string]: n }}>
            +
          </text>
        </g>
      ))}
      <text x={arrowX} y="90" className="op as-one-op" style={{ ['--n' as string]: n }}>
        =
      </text>
      <g className="sum" style={{ ['--n' as string]: n }}>
        <rect x={resultX - RW / 2} y="70" width={RW} height="30" rx="7" className="one-block" />
        <text x={resultX} y="91" className="sum-text">
          {n}
        </text>
        <text x={resultX} y="113" className="sum-kind">
          int
        </text>
      </g>
    </g>
  )
}

/* --- codes: every character is secretly a number --- */

function Codes({ chars }: { chars: string }) {
  const placed = codeLine(chars).slice(0, 8)
  const x = (at: number) => 16 + at * 168
  return (
    <g className="codes">
      <line x1="12" x2="188" y1="88" y2="88" className="axis" />
      {placed.map((c, i) => (
        <g key={c.char}>
          <line x1={x(c.at)} x2={x(c.at)} y1="84" y2="94" className="tick" />
          <text x={x(c.at)} y="108" className="code-num" style={{ ['--i' as string]: i }}>
            {c.code}
          </text>
          <g transform={`translate(${x(c.at)},0)`}>
            <g className="code-tile" style={{ ['--i' as string]: i, ['--dx' as string]: `${-x(c.at) - 20}px` }}>
              <path d="M 0 74 v 8" className="drop" />
              <rect x="-12" y="40" width="24" height="30" rx="5" />
              <text y="62">{c.char === ' ' ? '␣' : c.char}</text>
            </g>
          </g>
        </g>
      ))}
    </g>
  )
}

/* --- scale: the robot's answer, weighed --- */

function Scale({ view, parcels, each }: { view: PropView; parcels: number; each: number }) {
  const n = numberOf(view.answer)
  const count = clamp(Math.round(parcels), 1, 12)
  const cols = Math.min(count, 4)
  const on = n !== null
  const off = on && Math.abs(n - count * each) > 1e-9
  const PW = 22
  const PH = 14
  // Where each parcel stands: on the scale once weighed, waiting on the
  // floor beside it before.
  const place = (i: number) =>
    on
      ? ([122 - (cols * (PW + 1)) / 2 + (i % cols) * (PW + 1), 81.5 - Math.floor(i / cols) * (PH + 1)] as const)
      : ([6 + (i % 2) * (PW + 1), 110 - Math.floor(i / 2) * (PH + 1)] as const)
  return (
    <g className={`scale ${on ? 'weighed' : ''} ${off ? 'off' : ''}`} style={{ ['--n' as string]: count }}>
      <line x1="0" x2="200" y1="125" y2="125" className="floor" />
      <rect x="112" y="100" width="20" height="6" className="post" />
      <rect x="66" y="96" width="112" height="5" rx="2" className="platform" />
      <rect x="76" y="104" width="92" height="21" rx="4" className="base" />
      <rect x="96" y="107" width="52" height="15" rx="2.5" className="readout" />
      <text x="122" y="118" className="reading" key={on ? view.answer!.repr : 'none'}>
        {on ? `${short(view.answer!.repr, 6)} kg` : '? kg'}
      </text>
      {Array.from({ length: count }, (_, i) => {
        const [px, py] = place(i)
        return (
          <g key={`${on ? 'on' : 'wait'}:${i}`} transform={`translate(${px},${py})`}>
            <g className="parcel" style={{ ['--i' as string]: i }}>
              <rect width={PW} height={PH} rx="1.5" />
              <text x={PW / 2} y="9.5">
                {each} kg
              </text>
            </g>
          </g>
        )
      })}
    </g>
  )
}
