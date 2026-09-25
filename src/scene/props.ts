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
   *  would be the answer, so leave it off there. */
  | { kind: 'balance'; left: number; right: number; op: '>' | '<' | '=='; lamp?: boolean }
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
   *  number the robot thinks of moves the marker instead. */
  | { kind: 'numberline'; from: number; to: number; mark?: number; unnamed?: boolean }
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

/**
 * What each slot holds: its examples once named, then the values heard of
 * that slot that are not already examples, newest last, at most `room`
 * of them (2 unless said). An example the player has said is `said`.
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
    const keep = room[slot] ?? 2
    out[slot] = {
      examples: shown.map((text) => ({ text, said: said.includes(text) })),
      heard: keep > 0 ? extra.slice(-keep) : [],
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
