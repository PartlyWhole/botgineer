/**
 * Generated exercises: one generator per skill, each a fresh question from
 * a seed.
 *
 * An exercise is a question the crow asks, an optional setup the console
 * runs first (`crates = 7`), a line that would answer it, and a **judge**:
 * given what the player's line did — what the robot thought, what memory
 * now holds, whether it raised — is that right, wrong, or not an answer at
 * all? The judge reads the same evidence a lesson step does; practice is
 * not a second idea of what happened.
 *
 * Answers are computed from the expression tree (`python.ts`) rather than
 * written down, so a generator can ask about any numbers it likes and still
 * know the answer. Where a mistake is a common one — no quotes round a
 * word, `*` before `+`, a copied name expected to follow the original —
 * the judge says *which* mistake, because "wrong" teaches nothing.
 *
 * How an exercise talks follows the lessons' rubric (docs/PEDAGOGY.md §2):
 *
 * - `say` is the question and nothing else (R3). Anything the player needs
 *   to know first — what the setup did, a fact from the story — is a
 *   `lead` beat before it, one sentence each (R2).
 * - `tag` says who does the work (R4), and the bubble wears it as a pill.
 *   The test is the rubric's: if a right answer typed by hand is refused,
 *   the robot does the work. Every `robot` judge checks the *source* as
 *   well as the value, so the answer the question forbids cannot pass it.
 * - `praise` names the reason it was right (R9), and every `why` names
 *   the mistake (R10), in a sentence short enough to read at a glance.
 *
 * Every generator is deterministic in its seed: the same seed is the same
 * question, which is what makes a session reproducible in a test.
 */
import type { Thought } from '../memory/extract'
import type { MemorySnapshot } from '../memory/model'
import { textOf, type Prop } from '../scene/props'
import { bin, evaluate, int, render, repr, str, type BinOp, type Expr } from './python'

/* ------------------------------ randomness ------------------------------ */

export type Rng = () => number

/** mulberry32: small, fast, and the same sequence everywhere for a seed. */
export function rng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
export const between = (r: Rng, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1))

/* ------------------------------- the shape ------------------------------- */

/** What one line the player typed did. */
export type Attempt = {
  source: string
  /** The line completed. */
  ok: boolean
  /** Why it did not, as the console said it — begins with the error's
   *  type name (`NameError — …`). */
  error: string | null
  /** What the robot thought, for a bare expression. */
  thought: Thought | null
  /** Memory after the line. */
  snapshot: MemorySnapshot
}

export type Verdict = 'correct' | 'wrong' | 'ignore'

export type Judgement = { verdict: Verdict; why?: string | undefined }

/** Who does the work: the player, from their own head, or the robot,
 *  from a line the player gives it (R4). */
export type Worker = 'you' | 'robot'

export type Exercise = {
  /** Identifies the question, so a session does not ask it twice. */
  key: string
  skill: string
  /** The question, and only the question (R3). Backticks render as code. */
  say: string
  /** Who does the work, worn by the question as a pill. */
  tag: Worker
  /** Told before the question, one line a beat: what the setup did, or
   *  a fact the question stands on. */
  lead?: string[] | undefined
  /** Lines run before the player starts, and shown as given. */
  setup: string[]
  /** The picture the question is about, drawn on the stage with the
   *  answer in it — as a lesson step's is. */
  show?: Prop | undefined
  /** The question in a few words, kept under the picture. */
  ask?: string | undefined
  /** One line that answers it — shown after two misses, and what the
   *  browser suite types to check the judge against real Python. */
  answer: string
  /** Why it was right, said after a word of praise, as its own beat. */
  praise: string
  /** What `answer` makes the robot think, for an answer that is a bare
   *  expression. Lets a unit test judge each generator's own answer over
   *  thousands of seeds without a Python runtime — which is how a judge
   *  that contradicts its own generator gets caught. */
  expect?: Thought | undefined
  judge: (a: Attempt) => Judgement
}

/* ------------------------------- helpers ------------------------------- */

const targetOf = (s: MemorySnapshot, n: string) => s.bindings.find((b) => b.name === n)?.target ?? null
const reprOf = (s: MemorySnapshot, n: string): string | null => {
  const id = targetOf(s, n)
  return id === null ? null : (s.objects[id]?.repr ?? null)
}

/** The error's type name, from the console's line about it. */
const errorType = (a: Attempt): string => a.error?.match(/^[A-Za-z]+/)?.[0] ?? 'Error'

const failed = (a: Attempt, hints: Record<string, string> = {}): Judgement => ({
  verdict: 'wrong',
  why: hints[errorType(a)] ?? `That stopped with ${article(errorType(a))} ${errorType(a)}.`,
})

const article = (w: string) => (/^[AEIOU]/.test(w) ? 'an' : 'a')

const INT_LITERAL = /^-?\d+$/
/** A sum for the robot: an operator between two things, not just a
 *  number with a sign in front. */
const WORKING = /[\w)]\s*(\*\*|\/\/|[-+*/%])\s*[-\w(]/
/** A number written as itself in the source, not as part of a longer one. */
const mentions = (source: string, n: number) => new RegExp(`(^|[^\\d.])${n}([^\\d.]|$)`).test(source)
/** `true` → `True`: the lower-case miss, answered with the right spelling. */
const lowerBool = (said: string) => (said === 'true' || said === 'false' ? `${said[0]!.toUpperCase()}${said.slice(1)}` : null)

const value = (e: Expr, env = {}) => repr(evaluate(e, env))
const strRepr = (v: string) => repr({ t: 'str', v })

const OPS_WORD: Partial<Record<BinOp, string>> = { '+': 'plus', '-': 'minus', '*': 'times' }

/* ------------------------------ generators ------------------------------ */

export type Generator = (r: Rng) => Exercise

const WORDS = ['bolt', 'gear', 'spark', 'wrench', 'robot', 'sprocket', 'widget', 'crow', 'lamp', 'wire'] as const
const PAIRS = [
  ['bot', 'gineer'],
  ['sun', 'flower'],
  ['gear', 'box'],
  ['tool', 'kit'],
  ['rain', 'bow'],
  ['foot', 'print'],
  ['moon', 'light'],
] as const
const THINGS = ['bolts', 'gears', 'sparks', 'crates', 'wheels', 'wires'] as const

/** The five ideas of data the first level names. A char is an idea, not a
 *  Python type: Python keeps it as a `str` one character long (R8). */
type Kind = 'bool' | 'int' | 'float' | 'char' | 'str'
const PY_TYPE: Record<Kind, string> = { bool: 'bool', int: 'int', float: 'float', char: 'str', str: 'str' }

/** Questions whose kind is decided by what they ask, each about a
 *  picture from the first level, and their answers as Python writes them. */
const SITUATIONS: { say: string; lead?: string; ask: string; show: Prop; type: Kind; value: string; hint: string; word?: string }[] = [
  { say: 'How many hollows does this egg box have?', ask: 'How many hollows?', show: { kind: 'carton', slots: 6 }, type: 'int', value: '6', hint: 'count the hollows again.' },
  { say: 'How many apples are in the basket?', ask: 'How many apples?', show: { kind: 'basket', apples: 4 }, type: 'int', value: '4', hint: 'count the apples again.' },
  { say: 'Which floor is the car park, one under the ground?', ask: 'Which floor is the car park?', show: { kind: 'lift', lowest: -2, highest: 3 }, type: 'int', value: '-1', hint: 'under the ground needs a minus sign.' },
  { say: 'How full is the glass, if empty is 0 and full is 1?', ask: 'How full is the glass?', show: { kind: 'glass', level: 0.5 }, type: 'float', value: '0.5', hint: 'the water is exactly halfway.' },
  { lead: 'A football match is two halves of 45 minutes.', say: 'How long is a match, in hours?', ask: 'How many hours is 90 minutes?', show: { kind: 'match' }, type: 'float', value: '1.5', hint: 'it is halfway between one hour and two.' },
  { say: 'Is the lamp on?', ask: 'Is the lamp on?', show: { kind: 'lamp' }, type: 'bool', value: 'False', hint: 'but look at the lamp again.' },
  { say: 'Is 3 more than 5?', ask: 'Is 3 more than 5?', show: { kind: 'balance', left: 3, right: 5, op: '>' }, type: 'bool', value: 'False', hint: 'but which side of the balance sits lower?' },
  { say: 'Write the name Mira on the card, for Mira to read.', ask: 'Write "Mira" on the card.', show: { kind: 'card' }, type: 'str', value: 'Mira', hint: 'spell it exactly: Mira.' },
  { say: 'Write the word hello on the card, for a person to read.', ask: 'Write "hello" on the card.', show: { kind: 'card' }, type: 'str', value: 'hello', hint: 'spell it exactly: hello.' },
  { say: 'What letter does the word gear start with?', ask: 'The first letter of "gear"?', show: { kind: 'tiles', parts: ['"gear"'] }, type: 'char', value: 'g', word: 'gear', hint: 'which tile comes first?' },
  { say: 'Write the first letter of Mira’s name on the card.', ask: 'The first letter of "Mira"?', show: { kind: 'card' }, type: 'char', value: 'M', word: 'Mira', hint: 'her name starts with a capital.' },
]

/** Why a question wants its kind, said when the kind was wrong. */
const KIND_WHY: Record<Kind, string> = {
  bool: 'A yes-or-no question is answered `True` or `False`.',
  int: 'Things you count are whole numbers, with no dot.',
  float: 'A measurement can land between whole numbers, so it needs a dot.',
  char: 'One letter goes in quotes too, as a `str` one character long.',
  str: 'Words for people go in quotes.',
}

const KIND_PRAISE: Record<Kind, string> = {
  bool: 'Yes or no, so a `bool`.',
  int: 'Counted, so an `int`.',
  float: 'Measured, so a `float`.',
  char: 'One letter, so a char, which Python keeps as a `str` of length one.',
  str: 'Words for a person, so a `str`.',
}

/**
 * Judges a single character the player wrote in quotes: the right letter
 * of `word`, which the question named. Shared by the char skill and the
 * char situations of the kind skill, so the two cannot disagree about
 * what a miss was.
 */
function judgeChar(a: Attempt, want: string, word: string, hint: string): Judgement {
  if (!a.ok) {
    return failed(a, {
      NameError: 'Without quotes, the robot looked for a name and found none. A letter goes in quotes.',
    })
  }
  const t = a.thought
  if (!t) return { verdict: 'ignore' }
  if (t.type !== 'str') return { verdict: 'wrong', why: `That is ${article(t.type)} \`${t.type}\`. A letter goes in quotes.` }
  const got = textOf(t) ?? ''
  const n = [...got].length
  if (got === want) return { verdict: 'correct' }
  if (n === 0) return { verdict: 'wrong', why: 'Those quotes hold nothing. Put one letter between them.' }
  if (got.toLowerCase() === word.toLowerCase()) return { verdict: 'wrong', why: 'That is the whole word. The question wants one letter of it.' }
  if (n > 1) return { verdict: 'wrong', why: `That is ${n} characters. A character is just one.` }
  if (got.toLowerCase() === want.toLowerCase()) return { verdict: 'wrong', why: `Nearly: ${word} has ${want === want.toUpperCase() ? 'a capital' : 'a small'} ${want}.` }
  return { verdict: 'wrong', why: `One letter, but not that one: ${hint}` }
}

export const GENERATORS: Record<string, Generator> = {
  // The warm-up's skills ask about a picture on the stage, the way the
  // lessons do: the same situations, new numbers each time, and the
  // answer drawn into the picture. The remembering skills below are
  // about memory, which the memory graph already draws.

  int(r) {
    if (r() < 0.5) {
      const n = between(r, 2, 6)
      return {
        key: `int:apples:${n}`,
        skill: 'int',
        tag: 'you',
        say: 'How many apples are in the basket?',
        ask: 'How many apples?',
        show: { kind: 'basket', apples: n },
        setup: [],
        answer: String(n),
        expect: { type: 'int', repr: String(n) },
        praise: 'Counted, so an `int`.',
        judge(a) {
          if (!a.ok) return failed(a, { NameError: 'Write the number in digits, like `3`.' })
          const t = a.thought
          if (!t) return { verdict: 'ignore' }
          if (t.type === 'float') return { verdict: 'wrong', why: 'The dot means measured, but apples are counted.' }
          if (t.type !== 'int') return { verdict: 'wrong', why: `That is ${article(t.type)} \`${t.type}\`. A count is a whole number.` }
          if (t.repr !== String(n)) return { verdict: 'wrong', why: 'Count again: your number is drawn above the basket.' }
          return { verdict: 'correct' }
        },
      }
    }
    const [question, short, floor] = pick(r, [
      ['Which floor is the car park, one under the ground?', 'Down to the car park.', -1],
      ['Which floor is the cellar, two under the ground?', 'Down to the cellar.', -2],
      ['Which floor is the ground floor?', 'To the ground floor.', 0],
      ['Which floor is the top floor?', 'Up to the top floor.', 3],
      ['Which floor is two up from the ground?', 'Two floors up.', 2],
    ] as const)
    return {
      key: `int:lift:${floor}`,
      skill: 'int',
      tag: 'you',
      say: question,
      ask: short,
      show: { kind: 'lift', lowest: -2, highest: 3 },
      setup: [],
      answer: String(floor),
      expect: { type: 'int', repr: String(floor) },
      praise: 'Floors are counted, below zero too, so an `int`.',
      judge(a) {
        if (!a.ok) return failed(a, { NameError: 'Write the floor in digits, like `2`.' })
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.type === 'float') return { verdict: 'wrong', why: 'Stuck between floors! A lift stops at whole floors, so no dot.' }
        if (t.type !== 'int') return { verdict: 'wrong', why: `That is ${article(t.type)} \`${t.type}\`. A floor is a whole number.` }
        if (floor < 0 && t.repr === String(-floor)) return { verdict: 'wrong', why: 'That sent it up. Under the ground needs a minus sign.' }
        if (t.repr !== String(floor)) return { verdict: 'wrong', why: `The lift went to floor ${t.repr}, and floor 0 is the ground.` }
        return { verdict: 'correct' }
      },
    }
  },

  float(r) {
    // Tenths, which the glass is marked in, so each can be read by eye.
    const level = pick(r, [0.2, 0.3, 0.5, 0.7, 0.8] as const)
    const want = String(level)
    return {
      key: `float:glass:${level}`,
      skill: 'float',
      tag: 'you',
      say: 'How full is the glass, if empty is `0` and full is `1`?',
      ask: 'How full is the glass?',
      show: { kind: 'glass', level },
      setup: [],
      answer: want,
      expect: { type: 'float', repr: want },
      praise: 'Measured, so a `float`.',
      judge(x) {
        if (!x.ok) return failed(x)
        const t = x.thought
        if (!t) return { verdict: 'ignore' }
        if (t.type === 'tuple' && /,/.test(x.source)) return { verdict: 'wrong', why: 'Python writes the point as a dot, not a comma.' }
        if (t.type === 'int') return { verdict: 'wrong', why: 'No whole number fits: it is between `0` and `1`, so use a dot.' }
        if (t.type !== 'float') return { verdict: 'wrong', why: `That is ${article(t.type)} \`${t.type}\`. A measurement is a number with a dot.` }
        const n = Number(t.repr)
        // A picture is read by eye, so close is right.
        if (Math.abs(n - level) > 0.051) return { verdict: 'wrong', why: `I filled the other glass to ${t.repr}. Compare the two.` }
        return { verdict: 'correct' }
      },
    }
  },

  str(r) {
    const w = pick(r, WORDS)
    const want = strRepr(w)
    return {
      key: `str:${w}`,
      skill: 'str',
      tag: 'you',
      say: `Write the word ${w} on the card, for a person to read.`,
      ask: `Write "${w}" on the card.`,
      show: { kind: 'card' },
      setup: [],
      answer: `"${w}"`,
      expect: { type: 'str', repr: want },
      praise: 'Words for people, so a `str`.',
      judge(a) {
        if (!a.ok) return failed(a, { NameError: `Without quotes, the robot looked for a name called \`${w}\` and found none.` })
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.type !== 'str') return { verdict: 'wrong', why: `That is ${article(t.type)} \`${t.type}\`. Words go in quotes.` }
        if (t.repr !== want) return { verdict: 'wrong', why: `Close. Spell it exactly: ${w}.` }
        return { verdict: 'correct' }
      },
    }
  },

  char(r) {
    // One letter of a word the picture spells out. The word's tiles are
    // the question; the answer's tiles replace them, and say how many
    // characters there are, so "gear" for "g" is drawn as four.
    const w = pick(r, WORDS)
    const end = r() < 0.35
    const want = end ? w[w.length - 1]! : w[0]!
    return {
      key: `char:${end ? 'last' : 'first'}:${w}`,
      skill: 'char',
      tag: 'you',
      say: `What letter does the word ${w} ${end ? 'end' : 'start'} with?`,
      ask: `The ${end ? 'last' : 'first'} letter of "${w}"?`,
      show: { kind: 'tiles', parts: [`"${w}"`] },
      setup: [],
      answer: `"${want}"`,
      expect: { type: 'str', repr: strRepr(want) },
      praise: 'One letter in quotes: a char, which Python keeps as a `str` of length one.',
      judge: (a) => judgeChar(a, want, w, `which tile comes ${end ? 'last' : 'first'}?`),
    }
  },

  bool(r) {
    if (r() < 0.4) {
      const on = r() < 0.5
      const word = on ? 'True' : 'False'
      return {
        key: `bool:lamp:${word}`,
        skill: 'bool',
        tag: 'you',
        say: `Turn the lamp ${on ? 'on' : 'off'}.`,
        ask: `Turn the lamp ${on ? 'on' : 'off'}.`,
        show: { kind: 'lamp' },
        setup: [],
        answer: word,
        expect: { type: 'bool', repr: word },
        praise: on ? 'A switch is on or off, so a `bool`, and on is `True`.' : 'A switch is on or off, so a `bool`, and off is `False`.',
        judge(a) {
          const lower = lowerBool(a.source.trim())
          if (lower) return { verdict: 'wrong', why: `Nearly: it needs a capital letter, \`${lower}\`.` }
          if (!a.ok) return failed(a, { NameError: 'The robot says on as `True` and off as `False`.' })
          const t = a.thought
          if (!t) return { verdict: 'ignore' }
          if (t.type === 'str') return { verdict: 'wrong', why: 'That is a word on a note, and a note works no switch. No quotes.' }
          if (t.type !== 'bool') return { verdict: 'wrong', why: 'A switch has only two answers: `True` or `False`.' }
          return t.repr === word ? { verdict: 'correct' } : { verdict: 'wrong', why: `That turned it ${on ? 'off' : 'on'}.` }
        },
      }
    }
    const x = between(r, 1, 9)
    let y = between(r, 1, 9)
    if (y === x) y = x === 9 ? 8 : x + 1
    const truth = x > y
    const word = truth ? 'True' : 'False'
    return {
      key: `bool:${x}:${y}`,
      skill: 'bool',
      tag: 'you',
      say: `Is ${x} more than ${y}?`,
      ask: `Is ${x} more than ${y}?`,
      show: { kind: 'balance', left: x, right: y, op: '>' },
      setup: [],
      answer: word,
      expect: { type: 'bool', repr: word },
      praise: truth ? `${x} is more than ${y}, so the answer is yes: \`True\`.` : `${x} is less than ${y}, so the answer is no: \`False\`.`,
      judge(a) {
        const said = a.source.trim()
        const lower = lowerBool(said)
        if (lower) return { verdict: 'wrong', why: `Nearly: it needs a capital letter, \`${lower}\`.` }
        if (!a.ok) return failed(a)
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (said !== 'True' && said !== 'False') return { verdict: 'wrong', why: 'This one is yours to answer: just `True` or `False`.' }
        return t.repr === word ? { verdict: 'correct' } : { verdict: 'wrong', why: 'Look again: the bigger number sits lower on the balance.' }
      },
    }
  },

  kind(r) {
    // The question decides the kind: the first level's lesson, asked with
    // no hint about which kind to use.
    const s = pick(r, SITUATIONS)
    const type = PY_TYPE[s.type]
    const quoted = s.type === 'str' || s.type === 'char'
    const want = quoted ? strRepr(s.value) : s.value
    return {
      key: `kind:${s.say}`,
      skill: 'kind',
      tag: 'you',
      say: s.say,
      lead: s.lead ? [s.lead] : undefined,
      ask: s.ask,
      show: s.show,
      setup: [],
      answer: quoted ? `"${s.value}"` : s.value,
      expect: { type, repr: want },
      praise: KIND_PRAISE[s.type],
      judge(a) {
        const said = a.source.trim()
        const lower = lowerBool(said)
        if (lower) return { verdict: 'wrong', why: `Nearly: it needs a capital letter, \`${lower}\`.` }
        if (s.type === 'char') {
          // A str that is not one letter is the right Python type and the
          // wrong idea, which only the char judge can tell apart.
          if (a.ok && a.thought && a.thought.type !== 'str') {
            return { verdict: 'wrong', why: `That is ${article(a.thought.type)} \`${a.thought.type}\`. ${KIND_WHY.char}` }
          }
          return judgeChar(a, s.value, s.word ?? s.value, s.hint)
        }
        if (!a.ok) return failed(a, { NameError: s.type === 'str' ? 'Without quotes, the robot looked for a name. Words go in quotes.' : KIND_WHY[s.type] })
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.type !== type) return { verdict: 'wrong', why: `That is ${article(t.type)} \`${t.type}\`. ${KIND_WHY[s.type]}` }
        if (t.repr !== want) return { verdict: 'wrong', why: `Right kind, but ${s.hint}` }
        return { verdict: 'correct' }
      },
    }
  },

  arith(r) {
    const kind = pick(r, ['*', '+', '-'] as const)
    let x: number
    let y: number
    let show: Prop
    let say: string
    let ask: string
    let praise: string
    if (kind === '*') {
      x = between(r, 2, 7)
      y = between(r, 2, 6)
      show = { kind: 'crates', crates: x, each: y }
      say = `How many bolts are in ${x} crates of ${y}?`
      ask = `${x} crates of ${y} bolts.`
      praise = `${x} crates of ${y} is ${x} times ${y}, and the robot writes times as \`*\`.`
    } else if (kind === '-') {
      x = between(r, 8, 20)
      y = between(r, 2, x - 2)
      show = { kind: 'bolts', have: x, use: y }
      say = `How many bolts are left, if the robot has ${x} and uses ${y}?`
      ask = `${x} bolts, ${y} used.`
      praise = 'Using some up takes them away, so a minus: `-`.'
    } else {
      x = between(r, 3, 12)
      y = between(r, 2, 9)
      show = { kind: 'tiles', parts: [String(x), '+', String(y)] }
      say = `How many bolts are in a box of ${x} and a box of ${y}, together?`
      ask = `${x} bolts and ${y} bolts.`
      praise = 'Putting two boxes together adds them, so a plus: `+`.'
    }
    const e = bin(kind, int(x), int(y))
    const want = value(e)
    return {
      key: `arith:${kind}:${x}:${y}`,
      skill: 'arith',
      tag: 'robot',
      say,
      ask,
      show,
      setup: [],
      answer: render(e),
      expect: { type: 'int', repr: want },
      praise,
      judge(a) {
        if (!a.ok) return failed(a, /[x×]/.test(a.source) ? { SyntaxError: 'The robot writes times as a star: `*`.', NameError: 'The robot writes times as a star: `*`.' } : {})
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.repr === want && !WORKING.test(a.source)) return { verdict: 'wrong', why: 'That is the answer, but this one is the robot’s: give it the sum.' }
        if (t.repr === want) return { verdict: 'correct' }
        return { verdict: 'wrong', why: `That comes to ${t.repr}, but this is ${x} ${OPS_WORD[kind]} ${y}.` }
      },
    }
  },

  divide(r) {
    const b = between(r, 2, 3)
    // Sometimes it shares out exactly, which is the case worth seeing:
    // `8 / 2` is `4.0`, a float, even though nothing is left over.
    const a = r() < 0.4 ? b * between(r, 2, 6) : between(r, b + 1, 6 * b)
    const e = bin('/', int(a), int(b))
    const want = value(e)
    const exact = Number.isInteger(a / b)
    return {
      key: `divide:${a}:${b}`,
      skill: 'divide',
      tag: 'robot',
      say: `How much does each robot get, if ${a} litres of oil are shared between ${b}?`,
      ask: `Share ${a} litres between ${b}.`,
      show: { kind: 'share', litres: a, robots: b },
      setup: [],
      answer: render(e),
      expect: { type: 'float', repr: want },
      praise: exact
        ? `\`/\` always gives a \`float\`, even when it shares out exactly: ${want}.`
        : 'Sharing out is `/`, and it can land between whole litres, so a `float`.',
      judge(x) {
        if (!x.ok) return failed(x)
        const t = x.thought
        if (!t) return { verdict: 'ignore' }
        if (t.repr === want && !/\//.test(x.source)) return { verdict: 'wrong', why: 'That is the amount, but let the robot share it out, with `/`.' }
        if (t.repr === want) return { verdict: 'correct' }
        if (t.type === 'int' && /\/\//.test(x.source)) return { verdict: 'wrong', why: '`//` keeps whole litres only, and leaves some in the jug. Use `/`.' }
        if (t.type === 'int') return { verdict: 'wrong', why: 'Sharing out can land between whole litres, so divide with `/`.' }
        return { verdict: 'wrong', why: `That comes to ${t.repr}. Share ${a} between ${b}, with \`/\`.` }
      },
    }
  },

  join(r) {
    const [x, y] = pick(r, PAIRS)
    const e = bin('+', str(x), str(y))
    const want = value(e)
    const spaced = strRepr(`${x} ${y}`)
    return {
      key: `join:${x}${y}`,
      skill: 'join',
      tag: 'robot',
      say: `Can the robot join "${x}" and "${y}" into one word?`,
      ask: `Join "${x}" and "${y}".`,
      show: { kind: 'tiles', parts: [`"${x}"`, '+', `"${y}"`] },
      setup: [],
      answer: render(e),
      expect: { type: 'str', repr: want },
      praise: '`+` on two strings puts them end to end, so one word.',
      judge(a) {
        if (!a.ok) return failed(a, { NameError: 'Each word needs its own quotes.' })
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.repr === want && !/\+/.test(a.source)) return { verdict: 'wrong', why: 'That is the word, but let the robot join them, with `+`.' }
        if (t.repr === want) return { verdict: 'correct' }
        if (t.repr === spaced) return { verdict: 'wrong', why: 'One word, so no space in between.' }
        return { verdict: 'wrong', why: `That made ${t.repr}. Join "${x}" and "${y}" with \`+\`.` }
      },
    }
  },

  compare(r) {
    const x = between(r, 1, 9)
    let y = between(r, 1, 9)
    if (y === x) y = x === 9 ? 7 : x + 2
    const op = pick(r, ['>', '<'] as const)
    const e = bin(op, int(x), int(y))
    const want = value(e)
    const words = op === '>' ? 'more' : 'less'
    return {
      key: `compare:${x}${op}${y}`,
      skill: 'compare',
      tag: 'robot',
      say: `Is ${x} ${words} than ${y}?`,
      ask: `Is ${x} ${words} than ${y}?`,
      show: { kind: 'balance', left: x, right: y, op },
      setup: [],
      answer: render(e),
      expect: { type: 'bool', repr: want },
      praise: `\`${op}\` asks if ${x} is ${words} than ${y}, and the robot answers with a \`bool\`.`,
      judge(a) {
        if (!a.ok) return failed(a)
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (!/[<>]/.test(a.source)) return { verdict: 'wrong', why: 'Ask the robot, with `>` or `<`, and let it answer.' }
        if (!mentions(a.source, x) || !mentions(a.source, y)) return { verdict: 'wrong', why: `Ask about ${x} and ${y} themselves.` }
        if (t.repr === want) return { verdict: 'correct' }
        return { verdict: 'wrong', why: `That asks it the other way round: ${words} than is \`${op}\`.` }
      },
    }
  },

  order(r) {
    const x = between(r, 2, 9)
    const y = between(r, 2, 9)
    const z = between(r, 2, 9)
    if (r() < 0.5) {
      // Predict: the player works it out, which is the only way to show
      // they know `*` goes first.
      const e = bin('+', int(x), bin('*', int(y), int(z)))
      const want = value(e)
      const leftToRight = String((x + y) * z)
      return {
        key: `order:predict:${x}:${y}:${z}`,
        skill: 'order',
        tag: 'you',
        say: `What does \`${render(e)}\` come to?`,
        ask: `What is ${render(e)}?`,
        show: { kind: 'expr', text: render(e), first: `${y} * ${z}`, then: [`${x} + ${y * z}`, want] },
        setup: [],
        answer: want,
        expect: { type: 'int', repr: want },
        praise: `\`*\` goes before \`+\`, so \`${y} * ${z}\` first, then add ${x}.`,
        judge(a) {
          const said = a.source.trim()
          if (!INT_LITERAL.test(said)) return { verdict: 'wrong', why: 'This one is yours to work out: type just the number.' }
          if (said === want) return { verdict: 'correct' }
          if (said === leftToRight) return { verdict: 'wrong', why: 'That is working left to right, but `*` goes before `+`.' }
          return { verdict: 'wrong', why: `Not quite. Do \`${y} * ${z}\` first.` }
        },
      }
    }
    const e = bin('*', bin('+', int(x), int(y)), int(z))
    const want = value(e)
    const unbracketed = value(bin('+', int(x), bin('*', int(y), int(z))))
    return {
      key: `order:brackets:${x}:${y}:${z}`,
      skill: 'order',
      tag: 'robot',
      say: `Can you give the robot one line that adds ${x} and ${y} first, then times by ${z}?`,
      ask: `${x} + ${y} first, then × ${z}.`,
      show: { kind: 'expr', text: render(e), first: `(${x} + ${y})`, then: [`${x + y} * ${z}`, want] },
      setup: [],
      answer: render(e),
      expect: { type: 'int', repr: want },
      praise: 'Brackets are worked out first, so the add came before the times.',
      judge(a) {
        if (!a.ok) return failed(a)
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (!WORKING.test(a.source)) return { verdict: 'wrong', why: 'That is a number, but this one is the robot’s: give it the working.' }
        if (t.repr === want) return { verdict: 'correct' }
        if (t.repr === unbracketed) return { verdict: 'wrong', why: 'Without brackets `*` goes first. Put `( )` round the part to do first.' }
        return { verdict: 'wrong', why: `That comes to ${t.repr}. Add ${x} and ${y} first, then times by ${z}.` }
      },
    }
  },

  bind(r) {
    const n = pick(r, THINGS)
    const k = between(r, 2, 60)
    return {
      key: `bind:${n}:${k}`,
      skill: 'bind',
      tag: 'you',
      say: `Can you keep ${k} ${n} under the name \`${n}\`?`,
      setup: [],
      answer: `${n} = ${k}`,
      praise: `\`${n}\` is an arrow to ${k} now, so the robot can find it again.`,
      judge(a) {
        if (!a.ok) {
          return failed(a, {
            SyntaxError: `The name goes on the left: \`${n} = ${k}\`.`,
            NameError: `Give it the name with \`=\`: \`${n} = ${k}\`.`,
          })
        }
        const got = reprOf(a.snapshot, n)
        if (got === String(k)) return { verdict: 'correct' }
        if (got !== null) return { verdict: 'wrong', why: `\`${n}\` points at ${got}, but it should be ${k}.` }
        if (a.thought) return { verdict: 'wrong', why: 'That was thought of and let go. Give it a name with `=`.' }
        // Something was named, just not this.
        if (a.snapshot.bindings.length > 0) return { verdict: 'wrong', why: `That named something else. The name should be \`${n}\`.` }
        return { verdict: 'ignore' }
      },
    }
  },

  alias(r) {
    const [a, b] = pick(r, [
      ['first', 'second'],
      ['here', 'there'],
      ['mine', 'yours'],
      ['left', 'right'],
      ['old', 'new'],
    ] as const)
    const v = between(r, 10, 99)
    return {
      key: `alias:${a}:${b}:${v}`,
      skill: 'alias',
      tag: 'robot',
      lead: [`\`${a}\` points at ${v}: look for its arrow in memory.`],
      say: `Can you point \`${b}\` at the same object, without typing ${v}?`,
      setup: [`${a} = ${v}`],
      answer: `${b} = ${a}`,
      praise: `\`${b} = ${a}\` follows \`${a}\`’s arrow, so both names point at one object.`,
      judge(x) {
        if (!x.ok) return failed(x, { SyntaxError: `The new name goes on the left: \`${b} = ${a}\`.` })
        const ta = targetOf(x.snapshot, a)
        const tb = targetOf(x.snapshot, b)
        if (tb === null) return x.thought ? { verdict: 'wrong', why: `Give \`${b}\` something to point at, with \`=\`.` } : { verdict: 'ignore' }
        if (tb !== ta) return { verdict: 'wrong', why: `\`${b}\` points at a different object. Use \`${a}\` itself.` }
        if (mentions(x.source, v)) return { verdict: 'wrong', why: `Right object, but you typed ${v} again. Use the name \`${a}\`.` }
        return { verdict: 'correct' }
      },
    }
  },

  rebind(r) {
    const v1 = between(r, 2, 40)
    let v2 = between(r, 41, 99)
    if (v2 === v1) v2 += 1
    const [x, y] = pick(r, [
      ['x', 'y'],
      ['a', 'b'],
      ['top', 'bottom'],
    ] as const)
    // Predict what the copy points at once the original has moved: the
    // misconception this skill exists for is that `y` follows `x`.
    return {
      key: `rebind:${x}:${v1}:${v2}`,
      skill: 'rebind',
      tag: 'you',
      lead: [`\`${y} = ${x}\` pointed \`${y}\` at \`${x}\`’s object.`, `Then \`${x}\` moved to ${v2}.`],
      say: `What number does \`${y}\` point at now?`,
      setup: [`${x} = ${v1}`, `${y} = ${x}`, `${x} = ${v2}`],
      answer: String(v1),
      expect: { type: 'int', repr: String(v1) },
      praise: `\`${y}\` got \`${x}\`’s object, not \`${x}\` itself, so moving \`${x}\` left it alone.`,
      judge(a) {
        const said = a.source.trim()
        if (said === y) return { verdict: 'wrong', why: 'This one is yours: type the number you think it is.' }
        if (!INT_LITERAL.test(said)) return { verdict: 'wrong', why: 'Type just the number.' }
        if (said === String(v1)) return { verdict: 'correct' }
        if (said === String(v2)) return { verdict: 'wrong', why: `\`${y}\` does not follow \`${x}\`. It points at the object it was given.` }
        return { verdict: 'wrong', why: `Look at the arrows in memory: where does \`${y}\` point?` }
      },
    }
  },

  recall(r) {
    const n = pick(r, ['crates', 'boxes', 'bags'] as const)
    const k = between(r, 3, 12)
    // Never the same as `k`: the answer `crates * 7` would then "mention"
    // the 7 it was asked not to type, and the judge would refuse the very
    // line it offers as the answer.
    let each = between(r, 2, 9)
    if (each === k) each = k === 9 ? 8 : k + 1
    const want = String(k * each)
    return {
      key: `recall:${n}:${k}:${each}`,
      skill: 'recall',
      tag: 'robot',
      lead: [`The robot kept \`${n}\`, and each one holds ${each} bolts.`],
      say: `How many bolts in all, worked out from \`${n}\` without typing ${k}?`,
      setup: [`${n} = ${k}`],
      answer: `${n} * ${each}`,
      expect: { type: 'int', repr: want },
      praise: `It never stored ${want}. It kept ${k}, and worked the rest out.`,
      judge(a) {
        if (!a.ok) return failed(a, { NameError: `Use the name it kept: \`${n}\`.` })
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.repr !== want) return { verdict: 'wrong', why: `That comes to ${t.repr}, but this is ${n} times ${each}.` }
        if (!new RegExp(`\\b${n}\\b`).test(a.source) || mentions(a.source, k))
          return { verdict: 'wrong', why: `Right number, but work it out from \`${n}\`, not from ${k}.` }
        return { verdict: 'correct' }
      },
    }
  },
}

/** One exercise for this skill, from this seed. */
export function generate(skill: string, seed: number): Exercise {
  const g = GENERATORS[skill]
  if (!g) throw new Error(`no generator for skill: ${skill}`)
  return g(rng(seed))
}
