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
 * Every generator is deterministic in its seed: the same seed is the same
 * question, which is what makes a session reproducible in a test.
 */
import type { Thought } from '../memory/extract'
import type { MemorySnapshot } from '../memory/model'
import type { Prop } from '../scene/props'
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

export type Exercise = {
  /** Identifies the question, so a session does not ask it twice. */
  key: string
  skill: string
  /** What the crow asks. Backticks render as code. */
  say: string
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
  /** Said when it is right, after the general praise. */
  praise?: string | undefined
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
const COMPARISON = /[<>]=?|==|!=/
/** A number written as itself in the source, not as part of a longer one. */
const mentions = (source: string, n: number) => new RegExp(`(^|[^\\d.])${n}([^\\d.]|$)`).test(source)

const value = (e: Expr, env = {}) => repr(evaluate(e, env))

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

/** Questions whose kind is decided by what they ask, each about a
 *  picture from the first level, and their answers as Python writes them. */
const SITUATIONS: { say: string; ask: string; show: Prop; type: 'bool' | 'int' | 'float' | 'str'; value: string; hint: string }[] = [
  { say: 'How many hollows does this egg box have?', ask: 'How many hollows?', show: { kind: 'carton', slots: 6 }, type: 'int', value: '6', hint: 'count the hollows again.' },
  { say: 'How many apples are in the basket?', ask: 'How many apples?', show: { kind: 'basket', apples: 4 }, type: 'int', value: '4', hint: 'count the apples again.' },
  { say: 'Which floor is the car park, one under the ground?', ask: 'Which floor is the car park?', show: { kind: 'lift', lowest: -2, highest: 3 }, type: 'int', value: '-1', hint: 'under the ground needs a minus sign.' },
  { say: 'How full is the glass? Empty is 0 and full is 1.', ask: 'How full is the glass?', show: { kind: 'glass', level: 0.5 }, type: 'float', value: '0.5', hint: 'the water is exactly halfway.' },
  { say: 'A football match is two halves of 45 minutes. How long is it, in hours?', ask: 'How many hours is 90 minutes?', show: { kind: 'match' }, type: 'float', value: '1.5', hint: 'halfway between one hour and two.' },
  { say: 'Is the lamp on?', ask: 'Is the lamp on?', show: { kind: 'lamp' }, type: 'bool', value: 'False', hint: 'but look at the lamp.' },
  { say: 'Is 3 more than 5? Just answer.', ask: 'Is 3 more than 5?', show: { kind: 'balance', left: 3, right: 5, op: '>' }, type: 'bool', value: 'False', hint: 'but which side of the balance is lower?' },
  { say: 'Write the name Mira on the card, for Mira to read.', ask: 'Write "Mira" on the card.', show: { kind: 'card' }, type: 'str', value: 'Mira', hint: 'spell it exactly: Mira.' },
  { say: 'Write the word hello on the card, for a person to read.', ask: 'Write "hello" on the card.', show: { kind: 'card' }, type: 'str', value: 'hello', hint: 'spell it exactly: hello.' },
]

/** Why a question wants its kind, said when the kind was wrong. */
const KIND_WHY: Record<'bool' | 'int' | 'float' | 'str', string> = {
  bool: 'A yes-or-no question is answered `True` or `False`.',
  int: 'Things you count are whole numbers — no dot.',
  float: 'Something measured, between whole numbers, needs a dot.',
  str: 'Words for people go in quotes.',
}

const KIND_PRAISE: Record<'bool' | 'int' | 'float' | 'str', string> = {
  bool: 'Yes or no, so a `bool`.',
  int: 'Counted, so an `int`.',
  float: 'Measured, so a `float`.',
  str: 'Words for a person, so a `str`.',
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
        say: 'How many apples are in the basket?',
        ask: 'How many apples?',
        show: { kind: 'basket', apples: n },
        setup: [],
        answer: String(n),
        expect: { type: 'int', repr: String(n) },
        praise: 'Counted, so an `int`.',
        judge(a) {
          if (!a.ok) return failed(a, { NameError: 'Write the number with digits, like `3`.' })
          const t = a.thought
          if (!t) return { verdict: 'ignore' }
          if (t.type === 'float') return { verdict: 'wrong', why: 'The dot means measured. Apples are counted — no dot.' }
          if (t.type !== 'int') return { verdict: 'wrong', why: `That is a \`${t.type}\`. How many is a whole number.` }
          if (t.repr !== String(n)) return { verdict: 'wrong', why: 'Count the apples again — your count is drawn above the basket.' }
          return { verdict: 'correct' }
        },
      }
    }
    const [where, floor] = pick(r, [
      ['the car park, one floor under the ground', -1],
      ['the cellar, two floors under the ground', -2],
      ['the ground floor', 0],
      ['the top floor', 3],
      ['two floors up from the ground', 2],
    ] as const)
    return {
      key: `int:lift:${floor}`,
      skill: 'int',
      say: `Send the lift to ${where}. Which floor is that?`,
      ask: `Which floor is ${where.split(',')[0]}?`,
      show: { kind: 'lift', lowest: -2, highest: 3 },
      setup: [],
      answer: String(floor),
      expect: { type: 'int', repr: String(floor) },
      praise: 'Floors are counted, below zero too.',
      judge(a) {
        if (!a.ok) return failed(a)
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.type === 'float') return { verdict: 'wrong', why: 'Stuck between floors! A lift stops at whole floors — no dot.' }
        if (t.type !== 'int') return { verdict: 'wrong', why: `That is a \`${t.type}\`. A floor is a whole number.` }
        if (floor < 0 && t.repr === String(-floor)) return { verdict: 'wrong', why: 'That is *up*. Under the ground needs a minus sign.' }
        if (t.repr !== String(floor)) return { verdict: 'wrong', why: `The lift went to floor ${t.repr}. Floor 0 is the ground.` }
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
      say: 'How full is the glass? Empty is `0` and full is `1` — measure it.',
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
        if (t.type === 'tuple' && /,/.test(x.source)) return { verdict: 'wrong', why: 'Python writes the dot as a full stop, not a comma.' }
        if (t.type === 'int') return { verdict: 'wrong', why: 'No whole number fits — it is between `0` and `1`. Use a dot.' }
        if (t.type !== 'float') return { verdict: 'wrong', why: `That is a \`${t.type}\`. A measurement is a number with a dot.` }
        const n = Number(t.repr)
        // A picture is read by eye, so close is right.
        if (Math.abs(n - level) > 0.051) return { verdict: 'wrong', why: `I filled the other glass to ${t.repr} — compare them.` }
        return { verdict: 'correct' }
      },
    }
  },

  str(r) {
    const w = pick(r, WORDS)
    const want = repr({ t: 'str', v: w })
    return {
      key: `str:${w}`,
      skill: 'str',
      say: `Write the word ${w} on the card, so a person can read it.`,
      ask: `Write "${w}" on the card.`,
      show: { kind: 'card' },
      setup: [],
      answer: `"${w}"`,
      expect: { type: 'str', repr: want },
      praise: 'Words for people, so a `str`.',
      judge(a) {
        if (!a.ok) return failed(a, { NameError: `Without quotes, the robot looked for a name called \`${w}\`. Text goes in quotes.` })
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.type !== 'str') return { verdict: 'wrong', why: `That is a \`${t.type}\`. Text goes in quotes.` }
        if (t.repr !== want) return { verdict: 'wrong', why: `Close — spell it exactly: ${w}.` }
        return { verdict: 'correct' }
      },
    }
  },

  bool(r) {
    if (r() < 0.4) {
      const on = r() < 0.5
      const word = on ? 'True' : 'False'
      return {
        key: `bool:lamp:${word}`,
        skill: 'bool',
        say: `Turn the lamp ${on ? 'on' : 'off'}. The switch only knows \`True\` and \`False\`.`,
        ask: `Turn the lamp ${on ? 'on' : 'off'}.`,
        show: { kind: 'lamp' },
        setup: [],
        answer: word,
        expect: { type: 'bool', repr: word },
        praise: 'A switch is a `bool`.',
        judge(a) {
          const said = a.source.trim()
          if (said === 'true' || said === 'false') return { verdict: 'wrong', why: 'Capital letter: `True` or `False`.' }
          if (!a.ok) return failed(a, { NameError: 'The robot\'s on is `True` and its off is `False`.' })
          const t = a.thought
          if (!t) return { verdict: 'ignore' }
          if (t.type === 'str') return { verdict: 'wrong', why: 'A word on a note lights nothing. No quotes.' }
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
      say: `Look at the balance. Is ${x} more than ${y}? Answer with just \`True\` or \`False\` — no working out.`,
      ask: `Is ${x} more than ${y}?`,
      show: { kind: 'balance', left: x, right: y, op: '>' },
      setup: [],
      answer: word,
      expect: { type: 'bool', repr: word },
      praise: `${x} ${truth ? 'is' : 'is not'} more than ${y}.`,
      judge(a) {
        const said = a.source.trim()
        if (said === 'true' || said === 'false') return { verdict: 'wrong', why: 'Capital letter: `True` or `False`.' }
        if (!a.ok) return failed(a)
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (said !== 'True' && said !== 'False') return { verdict: 'wrong', why: 'Say it yourself — just `True` or `False`.' }
        return t.repr === word ? { verdict: 'correct' } : { verdict: 'wrong', why: 'Look again: which side of the balance is lower?' }
      },
    }
  },

  kind(r) {
    // The question decides the kind: the first level's lesson, asked with
    // no hint about which kind to use.
    const s = pick(r, SITUATIONS)
    const want = s.type === 'str' ? repr({ t: 'str', v: s.value }) : s.value
    return {
      key: `kind:${s.say}`,
      skill: 'kind',
      say: `${s.say} You choose the kind.`,
      ask: s.ask,
      show: s.show,
      setup: [],
      answer: s.type === 'str' ? `"${s.value}"` : s.value,
      expect: { type: s.type, repr: want },
      praise: KIND_PRAISE[s.type],
      judge(a) {
        const said = a.source.trim()
        if (said === 'true' || said === 'false') return { verdict: 'wrong', why: 'Capital letter: `True` or `False`.' }
        if (!a.ok) {
          return failed(a, {
            NameError: s.type === 'str' ? 'Words for people go in quotes.' : KIND_WHY[s.type],
          })
        }
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.type !== s.type) return { verdict: 'wrong', why: `That is a \`${t.type}\`. ${KIND_WHY[s.type]}` }
        if (t.repr !== want) return { verdict: 'wrong', why: `Right kind — ${s.hint}` }
        return { verdict: 'correct' }
      },
    }
  },

  arith(r) {
    const kind = pick(r, ['*', '+', '-'] as const)
    let x: number
    let y: number
    let show: Prop
    let story: string
    let ask: string
    if (kind === '*') {
      x = between(r, 2, 7)
      y = between(r, 2, 6)
      show = { kind: 'crates', crates: x, each: y }
      story = `${x} crates with ${y} bolts in each. How many bolts?`
      ask = `${x} crates of ${y} bolts.`
    } else if (kind === '-') {
      x = between(r, 8, 20)
      y = between(r, 2, x - 2)
      show = { kind: 'bolts', have: x, use: y }
      story = `The robot has ${x} bolts and uses ${y}. How many are left?`
      ask = `${x} bolts, ${y} used.`
    } else {
      x = between(r, 3, 12)
      y = between(r, 2, 9)
      show = { kind: 'tiles', parts: [String(x), '+', String(y)] }
      story = `${x} bolts in one box and ${y} in another. How many altogether?`
      ask = `${x} bolts and ${y} bolts.`
    }
    const e = bin(kind, int(x), int(y))
    const want = value(e)
    return {
      key: `arith:${kind}:${x}:${y}`,
      skill: 'arith',
      say: `${story} Ask the robot.`,
      ask,
      show,
      setup: [],
      answer: render(e),
      expect: { type: 'int', repr: want },
      judge(a) {
        if (!a.ok) return failed(a, { SyntaxError: 'Times is a star, `*`.' })
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.repr === want && !/[-+*]/.test(a.source)) return { verdict: 'wrong', why: 'Right number — now let the robot work it out.' }
        if (t.repr === want) return { verdict: 'correct' }
        return { verdict: 'wrong', why: `That comes to ${t.repr}. It is ${x} ${OPS_WORD[kind]} ${y}.` }
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
    return {
      key: `divide:${a}:${b}`,
      skill: 'divide',
      say: `Share ${a} litres of oil between ${b} robots. How much does each get?`,
      ask: `Share ${a} litres between ${b}.`,
      show: { kind: 'share', litres: a, robots: b },
      setup: [],
      answer: render(e),
      expect: { type: 'float', repr: want },
      praise: Number.isInteger(a / b) ? `Even when it shares out exactly, \`/\` gives a \`float\`: ${want}.` : undefined,
      judge(x) {
        if (!x.ok) return failed(x)
        const t = x.thought
        if (!t) return { verdict: 'ignore' }
        if (t.repr === want && !/\//.test(x.source)) return { verdict: 'wrong', why: 'Right amount — now let the robot share it, with `/`.' }
        if (t.repr === want) return { verdict: 'correct' }
        if (t.type === 'int' && /\/\//.test(x.source)) return { verdict: 'wrong', why: '`//` shares whole litres only — look what is left in the jug. Use `/`.' }
        if (t.type === 'int') return { verdict: 'wrong', why: 'Sharing out is a measurement: divide with `/`, which gives a `float`.' }
        return { verdict: 'wrong', why: `That comes to ${t.repr}. Share ${a} between ${b}.` }
      },
    }
  },

  join(r) {
    const [x, y] = pick(r, PAIRS)
    const e = bin('+', str(x), str(y))
    const want = value(e)
    const spaced = repr({ t: 'str', v: `${x} ${y}` })
    return {
      key: `join:${x}${y}`,
      skill: 'join',
      say: `Join "${x}" and "${y}" into one word.`,
      ask: `Glue "${x}" and "${y}".`,
      show: { kind: 'tiles', parts: [`"${x}"`, '+', `"${y}"`] },
      setup: [],
      answer: render(e),
      expect: { type: 'str', repr: want },
      judge(a) {
        if (!a.ok) return failed(a, { NameError: 'Each word needs its own quotes.' })
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.repr === want) return { verdict: 'correct' }
        if (t.repr === spaced) return { verdict: 'wrong', why: 'One word — no space in between.' }
        return { verdict: 'wrong', why: `That made ${t.repr}. Stick "${x}" and "${y}" together with \`+\`.` }
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
    return {
      key: `compare:${x}${op}${y}`,
      skill: 'compare',
      say: `Ask the robot whether ${x} is ${op === '>' ? 'more' : 'less'} than ${y}.`,
      ask: `Is ${x} ${op === '>' ? 'more' : 'less'} than ${y}?`,
      show: { kind: 'balance', left: x, right: y, op },
      setup: [],
      answer: render(e),
      expect: { type: 'bool', repr: want },
      judge(a) {
        if (!a.ok) return failed(a)
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (!COMPARISON.test(a.source)) return { verdict: 'wrong', why: 'Ask it — use `>` or `<`, and let the robot answer.' }
        if (t.repr === want) return { verdict: 'correct' }
        return { verdict: 'wrong', why: `That asks it the other way round. ${op === '>' ? 'More' : 'Less'} than is \`${op}\`.` }
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
        say: `No robot this time: what does \`${render(e)}\` come to? Type just the number.`,
        ask: `What is ${render(e)}?`,
        show: { kind: 'expr', text: render(e), first: `${y} * ${z}`, then: [`${x} + ${y * z}`, want] },
        setup: [],
        answer: want,
        expect: { type: 'int', repr: want },
        praise: `\`*\` goes before \`+\`: ${y} × ${z} first, then add ${x}.`,
        judge(a) {
          const said = a.source.trim()
          if (!INT_LITERAL.test(said)) return { verdict: 'wrong', why: 'Work it out yourself, and type just the number.' }
          if (said === want) return { verdict: 'correct' }
          if (said === leftToRight) return { verdict: 'wrong', why: 'That is working left to right. `*` goes before `+`.' }
          return { verdict: 'wrong', why: `Not quite. Do ${y} × ${z} first.` }
        },
      }
    }
    const e = bin('*', bin('+', int(x), int(y)), int(z))
    const want = value(e)
    const unbracketed = value(bin('+', int(x), bin('*', int(y), int(z))))
    return {
      key: `order:brackets:${x}:${y}:${z}`,
      skill: 'order',
      say: `Add ${x} and ${y} first, then multiply by ${z} — all in one line.`,
      ask: `${x} + ${y} first, then × ${z}.`,
      show: { kind: 'expr', text: render(e), first: `(${x} + ${y})`, then: [`${x + y} * ${z}`, want] },
      setup: [],
      answer: render(e),
      expect: { type: 'int', repr: want },
      judge(a) {
        if (!a.ok) return failed(a)
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.repr === want) return { verdict: 'correct' }
        if (t.repr === unbracketed) return { verdict: 'wrong', why: 'Without brackets `*` goes first. Put `( )` round the part to do first.' }
        return { verdict: 'wrong', why: `That comes to ${t.repr}. (${x} + ${y}) first, then × ${z}.` }
      },
    }
  },

  bind(r) {
    const n = pick(r, THINGS)
    const k = between(r, 2, 60)
    return {
      key: `bind:${n}:${k}`,
      skill: 'bind',
      say: `Keep ${k} ${n} under a name called \`${n}\`.`,
      setup: [],
      answer: `${n} = ${k}`,
      judge(a) {
        if (!a.ok) {
          return failed(a, {
            SyntaxError: `The name goes on the left: \`${n} = ${k}\`.`,
            NameError: `Give it the name with \`=\`: \`${n} = ${k}\`.`,
          })
        }
        const got = reprOf(a.snapshot, n)
        if (got === String(k)) return { verdict: 'correct' }
        if (got !== null) return { verdict: 'wrong', why: `\`${n}\` points at ${got} — it should be ${k}.` }
        if (a.thought) return { verdict: 'wrong', why: 'That was thought of and let go. Give it a name with `=`.' }
        // Something was named, just not this.
        if (a.snapshot.bindings.length > 0) return { verdict: 'wrong', why: `The name should be \`${n}\`.` }
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
      say: `\`${a}\` points at ${v}. Point \`${b}\` at the same thing — without typing ${v}.`,
      setup: [`${a} = ${v}`],
      answer: `${b} = ${a}`,
      praise: 'Two names, one object — look at the arrows.',
      judge(x) {
        if (!x.ok) return failed(x, { SyntaxError: `The new name goes on the left: \`${b} = ${a}\`.` })
        const ta = targetOf(x.snapshot, a)
        const tb = targetOf(x.snapshot, b)
        if (tb === null) return x.thought ? { verdict: 'wrong', why: `Give \`${b}\` something to point at, with \`=\`.` } : { verdict: 'ignore' }
        if (tb !== ta) return { verdict: 'wrong', why: `\`${b}\` points somewhere else. Use \`${a}\` itself.` }
        if (mentions(x.source, v)) return { verdict: 'wrong', why: `Right thing, but you typed ${v} again. Use the name: \`${b} = ${a}\`.` }
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
      say: `\`${y}\` was pointed at \`${x}\`'s object, then \`${x}\` moved to ${v2}. What does \`${y}\` point at now? Type just the number.`,
      setup: [`${x} = ${v1}`, `${y} = ${x}`, `${x} = ${v2}`],
      answer: String(v1),
      expect: { type: 'int', repr: String(v1) },
      praise: `\`${y}\` never followed \`${x}\`. It points at the object, and that did not move.`,
      judge(a) {
        const said = a.source.trim()
        if (said === y) return { verdict: 'wrong', why: 'Say it yourself — type the number you think it is.' }
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
      say: `The robot kept \`${n}\`. Each one holds ${each} bolts — how many bolts in all? Work it out from \`${n}\`, without typing ${k}.`,
      setup: [`${n} = ${k}`],
      answer: `${n} * ${each}`,
      expect: { type: 'int', repr: want },
      praise: `It never stored ${want}. It kept ${k}, and worked the rest out.`,
      judge(a) {
        if (!a.ok) return failed(a, { NameError: `Use the name it kept: \`${n}\`.` })
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.repr !== want) return { verdict: 'wrong', why: `That comes to ${t.repr}. It is ${n} times ${each}.` }
        if (!new RegExp(`\\b${n}\\b`).test(a.source) || mentions(a.source, k))
          return { verdict: 'wrong', why: `Right number — now get it from \`${n}\`, not from ${k}.` }
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
