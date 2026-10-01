/**
 * v2, Level 5: Lists (`v2-lists`).
 *
 * The robot's problem (R12): Mira brings it loot — a sword, a shield, a
 * potion — and one name per item (`a`, `b`, `c`) does not scale. It ends
 * able to keep many things in order under one name, the way a game's
 * hotbar does: pick any slot by its index, swap one, pick up a new one,
 * and know that two names can share a list.
 *
 * The example is a game inventory on purpose: young learners are often
 * gamers, and a hotbar is already a list they know — slots in a
 * row, one item each, a new item landing in the next free slot, and no
 * slot past the end.
 *
 * Each idea is shown in the robot's memory by the crow before it has a word
 * or a question (R1), the list lit as it is read (`Beat.mark`) and the
 * hotbar's slot selected on the stage, and asked straight after:
 *
 * 1. `hotbar = ["sword", "shield", "potion"]`: one name, one list object,
 *    each slot a pointer to an object of its own (invariant 4), each at an
 *    index counted
 *    from `0`.
 * 2. `hotbar[0]`: follow the name, then the slot. A slot past the end
 *    stops the robot with an `IndexError`. Predicted, then typed.
 * 3. `len(hotbar)`: how many slots; the last is one less.
 * 4. `hotbar[1] = "bow"`: one slot moves; the list is the same list.
 * 5. `hotbar.append("map")`: a new slot on the end.
 * 6. `b = a`: not a copy — one list with two names. The crow walks the
 *    three lines of a code card through memory, `a = [1, 2]` then `b = a`,
 *    and stops before the append's effect: that is the question.
 *
 * Then eight, from a seed, told as packing a backpack for an adventure
 * with Mira (`practice`): pack it, add to it twice, count it, find the
 * n-th thing, reach past the end, swap one thing, and share it.
 */
import { between, pick, rng } from '../../../src/practice/exercises'
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
    if (errorType(l) === 'IndexError') return 'There\'s no slot at that index yet. `append` adds one on the end.'
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
    if (t && l.source.includes('[')) return `That's index ${/\[\s*(-?\d+)/.exec(l.source)?.[1] ?? '?'}. Counting from \`0\`, the one you want is at index \`${slot}\`.`
    return stopped(l, `Look it up by its index: \`${name}[${slot}]\`.`)
  }
}

/** What a line left memory looking like, against a goal: the first thing off. */
function goalMiss(goal: Goal, how?: { pattern: RegExp; say: string }) {
  return (l: Line): string | undefined => {
    if (errorType(l) === 'IndexError') return 'There\'s no slot at that index. `append` adds one on the end.'
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
      ? 'Indexes count from `0`: index `2` is the third item.'
      : c === 'IndexError'
        ? 'Three items have indexes `0`, `1` and `2`, so index `2` is there: the last one.'
        : 'Index `0` is the first. Count `0`, `1`, `2` along the hotbar.',
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
      { say: 'Each slot\'s position is called its *index*. Indexes start at `0`.', memory: [MADE], show: hotbar(HOT, 0) },
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
      { say: 'To use an item, put its index in square brackets.', types: 'hotbar[0]', thought: "'sword'", memory: [MADE], mark: ['hotbar'], show: hotbar(HOT, 0) },
      { say: '`hotbar[0]`: follow `hotbar` to the list, then index `0` to its object, `"sword"`.', memory: [MADE], mark: ['hotbar'], show: hotbar(HOT, 0) },
      { say: 'Index `1` is the second item: `"shield"`.', types: 'hotbar[1]', thought: "'shield'", memory: [MADE], show: hotbar(HOT, 1) },
      { say: 'Three items, so the indexes are `0`, `1` and `2`. There\'s no index `3`.', types: 'hotbar[3]', stops: 'IndexError', thought: '', memory: [MADE], show: hotbar(HOT) },
      { say: 'Asking for an index that isn\'t there stops the robot: an `IndexError`.', memory: [MADE], show: hotbar(HOT) },
    ],
    say: 'What does `hotbar[2]` make?',
    show: { kind: 'value', text: 'hotbar[2]' },
    ask: 'What does it make?',
    tag: 'you',
    choices: slotTwo,
    done: (e) => chose(e, slotTwo),
    praise: '`0`, `1`, `2`: index `2` is the third item, the potion.',
  },
  {
    say: 'Equip the first item: ask the robot for it.',
    show: hotbar(HOT),
    ask: 'The first item',
    tag: 'robot',
    done: (e) => lookedUp(e, 'hotbar', "'sword'"),
    praise: 'The first is at index `0`: the sword.',
    nudge: lookupMiss('hotbar', 0, "'sword'"),
    model: 'hotbar[0]',
  },
  {
    beats: [
      { say: '`len` counts the slots in a list.', types: 'len(hotbar)', thought: '3', memory: [MADE], mark: ['hotbar'], show: hotbar(HOT) },
      { say: 'Three slots, at indexes `0` to `2`: the last index is always one less than the length.', memory: [MADE], show: hotbar(HOT, 2) },
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
      { say: '`hotbar[1] = "bow"` points the slot at index `1` at a new object, `"bow"`.', types: 'hotbar[1] = "bow"', memory: [MADE, 'hotbar[1] = "bow"'], mark: ['hotbar'], show: hotbar(SWAPPED, 1) },
      { say: 'It\'s the same list, with one arrow moved. Nothing points at the shield now, so it\'s let go.', memory: [MADE, 'hotbar[1] = "bow"'], show: hotbar(SWAPPED) },
    ],
    say: 'Make the robot\'s hotbar match: swap index `1` to "bow".',
    show: { kind: 'goal', goal: [{ name: 'hotbar', value: '["sword", "bow", "potion"]' }] },
    ask: 'Swap index 1.',
    tag: 'you',
    done: (e) => madeBy(e, /\bhotbar\s*\[\s*1\s*\]\s*=/, { name: 'hotbar', value: '["sword", "bow", "potion"]' }),
    praise: 'Index `1` moved to the bow. The list is still the same list.',
    nudge: goalMiss([{ name: 'hotbar', value: '["sword", "bow", "potion"]' }], {
      pattern: /\[\s*1\s*\]\s*=/,
      say: 'That made a whole new list. Move just index `1`: `hotbar[1] = "bow"`.',
    }),
    model: 'hotbar[1] = "bow"',
  },
  {
    beats: [
      { speaker: 'courier', say: 'And you picked up a map!', show: hotbar(SWAPPED) },
      { say: 'There\'s no index `3` to change. `append` adds a new slot on the end.', types: 'hotbar.append("map")', memory: [MADE, 'hotbar[1] = "bow"', 'hotbar.append("map")'], mark: ['hotbar'], show: hotbar(GROWN, 3) },
      { say: 'The list grows. Its new slot, at index `3`, points at `"map"`.', memory: [MADE, 'hotbar[1] = "bow"', 'hotbar.append("map")'], show: hotbar(GROWN, 3) },
    ],
    say: 'Put the map in a new slot at the end of the robot\'s hotbar.',
    show: { kind: 'goal', goal: [{ name: 'hotbar', value: '["sword", "bow", "potion", "map"]' }] },
    ask: 'Add it on the end.',
    tag: 'you',
    done: (e) => madeBy(e, /\bhotbar\.append\s*\(/, { name: 'hotbar', value: '["sword", "bow", "potion", "map"]' }),
    praise: '`append` gave the list a fourth slot, at index `3`, pointing at the map.',
    nudge: goalMiss([{ name: 'hotbar', value: '["sword", "bow", "potion", "map"]' }], {
      pattern: /\.append\s*\(/,
      say: 'That made a whole new list. Add to this one: `hotbar.append("map")`.',
    }),
    model: 'hotbar.append("map")',
  },
  {
    beats: [
      { say: 'One more thing, and only lists do it. Read these three lines with me.', show: { kind: 'code', text: 'a = [1, 2]\nb = a\na.append(3)' } },
      { say: '`a = [1, 2]`: the robot makes a list, and points `a` at it.', types: 'a = [1, 2]', memory: ['a = [1, 2]'], mark: ['a'], show: { kind: 'code', text: 'a = [1, 2]\nb = a\na.append(3)', mark: 1 } },
      { say: '`b = a` follows `a` to its list… and points `b` at that very list.', types: 'b = a', memory: ['a = [1, 2]', 'b = a'], mark: ['b'], show: { kind: 'code', text: 'a = [1, 2]\nb = a\na.append(3)', mark: 2 } },
      { say: 'No copy is made: one list, two names.', memory: ['a = [1, 2]', 'b = a'], mark: ['a', 'b'], show: { kind: 'code', text: 'a = [1, 2]\nb = a\na.append(3)', mark: 2 } },
      { say: 'The last line, `a.append(3)`, adds a slot to the list `a` points at.', memory: ['a = [1, 2]', 'b = a'], mark: ['a'], show: { kind: 'code', text: 'a = [1, 2]\nb = a\na.append(3)', mark: 3 } },
    ],
    say: 'So after all three lines, what is `b`?',
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
 * The practice, from a seed: the robot packs a backpack for an adventure
 * with Mira, and what she needs drives each step — pack it, add to it
 * (`append`, twice: the caves are dark, and they will be hungry), count
 * it (`len`), find the n-th thing in it (index n − 1), reach past the end
 * (`IndexError`), swap one thing (an index moved), and share it (`bag =
 * backpack`, the same list). One concept each, taking turns between
 * building a goal memory, asking the robot, and predicting, never three of
 * a kind in a row; the items are drawn from a seed, from the hotbar's
 * icons.
 */
export function practice(seed: number): LessonStep[] {
  const r = rng(seed)
  const q = (x: string) => `"${x}"`
  const listOf = (xs: string[]) => `[${xs.map(q).join(', ')}]`
  const ORDINAL = ['first', 'second', 'third', 'fourth']

  // What goes in, and why.
  const second = pick(r, ['key', 'helmet', 'coin'])
  const snack = pick(r, ['apple', 'potion'])
  const packed = ['map', second]
  const lit = [...packed, 'torch']
  const full = [...lit, snack]
  const swapped = full.map((x) => (x === second ? 'gem' : x))

  const g1: Goal = [{ name: 'backpack', value: listOf(packed) }]
  const g2: Goal = [{ name: 'backpack', value: listOf(lit) }]
  const g3: Goal = [{ name: 'backpack', value: listOf(full) }]
  const g7: Goal = [{ name: 'backpack', value: listOf(swapped) }]
  const g8: Goal = [...g7, { name: 'bag', value: listOf(swapped), same: 'backpack' }]
  const appendHow = (item: string) => ({ pattern: /\.append\s*\(/, say: `That's a whole new list. Add to this one: \`backpack.append(${q(item)})\`.` })

  // The n-th thing: index n − 1.
  const k = between(r, 1, 3)
  // Reaching past the end.
  const pastEnd: Choices = {
    id: 'practice-past',
    options: [
      { id: 'IndexError', label: 'It stops: `IndexError`' },
      { id: `'${full[3]}'`, label: `\`"${full[3]}"\`` },
      { id: `'${full[0]}'`, label: `\`"${full[0]}"\`` },
      { id: '4', label: '`4`' },
    ],
    answer: 'IndexError',
    nudge: (c) =>
      c === `'${full[3]}'`
        ? `The fourth thing is at index \`3\`. Four things have indexes \`0\` to \`3\`: there is no index \`4\`.`
        : 'Four things have indexes `0` to `3`. Index `4` is past the end, so the robot stops.',
  }

  // Where an appended thing lands: the index after the last, which is how
  // many there were.
  const lands: Choices = {
    id: 'practice-lands',
    options: [
      { id: '3', label: '`3`' },
      { id: '4', label: '`4`' },
      { id: '2', label: '`2`' },
      { id: '0', label: '`0`' },
    ],
    answer: '3',
    nudge: (c) =>
      c === '4'
        ? 'It\'s the fourth thing, but indexes count from `0`: the fourth thing is at index `3`.'
        : 'Three things are at indexes `0`, `1` and `2`, so the next one goes at index `3`.',
  }

  return [
    {
      beats: [
        { speaker: 'courier', say: 'Let\'s go on an adventure! The robot needs a backpack.', show: { kind: 'goal', goal: g1 } },
        { say: 'I\'ve wiped the robot\'s memory for it. Something went wrong? Undo takes back the last line.', show: { kind: 'goal', goal: g1 }, focus: 'memory' },
      ],
      speaker: 'courier',
      say: `Pack a map and a ${second}: make the robot's memory match.`,
      show: { kind: 'goal', goal: g1 },
      ask: 'Pack the backpack.',
      tag: 'you',
      wipeFirst: true,
      done: (e) => reached(e, g1),
      praise: 'A backpack of two: each slot points at a `str`.',
      nudge: goalMiss(g1),
      model: `backpack = ${listOf(packed)}`,
    },
    {
      speaker: 'courier',
      say: 'The caves will be dark. Add a torch to the end!',
      show: { kind: 'goal', goal: g2 },
      ask: 'Add a torch.',
      tag: 'you',
      done: (e) => madeBy(e, /\bbackpack\.append\s*\(/, g2[0]!) && reached(e, g2),
      praise: '`append` gave the backpack a third slot, at index `2`, for the torch.',
      nudge: goalMiss(g2, appendHow('torch')),
      model: 'backpack.append("torch")',
    },
    {
      speaker: 'courier',
      say: `And we'll get hungry! Before you pack ${snack === 'apple' ? 'an apple' : 'a potion'}: what index will it land at?`,
      show: { kind: 'backpack', items: lit },
      ask: 'Which index?',
      tag: 'you',
      choices: lands,
      done: (e) => chose(e, lands),
      praise: 'Indexes `0` to `2` are taken, so `append` puts it at index `3`.',
    },
    {
      speaker: 'courier',
      say: `Now pack it: ${snack === 'apple' ? 'an apple' : 'a potion'}, on the end.`,
      show: { kind: 'goal', goal: g3 },
      ask: `Add ${snack === 'apple' ? 'an apple' : 'a potion'}.`,
      tag: 'you',
      done: (e) => madeBy(e, /\bbackpack\.append\s*\(/, g3[0]!) && reached(e, g3),
      praise: 'Another slot on the end. The backpack keeps growing.',
      nudge: goalMiss(g3, appendHow(snack)),
      model: `backpack.append(${q(snack)})`,
    },
    {
      speaker: 'courier',
      say: 'How many things are in the backpack now? Ask the robot.',
      show: { kind: 'backpack', items: full },
      ask: 'How many things?',
      tag: 'robot',
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === String(full.length) && /\blen\s*\(\s*backpack\s*\)/.test(t.source ?? '')),
      praise: `\`len(backpack)\` is \`${full.length}\`: ${full.length} slots.`,
      nudge: (l) =>
        l.thought?.repr === String(full.length) && !/len/.test(l.source)
          ? 'Let the robot count them: `len(backpack)`.'
          : stopped(l, 'Count them with `len(backpack)`.'),
      model: 'len(backpack)',
    },
    {
      speaker: 'courier',
      say: `What's the ${ORDINAL[k]} thing in the backpack? Ask the robot.`,
      show: { kind: 'backpack', items: full },
      ask: `The ${ORDINAL[k]} thing`,
      tag: 'robot',
      done: (e) => lookedUp(e, 'backpack', `'${full[k]}'`),
      praise: `The ${ORDINAL[k]} thing is at index \`${k}\`, counting from \`0\`: the ${full[k]}.`,
      nudge: lookupMiss('backpack', k, `'${full[k]}'`),
      model: `backpack[${k}]`,
    },
    {
      say: 'There are four things in the backpack. What does `backpack[4]` make?',
      show: { kind: 'value', text: 'backpack[4]' },
      ask: 'What does it make?',
      tag: 'you',
      choices: pastEnd,
      done: (e) => chose(e, pastEnd),
      praise: 'Indexes `0` to `3`, so index `4` is past the end: `IndexError`.',
    },
    {
      speaker: 'courier',
      say: `I'll swap you my gem for your ${second}. Change just that index.`,
      show: { kind: 'goal', goal: g7 },
      ask: `Swap the ${second} for a gem.`,
      tag: 'you',
      done: (e) => madeBy(e, /\bbackpack\s*\[\s*1\s*\]\s*=/, g7[0]!) && reached(e, g7),
      praise: 'One slot moved, and it\'s still the same backpack.',
      nudge: goalMiss(g7, { pattern: /\[\s*1\s*\]\s*=/, say: 'That\'s a whole new list. Move just index `1`: `backpack[1] = "gem"`.' }),
      model: 'backpack[1] = "gem"',
    },
    {
      speaker: 'courier',
      say: 'I\'ll carry it too, as `bag`. The same backpack, not a copy!',
      show: { kind: 'goal', goal: g8 },
      ask: 'Two names, one backpack',
      tag: 'you',
      done: (e) => reached(e, g8),
      praise: '`bag` and `backpack` are one list: whatever one of you packs, the other has.',
      nudge: goalMiss(g8),
      model: 'bag = backpack',
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
    { speaker: 'courier', say: 'Packed, counted, and shared. Let\'s go, robot!' },
  ],
  takeaway: 'A list keeps many objects in order under one name. Its indexes count from `0`, and two names can share one list.',
})

export const v2lists = listsLesson(seedOfPage())
