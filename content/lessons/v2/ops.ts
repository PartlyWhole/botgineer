/**
 * v2, Level 3: Working things out (`v2-ops`).
 *
 * The robot's problem (R12): it can hold the four basic types, but it has
 * only ever thought of what it was told. It ends able to work answers out
 * from sums, in the right order, knowing which types an operation takes.
 *
 * Three ideas, each shown before it is asked (R1), and asked straight
 * after:
 *
 * 1. **Operations.** `+ - * /`, each typed by the crow on the operator
 *    keys. `/` always makes a `float`, even `8 / 2`; and a `float` in a sum
 *    makes the answer a `float`. The robot does the working (R4): a right
 *    number typed by hand is refused, and the picture waits, amber.
 * 2. **Order.** A sum is worked a piece at a time, drawn on the stage:
 *    `*` and `/` before `+` and `-`, equal kinds left to right, brackets
 *    first of all.
 * 3. **Rules.** An operation works on some types and not others: words
 *    join with `+` and repeat with `*`, `"7" + "7"` is `"77"`, and a word
 *    plus a number stops the robot with a `TypeError`, as do `-` and `/`
 *    on words.
 *
 * Then a quiz of nine, from a seed (`quiz`), taking turns between typing
 * a sum for the robot and picking on the stage, one concept each:
 *
 *   typed  a one-operation situation (crates `*`, bolts `-`, parcels `*`
 *          with a float)
 *   pick   what `a + b * c` works out to (order)
 *   typed  a chained situation that needs no brackets: `a * b + c`
 *   pick   what type a sum makes (`/`, a float in the sum, `*` on ints, a
 *          word times a number)
 *   typed  a sharing situation: `/`, answer a float
 *   pick   what a rule-breaking or rule-keeping sum does (`"5" + 5`,
 *          `"ab" - "b"`, `"4" * "2"`, `"ha" * 3`)
 *   typed  a chained situation that needs brackets: `a * (b + c)`
 *   pick   `"7" + "7"` against `14`
 *   typed  words: joined with `+`, or repeated with `*`
 *
 * Every answer is computed from an expression tree by `practice/python`,
 * the same copy of Python the practice levels use, so the key and the
 * question are two readings of one thing; the browser journey plays a
 * seed against real CPython.
 */
import { between, pick, rng, type Rng } from '../../../src/practice/exercises'
import { bin, evaluate, float, int, PyError, render, repr, str, type Expr } from '../../../src/practice/python'
import type { Prop } from '../../../src/scene/props'
import {
  chose,
  errorType,
  heard,
  stopped,
  type Choice,
  type Choices,
  type Evidence,
  type Lesson,
  type LessonStep,
  type Line,
} from '../core'

/* ------------------------------- the truth ------------------------------- */

/** What Python makes of an expression: its repr, or the error it stops with. */
export function outcome(e: Expr): { repr: string; type: string } | { error: string } {
  try {
    const v = evaluate(e)
    return { repr: repr(v), type: v.t }
  } catch (err) {
    if (err instanceof PyError) return { error: err.message.split(':')[0]! }
    throw err
  }
}

const truth = (e: Expr) => {
  const o = outcome(e)
  if ('error' in o) throw new Error(`expected a value from ${render(e)}`)
  return o
}

/** A line with an operation in it, outside any quotes: the robot did the
 *  working, rather than being handed the answer. */
export const hasOp = (source: string): boolean =>
  /[-+*/]/.test(source.replace(/(["'])(?:(?!\1).)*\1/g, '""').replace(/^\s*-/, ''))

/** The robot worked out exactly this, from a line with a sum in it. */
const workedOut = (e: Evidence, want: { type: string; repr: string }) =>
  heard(e, (t) => t.type === want.type && t.repr === want.repr && hasOp(t.source ?? ''))

/* --------------------------------- replies --------------------------------- */

/**
 * The usual misses when the robot is to work something out: the answer
 * typed by hand, times written `x`, divide written `÷`, and a sum that
 * came out wrong. `why` names a particular wrong result, when it knows one.
 */
function workMiss(want: { type: string; repr: string }, example: string, why: Record<string, string> = {}) {
  return (l: Line): string | undefined => {
    const t = l.thought
    if (t && t.repr === want.repr && !hasOp(l.source)) return `That's the answer, but you worked it out. Give the robot the sum, like \`${example}\`.`
    if (t && !hasOp(l.source)) return `Give the robot a sum to work out, like \`${example}\`.`
    if (/\d\s*[x×]\s*\d/.test(l.source)) return 'The robot writes times as `*`, not `x`.'
    if (/÷/.test(l.source)) return 'The robot writes divide as `/`.'
    if (t && why[t.repr]) return why[t.repr]
    if (t && t.type === 'int' && want.type === 'float' && Number(t.repr) === Number(want.repr)) return `Right number, but it needs to be a \`float\`: use \`/\` to share.`
    if (errorType(l) === 'TypeError') return 'That mixed words and numbers, so the robot stopped. Keep this one to numbers.'
    if (t) return `The robot got \`${t.repr}\`. Check the sum against the picture.`
    return stopped(l, `Write it as a sum, like \`${example}\`.`)
  }
}

/* --------------------------------- pictures --------------------------------- */

const OPS = (mark?: '+' | '-' | '*' | '/'): Prop => (mark ? { kind: 'ops', mark } : { kind: 'ops' })

const TYPES: Choice[] = [
  { id: 'bool', label: '`bool`' },
  { id: 'int', label: '`int`' },
  { id: 'float', label: '`float`' },
  { id: 'str', label: '`str`' },
]

const STOPS = 'TypeError'
const stopsLabel = 'It stops: `TypeError`'

/* --------------------------------- teaching --------------------------------- */

const crates = { e: bin('*', int(7), int(6)), show: { kind: 'crates', crates: 7, each: 6 } as Prop }
const share = { e: bin('/', int(9), int(2)), show: { kind: 'share', litres: 9, robots: 2 } as Prop }
const packs = { e: bin('+', bin('*', int(3), int(4)), int(2)), show: { kind: 'packs', packs: 3, each: [4], loose: 2 } as Prop }

const orderQ: Choices = {
  id: 'ops-order',
  options: [
    { id: '11', label: '`11`' },
    { id: '15', label: '`15`' },
    { id: '8', label: '`8`' },
    { id: '10', label: '`10`' },
  ],
  answer: '11',
  nudge: (c) =>
    c === '15'
      ? 'That\'s left to right. `*` goes first: `2 * 5` is `10`, then `1 + 10`.'
      : '`*` goes first: `2 * 5` is `10`, then add the `1`.',
}

const ruleQ: Choices = {
  id: 'ops-rule',
  options: [
    { id: '10', label: '`10`' },
    { id: "'55'", label: '`"55"`' },
    { id: "'10'", label: '`"10"`' },
    { id: STOPS, label: stopsLabel },
  ],
  answer: STOPS,
  nudge: () => 'One side is words and the other a number. `+` can\'t do both, so the robot stops.',
}

const teach: LessonStep[] = [
  {
    beats: [
      { say: 'The robot can do more than think of things. It can work things out.', act: [{ actor: 'crow', do: 'hop' }] },
      { say: 'Give it some numbers and an *operation*, and it works out the answer.', show: OPS() },
      { say: '`+` adds.', show: OPS('+'), types: '7 + 5', thought: '12' },
      { say: '`-` takes away.', show: OPS('-'), types: '9 - 4', thought: '5' },
      { say: '`*` is how the robot writes times.', show: OPS('*'), types: '6 * 3', thought: '18' },
      { say: '`/` divides.', show: OPS('/'), types: '8 / 2', thought: '4.0' },
      { say: 'You write the sum; the robot does the working. So don\'t work it out yourself!', show: crates.show },
    ],
    say: 'Seven crates of six bolts. Let the robot work out how many bolts.',
    show: crates.show,
    ask: 'How many bolts?',
    tag: 'robot',
    model: '7 * 6',
    done: (e) => workedOut(e, truth(crates.e)),
    praise: 'The robot worked out `7 * 6`: `42` bolts, an `int`.',
    nudge: workMiss(truth(crates.e), '7 * 6', { '13': 'That adds them. Seven crates *of* six is times: `*`.' }),
  },
  {
    beats: [
      {
        say: 'Did you see `8 / 2` make `4.0`? Dividing always makes a `float`.',
        show: {
          kind: 'contrast',
          left: { text: '8 / 2', kind: 'int', result: '4.0', resultKind: 'float' },
          right: { text: '8 * 2', kind: 'int', result: '16', resultKind: 'int' },
        },
      },
      { say: 'And a `float` anywhere in a sum makes the answer a `float` too.', types: '2 + 0.5', thought: '2.5' },
    ],
    say: 'Nine litres of oil, shared between two robots. Let the robot work out each share.',
    show: share.show,
    ask: 'How much each?',
    tag: 'robot',
    model: '9 / 2',
    done: (e) => workedOut(e, truth(share.e)),
    praise: '`9 / 2` is `4.5`: shared out, so a `float`.',
    nudge: workMiss(truth(share.e), '9 / 2', { '18': 'That\'s times. Sharing between two is divide: `/`.' }),
  },
  {
    beats: [
      {
        say: 'A sum can have more than one operation. The robot works it a piece at a time.',
        show: { kind: 'expr', text: '2 + 3 * 4', first: '3 * 4', then: ['2 + 12', '14'], demo: 'work' },
      },
      {
        say: 'Not left to right: `*` and `/` go first, then `+` and `-`.',
        show: { kind: 'expr', text: '2 + 3 * 4', first: '3 * 4', then: ['2 + 12', '14'], demo: 'work' },
        types: '2 + 3 * 4',
        thought: '14',
      },
      {
        say: 'Two of the same kind go left to right: `10 - 2 - 3` is `5`.',
        show: { kind: 'expr', text: '10 - 2 - 3', first: '10 - 2', then: ['8 - 3', '5'], demo: 'work' },
      },
      {
        say: 'And brackets go first of all: `(2 + 3) * 4` is `20`.',
        show: { kind: 'expr', text: '(2 + 3) * 4', first: '(2 + 3)', then: ['5 * 4', '20'], demo: 'work' },
        types: '(2 + 3) * 4',
        thought: '20',
      },
    ],
    say: 'What will the robot get for `1 + 2 * 5`?',
    show: { kind: 'value', text: '1 + 2 * 5' },
    ask: 'What does it work out to?',
    tag: 'you',
    choices: orderQ,
    done: (e) => chose(e, orderQ),
    praise: '`*` first, `2 * 5` is `10`, then `1 + 10` is `11`.',
  },
  {
    beats: [{ say: 'Now a sum with two operations of your own.', show: packs.show }],
    say: 'Three boxes of four apples, and two more loose. Let the robot count them all.',
    show: packs.show,
    ask: 'How many apples?',
    tag: 'robot',
    model: '3 * 4 + 2',
    done: (e) => workedOut(e, truth(packs.e)),
    praise: '`3 * 4 + 2`: the boxes first, then the loose ones. `14`.',
    nudge: workMiss(truth(packs.e), '3 * 4 + 2', {
      '18': 'The brackets made it add first, but the loose two aren\'t in the boxes.',
      '9': 'That adds everything. Three boxes *of* four is times.',
    }),
  },
  {
    beats: [
      { say: 'Operations work on some types and not others.' },
      { say: 'Words can be joined with `+`.', show: { kind: 'tiles', parts: ['"bot"', '+', '"gineer"'] }, types: '"bot" + "gineer"', thought: "'botgineer'" },
      { say: 'And a word times a number repeats it.', show: { kind: 'tiles', parts: ['"ha"', '*', '3'], demo: 'stamp' }, types: '"ha" * 3', thought: "'hahaha'" },
      {
        say: 'So `7 + 7` is `14`, but `"7" + "7"` is `"77"`: numbers add, words join.',
        show: {
          kind: 'contrast',
          left: { text: '7 + 7', kind: 'int', result: '14' },
          right: { text: '"7" + "7"', kind: 'str', result: '"77"' },
        },
      },
      { say: 'But a word can\'t be added to a number. The robot stops.', show: { kind: 'clash', left: '"3"', op: '+', right: '4' }, types: '"3" + 4', stops: 'TypeError', thought: '' },
      { say: 'It can\'t take away from words, or divide them, either.', show: { kind: 'clash', left: '"ha"', op: '-', right: '"a"' } },
      { say: 'Stopping like that is a `TypeError`: the wrong types for the operation.', show: { kind: 'clash', left: '"3"', op: '+', right: '4' } },
    ],
    say: 'What does the robot do with `"5" + 5`?',
    show: { kind: 'value', text: '"5" + 5' },
    ask: 'What happens?',
    tag: 'you',
    choices: ruleQ,
    done: (e) => chose(e, ruleQ),
    praise: 'A word plus a number: the robot stops with a `TypeError`.',
  },
]

/* --------------------------------- the quiz --------------------------------- */

/** A "what does this make?" question, its options and key from Python. */
function makes(id: string, e: Expr, wrong: string[], why: (picked: string) => string | undefined, praise: string): LessonStep {
  const o = outcome(e)
  const answer = 'error' in o ? STOPS : o.repr
  const label = (x: string) => (x === STOPS ? stopsLabel : `\`${x.startsWith("'") ? `"${x.slice(1, -1)}"` : x}\``)
  const ids = [...new Set([answer, ...wrong])].slice(0, 4)
  // A stable order: the error last, the rest as generated.
  const options = [...ids.filter((x) => x !== STOPS), ...ids.filter((x) => x === STOPS)].map((x) => ({ id: x, label: label(x) }))
  const choices: Choices = { id, options, answer, nudge: why }
  const text = render(e)
  return {
    say: `What does the robot make of \`${text}\`?`,
    show: { kind: 'value', text },
    ask: 'What does it make?',
    tag: 'you',
    choices,
    done: (ev) => chose(ev, choices),
    praise,
  }
}

/** A typed situation: the picture, the sum that answers it, and what to say. */
function situation(e: Expr, show: Prop, say: string, ask: string, praise: string, why: Record<string, string> = {}): LessonStep {
  const want = truth(e)
  return {
    say,
    show,
    ask,
    tag: 'robot',
    model: render(e),
    done: (ev) => workedOut(ev, want),
    praise,
    nudge: workMiss(want, render(e), why),
  }
}

/** Shares that come out in tenths: `litres / robots`. */
const SHARES: [number, number][] = [
  [9, 2],
  [6, 3],
  [10, 4],
  [12, 4],
  [6, 4],
  [7, 2],
]

function oneOp(r: Rng): LessonStep {
  const which = pick(r, ['crates', 'bolts', 'scale'] as const)
  if (which === 'crates') {
    const a = between(r, 3, 9)
    const b = between(r, 3, 9)
    return situation(bin('*', int(a), int(b)), { kind: 'crates', crates: a, each: b }, `${a} crates of ${b} bolts. Let the robot work out how many.`, 'How many bolts?', `\`${a} * ${b}\`: ${a * b} bolts, an \`int\`.`, { [String(a + b)]: `That adds them. ${a} crates *of* ${b} is times: \`*\`.` })
  }
  if (which === 'bolts') {
    const have = between(r, 15, 30)
    const use = between(r, 3, 12)
    return situation(bin('-', int(have), int(use)), { kind: 'bolts', have, use }, `The robot has ${have} bolts and uses ${use}. Let it work out how many are left.`, 'How many left?', `\`${have} - ${use}\` is ${have - use}: taken away.`, { [String(have + use)]: 'That adds them. Used up is taken away: `-`.' })
  }
  const parcels = between(r, 2, 4)
  const each = 2.5
  const e = bin('*', int(parcels), float(each))
  return situation(e, { kind: 'scale', parcels, each }, `${parcels} parcels, ${each} kg each. Let the robot weigh them all.`, 'How heavy?', `\`${render(e)}\` is \`${truth(e).repr}\`: a \`float\` in the sum, so a \`float\` out.`)
}

function orderPick(r: Rng): LessonStep {
  // `a + b * c`: the order in which left to right is wrong. (`a * b + c`
  // comes out the same either way, so it would test nothing.)
  const a = between(r, 1, 6)
  const b = between(r, 2, 6)
  const c = between(r, 2, 6)
  const e = bin('+', int(a), bin('*', int(b), int(c)))
  const right = a + b * c
  const leftToRight = (a + b) * c
  // Left to right first, then other readings, then near misses, so four
  // distinct options stand even when small numbers make readings agree.
  const wrong = [...new Set([leftToRight, a + b + c, a * b * c, a * c + b, right + 1, right - 1, right + 2, right + 3].filter((x) => x !== right))]
    .slice(0, 3)
    .map(String)
  return makes(
    'quiz-order',
    e,
    wrong,
    (p) => (p === String(leftToRight) ? `That's left to right. \`*\` goes first: \`${b} * ${c}\` is \`${b * c}\`.` : `\`*\` first: \`${b} * ${c}\` is \`${b * c}\`, then add \`${a}\`.`),
    `\`*\` first, then \`+\`: \`${render(e)}\` is \`${right}\`.`,
  )
}

function chained(r: Rng): LessonStep {
  const n = between(r, 2, 4)
  const each = between(r, 3, 6)
  const loose = between(r, 1, 5)
  const e = bin('+', bin('*', int(n), int(each)), int(loose))
  return situation(
    e,
    { kind: 'packs', packs: n, each: [each], loose },
    `${n} boxes of ${each} apples, and ${loose} more loose. Let the robot count them all.`,
    'How many apples?',
    `\`${render(e)}\`: the boxes first, then the loose ones.`,
    { [String(n * (each + loose))]: `The brackets made it add first, but the ${loose} loose ones aren't in boxes.`, [String(n + each + loose)]: 'That adds everything. Boxes *of* apples is times.' },
  )
}

function typePick(r: Rng): LessonStep {
  const e = pick(r, [bin('/', int(6), int(3)), bin('+', int(2), float(0.5)), bin('*', int(4), int(2)), bin('*', str('4'), int(2))])
  const o = truth(e)
  const text = render(e)
  const why: Record<string, string> = {
    float: text.includes('/') ? 'Dividing always makes a `float`, even when it comes out whole.' : 'A `float` in the sum makes the answer a `float`.',
    int: 'Two `int`s multiplied make an `int`: no dot anywhere.',
    str: 'A word times a number repeats the word: still a `str`.',
  }
  const choices: Choices = { id: 'quiz-type', options: TYPES, answer: o.type, nudge: () => why[o.type] }
  return {
    say: `What type does \`${text}\` make?`,
    show: { kind: 'value', text },
    ask: 'What type comes out?',
    tag: 'you',
    choices,
    done: (ev) => chose(ev, choices),
    praise: `\`${text}\` makes \`${o.repr}\`, a \`${o.type}\`. ${why[o.type]}`,
  }
}

function sharing(r: Rng): LessonStep {
  const [litres, robots] = pick(r, SHARES)
  const e = bin('/', int(litres), int(robots))
  return situation(
    e,
    { kind: 'share', litres, robots },
    `${litres} litres of oil, shared between ${robots} robots. Let the robot work out each share.`,
    'How much each?',
    `\`${render(e)}\` is \`${truth(e).repr}\`: divided, so a \`float\`.`,
    { [String(litres * robots)]: 'That\'s times. Sharing out is divide: `/`.' },
  )
}

function rulePick(r: Rng): LessonStep {
  const which = pick(r, ['plus', 'minus', 'times-words', 'repeat'] as const)
  if (which === 'plus') {
    const d = between(r, 2, 9)
    const e = bin('+', str(String(d)), int(d))
    return makes('quiz-rule', e, [String(d + d), `'${d}${d}'`, `'${d + d}'`], () => 'One side is words, the other a number. `+` can\'t do both, so the robot stops.', 'Words plus a number: the robot stops with a `TypeError`.')
  }
  if (which === 'minus') {
    const e = bin('-', str('ab'), str('b'))
    return makes('quiz-rule', e, ["'a'", "'ab'", "''"], () => 'Words can be joined, but not taken away. The robot stops.', 'Taking words away: the robot stops with a `TypeError`.')
  }
  if (which === 'times-words') {
    const e = bin('*', str('4'), str('2'))
    return makes('quiz-rule', e, ['8', "'8'", "'42'"], () => 'Both sides are words. A word can be repeated a number of times, but not a word of times.', 'Words times words: the robot stops with a `TypeError`.')
  }
  const n = between(r, 2, 4)
  const e = bin('*', str('ha'), int(n))
  return makes('quiz-rule', e, [`'ha${n}'`, String(n * 2), STOPS], () => `A word times a number repeats it: \`"ha"\` ${n} times.`, `A word times a number repeats the word: \`${truth(e).repr}\`.`)
}

function brackets(r: Rng): LessonStep {
  const n = between(r, 2, 4)
  const red = between(r, 2, 5)
  const blue = between(r, 2, 5)
  const e = bin('*', int(n), bin('+', int(red), int(blue)))
  return situation(
    e,
    { kind: 'packs', packs: n, each: [red, blue] },
    `${n} boxes, each with ${red} red and ${blue} blue sweets. Let the robot count them all.`,
    'How many sweets?',
    `\`${render(e)}\`: each box first, in brackets, then times the boxes.`,
    { [String(n * red + blue)]: `Without brackets, \`*\` went first and only the red were counted ${n} times. Bracket each box.` },
  )
}

function glue(r: Rng): LessonStep {
  const d = between(r, 2, 9)
  const e = bin('+', str(String(d)), str(String(d)))
  return makes('quiz-glue', e, [String(d + d), `'${d + d}'`, STOPS], (p) => (p === String(d + d) ? 'The quotes make them words, and words join: side by side, not added.' : 'Words join with `+`: side by side.'), `Words join: \`${render(e)}\` is \`${truth(e).repr}\`.`)
}

function words(r: Rng): LessonStep {
  if (r() < 0.5) {
    const [a, b] = pick(r, [
      ['Sprock', 'et'],
      ['bot', 'gineer'],
      ['sun', 'flower'],
    ] as const)
    const e = bin('+', str(a), str(b))
    return situation(e, { kind: 'tiles', parts: [`"${a}"`, '+', `"${b}"`] }, `Let the robot join "${a}" and "${b}" into one word.`, 'Join the words.', `\`${render(e)}\` joins them: \`${truth(e).repr}\`.`, { [`'${a} ${b}'`]: 'Nearly! `+` joins words with nothing between them. Leave out the space.' })
  }
  const n = between(r, 2, 4)
  const e = bin('*', str('ha'), int(n))
  return situation(e, { kind: 'tiles', parts: ['"ha"', '*', String(n)] }, `Let the robot laugh: "ha", ${n} times over.`, 'Laugh!', `\`${render(e)}\` repeats it: \`${truth(e).repr}\`.`)
}

/**
 * The quiz, from a seed: nine concepts, one question each, taking turns
 * between typing and picking.
 */
export function quiz(seed: number): LessonStep[] {
  const r = rng(seed)
  const steps = [oneOp(r), orderPick(r), chained(r), typePick(r), sharing(r), rulePick(r), brackets(r), glue(r), words(r)]
  steps[0] = { ...steps[0]!, beats: [{ say: 'Now let\'s mix them up. Some sums you give the robot, some you pick.' }] }
  return steps
}

function seedOfPage(): number {
  if (typeof location === 'undefined') return 1
  const given = Number(new URLSearchParams(location.search).get('seed'))
  return Number.isFinite(given) && given > 0 ? given : Math.floor(Math.random() * 1e9) + 1
}

export const opsLesson = (seed: number): Lesson => ({
  id: 'v2-ops',
  teaches: ['arith', 'divide', 'join', 'order'],
  pictureAtAsk: true,
  ordered: true,
  steps: [...teach, ...quiz(seed)],
  outro: [
    { say: 'Now the robot can work things out: `+ - * /`, in the right order.', show: OPS() },
    { say: 'And it knows which types go together, and which make it stop.' },
  ],
  takeaway: 'You write the sum and the robot works it out: `*` and `/` before `+` and `-`, brackets first, and words don\'t mix with numbers.',
})

export const v2ops = opsLesson(seedOfPage())
