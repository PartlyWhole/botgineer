/**
 * v2, Level 5: Lists (`v2-lists`).
 *
 * The robot's problem (R12): Mira brings it loot — a sword, a shield, a
 * potion — and one name per item (`a`, `b`, `c`) does not scale. It ends
 * able to keep many things in order under one name, the way a game's
 * hotbar does: pick any slot by its number, swap one, pick up a new one,
 * and know that two names can share a list.
 *
 * The example is a game inventory on purpose: young learners are often
 * gamers, and a hotbar is already a list they know — numbered slots in a
 * row, one item each, a new item landing in the next free slot, and no
 * slot past the end.
 *
 * Each idea is shown in the robot's memory by the crow before it has a word
 * or a question (R1), the list lit as it is read (`Beat.mark`) and the
 * hotbar's slot selected on the stage, and asked straight after:
 *
 * 1. `hotbar = ["sword", "shield", "potion"]`: one name, one list object,
 *    each slot a pointer to an object of its own (invariant 4), numbered
 *    from `0`.
 * 2. `hotbar[0]`: follow the name, then the slot. A slot past the end
 *    stops the robot with an `IndexError`. Predicted, then typed.
 * 3. `len(hotbar)`: how many slots; the last is one less.
 * 4. `hotbar[1] = "bow"`: one slot moves; the list is the same list.
 * 5. `hotbar.append("map")`: a new slot on the end.
 * 6. `saved = hotbar`: it looks like a save, and it is not a copy — one
 *    list with two names, so a change through either shows through both.
 *    Predicted.
 *
 * Then eight, from a seed, one concept each, taking turns between building
 * a goal memory, predicting, and asking the robot: a party of heroes from
 * scratch; a score's slot (or an `IndexError`); a hero swapped; the last
 * hero looked up; the last slot's number; a hero joining; a change seen
 * through a second name; two names on one party, built.
 */
import { between, rng } from '../../../src/practice/exercises'
import { compare, holds, itemsOf, type Goal, type GoalBinding } from '../../../src/memory/goal'
import type { MemorySnapshot } from '../../../src/memory/model'
import type { Prop } from '../../../src/scene/props'
import {
  chose,
  errorType,
  ever,
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

/* --------------------------------- helpers --------------------------------- */

const has = (e: Evidence, g: GoalBinding) => ever(e, (s) => holds(g, s))

/** The line that made the change had this in it, and left the row true. */
const madeBy = (e: Evidence, pattern: RegExp, g: GoalBinding) => everBy(e, (src, s) => pattern.test(src) && holds(g, s))

/** The robot looked this up by indexing `name`, rather than being told it. */
const lookedUp = (e: Evidence, name: string, repr: string) =>
  heard(e, (t) => t.repr === repr && new RegExp(`\\b${name}\\s*\\[`).test(t.source ?? ''))

const bindingOf = (s: MemorySnapshot | undefined, name: string) => {
  const b = s?.bindings.find((x) => x.name === name)
  return b && s ? (s.objects[b.target] ?? null) : null
}

/** The usual misses on a line that makes or changes a list. */
function listMiss(name: string, example: string) {
  return (l: Line): string | undefined => {
    if (errorType(l) === 'IndexError') return 'There\'s no slot with that number yet. `append` adds one on the end.'
    // Words without quotes read as names the robot has never heard of.
    if (errorType(l) === 'NameError' && /\[\s*[A-Za-z]/.test(l.source)) return 'Words need quotes, or the robot reads them as names: `"sword"`.'
    if (errorType(l) === 'NameError') return `The robot has no memory called that yet. Start with \`${example}\`.`
    const o = bindingOf(l.memory, name)
    if (o?.type === 'tuple') return 'Without square brackets that isn\'t a list. Put `[` and `]` round the items.'
    if (o && o.type !== 'list') return `\`${name}\` points at \`${o.repr}\`, not a list. Square brackets make a list: \`${example}\`.`
    return stopped(l, `Try \`${example}\`.`)
  }
}

/** The usual misses when a slot is to be looked up. */
function lookupMiss(name: string, slot: number, repr: string) {
  return (l: Line): string | undefined => {
    if (errorType(l) === 'IndexError') return `There's no slot that high. The slots start at \`0\`.`
    const t = l.thought
    if (t?.repr === repr && !l.source.includes('[')) return `That's the right item, typed in. Let the robot look it up: \`${name}[${slot}]\`.`
    if (t && l.source.includes('[')) return `That's slot ${/\[\s*(-?\d+)/.exec(l.source)?.[1] ?? '?'}. Counting from \`0\`, the one you want is slot \`${slot}\`.`
    return stopped(l, `Look it up by its slot: \`${name}[${slot}]\`.`)
  }
}

/** What a line left memory looking like, against a goal: the first thing off. */
function goalMiss(goal: Goal, how?: { pattern: RegExp; say: string }) {
  return (l: Line): string | undefined => {
    if (errorType(l) === 'IndexError') return 'There\'s no slot with that number. `append` adds one on the end.'
    if (errorType(l) === 'NameError') return 'That uses a name the robot has no memory of yet.'
    if (!l.ok) return stopped(l, 'Check the line against the goal.')
    if (!l.memory) return undefined
    const { rows, extra, met } = compare(goal, l.memory)
    // A name this very line made, that the goal does not have: most likely
    // a typo, and the thing to put right first.
    const made = /^\s*([A-Za-z_]\w*)\s*=(?!=)/.exec(l.source)?.[1]
    if (made && extra.includes(made)) return `\`${made}\` isn't in the goal. Undo that line, and try again.`
    if (met && how && !how.pattern.test(l.source)) return how.say
    const off = rows.find((r) => !r.ok)
    if (off?.same && off.have !== null) return `\`${off.name}\` has its own list. Point it at \`${off.same}\`'s: \`${off.name} = ${off.same}\`.`
    // One item too many (an append of the wrong thing) cannot be taken out
    // with anything taught yet: Undo takes the line back.
    const want = off ? itemsOf(off.value) : null
    const have = off && l.memory ? bindingOf(l.memory, off.name) : null
    if (off && want && have?.type === 'list' && (have.elements?.length ?? 0) > want.length)
      return `\`${off.name}\` has one item too many now. Undo that line, and try again.`
    // The right way, the wrong item: an append of a typo. Putting it right
    // with a slot would not be an append, so Undo it and append again.
    if (off && /\.append\s*\(/.test(l.source) && how?.pattern.test(l.source))
      return 'That appended the wrong item. Undo that line, and append again.'
    if (off && off.have !== null) return `\`${off.name}\` points at \`${off.have}\` now. The goal has \`${off.value}\`.`
    if (extra.length) return `\`${extra[0]}\` isn't in the goal. Undo that line, or wipe the memory and start again.`
    if (off) return `Nearly: \`${off.name}\` is still missing.`
    return undefined
  }
}

/* --------------------------------- teaching --------------------------------- */

const HOT = ['sword', 'shield', 'potion']
const hotbar = (items: string[], mark?: number): Prop => (mark === undefined ? { kind: 'hotbar', items } : { kind: 'hotbar', items, mark })
const MADE = 'hotbar = ["sword", "shield", "potion"]'
const SWAPPED = ['sword', 'bow', 'potion']
const GROWN = ['sword', 'bow', 'potion', 'map']

const slotTwo: Choices = {
  id: 'lists-slot',
  options: [
    { id: "'potion'", label: '`"potion"`' },
    { id: "'shield'", label: '`"shield"`' },
    { id: "'sword'", label: '`"sword"`' },
    { id: 'IndexError', label: 'It stops: `IndexError`' },
  ],
  answer: "'potion'",
  nudge: (c) =>
    c === "'shield'"
      ? 'Slots count from `0`: slot `2` is the third item.'
      : c === 'IndexError'
        ? 'Three items make slots `0`, `1` and `2`, so slot `2` is there: the last one.'
        : 'Slot `0` is the first. Count `0`, `1`, `2` along the hotbar.',
}

const alias: Choices = {
  id: 'lists-alias',
  options: [
    { id: 'grown', label: '`[1, 2, 3]`' },
    { id: 'same', label: '`[1, 2]`' },
    { id: 'three', label: '`[3]`' },
    { id: 'error', label: 'It stops: `NameError`' },
  ],
  answer: 'grown',
  nudge: (c) =>
    c === 'same'
      ? '`b = a` didn\'t copy the list. Both names point at one list, and `append` changed it.'
      : '`append` added a slot to the one list both names point at.',
}

const teach: LessonStep[] = [
  {
    beats: [
      { speaker: 'courier', say: 'Loot for the robot! A sword, a shield and a potion.', show: hotbar(HOT), act: [{ actor: 'courier', do: 'enter' }] },
      { say: 'One name each would work: `a`, `b` and `c`…', types: 'a = "sword"', memory: ['a = "sword"', 'b = "shield"', 'c = "potion"'], show: hotbar(HOT) },
      { say: '…but fifty items would need fifty names. The robot needs one name for the whole row.', memory: ['a = "sword"', 'b = "shield"', 'c = "potion"'], show: hotbar(HOT) },
      { say: 'That\'s a *list*: the items in square brackets, with commas between.', types: MADE, memory: [MADE], show: hotbar(HOT) },
      { say: 'The robot makes one list object, and points `hotbar` at it.', memory: [MADE], mark: ['hotbar'], show: hotbar(HOT) },
      { say: 'Each slot of the list points at an object of its own: three `str`s.', memory: [MADE], mark: ['hotbar'], show: hotbar(HOT) },
      { say: 'Like a game\'s hotbar, the slots are numbered. They start at `0`.', memory: [MADE], show: hotbar(HOT, 0) },
    ],
    say: 'Your turn. Point `hotbar` at a list of "sword", "shield" and "potion".',
    tag: 'you',
    done: (e) => has(e, { name: 'hotbar', value: '["sword", "shield", "potion"]' }),
    praise: 'One name, one list, and three slots, each pointing at its item.',
    nudge: listMiss('hotbar', MADE),
    model: MADE,
  },
  {
    beats: [
      { say: 'To use an item, pick its slot: the number in square brackets.', types: 'hotbar[0]', thought: "'sword'", memory: [MADE], mark: ['hotbar'], show: hotbar(HOT, 0) },
      { say: '`hotbar[0]`: follow `hotbar` to the list, then slot `0` to its object, `"sword"`.', memory: [MADE], mark: ['hotbar'], show: hotbar(HOT, 0) },
      { say: 'Slot `1` is the second item: `"shield"`.', types: 'hotbar[1]', thought: "'shield'", memory: [MADE], show: hotbar(HOT, 1) },
      { say: 'Three items, so the slots are `0`, `1` and `2`. There\'s no slot `3`.', types: 'hotbar[3]', stops: 'IndexError', thought: '', memory: [MADE], show: hotbar(HOT) },
      { say: 'Asking for a slot that isn\'t there stops the robot: an `IndexError`.', memory: [MADE], show: hotbar(HOT) },
    ],
    say: 'What does `hotbar[2]` make?',
    show: { kind: 'value', text: 'hotbar[2]' },
    ask: 'What does it make?',
    tag: 'you',
    choices: slotTwo,
    done: (e) => chose(e, slotTwo),
    praise: '`0`, `1`, `2`: slot `2` is the third item, the potion.',
  },
  {
    say: 'Equip the first item: ask the robot for it.',
    show: hotbar(HOT),
    ask: 'The first item',
    tag: 'robot',
    done: (e) => lookedUp(e, 'hotbar', "'sword'"),
    praise: 'The first is slot `0`: the sword.',
    nudge: lookupMiss('hotbar', 0, "'sword'"),
    model: 'hotbar[0]',
  },
  {
    beats: [
      { say: '`len` counts the slots in a list.', types: 'len(hotbar)', thought: '3', memory: [MADE], mark: ['hotbar'], show: hotbar(HOT) },
      { say: 'Three slots, numbered `0` to `2`: the last is always one less than the length.', memory: [MADE], show: hotbar(HOT, 2) },
    ],
    say: 'Ask the robot how many items are in the hotbar.',
    show: hotbar(HOT),
    ask: 'How many items?',
    tag: 'robot',
    done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '3' && /\blen\s*\(\s*hotbar\s*\)/.test(t.source ?? '')),
    praise: '`len(hotbar)` is `3`: three slots.',
    nudge: (l) => (l.thought?.repr === '3' && !/len/.test(l.source) ? 'Let the robot count them: `len(hotbar)`.' : stopped(l, 'Count them with `len(hotbar)`.')),
    model: 'len(hotbar)',
  },
  {
    beats: [
      { speaker: 'courier', say: 'Swap your shield for my bow! It\'s better.', show: hotbar(HOT, 1) },
      { say: '`hotbar[1] = "bow"` moves slot `1` to a new object, `"bow"`.', types: 'hotbar[1] = "bow"', memory: [MADE, 'hotbar[1] = "bow"'], mark: ['hotbar'], show: hotbar(SWAPPED, 1) },
      { say: 'It\'s the same list, with one arrow moved. Nothing points at the shield now, so it\'s let go.', memory: [MADE, 'hotbar[1] = "bow"'], show: hotbar(SWAPPED) },
    ],
    say: 'Make the robot\'s hotbar match: swap slot `1` to "bow".',
    show: { kind: 'goal', goal: [{ name: 'hotbar', value: '["sword", "bow", "potion"]' }] },
    ask: 'Swap slot 1.',
    tag: 'you',
    done: (e) => madeBy(e, /\bhotbar\s*\[\s*1\s*\]\s*=/, { name: 'hotbar', value: '["sword", "bow", "potion"]' }),
    praise: 'Slot `1` moved to the bow. The list is still the same list.',
    nudge: goalMiss([{ name: 'hotbar', value: '["sword", "bow", "potion"]' }], {
      pattern: /\[\s*1\s*\]\s*=/,
      say: 'That made a whole new list. Move just the one slot: `hotbar[1] = "bow"`.',
    }),
    model: 'hotbar[1] = "bow"',
  },
  {
    beats: [
      { speaker: 'courier', say: 'And you picked up a map!', show: hotbar(SWAPPED) },
      { say: 'There\'s no slot `3` to change. `append` adds a new slot on the end.', types: 'hotbar.append("map")', memory: [MADE, 'hotbar[1] = "bow"', 'hotbar.append("map")'], mark: ['hotbar'], show: hotbar(GROWN, 3) },
      { say: 'The list grows. Its new slot, `3`, points at `"map"`.', memory: [MADE, 'hotbar[1] = "bow"', 'hotbar.append("map")'], show: hotbar(GROWN, 3) },
    ],
    say: 'Put the map in a new slot at the end of the robot\'s hotbar.',
    show: { kind: 'goal', goal: [{ name: 'hotbar', value: '["sword", "bow", "potion", "map"]' }] },
    ask: 'Add it on the end.',
    tag: 'you',
    done: (e) => madeBy(e, /\bhotbar\.append\s*\(/, { name: 'hotbar', value: '["sword", "bow", "potion", "map"]' }),
    praise: '`append` gave the list a fourth slot, `3`, pointing at the map.',
    nudge: goalMiss([{ name: 'hotbar', value: '["sword", "bow", "potion", "map"]' }], {
      pattern: /\.append\s*\(/,
      say: 'That made a whole new list. Add to this one: `hotbar.append("map")`.',
    }),
    model: 'hotbar.append("map")',
  },
  {
    beats: [
      { say: 'One more thing. You might think `saved = hotbar` saves a copy…', types: 'saved = hotbar', memory: ['hotbar = ["sword", "bow", "potion", "map"]', 'saved = hotbar'], mark: ['saved'] },
      { say: '…but it doesn\'t. `saved` points at the very same list.', memory: ['hotbar = ["sword", "bow", "potion", "map"]', 'saved = hotbar'], mark: ['saved', 'hotbar'] },
      { say: 'So a change through one name shows through the other.', types: 'hotbar.append("gem")', memory: ['hotbar = ["sword", "bow", "potion", "map"]', 'saved = hotbar', 'hotbar.append("gem")'], mark: ['saved', 'hotbar'] },
    ],
    say: 'After these three lines, what is `b`?',
    show: { kind: 'code', text: 'a = [1, 2]\nb = a\na.append(3)' },
    ask: 'What is b?',
    tag: 'you',
    choices: alias,
    done: (e) => chose(e, alias),
    praise: '`a` and `b` are one list, so `b` has the `3` too: `[1, 2, 3]`.',
  },
]

/* --------------------------------- the eight --------------------------------- */

/**
 * The practice, from a seed: one concept each, taking turns between a goal
 * memory to build, a prediction to pick, and a look-up to type. They share
 * one party of heroes, so each builds on the last, as a memory does.
 */
export function practice(seed: number): LessonStep[] {
  const r = rng(seed)
  const pool = ['Mira', 'Bolt', 'Pip', 'Dot', 'Sprocket', 'Nib']
  const pickOut = () => pool.splice(Math.floor(r() * pool.length), 1)[0]!
  const [a, b, c, d] = [pickOut(), pickOut(), pickOut(), pickOut()]
  const q = (s: string) => `"${s}"`
  const listOf = (...xs: string[]) => `[${xs.map(q).join(', ')}]`

  // 1. A list of words, from scratch.
  const g1: Goal = [{ name: 'party', value: listOf(a, b) }]
  // 2. A slot's value, or a slot that is not there.
  // Three different numbers, so every option is a different answer.
  const nums: number[] = []
  while (nums.length < 3) {
    const x = between(r, 2, 9)
    if (!nums.includes(x)) nums.push(x)
  }
  const past = r() < 0.34
  const k = past ? 3 : between(r, 0, 2)
  const slotAsk: Choices = {
    id: 'practice-slot',
    options: [
      ...new Set([past ? 'IndexError' : String(nums[k]), ...nums.map(String), 'IndexError']),
    ]
      .slice(0, 4)
      .map((x) => ({ id: x, label: x === 'IndexError' ? 'It stops: `IndexError`' : `\`${x}\`` })),
    answer: past ? 'IndexError' : String(nums[k]),
    nudge: () => (past ? 'Three items make slots `0` to `2`. There\'s no slot `3`.' : `Count from \`0\`: slot \`${k}\` holds \`${nums[k]}\`.`),
  }
  // 3. A slot changed.
  const g3: Goal = [{ name: 'party', value: listOf(c, b) }]
  // 5. The last slot's number.
  const size = between(r, 4, 7)
  const lastAsk: Choices = {
    id: 'practice-last',
    options: [size - 1, size, size + 1, 0].map((x) => ({ id: String(x), label: `\`${x}\`` })),
    answer: String(size - 1),
    nudge: (x) => (x === String(size) ? `Slots start at \`0\`, so ${size} items end at slot \`${size - 1}\`.` : `${size} items: slots \`0\` to \`${size - 1}\`.`),
  }
  // 6. An item appended.
  const g6: Goal = [{ name: 'party', value: listOf(c, b, d) }]
  // 7. A change seen through a second name.
  const n = between(r, 2, 8)
  const seen: Choices = {
    id: 'practice-alias',
    options: [
      { id: 'changed', label: `\`[${n}, 0]\`` },
      { id: 'kept', label: '`[1, 0]`' },
      { id: 'error', label: 'It stops: `IndexError`' },
      { id: 'one', label: `\`${n}\`` },
    ],
    answer: 'changed',
    nudge: (x) => (x === 'kept' ? '`y = x` shares the list: changing slot `0` through `x` changes it for `y` too.' : 'Slot `0` of the one shared list now points at the new value.'),
  }
  // 8. Two names on one list, built.
  const g8: Goal = [...g6, { name: 'team', value: listOf(c, b, d), same: 'party' }]

  return [
    {
      beats: [
        { say: 'Now you build them. I\'ve wiped the robot\'s memory for a new one: your party of heroes.', show: { kind: 'goal', goal: g1 }, focus: 'memory' },
        { say: 'Something went wrong? Undo takes back the last line.', show: { kind: 'goal', goal: g1 }, focus: 'memory' },
      ],
      wipeFirst: true,
      say: 'Make the robot\'s memory match the goal.',
      show: { kind: 'goal', goal: g1 },
      ask: 'Make memory match.',
      tag: 'you',
      done: (e) => reached(e, g1),
      praise: 'A party of two: each slot points at a hero\'s name, a `str`.',
      nudge: goalMiss(g1),
      model: `party = ${listOf(a, b)}`,
    },
    {
      say: `\`nums = [${nums.join(', ')}]\`. What does \`nums[${k}]\` make?`,
      show: { kind: 'value', text: `scores[${k}]` },
      ask: 'What does it make?',
      tag: 'you',
      choices: slotAsk,
      done: (e) => chose(e, slotAsk),
      praise: past ? 'Slots `0` to `2`, so slot `3` stops the robot: `IndexError`.' : `Slot \`${k}\`, counting from \`0\`: \`${nums[k]}\`.`,
    },
    {
      say: `${c} takes ${a}'s place in the party, in slot \`0\`. Change it in the robot's list.`,
      show: { kind: 'goal', goal: g3 },
      ask: 'Change slot 0.',
      tag: 'you',
      done: (e) => madeBy(e, /\bparty\s*\[\s*0\s*\]\s*=/, g3[0]!) && reached(e, g3),
      praise: 'One slot moved, and it\'s still the same list.',
      nudge: goalMiss(g3, { pattern: /\[\s*0\s*\]\s*=/, say: `That's a new list. Move just slot \`0\`: \`party[0] = ${q(c)}\`.` }),
      model: `party[0] = ${q(c)}`,
    },
    {
      say: 'Ask the robot for the last hero in `party`.',
      show: { kind: 'goal', goal: g3 },
      ask: 'The last hero',
      tag: 'robot',
      done: (e) => lookedUp(e, 'party', `'${b}'`),
      praise: 'Two heroes, slots `0` and `1`: the last is slot `1`.',
      nudge: lookupMiss('party', 1, `'${b}'`),
      model: 'party[1]',
    },
    {
      say: `A hotbar has ${size} slots. What number is its last slot?`,
      show: { kind: 'value', text: `len(xs) == ${size}` },
      ask: 'The last slot is…',
      tag: 'you',
      choices: lastAsk,
      done: (e) => chose(e, lastAsk),
      praise: `From \`0\` to \`${size - 1}\`: one less than the length.`,
    },
    {
      say: `${d} joins the party. Add them to the end of the list.`,
      show: { kind: 'goal', goal: g6 },
      ask: 'Add to the end.',
      tag: 'you',
      done: (e) => madeBy(e, /\bparty\.append\s*\(/, g6[0]!) && reached(e, g6),
      praise: '`append` added a slot on the end.',
      nudge: goalMiss(g6, { pattern: /\.append\s*\(/, say: `That's a new list. Add to this one: \`party.append(${q(d)})\`.` }),
      model: `party.append(${q(d)})`,
    },
    {
      say: 'After these three lines, what is `y`?',
      show: { kind: 'code', text: `x = [1, 0]\ny = x\nx[0] = ${n}` },
      ask: 'What is y?',
      tag: 'you',
      choices: seen,
      done: (e) => chose(e, seen),
      praise: `One list, two names: \`y\` is \`[${n}, 0]\` too.`,
    },
    {
      say: 'Give the same party a second name, `team`. Not a copy: the same list.',
      show: { kind: 'goal', goal: g8 },
      ask: 'Two names, one list',
      tag: 'you',
      done: (e) => reached(e, g8),
      praise: '`team` and `party` point at one list, so they will never disagree.',
      nudge: goalMiss(g8),
      model: 'team = party',
    },
  ]
}

function seedOfPage(): number {
  if (typeof location === 'undefined') return 1
  const given = Number(new URLSearchParams(location.search).get('seed'))
  return Number.isFinite(given) && given > 0 ? given : Math.floor(Math.random() * 1e9) + 1
}

export const listsLesson = (seed: number): Lesson => ({
  id: 'v2-lists',
  teaches: ['index', 'alias', 'mutate-vs-rebind'],
  pictureAtAsk: true,
  wipe: true,
  steps: [...teach, ...practice(seed)],
  outro: [
    { say: 'Now the robot can keep a whole hotbar of things under one name.', focus: 'memory' },
    { speaker: 'courier', say: 'And pick any item by its slot number. Nice one, robot!' },
  ],
  takeaway: 'A list keeps many objects in order under one name. Its slots count from `0`, and two names can share one list.',
})

export const v2lists = listsLesson(seedOfPage())
