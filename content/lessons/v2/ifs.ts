/**
 * v2, Level 7: Making Choices (`v2-if`). The editor arrives.
 *
 * The robot's problem (R12): inside the cave there are forks, trolls and
 * bridges, and the robot runs every line it is given. It can ask a
 * question (Asking Questions) but cannot act on the answer. It ends able
 * to choose: run a block only when a question says yes, choose between
 * two blocks, or among many.
 *
 * A choice is several lines — the question, and what to do — so this is
 * where the editor arrives (R12 for the instrument too): the crow types a
 * program into it and presses Run, and the robot follows it top to bottom
 * from an empty memory. Every demonstration is a real run, shown a moment
 * at a time (`Beat.run`): the line running lit, the lines run ticked, and
 * at the end, the lines the robot *skipped* dimmed — which is the whole
 * idea of `if`, drawn (R6).
 *
 * 1. The editor: write two lines, Run, and memory fills (a goal memory).
 * 2. `if`: a header ending in `:`, and a block pushed in. Run with `True`
 *    and with `False`; the skipped block leaves no trace. Predicted.
 * 3. The player's own `if`, then the same program with `hp` changed, run
 *    again: the program decides, not the player.
 * 4. `else`: the other block. Here the robot starts trying the program on
 *    more than one explorer (`LessonStep.cases`), drawn as a scoreboard.
 * 5. `elif`: asked only when every question above said no; the first yes
 *    wins and the rest are skipped. Walked line by line, predicted, then
 *    written into a program that has an `if` and an `else` already.
 * 6. Order matters: `hp > 10` before `hp > 50` means the second never
 *    runs. Picked.
 * 7. The end of a block: a line back at the left always runs. Picked.
 *
 * Then five, from a seed (`practice`): write a two-way choice, predict a
 * three-way one, fix a broken program, write a three-way choice where the
 * order matters, and choose on a question joined with `and`.
 */
import { pageSeed } from '../seed'
import { between, pick, rng } from '../../../src/practice/exercises'
import { compare, type Goal } from '../../../src/memory/goal'
import type { Prop } from '../../../src/scene/props'
import { chose, reached, ran, type Choices, type Lesson, type LessonStep, type Line } from '../core'
import { caseRows, codeMiss, decides, reprOf, wrongCase, type Want } from './code'

/* --------------------------------- helpers --------------------------------- */

const q = (w: string) => `'${w}'`
const paths = (branches: { test: string; result: string }[], taken?: number | null, demo?: 'walk'): Prop => ({
  kind: 'paths',
  branches,
  ...(taken !== undefined ? { taken } : {}),
  ...(demo ? { demo } : {}),
})

/** A step about a program that chooses: judged on every case. */
function choosing(opts: {
  say: string
  ask: string
  speaker?: string
  name: string
  cases: Record<string, string>[]
  want: Want
  shape: RegExp
  shapeSay: string
  praise: string
  model: string
  code?: string
  beats?: LessonStep['beats']
}): LessonStep {
  return {
    ...(opts.beats ? { beats: opts.beats } : {}),
    ...(opts.speaker ? { speaker: opts.speaker } : {}),
    say: opts.say,
    show: { kind: 'cases', name: opts.name, rows: caseRows(opts.cases, opts.want) },
    ask: opts.ask,
    tag: 'you',
    ...(opts.code !== undefined ? { code: opts.code } : {}),
    cases: opts.cases,
    done: (e) => decides(e, opts.shape, opts.name, opts.want),
    praise: opts.praise,
    nudge: (l: Line) => codeMiss(l) ?? (l.ok && !opts.shape.test(l.source) ? opts.shapeSay : wrongCase(l, opts.name, opts.want)),
    model: opts.model,
  }
}

/** A multiple-choice question about a program the crow has typed. */
function predict(id: string, options: [string, string][], answer: string, nudge: (c: string) => string | undefined): Choices {
  return { id, options: options.map(([i, label]) => ({ id: i, label })), answer, nudge }
}

/* --------------------------------- teaching --------------------------------- */

const FIRST = 'torch = True\nsteps = 3'
const FIRST_GOAL: Goal = [
  { name: 'torch', value: 'True' },
  { name: 'steps', value: '3' },
]

const LIT = 'torch = True\nif torch:\n    path = "left"'
const DARK = 'torch = False\nif torch:\n    path = "left"'
const WEAK = 'hp = 20\nif hp > 50:\n    action = "fight"'
const skipped = predict(
  'if-skip',
  [
    ['hp', 'Just `hp`, pointing at `20`'],
    ['both', '`hp`, and `action` pointing at `"fight"`'],
    ['none', 'Nothing at all'],
  ],
  'hp',
  (c) =>
    c === 'both'
      ? '`hp > 50` is `False`: 20 isn\'t more than 50. So the block is skipped, and `action` is never made.'
      : 'Line 1 always runs: it isn\'t inside the `if`. Only the block is skipped.',
)

const ELSE = 'hp = 20\nif hp > 50:\n    action = "fight"\nelse:\n    action = "run"'
const TROLL = 'hp = 30\npotions = 1\nif hp > 50:\n    action = "fight"\nelif potions > 0:\n    action = "drink"\nelse:\n    action = "run"'
const TROLL_PATHS = [
  { test: 'hp > 50', result: '"fight"' },
  { test: 'potions > 0', result: '"drink"' },
  { test: 'else', result: '"run"' },
]
const strong = predict(
  'if-first',
  [
    ['fight', '`"fight"`'],
    ['drink', '`"drink"`'],
    ['run', '`"run"`'],
  ],
  'fight',
  (c) =>
    c === 'drink'
      ? '`hp > 50` is asked first, and 80 is more than 50: yes. The first yes wins, so `elif` is never asked.'
      : '`hp > 50` is `True` for 80, so the very first block runs, and the rest are skipped.',
)

const ORDER = 'hp = 80\nif hp > 10:\n    mood = "ok"\nelif hp > 50:\n    mood = "great"'
const order = predict(
  'if-order',
  [
    ['ok', '`"ok"`'],
    ['great', '`"great"`'],
    ['both', 'First `"ok"`, then `"great"`'],
  ],
  'ok',
  (c) =>
    c === 'great'
      ? '80 is more than 50, but the robot asks top to bottom: `hp > 10` comes first, and it\'s already `True`.'
      : 'Only one block of an `if` ever runs: the first whose question says yes.',
)

const SHOP = 'coins = 3\nif coins > 5:\n    shop = "open"\ndoor = "open"'
const after = predict(
  'if-after',
  [
    ['door', '`coins` and `door`'],
    ['all', '`coins`, `shop` and `door`'],
    ['coins', 'Just `coins`'],
  ],
  'door',
  (c) =>
    c === 'coins'
      ? 'Line 4 isn\'t pushed in, so it isn\'t in the block: it runs whatever the answer was.'
      : '`coins > 5` is `False`, so the block, line 3, is skipped. Line 4 is back at the left: outside the block.',
)

const fightOrRun: Want = (g) => (Number(g.hp) > 50 ? q('fight') : q('run'))
const troll: Want = (g) => (Number(g.hp) > 50 ? q('fight') : Number(g.potions) > 0 ? q('drink') : q('run'))

const teach: LessonStep[] = [
  {
    beats: [
      { speaker: 'courier', say: 'It\'s dark and twisty in here. The robot will have choices to make!', act: [{ actor: 'courier', do: 'enter' }] },
      { say: 'A choice takes more than one line. So here\'s an *editor*, for a whole list of instructions.', focus: 'console', code: '' },
      { say: 'Watch: I type two instructions. Typing alone doesn\'t run them.', code: 'hp = 30\ncoins = 12', focus: 'console' },
      { say: 'Press Run, and the robot follows the list from the top. Line 1: `hp` points at `30`.', code: 'hp = 30\ncoins = 12', run: { line: 1 }, focus: 'run' },
      { say: 'Then line 2: `coins` points at `12`. Then it\'s done.', code: 'hp = 30\ncoins = 12', run: 'end' },
      { say: 'Each Run starts from an empty memory, and follows every line again.', code: 'hp = 30\ncoins = 12', run: 'end' },
    ],
    say: 'Your turn: write a program that makes this memory, then Run it.',
    show: { kind: 'goal', goal: FIRST_GOAL },
    ask: 'Write it, then Run.',
    tag: 'you',
    done: (e) => reached(e, FIRST_GOAL),
    praise: 'Two lines, run top to bottom: that\'s a program.',
    nudge: (l) => {
      const miss = codeMiss(l)
      if (miss) return miss
      if (!l.memory) return undefined
      const { rows, extra } = compare(FIRST_GOAL, l.memory)
      if (extra.length) return `\`${extra[0]}\` isn't in the goal. Take that line out, and Run again.`
      const off = rows.find((r) => !r.ok)
      if (off?.have) return `\`${off.name}\` points at \`${off.have}\`. The goal has \`${off.value}\`.`
      if (off) return `\`${off.name}\` is still missing: one line each.`
      return undefined
    },
    model: FIRST,
  },
  {
    beats: [
      { speaker: 'courier', say: 'A fork! The left tunnel is pitch dark. Only go that way with a torch.', show: paths([{ test: 'torch', result: '"left"' }]) },
      { say: '`if` asks a question, and its line ends with a colon.', code: 'torch = True\nif torch:' },
      { say: 'The line under it is pushed in four spaces. That\'s the `if`\'s *block*.', code: LIT },
      { say: 'The robot runs the block only when the answer is `True`.', code: LIT, show: paths([{ test: 'torch', result: '"left"' }]) },
      { say: '`torch` is `True`, so in it goes: `path` points at `"left"`.', code: LIT, run: 'end', show: paths([{ test: 'torch', result: '"left"' }], 0, 'walk') },
      { say: 'Now with no torch. `torch` is `False`…', code: DARK, show: paths([{ test: 'torch', result: '"left"' }]) },
      { say: '…so the robot skips the block. See it dimmed? There\'s no `path` at all.', code: DARK, run: 'end', show: paths([{ test: 'torch', result: '"left"' }], null, 'walk') },
      { say: 'Read this one.', code: WEAK },
    ],
    say: 'After this program runs, what\'s in the robot\'s memory?',
    show: paths([{ test: 'hp > 50', result: '"fight"' }]),
    ask: 'What\'s in memory?',
    tag: 'you',
    choices: skipped,
    done: (e) => chose(e, skipped),
    praise: '`hp > 50` is `False`, so the block is skipped: only `hp` is made.',
  },
  {
    say: 'Write an `if`: when `hp` is more than 50, point `action` at `"fight"`. Then Run.',
    show: paths([{ test: 'hp > 50', result: '"fight"' }]),
    ask: 'Fight if strong',
    tag: 'you',
    code: 'hp = 80\n',
    done: (e) => ran(e, (r) => r.ok && /^\s*if\b[^\n]*\bhp\b[^\n]*:/m.test(r.source) && reprOf(r.final, 'action') === q('fight')),
    praise: '`hp > 50` was `True`, so the robot ran the block: `action` points at `"fight"`.',
    nudge: (l) =>
      codeMiss(l) ??
      (l.ok && !/^\s*if\b/m.test(l.source)
        ? 'Let the robot decide: put the `action` line in the block of an `if hp > 50:`.'
        : l.ok && reprOf(l.memory!, 'action') === null
          ? 'No `action` was made. Is `hp` more than 50 at the top? Is the `action` line pushed in under the `if`?'
          : undefined),
    model: 'hp = 80\nif hp > 50:\n    action = "fight"',
  },
  {
    say: 'Now change `hp` to 20 at the top, and Run it again.',
    show: paths([{ test: 'hp > 50', result: '"fight"' }]),
    ask: 'Try 20 HP',
    tag: 'you',
    done: (e) => ran(e, (r) => r.ok && /^hp\s*=\s*20\s*$/m.test(r.source) && /^\s*if\b[^\n]*\bhp\b/m.test(r.source) && reprOf(r.final, 'action') === null),
    praise: 'The same program decided differently: 20 isn\'t more than 50, so the block was skipped.',
    nudge: (l) =>
      codeMiss(l) ??
      (l.ok && !/^hp\s*=\s*20\s*$/m.test(l.source)
        ? 'Change just the first line, to `hp = 20`, and Run.'
        : l.ok && reprOf(l.memory!, 'action') !== null
          ? '`action` was still made. Is it pushed in, inside the `if`\'s block?'
          : undefined),
    model: 'hp = 20\nif hp > 50:\n    action = "fight"',
  },
  choosing({
    beats: [
      { speaker: 'courier', say: 'But if we skip the fight, what do we do? Something!' },
      { say: '`else` is the other way: its block runs only when the answer is `False`.', code: ELSE, show: paths([{ test: 'hp > 50', result: '"fight"' }, { test: 'else', result: '"run"' }]) },
      { say: '`hp > 50` is `False`, so the robot skips the first block, and runs the `else`\'s.', code: ELSE, run: 'end', show: paths([{ test: 'hp > 50', result: '"fight"' }, { test: 'else', result: '"run"' }], 1, 'walk') },
      { say: 'From now on, the robot tries your program on more than one explorer.', show: { kind: 'cases', name: 'action', rows: caseRows([{ hp: '80' }, { hp: '20' }], fightOrRun) } },
    ],
    say: 'Add an `else` to your program: otherwise, `action` is `"run"`.',
    ask: 'Fight, or run',
    name: 'action',
    cases: [{ hp: '80' }, { hp: '20' }],
    want: fightOrRun,
    shape: /^\s*else\s*:/m,
    shapeSay: 'Use an `else:` under the `if`\'s block, at the left, with its own block.',
    praise: 'Strong explorers fight and the rest run: one block or the other, every time.',
    model: 'hp = 20\nif hp > 50:\n    action = "fight"\nelse:\n    action = "run"',
  }),
  {
    beats: [
      { speaker: 'courier', say: 'There\'s a troll up ahead! Fight it if you\'re strong. If not, drink a potion if you have one. Or run!' },
      { say: 'That\'s three ways. `elif` means *else if*: asked only if the questions above said no.', code: TROLL, show: paths(TROLL_PATHS) },
      { say: 'Lines 1 and 2: `hp` is `30`, and there\'s one potion.', code: TROLL, run: { line: 2 } },
      { say: 'Line 3: is `hp` more than 50? No. So its block is skipped.', code: TROLL, run: { line: 3 } },
      { say: 'Line 5, the `elif`: any potions? Yes!', code: TROLL, run: { line: 5 } },
      { say: 'So its block runs: `action` points at `"drink"`.', code: TROLL, run: { line: 6 } },
      { say: 'The rest is skipped. Only one block of an `if` ever runs: the first yes.', code: TROLL, run: 'end', show: paths(TROLL_PATHS, 1, 'walk') },
      { say: 'Now say `hp` were 80.', code: TROLL.replace('hp = 30', 'hp = 80') },
    ],
    say: 'With `hp` at 80 and one potion, what does `action` point at?',
    show: paths(TROLL_PATHS),
    ask: 'Which block runs?',
    tag: 'you',
    choices: strong,
    done: (e) => chose(e, strong),
    praise: '`hp > 50` is asked first, and says yes: `"fight"`. The `elif` is never even asked.',
  },
  choosing({
    say: 'Your turn. Add an `elif` between them: if there are potions, `action` is `"drink"`.',
    ask: 'Fight, drink, or run',
    code: 'hp = 30\npotions = 1\nif hp > 50:\n    action = "fight"\nelse:\n    action = "run"\n',
    name: 'action',
    cases: [
      { hp: '80', potions: '1' },
      { hp: '30', potions: '1' },
      { hp: '30', potions: '0' },
    ],
    want: troll,
    shape: /^\s*elif\b[^\n]*:/m,
    shapeSay: 'Put an `elif potions > 0:` between the `if`\'s block and the `else`.',
    praise: 'Asked top to bottom, and the first yes wins: fight, else drink, else run.',
    model: TROLL,
  }),
  {
    beats: [{ say: 'The order of the questions matters. Read this one.', code: ORDER }],
    say: 'What does `mood` point at?',
    show: paths([
      { test: 'hp > 10', result: '"ok"' },
      { test: 'hp > 50', result: '"great"' },
    ]),
    ask: 'Which block runs?',
    tag: 'you',
    choices: order,
    done: (e) => chose(e, order),
    praise: '`hp > 10` comes first and says yes, so `"great"` can never be reached. Ask the hardest question first.',
  },
  {
    beats: [{ say: 'Where does a block end? Read this one.', code: SHOP }],
    say: 'After it runs, what\'s in memory?',
    show: { kind: 'code', text: SHOP },
    ask: 'What\'s in memory?',
    tag: 'you',
    choices: after,
    done: (e) => chose(e, after),
    praise: 'The block ends where the lines come back to the left. `door = "open"` always runs.',
  },
]

/* -------------------------------- practice -------------------------------- */

/**
 * The practice, from a seed: five encounters deeper in the cave, one
 * concept each — write a two-way choice, predict a three-way one, fix a
 * broken program, write a three-way choice where the order matters, and
 * choose on a question joined with `and`.
 */
export function practice(seed: number): LessonStep[] {
  const r = rng(seed)

  // 1. The bridge: two ways.
  const limit = pick(r, [60, 80, 100])
  const bridgeCases = [{ weight: String(limit - between(r, 10, 30)) }, { weight: String(limit + between(r, 5, 40)) }]
  const bridge: Want = (g) => (Number(g.weight) < limit ? q('cross') : q('wait'))
  const p1 = choosing({
    beats: [{ say: 'Now some choices of your own, deeper in the cave.' }],
    speaker: 'courier',
    say: `A rickety bridge ahead! If \`weight\` is under ${limit}, \`move\` is \`"cross"\`. Otherwise it's \`"wait"\`.`,
    ask: 'Cross, or wait',
    code: `weight = ${bridgeCases[0]!.weight}\n`,
    name: 'move',
    cases: bridgeCases,
    want: bridge,
    shape: /^\s*if\b[^\n]*\bweight\b/m,
    shapeSay: 'Let the robot decide: an `if` about `weight`, and an `else`.',
    praise: `Under ${limit}, cross; otherwise, wait. One question, two blocks.`,
    model: `weight = ${bridgeCases[0]!.weight}\nif weight < ${limit}:\n    move = "cross"\nelse:\n    move = "wait"`,
  })

  // 2. Predict a three-way choice.
  const gems = between(r, 0, 12)
  const GEMS = `gems = ${gems}\nif gems > 10:\n    pay = "gems"\nelif gems > 0:\n    pay = "one gem"\nelse:\n    pay = "a song"`
  const pays = gems > 10 ? 'gems' : gems > 0 ? 'one gem' : 'a song'
  const tollC = predict(
    'practice-toll',
    [
      ['gems', '`"gems"`'],
      ['one gem', '`"one gem"`'],
      ['a song', '`"a song"`'],
    ],
    pays,
    () =>
      gems > 10
        ? `${gems} is more than 10, so the first question says yes.`
        : gems > 0
          ? `${gems} isn't more than 10, but it is more than 0: the \`elif\` says yes.`
          : '0 isn\'t more than 10, or more than 0: both say no, so the `else` runs.',
  )
  const p2: LessonStep = {
    beats: [{ speaker: 'courier', say: 'A toll gate up ahead. Its troll takes gems, or a song!', code: GEMS }],
    say: 'What does `pay` point at?',
    show: paths([
      { test: 'gems > 10', result: '"gems"' },
      { test: 'gems > 0', result: '"one gem"' },
      { test: 'else', result: '"a song"' },
    ]),
    ask: 'Which block runs?',
    tag: 'you',
    choices: tollC,
    done: (e) => chose(e, tollC),
    praise: `With \`gems\` at ${gems}, the first yes is the ${gems > 10 ? '`if`' : gems > 0 ? '`elif`' : '`else`'}: \`"${pays}"\`.`,
  }

  // 3. Fix a broken program.
  const bug = pick(r, ['colon', 'equals', 'indent'] as const)
  const fixed = 'key = "gold"\nif key == "gold":\n    door = "open"\nelse:\n    door = "shut"'
  const broken =
    bug === 'colon'
      ? fixed.replace('if key == "gold":', 'if key == "gold"')
      : bug === 'equals'
        ? fixed.replace('key == "gold":', 'key = "gold":')
        : fixed.replace('    door = "open"', 'door = "open"')
  const doorWant: Want = (g) => (g.key === '"gold"' ? q('open') : q('shut'))
  const p3 = choosing({
    speaker: 'courier',
    say: 'Someone wrote this program for the gold door, and it stops the robot. Run it, then fix it!',
    ask: 'Fix the program',
    code: broken + '\n',
    name: 'door',
    cases: [{ key: '"gold"' }, { key: '"iron"' }],
    want: doorWant,
    shape: /^\s*if\b[^\n]*==[^\n]*:\s*$/m,
    shapeSay: 'The `if` asks whether `key` is the same as `"gold"`: two equals signs, `==`, and a colon.',
    praise:
      bug === 'colon'
        ? 'The header needed its colon: it opens the block.'
        : bug === 'equals'
          ? 'Asking needs two equals signs: `==`. One only points a name.'
          : 'The block has to be pushed in, so the robot knows it belongs to the `if`.',
    model: fixed,
  })

  // 4. Sorting gems: three ways, where the order matters.
  const big = pick(r, [100, 50])
  const small = big / 10
  const valueCases = [{ value: String(big + 20) }, { value: String(small + 3) }, { value: String(small - 2) }]
  const sort: Want = (g) => (Number(g.value) > big ? q('rare') : Number(g.value) > small ? q('shiny') : q('rock'))
  const p4 = choosing({
    speaker: 'courier',
    say: `Sort the gems! Over ${big} is \`"rare"\`, over ${small} is \`"shiny"\`, anything else is \`"rock"\`. Put it in \`kind\`.`,
    ask: 'Rare, shiny, or rock',
    code: `value = ${valueCases[0]!.value}\n`,
    name: 'kind',
    cases: valueCases,
    want: sort,
    shape: /^\s*elif\b/m,
    shapeSay: 'Three ways need an `if`, an `elif` and an `else`.',
    praise: `The hardest question first: over ${big} before over ${small}, or every rare gem would be called shiny.`,
    model: `value = ${valueCases[0]!.value}\nif value > ${big}:\n    kind = "rare"\nelif value > ${small}:\n    kind = "shiny"\nelse:\n    kind = "rock"`,
  })

  // 5. Choose on and.
  const cost = pick(r, [5, 8, 10])
  const shopCases = [
    { has_map: 'True', coins: String(cost + 2) },
    { has_map: 'True', coins: String(cost - 3) },
    { has_map: 'False', coins: String(cost + 5) },
  ]
  const shop: Want = (g) => (g.has_map === 'True' && Number(g.coins) >= cost ? q('buy') : q('leave'))
  const p5 = choosing({
    speaker: 'courier',
    beats: [
      { speaker: 'courier', say: `Down here, lanterns are cheap: only ${cost} coins!` },
      { speaker: 'courier', say: 'But they only sell to explorers with a map, so you can find your way back.' },
    ],
    say: `Set \`plan\` to \`"buy"\` if Mira has a map *and* ${cost} coins or more. Otherwise, \`"leave"\`.`,
    ask: 'Buy, or leave',
    code: `has_map = True\ncoins = ${cost + 2}\n`,
    name: 'plan',
    cases: shopCases,
    want: shop,
    shape: /^\s*if\b[^\n]*\band\b/m,
    shapeSay: 'Both have to be true: join the two questions in one `if` with `and`.',
    praise: 'A map *and* enough coins: `and` needs both, so the `if` asks both at once.',
    model: `has_map = True\ncoins = ${cost + 2}\nif has_map and coins >= ${cost}:\n    plan = "buy"\nelse:\n    plan = "leave"`,
  })

  return [p1, p2, p3, p4, p5]
}

export const ifLesson = (seed: number): Lesson => ({
  id: 'v2-if',
  teaches: ['block-indent'],
  pictureAtAsk: true,
  steps: [...teach, ...practice(seed)],
  outro: [
    { say: 'Now the robot can choose: it asks, and runs only the block the answer says.', focus: 'console' },
    { speaker: 'courier', say: 'Every fork, troll and bridge, sorted. What\'s next, robot?' },
  ],
  takeaway: 'An `if` runs its block only when its question is `True`. With `elif` and `else`, the first yes wins and the rest are skipped.',
})

export const v2if = ifLesson(pageSeed())
