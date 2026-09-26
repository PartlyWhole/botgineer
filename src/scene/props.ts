/**
 * Props: the picture a lesson step puts on the stage, and what the
 * robot's answer does to it.
 *
 * A lesson step asks a question about a situation — a lamp, a basket of
 * apples, a lift — and the situation is drawn between the crow and the
 * robot. The player's answer is drawn *into* it: `True` lights the lamp,
 * `-1` sends the lift to the car park, `0.5` fills a glass halfway, and
 * `1.5` leaves the lift stuck between floors. So a wrong kind of value is
 * not only a line the crow says, it is something the player can see go
 * wrong.
 *
 * Still a view, and still no state (invariant 12). What a prop shows is a
 * function of three things the workbench already has: which step the
 * lesson is on, the last line the player typed, and what the robot
 * thought of it. Each prop plays a short demonstration when it arrives,
 * which is CSS, not a timer.
 *
 * A narration beat (docs/PEDAGOGY.md §4) shows a picture too, before
 * anything has been asked. Some pictures take a `demo` or a similar field
 * for that: a state forced for the beat — the lamp switched on, the lift
 * sent to −1 — so the stage *shows* the claim the crow is making with the
 * sound off (rule R6). Those fields are narration, not a different
 * picture (`sameProp`), so a beat that changes one keeps the picture on
 * stage and the change plays on it.
 *
 * This module is the pure half: the types and the reading of an answer.
 * `ui/Props.tsx` draws them.
 */
import type { Thought } from '../memory/extract'

export type Prop =
  /** A lamp on a switch. A bool drives it; a word is stuck on it as a note
   *  and lights nothing, which is the difference between `True` and
   *  `"True"`. `demo` forces the switch for a narration beat — `'on'`
   *  flips it and lights the lamp, `'off'` flips it back — while no
   *  answer is drawn; an answer always wins over it, so an ask that
   *  reuses the picture is never answered by its own narration. */
  | { kind: 'lamp'; demo?: 'on' | 'off' }
  /** A fish, a bird, and the robot's answer to whether they are the same.
   *  A word (`"no"`) is stuck on the fish as a note and changes nothing. */
  | { kind: 'fish' }
  /** A basket of apples; the answer is drawn as counted tokens under it.
   *  `demo: 'count'` drops the apples in one at a time with a counter
   *  ticking 1, 2, 3 under the basket; `'half'` has half an apple try to
   *  join and bounce off the rim, the counter staying where it was —
   *  counting goes in whole steps. */
  | { kind: 'basket'; apples: number; demo?: 'count' | 'half' }
  /** A building in section, floors `lowest..highest`, 0 the ground. The
   *  answer is where the lift goes; a float stops it between floors.
   *  `demo` sends it to that floor for a narration beat, before anyone
   *  has answered: below zero is a floor too. */
  | { kind: 'lift'; lowest: number; highest: number; demo?: number }
  /** A glass filled to `level` (0..1), and a second glass filled to the
   *  answer. `demo: 'fill'` is instead one glass filling smoothly to
   *  `level` — no steps on the way, which is what *measured* means. */
  | { kind: 'glass'; level: number; demo?: 'fill' }
  /** A height chart in metres; the answer is how tall the figure stands. */
  | { kind: 'height' }
  /** An egg box with `slots` hollows; the answer is how many eggs. */
  | { kind: 'carton'; slots: number }
  /** A plate: breakfast if `True`, empty if `False`. */
  | { kind: 'plate' }
  /** A football match on a timeline of hours: two halves of 45 minutes. */
  | { kind: 'match' }
  /** The three kinds, nested: bool inside int inside float, with every
   *  value the player has thought of placed in its ring. The shelf
   *  replaces it in Lesson 1, because it claims an int sits inside a
   *  float (R8); it stays drawable for whatever still stands it. */
  | { kind: 'kinds' }
  /** Numbers as blocks and text as letter tiles: `7 + 7` against
   *  `"7" + "7"`. `parts` is what is shown before the answer, as Python
   *  literals and operators; `7 + 7` when omitted. `demo: 'stamp'`, for a
   *  str times an int (`"ha" * 3`), has the word stamp itself that many
   *  times under the sum: repetition, seen. */
  | { kind: 'tiles'; parts?: string[]; demo?: 'stamp' }
  /** Crates in a row, each holding `each` bolts: multiplication as an
   *  array. The answer lights that many bolts. */
  | { kind: 'crates'; crates: number; each: number }
  /** A jug of `litres` and `robots` tanks; the answer is what each tank
   *  gets, and anything not shared stays in the jug. */
  | { kind: 'share'; litres: number; robots: number }
  /** `have` bolts, `use` of them used up; the answer is ringed. */
  | { kind: 'bolts'; have: number; use: number }
  /** A balance with `left` and `right` blocks, asked `left op right`.
   *  `lamp` stands a small lamp beside it that settles with the beam and
   *  lights with the comparison's truth — the answer to a comparison is a
   *  bool. For the narration beat before the ask: on the ask itself it
   *  would be the answer, so leave it off there.
   *
   *  `leftLabel` and `rightLabel` are what each pan says, and so what the
   *  question says, when a side is written as more than its number:
   *  `2 + 2` on the left of `2 + 2 == 4`. Without them each side is its
   *  number. A label that is a sum of whole numbers (`2 + 2`) splits its
   *  pan's blocks into its parts, in two colours, so the sum is seen to
   *  weigh what its total does. */
  | {
      kind: 'balance'
      left: number
      right: number
      op: '>' | '<' | '=='
      lamp?: boolean
      leftLabel?: string
      rightLabel?: string
    }
  /** An expression worked one operation at a time: `first` is done
   *  first, then each of `then`. The working shows once answered. */
  | { kind: 'expr'; text: string; first: string; then: string[] }
  /** A phone whose screen shows the number exactly as the robot has it. */
  | { kind: 'phone'; number: string }
  /** A locked door, and a note to the person on the other side. */
  | { kind: 'door' }
  /** A card handed to a person, showing whatever text is on it. */
  | { kind: 'card' }
  /** A letter tile with its number on the back. */
  | { kind: 'letter'; char: string }
  /**
   * The five data types as a shelf of five slots, bool · int · float ·
   * char · str, left to right. The lesson fills it as it names each one.
   * It replaces the nested boxes, which claimed an int sits inside a
   * float (R8: `3` and `3.0` are different objects of different types).
   *
   * `filled` is which slots have been named, in the order they were: the
   * last is the newcomer, and only it flies in with its label and its
   * examples (`examples`, else `SLOT_EXAMPLES`), so a picture drawn again
   * from scratch does not replay the whole lesson. An unnamed slot is a
   * `?`; `pulse` has the `?`s pulse in turn. `title` settles *Data types*
   * over the shelf; `later` lines up ghost chips in `[ ]`, tagged *later*
   * — what the five get arranged into; `cheer` bounces every filled slot.
   *
   * Everything heard so far is drawn into the slot of its own type
   * (`slotOf`: a one-character str is a char), so a shelf that stays on
   * stage through a round of questions collects the answers, and the
   * newest (the view's answer) flies in. That is Python's truth whether
   * or not the answer was right, so a miss sorted there is honest; a
   * staging that wants only right answers passes only those, as practice
   * does with `kinds`.
   */
  | {
      kind: 'shelf'
      filled: TypeSlot[]
      title?: boolean
      pulse?: boolean
      later?: boolean
      cheer?: boolean
      examples?: Partial<Record<TypeSlot, string[]>>
    }
  /** A number line from `from` to `to`, whole numbers ticked, tenths
   *  between them when the line is short. A marker slides along from
   *  `from` and stops at `mark`, its value written between the ticks —
   *  unless `unnamed`, for the beat before the value has its name. A
   *  number the robot thinks of moves the marker instead.
   *
   *  `want` is the number the ask is after, when the ask is for the robot
   *  to work one out (`2 + 0.5`): the same number typed by hand is then
   *  drawn as not worked out yet (`unworked`), not as a measurement. */
  | { kind: 'numberline'; from: number; to: number; mark?: number; unnamed?: boolean; want?: number }
  /** Letters floating up into the air where Mira reads them: characters,
   *  one at a time, which is all a person reads. */
  | { kind: 'letters'; chars: string[] }
  /** One character, alone. `clasps` draws its quotes as clasps closed
   *  round it: the quotes are what make it a thing to read. */
  | { kind: 'char'; char: string; clasps?: boolean }
  /** Two things side by side in their kinds' colours, differing in one
   *  way (R7): `7` beside `"7"`. With a `result` on each side, what each
   *  one makes: `7 + 7` → `14` beside `"7" + "7"` → `"77"`. */
  | { kind: 'contrast'; left: ContrastSide; right: ContrastSide }
  /** A string as beads on a thread: the characters slide on one at a
   *  time and a quote clips on at each end. `glow` lights the clasps —
   *  the quotes show where the string starts and stops. */
  | { kind: 'beads'; text: string; glow?: boolean }
  /** An arrow off the right edge of the stage, towards the console, with
   *  a tag: where the player's instructions go. */
  | { kind: 'pointer'; to: 'console'; label: string }
  /** `on` lit lamps, each a `True`, adding up: each lamp turns into a 1
   *  and the sum comes out an int. `True + True` is `2`. */
  | { kind: 'lamps'; on: number }
  /** Letters sliding onto a number line at their codes — A at 65, B at
   *  66: every character is secretly a number (`ord`). */
  | { kind: 'codes'; chars: string }
  /** A scale and `parcels` parcels of `each` kg. The answer is the
   *  reading: when the robot has worked it out, the parcels go on one by
   *  one and the scale reads what it said, in kg. A reading that is not
   *  what the parcels weigh is drawn as a scale that disagrees. */
  | { kind: 'scale'; parcels: number; each: number }

/** One side of a `contrast`. `text` is the value as Python writes it —
 *  or, with `result`, the expression that makes it. `label` is a word for
 *  people under it ("a number", "a thing to read"). */
export type ContrastSide = {
  text: string
  kind: TypeSlot
  label?: string
  /** What `text` makes, as Python writes it. */
  result?: string
  /** The result's kind, when it is not the side's own. */
  resultKind?: TypeSlot
}

/** Everything a prop needs to draw itself, and nothing it could change. */
export type PropView = {
  prop: Prop
  /** The question, kept on screen under the picture — the crow's bubble
   *  answers a miss, so without this the question would disappear. */
  ask?: string | undefined
  /** What the robot made of the last line, if it is this prop's to show. */
  answer: Thought | null
  /** `right` once the step this prop belongs to is done; `miss` for an
   *  answer that did not do it; null before anything has been tried. */
  verdict: 'right' | 'miss' | null
  /** Everything thought of so far, oldest first. The kinds diagram and
   *  the shelf sort them into place; nothing else reads it. */
  heard: Thought[]
}

/**
 * What the stage shows: the current step's prop, and the one the player
 * has just answered, on its way out.
 *
 * `leaving` is the payoff. A right answer advances the lesson at once, so
 * without it the lamp would never be seen lit — the fish would already
 * be there. It is drawn for a beat and then gives way, in CSS.
 */
export type Staging = {
  current: (PropView & { key: string }) | null
  leaving: (PropView & { key: string }) | null
}

export const NO_STAGING: Staging = { current: null, leaving: null }

/**
 * The fields of each prop that narrate rather than make a different
 * picture: a lamp switched on for a beat is still the lamp, a shelf with
 * one more slot filled is still the shelf. Two props that differ only in
 * these are the same picture, so the element stays on stage and the
 * change plays as a transition on it — the switch flips, the newcomer
 * flies into its slot — instead of the picture leaving and coming back as
 * itself, which would replay its arrival and bury the one thing that
 * changed.
 */
const NARRATION: Partial<Record<Prop['kind'], string[]>> = {
  lamp: ['demo'],
  basket: ['demo'],
  lift: ['demo'],
  balance: ['lamp'],
  shelf: ['filled', 'title', 'pulse', 'later', 'cheer', 'examples'],
  numberline: ['mark', 'unnamed'],
  char: ['clasps'],
  beads: ['glow'],
}

/** A prop without its narration: what identifies the picture. */
function picture(p: Prop): Record<string, unknown> {
  const out: Record<string, unknown> = { ...p }
  for (const k of NARRATION[p.kind] ?? []) delete out[k]
  return out
}

/** Two props show the same picture, so a new step keeps it on stage and
 *  only the answer (or the narration) changes, instead of the picture
 *  leaving and coming back as itself. */
export const sameProp = (a: Prop, b: Prop): boolean => JSON.stringify(picture(a)) === JSON.stringify(picture(b))

/* ------------------------------ answers ------------------------------ */

/** A number, if the robot thought of an int or a float. A bool is not
 *  one here, even though Python would let it add: the props draw what
 *  the player *said*, and `True` in a basket is not an apple. */
export function numberOf(t: Thought | null): number | null {
  if (!t || (t.type !== 'int' && t.type !== 'float')) return null
  const n = Number(t.repr)
  return Number.isFinite(n) ? n : null
}

/** True or false, if the robot thought of a bool. */
export function boolOf(t: Thought | null): boolean | null {
  if (!t || t.type !== 'bool') return null
  return t.repr === 'True'
}

/**
 * The text of a str, from its repr: `'it\'s'` → `it's`.
 *
 * Python chooses the quotes and escapes, so this undoes exactly what
 * `repr` does for the characters a player can type. Anything that is not
 * a str is null — a prop shows words only when they are words.
 */
export function textOf(t: Thought | null): string | null {
  if (!t || t.type !== 'str') return null
  const r = t.repr
  if (r.length < 2) return null
  const body = r.slice(1, -1)
  return body.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/g, (_, e: string) => {
    if (e === 'n') return '\n'
    if (e === 't') return '\t'
    if (e === 'r') return '\r'
    if (e.length > 1) return String.fromCodePoint(parseInt(e.slice(1), 16))
    return e
  })
}

/** Keeps a number on a scale, so an answer of a million still draws. */
export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

/* ------------------------- right, but not worked out ------------------------- */

/**
 * What a row of tiles makes, when it is a sum the robot can be asked to
 * work out: whole numbers joined by `+` or `*`, or words glued by `+`
 * and repeated by `*` a whole number of times. One operator throughout,
 * so no order of operations is guessed at. A lone word is not a sum —
 * its question is about a letter of it — and nor is anything else
 * (`2 + 2 == 4` is a comparison, drawn for a beat, never asked).
 */
export function tilesMake(parts: readonly string[]): { number: number } | { text: string } | null {
  if (parts.length < 3 || parts.length % 2 === 0) return null
  const ops = parts.filter((_, i) => i % 2 === 1)
  const op = ops[0]
  if ((op !== '+' && op !== '*') || ops.some((o) => o !== op)) return null
  const texts: string[] = []
  const nums: number[] = []
  for (const v of parts.filter((_, i) => i % 2 === 0)) {
    if (/^".*"$/.test(v)) texts.push(v.slice(1, -1))
    else if (/^-?\d+$/.test(v)) nums.push(Number(v))
    else return null
  }
  if (texts.length === 0) return { number: nums.reduce((a, v) => (op === '+' ? a + v : a * v), op === '+' ? 0 : 1) }
  if (op === '+') return nums.length === 0 ? { text: texts.join('') } : null
  // A word times whole numbers: the one word, repeated.
  if (texts.length !== 1) return null
  return { text: texts[0]!.repeat(Math.max(0, nums.reduce((a, v) => a * v, 1))) }
}

/**
 * The number a picture that asks for one is asking for: what the crates
 * hold, what is left of the bolts, what each tank gets, what the parcels
 * weigh, where the working ends, the letter's code, what a sum of blocks
 * makes. Null for a picture that does not draw a number as its answer
 * (the lamps and the codes narrate; they draw no answer at all).
 */
export function rightNumber(p: Prop): number | null {
  switch (p.kind) {
    case 'crates':
      return p.crates * p.each
    case 'bolts':
      return p.have - p.use
    case 'share':
      return p.robots > 0 ? p.litres / p.robots : null
    case 'scale':
      return p.parcels * p.each
    case 'expr': {
      const last = Number(p.then[p.then.length - 1])
      return p.then.length > 0 && Number.isFinite(last) ? last : null
    }
    case 'letter':
      return p.char.codePointAt(0) ?? null
    case 'numberline':
      return p.want ?? null
    case 'tiles': {
      const made = tilesMake(p.parts ?? [])
      return made && 'number' in made ? made.number : null
    }
    default:
      return null
  }
}

/** The words a picture asks the robot to make: what a sum of words glues
 *  or repeats into (`"bot" + "gineer"`, `"ha" * 5`). */
export function rightText(p: Prop): string | null {
  if (p.kind !== 'tiles') return null
  const made = tilesMake(p.parts ?? [])
  return made && 'text' in made ? made.text : null
}

/**
 * The right answer, said the wrong way: the step refused it (`miss`) and
 * yet it is the number, or the words, the picture asks for — typed by
 * hand, or worked out from the wrong thing. The crow's reply says *not
 * like that*, so the picture must not say *yes*: drawn as an answer it
 * would fill the crates, weigh the parcels, tick the reading and glue
 * the tiles while the words refuse it. Such a picture is drawn as not
 * worked out yet: waiting, in amber, with a `?` where the working would
 * go.
 *
 * Compared by value, so a typed `4` for `8 / 2`'s `4.0` counts: the right
 * amount, and still not what the robot was asked to work out.
 */
export function unworked(view: PropView): boolean {
  if (view.verdict !== 'miss') return false
  const n = numberOf(view.answer)
  const want = rightNumber(view.prop)
  if (n !== null && want !== null && Math.abs(n - want) < 1e-9) return true
  const text = textOf(view.answer)
  const words = rightText(view.prop)
  return text !== null && words !== null && text === words
}

/** How close two amounts read by eye must be to look the same: a glass
 *  or a bar a twentieth off is not a different picture. Practice judges
 *  a glass by the same margin. */
export const BY_EYE = 0.051

/** The heights, in metres, the chart draws as a person standing there:
 *  what the choose lesson takes for an answer. */
export const HEIGHT_RANGE = [0.5, 2.5] as const

/**
 * Whether the picture draws this answer the way it draws the answer it
 * asks for — which is what the player reads as *yes*. Not whether the
 * answer is right: that is the step's to say, from the evidence. A
 * picture draws what the robot thought, and three apples are three
 * apples whether they were `3`, `3.0` or `2 + 1`. So this is the half a
 * picture can know, and `refused` sets it beside the step's verdict.
 *
 * Per picture: the lamp lit; the fish not a bird; the basket counted to
 * its apples; the lift parked on a floor it has; the second glass filled
 * like the first; a person on the height chart; the egg box full; the
 * plate uncovered; the bar reaching the final whistle; words on the card
 * or the note; the phone calling; the tiles making what the sum makes
 * (or, under a lone word, one letter tile); every crate's bolts lit; the
 * jug emptied into the tanks; the bolts left ringed; the letter turned;
 * the scale reading what the parcels weigh; the marker where the ask
 * wants it. The balance and the working are drawn only once the step is
 * right, the shelf and the kinds sort by type (Python's truth either
 * way), and the rest draw no answer: none of those can look right on a
 * miss.
 */
export function looksRight(view: PropView): boolean {
  const p = view.prop
  const a = view.answer
  if (!a) return false
  const n = numberOf(a)
  const b = boolOf(a)
  const t = textOf(a)
  switch (p.kind) {
    case 'lamp':
      return b === true
    case 'fish':
      return b === false
    case 'basket':
      return n !== null && n === p.apples
    case 'lift':
      return n !== null && Number.isInteger(n) && n >= p.lowest && n <= p.highest
    case 'glass':
      return p.demo !== 'fill' && n !== null && Math.abs(n - p.level) <= BY_EYE
    case 'height':
      return n !== null && n >= HEIGHT_RANGE[0] && n <= HEIGHT_RANGE[1]
    case 'carton':
      return n !== null && Math.floor(n) === p.slots
    case 'plate':
      return b !== null
    case 'match':
      return n !== null && Math.abs(n - 1.5) <= BY_EYE
    case 'card':
    case 'door':
      return t !== null && t.trim() !== ''
    case 'phone':
      return t !== null && t.replace(/\D/g, '') === p.number
    case 'tiles': {
      const made = tilesMake(p.parts ?? [])
      if (made === null) return (p.parts ?? []).length === 1 && t !== null && [...t].length === 1
      return 'text' in made ? t === made.text : n !== null && Math.abs(n - made.number) < 1e-9
    }
    case 'crates':
      return n !== null && Math.floor(n) >= p.crates * p.each
    case 'share':
      return n !== null && p.robots > 0 && n * p.robots >= p.litres - 1e-9
    case 'bolts':
      return n !== null && clamp(Math.floor(n), 0, p.have) === p.have - p.use
    case 'letter':
      return a.type === 'int'
    case 'scale':
      return n !== null && Math.abs(n - p.parcels * p.each) < 1e-9
    case 'numberline':
      return n !== null && p.want !== undefined && Math.abs(n - p.want) < 1e-9
    default:
      return false
  }
}

/**
 * A miss the picture would draw as a yes: the step refused the answer,
 * and the picture, left to itself, would draw it the way it draws the
 * right one (`looksRight`) — `3.0` apples counted into a basket of
 * three, a lift parked at `-1.0`, the lamp lit by a typed `True`. Such a
 * picture draws the answer *refused*: still what the robot thought, but
 * in amber, in its own idiom, so what the player sees agrees with what
 * the crow says.
 *
 * The right answer said the wrong way (`unworked`) is not this: that
 * picture draws nothing done at all, and waits for the working.
 */
export function refused(view: PropView): boolean {
  return view.verdict === 'miss' && !unworked(view) && looksRight(view)
}

/** The kinds, in the order the first level builds them. */
export type Kind = 'bool' | 'int' | 'float' | 'str'

export const KINDS: Kind[] = ['bool', 'int', 'float', 'str']

export const kindOf = (t: Thought | null): Kind | null =>
  t && (KINDS as string[]).includes(t.type) ? (t.type as Kind) : null

/* ------------------------------ the shelf ------------------------------ */

/**
 * The shelf's five slots. Five *ideas*, four Python types: Python has no
 * char type and keeps a character as a str one long, which is what the
 * char slot's tag says (`str · length 1`) wherever a char is drawn.
 */
export type TypeSlot = 'bool' | 'int' | 'float' | 'char' | 'str'

export const SLOTS: TypeSlot[] = ['bool', 'int', 'float', 'char', 'str']

/** What each slot shows once it is named, as Python writes them — a str
 *  in the double quotes the lessons use. */
export const SLOT_EXAMPLES: Record<TypeSlot, string[]> = {
  bool: ['True', 'False'],
  int: ['3', '12', '-1'],
  float: ['0.5', '1.4'],
  char: ['"A"'],
  str: ['"hello"', '"Mira"'],
}

/** Which slot a thought belongs in: its own type, except that a str of
 *  exactly one character is a char. Counted in code points, so `"é"` is
 *  one character the way Python's `len` says. The empty string is a str
 *  of no characters, not a char. */
export function slotOf(t: Thought | null): TypeSlot | null {
  if (!t) return null
  if (t.type === 'bool' || t.type === 'int' || t.type === 'float') return t.type
  if (t.type !== 'str') return null
  const text = textOf(t)
  if (text === null) return null
  return [...text].length === 1 ? 'char' : 'str'
}

/** A thought as the shelf writes it: a str in double quotes, the way the
 *  lessons write one, everything else as Python's repr. */
export function chipText(t: Thought): string {
  const text = textOf(t)
  return text === null ? t.repr : `"${text}"`
}

export type ShelfSlot = { examples: { text: string; said: boolean }[]; heard: string[] }

/** How many rows a slot has under its label, and how many characters a
 *  chip's row holds at the shelf's size. */
export const CHIP_ROWS = 5
export const CHIP_CHARS = 8

/**
 * A chip's text as the shelf writes it: one row when it fits, else two,
 * broken at a space where there is one (`"0412` / `555 019"`, `"Yeah it`
 * / `is"`), and cut short only past two full rows. A phone number and a
 * short sentence are what the choose lesson files under str, and a chip
 * that reads `"0412 5…` hides the very thing the lesson is about — that
 * it is text, spaces and all.
 */
export function chipLines(text: string, width = CHIP_CHARS): string[] {
  if ([...text].length <= width) return [text]
  const out: string[] = []
  let line = ''
  const push = (w: string) => {
    // A word too long for a row is broken inside it: a phone number with
    // no spaces is still read whole, over two rows.
    let rest = [...w]
    while (rest.length > width) {
      out.push(rest.slice(0, width).join(''))
      rest = rest.slice(width)
    }
    line = rest.join('')
  }
  for (const w of text.split(' ')) {
    const next = line ? `${line} ${w}` : w
    if ([...next].length <= width) line = next
    else {
      if (line) out.push(line)
      push(w)
    }
  }
  if (line) out.push(line)
  if (out.length <= 2) return out
  const second = [...out[1]!]
  return [out[0]!, `${second.slice(0, width - 1).join('')}…`]
}

/** The rows a chip takes: one per line of its text. */
export const chipRows = (text: string): number => chipLines(text).length

/**
 * The rows each slot has left for heard values, once its examples (and
 * the char slot's two-row tag) are drawn. The drawing and the sentence a
 * screen reader hears both take it from here, so they list the same
 * values: they disagreed once, the sentence listing two a slot while the
 * picture showed five.
 */
export function shelfRoom(filled: readonly TypeSlot[], examples: Partial<Record<TypeSlot, string[]>> = {}): Record<TypeSlot, number> {
  const out = {} as Record<TypeSlot, number>
  for (const k of SLOTS) {
    const named = filled.includes(k)
    const shown = named ? (examples[k] ?? SLOT_EXAMPLES[k]) : []
    const tag = k === 'char' && named ? 2 : 0
    out[k] = Math.max(0, CHIP_ROWS - shown.reduce((sum, e) => sum + chipRows(e), 0) - tag)
  }
  return out
}

/**
 * What each slot holds: its examples once named, then the values heard of
 * that slot that are not already examples, newest last, as many as fit
 * in `room` rows (2 unless said; a chip that wraps takes two, `chipRows`).
 * An example the player has said is `said`.
 * Heard values go in whether or not their slot is named yet: a value has
 * its type before anyone has told the player the word. Pure, so the
 * sorting is tested without drawing it.
 */
export function shelved(
  filled: readonly TypeSlot[],
  heard: readonly Thought[],
  examples: Partial<Record<TypeSlot, string[]>> = {},
  room: Partial<Record<TypeSlot, number>> = {},
): Record<TypeSlot, ShelfSlot> {
  const out = {} as Record<TypeSlot, ShelfSlot>
  for (const slot of SLOTS) {
    const shown = filled.includes(slot) ? (examples[slot] ?? SLOT_EXAMPLES[slot]) : []
    const said: string[] = []
    for (const t of heard) {
      if (slotOf(t) !== slot) continue
      const text = chipText(t)
      // Newest last: a value said again moves to the end.
      const was = said.indexOf(text)
      if (was >= 0) said.splice(was, 1)
      said.push(text)
    }
    const extra = said.filter((s) => !shown.includes(s))
    // The newest that fit, counted in rows from the newest back: an older
    // one-row value never pushes out a newer one that wraps.
    let rows = room[slot] ?? 2
    const kept: string[] = []
    for (let i = extra.length - 1; i >= 0; i--) {
      const need = chipRows(extra[i]!)
      if (need > rows) break
      rows -= need
      kept.unshift(extra[i]!)
    }
    out[slot] = {
      examples: shown.map((text) => ({ text, said: said.includes(text) })),
      heard: kept,
    }
  }
  return out
}

/* ------------------------------ the codes ------------------------------ */

/**
 * Where each character sits on the codes line: its code, and its place
 * along the line from 0 to 1, each character once. Close codes are
 * spaced by value, so A, B and C sit one step apart and a gap in the
 * codes is a gap on the line; codes too far apart to share a line (`A`
 * and `z`) are spaced evenly in code order instead, which keeps every one
 * readable at the cost of the spacing meaning anything.
 */
export function codeLine(chars: string): { char: string; code: number; at: number; even: boolean }[] {
  const seen: string[] = []
  for (const c of chars) if (!seen.includes(c)) seen.push(c)
  const codes = seen.map((c) => ({ char: c, code: c.codePointAt(0)! }))
  if (codes.length === 0) return []
  const lo = Math.min(...codes.map((c) => c.code))
  const hi = Math.max(...codes.map((c) => c.code))
  if (hi - lo <= 10) {
    const span = hi - lo + 2
    return codes.map((c) => ({ ...c, at: (c.code - lo + 1) / span, even: false }))
  }
  const order = [...codes].sort((a, b) => a.code - b.code)
  return codes.map((c) => ({ ...c, at: (order.indexOf(c) + 1) / (codes.length + 1), even: true }))
}
