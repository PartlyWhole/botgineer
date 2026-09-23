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

export const GENERATORS: Record<string, Generator> = {
  int(r) {
    const lo = between(r, 3, 40)
    const hi = lo + between(r, 4, 9)
    return {
      key: `int:${lo}:${hi}`,
      skill: 'int',
      say: `Think of a whole number bigger than ${lo} and smaller than ${hi}.`,
      setup: [],
      answer: String(lo + 1),
      expect: { type: 'int', repr: String(lo + 1) },
      judge(a) {
        if (!a.ok) return failed(a)
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.type === 'float') return { verdict: 'wrong', why: 'That has a dot, so it is a `float`. Whole numbers have none.' }
        if (t.type !== 'int') return { verdict: 'wrong', why: `That is a \`${t.type}\`, not a whole number.` }
        const n = Number(t.repr)
        if (n <= lo || n >= hi) return { verdict: 'wrong', why: `In between: more than ${lo}, less than ${hi}.` }
        return { verdict: 'correct' }
      },
    }
  },

  float(r) {
    const a = between(r, 1, 9)
    return {
      key: `float:${a}`,
      skill: 'float',
      say: `Think of a measurement between ${a} and ${a + 1} — a decimal, like \`${a}.5\`.`,
      setup: [],
      answer: `${a}.5`,
      expect: { type: 'float', repr: `${a}.5` },
      judge(x) {
        if (!x.ok) return failed(x)
        const t = x.thought
        if (!t) return { verdict: 'ignore' }
        if (t.type === 'int') return { verdict: 'wrong', why: 'No dot, so that is an `int`. A measurement needs one.' }
        if (t.type !== 'float') return { verdict: 'wrong', why: `That is a \`${t.type}\`. A decimal is a \`float\`.` }
        const n = Number(t.repr)
        if (!(n > a && n < a + 1)) return { verdict: 'wrong', why: `Somewhere between ${a} and ${a + 1}.` }
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
      say: `Think of the word ${w} — as text, not as a name.`,
      setup: [],
      answer: `"${w}"`,
      expect: { type: 'str', repr: want },
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
    const x = between(r, 2, 30)
    let y = between(r, 2, 30)
    if (y === x) y = x + between(r, 1, 5)
    const more = r() < 0.5
    const truth = more ? x > y : x < y
    const word = truth ? 'True' : 'False'
    return {
      key: `bool:${x}:${y}:${more}`,
      skill: 'bool',
      say: `Is ${x} ${more ? 'more' : 'less'} than ${y}? Answer with just \`True\` or \`False\` — no working out.`,
      setup: [],
      answer: word,
      expect: { type: 'bool', repr: word },
      praise: `${x} ${truth ? 'is' : 'is not'} ${more ? 'more' : 'less'} than ${y}.`,
      judge(a) {
        const said = a.source.trim()
        if (said === 'true' || said === 'false') return { verdict: 'wrong', why: 'Capital letter: `True` or `False`.' }
        if (!a.ok) return failed(a)
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (said !== 'True' && said !== 'False') return { verdict: 'wrong', why: 'Say it yourself — just `True` or `False`.' }
        return t.repr === word ? { verdict: 'correct' } : { verdict: 'wrong', why: `Look again: ${x} and ${y}.` }
      },
    }
  },

  arith(r) {
    const kind = pick(r, ['*', '+', '-'] as const)
    let x = between(r, 3, 12)
    let y = between(r, 2, 12)
    if (kind === '-' && y > x) [x, y] = [y + 5, x]
    const e = bin(kind, int(x), int(y))
    const want = value(e)
    const story =
      kind === '*'
        ? `${x} crates with ${y} bolts in each. How many bolts?`
        : kind === '+'
          ? `${x} bolts in one box and ${y} in another. How many altogether?`
          : `The robot has ${x} bolts and uses ${y}. How many are left?`
    return {
      key: `arith:${kind}:${x}:${y}`,
      skill: 'arith',
      say: `${story} Ask the robot.`,
      setup: [],
      answer: render(e),
      expect: { type: 'int', repr: want },
      judge(a) {
        if (!a.ok) return failed(a)
        const t = a.thought
        if (!t) return { verdict: 'ignore' }
        if (t.repr === want) return { verdict: 'correct' }
        return { verdict: 'wrong', why: `That comes to ${t.repr}. It is ${x} ${OPS_WORD[kind]} ${y}.` }
      },
    }
  },

  divide(r) {
    const b = between(r, 2, 5)
    // Sometimes it shares out exactly, which is the case worth seeing:
    // `8 / 2` is `4.0`, a float, even though nothing is left over.
    const a = r() < 0.4 ? b * between(r, 2, 6) : between(r, 3, 29)
    const e = bin('/', int(a), int(b))
    const want = value(e)
    return {
      key: `divide:${a}:${b}`,
      skill: 'divide',
      say: `Share ${a} litres of oil between ${b} robots. How much does each get?`,
      setup: [],
      answer: render(e),
      expect: { type: 'float', repr: want },
      praise: Number.isInteger(a / b) ? `Even when it shares out exactly, \`/\` gives a \`float\`: ${want}.` : undefined,
      judge(x) {
        if (!x.ok) return failed(x)
        const t = x.thought
        if (!t) return { verdict: 'ignore' }
        if (t.repr === want) return { verdict: 'correct' }
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
    const x = between(r, 2, 40)
    let y = between(r, 2, 40)
    if (y === x) y = x + 3
    const op = pick(r, ['>', '<'] as const)
    const e = bin(op, int(x), int(y))
    const want = value(e)
    return {
      key: `compare:${x}${op}${y}`,
      skill: 'compare',
      say: `Ask the robot whether ${x} is ${op === '>' ? 'more' : 'less'} than ${y}.`,
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
