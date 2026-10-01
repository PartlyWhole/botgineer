/**
 * v2, Level 6: Asking Questions (`v2-logic`).
 *
 * The robot's problem (R12): at the cave's mouth there are rules — more
 * than 20 HP to go in, a torch, exactly 12 coins for the chest — and the
 * robot can keep Mira's stats and work out sums, but it cannot yet ask
 * whether something is so. To choose (the next level, `if`), it must
 * first ask. It ends able to ask any yes-or-no question of its memory,
 * join questions with `and` and `or`, flip one with `not`, and remember
 * an answer.
 *
 * The answer to every question here is a `bool` (Basic Data Types), which
 * is why this level is the bridge between memory and choosing.
 *
 * 1. Mira's explorer card, written into memory: `hp`, `coins`, `has_key`,
 *    `backpack` (a goal memory: Memories and Lists, used again).
 * 2. `>` and `<`: a *comparison*. Asked of a name, not a number, so the
 *    question fits any explorer (R4: a `True` typed by hand is refused).
 * 3. `==` against `=` (R7, a pair differing in one sign): two asks, one
 *    points. Picked, then typed; `!=` shown.
 * 4. `>=` against `>` on the boundary (`hp` exactly 30): picked.
 * 5. `in`: is it in the list?
 * 6. `and`: both, worked a piece at a time on the stage (`expr`), and
 *    drawn as lamps in series on the cave gate (`gate`). Picked, typed.
 * 7. `or`: either, the lamps in parallel. Picked.
 * 8. `not`: flipped. Typed.
 * 9. An answer kept: `can_enter = …` points a name at a `bool` — which is
 *    what the next level's `if` asks about.
 *
 * Then seven, from a seed (`quiz`), one concept each, taking turns between
 * asking the robot and picking: at least (`>=`), the same (`==` on words
 * or across types), the boundary, `in`, `and`/`or` on the gate, a
 * question joined with `or`, and an answer kept. Every typed question is
 * judged on its *shape* (the names and the operator), and real Python
 * gives the answer, so the robot is the key.
 */
import { between, pick, rng } from '../../../src/practice/exercises'
import { compare, type Goal } from '../../../src/memory/goal'
import type { Prop } from '../../../src/scene/props'
import {
  chose,
  errorType,
  everBy,
  heard,
  reached,
  stopped,
  type Choices,
  type Evidence,
  type Lesson,
  type LessonStep,
  type Line,
} from '../core'

/* ---------------------------------- Mira ---------------------------------- */

const HP = 30
const COINS = 12
const CARD: Goal = [
  { name: 'hp', value: String(HP) },
  { name: 'coins', value: String(COINS) },
  { name: 'has_key', value: 'False' },
  { name: 'backpack', value: '["map", "torch"]' },
]
const MADE = ['hp = 30', 'coins = 12', 'has_key = False', 'backpack = ["map", "torch"]']

const hud = (mark?: string[]): Prop => ({
  kind: 'hud',
  title: 'Mira',
  stats: [
    { name: 'hp', value: String(HP) },
    { name: 'coins', value: String(COINS) },
    { name: 'has_key', value: 'False' },
    { name: 'backpack', value: '["map", "torch"]' },
  ],
  ...(mark ? { mark } : {}),
})

/* --------------------------------- helpers --------------------------------- */

/** The robot asked this: a `bool` came back from a line of this shape. */
const asked = (e: Evidence, shape: RegExp, repr?: string) =>
  heard(e, (t) => t.type === 'bool' && (repr === undefined || t.repr === repr) && shape.test(t.source ?? ''))

/** A line that points a name (one `=`) where a question was wanted. */
const pointed = (l: Line, name: string) => l.ok && !l.thought && new RegExp(`^\\s*${name}\\s*=(?!=)`).test(l.source)

/**
 * The usual misses on a question the robot is to ask: the answer typed
 * in, the question asked of a number rather than a name, one `=` for two,
 * and a word without quotes.
 */
function askMiss(name: string, example: string) {
  return (l: Line): string | undefined => {
    const s = l.source.trim()
    if (s === 'True' || s === 'False') return `That's your answer. Let the robot ask it: \`${example}\`.`
    if (s === 'true' || s === 'false') return `That's your answer, and it needs a capital. Let the robot ask it: \`${example}\`.`
    if (pointed(l, name)) return `One \`=\` pointed \`${name}\` at something new: that asks nothing. Undo that line, and ask with \`${example}\`.`
    if (errorType(l) === 'SyntaxError' && /[^=!<>]=[^=]/.test(l.source)) return 'One `=` points a name. To ask *is it the same?*, use two: `==`.'
    if (errorType(l) === 'NameError' && /\bin\b/.test(l.source)) return 'Words need quotes, or the robot reads them as names: `"torch"`.'
    if (errorType(l) === 'NameError') return `The robot has no memory called that. Mira's card has \`hp\`, \`coins\`, \`has_key\` and \`backpack\`.`
    if (l.thought?.type === 'bool' && !new RegExp(`\\b${name}\\b`).test(l.source))
      return `Ask about the name, \`${name}\`, not the number, so the question fits any explorer: \`${example}\`.`
    if (l.thought && l.thought.type !== 'bool') return `That made \`${l.thought.repr}\`, not a yes or no. A question here is answered \`True\` or \`False\`: \`${example}\`.`
    if (l.thought?.type === 'bool') return `That asks something else. Try \`${example}\`.`
    return stopped(l, `Try \`${example}\`.`)
  }
}

/** What a line left memory looking like, against Mira's card. */
function cardMiss(goal: Goal) {
  return (l: Line): string | undefined => {
    if (errorType(l) === 'NameError' && /\[/.test(l.source)) return 'Words need quotes, or the robot reads them as names: `"map"`.'
    if (errorType(l) === 'NameError' && /\b(false|true)\b/.test(l.source)) return 'The robot\'s no is `False`, with a capital.'
    if (errorType(l) === 'NameError') return 'That uses a name the robot has no memory of yet.'
    if (!l.ok) return stopped(l, 'Check the line against the card.')
    if (!l.memory) return undefined
    const { rows, extra } = compare(goal, l.memory)
    const made = /^\s*([A-Za-z_]\w*)\s*=(?!=)/.exec(l.source)?.[1]
    if (made && extra.includes(made)) return `\`${made}\` isn't on the card. Undo that line, and try again.`
    const off = rows.find((r) => !r.ok && r.have !== null)
    if (off) return `\`${off.name}\` points at \`${off.have}\` now. The card has \`${off.value}\`.`
    return undefined
  }
}

const isBool = (id: string) => (id === 'True' || id === 'False' ? id : undefined)
/** A question whose answer is a `bool`: picked from `True`, `False`, and
 *  the robot stopping. */
function yesNo(id: string, answer: 'True' | 'False', nudge: (c: string) => string | undefined): Choices {
  return {
    id,
    options: [
      { id: 'True', label: '`True`' },
      { id: 'False', label: '`False`' },
      { id: 'error', label: 'It stops: `TypeError`' },
    ],
    answer,
    nudge: (c) => nudge(c) ?? (isBool(c) ? 'Not that one.' : 'It doesn\'t stop: both sides can be compared.'),
  }
}

/* --------------------------------- teaching --------------------------------- */

const asks: Choices = {
  id: 'logic-asks',
  options: [
    { id: 'two', label: '`coins == 12`' },
    { id: 'one', label: '`coins = 12`' },
  ],
  answer: 'two',
  nudge: () => 'One `=` points `coins` at `12`: it tells, it doesn\'t ask. Two, `==`, asks *is it the same?*',
}

const edge: Choices = {
  id: 'logic-edge',
  options: [
    { id: 'ge', label: '`hp >= 30`' },
    { id: 'gt', label: '`hp > 30`' },
    { id: 'lt', label: '`hp < 30`' },
  ],
  answer: 'ge',
  nudge: (c) =>
    c === 'gt'
      ? '`30 > 30` is `False`: 30 isn\'t *more than* 30. The sign says "or more", so it\'s `>=`.'
      : '`<` asks *is it less than?* Mira needs 30 or more: `>=`.',
}

const AND = 'hp > 20 and coins > 50'
const both = yesNo('logic-and', 'False', (c) =>
  c === 'True' ? '`hp > 20` is `True`, but `coins > 50` is `False`. `and` needs both.' : undefined,
)
const OR = '"rope" in backpack or hp > 50'
const either = yesNo('logic-or', 'False', (c) =>
  c === 'True' ? 'No rope in the backpack, and 30 isn\'t more than 50: both are `False`, so `or` is too.' : undefined,
)

const gateAnd = (on: [boolean, boolean]): Prop => ({
  kind: 'gate',
  op: 'and',
  locks: [
    { label: 'hp > 20', on: on[0] },
    { label: '"torch" in backpack', on: on[1] },
  ],
})

const teach: LessonStep[] = [
  {
    beats: [
      { speaker: 'courier', say: 'The cave! I\'ve always wanted to go in.', act: [{ actor: 'courier', do: 'enter' }] },
      { say: 'Caves have rules, Mira. The robot will need to know all about you first.', show: hud() },
      { say: 'Here\'s your explorer card: HP, coins, a key, and your backpack.', show: hud() },
    ],
    say: 'Write Mira\'s card into the robot\'s memory.',
    show: { kind: 'goal', goal: CARD },
    ask: 'Make memory match.',
    tag: 'you',
    done: (e) => reached(e, CARD),
    praise: 'Four names, four objects: an `int`, an `int`, a `bool` and a `list`.',
    nudge: cardMiss(CARD),
    model: MADE.join('\n'),
  },
  {
    beats: [
      { say: 'The sign says: explorers need more than 20 HP to go in.', show: hud(['hp']), memory: MADE, mark: ['hp'] },
      { say: 'The robot can ask that: is `hp` more than 20?', types: 'hp > 20', thought: 'True', memory: MADE, mark: ['hp'], show: hud(['hp']) },
      { say: 'It follows `hp` to `30`, and asks: is 30 more than 20? Yes: `True`.', thought: 'True', memory: MADE, mark: ['hp'], show: hud(['hp']) },
      { say: '`<` asks *is it less than?* 30 isn\'t less than 20: `False`.', types: 'hp < 20', thought: 'False', memory: MADE, mark: ['hp'], show: hud(['hp']) },
      { say: 'A question like that is a *comparison*. Its answer is always a `bool`.', memory: MADE, show: hud(['hp']) },
    ],
    say: 'Ask the robot: is `hp` more than 20?',
    show: hud(['hp']),
    ask: 'More than 20 HP?',
    tag: 'robot',
    done: (e) => asked(e, /\bhp\s*>\s*20\b|\b20\s*<\s*hp\b/, 'True'),
    praise: '`hp > 20` is `True`, because 30 is more than 20.',
    nudge: askMiss('hp', 'hp > 20'),
    model: 'hp > 20',
  },
  {
    beats: [
      { speaker: 'courier', say: 'Look, a chest! It opens for exactly 12 coins.', show: hud(['coins']) },
      { say: 'To ask *is it the same?*, the robot uses two equals signs: `==`.', types: 'coins == 12', thought: 'True', memory: MADE, mark: ['coins'], show: hud(['coins']) },
      { say: 'One `=` is different: it points a name at an object. It asks nothing.', types: 'coins = 12', thought: '', memory: MADE, mark: ['coins'], show: hud(['coins']) },
    ],
    say: 'Which line asks the robot a question?',
    show: hud(['coins']),
    ask: 'Which one asks?',
    tag: 'you',
    choices: asks,
    done: (e) => chose(e, asks),
    praise: '`==` asks *is it the same?* One `=` only points a name.',
  },
  {
    beats: [
      { say: 'And `!=` asks the opposite: *is it different?*', types: 'coins != 12', thought: 'False', memory: MADE, mark: ['coins'], show: hud(['coins']) },
    ],
    say: 'Ask the robot: is `coins` exactly 12?',
    show: hud(['coins']),
    ask: 'Exactly 12 coins?',
    tag: 'robot',
    done: (e) => asked(e, /\bcoins\s*==\s*12\b|\b12\s*==\s*coins\b/, 'True'),
    praise: '`coins == 12` is `True`: the same number, so the chest opens.',
    nudge: askMiss('coins', 'coins == 12'),
    model: 'coins == 12',
  },
  {
    beats: [
      { say: 'Deeper in, another sign: 30 HP *or more*.', show: hud(['hp']) },
      { say: '`>=` asks *more than, or the same?* `hp >= 30` is `True`.', types: 'hp >= 30', thought: 'True', memory: MADE, mark: ['hp'], show: hud(['hp']) },
      { say: '`>` alone says no to the same: `hp > 30` is `False`.', types: 'hp > 30', thought: 'False', memory: MADE, mark: ['hp'], show: hud(['hp']) },
      { say: 'And `<=` asks *less than, or the same?*', show: hud(['hp']) },
    ],
    say: 'Mira has exactly 30 HP. Which question lets her in?',
    show: hud(['hp']),
    ask: '30 HP or more',
    tag: 'you',
    choices: edge,
    done: (e) => chose(e, edge),
    praise: '`hp >= 30` is `True` for exactly 30, because *or the same* counts.',
  },
  {
    beats: [
      { speaker: 'courier', say: 'It\'s dark in there. Did I pack the torch?', show: hud(['backpack']) },
      { say: '`in` asks *is it in the list?*', types: '"torch" in backpack', thought: 'True', memory: MADE, mark: ['backpack'], show: hud(['backpack']) },
      { say: 'It looks along the list, slot by slot, for a rope. None: `False`.', types: '"rope" in backpack', thought: 'False', memory: MADE, mark: ['backpack'], show: hud(['backpack']) },
    ],
    say: 'Ask the robot: is there a map in the backpack?',
    show: hud(['backpack']),
    ask: 'A map?',
    tag: 'robot',
    done: (e) => asked(e, /^\s*(["'])map\1\s+in\s+backpack\s*$/, 'True'),
    praise: '`"map" in backpack` is `True`: it found `"map"` at index `0`.',
    nudge: (l) =>
      /^\s*map\s+in\b/.test(l.source)
        ? 'Words need quotes, or the robot reads them as names: `"map" in backpack`.'
        : askMiss('backpack', '"map" in backpack')(l),
    model: '"map" in backpack',
  },
  {
    beats: [
      { say: 'Here\'s the cave gate. It opens only if *both* are true: over 20 HP, and a torch.', show: gateAnd([true, true]) },
      { say: '`and` joins two questions. It\'s `True` only when both answers are `True`.', show: gateAnd([true, true]) },
      { say: 'The robot asks each side first, then puts the answers together.', show: { kind: 'expr', text: AND, first: 'hp > 20', then: ['True and coins > 50', 'True and False', 'False'], demo: 'work' } },
      { say: '`hp > 20` is `True`, `coins > 50` is `False`. Not both: `False`.', show: { kind: 'expr', text: AND, first: 'hp > 20', then: ['True and coins > 50', 'True and False', 'False'] } },
    ],
    say: 'So what does `hp > 20 and coins > 50` make?',
    show: { kind: 'code', text: AND },
    ask: 'What does it make?',
    tag: 'you',
    choices: both,
    done: (e) => chose(e, both),
    praise: 'One side was `False`, so `and` makes `False`.',
  },
  {
    say: 'Will the gate open? Ask the robot: over 20 HP *and* a torch in the backpack.',
    show: gateAnd([true, true]),
    ask: 'Will it open?',
    tag: 'robot',
    done: (e) => asked(e, /^(?=.*\band\b)(?=.*\bhp\s*>\s*20\b)(?=.*(["'])torch\1\s+in\s+backpack)/, 'True'),
    praise: 'Both sides are `True`, so `and` makes `True`: the gate opens!',
    nudge: (l) =>
      l.thought?.type === 'bool' && !/\band\b/.test(l.source)
        ? 'That asks one thing. Join both questions with `and`: `hp > 20 and "torch" in backpack`.'
        : askMiss('hp', 'hp > 20 and "torch" in backpack')(l),
    model: 'hp > 20 and "torch" in backpack',
  },
  {
    beats: [
      { speaker: 'courier', say: 'A rope bridge! A guard says: you need a rope, *or* more than 50 HP.' },
      { say: '`or` is `True` when *either* answer is `True`, or both.', show: { kind: 'gate', op: 'or', locks: [{ label: '"rope" in backpack', on: false }, { label: 'hp > 50', on: false }] } },
      { say: 'Each side is asked first, then `or` puts them together.', show: { kind: 'expr', text: OR, first: '"rope" in backpack', then: ['False or hp > 50', 'False or False', 'False'], demo: 'work' } },
    ],
    say: 'What does `"rope" in backpack or hp > 50` make?',
    show: { kind: 'code', text: OR },
    ask: 'What does it make?',
    tag: 'you',
    choices: either,
    done: (e) => chose(e, either),
    praise: 'Neither side was `True`, so even `or` makes `False`. No crossing yet!',
  },
  {
    beats: [
      { speaker: 'courier', say: 'Some caves are only for explorers *without* a key. Funny rule!', show: hud(['has_key']) },
      { say: '`not` flips an answer: `not True` is `False`, and `not False` is `True`.', types: 'not has_key', thought: 'True', memory: MADE, mark: ['has_key'], show: hud(['has_key']) },
    ],
    say: 'Ask the robot: is Mira *without* a key?',
    show: hud(['has_key']),
    ask: 'No key?',
    tag: 'robot',
    done: (e) => asked(e, /\bnot\s+has_key\b|\bhas_key\s*==\s*False\b/, 'True'),
    praise: '`has_key` is `False`, and `not` flips it: `True`.',
    nudge: askMiss('has_key', 'not has_key'),
    model: 'not has_key',
  },
  {
    beats: [
      { say: 'An answer is an object, so the robot can remember it, like any other.', types: 'can_enter = hp > 20 and "torch" in backpack', memory: [...MADE, 'can_enter = hp > 20 and "torch" in backpack'], mark: ['can_enter'] },
      { say: 'It asks the question once, and points `can_enter` at the answer: `True`.', memory: [...MADE, 'can_enter = hp > 20 and "torch" in backpack'], mark: ['can_enter'] },
    ],
    say: 'Make the robot remember `rich`: whether `coins` is more than 100.',
    show: { kind: 'hud', title: 'Mira', stats: [{ name: 'coins', value: String(COINS) }, { name: 'rich', value: '?' }], mark: ['rich'] },
    ask: 'Remember the answer.',
    tag: 'robot',
    done: (e) => everBy(e, (src, s) => /^\s*rich\s*=[^=]*\bcoins\b/.test(src) && compare([{ name: 'rich', value: 'False' }], s).rows[0]!.ok),
    praise: '`rich` points at `False`, because 12 isn\'t more than 100. The robot asked, and kept the answer.',
    nudge: (l) =>
      /^\s*rich\s*=\s*False\s*$/.test(l.source)
        ? 'That\'s the answer typed in. Let the robot ask: `rich = coins > 100`.'
        : errorType(l) === 'NameError' && /\bcoins\b/.test(l.source) === false
          ? 'Put the question on the right of the `=`: `rich = coins > 100`.'
          : stopped(l, 'Try `rich = coins > 100`.') ?? (l.ok ? 'Point `rich` at the robot\'s answer: `rich = coins > 100`.' : undefined),
    model: 'rich = coins > 100',
  },
]

/* --------------------------------- the quiz --------------------------------- */

/**
 * The quiz, from a seed: seven concepts, one question each, taking turns
 * between asking the robot and picking. Mira's card is still in memory,
 * so every question is about it.
 */
export function quiz(seed: number): LessonStep[] {
  const r = rng(seed)

  // At least: a price at or above what she has, so the answer is a no.
  const price = pick(r, [15, 20, 25])
  const atLeast: LessonStep = {
    beats: [{ say: 'Now let\'s mix them up. Some questions you ask the robot, some you answer.' }],
    speaker: 'courier',
    say: `A lantern costs ${price} coins. Ask the robot: do I have at least ${price}?`,
    show: hud(['coins']),
    ask: `At least ${price} coins?`,
    tag: 'robot',
    done: (e) => asked(e, new RegExp(`\\bcoins\\s*>=\\s*${price}\\b|\\b${price}\\s*<=\\s*coins\\b|\\bcoins\\s*>\\s*${price - 1}\\b`), 'False'),
    praise: `\`coins >= ${price}\` is \`False\`: 12 is less than ${price}. No lantern yet.`,
    nudge: (l) =>
      l.thought?.type === 'bool' && new RegExp(`\\bcoins\\s*>\\s*${price}\\b`).test(l.source)
        ? `\`>\` says no to exactly ${price}. *At least* is \`>=\`.`
        : askMiss('coins', `coins >= ${price}`)(l),
    model: `coins >= ${price}`,
  }

  // The same? Words must match exactly; a word is never a number.
  const same = pick(r, ['case', 'type'] as const)
  const sameText = same === 'case' ? '"Torch" == "torch"' : '"12" == 12'
  const sameC = yesNo('quiz-same', 'False', (c) =>
    c === 'True'
      ? same === 'case'
        ? 'A capital `T` and a small `t` are different letters, so the words aren\'t the same.'
        : '`"12"` is a `str` and `12` is an `int`: a word is never the same as a number.'
      : c === 'error'
        ? '`==` can compare any two things. They just aren\'t the same.'
        : undefined,
  )
  const sameStep: LessonStep = {
    say: `What does \`${sameText}\` make?`,
    show: { kind: 'value', text: sameText },
    ask: 'What does it make?',
    tag: 'you',
    choices: sameC,
    done: (e) => chose(e, sameC),
    praise: same === 'case' ? '`False`: `==` checks every letter, capitals too.' : '`False`: a `str` is never equal to an `int`, even when they look alike.',
  }

  // The boundary, asked the other way round.
  const k = pick(r, ['le', 'lt'] as const)
  const edgeText = k === 'le' ? 'hp <= 30' : 'hp < 30'
  const edgeAnswer = k === 'le' ? 'True' : 'False'
  const edgeC = yesNo('quiz-edge', edgeAnswer, (c) =>
    c === 'error' ? 'Both sides are numbers, so they can be compared.' : k === 'le' ? '`<=` is *less than, or the same*. 30 is the same as 30.' : '`<` is *less than* only. 30 isn\'t less than 30.',
  )
  const edgeStep: LessonStep = {
    say: `\`hp\` is 30. What does \`${edgeText}\` make?`,
    show: hud(['hp']),
    ask: `${edgeText}?`,
    tag: 'you',
    choices: edgeC,
    done: (e) => chose(e, edgeC),
    praise: k === 'le' ? '`True`: *or the same* counts, and 30 is the same as 30.' : '`False`: 30 isn\'t *less than* 30. It\'s the same.',
  }

  // In.
  const thing = pick(r, ['torch', 'rope'] as const)
  const inStep: LessonStep = {
    speaker: 'courier',
    say: `Did I pack ${thing === 'torch' ? 'a torch' : 'a rope'}? Ask the robot.`,
    show: hud(['backpack']),
    ask: thing === 'torch' ? 'A torch?' : 'A rope?',
    tag: 'robot',
    done: (e) =>
      thing === 'torch'
        ? heard(e, (t) => t.type === 'bool' && t.repr === 'True' && /(["'])torch\1\s+in\s+backpack/.test(t.source ?? '') && !/\band\b/.test(t.source ?? ''))
        : heard(e, (t) => t.type === 'bool' && t.repr === 'False' && /(["'])rope\1\s+in\s+backpack/.test(t.source ?? '') && !/\bor\b/.test(t.source ?? '')),
    praise: thing === 'torch' ? '`True`: the torch is at index `1`.' : '`False`: the robot looked at every slot, and no rope.',
    nudge: askMiss('backpack', `"${thing}" in backpack`),
    model: `"${thing}" in backpack`,
  }

  // And or or, on the gate, from Mira's card.
  const op = pick(r, ['and', 'or'] as const)
  const tests: [string, boolean][] = [
    ['has_key', false],
    [`coins > ${between(r, 5, 10)}`, true],
  ]
  const [a, b] = r() < 0.5 ? [tests[0]!, tests[1]!] : [tests[1]!, tests[0]!]
  const gateText = `${a[0]} ${op} ${b[0]}`
  const gateAnswer = (op === 'and' ? a[1] && b[1] : a[1] || b[1]) ? 'True' : 'False'
  const gateC = yesNo('quiz-gate', gateAnswer, (c) =>
    c === 'error'
      ? `\`${op}\` joins two answers. Both sides here are \`bool\`s.`
      : op === 'and'
        ? '`has_key` is `False`, so not both: `and` makes `False`.'
        : `\`has_key\` is \`False\`, but \`${a[0] === 'has_key' ? b[0] : a[0]}\` is \`True\`: one is enough for \`or\`.`,
  )
  const gateStep: LessonStep = {
    say: `Will this gate open? What does \`${gateText}\` make?`,
    show: { kind: 'gate', op, locks: [{ label: a[0], on: a[1] }, { label: b[0], on: b[1] }] },
    ask: 'Will it open?',
    tag: 'you',
    choices: gateC,
    done: (e) => chose(e, gateC),
    praise: op === 'and' ? '`False`: one lamp is dark, and `and` needs both.' : '`True`: one lamp is lit, and `or` needs only one.',
  }

  // A question joined with or, asked of the robot.
  const limit = pick(r, [40, 50, 60])
  const orStep: LessonStep = {
    speaker: 'courier',
    say: `The bridge holds anyone with a rope, or under ${limit} HP. Ask the robot if I can cross.`,
    show: { kind: 'gate', op: 'or', locks: [{ label: '"rope" in backpack', on: false }, { label: `hp < ${limit}`, on: true }] },
    ask: 'Can she cross?',
    tag: 'robot',
    done: (e) => asked(e, new RegExp(`^(?=.*\\bor\\b)(?=.*(["'])rope\\1\\s+in\\s+backpack)(?=.*(\\bhp\\s*<\\s*${limit}\\b|\\b${limit}\\s*>\\s*hp\\b))`), 'True'),
    praise: `No rope, but 30 is under ${limit}: one is enough, so \`or\` makes \`True\`.`,
    nudge: (l) =>
      l.thought?.type === 'bool' && /\band\b/.test(l.source)
        ? '`and` needs both. *A rope, or* low HP: join them with `or`.'
        : l.thought?.type === 'bool' && !/\bor\b/.test(l.source)
          ? `Ask both, joined with \`or\`: \`"rope" in backpack or hp < ${limit}\`.`
          : askMiss('hp', `"rope" in backpack or hp < ${limit}`)(l),
    model: `"rope" in backpack or hp < ${limit}`,
  }

  // An answer kept.
  const keep = pick(r, [
    { name: 'brave', say: 'whether `hp` is more than 25', src: /\bhp\b/, model: 'brave = hp > 25', value: 'True', reads: 'hp', shows: String(HP) },
    { name: 'broke', say: 'whether `coins` is 0', src: /\bcoins\b/, model: 'broke = coins == 0', value: 'False', reads: 'coins', shows: String(COINS) },
    { name: 'locked_out', say: 'whether Mira has no key', src: /\bhas_key\b/, model: 'locked_out = not has_key', value: 'True', reads: 'has_key', shows: 'False' },
  ])
  const keepStep: LessonStep = {
    say: `Make the robot remember \`${keep.name}\`: ${keep.say}.`,
    show: {
      kind: 'hud',
      title: 'Mira',
      stats: [{ name: keep.reads, value: keep.shows }, { name: keep.name, value: '?' }],
      mark: [keep.name],
    },
    ask: 'Remember the answer.',
    tag: 'robot',
    done: (e) => everBy(e, (src, s) => new RegExp(`^\\s*${keep.name}\\s*=[^=]`).test(src) && keep.src.test(src) && compare([{ name: keep.name, value: keep.value }], s).rows[0]!.ok),
    praise: `\`${keep.name}\` points at \`${keep.value}\`: worked out by the robot, and kept.`,
    nudge: (l) =>
      new RegExp(`^\\s*${keep.name}\\s*=\\s*(True|False)\\s*$`).test(l.source)
        ? `That's the answer typed in. Let the robot ask: \`${keep.model}\`.`
        : stopped(l, `Try \`${keep.model}\`.`) ?? (l.ok && !l.thought ? `Point \`${keep.name}\` at the robot's answer: \`${keep.model}\`.` : askMiss(keep.name, keep.model)(l)),
    model: keep.model,
  }

  return [atLeast, sameStep, inStep, edgeStep, orStep, gateStep, keepStep]
}

function seedOfPage(): number {
  if (typeof location === 'undefined') return 1
  const given = Number(new URLSearchParams(location.search).get('seed'))
  return Number.isFinite(given) && given > 0 ? given : Math.floor(Math.random() * 1e9) + 1
}

export const logicLesson = (seed: number): Lesson => ({
  id: 'v2-logic',
  teaches: ['compare', 'bool'],
  pictureAtAsk: true,
  wipe: true,
  steps: [...teach, ...quiz(seed)],
  outro: [
    { say: 'Now the robot can ask questions of its memory, and get `True` or `False`.', focus: 'memory' },
    { speaker: 'courier', say: 'Next, let\'s teach it to *choose* with the answers. Into the cave!' },
  ],
  takeaway: 'A comparison asks a question and makes a `bool`. `and` needs both, `or` needs one, and `not` flips the answer.',
})

export const v2logic = logicLesson(seedOfPage())
