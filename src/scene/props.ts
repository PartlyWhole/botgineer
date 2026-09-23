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
 * This module is the pure half: the types and the reading of an answer.
 * `ui/Props.tsx` draws them.
 */
import type { Thought } from '../memory/extract'

export type Prop =
  /** A lamp on a switch. A bool drives it; a word is stuck on it as a note
   *  and lights nothing, which is the difference between `True` and
   *  `"True"`. */
  | { kind: 'lamp' }
  /** A fish, a bird, and the robot's answer to whether they are the same. */
  | { kind: 'fish' }
  /** A basket of apples; the answer is drawn as counted tokens under it. */
  | { kind: 'basket'; apples: number }
  /** A building in section, floors `lowest..highest`, 0 the ground. The
   *  answer is where the lift goes; a float stops it between floors. */
  | { kind: 'lift'; lowest: number; highest: number }
  /** A glass filled to `level` (0..1), and a second glass filled to the
   *  answer. */
  | { kind: 'glass'; level: number }
  /** A height chart in metres; the answer is how tall the figure stands. */
  | { kind: 'height' }
  /** An egg box with `slots` hollows; the answer is how many eggs. */
  | { kind: 'carton'; slots: number }
  /** A plate: breakfast if `True`, empty if `False`. */
  | { kind: 'plate' }
  /** A football match on a timeline of hours: two halves of 45 minutes. */
  | { kind: 'match' }
  /** The three kinds, nested: bool inside int inside float, with every
   *  value the player has thought of placed in its ring. */
  | { kind: 'kinds' }
  /** Numbers as blocks and text as letter tiles: `7 + 7` against
   *  `"7" + "7"`. */
  | { kind: 'tiles' }
  /** A phone whose screen shows the number exactly as the robot has it. */
  | { kind: 'phone'; number: string }
  /** A locked door, and a note to the person on the other side. */
  | { kind: 'door' }
  /** A card handed to a person, showing whatever text is on it. */
  | { kind: 'card' }
  /** A letter tile with its number on the back. */
  | { kind: 'letter'; char: string }

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
  /** Everything thought of so far, oldest first. The kinds diagram sorts
   *  them into rings; nothing else reads it. */
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

/** Two props show the same picture, so a new step keeps it on stage and
 *  only the answer changes, instead of the picture leaving and coming
 *  back as itself. */
export const sameProp = (a: Prop, b: Prop): boolean => JSON.stringify(a) === JSON.stringify(b)

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
