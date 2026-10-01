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
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  CODE_BOX,
  CHIP_ROWS,
  CUBBY_GAP,
  SLOTS,
  SPEED_MAX,
  boolOf,
  carReading,
  chipChars,
  chipLines,
  chipText,
  clamp,
  codeLine,
  codeLines,
  codeSize,
  codeTokens,
  cubbyWidth,
  indentOf,
  kindOf,
  numberOf,
  needleAngle,
  OPS,
  OP_WORDS,
  exprWorking,
  goalShown,
  hotbarLit,
  backpackLit,
  backpackTicks,
  BACKPACK_MAX,
  HOTBAR_ICONS,
  HOTBAR_MAX,
  CASES_MAX,
  GATE_LOCKS,
  HUD_ROWS,
  PATHS_MAX,
  TALLY_MAX,
  caseResult,
  gateCurrent,
  gateShows,
  hudBar,
  hudIcon,
  literalBool,
  pathIcon,
  pathMarks,
  tallyShows,
  type GoalShownRow,
  literalKind,
  packsShape,
  packsSum,
  refused as refusedOf,
  shelfRoom,
  shelfSlots,
  shelved,
  slotOf,
  textOf,
  unworked,
  type ContrastSide,
  type Op,
  type Prop,
  type PropView,
  type TypeSlot,
} from '../scene/props'
import type { Thought } from '../memory/extract'
import { itemsOf, reprOf, typeOf } from '../memory/goal'

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
  const waiting = unworked(view)
  const refused = refusedOf(view)
  return (
    <button
      ref={ref}
      type="button"
      className="prop-layer"
      data-role={role}
      data-prop={view.prop.kind}
      data-verdict={view.verdict ?? 'none'}
      data-worked={waiting ? 'no' : undefined}
      data-refused={refused ? 'yes' : undefined}
      data-testid={role === 'current' ? 'prop' : 'prop-leaving'}
      onClick={replay}
      tabIndex={role === 'current' ? 0 : -1}
      aria-hidden={role === 'leaving' ? true : undefined}
      aria-label={`${describe(view)} Press to watch it again.`}
    >
      <svg viewBox="0 0 200 130" className={`prop prop-${view.prop.kind}`} aria-hidden="true">
        {draw(view)}
      </svg>
      {said && !OWN_ANSWER.has(view.prop.kind) && <AnswerTag key={`${said.type}:${said.repr}`} thought={said} right={view.verdict === 'right'} waiting={waiting} refused={refused} />}
    </button>
  )
}

/** Pictures that draw the robot's answer in themselves — a goal's ticks,
 *  the panel's badge, the gate opening, the tally's counter — and so need
 *  no tag under them saying it again. */
const OWN_ANSWER = new Set(['goal', 'hud', 'gate', 'tally', 'cases', 'paths'])

/** The value, and its kind in words. Coloured by kind, the way every
 *  picture in these lessons colours it, but never only by colour. A
 *  right number said the wrong way (`unworked`) is still what the robot
 *  thought, so the tag still shows it — outlined in amber, with a `?`
 *  where the tick would go: the value, not yet the answer. A miss the
 *  picture draws refused (`refused`) is outlined in amber too, with no
 *  mark at all: not the answer, and nothing owed but another go. */
function AnswerTag({ thought, right, waiting, refused }: { thought: Thought; right: boolean; waiting: boolean; refused: boolean }) {
  const kind = kindOf(thought) ?? 'other'
  return (
    <span className={`answer-tag ${waiting ? 'unworked' : ''} ${refused ? 'refused' : ''}`} data-kind={kind} data-testid="answer-tag">
      <span className="answer-value">{short(thought.repr, 14)}</span>
      <span className="answer-kind">{thought.type}</span>
      {right && (
        <span className="answer-right" aria-label="right">
          ✓
        </span>
      )}
      {waiting && (
        <span className="answer-unworked" aria-label="not worked out yet">
          ?
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
      return <Balance view={view} p={p} />
    case 'expr':
      return view.answer === null && p.demo === 'work' ? <Working text={p.text} first={p.first} then={p.then} /> : <Expr view={view} text={p.text} first={p.first} then={p.then} />
    case 'ops':
      return <Ops mark={p.mark} />
    case 'clash':
      return <Clash left={p.left} op={p.op} right={p.right} />
    case 'packs':
      return <Packs view={view} p={p} />
    case 'phone':
      return <Phone view={view} number={p.number} />
    case 'door':
      return <Door view={view} />
    case 'doorway':
      return <Doorway view={view} demo={p.demo} />
    case 'car':
      return <Car view={view} speed={p.speed} drive={p.demo === 'drive'} />
    case 'note':
      return <Note view={view} text={p.text} title={p.title} />
    case 'value':
      return <Value text={p.text} />
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
    case 'code':
      return <Code text={p.text} mark={p.mark} />
    case 'goal':
      return <GoalMemory view={view} p={p} />
    case 'hotbar':
      return <Hotbar view={view} p={p} />
    case 'backpack':
      return <Backpack view={view} p={p} />
    case 'hud':
      return <Hud view={view} p={p} />
    case 'gate':
      return <Gate view={view} p={p} />
    case 'paths':
      return <Paths p={p} />
    case 'tally':
      return <Tally view={view} p={p} />
    case 'cases':
      return <Cases view={view} p={p} />
  }
}

/** The word for a slot's kind, as the picture writes it under a value. A
 *  char is Python's str one character long, and says so: the shelf shows
 *  five ideas, but Python has four types (R8). */
const kindWord = (k: TypeSlot): string => (k === 'char' ? 'str · length 1' : k)

/** One sentence a screen reader can say for the picture as it stands. A
 *  miss the picture draws refused says so, as the amber does. */
export function describe(view: PropView): string {
  const said = drawnAs(view)
  return refusedOf(view) ? `${said} But the robot's ${view.answer!.repr} is not the answer yet.` : said
}

function drawnAs(view: PropView): string {
  const p = view.prop
  const a = view.answer
  // The right answer said the wrong way is described as the picture
  // draws it: still waiting (`unworked`).
  const idle = unworked(view)
  const n = idle ? null : numberOf(a)
  const b = boolOf(a)
  const t = idle ? null : textOf(a)
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
      return `A basket with ${p.demo === 'tally' ? tallied(p.apples) : p.apples} apples.${
        p.demo === 'count'
          ? ` Counted in one at a time: ${p.apples}.`
          : p.demo === 'half'
            ? ` Half an apple bounces off; the count stays ${p.apples}.`
            : p.demo === 'tally'
              ? ` The counter beside it says ${tallied(p.apples)}.`
              : ''
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
          : `Blocks: ${(p.parts ?? ['7', '+', '7']).join(' ')}.${p.demo === 'stamp' && !idle ? ' The word stamps itself that many times.' : ''}${waiting(view)}`
    case 'crates':
      return `${p.crates} crates with ${p.each} bolts in each.${n !== null ? ` ${a!.repr} bolts lit.` : waiting(view)}`
    case 'share':
      return `A jug of ${p.litres} litres and ${p.robots} tanks.${n !== null ? ` Each tank gets ${a!.repr}.` : waiting(view)}`
    case 'bolts':
      return `${p.have} bolts, ${p.use} of them used.${n !== null ? ` The robot says ${a!.repr} are left.` : waiting(view)}`
    case 'balance':
      return `A balance: ${question(p)}?${p.lamp ? ` A lamp beside it says ${holds(p.left, p.op, p.right) ? 'True' : 'False'}.` : ''}${
        b !== null ? ` The robot says ${a!.repr}.` : ''
      }`
    case 'expr':
      return view.verdict === 'right' || (a === null && p.demo === 'work')
        ? `${p.text}: ${p.first} first, then ${p.then.join(', then ')}.`
        : `${p.text} = ?${waiting(view)}`
    case 'ops':
      return `Four operator keys: ${OPS.map((o) => `${o} ${OP_WORDS[o]}`).join(', ')}.${p.mark ? ` The ${p.mark} key is pressed: ${OP_WORDS[p.mark]}.` : ''}`
    case 'clash':
      return `${p.left}, ${literalKind(p.left)}, ${p.op} ${p.right}, ${literalKind(p.right)}: they bump and bounce apart. The robot stops with a TypeError.`
    case 'packs': {
      const sh = packsShape(p)
      const inBox = sh.b > 0 ? `${sh.a} of one colour and ${sh.b} of another` : `${sh.a}`
      return `${sh.packs} box${sh.packs === 1 ? '' : 'es'} with ${inBox} in each${sh.loose ? `, and ${sh.loose} loose beside them` : ''}.${
        n !== null ? ` ${a!.repr} of them lit.` : waiting(view)
      }`
    }
    case 'phone':
      return a ? `A phone showing ${textOf(a) ?? a.repr}.` : 'A phone, waiting for a number.'
    case 'doorway': {
      const open = doorOpen(view, p.demo)
      const said = a === null ? (p.demo ? `: open is ${open ? 'True' : 'False'}` : '') : b !== null ? `: the robot said ${a.repr}` : ''
      return `A door in its frame, ${open ? 'open' : 'shut'}${said}.${t !== null ? ` A note stuck on it says ${t}; the door does not move.` : ''}`
    }
    case 'car': {
      const shown = carShows(view, p.speed, p.demo === 'drive')
      return `A car and its speedometer, ${shown === null ? 'the needle at 0 and the readout saying ? km/h' : `reading ${shown.text} km/h`}.${
        t !== null ? ` A note stuck on the car says ${t}; the needle does not move.` : ''
      }`
    }
    case 'note': {
      const heading = p.title ? `A note titled ${p.title}` : 'A note'
      const robot = a === null ? '' : t !== null ? ` The robot has it as "${t}", a str.` : ` The robot has ${a.repr}, ${kindWordOf(a)}, not words.`
      return `${heading} that says ${p.text}.${robot}`
    }
    case 'value':
      return `A card with ${p.text} written on it.`
    case 'door':
      return `A locked door. The robot knows: True.${t !== null ? ` A note for Mira says: ${t}.` : ''}`
    case 'card':
      return t !== null ? `A card for Mira that says: ${t}.` : 'A blank card for Mira.'
    case 'letter':
      return refusedOf(view)
        ? `A tile with the letter ${p.char} on it, not turned.`
        : n !== null
          ? `The letter ${p.char}, turned over: ${a!.repr}.`
          : `A tile with the letter ${p.char} on it.${waiting(view)}`
    case 'shelf': {
      // The same room the drawing gives each slot, so the sentence lists
      // exactly the chips on the shelf.
      const shown = shelfSlots(p)
      const s = shelved(p.filled, view.heard, p.examples ?? {}, shelfRoom(p.filled, p.examples ?? {}), shown)
      const slots = shown.map((k) =>
        p.filled.includes(k) ? `${k}: ${[...s[k].examples.map((e) => e.text), ...s[k].heard].join(', ')}` : `a slot marked ?${s[k].heard.length ? ` holding ${s[k].heard.join(', ')}` : ''}`,
      )
      return `A shelf of ${COUNT_WORD[shown.length] ?? shown.length} slot${shown.length === 1 ? '' : 's'}${p.title ? ', labelled Data types' : ''}. ${slots.join('; ')}.${p.later ? ' Beside it, empty chips in square brackets, for later.' : ''}`
    }
    case 'numberline': {
      const at = n ?? p.mark
      return `A number line from ${p.from} to ${p.to}.${at !== undefined ? ` A marker stops at ${p.unnamed && n === null ? 'a point between the ticks' : at}.` : ''}${waiting(view)}`
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
      return `${p.parcels} parcels of ${p.each} kg and a scale.${n !== null ? ` On the scale, it reads ${a!.repr} kg.` : waiting(view)}`
    case 'goal':
      return goalSentence(view, p)
    case 'hotbar':
      return hotbarSentence(view, p)
    case 'backpack':
      return backpackSentence(view, p)
    case 'hud':
      return hudSentence(view, p)
    case 'gate':
      return gateSentence(view, p)
    case 'paths':
      return pathsSentence(p)
    case 'tally':
      return tallySentence(view, p)
    case 'cases':
      return casesSentence(view, p)
    case 'code': {
      const lines = codeLines(p.text)
      const marked = p.mark !== undefined && lines[p.mark - 1] !== undefined ? ` Line ${p.mark} is highlighted: ${lines[p.mark - 1]!.trim()}.` : ''
      return `Code, ${lines.length} line${lines.length === 1 ? '' : 's'}: ${lines
        .map((l) => (indentOf(l) > 0 ? `${l.trim()} (indented${indentOf(l) > 1 ? ` ${indentOf(l)} levels` : ''})` : l))
        .join('; ')}.${marked}`
    }
  }
}

/** What a picture says of a right number said the wrong way: the robot
 *  has thought of it, and nobody has worked it out yet. */
const waiting = (view: PropView): string =>
  unworked(view) ? ` The robot thought of ${view.answer!.repr}, but it has not been worked out yet.` : ''

/** The balance's question as the pans write it: each side's label, or its
 *  number. */
const question = (p: Extract<Prop, { kind: 'balance' }>): string => `${p.leftLabel ?? p.left} ${p.op} ${p.rightLabel ?? p.right}`

/** Whether `left op right` holds: the balance's own truth. */
const holds = (left: number, op: '>' | '<' | '==', right: number): boolean => (op === '==' ? left === right : op === '>' ? left > right : left < right)

/** How many apples a tally draws: `APPLE_AT`'s places, at most. */
const tallied = (apples: number): number => clamp(Math.floor(apples), 0, APPLE_AT.length)

/** A small count in words, for a sentence. */
const COUNT_WORD: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' }

/** A kind in words, for a sentence: `an int`, `a bool`. */
const kindWordOf = (t: Thought): string => `${/^[aeiou]/.test(t.type) ? 'an' : 'a'} ${t.type}`

/* --- lamp: a switch is a bool --- */

function Lamp({ view, demo }: { view: PropView; demo: 'on' | 'off' | undefined }) {
  // The narration's switch holds only while nothing has been answered:
  // an answer is always drawn as itself. The demo's class stays either
  // way, because taking it away would change which animation the lamp
  // runs, and a changed animation starts again.
  const on = view.answer ? boolOf(view.answer) === true : demo === 'on'
  const note = textOf(view.answer)
  // A refused `True` still flips the switch — it is what the robot
  // thought — but the lamp comes on amber, not warm: lit, and not taken.
  const no = refusedOf(view)
  return (
    <g className={`lamp ${on ? 'on' : ''} ${no ? 'refused' : ''} ${demo ? `demo-${demo}` : ''}`}>
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
    <g className={`fishbowl ${b === true ? 'said-true' : b === false ? 'said-false' : ''} ${refusedOf(view) ? 'refused' : ''}`}>
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

function Basket({ view, apples, demo }: { view: PropView; apples: number; demo: 'count' | 'half' | 'tally' | undefined }) {
  const n = numberOf(view.answer)
  const whole = n === null ? 0 : clamp(Math.floor(Math.max(n, 0)), 0, 10)
  const part = n !== null && n > 0 && !Number.isInteger(n) && whole < 10
  const count = whole + (part ? 1 : 0)
  const x0 = 100 - ((count - 1) * 17) / 2
  const shown = Math.min(apples, APPLE_AT.length)
  // Counted to the apples and still refused (`3.0`, or `2 + 1` where the
  // player was to count): the tokens stand, in amber, dashed.
  const no = refusedOf(view)
  const tally = demo === 'tally'
  const held = tallied(apples)
  return (
    <g className={`basket ${demo ? `demo-${demo}` : ''}`}>
      {tally && (
        // The tally's counter. The same column of whole numbers behind a
        // window, but driven by `--count`, a registered *integer*: as the
        // count changes the column rolls through every whole number on
        // the way, and can stop on nothing else (props.css).
        <g className="counter" transform="translate(170,98)">
          <clipPath id="basket-tally">
            <rect x="-12" y="-11" width="24" height="22" rx="6" />
          </clipPath>
          <rect x="-14" y="-13" width="28" height="26" rx="8" className="counter-face" />
          <g clipPath="url(#basket-tally)">
            <g className="counter-roll tally-roll" style={{ ['--count' as string]: held, ['--n' as string]: held }}>
              {Array.from({ length: APPLE_AT.length + 1 }, (_, k) => (
                <text key={k} y={5.5 + k * 22} className="counter-num">
                  {k}
                </text>
              ))}
            </g>
          </g>
        </g>
      )}
      {tally &&
        // Every place is drawn, and the ones past the count wait above
        // the basket, gone: a changed count lifts apples out or drops them
        // in as a transition on the same elements.
        APPLE_AT.map(([x, y], i) => (
          <g key={i} className="apple" style={{ ['--i' as string]: i }} transform={`translate(${x},${y})`}>
            <g className={`apple-lift ${i < held ? 'in' : 'out'}`}>
              <g className="apple-drop">
                <circle r="11" className="apple-skin" />
                <path d="M 0 -10 q 2 -6 6 -7" className="stalk" />
                <path d="M 1 -12 q 7 -6 11 -1 q -6 3 -11 1 z" className="leaf" />
              </g>
            </g>
          </g>
        ))}
      {demo && !tally && (
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
      {!tally && APPLE_AT.slice(0, apples).map(([x, y], i) => (
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
          <g key={i} transform={`translate(${x0 + i * 17},16)`} className={`token ${extra ? 'extra' : ''} ${half ? 'half' : ''} ${no ? 'refused' : ''}`}>
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
  // Parked on a floor and refused (`-1.0` at the car park, or any floor
  // but the one asked): the car arrives amber and hollow, its floor is
  // not marked as reached, and the number the robot said is written
  // beside it, dot and all.
  const no = refusedOf(view)
  const list = Array.from({ length: floors }, (_, i) => highest - i)
  return (
    <g className="lift">
      <rect x="0" y={ground} width="200" height={130 - ground} className="earth" />
      <rect x="44" y="6" width="112" height={ground - 6} className="storeys" />
      <rect x="44" y={ground} width="112" height={124 - ground} className="storeys under" />
      {list.map((f) => (
        <g key={f}>
          <line x1="44" x2="156" y1={top(f) + h} y2={top(f) + h} className="floor-line" />
          <text x="36" y={top(f) + h / 2 + 3.5} className={`floor-num ${n !== null && !stuck && !no && at === f ? 'here' : ''}`}>
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
          <rect x="118" y="2" width="26" height={h - 4} rx="3" className={`car ${stuck ? 'stuck' : ''} ${no ? 'refused' : ''}`} />
          <line x1="131" x2="131" y1="4" y2={h - 4} className="car-door" />
        </g>
      </g>
      {stuck && (
        <g transform={`translate(172,${top(at) + h / 2})`} className="warn">
          <path d="M 0 -9 l 9 16 h -18 z" />
          <text y="5">!</text>
        </g>
      )}
      {no && (
        <text x="159" y={top(at) + h / 2 + 3.5} className="refused-floor">
          {short(view.answer!.repr, 6)}
        </text>
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
  // Filled like the first and refused (typed by the robot's working where
  // the player was to read it): the water is amber, the caption too.
  const no = refusedOf(view)
  return (
    <g className={`glasses ${no ? 'refused' : ''}`}>
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
  // A person drawn, and refused (a whole number of metres): the figure is
  // outlined in amber, not filled, and so is its mark.
  const no = refusedOf(view)
  return (
    <g className={`height ${no ? 'refused' : ''}`}>
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
  // A full box, refused (`6.0`: eggs are counted, not measured): the eggs
  // sit in their hollows outlined in amber, dashed.
  const no = refusedOf(view)
  return (
    <g className={`carton ${no ? 'refused' : ''}`}>
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
    <g className={`breakfast ${b === null ? 'covered' : b ? 'full' : 'empty'} ${refusedOf(view) ? 'refused' : ''}`}>
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
    <g className={`match ${refusedOf(view) ? 'refused' : ''}`}>
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
  // What the sum makes, typed where the robot was to glue or add it
  // (`unworked`): no tiles are glued and no blocks added up; the sum
  // stays as asked, and under it an amber `= ?`.
  const waiting = unworked(view)
  const t = waiting ? null : textOf(view.answer)
  const n = waiting ? null : numberOf(view.answer)
  // One letter under a lone word, refused (not the one asked for): its
  // tile is drawn, outlined in amber, dashed.
  const no = refusedOf(view)
  if (!waiting && stamp && t === null && n === null) return <Stamps parts={parts} />
  if (waiting) {
    return (
      <g className="tiles blocks unworked">
        <Parts parts={parts} />
        <text x="100" y="108" className="tiles-caption unworked-q">
          = ?
        </text>
      </g>
    )
  }
  if (t !== null) {
    const chars = [...t].slice(0, 10)
    // As big as they fit: two tiles are the point of `"7" + "7"`, and
    // they should read from across the room.
    const w = Math.min(36, 190 / Math.max(chars.length, 1))
    const x0 = 100 - (chars.length * w) / 2
    return (
      <g className={`tiles text ${no ? 'refused' : ''}`}>
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
      <g className={`tiles number ${no ? 'refused' : ''}`}>
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

/** How much a short row of parts may grow. A lone `"Mira"` laid out at
 *  the row's own size is four 16-unit tiles in a 200-wide picture — on a
 *  phone, letters a few pixels high, for a question about which letter
 *  comes first. Grown to fill the width, up to this, it reads. */
const PARTS_GROW = 2.2

/** The row's vertical middle, which a grown row scales about so it stays
 *  where the small one stood. */
const PARTS_MID = 53

/** Python literals and operators laid out in a row: a str as letter
 *  tiles, an int as a block, an operator as itself. Scaled to fit the
 *  width, and scaled *up* to it, as far as `grow`, when the row is short. */
function Parts({ parts, grow = PARTS_GROW }: { parts: string[]; grow?: number }) {
  const T = 16
  const laid = parts.map((part) => {
    if (/^".*"$/.test(part)) return { part, kind: 'str' as const, chars: [...part.slice(1, -1)], w: [...part.slice(1, -1)].length * T }
    if (/^-?\d+$/.test(part)) return { part, kind: 'int' as const, chars: [], w: Math.max(40, part.length * 14 + 18) }
    return { part, kind: 'op' as const, chars: [], w: 22 }
  })
  const gap = 6
  const total = laid.reduce((sum, x) => sum + x.w, 0) + gap * (laid.length - 1)
  const k = Math.min(grow, 190 / total)
  let x = 0
  return (
    <g transform={`translate(${100 - (total * k) / 2},${PARTS_MID * (1 - k)}) scale(${k})`}>
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
        <Parts parts={parts} grow={1} />
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
  // A refused 42 lights nothing: typed by hand, it has counted no bolts.
  const waiting = unworked(view)
  const n = waiting ? null : numberOf(view.answer)
  const lit = n === null ? 0 : clamp(Math.floor(n), 0, crates * each)
  const cw = Math.min(24, 180 / crates)
  const x0 = 100 - (crates * cw) / 2
  const pitch = 78 / each
  // Every bolt lit by a number that is not the sum (`43`, or `42.5`): the
  // bolts light amber, and the label says what the robot said, amber too.
  const no = refusedOf(view)
  return (
    <g className={`crates ${waiting ? 'unworked' : ''} ${no ? 'refused' : ''}`}>
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
        {n !== null ? `${view.answer!.repr} bolts` : waiting ? `${crates} * ${each} = ?` : `${crates} crates × ${each} bolts`}
      </text>
    </g>
  )
}

/* --- share: division, and what is left over --- */

function Share({ view, litres, robots }: { view: PropView; litres: number; robots: number }) {
  // A refused share pours nothing: the jug stays full and each tank asks.
  const waiting = unworked(view)
  const n = waiting ? null : numberOf(view.answer)
  const each = n === null ? 0 : Math.max(0, n)
  const left = n === null ? litres : Math.max(0, litres - each * robots)
  const scale = 6
  const tankH = 72
  // One or two tanks stand where they always have. Three or four are
  // narrower and share the room between the jug's handle (x 80) and the
  // scale's numbers beside the last (x 176): at their old spacing the
  // third and fourth ran off the picture's edge and back over the jug.
  const tw = robots <= 2 ? 32 : robots === 3 ? 28 : 21
  const room = 96
  const step = robots <= 2 ? 48 : tw + (room - robots * tw) / Math.max(1, robots - 1)
  const tanks = Array.from({ length: robots }, (_, i) => (robots <= 2 ? 146 - ((robots - 1) * step) / 2 + i * step : 80 + tw / 2 + i * step))
  // More each than the jug holds (`5` of 9 litres, twice): the jug
  // empties, but it does not say it shared out — it says in amber that it
  // only had so much, and the tanks' labels are amber too.
  const no = refusedOf(view)
  return (
    <g className={`share ${waiting ? 'unworked' : ''} ${no ? 'refused' : ''}`}>
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
          {n === null ? `${litres} L` : no ? `only ${litres} L` : `${Number.isInteger(left) ? left : left.toFixed(1)} L left`}
        </text>
      </g>
      {tanks.map((x, i) => (
        <g key={i} className="tank" transform={`translate(${x},0)`}>
          <rect x={-tw / 2} y={120 - tankH} width={tw} height={tankH} rx="4" className="tank-body" />
          <rect x={-tw / 2 + 1} y={120 - tankH} width={tw - 2} height={tankH - 1} className="oil tank-oil" style={{ transform: `scaleY(${clamp(each / scale, 0, 1)})` }} />
          {Array.from({ length: scale + 1 }, (_, k) => (
            <line key={k} x1={tw / 2 - 6} x2={tw / 2} y1={120 - (k / scale) * tankH} y2={120 - (k / scale) * tankH} className="tick" />
          ))}
          {i === robots - 1 &&
            [0, 2, 4, 6].map((k) => (
              <text key={k} x={tw / 2 + 10} y={123 - (k / scale) * tankH} className="tick-label">
                {k}
              </text>
            ))}
          {n !== null && (
            <text y={114 - clamp(each / scale, 0, 1) * tankH} className="tank-label">
              {view.answer!.repr}
            </text>
          )}
          {waiting && (
            <text y="104" className="tank-label unworked-q">
              ?
            </text>
          )}
        </g>
      ))}
    </g>
  )
}

/* --- bolts: taking away --- */

function Bolts({ view, have, use }: { view: PropView; have: number; use: number }) {
  // A refused 13 rings nothing: nobody has counted what is left.
  const waiting = unworked(view)
  const n = waiting ? null : numberOf(view.answer)
  const perRow = 10
  const ringed = n === null ? 0 : clamp(Math.floor(n), 0, have)
  const at = (i: number) => [19 + (i % perRow) * 18, 58 + Math.floor(i / perRow) * 30] as const
  // The bolts left ringed by a number that is not what is left (`13.5`):
  // the rings are amber, dashed, and so is the label.
  const no = refusedOf(view)
  return (
    <g className={`bolts ${waiting ? 'unworked' : ''} ${no ? 'refused' : ''}`}>
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
        {n !== null ? `${view.answer!.repr} left?` : waiting ? `${have} - ${use} = ?` : `${have} bolts, ${use} used`}
      </text>
    </g>
  )
}

/* --- balance: a question makes a bool --- */

/** Where a pan's blocks split into two colours: after the first part of
 *  a label that is a sum of two whole numbers adding up to the pan's
 *  weight (`2 + 2` on a pan of 4). Anything else is one colour. */
function splitOf(label: string | undefined, weight: number): number | undefined {
  const m = label === undefined ? null : /^\s*(\d+)\s*\+\s*(\d+)\s*$/.exec(label)
  if (!m) return undefined
  const a = Number(m[1])
  return a > 0 && a + Number(m[2]) === weight ? a : undefined
}

function Balance({ view, p }: { view: PropView; p: Extract<Prop, { kind: 'balance' }> }) {
  const { left, right, op } = p
  const lamp = p.lamp === true
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
  // What the pans say is what is asked: `2 + 2 == 4` only when the
  // lesson wrote the left side as `2 + 2`. It was hard-coded once, so
  // every `==` balance asked about 2 + 2 whatever it weighed.
  const asked = question(p)
  const said = b !== null && view.verdict === 'right' ? `${asked} → ${view.answer!.repr}` : null
  // As wide as what it says (11px mono is 6.6 a character), so a
  // longer question never runs out of its pill; kept clear of the lamp.
  const pill = clamp([...(said ?? `${asked} ?`)].length * 6.6 + 16, 88, lamp ? 134 : 190)
  return (
    <g className="balance">
      <path d="M 100 70 l -14 50 h 28 z" className="stand" />
      <g className="beam" style={{ ['--tilt' as string]: `${tilt}deg` }}>
        <rect x="30" y="66" width="140" height="6" rx="3" className="beam-bar" />
        <g transform="translate(46,66)">
          <path d="M -18 0 h 36 l -4 6 h -28 z" className="pan" />
          {stack(left, 0, splitOf(p.leftLabel, left))}
        </g>
        <g transform="translate(154,66)">
          <path d="M -18 0 h 36 l -4 6 h -28 z" className="pan" />
          {stack(right, 0, splitOf(p.rightLabel, right))}
        </g>
      </g>
      <circle cx="100" cy="69" r="4" className="pivot" />
      <text x="46" y="94" className="pan-label">
        {p.leftLabel ?? left}
      </text>
      <text x="154" y="94" className="pan-label">
        {p.rightLabel ?? right}
      </text>
      {/* The answer joins the question only when it answers *this*
          question: `5 > 3` is True, and "3 > 5 → True" would be a lie. */}
      <g className={`question ${said ? 'answered' : ''}`} transform="translate(100,22)">
        <rect x={-pill / 2} y="-12" width={pill} height="22" rx="11" />
        <text y="4">{said ?? `${asked} ?`}</text>
      </g>
      {lamp && (
        // The comparison's answer, as the thing it is: a lamp, on or off.
        // It lights once the beam has settled, because the answer is
        // what the weighing *found*.
        <g className={`verdict-lamp ${truth ? 'on' : ''}`} transform="translate(180,12)">
          <circle r="13" className="lamp-glow" />
          <path d="M -7 -10 h 14 l 4 8 h -22 z" className="shade" />
          <circle cy="2" r="5" className="bulb-glass" />
          <rect x="-17" y="10" width="34" height="14" rx="7" className="verdict-pill" />
          <text y="20.5">{truth ? 'True' : 'False'}</text>
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
  // The right number typed by hand shows no working either — and says so
  // in amber: that is the number, and it is still `?` how it was made.
  const waiting = unworked(view)
  const cw = 9.6
  const x0 = 100 - (text.length * cw) / 2
  const at = text.indexOf(first)
  return (
    <g className={`expr ${shown ? 'shown' : ''} ${waiting ? 'unworked' : ''}`}>
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

/** The working, played for a beat (`demo: 'work'`): the expression with
 *  its first step lit, then each line in turn, the lit span collapsing
 *  from the line above into the result it made, and the last line in its
 *  kind's colour. Every piece is where it rests; the playing is CSS
 *  (`backwards`), so without motion this is the finished working. */
function Working({ text, first, then }: { text: string; first: string; then: string[] }) {
  const lines = exprWorking(text, first, then)
  const cw = 9.6
  // Evenly spaced, with room for an arrow between one line's lit span
  // and the next's: as far apart as four lines allow, at most 36.
  const pitch = Math.min(36, 100 / Math.max(1, lines.length - 1))
  const y = (i: number) => 24 + i * pitch
  const x0 = (t: string) => 100 - (t.length * cw) / 2
  const box = (i: number, [a, b]: [number, number]) => ({ x: x0(lines[i]!.text) + a * cw - 2, y: y(i) - 16, w: (b - a) * cw + 4 })
  const last = lines[lines.length - 1]!.text
  return (
    <g className="expr working">
      {lines.map((l, i) => {
        const made = l.made ? box(i, l.made) : null
        const from = i > 0 && lines[i - 1]!.work ? box(i - 1, lines[i - 1]!.work!) : null
        const work = l.work ? box(i, l.work) : null
        return (
          <g key={i} className={i > 0 ? 'step' : 'start'} style={{ ['--i' as string]: i - 1, ['--s' as string]: i }}>
            {i > 0 && <path d={`M 100 ${y(i - 1) + 8} V ${y(i) - 18}`} className="step-arrow" />}
            {made && (
              <rect
                x={+made.x.toFixed(2)}
                y={made.y}
                width={+made.w.toFixed(2)}
                height="22"
                rx="5"
                className="made"
                style={
                  from
                    ? { ['--dx' as string]: `${(from.x - made.x).toFixed(2)}px`, ['--dy' as string]: `${from.y - made.y}px`, ['--sx' as string]: (from.w / made.w).toFixed(3) }
                    : undefined
                }
              />
            )}
            {work && i < lines.length - 1 && <rect x={+work.x.toFixed(2)} y={work.y} width={+work.w.toFixed(2)} height="22" rx="5" className="work" />}
            <text x="100" y={y(i)} className={`expr-text ${i === lines.length - 1 && i > 0 ? 'result' : ''}`} data-kind={i === lines.length - 1 && i > 0 ? literalKind(last) : undefined}>
              {l.text}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/* --- ops: the four operators --- */

function Ops({ mark }: { mark: Op | undefined }) {
  return (
    <g className={`ops ${mark ? 'marked' : ''}`}>
      {OPS.map((o, i) => {
        const x = 8 + i * 48
        return (
          <g key={o} className={`op-key ${mark === o ? 'pressed' : ''}`} transform={`translate(${x},26)`} style={{ ['--i' as string]: i }}>
            <rect y="6" width="40" height="46" rx="8" className="key-base" />
            <g className="key-top">
              <rect width="40" height="46" rx="8" className="key-face" />
              <text x="20" y="32" className="key-sym">
                {o}
              </text>
            </g>
            <text x="20" y="72" className="key-word">
              {OP_WORDS[o]}
            </text>
          </g>
        )
      })}
    </g>
  )
}

/* --- clash: two things that do not go together --- */

function Clash({ left, op, right }: { left: string; op: string; right: string }) {
  const tile = (t: string) => {
    const n = Math.max(1, [...t].length)
    const size = Math.min(18, 58 / (n * 0.6))
    return { size, w: Math.max(34, n * size * 0.6 + 14) }
  }
  const l = tile(left)
  const r = tile(right)
  return (
    <g className="clash">
      {[
        { t: left, s: l, x: 52, side: 'left' },
        { t: right, s: r, x: 148, side: 'right' },
      ].map(({ t, s, x, side }) => (
        <g key={side} transform={`translate(${x},46)`}>
          <g className={`clash-tile ${side}`} data-kind={literalKind(t)}>
            <rect x={-s.w / 2} y="-18" width={+s.w.toFixed(2)} height="36" rx="7" />
            <text y={+(s.size * 0.36).toFixed(2)} className="clash-text" style={{ fontSize: `${s.size.toFixed(2)}px` }}>
              {short(t, 12)}
            </text>
          </g>
          <text y="32" className="clash-kind" data-kind={literalKind(t)}>
            {literalKind(t)}
          </text>
        </g>
      ))}
      <text x="100" y="53" className="clash-op">
        {short(op, 3)}
      </text>
      <g className="clash-stop" transform="translate(100,108)">
        <rect x="-50" y="-12" width="100" height="24" rx="12" />
        <text x="-36" y="5" className="clash-x">
          ✕
        </text>
        <text x="8" y="4.5" className="clash-error">
          TypeError
        </text>
      </g>
    </g>
  )
}

/* --- packs: a chained sum, in boxes --- */

function Packs({ view, p }: { view: PropView; p: Extract<Prop, { kind: 'packs' }> }) {
  // Typed by hand, the right number has counted nothing: nothing lit.
  const waiting = unworked(view)
  const n = waiting ? null : numberOf(view.answer)
  const sh = packsShape(p)
  const per = sh.a + sh.b
  const total = sh.packs * per + sh.loose
  const lit = n === null ? 0 : clamp(Math.floor(n), 0, total)
  const no = refusedOf(view)
  const cols = per > 6 ? 3 : 2
  const rows = Math.max(1, Math.ceil(per / cols))
  const looseW = sh.loose > 0 ? 30 : 0
  const gap = 6
  const boxW = Math.min(44, (192 - looseW - (sh.loose > 0 ? gap : 0) - (sh.packs - 1) * gap) / sh.packs)
  const rowW = sh.packs * boxW + (sh.packs - 1) * gap + (sh.loose > 0 ? gap + looseW : 0)
  const left = 100 - rowW / 2
  // Each box as tall as its items, standing on the floor.
  const floor = 120
  const pitch = Math.min(12, (boxW - 6) / cols, 72 / rows)
  const boxH = Math.max(34, rows * pitch + 12)
  const top = floor - 2 - boxH
  const r = pitch * 0.38
  const item = (key: string, index: number, x: number, y: number, colour: 'a' | 'b') => (
    <circle key={key} cx={+x.toFixed(2)} cy={+y.toFixed(2)} r={+r.toFixed(2)} className={`item ${colour} ${index < lit ? 'lit' : ''}`} style={{ ['--i' as string]: index }} />
  )
  // Items stand from the bottom of their box up, the first colour first.
  const spot = (k: number, x0: number, c: number) => [x0 + (boxW - (c - 1) * pitch) / 2 + (k % c) * pitch, top + boxH - 7 - Math.floor(k / c) * pitch] as const
  const looseX = left + sh.packs * (boxW + gap)
  return (
    <g className={`packs ${waiting ? 'unworked' : ''} ${no ? 'refused' : ''}`}>
      <line x1="0" x2="200" y1={top + boxH + 2} y2={top + boxH + 2} className="floor" />
      {Array.from({ length: sh.packs }, (_, bx) => {
        const x0 = left + bx * (boxW + gap)
        return (
          <g key={bx} className="pack" style={{ ['--i' as string]: bx }}>
            <rect x={+x0.toFixed(2)} y={top} width={+boxW.toFixed(2)} height={boxH} rx="4" className="pack-box" />
            {Array.from({ length: per }, (_, k) => {
              const [x, y] = spot(k, x0, cols)
              return item(`${bx}:${k}`, bx * per + k, x, y, k < sh.a ? 'a' : 'b')
            })}
          </g>
        )
      })}
      {sh.loose > 0 && (
        <g className="loose">
          {Array.from({ length: sh.loose }, (_, k) => {
            const x = looseX + looseW / 2 + ((k % 2) - 0.5) * pitch
            const y = top + boxH - 7 - Math.floor(k / 2) * pitch
            return item(`l:${k}`, sh.packs * per + k, x, y, 'a')
          })}
        </g>
      )}
      <text x="100" y={Math.max(16, top - 10)} className="packs-label">
        {n !== null ? `${view.answer!.repr} in all` : waiting ? `${packsSum(p)} = ?` : `${sh.packs} boxes of ${sh.b > 0 ? `${sh.a} + ${sh.b}` : sh.a}${sh.loose ? `, ${sh.loose} loose` : ''}`}
      </text>
    </g>
  )
}

/* --- phone: a number that is really a name --- */

function Phone({ view, number }: { view: PropView; number: string }) {
  const a = view.answer
  const t = textOf(a)
  // The right digits, refused, ring nobody: the screen shows them in
  // amber and the phone stays quiet.
  const no = refusedOf(view)
  const calling = !no && t !== null && t.replace(/\D/g, '') === number
  const asInt = a && (a.type === 'int' || a.type === 'float') ? a.repr : null
  const lostZero = asInt !== null && number.startsWith('0') && number.replace(/^0+/, '') === asInt
  const shown = t ?? asInt
  return (
    <g className={`phone ${calling ? 'calling' : ''} ${no ? 'refused' : ''}`}>
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
            {/* As large as 9.5 units, and smaller only as far as the
                number needs to sit inside the screen: `0412 555 019` ran
                to its edges. A monospace character is 0.6 of its size. */}
            <text
              x={lostZero ? 106 : 100}
              y="47"
              className={`screen-text ${t !== null ? 'text' : 'num'}`}
              style={{ fontSize: `${Math.min(9.5, (lostZero ? 50 : 60) / (Math.max(1, [...short(shown, 12)].length) * 0.6)).toFixed(2)}px` }}
            >
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
        <rect x="-45" y="-8" width="90" height="16" rx="8" data-kind="bool" />
        <text y="3.8">locked: True</text>
      </g>
      {/* Words on the note, refused (a no, or not an answer to her): the
          note is edged in amber, dashed — written, and not sent. */}
      <g className={`note ${t === null ? 'blank' : ''} ${refusedOf(view) ? 'refused' : ''}`} transform="translate(8,40)">
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

/* --- doorway: open or shut is a bool --- */

/** Whether the doorway is drawn open: an answer is drawn as itself (a
 *  word opens nothing), and the narration's swing only stands in while
 *  nothing has been answered. */
const doorOpen = (view: PropView, demo: 'open' | 'closed' | undefined): boolean =>
  view.answer ? boolOf(view.answer) === true : demo === 'open'

function Doorway({ view, demo }: { view: PropView; demo: 'open' | 'closed' | undefined }) {
  const open = doorOpen(view, demo)
  const note = textOf(view.answer)
  // A refused bool still swings the door — it is what the robot thought
  // — but the door is edged in amber, dashed, and so is its pill: moved,
  // and not taken.
  const no = refusedOf(view)
  return (
    <g className={`doorway ${open ? 'open' : ''} ${no ? 'refused' : ''} ${demo ? `demo-${demo}` : ''}`}>
      <line x1="0" x2="200" y1="126" y2="126" className="floor" />
      <rect x="58" y="8" width="84" height="118" rx="3" className="frame" />
      {/* Outside, seen through the doorway once the door swings. */}
      <g className="outside">
        <rect x="65" y="15" width="70" height="111" className="sky" />
        <circle cx="116" cy="36" r="8" className="sun" />
        <path d="M 65 104 q 18 -10 35 -2 t 35 -4 v 28 h -70 z" className="hill" />
      </g>
      <g className="door-leaf">
        <rect x="65" y="15" width="70" height="111" className="leaf-face" />
        <rect x="73" y="24" width="54" height="38" rx="2" className="leaf-inset" />
        <rect x="73" y="70" width="54" height="46" rx="2" className="leaf-inset" />
        <circle cx="126" cy="68" r="3.4" className="knob" />
      </g>
      <g transform="translate(170,62)">
        <text y="-32" className="door-q">
          open?
        </text>
        <rect x="-20" y="-26" width="40" height="50" rx="5" className="plate-switch" />
        <rect x="-17" y="-22" width="34" height="13" rx="6.5" className="pill-true" />
        <text y="-12" className="switch-label">
          True
        </text>
        <rect x="-17" y="9" width="34" height="13" rx="6.5" className="pill-false" />
        <text y="19" className="switch-label">
          False
        </text>
      </g>
      {note !== null && (
        <g className="note" transform="translate(4,62) rotate(-6)">
          <rect x="0" y="0" width="52" height="30" rx="2" />
          <text x="26" y="19">
            {short(note, 9)}
          </text>
        </g>
      )}
    </g>
  )
}

/* --- car: a speed is measured, with a float --- */

const DIAL = { cx: 140, cy: 64, r: 46 } as const

/** What the car's dial shows: the answer when there is a number, else
 *  the drive's own speed, else nothing yet (the ask, waiting at 0). */
function carShows(view: PropView, speed: number, drive: boolean): { at: number; text: string; kind: string } | null {
  const n = numberOf(view.answer)
  if (n !== null) return { at: n, text: view.answer!.repr, kind: view.answer!.type }
  if (view.answer === null && drive) return { at: speed, text: carReading(speed), kind: 'float' }
  return null
}

/** A point on the dial at a speed, `r` from its centre. */
const onDial = (speed: number, r: number): [number, number] => {
  const a = (needleAngle(speed) * Math.PI) / 180
  return [+(DIAL.cx + r * Math.sin(a)).toFixed(2), +(DIAL.cy - r * Math.cos(a)).toFixed(2)]
}

function Car({ view, speed, drive }: { view: PropView; speed: number; drive: boolean }) {
  const shown = carShows(view, speed, drive)
  const at = shown?.at ?? 0
  const note = textOf(view.answer)
  const moving = at > 0
  const [ax, ay] = onDial(0, DIAL.r - 7)
  const [bx, by] = onDial(SPEED_MAX, DIAL.r - 7)
  const ticks = Array.from({ length: SPEED_MAX / 10 + 1 }, (_, k) => k * 10)
  return (
    <g className={`car-prop ${moving ? 'moving' : ''} ${shown === null ? 'waiting' : ''}`}>
      <rect x="0" y="118" width="200" height="12" className="road" />
      <path d="M 4 124 h 14 M 30 124 h 14 M 56 124 h 14 M 82 124 h 14" className="road-line" />
      <g className="speed-lines">
        <path d="M 0 96 h 10 M 2 104 h 12 M 0 111 h 8" />
      </g>
      <g className="car-body" transform="translate(16,90)">
        <g className="car-bob">
          <path d="M 4 12 q 0 -6 6 -7 l 10 -2 l 9 -10 q 3 -3 8 -3 h 14 q 5 0 8 4 l 7 9 l 7 1 q 6 1 6 8 v 8 h -75 z" className="car-paint" />
          <path d="M 31 -4 q 2 -3 6 -3 h 6 v 10 h -19 z M 47 -7 h 5 q 3 0 5 3 l 5 7 h -15 z" className="car-glass" />
          <circle cx="70" cy="11" r="2.2" className="car-light" />
        </g>
        <g transform="translate(20,21)">
          <g className="wheel">
            <circle r="7" />
            <path d="M -4 0 h 8 M 0 -4 v 8" />
          </g>
        </g>
        <g transform="translate(58,21)">
          <g className="wheel">
            <circle r="7" />
            <path d="M -4 0 h 8 M 0 -4 v 8" />
          </g>
        </g>
      </g>
      <g className="dial">
        <circle cx={DIAL.cx} cy={DIAL.cy} r={DIAL.r} className="dial-face" />
        <path d={`M ${ax} ${ay} A ${DIAL.r - 7} ${DIAL.r - 7} 0 1 1 ${bx} ${by}`} className="dial-track" />
        <path
          d={`M ${ax} ${ay} A ${DIAL.r - 7} ${DIAL.r - 7} 0 1 1 ${bx} ${by}`}
          pathLength="100"
          className="dial-reach"
          style={{ strokeDashoffset: +(100 - (100 * clamp(at, 0, SPEED_MAX)) / SPEED_MAX).toFixed(2) }}
        />
        {ticks.map((k) => {
          const major = k % 20 === 0
          const [x1, y1] = onDial(k, DIAL.r - 2)
          const [x2, y2] = onDial(k, DIAL.r - (major ? 9 : 6))
          const [lx, ly] = onDial(k, DIAL.r - 17)
          return (
            <g key={k}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className={`dial-tick ${major ? 'major' : ''}`} />
              {major && (
                <text x={lx} y={ly + 3} className="dial-num">
                  {k}
                </text>
              )}
            </g>
          )
        })}
        <g transform={`translate(${DIAL.cx},${DIAL.cy})`}>
          <g className="needle" style={{ rotate: `${needleAngle(at).toFixed(2)}deg` }}>
            <path d="M -2.6 4 L 0 -36 L 2.6 4 z" />
          </g>
          <circle r="4.5" className="hub" />
        </g>
        <g className="readout" data-kind={shown?.kind ?? 'none'}>
          <rect x={DIAL.cx - 30} y={DIAL.cy + 22} width="60" height="21" rx="5" />
          <text x={DIAL.cx} y={DIAL.cy + 37.5}>
            <tspan className="readout-value">{shown === null ? '?' : short(shown.text, 7)}</tspan>
            <tspan className="readout-unit" dx="2.5">
              km/h
            </tspan>
          </text>
        </g>
      </g>
      {note !== null && (
        <g className="note" transform="translate(6,52) rotate(-6)">
          <rect x="0" y="0" width="52" height="30" rx="2" />
          <text x="26" y="19">
            {short(note, 9)}
          </text>
        </g>
      )}
    </g>
  )
}

/* --- note: words, as a person writes them and as the robot has them --- */

function Note({ view, text, title }: { view: PropView; text: string; title: string | undefined }) {
  const a = view.answer
  const lines = wrap(text, 14, 2)
  const longest = Math.max(1, ...lines.map((l) => [...l].length))
  // Handwriting, as large as the note allows: 22 units, smaller only as
  // far as the longest line needs to fit across it.
  const hand = Math.min(22, 124 / (longest * 0.56))
  const robot = a === null ? null : chipText(a)
  const kind = a === null ? 'none' : (kindOf(a) ?? 'other')
  const size = robot === null ? 14 : Math.min(14, 150 / (Math.max(1, [...robot].length) * 0.6))
  const no = refusedOf(view)
  return (
    <g className={`note-prop ${no ? 'refused' : ''}`}>
      <g className="sticky" transform="translate(100,44) rotate(-2)">
        <rect x="-72" y="-38" width="144" height="76" rx="3" className="sticky-paper" />
        <rect x="-26" y="-43" width="52" height="11" rx="2" className="sticky-tape" />
        {title && (
          <text x="-62" y="-22" className="sticky-title">
            {short(title, 16)}
          </text>
        )}
        {lines.map((l, i) => (
          <text key={i} y={(title ? 8 : 4) + (i - (lines.length - 1) / 2) * hand * 1.1 + hand * 0.34} className="sticky-hand" style={{ fontSize: `${hand.toFixed(2)}px` }}>
            {l}
          </text>
        ))}
      </g>
      {/* The robot's copy: a tag under the note, dashed and empty until the
          robot has something to put on it. */}
      <g className={`robot-tag ${robot === null ? 'empty' : ''}`} data-kind={kind} transform="translate(100,106)">
        <g className="robot-tag-pop">
          <rect x="-80" y="-14" width="160" height="28" rx="14" />
          <text y={robot === null ? 5 : size * 0.36} className="robot-tag-text" style={{ fontSize: `${(robot === null ? 14 : size).toFixed(2)}px` }}>
            {robot === null ? '?' : short(robot, 22)}
          </text>
        </g>
      </g>
    </g>
  )
}

/* --- value: one literal, and nothing to say which kind --- */

function Value({ text }: { text: string }) {
  const n = Math.max(1, [...text].length)
  // As big as the card allows: a monospace character is 0.6 of its size.
  const size = Math.min(46, 148 / (n * 0.6))
  return (
    <g className="value">
      <g className="value-card">
        <rect x="24" y="18" width="152" height="94" rx="12" className="value-shadow" />
        <rect x="22" y="14" width="152" height="94" rx="12" className="value-face" />
        <text x="98" y={61 + size * 0.36} className="value-text" style={{ fontSize: `${size.toFixed(2)}px` }}>
          {short(text, 16)}
        </text>
      </g>
    </g>
  )
}

/* --- card: words for a person --- */

function Card({ view }: { view: PropView }) {
  const t = textOf(view.answer)
  const lines = t === null ? [] : wrap(t, 12, 3)
  // Words on the card, refused (not the ones asked for): the card is
  // edged in amber, dashed — written, and not handed over.
  return (
    <g className={`card ${refusedOf(view) ? 'refused' : ''}`}>
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
  // Its code typed from memory does not turn the tile: only `ord` looks.
  const waiting = unworked(view)
  // Nor does another character's code: the tile's back is its own code,
  // so a refused int never turns it. The caption says, in amber, that the
  // robot's number is not this letter's.
  const no = refusedOf(view)
  const n = view.answer?.type === 'int' && !waiting && !no ? view.answer.repr : null
  return (
    <g className={`letter ${n !== null ? 'turned' : ''} ${waiting ? 'unworked' : ''} ${no ? 'refused' : ''}`}>
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
        {n !== null ? `"${char}"  →  ${n}` : waiting ? `"${char}"  →  ?` : no ? `"${char}"  ≠  ${short(view.answer!.repr, 6)}` : `"${char}"`}
      </text>
    </g>
  )
}

/* --- shelf: five data types, each in its slot --- */

/** Five slots across the whole picture, as wide as they can be: the
 *  width of a slot is what bounds the type on its chips. Fewer slots
 *  (`slots`) share the same width (`cubbyWidth`). */
const CUBBY_W = cubbyWidth(SLOTS.length)
/** The first chip's top, inside its slot, and the distance between. */
const CHIP_TOP = 19.5
const CHIP_PITCH = 14
const CHIP_H = 13
/** A chip of `n` lines fills the `n` rows it takes. */
const chipH = (n: number) => CHIP_H + (n - 1) * CHIP_PITCH
/** The distance between two lines inside one chip. */
const CHIP_LEADING = 10
/** A chip's inset from its slot's sides. */
const CHIP_X = 1
/** A chip's type: as large as `CHIP_FONT`, and smaller only as far as its
 *  longest line needs to fit across the chip (`CHIP_TEXT_W`, which leaves
 *  2 units clear on each side of the chip's 36.5).
 *
 *  Drawn first by estimate, per character, in the stage's face at the
 *  chips' weight (measured in Chromium's system-ui at 800 and display
 *  size: `"` is 0.47 em, a digit 0.67) — a picture is drawn on the
 *  server in the unit tests too, where there is nothing to measure with.
 *  Then, in a browser, `fitText` measures what the face really drew and
 *  sets the size from that, before paint: an estimate is only ever right
 *  for one face at one size, and the old one ran `"hello"` a pixel past
 *  its chip — at 9px the same face is set in a wider cut. */
const CHIP_FONT = 10.5
const CHIP_TEXT_W = 32.5
const emOf = (text: string): number =>
  [...text].reduce(
    (w, c) =>
      w +
      (/[W%]/.test(c)
        ? 0.98
        : /[Mm@w]/.test(c)
          ? 0.88
          : c === '"'
            ? 0.48
            : /['il.,:;!|j]/.test(c)
              ? 0.28
              : c === ' '
                ? 0.22
                : /[frtI()\[\]{}\/\\]/.test(c)
                  ? 0.41
                  : c === '1'
                    ? 0.5
                    : /[\d]/.test(c)
                      ? 0.67
                      : /[A-Z]/.test(c)
                        ? 0.73
                        : /[-*]/.test(c)
                          ? 0.47
                          : 0.61),
    0,
  )
const chipFont = (lines: string[], width = CHIP_TEXT_W): number => Math.min(CHIP_FONT, ...lines.map((l) => width / Math.max(emOf(l), 0.01)))

/** The char slot's tag: its size, and the width its longer line
 *  (`length 1`) may take across the slot. */
const TAG_FONT = 10.2
const TAG_TEXT_W = 35
/** The least the shelf's type is fitted down to before it is narrowed
 *  instead: 9px on a desktop stage, whose shelf is about 179px across. */
const FIT_MIN = 10.1

/** How far `fitText` may narrow a line's glyphs to keep its type at
 *  `data-min`: 14%, enough for `"hello"` at 9px with 2 units of room
 *  each side, and short of where condensed type stops reading as the
 *  same face. */
const MAX_SQUASH = 0.86

/**
 * Sets each `[data-fit]` group's type from what the browser really drew:
 * as large as its `data-max`, and no wider than its `data-width` (its
 * longest line, measured). Lines that share a group share one size, and a
 * line with `data-mid` is re-centred on it, so a chip's text stays in the
 * middle of the chip at whatever size it ends.
 *
 * A group with a `data-min` that had to shrink below it narrows its lines
 * (`textLength`, at most `MAX_SQUASH`) instead of shrinking them further,
 * as far as the minimum: legible type is the point of the minimum, and a
 * few percent of width is not something a reader sees. `"hello"` keeps
 * the minimum that way; a line that needs more than the narrowing allows
 * (a phone number over two rows) is still shrunk, only less.
 *
 * Written straight to the elements, like `--beat`: this is how the
 * picture is drawn, not state, and it runs before paint.
 */
function fitText(root: SVGGElement | null) {
  if (!root || typeof SVGTextElement === 'undefined' || typeof SVGTextElement.prototype.getComputedTextLength !== 'function') return
  // Every line is measured on a probe that stands in the picture's root,
  // not on the line itself. A chip flies in scaled, and Chromium sets SVG
  // type at its size on screen, so a line measured mid-flight came back
  // wider than it rests (`"hello"` fitted to 7.5px instead of 9). The
  // probe copies the line's face and is gone again before paint.
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  probe.setAttribute('visibility', 'hidden')
  probe.setAttribute('aria-hidden', 'true')
  root.appendChild(probe)
  try {
    for (const g of root.querySelectorAll<SVGGElement>('[data-fit]')) {
      const texts = [...g.querySelectorAll<SVGTextElement>('text')]
      if (!texts.length) continue
      const max = Number(g.dataset['max'])
      const width = Number(g.dataset['width'])
      const min = Number(g.dataset['min'] ?? 0)
      const faces = texts.map((t) => {
        const cs = getComputedStyle(t)
        const spacing = parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize)
        return { family: cs.fontFamily, weight: cs.fontWeight, style: cs.fontStyle, spacing: Number.isFinite(spacing) ? spacing : 0 }
      })
      const measure = (size: number) =>
        texts.map((t, i) => {
          const f = faces[i]!
          probe.style.fontFamily = f.family
          probe.style.fontWeight = f.weight
          probe.style.fontStyle = f.style
          probe.style.letterSpacing = `${f.spacing}em`
          probe.style.fontSize = `${size}px`
          probe.textContent = t.textContent
          return probe.getComputedTextLength()
        })
      // Measured from a known size, so the answer does not depend on the
      // size the last fit left behind. A face's width is not proportional
      // to its size — system faces switch to wider, looser cuts for small
      // type — so the size is refined from a second and third measure
      // rather than scaled once.
      let size = max
      for (let pass = 0; pass < 3; pass++) {
        const longest = Math.max(...measure(size))
        if (!(longest > 0)) break
        if (longest <= width && (size === max || longest > width * 0.985)) break
        size = Math.min(max, (size * width) / longest) * (longest > width ? 0.995 : 1)
      }
      // Shrunk below the minimum: take back what narrowing can, towards
      // the minimum — all of it for `"hello"`, some of it for a phone
      // number.
      let squash: number[] | null = null
      if (size < min) {
        let c = Math.min(min, size / MAX_SQUASH)
        for (let pass = 0; pass < 3 && c > size; pass++) {
          const at = measure(c)
          const longest = Math.max(...at)
          if (longest * MAX_SQUASH <= width) {
            size = c
            squash = at
            break
          }
          c = ((c * width) / (longest * MAX_SQUASH)) * 0.995
        }
      }
      texts.forEach((t, i) => {
        t.style.fontSize = `${size.toFixed(2)}px`
        if (squash && squash[i]! > width) {
          t.setAttribute('textLength', String(width))
          t.setAttribute('lengthAdjust', 'spacingAndGlyphs')
        } else {
          t.removeAttribute('textLength')
          t.removeAttribute('lengthAdjust')
        }
        const mid = t.dataset['mid']
        if (mid !== undefined) t.setAttribute('y', (Number(mid) + size * 0.34).toFixed(2))
      })
    }
  } finally {
    probe.remove()
  }
}

type ShelfRow = { key: string; text: string; cls: string; tag?: boolean }

function Shelf({ view, p }: { view: PropView; p: Extract<Prop, { kind: 'shelf' }> }) {
  const examples = p.examples ?? {}
  const slots = shelfSlots(p)
  // Fewer slots are wider, and their chips hold more before an ellipsis.
  const w = cubbyWidth(slots.length)
  const pitch = w + CUBBY_GAP
  const textW = CHIP_TEXT_W + (w - CUBBY_W)
  const chars = chipChars(slots.length)
  const named = (k: TypeSlot) => p.filled.includes(k)
  // The char slot's tag (`str · length 1`) takes two rows of its own,
  // and a chip too long for one row takes two (`chipLines`); what is
  // left for heard values is `shelfRoom`'s, which the sentence uses too.
  const tagRows = (k: TypeSlot) => (k === 'char' && named(k) ? 2 : 0)
  const s = shelved(p.filled, view.heard, examples, shelfRoom(p.filled, examples), slots)
  // Only the newcomer flies in. A shelf drawn again from nothing — a
  // new element, a remount — shows the others already standing.
  const newest = p.filled[p.filled.length - 1]
  const latest = view.answer ? { slot: slotOf(view.answer, slots), text: chipText(view.answer) } : null
  const isLatest = (slot: TypeSlot, text: string) => latest !== null && latest.slot === slot && latest.text === text
  const rows = (k: TypeSlot): ShelfRow[] => [
    ...s[k].examples.map((e) => ({ key: `x:${e.text}`, text: e.text, cls: `example ${e.said ? 'said' : ''}` })),
    ...(tagRows(k) ? [{ key: 'tag', text: '', cls: '', tag: true }] : []),
    ...s[k].heard.map((h) => ({ key: `h:${h}`, text: h, cls: 'heard' })),
  ]
  const ref = useRef<SVGGElement | null>(null)
  // Every render: a chip's text is what changes between them, and a
  // chip React kept keeps the size the last fit wrote.
  useLayoutEffect(() => fitText(ref.current))
  // And once more when the page's faces have loaded, in case the first
  // measure ran in a fallback.
  useLayoutEffect(() => {
    let live = true
    document.fonts?.ready.then(() => live && fitText(ref.current))
    return () => {
      live = false
    }
  }, [])
  return (
    <g ref={ref} className={`shelf ${p.pulse ? 'pulse' : ''} ${p.cheer ? 'cheer' : ''}`}>
      {p.title && (
        <g className="shelf-title">
          <path d="M 34 7 h 30 M 136 7 h 30" />
          <text x="100" y="10.5">
            Data types
          </text>
        </g>
      )}
      <rect x="-2" y="104" width="204" height="5" rx="2" className="plank" />
      {slots.map((k, i) => {
        const list = rows(k)
        const empty = !named(k) && list.length === 0
        let row = 0
        return (
          <g
            key={k}
            className={`cubby ${named(k) ? 'named' : ''} ${k === newest ? 'fresh' : ''}`}
            data-kind={k}
            transform={`translate(${+(i * pitch).toFixed(3)},16)`}
            style={{ ['--i' as string]: i }}
          >
            <rect width={+w.toFixed(3)} height="88" rx="4" className="cubby-box" />
            {empty ? (
              <text x={w / 2} y="54" className="q">
                ?
              </text>
            ) : (
              <text x={w / 2} y="13.5" className={named(k) ? 'slot-label' : 'q small'}>
                {named(k) ? k : '?'}
              </text>
            )}
            {list.map((r) => {
              const at = row
              const lines = r.tag ? [] : chipLines(r.text, chars)
              row += r.tag ? tagRows(k) : lines.length
              if (row > CHIP_ROWS) return null
              const y = CHIP_TOP + at * CHIP_PITCH
              return r.tag ? (
                <g
                  key={r.key}
                  className="char-tag"
                  transform={`translate(${w / 2},${y})`}
                  style={{ ['--j' as string]: at }}
                  data-fit=""
                  data-max={TAG_FONT}
                  data-min={FIT_MIN}
                  data-width={TAG_TEXT_W}
                >
                  <text y="10.5" style={{ fontSize: `${TAG_FONT}px` }}>
                    str ·
                  </text>
                  <text y="22" style={{ fontSize: `${TAG_FONT}px` }}>
                    length 1
                  </text>
                </g>
              ) : (
                <g
                  key={r.key}
                  className={`chip ${r.cls} ${isLatest(k, r.text) ? 'latest' : ''}`}
                  data-kind={k}
                  transform={`translate(${CHIP_X},${y})`}
                  style={{ ['--j' as string]: at }}
                  data-fit=""
                  data-max={CHIP_FONT}
                  data-min={FIT_MIN}
                  data-width={+textW.toFixed(3)}
                >
                  <rect width={+(w - 2 * CHIP_X).toFixed(3)} height={chipH(lines.length)} rx="6" />
                  {lines.map((l, j) => {
                    // The lines sit together in the middle of the chip, not
                    // a whole row apart, so the last is clear of its edge.
                    const mid = chipH(lines.length) / 2 + (j - (lines.length - 1) / 2) * CHIP_LEADING
                    return (
                      <text
                        key={j}
                        x={+(w / 2 - CHIP_X).toFixed(3)}
                        y={(mid + chipFont(lines, textW) * 0.34).toFixed(2)}
                        data-mid={mid}
                        style={{ fontSize: `${chipFont(lines, textW).toFixed(2)}px` }}
                      >
                        {l}
                      </text>
                    )
                  })}
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
            <rect x="-19" y="-7.5" width="38" height="15" rx="7.5" />
            <text y="3.7">later</text>
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
  // The right number typed by hand has measured nothing: no marker, and
  // an amber `?` over the track where it would have stopped.
  const waiting = unworked(view)
  const n = waiting ? null : numberOf(view.answer)
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
    <g className={`numberline ${waiting ? 'unworked' : ''}`}>
      <rect x="20" y="72" width="160" height="10" rx="5" className="track" />
      {waiting && (
        <text x="100" y="50" className="mark-value unworked-q">
          ?
        </text>
      )}
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

/** A parcel's size, and the gap between two. */
const PW = 32
const PH = 20
const PGAP = 1.5
/** The platform's middle: the parcels stack over it, the readout under. */
const SCALE_X = 135

/**
 * The scale fills the picture: it stands between the robot and Mira in
 * a slot a third of the stage wide, so drawn small in one corner of it
 * (as it was once, a readout 15 units tall) its `kg` could not be read.
 * Now the platform and base take the right three quarters, the readout
 * is the widest thing in the picture, and the parcels wait on the floor
 * to its left, two abreast.
 */
function Scale({ view, parcels, each }: { view: PropView; parcels: number; each: number }) {
  // The right weight said the wrong way is not a weighing: the parcels
  // stay on the floor and the readout asks, in amber, what the reply
  // asks — for the robot to work it out.
  const waiting = unworked(view)
  const n = waiting ? null : numberOf(view.answer)
  const count = clamp(Math.round(parcels), 1, 12)
  // Three abreast on the platform, so each parcel is big enough to read;
  // a fourth column only when three would stack past the picture's top.
  const cols = Math.min(count, count > 9 ? 4 : 3)
  const on = n !== null
  const off = on && Math.abs(n - count * each) > 1e-9
  // Where each parcel stands: on the platform once weighed, stacked in
  // rows of four; waiting on the floor beside it before, two abreast.
  const place = (i: number) =>
    on
      ? ([SCALE_X - (cols * (PW + PGAP)) / 2 + (i % cols) * (PW + PGAP), 74 - PH - Math.floor(i / cols) * (PH + PGAP)] as const)
      : ([1 + (i % 2) * (PW + PGAP), 125 - PH - Math.floor(i / 2) * (PH + PGAP)] as const)
  return (
    <g className={`scale ${on ? 'weighed' : ''} ${off ? 'off' : ''} ${waiting ? 'unworked' : ''}`} style={{ ['--n' as string]: count }}>
      <line x1="0" x2="200" y1="126" y2="126" className="floor" />
      <rect x={SCALE_X - 10} y="78" width="20" height="10" className="post" />
      <rect x={SCALE_X - 65} y="74" width="130" height="6" rx="3" className="platform" />
      <rect x={SCALE_X - 57} y="86" width="114" height="40" rx="6" className="base" />
      <rect x={SCALE_X - 49} y="93" width="98" height="26" rx="4" className="readout" />
      <text x={SCALE_X} y="112.5" className="reading" key={on ? view.answer!.repr : 'none'}>
        {on ? `${short(view.answer!.repr, 6)} kg` : '? kg'}
      </text>
      {Array.from({ length: count }, (_, i) => {
        const [px, py] = place(i)
        return (
          <g key={`${on ? 'on' : 'wait'}:${i}`} transform={`translate(${px},${py})`}>
            <g className="parcel" style={{ ['--i' as string]: i }}>
              <rect width={PW} height={PH} rx="2" />
              {/* As large as 10 units, and smaller only as far as the
                  label needs to sit inside its parcel: `2.5 kg` ran over
                  both edges. A monospace character is 0.6 of its size. */}
              <text x={PW / 2} y={PH / 2 + 3} style={{ fontSize: `${Math.min(10, (PW - 4) / (`${each} kg`.length * 0.6)).toFixed(2)}px` }}>
                {each} kg
              </text>
            </g>
          </g>
        )
      })}
    </g>
  )
}

/* --- code: the block the player is about to read --- */

/**
 * A short block as it would stand in an editor: monospace, on a card,
 * every indent kept and drawn as a faint guide down the lines it holds,
 * so what is inside the `for` is seen to be inside it. The type is as
 * large as the block allows (`codeSize`), and the card is only as tall as
 * the block, standing on the floor like every picture. `mark` lays a band
 * under one line; moving it is narration, so the band slides and the
 * card stays.
 */
function Code({ text, mark }: { text: string; mark: number | undefined }) {
  const lines = codeLines(text)
  const size = codeSize(lines)
  const lh = size * CODE_BOX.lineHeight
  const cw = size * CODE_BOX.charWidth
  const { pad } = CODE_BOX
  const longest = Math.max(1, ...lines.map((l) => [...l].length))
  const w = Math.min(CODE_BOX.width, longest * cw + 2 * pad)
  const h = lines.length * lh + 2 * pad
  const x0 = (CODE_BOX.width - w) / 2
  const y0 = CODE_BOX.height - h
  const baseline = (i: number) => y0 + pad + i * lh + lh / 2 + size * 0.35
  // One guide per indent level, from the header above it to the last
  // line of the block it holds.
  const guides: { level: number; from: number; to: number }[] = []
  lines.forEach((l, i) => {
    const depth = l.trim() === '' ? 0 : indentOf(l)
    for (let level = 1; level <= depth; level++) {
      const open = guides.find((g) => g.level === level && g.to === i - 1)
      if (open) open.to = i
      else guides.push({ level, from: i, to: i })
    }
  })
  const marked = mark !== undefined && mark >= 1 && mark <= lines.length ? mark - 1 : null
  return (
    <g className="code">
      <rect x={x0} y={y0} width={w} height={h} rx="8" className="code-card" />
      {marked !== null && (
        <rect
          x={x0 + 3}
          y={y0 + pad + marked * lh}
          width={w - 6}
          height={lh}
          rx="4"
          className="code-mark"
        />
      )}
      {guides.map((g) => (
        <line
          key={`${g.level}:${g.from}`}
          className="code-guide"
          x1={x0 + pad + (g.level - 1) * 4 * cw + cw * 0.5}
          x2={x0 + pad + (g.level - 1) * 4 * cw + cw * 0.5}
          y1={y0 + pad + g.from * lh + 2}
          y2={y0 + pad + (g.to + 1) * lh - 2}
        />
      ))}
      {lines.map((l, i) => (
        <text
          key={i}
          x={x0 + pad}
          y={baseline(i)}
          className={`code-line ${i === marked ? 'marked' : ''}`}
          style={{ fontSize: `${size}px`, ['--i' as string]: i }}
        >
          {codeTokens(l).map((t, j) => (
            <tspan key={j} className={`tok-${t.kind}`}>
              {t.text}
            </tspan>
          ))}
        </text>
      ))}
    </g>
  )
}

/* --- goal: a memory to make, drawn as a blueprint of one --- */

/**
 * The goal's pieces, in its own base units. The rows are laid out at
 * these sizes and then scaled as one to fill the frame, so a goal of one
 * or two rows reads large and a full one still fits: `most` caps the
 * scale, which puts names at about 13 units, values at 14 and `now:` at
 * 9 when there is room.
 */
const GOAL = {
  /** The box the rows are scaled into, inside the frame: under the
   *  title, over the line kept for extra names. */
  box: { x: 8, y: 20, w: 184, h: 93 },
  most: 1.33,
  nameSize: 10,
  valueSize: 10.5,
  /** A list's slot strip, and the chips its slots point at. */
  slotH: 13,
  slotMin: 18,
  chipSize: 9.5,
  chipH: 13,
  /** From a slot down to its chip; between two lines of a wrapped list. */
  drop: 6,
  line: 5,
  /** Kept under every row for what memory has there instead. */
  now: 9,
  nowSize: 6.6,
  /** A scalar row, an alias row. */
  rowH: 27,
  aliasH: 24,
  cardH: 18,
  pillH: 14,
  /** A monospace character is 0.6 of its size across. */
  char: 0.6,
  arrow: 22,
  gap: 4,
  tick: 6,
  /** Final chip type under which a list wraps onto a second line. */
  readable: 8,
} as const

/** What a row's object is, in words: `3`, or `a list: slot 0 → 3, …`. */
function goalObjectWords(r: GoalShownRow): string {
  if (r.items === null) return reprOf(r.value)
  if (r.items.length === 0) return 'an empty list'
  return `a list: ${r.items.map((it, i) => `index ${i} → ${reprOf(it)}`).join(', ')}`
}

/** What memory has for a row that is not met yet. A `same` row holding
 *  an equal list is holding a copy, which is the thing to say. */
function goalNow(r: GoalShownRow): string | null {
  if (r.have === null) return null
  return r.same !== undefined && r.sameNow === false ? 'a copy' : r.have
}

/** `now:` as the picture writes it: a list compactly, its items without
 *  brackets or quotes (`sword, shield, potion`), since its chips already
 *  show their kind; anything else as the console prints it. */
export function goalNowText(r: GoalShownRow): string | null {
  const now = goalNow(r)
  if (now === null || r.haveType !== 'list' || now === 'a copy') return now
  const items = itemsOf(now)
  return items === null ? now : items.map((it) => it.replace(/^(['"])(.*)\1$/, '$2')).join(', ') || 'empty'
}

/** A goal row's sentence: `x points at 3`, and how memory stands. */
function goalRowSentence(r: GoalShownRow, checked: boolean): string {
  const says =
    r.same !== undefined && (r.alias !== null || r.items === null)
      ? `${r.name} points at the very same ${itemsOf(r.value) ? 'list' : 'object'} as ${r.same}`
      : `${r.name} points at ${goalObjectWords(r)}`
  if (!checked) return says
  if (r.ok) return `${says}: done`
  const now = goalNow(r)
  return now === null ? `${says}: not yet` : `${says}: not yet, ${r.name} points at ${now} now`
}

function goalSentence(view: PropView, p: Extract<Prop, { kind: 'goal' }>): string {
  const g = goalShown(p.goal, view.memory)
  const title = p.title ?? 'Goal'
  const rows = g.rows.map((r) => goalRowSentence(r, g.checked)).join('; ')
  const more = p.goal.length > g.rows.length ? ` And ${p.goal.length - g.rows.length} more.` : ''
  const extra = g.extra.length > 0 ? ` Not in the goal: ${g.extra.join(', ')}.` : ''
  const met = g.met
    ? view.verdict === 'miss'
      ? " The robot's memory looks like it, but was not made the way asked."
      : " The robot's memory matches it."
    : ''
  return `${title}, a memory to make: ${rows}.${more}${extra}${met}`
}

/** How a list row lays out, in base units: every chip under its own
 *  slot, in slot order, on one line — or, as a last resort, when even
 *  with its name above it that would scale the goal down past readable
 *  chips, on two lines, the first half of the slots over the rest, so
 *  the order still reads left to right, top to bottom. */
function goalListShape(items: string[], lines: 1 | 2) {
  const n = Math.max(1, items.length)
  // Each slot as wide as its own item needs, as memory's cards are each
  // as wide as their value: `'bow'` does not take the room of `'potion'`.
  const sws = items.map((it) => Math.max(GOAL.slotMin, [...reprOf(it)].length * GOAL.chipSize * GOAL.char + 6.5))
  const per = Math.ceil(n / lines)
  const lineOf = (j: number) => Math.floor(j / per)
  /** Where slot `j` starts along its line. */
  const xs = sws.map((_, j) => sws.slice(lineOf(j) * per, j).reduce((a, w) => a + w, 0))
  const widths = [...Array(lines).keys()].map((l) => sws.slice(l * per, (l + 1) * per).reduce((a, w) => a + w, 0))
  const lineH = GOAL.slotH + GOAL.drop + GOAL.chipH
  return { sws, xs, per, lines, widths, w: Math.max(0, ...widths), lineH, h: lines * lineH + (lines - 1) * GOAL.line + GOAL.now }
}

/**
 * A goal memory, drawn the way the memory graph draws memory — each
 * name a pill, an arrow, the object it points at a card with its value
 * in its kind's colour — but as a blueprint: dashed, on a faint gridded
 * wash, so it never reads as the robot's own memory. Each row the
 * robot's memory already has fills in solid with a green tick; a name
 * pointing at something else says, in amber under the card, what it
 * points at now; names the goal does not list are an amber line at the
 * foot. A goal met settles once (`.goal.met`, props.css).
 *
 * A list is a card of slots, each showing its index, and each points down at a
 * chip of its own (invariant 4: slots are pointers, so no value is
 * written inside the list). A `same` row draws no object: its arrow
 * converges on the list another row drew, as memory draws aliasing.
 *
 * The rows are spaced by what the goal holds, never by how memory
 * stands, so nothing moves while the player works towards it: the
 * line for extra names, and the room under each row for `now:`, are
 * kept free whether or not there is anything to say.
 */
function GoalMemory({ view, p }: { view: PropView; p: Extract<Prop, { kind: 'goal' }> }) {
  const g = goalShown(p.goal, view.memory)
  const longest = (xs: string[]) => Math.max(1, ...xs.map((x) => [...x].length))
  const fixed = GOAL.gap + GOAL.arrow + GOAL.gap + 5 + GOAL.tick * 2
  const scalars = g.rows.filter((r) => r.items === null && r.alias === null)
  const names = g.rows.map((r) => short(r.name, 12))
  const pillW = Math.max(30, longest(names) * GOAL.nameSize * GOAL.char + 14)
  const values = scalars.map((r) => short(reprOf(r.value), 16))
  const cardW = scalars.length === 0 ? 0 : Math.max(30, longest(values) * GOAL.valueSize * GOAL.char + 14)

  // Laid out in base units, then scaled as one into the frame's box. A
  // list row either sits on the name's line, as the graph draws it, or —
  // when that leaves the goal small — under its name, the arrow turning
  // down into it, which gives the slots the whole width. Whichever
  // scales the goal larger wins, and two lines only as a last resort.
  const listX = pillW + GOAL.gap + GOAL.arrow + GOAL.gap
  // How far a stacked list is set in under its name: room for its own
  // arrow down the left, and for a `same` row's beside it.
  const under = g.rows.some((r) => r.alias !== null) ? 15 : 8
  const layout = (lines: 1 | 2, stacked: boolean) => {
    const shapes = new Map(g.rows.filter((r) => r.items !== null).map((r) => [r.name, goalListShape(r.items!, lines)]))
    const listW = Math.max(0, ...[...shapes.values()].map((s) => s.w))
    const scalarW = scalars.length > 0 || g.rows.some((r) => r.alias !== null) ? pillW + fixed + Math.max(cardW, stacked ? 0 : listW) : 0
    // Stacked, the list's tick goes up on its name's line, so the slots
    // may run the whole width.
    const listRowW = shapes.size === 0 ? 0 : stacked ? Math.max(under + listW + 2, pillW + 5 + GOAL.tick * 2) : listX + listW + 5 + GOAL.tick * 2
    const heights = g.rows.map((r) => {
      const s = shapes.get(r.name)
      if (s) return s.h + (stacked ? GOAL.pillH + GOAL.drop : 0)
      return r.alias !== null ? GOAL.aliasH : GOAL.rowH
    })
    const W = Math.max(scalarW, listRowW, pillW)
    const H = heights.reduce((a, h) => a + h, 0)
    const k = Math.min(GOAL.box.w / W, GOAL.box.h / H, GOAL.most)
    return { shapes, listW, heights, W, H, k, stacked }
  }
  const hasList = g.rows.some((r) => r.items !== null)
  const best = (ls: ReturnType<typeof layout>[]) => ls.reduce((a, b) => (b.k > a.k + 1e-6 ? b : a))
  const oneLine = best(hasList ? [layout(1, false), layout(1, true)] : [layout(1, false)])
  const long = [...oneLine.shapes.values()].some((s) => s.per >= 3)
  // Two lines are a last resort: never for four short items or fewer,
  // which read in order on one.
  const five = g.rows.some((r) => (r.items?.length ?? 0) >= 5)
  const L = hasList && long && (five || oneLine.k * GOAL.chipSize < 6.5) && oneLine.k * GOAL.chipSize < GOAL.readable
    ? best([oneLine, layout(2, false), layout(2, true)])
    : oneLine
  const { shapes, listW, heights, W, H, k, stacked } = L
  const ox = GOAL.box.x + (GOAL.box.w - k * W) / 2
  const oy = GOAL.box.y + (GOAL.box.h - k * H) / 2
  const x0 = 0
  const ax = x0 + pillW + GOAL.gap
  const cx = ax + GOAL.arrow + GOAL.gap
  /** Where a list's slots start, and the ticks' column. */
  const lx = stacked ? under : cx
  const objW = Math.max(cardW, stacked ? 0 : listW)
  const tx = stacked ? W - GOAL.tick - 1 : Math.max(cx + objW, shapes.size > 0 ? lx + listW : 0) + 5 + GOAL.tick
  const tops = heights.map((_, i) => heights.slice(0, i).reduce((a, h) => a + h, 0))
  /** Each row's name line, and for a list its slot strip. */
  const anchor = g.rows.map((r, i) =>
    shapes.has(r.name)
      ? tops[i]! + (stacked ? GOAL.pillH / 2 : GOAL.slotH / 2)
      : tops[i]! + (heights[i]! - (r.alias !== null ? 0 : GOAL.now)) / 2 + 1,
  )
  const strip = g.rows.map((r, i) => (shapes.has(r.name) && stacked ? anchor[i]! + GOAL.pillH / 2 + GOAL.drop + GOAL.slotH / 2 : anchor[i]!))
  const cardH = GOAL.cardH
  const pillH = GOAL.pillH
  /** `now:` at its size, shrunk to fit `w` rather than cut. */
  const nowSize = (text: string, w: number) => Math.min(GOAL.nowSize, w / (Math.max(1, [...text].length) * GOAL.char))

  // A memory that matches, made the way the step refuses (a new list where
  // one slot was to move): drawn refused, in amber, never as a yes
  // (invariant 26) — what the picture says must agree with the crow.
  const refused = g.met && view.verdict === 'miss'
  const met = g.met && !refused
  const grid = [...Array(15).keys()].map((i) => 14 * (i + 1))
  return (
    <g
      className={['goal', g.checked && 'checked', met && 'met', refused && 'refused'].filter(Boolean).join(' ')}
      data-testid="goal"
      data-refused={refused ? 'yes' : 'no'}
    >
      <rect x="3" y="3" width="194" height="124" rx="10" className="goal-wash" />
      <g className="goal-grid">
        {grid
          .filter((x) => x < 197)
          .map((x) => (
            <line key={`v${x}`} x1={x} x2={x} y1="4" y2="126" />
          ))}
        {grid
          .filter((y) => y < 127)
          .map((y) => (
            <line key={`h${y}`} x1="4" x2="196" y1={y} y2={y} />
          ))}
      </g>
      <rect x="3" y="3" width="194" height="124" rx="10" className="goal-frame" />
      <text x="12" y="14" className="goal-title">
        {short(p.title ?? 'Goal', 22)}
      </text>
      {met && (
        <text x="188" y="14" className="goal-done">
          ✓ matches
        </text>
      )}
      {refused && (
        <text x="188" y="14" className="goal-done goal-not-so">
          ? not like that
        </text>
      )}
      <g className="goal-settle">
        <g transform={`translate(${ox.toFixed(2)},${oy.toFixed(2)}) scale(${k.toFixed(4)})`} data-scale={k.toFixed(3)}>
          {g.rows.map((r, i) => {
            const y = anchor[i]!
            const shape = shapes.get(r.name)
            const now = g.checked && !r.ok ? goalNowText(r) : null
            const kind = typeOf(r.value)
            const pill = (
              <>
                <rect x={x0} y={y - pillH / 2} width={pillW} height={pillH} rx={pillH / 2} className="goal-name" />
                <text x={x0 + pillW / 2} y={y + GOAL.nameSize * 0.35} className="goal-name-text" style={{ fontSize: `${GOAL.nameSize}px` }}>
                  {names[i]}
                </text>
              </>
            )
            const tick = g.checked && (
              <g className="goal-tick" transform={`translate(${tx},${stacked ? y : strip[i]!})`}>
                <circle r={GOAL.tick} />
                {r.ok && <path d="M-2.8 0.2 l2 2.1 l3.7 -4.3" />}
              </g>
            )
            const straight = (
              <>
                <line x1={ax} x2={ax + GOAL.arrow - 4} y1={y} y2={y} className="goal-arrow" />
                <path d={`M${ax + GOAL.arrow} ${y} l-5 -3.2 v6.4 z`} className="goal-tip" />
              </>
            )
            // A list under its name: the arrow leaves the pill's foot and
            // turns right into the list's first slot.
            const sy = strip[i]!
            const elbow = (
              <>
                <path d={`M${lx - 5} ${y + GOAL.pillH / 2} V${sy} H${lx - 4}`} className="goal-arrow goal-elbow" />
                <path d={`M${lx} ${sy} l-5 -3.2 v6.4 z`} className="goal-tip" />
              </>
            )
            let object: ReactNode
            // `now:` gets the width of the whole row, from the name to the
            // tick, and shrinks to fit it rather than being cut.
            let nowAt: { x: number; y: number }
            const rowW = tx + GOAL.tick - x0
            if (r.alias !== null) {
              // Converging: the arrow bends to the object another row
              // drew, landing just off that row's own arrowhead.
              const ty = strip[r.alias]! + (r.alias < i ? 3.5 : -3.5)
              const onList = shapes.has(g.rows[r.alias]!.name)
              const ex = (onList ? lx : cx) - 1
              const bx = ax + 2
              // Under a stacked list the arrow runs up the left edge, beside
              // the list's own, and both turn into its first slot.
              const d =
                onList && stacked
                  ? `M${x0 + 3} ${y + (r.alias < i ? -GOAL.pillH / 2 : GOAL.pillH / 2)} V${ty} H${ex - 4}`
                  : `M${bx} ${y} C${bx + GOAL.arrow} ${y} ${ex - GOAL.arrow} ${ty} ${ex - 4} ${ty}`
              object = (
                <>
                  <path d={d} className="goal-arrow goal-alias" />
                  <path d={`M${ex} ${ty} l-5 -3.2 v6.4 z`} className="goal-tip" />
                </>
              )
              nowAt = { x: cx + objW / 2, y: y + 2.4 }
            } else if (shape) {
              const items = r.items!
              const top = sy - GOAL.slotH / 2
              const at = (j: number) => ({ line: Math.floor(j / shape.per), col: j % shape.per })
              const lineTop = (line: number) => top + line * (shape.lineH + GOAL.line)
              object = (
                <>
                  {stacked ? elbow : straight}
                  <g className="goal-list">
                    {shape.widths.map((w, line) =>
                      w > 0 ? <rect key={line} x={lx} y={lineTop(line)} width={w} height={GOAL.slotH} rx="3.5" className="goal-list-card slot-strip" /> : null,
                    )}
                    {items.map((it, j) => {
                      const { line, col } = at(j)
                      const lt = lineTop(line)
                      const sw = shape.sws[j]!
                      const sx = lx + shape.xs[j]!
                      const mid = sx + sw / 2
                      const cw = sw - 4
                      const font = Math.min(GOAL.chipSize, (cw - 3) / (Math.max(1, [...reprOf(it)].length) * GOAL.char))
                      const ct = lt + GOAL.slotH + GOAL.drop
                      const kk = typeOf(it)
                      return (
                        <g key={j} className="goal-slot" data-testid={`goal-slot-${r.name}-${j}`}>
                          {col > 0 && <line x1={sx} x2={sx} y1={lt + 2} y2={lt + GOAL.slotH - 2} className="slot-divider" />}
                          <text x={mid} y={lt + GOAL.slotH / 2 + 2.6} className="slot-index">
                            {j}
                          </text>
                          <line x1={mid} x2={mid} y1={lt + GOAL.slotH} y2={ct - 3} className="goal-arrow goal-slot-arrow" />
                          <path d={`M${mid} ${ct - 0.5} l-2.4 -3.4 h4.8 z`} className="goal-tip" />
                          <rect x={mid - cw / 2} y={ct} width={cw} height={GOAL.chipH} rx="3" className="goal-card goal-chip" data-kind={kk} />
                          <text x={mid} y={ct + GOAL.chipH / 2 + font * 0.35} className="goal-value" data-kind={kk} style={{ fontSize: `${font.toFixed(2)}px` }}>
                            {reprOf(it)}
                          </text>
                        </g>
                      )
                    })}
                  </g>
                </>
              )
              nowAt = { x: x0 + rowW / 2, y: top + shape.h - 2.2 }
            } else {
              object = (
                <>
                  {straight}
                  <rect x={cx} y={y - cardH / 2} width={cardW} height={cardH} rx="5" className="goal-card" data-kind={kind} />
                  <text x={cx + cardW / 2} y={y + GOAL.valueSize * 0.36} className="goal-value" data-kind={kind} style={{ fontSize: `${GOAL.valueSize}px` }}>
                    {values[scalars.indexOf(r)]}
                  </text>
                </>
              )
              nowAt = { x: cx + cardW / 2, y: y + cardH / 2 + 6.8 }
            }
            const nowText = now === null ? null : `now: ${now}`
            const nowW = shape ? rowW : r.alias !== null ? tx - GOAL.tick - cx - 2 : Math.max(cardW + 2 * (cx - ax), cardW)
            return (
              <g
                key={r.name}
                className={['goal-row', r.ok ? 'ok' : 'owed', shape && 'list', r.alias !== null && 'alias'].filter(Boolean).join(' ')}
                data-testid={`goal-row-${r.name}`}
                data-ok={r.ok ? 'yes' : 'no'}
                style={{ ['--i' as string]: i }}
              >
                {pill}
                {object}
                {tick}
                {nowText !== null && (
                  <text x={nowAt.x} y={nowAt.y} className="goal-now" style={{ fontSize: `${nowSize(nowText, nowW).toFixed(2)}px` }}>
                    {nowText}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </g>
      {g.extra.length > 0 && (
        <text x="100" y="124" className="goal-extra" data-testid="goal-extra">
          not in the goal: {short(g.extra.join(', '), 30)}
        </text>
      )}
    </g>
  )
}

/* --- hotbar: a list of strs, seen, as a game keeps them --- */

/** The hotbar's frame and cells, in the picture's units. Everything sits
 *  above y = 116, clear of the answer tag over the picture's foot. */
// `most` lets a short bar use the picture's width: three items at 34 units
// a cell read as a thumbnail on the stage.
const HOTBAR = { foot: 116, number: 13, width: 190, pad: 5, gap: 4, most: 58 } as const

/** Each item's icon, drawn in a 20 × 20 box centred on 0, 0: flat shapes
 *  in friendly colours, nobody's game art. */
const ICONS: Record<(typeof HOTBAR_ICONS)[number], ReactNode> = {
  sword: (
    <>
      <path d="M6.5 -8.5 L8.5 -8.5 L8.5 -6.5 L-2 4 L-4 2 Z" className="i-steel" />
      <path d="M-6 0 L0 6 L-1.4 7.4 L-7.4 1.4 Z" className="i-wood" />
      <path d="M-4.2 4.2 L-7.6 7.6" className="i-grip" />
      <circle cx="-8" cy="8" r="1.5" className="i-gold" />
    </>
  ),
  shield: (
    <>
      <path d="M0 -8.5 L7.5 -5.5 C7.5 2 4.5 6.5 0 9 C-4.5 6.5 -7.5 2 -7.5 -5.5 Z" className="i-blue" />
      <path d="M0 -8.5 L0 9 C-4.5 6.5 -7.5 2 -7.5 -5.5 Z" className="i-blue-dark" />
      <path d="M-3 -1 L3 -1 M0 -4 L0 3" className="i-mark" />
    </>
  ),
  potion: (
    <>
      <rect x="-2.2" y="-9" width="4.4" height="3" rx="1" className="i-wood" />
      <path d="M-2 -6 L2 -6 L2 -2.5 C5.5 -1 7 1.5 7 3.8 C7 7.2 4 9 0 9 C-4 9 -7 7.2 -7 3.8 C-7 1.5 -5.5 -1 -2 -2.5 Z" className="i-glass" />
      <path d="M-6.4 3 C-3 1.8 3 4.4 6.4 3 C6.8 6.5 4 8.2 0 8.2 C-4 8.2 -6.8 6.5 -6.4 3 Z" className="i-red" />
      <circle cx="-2.6" cy="1.2" r="1" className="i-shine" />
    </>
  ),
  bow: (
    <>
      <path d="M-4 -9 C5 -6 5 6 -4 9" className="i-bow" />
      <path d="M-4 -9 L-4 9" className="i-string" />
      <path d="M-8 0 L6 0" className="i-shaft" />
      <path d="M8.5 0 L5.5 -2 L5.5 2 Z" className="i-steel" />
    </>
  ),
  map: (
    <>
      <path d="M-8.5 -6 L-3 -8 L3 -6 L8.5 -8 L8.5 6 L3 8 L-3 6 L-8.5 8 Z" className="i-paper" />
      <path d="M-3 -8 L-3 6 M3 -6 L3 8" className="i-fold" />
      <path d="M-6 4 C-3 1 0 3 2 -1" className="i-route" />
      <path d="M3.5 -3.5 L6.5 -0.5 M6.5 -3.5 L3.5 -0.5" className="i-x" />
    </>
  ),
  gem: (
    <>
      <path d="M-5 -6.5 L5 -6.5 L8.5 -2 L0 8.5 L-8.5 -2 Z" className="i-gem" />
      <path d="M-8.5 -2 L8.5 -2 M-2.5 -6.5 L-3.5 -2 L0 8.5 L3.5 -2 L2.5 -6.5" className="i-facet" />
    </>
  ),
  key: (
    <>
      <circle cx="-4.5" cy="-4.5" r="3.8" className="i-key" />
      <circle cx="-4.5" cy="-4.5" r="1.4" className="i-hole" />
      <path d="M-1.8 -1.8 L7 7 M4 4 L6.2 1.8 M6 6 L8.2 3.8" className="i-key-line" />
    </>
  ),
  apple: (
    <>
      <path d="M0 -3.5 C3 -6 8 -5 8 0.5 C8 5.5 4.5 9 2.2 8.6 C1 8.4 -1 8.4 -2.2 8.6 C-4.5 9 -8 5.5 -8 0.5 C-8 -5 -3 -6 0 -3.5 Z" className="i-red" />
      <path d="M0 -3.5 L1 -8" className="i-stem" />
      <path d="M1.2 -6.5 C3 -9 6 -8.5 6.5 -7.5 C5 -5.5 2.5 -5.5 1.2 -6.5 Z" className="i-leaf" />
      <circle cx="-4" cy="-0.5" r="1.2" className="i-shine" />
    </>
  ),
  torch: (
    <>
      <path d="M-1.6 -1 L1.6 -1 L1 9 L-1 9 Z" className="i-wood" />
      <rect x="-2.6" y="-2.5" width="5.2" height="2.2" rx="0.8" className="i-steel" />
      <path d="M0 -9.5 C3.5 -6 4 -4.5 2.8 -3 L-2.8 -3 C-4 -4.5 -3 -6.5 0 -9.5 Z" className="i-flame" />
      <path d="M0 -7 C1.6 -5.4 1.8 -4.4 1.2 -3.4 L-1.2 -3.4 C-1.6 -4.4 -1 -5.6 0 -7 Z" className="i-flame-core" />
    </>
  ),
  helmet: (
    <>
      <path d="M-8 3 C-8 -4 -4.5 -8 0 -8 C4.5 -8 8 -4 8 3 L8 6 L-8 6 Z" className="i-steel" />
      <rect x="-6" y="-1" width="12" height="2.6" rx="1.2" className="i-visor" />
      <path d="M0 -8 L0 -3" className="i-ridge" />
      <rect x="-9" y="5" width="18" height="2.8" rx="1.2" className="i-gold" />
    </>
  ),
  coin: (
    <>
      <circle r="8" className="i-gold" />
      <circle r="5.4" className="i-coin-rim" />
      <path d="M0 -3.2 L0.9 -1 L3.2 -1 L1.4 0.5 L2 2.8 L0 1.5 L-2 2.8 L-1.4 0.5 L-3.2 -1 L-0.9 -1 Z" className="i-coin-star" />
    </>
  ),
  pickaxe: (
    <>
      <path d="M-5.5 7.5 L4 -2" className="i-handle" />
      <path d="M-4 -6.5 C0 -9.5 6 -7.5 8.5 -3 C6 -4.5 3.5 -5 1.5 -4.5 L-0.5 -2.5 L-2.5 -4.5 C-2.5 -5.2 -3.2 -6 -4 -6.5 Z" className="i-steel" />
    </>
  ),
}

const hasIcon = (item: string): item is (typeof HOTBAR_ICONS)[number] => (HOTBAR_ICONS as readonly string[]).includes(item)

/** `a sword`, `an apple`. */
const anItem = (item: string) => `${/^[aeiou]/i.test(item) ? 'an' : 'a'} ${item}`

const SLOT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six']

function hotbarSentence(view: PropView, p: Extract<Prop, { kind: 'hotbar' }>): string {
  const items = p.items.slice(0, HOTBAR_MAX)
  const count = SLOT_WORDS[items.length] ?? String(items.length)
  const held = items.map((it, i) => (i === 0 ? `index 0 holds ${anItem(it)}` : `index ${i} ${anItem(it)}`)).join(', ')
  const picked = p.mark !== undefined && items[p.mark] !== undefined ? ` Index ${p.mark} is selected.` : ''
  const a = view.answer
  const lit = hotbarLit(p, a)
  const said =
    a === null || textOf(a) === null ? '' : lit !== null ? ` The robot's ${a.repr} lights index ${lit}.` : ` No slot holds ${a.repr}.`
  return `A hotbar of ${count} slot${items.length === 1 ? '' : 's'}${items.length > 0 ? `: ${held}` : ''}.${picked}${said}`
}

/**
 * A game's hotbar: a dark rounded bar of square cells with a soft bevel,
 * an item in each, and each slot's number under its cell in a list's
 * slot style. The selected slot (`mark`) lifts and wears a bright frame;
 * the frame is one element that slides to the next slot when `mark`
 * moves. An item is keyed by its slot and its name, so a beat that swaps
 * one mounts a new item in that cell and it pops in, while the rest stay.
 * A str the robot thinks of that one cell holds lights that cell.
 */
function Hotbar({ view, p }: { view: PropView; p: Extract<Prop, { kind: 'hotbar' }> }) {
  const items = p.items.slice(0, HOTBAR_MAX)
  const n = Math.max(1, items.length)
  const c = Math.min(HOTBAR.most, (HOTBAR.width - 2 * HOTBAR.pad - (n - 1) * HOTBAR.gap) / n)
  const barW = n * c + (n - 1) * HOTBAR.gap + 2 * HOTBAR.pad
  const barH = c + 2 * HOTBAR.pad
  const bx = (200 - barW) / 2
  const by = HOTBAR.foot - HOTBAR.number - 3 - barH
  const cellX = (i: number) => bx + HOTBAR.pad + i * (c + HOTBAR.gap)
  const cy = by + HOTBAR.pad
  const lit = hotbarLit(p, view.answer)
  const no = refusedOf(view)
  const picked = p.mark !== undefined && p.mark >= 0 && p.mark < items.length ? p.mark : null
  const icon = c * 0.58
  // The name grows with its cell, as far as it fits across it.
  const name = (it: string) => Math.min(c * 0.2, (c - 4) / (Math.max(1, [...it].length) * 0.6))
  return (
    <g className={no ? 'hotbar refused' : 'hotbar'}>
      <rect x={bx} y={by} width={barW} height={barH} rx="7" className="hotbar-frame" />
      {items.map((it, i) => {
        const x = cellX(i)
        const known = hasIcon(it)
        const word = short(it, Math.max(3, Math.floor((c - 5) / (Math.max(6, c * 0.16) * 0.6))))
        return (
          <g
            key={i}
            className={['hotbar-slot', picked === i && 'marked', lit === i && 'lit'].filter(Boolean).join(' ')}
            data-testid={`hotbar-${i}`}
            data-marked={picked === i ? 'yes' : undefined}
            data-lit={lit === i ? 'yes' : undefined}
            style={{ ['--i' as string]: i }}
          >
            <g className="hotbar-lift">
              <rect x={x} y={cy} width={c} height={c} rx="4" className="hotbar-cell" />
              <path d={`M${x + 1.5} ${cy + c - 2} L${x + 1.5} ${cy + 3} Q${x + 1.5} ${cy + 1.5} ${x + 3} ${cy + 1.5} L${x + c - 2} ${cy + 1.5}`} className="hotbar-bevel" />
              <g key={`${i}:${it}`} className="hotbar-item" data-item={it}>
                {known ? (
                  <>
                    <g transform={`translate(${x + c / 2},${cy + c * 0.4}) scale(${icon / 20})`} className="icon">
                      {ICONS[it]}
                    </g>
                    <text x={x + c / 2} y={cy + c - 2.6} className="hotbar-name" style={{ fontSize: `${name(it).toFixed(2)}px` }}>
                      {it}
                    </text>
                  </>
                ) : (
                  <>
                    <rect x={x + 3} y={cy + c / 2 - c * 0.18} width={c - 6} height={c * 0.36} rx="2.5" className="hotbar-tile" />
                    <text x={x + c / 2} y={cy + c / 2 + c * 0.07} className="hotbar-word" style={{ fontSize: `${Math.min(c * 0.2, (c - 8) / (Math.max(1, [...word].length) * 0.6)).toFixed(2)}px` }}>
                      {word}
                    </text>
                  </>
                )}
              </g>
            </g>
            <g className="hotbar-number">
              <rect x={x + c / 2 - 8} y={HOTBAR.foot - HOTBAR.number} width="16" height={HOTBAR.number} rx="3" className="slot-strip" />
              <text x={x + c / 2} y={HOTBAR.foot - 3.6} className="slot-index" style={{ fontSize: '9px' }}>
                {i}
              </text>
            </g>
          </g>
        )
      })}
      {picked !== null && (
        <rect x={cellX(picked) - 2} y={cy - 2} width={c + 4} height={c + 4} rx="5.5" className="hotbar-select" data-testid="hotbar-select" />
      )}
    </g>
  )
}

/* --- backpack: a list of strs, carried --- */

/** The pack's pieces, in the picture's units. Its indexes end above
 *  y = 116, clear of the answer tag over the picture's foot. */
const PACK = { x: 8, w: 184, top: 26, body: 30, bottom: 100, pocketTop: 52, pocketH: 42, foot: 116, number: 12, gap: 3, side: 8 } as const

function backpackSentence(view: PropView, p: Extract<Prop, { kind: 'backpack' }>): string {
  const items = p.items.slice(0, BACKPACK_MAX)
  const count = SLOT_WORDS[items.length] ?? String(items.length)
  const held = items.map((it, i) => (i === 0 ? `index 0 holds ${anItem(it)}` : `index ${i} ${anItem(it)}`)).join(', ')
  const lifted = p.mark !== undefined && items[p.mark] !== undefined ? ` The item at index ${p.mark} is lifted out.` : ''
  const a = view.answer
  let said = ''
  if (a !== null && unworked(view)) said = ` The robot thought of ${a.repr}, but it has not counted them yet.`
  else if (a !== null && textOf(a) !== null) {
    const lit = backpackLit(p, a)
    said = lit !== null ? ` The robot's ${a.repr} lights index ${lit}.` : ` No pocket holds ${a.repr}.`
  } else if (a !== null && a.type === 'int') {
    const ticks = backpackTicks(view)
    said = ` The robot counts ${a.repr} thing${a.repr === '1' ? '' : 's'}${ticks !== null && ticks > 0 ? `, ticking ${ticks === items.length && Number(a.repr) === ticks ? 'every pocket' : `${ticks} pocket${ticks === 1 ? '' : 's'}`}` : ''}.`
  }
  return `A backpack with ${count} pocket${items.length === 1 ? '' : 's'}${items.length > 0 ? `: ${held}` : ''}.${lifted}${said}`
}

/**
 * An open adventure backpack: a canvas body, its flap thrown back over
 * the top with the buckle hanging, two straps, and across its front a
 * row of stitched pockets, one per item, each item peeking out of its
 * pocket with its name under it. Each pocket's number stands under the
 * pack in a list's slot style.
 *
 * `mark` lifts that item out of its pocket and lights the pocket and its
 * number; the light is per pocket and eases, so moving `mark` moves it.
 * An item is keyed by its pocket and name, so a swapped one pops in. An
 * int answer is a count: a tag over the pack says how many things, and
 * that many pockets get a tick, in order; the right count typed by hand
 * (`unworked`) ticks nothing and the tag waits with an amber `?`.
 */
function Backpack({ view, p }: { view: PropView; p: Extract<Prop, { kind: 'backpack' }> }) {
  const items = p.items.slice(0, BACKPACK_MAX)
  const n = Math.max(1, items.length)
  const inner = PACK.w - 2 * PACK.side
  const pw = (inner - (n - 1) * PACK.gap) / n
  const px = (i: number) => PACK.x + PACK.side + i * (pw + PACK.gap)
  const lit = backpackLit(p, view.answer)
  const no = refusedOf(view)
  const idle = unworked(view)
  const ticks = backpackTicks(view)
  const a = view.answer
  const counting = a !== null && a.type === 'int'
  const picked = p.mark !== undefined && p.mark >= 0 && p.mark < items.length ? p.mark : null
  const icon = Math.min(20, pw * 0.62)
  const nameSize = (it: string) => Math.min(7, (pw - 3) / (Math.max(1, [...it].length) * 0.6))
  const cx = PACK.x + PACK.w / 2
  return (
    <g className={['backpack', no && 'refused', idle && 'unworked'].filter(Boolean).join(' ')}>
      {/* Straps behind the body, looping over the top. */}
      <path d={`M${cx - 46} ${PACK.body + 4} C${cx - 46} ${PACK.top - 22} ${cx + 46} ${PACK.top - 22} ${cx + 46} ${PACK.body + 4}`} className="pack-handle" />
      <rect x={PACK.x} y={PACK.body} width={PACK.w} height={PACK.bottom - PACK.body} rx="14" className="pack-body" />
      <rect x={PACK.x + 4} y={PACK.bottom - 8} width={PACK.w - 8} height="8" rx="4" className="pack-base" />
      {/* The flap, thrown open over the top, its buckle hanging. */}
      <path
        d={`M${PACK.x + 18} ${PACK.body + 2} C${PACK.x + 22} ${PACK.top - 6} ${PACK.x + PACK.w - 22} ${PACK.top - 6} ${PACK.x + PACK.w - 18} ${PACK.body + 2} Z`}
        className="pack-flap"
      />
      <rect x={cx - 5} y={PACK.body - 2} width="10" height="16" rx="2" className="pack-strap" />
      <rect x={cx - 7} y={PACK.body + 12} width="14" height="9" rx="2" className="pack-buckle" />
      <rect x={cx - 3.5} y={PACK.body + 14.5} width="7" height="4" rx="1" className="pack-buckle-hole" />
      <line x1={PACK.x + 10} x2={PACK.x + PACK.w - 10} y1={PACK.body + 6} y2={PACK.body + 6} className="pack-seam" />
      {counting && (
        <g className={['pack-count', idle && 'waiting', ticks === items.length && Number(a!.repr) === items.length && !idle && 'all'].filter(Boolean).join(' ')} data-testid="pack-count">
          <rect x={PACK.x + PACK.w - 58} y="2" width="56" height="15" rx="7.5" />
          <text x={PACK.x + PACK.w - 30} y="12.6">
            {idle ? '? things' : `${short(a!.repr, 4)} thing${a!.repr === '1' ? '' : 's'}`}
          </text>
        </g>
      )}
      {items.map((it, i) => {
        const x = px(i)
        const known = hasIcon(it)
        const word = short(it, Math.max(3, Math.floor((pw - 6) / (6 * 0.6))))
        const ticked = ticks !== null && i < ticks
        return (
          <g
            key={i}
            className={['pack-pocket', picked === i && 'marked', lit === i && 'lit', ticked && 'ticked'].filter(Boolean).join(' ')}
            data-testid={`pocket-${i}`}
            data-marked={picked === i ? 'yes' : undefined}
            data-lit={lit === i ? 'yes' : undefined}
            data-ticked={ticked ? 'yes' : undefined}
            style={{ ['--i' as string]: i }}
          >
            <rect x={x} y={PACK.pocketTop} width={pw} height={PACK.pocketH} rx="5" className="pocket-back" />
            {/* The item, peeking out over the pocket's lip; lifted when marked. */}
            <g className="pocket-lift">
              <g key={`${i}:${it}`} className="pocket-item" data-item={it}>
                {known ? (
                  <g transform={`translate(${x + pw / 2},${PACK.pocketTop + 11}) scale(${icon / 20})`} className="icon">
                    {ICONS[it]}
                  </g>
                ) : (
                  <>
                    <rect x={x + 2} y={PACK.pocketTop + 4} width={pw - 4} height="12" rx="2.5" className="hotbar-tile" />
                    <text x={x + pw / 2} y={PACK.pocketTop + 12.2} className="hotbar-word" style={{ fontSize: `${Math.min(7, (pw - 6) / (Math.max(1, [...word].length) * 0.6)).toFixed(2)}px` }}>
                      {word}
                    </text>
                  </>
                )}
              </g>
            </g>
            <path
              d={`M${x} ${PACK.pocketTop + 18} H${x + pw} V${PACK.pocketTop + PACK.pocketH - 5} Q${x + pw} ${PACK.pocketTop + PACK.pocketH} ${x + pw - 5} ${PACK.pocketTop + PACK.pocketH} H${x + 5} Q${x} ${PACK.pocketTop + PACK.pocketH} ${x} ${PACK.pocketTop + PACK.pocketH - 5} Z`}
              className="pocket-front"
            />
            <path d={`M${x + 2.5} ${PACK.pocketTop + 20.5} H${x + pw - 2.5}`} className="pocket-stitch" />
            {known && (
              <text x={x + pw / 2} y={PACK.pocketTop + PACK.pocketH - 6} className="pocket-name" style={{ fontSize: `${nameSize(it).toFixed(2)}px` }}>
                {it}
              </text>
            )}
            {ticked && (
              <g className="pocket-tick" transform={`translate(${x + pw - 5},${PACK.pocketTop + 22.5})`}>
                <circle r="4" />
                <path d="M-2 0.1 l1.4 1.5 l2.6 -3" />
              </g>
            )}
            <g className="pocket-number">
              <rect x={x + pw / 2 - 8} y={PACK.foot - PACK.number} width="16" height={PACK.number} rx="3" className="slot-strip" />
              <text x={x + pw / 2} y={PACK.foot - 3.2} className="slot-index" style={{ fontSize: '8.5px' }}>
                {i}
              </text>
            </g>
          </g>
        )
      })}
    </g>
  )
}

/* --- more icons: the status panel's, the fork's ends --- */

/** Icons the hotbar has no item for, drawn in the same 20 × 20 box centred
 *  on 0, 0 and the same flat colours. */
const MORE_ICONS = {
  heart: <path d="M0 8.5 C-5 4.6 -9 1.6 -9 -3 C-9 -6.4 -6.4 -8.6 -3.6 -8.6 C-1.8 -8.6 -0.6 -7.6 0 -6.2 C0.6 -7.6 1.8 -8.6 3.6 -8.6 C6.4 -8.6 9 -6.4 9 -3 C9 1.6 5 4.6 0 8.5 Z" className="i-red" />,
  star: <path d="M0 -9 L2.6 -3.2 L8.8 -2.6 L4.1 1.5 L5.5 7.8 L0 4.5 L-5.5 7.8 L-4.1 1.5 L-8.8 -2.6 L-2.6 -3.2 Z" className="i-gold" />,
  tag: (
    <>
      <path d="M-9 -5 L5 -5 L9.5 0 L5 5 L-9 5 Z" className="i-paper" />
      <circle cx="5" cy="0" r="1.4" className="i-hole" />
      <path d="M-6.5 -1.4 H1.5 M-6.5 1.6 H-1" className="i-fold" />
    </>
  ),
  tile: (
    <>
      <rect x="-8" y="-8" width="16" height="16" rx="3.5" className="i-tile" />
      <circle r="2.4" className="i-tile-dot" />
    </>
  ),
  torchOff: (
    <>
      <path d="M-1.6 -1 L1.6 -1 L1 9 L-1 9 Z" className="i-wood" />
      <rect x="-2.6" y="-2.5" width="5.2" height="2.2" rx="0.8" className="i-steel" />
      <path d="M0 -4 C-1.5 -5.5 1.5 -6.5 0 -8.5" className="i-smoke" />
    </>
  ),
  boots: (
    <>
      <path d="M-7 -8 L-1 -8 L-1 2 L6 3.5 C8 4 8.6 5.4 8.6 7 L8.6 8.5 L-7 8.5 Z" className="i-wood" />
      <path d="M-7 5.6 H8.6" className="i-grip" />
      <path d="M-9 -2 H-5 M-10 1 H-5.5" className="i-speed" />
    </>
  ),
  sneak: (
    <>
      <ellipse cx="-4" cy="3.5" rx="2.6" ry="4" className="i-print" />
      <ellipse cx="4" cy="-3.5" rx="2.6" ry="4" className="i-print" />
      <circle cx="-4" cy="-2.2" r="1.1" className="i-print" />
      <circle cx="4" cy="-9" r="1.1" className="i-print" />
    </>
  ),
  campfire: (
    <>
      <path d="M-8 7 L8 3 M-8 3 L8 7" className="i-logs" />
      <path d="M0 -9 C4.5 -4.5 5.5 -1 4 2.5 L-4 2.5 C-5.5 -1 -4 -5 0 -9 Z" className="i-flame" />
      <path d="M0 -4.5 C2 -2.5 2.4 -0.8 1.6 1.8 L-1.6 1.8 C-2.4 -0.8 -1.6 -2.6 0 -4.5 Z" className="i-flame-core" />
    </>
  ),
  door: (
    <>
      <path d="M-6.5 9 V-4 C-6.5 -7.5 -3.5 -9.5 0 -9.5 C3.5 -9.5 6.5 -7.5 6.5 -4 V9 Z" className="i-wood" />
      <path d="M-2 -8.8 V9 M2 -8.8 V9" className="i-fold" />
      <circle cx="3.6" cy="1.5" r="1.1" className="i-gold" />
    </>
  ),
  sign: (
    <>
      <path d="M-1 -2 V9" className="i-grip" />
      <rect x="-8.5" y="-8.5" width="17" height="8" rx="1.6" className="i-wood" />
      <path d="M-5.5 -4.5 H5.5" className="i-fold" />
    </>
  ),
} as const

/** An icon by name, the hotbar's or one of these. */
function Icon({ name }: { name: string }) {
  if (hasIcon(name)) return <>{ICONS[name]}</>
  return <>{MORE_ICONS[name as keyof typeof MORE_ICONS] ?? MORE_ICONS.tile}</>
}

/** A literal's kind, for its colour: `literalKind`, or none for anything
 *  that is not a literal it knows (a name, a list). */
const kindOfLiteral = (text: string): string => (/^\[.*\]$/s.test(text.trim()) ? 'other' : literalKind(text))

/** How wide a run of monospace text is, at a size. */
const monoW = (text: string, size: number) => [...text].length * size * 0.6

/* --- hud: a game's status panel, the names a condition reads --- */

const HUD = { w: 146, top: 2, bottom: 115, pad: 5, badgeX: 151, badgeW: 47 } as const

function hudValueWords(name: string, value: string): string {
  const items = itemsOf(value)
  if (items !== null) return `${name} holds ${items.length === 0 ? 'nothing' : items.map((i) => i.replace(/^(['"])(.*)\1$/, '$2')).join(' and ')}`
  return `${name} is ${value}`
}

function hudSentence(view: PropView, p: Extract<Prop, { kind: 'hud' }>): string {
  const stats = p.stats.slice(0, HUD_ROWS)
  const marked = stats.filter((s) => p.mark?.includes(s.name)).map((s) => s.name)
  const b = boolOf(view.answer)
  const said = b === null ? '' : view.verdict === 'miss' ? ` The robot says ${view.answer!.repr}, not taken.` : ` The robot says ${view.answer!.repr}.`
  return `A status panel${p.title ? `, ${p.title}` : ''}: ${stats.map((s) => hudValueWords(s.name, s.value)).join(', ')}.${
    marked.length ? ` The question reads ${marked.join(' and ')}.` : ''
  }${said}`
}

/**
 * A game's status panel: a dark rounded panel, one row per stat, each a
 * big icon (`hudIcon`), the name in code font, and the value on a chip in
 * its kind's colour; a list's items as their own icons. `mark` frames the
 * rows a condition reads. The right of the picture is kept for the
 * robot's verdict: a big `True` or `False` badge, or `?` while asked.
 * Without either, the panel stands in the middle, and slides aside when
 * a badge needs the room.
 */
function Hud({ view, p }: { view: PropView; p: Extract<Prop, { kind: 'hud' }> }) {
  const stats = p.stats.slice(0, HUD_ROWS)
  const n = Math.max(1, stats.length)
  const b = boolOf(view.answer)
  const asked = view.ask !== undefined && view.answer === null
  const room = b !== null || asked
  const x0 = room ? 2 : (200 - HUD.w) / 2
  const th = p.title ? 15 : 0
  const areaTop = HUD.top + HUD.pad + th
  const area = HUD.bottom - HUD.pad - areaTop
  const rowH = Math.min(34, area / n)
  const rowsTop = areaTop + (area - rowH * n) / 2
  const icon = Math.min(rowH * 0.8, 27)
  const nameX = 6 + icon + 5
  const valueRight = HUD.w - 6
  // One size for every value and every name, so the rows read as a table.
  const listy = (v: string) => itemsOf(v)
  const valueSize0 = Math.min(rowH * 0.5, 14)
  const valueW = (v: string, size: number) => {
    const items = listy(v)
    return items !== null ? Math.max(1, items.length) * (Math.min(rowH * 0.66, 17) + 2) : monoW(v, size) + 8
  }
  const longestName = Math.max(1, ...stats.map((s) => [...s.name].length))
  const widest = Math.max(0, ...stats.map((s) => valueW(s.value, valueSize0)))
  const nameSize = Math.min(rowH * 0.46, 13, (valueRight - widest - 6 - nameX) / (longestName * 0.6))
  const marked = new Set(p.mark ?? [])
  const no = b !== null && refusedOf(view)
  return (
    <g className={['hud', no && 'refused'].filter(Boolean).join(' ')}>
      <g className="hud-panel" style={{ translate: `${x0}px 0px` }}>
        <rect x="0" y={HUD.top} width={HUD.w} height={HUD.bottom - HUD.top} rx="9" className="hud-frame" />
        {p.title && (
          <text x={HUD.w / 2} y={HUD.top + 13} className="hud-title">
            {short(p.title, 22)}
          </text>
        )}
        {stats.map((s, i) => {
          const y = rowsTop + i * rowH
          const cy = y + rowH / 2
          const kind = hudIcon(s.name, s.value)
          const truth = literalBool(s.value)
          const items = listy(s.value)
          const bar = kind === 'heart' ? hudBar(s.value) : null
          const nameEnd = nameX + monoW(s.name, nameSize)
          // A value too long for its room is cut, as the hotbar cuts a word.
          const room = valueRight - nameEnd - 8
          const vSize = Math.min(valueSize0, Math.max(7.5, (room - 8) / (Math.max(1, [...s.value].length) * 0.6)))
          const shown = short(s.value, Math.max(3, Math.floor((room - 8) / (vSize * 0.6) + 0.01)))
          const vw = items !== null ? 0 : monoW(shown, vSize) + 8
          const barX = nameEnd + 5
          const barW = valueRight - vw - 5 - barX
          const iconName = kind === 'torch' ? (truth === true ? 'torch' : 'torchOff') : kind === 'items' ? 'tile' : kind
          return (
            <g
              key={s.name}
              className={['hud-row', marked.has(s.name) && 'marked', truth === false && 'off'].filter(Boolean).join(' ')}
              data-testid={`hud-${s.name}`}
              data-marked={marked.has(s.name) ? 'yes' : undefined}
              style={{ ['--i' as string]: i }}
            >
              <rect x="4" y={y + 1.5} width={HUD.w - 8} height={rowH - 3} rx="5" className="hud-cell" />
              {kind !== 'items' && (
                <g transform={`translate(${6 + icon / 2},${cy}) scale(${icon / 20})`} className={`icon hud-icon ${kind === 'key' && truth === false ? 'ghost' : ''}`} data-icon={kind}>
                  <Icon name={iconName} />
                </g>
              )}
              {kind === 'items' && (
                <g transform={`translate(${6 + icon / 2},${cy}) scale(${icon / 20})`} className="icon hud-icon" data-icon="items">
                  <Icon name="tile" />
                </g>
              )}
              <text x={nameX} y={cy + nameSize * 0.35} className="hud-name" style={{ fontSize: `${nameSize.toFixed(2)}px` }}>
                {s.name}
              </text>
              {bar !== null && barW >= 16 && (
                <g className="hud-bar">
                  <rect x={barX} y={cy - 3} width={barW} height="6" rx="3" className="hud-bar-track" />
                  <rect x={barX} y={cy - 3} width={(barW * bar).toFixed(2)} height="6" rx="3" className="hud-bar-fill" />
                </g>
              )}
              {items !== null ? (
                <g className="hud-items" key={s.value}>
                  {items.map((it, k) => {
                    const size = Math.min(rowH * 0.66, 17)
                    const word = it.replace(/^(['"])(.*)\1$/, '$2')
                    const x = valueRight - (items.length - k - 0.5) * (size + 2)
                    return (
                      <g key={k} transform={`translate(${x.toFixed(2)},${cy}) scale(${(size / 20).toFixed(3)})`} className="icon">
                        {hasIcon(word) ? (
                          ICONS[word]
                        ) : (
                          <>
                            <rect x="-9" y="-9" width="18" height="18" rx="3" className="i-tile" />
                            <text y="4" className="hud-item-word">
                              {[...word].slice(0, 2).join('')}
                            </text>
                          </>
                        )}
                      </g>
                    )
                  })}
                </g>
              ) : (
                <g className="hud-value" data-kind={kindOfLiteral(s.value)} key={s.value}>
                  <rect x={valueRight - vw} y={cy - vSize * 0.72} width={vw} height={vSize * 1.44} rx={vSize * 0.4} />
                  <text x={valueRight - vw / 2} y={cy + vSize * 0.36} style={{ fontSize: `${vSize.toFixed(2)}px` }}>
                    {shown}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </g>
      {b !== null ? (
        <g className={`hud-badge ${no ? 'refused' : ''}`} data-testid="hud-badge" key={view.answer!.repr}>
          <rect x={HUD.badgeX} y="34" width={HUD.badgeW} height="48" rx="11" />
          <text x={HUD.badgeX + HUD.badgeW / 2} y="62.5">
            {b ? 'True' : 'False'}
          </text>
        </g>
      ) : (
        asked && (
          <g className="hud-badge waiting" data-testid="hud-badge">
            <rect x={HUD.badgeX} y="34" width={HUD.badgeW} height="48" rx="11" />
            <text x={HUD.badgeX + HUD.badgeW / 2} y="66">
              ?
            </text>
          </g>
        )
      )}
    </g>
  )
}

/* --- gate: and is a series circuit, or a parallel one --- */

/** The gate's pieces, in the picture's units: the lamps' column, the two
 *  rails a parallel circuit has, the arch and its opening. */
const GATE = { lamp: 106, r: 9, left: 91, right: 122, labelEnd: 84, archX: 132, archW: 64, top: 12, foot: 126, source: 9, socketY: 102 } as const

function gateLampYs(n: number): number[] {
  if (n <= 1) return [60]
  const span = n === 2 ? 50 : 68
  return Array.from({ length: n }, (_, i) => 60 - span / 2 + (i * span) / (n - 1))
}

function gateSentence(view: PropView, p: Extract<Prop, { kind: 'gate' }>): string {
  const locks = p.locks.slice(0, GATE_LOCKS)
  const wired = locks.length < 2 ? 'one lamp' : p.op === 'and' ? 'lamps in a row on one wire (and: every one must be lit)' : 'lamps side by side (or: any one lit will do)'
  const lamps = locks.map((l) => `${l.label} is ${l.on ? 'lit, True' : 'dark, False'}`).join('; ')
  const shows = gateShows(view)
  const end =
    shows === 'open'
      ? ' The current gets through and the gate opens.'
      : shows === 'shut'
        ? view.answer === null
          ? ' The current does not get through, and the gate stays shut.'
          : ' The robot says False: the current does not get through, and the gate stays shut.'
        : shows === 'refused'
          ? ` The robot says ${view.answer!.repr}, but the gate does not move.`
          : ' The gate is shut: will it open?'
  return `A cave gate worked by ${wired}: ${lamps}.${end}`
}

/**
 * A stone arch with an iron portcullis, worked by a little circuit. A
 * power crystal feeds the lamps, one per lock, each labelled with its
 * condition in code font and its truth under it; `and` threads them down
 * one wire, `or` puts each on a rung of a ladder. Current is drawn only
 * once there is something to show it for (a right answer, or the `try`
 * demonstration), wire by wire in the order it would arrive, so the
 * picture does not answer its own question.
 */
function Gate({ view, p }: { view: PropView; p: Extract<Prop, { kind: 'gate' }> }) {
  const clip = useId().replace(/:/g, '')
  const locks = p.locks.slice(0, GATE_LOCKS)
  const n = locks.length
  const ys = gateLampYs(n)
  const shows = gateShows(view)
  const current = gateCurrent(p)
  const flowing = shows === 'open' || shows === 'shut'
  const series = p.op === 'and'
  const last = ys[n - 1] ?? 66
  const X = GATE.lamp
  const r = GATE.r
  const sock = { x: GATE.archX + 6, y: GATE.socketY }
  // The wires, each with when the current reaches it (in steps of the
  // demonstration), so it lights in the order it would arrive.
  type Wire = { d: string; live: boolean; at: number }
  const wires: Wire[] = []
  if (series) {
    wires.push({ d: `M${X} ${GATE.source + 7} V${(ys[0] ?? 66) - r}`, live: true, at: 0 })
    ys.forEach((y, i) => {
      const next = i + 1 < n ? `V${ys[i + 1]! - r}` : `V${sock.y} H${sock.x - 5}`
      wires.push({ d: `M${X} ${y + r} ${next}`, live: current.outOf[i]!, at: i + 1 })
    })
  } else {
    wires.push({ d: `M${X} ${GATE.source + 7} V${GATE.source + 12} H${GATE.left} V${last}`, live: true, at: 0 })
    ys.forEach((y, i) => {
      wires.push({ d: `M${GATE.left} ${y} H${X - r}`, live: true, at: 0 })
      wires.push({ d: `M${X + r} ${y} H${GATE.right}`, live: current.outOf[i]!, at: 1 })
    })
    wires.push({ d: `M${GATE.right} ${ys[0] ?? 66} V${sock.y} H${sock.x - 5}`, live: current.gate, at: 2 })
  }
  const steps = series ? n + 1 : 3
  const step = 0.45
  const opensAt = steps * step + 0.15
  const archR = GATE.archW / 2 - 8
  const ox = GATE.archX + 8
  const ow = GATE.archW - 16
  const oTop = GATE.top + 22
  const opening = `M${ox} ${GATE.foot} V${oTop + archR} A${archR} ${archR} 0 0 1 ${ox + ow} ${oTop + archR} V${GATE.foot} Z`
  const plaque = shows === 'refused' ? `${view.answer!.repr}?` : shows === 'open' ? 'True' : shows === 'shut' ? 'False' : '?'
  return (
    <g
      className={['gate-prop', shows, p.demo === 'try' && view.answer === null && 'demo-try'].filter(Boolean).join(' ')}
      data-shows={shows}
      style={{ ['--opens-at' as string]: `${opensAt}s` }}
    >
      <line x1="0" x2="200" y1={GATE.foot} y2={GATE.foot} className="floor" />
      {/* The power: a crystal that is always lit. */}
      <g transform={`translate(${X},${GATE.source})`} className="gate-source">
        <path d="M0 -8 L5 -2 L0 7 L-5 -2 Z" />
      </g>
      {wires.map((w, i) => (
        <path key={`b${i}`} d={w.d} className="gate-wire" />
      ))}
      {flowing &&
        wires
          .filter((w) => w.live)
          .map((w, i) => <path key={`l${i}:${w.d}`} d={w.d} className="gate-wire live" style={{ ['--at' as string]: `${(w.at * step).toFixed(2)}s` }} />)}
      {locks.map((l, i) => {
        const y = ys[i]!
        const size = Math.min(11.5, (GATE.labelEnd - 4) / Math.max(1, monoW(l.label, 1)))
        return (
          <g key={i} className={['gate-lock', l.on && 'on'].filter(Boolean).join(' ')} data-testid={`lock-${i}`} data-on={l.on ? 'yes' : 'no'} style={{ ['--i' as string]: i }}>
            <text x={GATE.labelEnd} y={y - 1} className="gate-label" style={{ fontSize: `${size.toFixed(2)}px` }}>
              {l.label}
            </text>
            <text x={GATE.labelEnd} y={y + 9.5} className="gate-truth">
              {l.on ? 'True' : 'False'}
            </text>
            <circle cx={X} cy={y} r={r + 4} className="gate-halo" />
            <circle cx={X} cy={y} r={r} className="gate-lamp" />
            <path d={`M${X - 3} ${y + 2} q 1.5 -4 3 0 q 1.5 4 3 0`} className="gate-filament" />
          </g>
        )
      })}
      {n > 1 &&
        ys.slice(0, -1).map((y, i) => {
          const mid = (y + ys[i + 1]!) / 2
          const cx = series ? X : GATE.right
          return (
            <g key={`op${i}`} className="gate-op">
              <rect x={cx - 11} y={mid - 6} width="22" height="12" rx="6" />
              <text x={cx} y={mid + 3.2}>
                {p.op}
              </text>
            </g>
          )
        })}
      {/* The gate: an arch of stone, the dark beyond, and the portcullis. */}
      <g className="gate-arch">
        <path
          d={`M${GATE.archX} ${GATE.foot} V${oTop + archR} A${archR + 8} ${archR + 8} 0 0 1 ${GATE.archX + GATE.archW} ${oTop + archR} V${GATE.foot} Z`}
          className="gate-stone"
        />
        <path d={`M${GATE.archX + 3} ${GATE.foot - 30} h8 M${GATE.archX + GATE.archW - 11} ${GATE.foot - 54} h8 M${GATE.archX + 3} ${GATE.foot - 74} h8 M${GATE.archX + GATE.archW - 11} ${GATE.foot - 16} h8`} className="gate-joints" />
        <path d={opening} className="gate-beyond" />
        <g className="gate-treasure">
          <ellipse cx={ox + ow / 2} cy={GATE.foot - 6} rx={ow / 2 - 4} ry="7" />
          <path d={`M${ox + ow / 2 - 7} ${GATE.foot - 8} l7 -10 l7 10 z`} className="gate-gem" />
        </g>
        <clipPath id={`gate-${clip}`}>
          <path d={opening} />
        </clipPath>
        <g clipPath={`url(#gate-${clip})`}>
          <g className="portcullis">
            {Array.from({ length: 5 }, (_, k) => (
              <rect key={k} x={ox + 3 + (k * (ow - 9)) / 4} y={oTop - 4} width="3.2" height={GATE.foot - oTop + 4} rx="1.2" className="gate-bar" />
            ))}
            {[oTop + 22, oTop + 48, oTop + 74].map((y) => (
              <rect key={y} x={ox} y={y} width={ow} height="3.2" rx="1.2" className="gate-bar" />
            ))}
            <g className="gate-padlock" transform={`translate(${ox + ow / 2},${GATE.foot - 30})`}>
              <path d="M-4.5 -3 V-6 a4.5 4.5 0 0 1 9 0 V-3" />
              <rect x="-7" y="-3" width="14" height="11" rx="2" />
            </g>
          </g>
        </g>
        <circle cx={sock.x} cy={sock.y} r="5" className="gate-socket" />
        <g className="gate-plaque" data-testid="gate-plaque">
          <rect x={GATE.archX + GATE.archW / 2 - 24} y="2" width="48" height="18" rx="5" />
          {/* Decided, the `?` gives way to the answer once the current has
              had its say, so a demonstration does not answer itself first. */}
          {flowing && (
            <text x={GATE.archX + GATE.archW / 2} y="15.2" className="gate-plaque-was">
              ?
            </text>
          )}
          <text x={GATE.archX + GATE.archW / 2} y="15.2" className={flowing ? 'gate-plaque-now' : undefined}>
            {plaque}
          </text>
        </g>
      </g>
    </g>
  )
}

/* --- paths: if, elif, else — the first yes wins --- */

const PATHS = { lane: 13, board: 26, boardW: 76, mark: 109, robot: 127, icon: 146, label: 158, top: 6, bottom: 114 } as const

function pathRows(n: number): { y: number; h: number }[] {
  const h = Math.min(30, (PATHS.bottom - PATHS.top) / Math.max(1, n))
  const top = PATHS.top + 8 + (PATHS.bottom - PATHS.top - 8 - h * n) / 2
  return Array.from({ length: n }, (_, i) => ({ y: top + h * (i + 0.5), h }))
}

const branchWords = (b: { test: string; result: string }) => (b.test.trim() === 'else' ? `else, ${b.result}` : `if ${b.test}, ${b.result}`)

function pathsSentence(p: Extract<Prop, { kind: 'paths' }>): string {
  const branches = p.branches.slice(0, PATHS_MAX)
  const marks = pathMarks(p)
  const signs = branches.map(branchWords).join('; ')
  let end = ''
  if (p.taken === null) end = ' Every sign said no, and the robot walks straight on.'
  else if (p.taken !== undefined && marks[p.taken] === 'yes') {
    const before = marks.filter((m) => m === 'no').length
    const after = marks.filter((m) => m === 'skipped').length
    end = `${before ? ` ${before === 1 ? 'The first sign said' : `The first ${before} signs said`} no.` : ''} ${branches[p.taken]!.test.trim() === 'else' ? 'So the robot takes else' : `${branches[p.taken]!.test} says yes`}: it goes to ${branches[p.taken]!.result}.${
      after ? ` The ${after === 1 ? 'sign after it is' : `${after} signs after it are`} never checked.` : ''
    }`
  }
  return `A fork in a cave tunnel, its signs checked from the top: ${signs}.${end}`
}

/**
 * A cave corridor down the left, a side tunnel off it per branch, each
 * with a signpost bearing its test and, at the far end, where it leads.
 * The marks say what the robot found: a tick on the branch it took, a
 * cross on each it checked before (no), and the ones after greyed out,
 * never checked. The robot stands at the top until something is decided,
 * then in the tunnel it took, or at the corridor's foot if none.
 *
 * `walk` walks it there: down the corridor, pausing at each sign as its
 * mark lands, then into its tunnel. The walk is a keyframe made for these
 * rows (`paths-walk-…`), written as where it has been, so its resting
 * place is the plain style and reduced motion shows only that.
 */
function Paths({ p }: { p: Extract<Prop, { kind: 'paths' }> }) {
  const branches = p.branches.slice(0, PATHS_MAX)
  const n = branches.length
  const rows = pathRows(n)
  const marks = pathMarks(p)
  const t = p.taken
  const taken = t !== undefined && t !== null && marks[t] === 'yes' ? t : null
  const none = t === null
  const start = { x: PATHS.lane, y: 11 }
  const end = taken !== null ? { x: PATHS.robot, y: rows[taken]!.y } : none ? { x: PATHS.lane, y: 116 } : start
  // When the walk reaches each sign, and the keyframes that walk it.
  const move = 0.45
  const pause = 0.35
  const visits = taken !== null ? taken + 1 : none ? n : 0
  const arrive = (i: number) => (i + 1) * move + i * pause
  const total = arrive(Math.max(0, visits - 1)) + pause + move
  const walking = p.demo === 'walk' && (taken !== null || none)
  const name = `paths-walk-${n}-${taken ?? (none ? 'none' : 'x')}`
  const pct = (s: number) => `${((100 * s) / total).toFixed(2)}%`
  const frames = [`0% { translate: ${start.x}px ${start.y}px; }`]
  for (let i = 0; i < visits; i++) {
    frames.push(`${pct(arrive(i))} { translate: ${PATHS.lane}px ${rows[i]!.y}px; }`)
    frames.push(`${pct(arrive(i) + pause)} { translate: ${PATHS.lane}px ${rows[i]!.y}px; }`)
  }
  const rowSize = rows[0]?.h ?? 30
  const robotK = Math.min(1.3, rowSize / 20)
  return (
    <g className={['paths', walking && 'walking', taken !== null && 'decided', none && 'none'].filter(Boolean).join(' ')} style={{ ['--walk' as string]: `${total.toFixed(2)}s` }}>
      {walking && <style>{`@keyframes ${name} { ${frames.join(' ')} }`}</style>}
      {/* The corridor, and straight on past the last sign. */}
      <rect x={PATHS.lane - 11} y="0" width="22" height="128" rx="6" className="paths-lane" />
      <path d={`M${PATHS.lane} 112 V126 M${PATHS.lane - 4} 121 L${PATHS.lane} 126 L${PATHS.lane + 4} 121`} className={`paths-on ${none ? 'lit' : ''}`} />
      {branches.map((b, i) => {
        const { y, h } = rows[i]!
        const mark = marks[i]!
        const isElse = b.test.trim() === 'else'
        const bh = Math.min(20, h - 6)
        const testText = isElse ? 'else' : b.test
        const size = Math.min(11, (PATHS.boardW - 8) / Math.max(1, monoW(testText, 1)))
        const icon = Math.min(h * 0.72, 20)
        const label = short(b.result, 10)
        const lsize = Math.min(9.5, (200 - PATHS.label - 2) / Math.max(1, monoW(label, 1)))
        const when = walking ? arrive(i) : 0.15 + i * 0.12
        return (
          <g
            key={i}
            className={`paths-branch ${mark}`}
            data-testid={`branch-${i}`}
            data-mark={mark}
            style={{ ['--when' as string]: `${when.toFixed(2)}s` }}
          >
            <rect x={PATHS.lane + 6} y={y - h * 0.32} width={200 - PATHS.lane - 8} height={h * 0.64} rx={h * 0.32} className="paths-tunnel" />
            <path d={`M${PATHS.board + PATHS.boardW + 13} ${y} H${PATHS.icon - icon / 2 - 3}`} className="paths-arrow" />
            {mark === 'yes' && <rect x={PATHS.lane + 6} y={y - h * 0.32} width={200 - PATHS.lane - 8} height={h * 0.64} rx={h * 0.32} className="paths-tunnel-lit" />}
            <rect x={PATHS.board} y={y - bh / 2} width={PATHS.boardW} height={bh} rx="4" className="paths-board" />
            {mark === 'yes' && <rect x={PATHS.board} y={y - bh / 2} width={PATHS.boardW} height={bh} rx="4" className="paths-board-lit" />}
            <text x={PATHS.board + PATHS.boardW / 2} y={y + size * 0.36} className={`paths-test ${isElse ? 'else' : ''}`} style={{ fontSize: `${size.toFixed(2)}px` }}>
              {testText}
            </text>
            <g transform={`translate(${PATHS.mark},${y})`}>
              <g className="paths-mark">
                <circle r="6.5" />
                {mark === 'yes' && <path d="M-3 0.2 l2 2.2 l4 -4.6" />}
                {mark === 'no' && <path d="M-2.6 -2.6 l5.2 5.2 M2.6 -2.6 l-5.2 5.2" />}
                {mark === 'skipped' && <path d="M-2.8 0 h5.6" />}
              </g>
            </g>
            <g transform={`translate(${PATHS.icon},${y}) scale(${(icon / 20).toFixed(3)})`} className="icon paths-icon" data-icon={pathIcon(b.result)}>
              <Icon name={pathIcon(b.result)} />
            </g>
            <text x={PATHS.label} y={y + lsize * 0.36} className="paths-result" data-kind={kindOfLiteral(b.result)} style={{ fontSize: `${lsize.toFixed(2)}px` }}>
              {label}
            </text>
          </g>
        )
      })}
      <g
        className="paths-robot"
        data-testid="paths-robot"
        style={{ translate: `${end.x}px ${end.y}px`, ...(walking ? { animationName: name } : {}) }}
      >
        <g transform={`scale(${robotK.toFixed(3)})`}>
          <path d="M0 -10 V-7" className="pr-antenna" />
          <circle cx="0" cy="-11" r="1.8" className="pr-bulb" />
          <rect x="-8" y="-7" width="16" height="13" rx="4" className="pr-head" />
          <rect x="-5.5" y="-4.5" width="11" height="7.5" rx="2.5" className="pr-screen" />
          <circle cx="-2.4" cy="-1" r="1.3" className="pr-eye" />
          <circle cx="2.4" cy="-1" r="1.3" className="pr-eye" />
        </g>
      </g>
    </g>
  )
}

/* --- tally: a loop adding up, one coin a pass --- */

function tallySentence(view: PropView, p: Extract<Prop, { kind: 'tally' }>): string {
  const values = p.values.slice(0, TALLY_MAX)
  const things = p.item === 'gem' ? 'gems' : 'coins'
  const label = p.label ?? 'total'
  const at = p.mark
  const pass =
    at === undefined
      ? ''
      : at >= values.length
        ? ` Every one is counted.`
        : ` The loop is at the ${values[at]}${at > 0 ? `; ${values.slice(0, at).join(', ')} already counted` : ''}.`
  const shown = tallyShows(view)
  const holds = shown === null ? `${label} is empty` : `${label} holds ${shown.text}${shown.refused ? ', not taken' : ''}`
  return `A row of ${values.length} ${things}: ${values.join(', ')}.${pass} ${holds}.`
}

/**
 * A row of coins (or gems), each with its value on its face, and the
 * counter the loop adds them into, drawn as memory draws a name: `total`
 * on a pill, an arrow, and the value on a card. The loop's pass (`mark`)
 * has a pointer over its coin, which glows, with a dashed arrow down into
 * the counter; the coins before it are dimmed and ticked, counted. A
 * number the robot thinks of is written on the card.
 */
function Tally({ view, p }: { view: PropView; p: Extract<Prop, { kind: 'tally' }> }) {
  const values = p.values.slice(0, TALLY_MAX)
  const n = Math.max(1, values.length)
  const gap = 5
  const r = Math.min(17, (194 - (n - 1) * gap) / (2 * n))
  const cx = (i: number) => 100 - ((n - 1) * (2 * r + gap)) / 2 + i * (2 * r + gap)
  const cy = 26 + r
  const mark = p.mark
  const at = mark !== undefined && mark >= 0 && mark < values.length ? mark : null
  const counted = (i: number) => mark !== undefined && i < mark
  const shown = tallyShows(view)
  const label = p.label ?? 'total'
  const gem = p.item === 'gem'
  const ls = Math.min(12, 54 / Math.max(1, monoW(label, 1)))
  const pillW = monoW(label, ls) + 14
  const cardW = 58
  const rowW = pillW + 22 + cardW
  const px = 100 - rowW / 2
  const card = { x: px + pillW + 22, y: 88, h: 30 }
  const vsize = shown ? Math.min(16, (cardW - 8) / Math.max(1, monoW(shown.text, 1))) : 16
  return (
    <g className={['coin-tally', gem && 'gems'].filter(Boolean).join(' ')}>
      {values.map((v, i) => {
        const text = String(v)
        const fs = Math.min(r * 0.95, (r * 1.5) / Math.max(1, monoW(text, 1)))
        return (
          <g
            key={i}
            className={['tally-coin', at === i && 'marked', counted(i) && 'counted'].filter(Boolean).join(' ')}
            data-testid={`coin-${i}`}
            data-marked={at === i ? 'yes' : undefined}
            data-counted={counted(i) ? 'yes' : undefined}
            style={{ ['--i' as string]: i }}
          >
            <g className="coin-face">
              {gem ? (
                <path d={`M${cx(i) - r * 0.62} ${cy - r * 0.8} H${cx(i) + r * 0.62} L${cx(i) + r} ${cy - r * 0.2} L${cx(i)} ${cy + r} L${cx(i) - r} ${cy - r * 0.2} Z`} className="tally-gem" />
              ) : (
                <>
                  <circle cx={cx(i)} cy={cy} r={r} className="tally-rim" />
                  <circle cx={cx(i)} cy={cy} r={r * 0.78} className="tally-inner" />
                </>
              )}
              <text x={cx(i)} y={cy + fs * 0.36 - (gem ? r * 0.15 : 0)} className="tally-value" style={{ fontSize: `${fs.toFixed(2)}px` }}>
                {text}
              </text>
            </g>
            {counted(i) && (
              <g transform={`translate(${cx(i) + r * 0.72},${cy - r * 0.72})`}>
                <g className="tally-tick">
                  <circle r="4.6" />
                  <path d="M-2.2 0.1 l1.5 1.7 l3 -3.4" />
                </g>
              </g>
            )}
          </g>
        )
      })}
      {at !== null && (
        <g className="tally-pointer" style={{ translate: `${cx(at).toFixed(2)}px 0px` }} data-testid="tally-pointer">
          <path d="M-7 4 H7 L0 13 Z" />
          <path d={`M0 ${cy + r + 3} C0 ${cy + r + 16} ${card.x + cardW / 2 - cx(at)} ${card.y - 18} ${card.x + cardW / 2 - cx(at)} ${card.y - 3}`} className="tally-into" />
        </g>
      )}
      <g className="tally-counter">
        <rect x={px} y={card.y + card.h / 2 - 10} width={pillW} height="20" rx="10" className="tally-name" />
        <text x={px + pillW / 2} y={card.y + card.h / 2 + ls * 0.36} className="tally-name-text" style={{ fontSize: `${ls.toFixed(2)}px` }}>
          {label}
        </text>
        <path d={`M${px + pillW + 3} ${card.y + card.h / 2} H${card.x - 4} M${card.x - 8} ${card.y + card.h / 2 - 3.5} L${card.x - 3} ${card.y + card.h / 2} L${card.x - 8} ${card.y + card.h / 2 + 3.5}`} className="tally-arrow" />
        <g className={['tally-card', shown === null && 'empty', shown?.refused && 'refused'].filter(Boolean).join(' ')} data-kind={shown?.kind ?? 'none'} data-testid="tally-card">
          <rect x={card.x} y={card.y} width={cardW} height={card.h} rx="7" />
          {shown && (
            <text key={shown.text} x={card.x + cardW / 2} y={card.y + card.h / 2 + vsize * 0.36} style={{ fontSize: `${vsize.toFixed(2)}px` }}>
              {shown.text}
            </text>
          )}
        </g>
      </g>
    </g>
  )
}

/* --- cases: the program, tried on several encounters --- */

function casesSentence(view: PropView, p: Extract<Prop, { kind: 'cases' }>): string {
  const rows = p.rows.slice(0, CASES_MAX)
  const each = rows
    .map((r, i) => {
      const got = caseResult(view, i)
      const tried = got === null ? '' : got.how === 'error' ? `; the program stopped with ${got.got}` : got.ok ? `; it got ${got.got}, right` : `; it got ${got.got}, not right`
      return `With ${r.given}, ${p.name} should be ${r.want}${tried}`
    })
    .join('. ')
  const ran = rows.some((_, i) => caseResult(view, i) !== null)
  return `The robot tries the program on ${rows.length} case${rows.length === 1 ? '' : 's'}${ran ? '' : ', not run yet'}. ${each}.`
}

/** A case's given values, one per line when there are several: split at
 *  the commas between them, never inside a list or a string. */
function givenLines(given: string): string[] {
  const out: string[] = []
  let depth = 0
  let quote: string | null = null
  let cur = ''
  for (const ch of given) {
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") quote = ch
    else if ('[({'.includes(ch)) depth++
    else if ('])}'.includes(ch)) depth--
    else if ((ch === ',' || ch === ';' || ch === '\n') && depth === 0) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out.slice(0, 2)
}

/**
 * A scoreboard of encounter cards: per case, a slime, the given values in
 * code font, the value `name` should end up holding, what the program made
 * of it (`caseResult`), and a ✓ or an amber ✗. A column header names the
 * name, so "want" and "got" say of what.
 */
function Cases({ view, p }: { view: PropView; p: Extract<Prop, { kind: 'cases' }> }) {
  const rows = p.rows.slice(0, CASES_MAX)
  const n = Math.max(1, rows.length)
  // Columns sized to what they hold: a list's want and got need more room
  // than `"run"`, and a given of two names more than `hp = 20`. Too long
  // for one row together, and a card stacks: the given values along the
  // top, want and got under them.
  const givenW = Math.max(6, ...rows.flatMap((r) => givenLines(r.given).map((l) => monoW(l, 1))))
  const valueW = Math.max(4, ...rows.map((r, i) => Math.max(monoW(short(r.want, 22), 1), monoW(short(caseResult(view, i)?.got ?? '—', 22), 1))))
  const stacked = givenW + 2 * valueW > 30
  const gw = stacked ? 156 : Math.max(52, Math.min(96, (156 * givenW) / (givenW + 2 * valueW)))
  // Want and got share what is left (all of it, stacked), each centred
  // in its half (`text-anchor: middle`), clear of the mark at the right.
  const vx = stacked ? 24 : 24 + gw + 6
  const vw = (180 - vx) / 2
  const col = { given: 24, want: vx + vw / 2, got: vx + vw * 1.5, split: vx + vw, mark: 189 } as const
  const head = 22
  const rowH = Math.min(30, (124 - head) / n)
  const top = head + 2
  const nameSize = Math.min(10, 70 / Math.max(1, monoW(p.name, 1)))
  return (
    <g className="cases">
      {/* Stacked, the given values head each card, and want and got are
          under them: the column heads are only want and got. */}
      {!stacked && (
        <text x={(col.given + 36).toFixed(1)} y="17" className="cases-head">
          given
        </text>
      )}
      <text x={col.split} y="9.5" className="cases-name" style={{ fontSize: `${nameSize.toFixed(2)}px` }}>
        {p.name}
      </text>
      <text x={col.want} y="19.5" className="cases-head">
        want
      </text>
      <text x={col.got} y="19.5" className="cases-head">
        got
      </text>
      {rows.map((r, i) => {
        const y = top + i * rowH
        const cy = y + rowH / 2
        const res = caseResult(view, i)
        const lines = givenLines(r.given)
        // Stacked, the given line has the top half of the card and the
        // values the bottom half; side by side, each has the whole height.
        const band = stacked ? rowH / 2 : rowH
        const gy = stacked ? y + band * 0.62 : cy
        const vy = stacked ? y + band * 1.5 : cy
        const gsize = Math.min(11, band * (lines.length > 1 && !stacked ? 0.34 : 0.5), (gw - 2) / Math.max(1, ...(stacked ? [monoW(lines.join(', '), 1)] : lines.map((l) => monoW(l, 1)))))
        const want = short(r.want, 22)
        const wsize = Math.min(11.5, band * 0.5, (vw - 6) / Math.max(1, monoW(want, 1)))
        const got = res === null ? '—' : short(res.got, 22)
        const gotSize = Math.min(11.5, band * 0.5, (vw - 6) / Math.max(1, monoW(got, 1)))
        const state = res === null ? 'untried' : res.ok ? 'ok' : 'wrong'
        const k = Math.min(1, rowH / 24)
        return (
          <g key={i} className={`cases-row ${state}`} data-testid={`case-${i}`} data-state={state} style={{ ['--i' as string]: i }}>
            <rect x="2" y={y + 1.2} width="196" height={rowH - 2.4} rx="6" className="cases-card" />
            <g transform={`translate(13,${cy + 1}) scale(${k.toFixed(3)})`} className="cases-slime">
              <path d="M-8 6 C-9 -1 -5 -7 0 -7 C5 -7 9 -1 8 6 Z" />
              <circle cx="-2.8" cy="-1" r="1.4" className="eye" />
              <circle cx="2.8" cy="-1" r="1.4" className="eye" />
            </g>
            <text x={col.given} y={gy + (lines.length > 1 && !stacked ? -gsize * 0.2 : gsize * 0.36)} className="cases-given" style={{ fontSize: `${gsize.toFixed(2)}px` }}>
              {(stacked ? [lines.join(', ')] : lines).map((l, k2) => (
                <tspan key={k2} x={col.given} dy={k2 === 0 ? 0 : gsize * 1.15}>
                  {l}
                </tspan>
              ))}
            </text>
            <path d={`M${col.split} ${stacked ? cy + 1 : y + 6} V${y + rowH - (stacked ? 4 : 6)}`} className="cases-split" />
            <text x={col.want} y={vy + wsize * 0.36} className="cases-want" data-kind={kindOfLiteral(r.want)} style={{ fontSize: `${wsize.toFixed(2)}px` }}>
              {want}
            </text>
            <text
              key={got}
              x={col.got}
              y={vy + gotSize * 0.36}
              className={`cases-got ${res?.how ?? 'none'}`}
              data-kind={res?.how === 'value' ? kindOfLiteral(res.got) : 'none'}
              style={{ fontSize: `${gotSize.toFixed(2)}px` }}
            >
              {got}
            </text>
            {res !== null && (
              <g transform={`translate(${col.mark},${cy})`} key={`${state}:${got}`}>
                <g className="cases-mark">
                  <circle r="7" />
                  {res.ok ? <path d="M-3.2 0.2 l2.2 2.4 l4.2 -4.8" /> : <path d="M-2.8 -2.8 l5.6 5.6 M2.8 -2.8 l-5.6 5.6" />}
                </g>
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}
