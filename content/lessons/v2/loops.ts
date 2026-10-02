/**
 * v2, Level 8: Again and Again (`v2-loops`).
 *
 * The robot's problem (R12): deep in the cave there is treasure on the
 * floor — a gem, a coin, a key — and the robot picks things up one line
 * each. A hundred things would be a hundred lines. It ends able to do one
 * block for every item in a list, keep a running total, repeat a number of
 * times, choose on every pass, and repeat for as long as a question says
 * yes.
 *
 * Every loop is walked a pass at a time on a real run (`Beat.run` with a
 * `pass`): the header lit as the robot goes back to the top, the loop's
 * name moving to the next item in memory, the stage marking the item and
 * the total (R6). Then the player writes one, and the robot tries it on
 * other lists (`LessonStep.cases`), so four `append` lines typed by hand
 * do the first list and not the next.
 *
 * 1. `for thing in cave:` — the block once per item, `thing` pointing at
 *    each in turn. Written.
 * 2. A running total, started before the loop: walked; then the classic
 *    slip, `total = 0` inside the loop, predicted; then written.
 * 3. `range(n)`: `0` up to `n - 1`, like indexes. Predicted, written.
 * 4. An `if` inside a loop, asked on every pass. Written, as a count.
 * 5. `while`: repeat while a question says `True`, asked before every
 *    pass; one that never turns `False` never finishes. Predicted, written.
 *
 * Then five, from a seed (`practice`): predict a total, count with an
 * `if`, fix a broken loop, build a new list, and count the passes.
 */
import { between, pick, rng } from '../../../src/practice/exercises'
import type { Prop } from '../../../src/scene/props'
import { chose, ran, type Choices, type Lesson, type LessonStep, type Line } from '../core'
import { caseRows, codeMiss, decides, valueOf, wrongCase, type Want } from './code'

/* --------------------------------- helpers --------------------------------- */

const listText = (xs: (string | number)[]) => `[${xs.map((x) => (typeof x === 'string' ? `"${x}"` : String(x))).join(', ')}]`
const listRepr = (xs: (string | number)[]) => `[${xs.map((x) => (typeof x === 'string' ? `'${x}'` : String(x))).join(', ')}]`
const numbers = (text: string): number[] => JSON.parse(text) as number[]
const words = (text: string): string[] => JSON.parse(text) as string[]

const floor = (items: string[], mark?: number): Prop => (mark === undefined ? { kind: 'hotbar', items } : { kind: 'hotbar', items, mark })
const tally = (values: number[], mark?: number, total?: number | null, label = 'total'): Prop => ({
  kind: 'tally',
  values,
  label,
  ...(mark !== undefined ? { mark } : {}),
  ...(total !== undefined ? { total } : {}),
})

/** A step about a program that loops: judged on every case. */
function looping(opts: {
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

function predict(id: string, options: [string, string][], answer: string, nudge: (c: string) => string | undefined): Choices {
  return { id, options: options.map(([i, label]) => ({ id: i, label })), answer, nudge }
}

const FOR = /^\s*for\s+\w+\s+in\b[^\n]*:/m
const WHILE = /^\s*while\b[^\n]*:/m

/* --------------------------------- teaching --------------------------------- */

const CAVE = ['gem', 'coin', 'key']
const BY_HAND = 'bag = []\nbag.append("gem")\nbag.append("coin")\nbag.append("key")'
const PICK = 'cave = ["gem", "coin", "key"]\nbag = []\nfor thing in cave:\n    bag.append(thing)'

const COINS = [3, 5, 2]
const SUM = 'coins = [3, 5, 2]\ntotal = 0\nfor c in coins:\n    total = total + c'
const RESET = 'coins = [3, 5, 2]\nfor c in coins:\n    total = 0\n    total = total + c'
const reset = predict(
  'loops-reset',
  [
    ['2', '`2`'],
    ['10', '`10`'],
    ['0', '`0`'],
  ],
  '2',
  (c) =>
    c === '10'
      ? '`total = 0` is inside the block now, so every pass starts it again at `0`. Only the last coin is kept.'
      : 'The last pass sets `total` to `0`, then adds that pass\'s coin, `2`.',
)

const door = (n: number): Prop => ({ kind: 'hud', title: 'Door', stats: [{ name: 'knocks', value: String(n) }] })
const fire = (hp: number): Prop => ({ kind: 'hud', title: 'Campfire', stats: [{ name: 'hp', value: String(hp) }] })
/** The big gems, a pass at a time: the pointer on the gem being asked
 *  about, a tick on those kept and a cross on those skipped. */
const gemsAt = (pass: number, label = 'big'): Prop => ({
  kind: 'tally',
  item: 'gem',
  values: [7, 2, 9],
  label,
  ...(pass >= 0 && pass < 3 ? { mark: pass } : {}),
  kept: [7, 2, 9].map((g, i) => (i <= pass ? g > 4 : null)),
})
const KNOCK = 'knocks = 0\nfor i in range(3):\n    knocks = knocks + 1'
const lastI = predict(
  'loops-range',
  [
    ['4', '`4`'],
    ['5', '`5`'],
    ['0', '`0`'],
  ],
  '4',
  (c) => (c === '5' ? '`range(5)` counts from `0`: `0`, `1`, `2`, `3`, `4`. Five numbers, and the last is `4`.' : '`i` starts at `0`, but moves on every pass. The last of five, counting from `0`, is `4`.'),
)

const BIG = 'gems = [7, 2, 9]\nbig = []\nfor g in gems:\n    if g > 4:\n        big.append(g)'
const HEAL = 'hp = 70\nwhile hp < 100:\n    hp = hp + 10'
const NEVER = 'hp = 70\nwhile hp < 100:\n    hp = hp - 10'
const HEAL20 = 'hp = 40\nwhile hp < 100:\n    hp = hp + 20'
const heals = predict(
  'loops-while',
  [
    ['3', '`3` times'],
    ['4', '`4` times'],
    ['2', '`2` times'],
    ['forever', 'It never stops'],
  ],
  '3',
  (c) =>
    c === '4'
      ? 'After three passes `hp` is `100`, and `100 < 100` is `False`: the question is asked first, so no fourth pass.'
      : c === 'forever'
        ? '`hp` goes up 20 each pass, so it does reach 100, and then the question says no.'
        : '`40`, `60`, `80`: three yeses, and then `100 < 100` is `False`.',
)

const sumOf = (key: string): Want => (g) => String(numbers(g[key]!).reduce((a, b) => a + b, 0))
const over = (key: string, n: number): Want => (g) => String(numbers(g[key]!).filter((x) => x > n).length)
const healTo = (step: number): Want => (g) => {
  let hp = Number(g.hp)
  while (hp < 100) hp += step
  return String(hp)
}

const teach: LessonStep[] = [
  {
    beats: [
      { speaker: 'courier', say: 'Treasure on the cave floor! A gem, a coin and a key.', act: [{ actor: 'courier', do: 'enter' }], show: floor(CAVE) },
      { say: 'The robot could pick each one up with a line of its own…', code: BY_HAND, show: floor(CAVE) },
      { say: '…but a hundred things would need a hundred lines. A *loop* runs one block for each item.', code: BY_HAND, show: floor(CAVE) },
      { say: '`for thing in cave:` is a header with a colon and a block, like an `if`.', code: PICK, show: floor(CAVE) },
      { say: 'Here `in` isn\'t a question. It hands `thing` each item in `cave`, one per pass.', code: PICK, show: floor(CAVE) },
      { say: 'Pass 1: `thing` points at the first item, `"gem"`, and the block runs.', code: PICK, run: { line: 4, pass: 1 }, mark: ['thing'], show: floor(CAVE, 0) },
      { say: 'Pass 2: back up to the header. `thing` moves on to `"coin"`, and the block runs again.', code: PICK, run: { line: 4, pass: 2 }, mark: ['thing'], show: floor(CAVE, 1) },
      { say: 'Pass 3: `"key"`.', code: PICK, run: { line: 4, pass: 3 }, mark: ['thing'], show: floor(CAVE, 2) },
      { say: 'Nothing left, so the loop ends. Three items, three passes, one block.', code: PICK, run: 'end', mark: ['bag'], show: floor(CAVE) },
    ],
    say: 'Your turn: with a `for` loop, append every thing in `cave` to `bag`.',
    ask: 'Pick them all up',
    tag: 'you',
    code: 'cave = ["map", "gem", "key"]\nbag = []\n',
    show: { kind: 'cases', name: 'bag', rows: caseRows([{ cave: '["map", "gem", "key"]' }, { cave: '["coin"]' }], (g) => listRepr(words(g.cave!))) },
    cases: [{ cave: '["map", "gem", "key"]' }, { cave: '["coin"]' }],
    done: (e) => decides(e, FOR, 'bag', (g) => listRepr(words(g.cave!))),
    praise: 'One block, run once for each thing: the loop works for any cave, however full.',
    nudge: (l) =>
      codeMiss(l) ??
      (l.ok && !FOR.test(l.source)
        ? 'Let a loop do it: `for thing in cave:`, and in its block, `bag.append(thing)`.'
        : l.ok && /bag\.append\(\s*(["'])/.test(l.source)
          ? 'That appends the same word every time. Append the loop\'s name, `thing`: it points at each item in turn.'
          : wrongCase(l, 'bag', (g) => listRepr(words(g.cave!)))),
    model: 'cave = ["map", "gem", "key"]\nbag = []\nfor thing in cave:\n    bag.append(thing)',
  },
  {
    beats: [
      { speaker: 'courier', say: 'And a pile of coins! How much are they worth? Let\'s add them up.', show: tally(COINS, undefined, null) },
      { say: '`total` starts at `0`, before the loop.', code: SUM, run: { line: 2 }, mark: ['total'], show: tally(COINS, undefined, 0) },
      { say: 'Pass 1: `c` is `3`. `total + c` is `3`, and `total` points at that.', code: SUM, run: { line: 4, pass: 1 }, mark: ['c', 'total'], show: tally(COINS, 0, 3) },
      { say: 'Pass 2: `c` is `5`. `3 + 5` is `8`.', code: SUM, run: { line: 4, pass: 2 }, mark: ['c', 'total'], show: tally(COINS, 1, 8) },
      { say: 'Pass 3: `c` is `2`, and `total` is `10`.', code: SUM, run: { line: 4, pass: 3 }, mark: ['c', 'total'], show: tally(COINS, 2, 10) },
      { say: 'A name that grows a little on every pass is a *running total*.', code: SUM, run: 'end', mark: ['total'], show: tally(COINS, undefined, 10) },
      { say: 'Now read this one: `total = 0` has moved inside the loop.', code: RESET, show: tally(COINS, undefined, null) },
    ],
    say: 'What does `total` point at when this loop ends?',
    show: tally(COINS, undefined, null),
    ask: 'What\'s the total?',
    tag: 'you',
    choices: reset,
    done: (e) => chose(e, reset),
    praise: 'Inside the loop, `total = 0` runs every pass, so only the last coin counts. Start a total *before* the loop.',
  },
  looping({
    speaker: 'courier',
    say: 'Make `worth` the total of all the `gems`, with a loop.',
    ask: 'Add them up',
    code: 'gems = [4, 1, 6]\n',
    name: 'worth',
    cases: [{ gems: '[4, 1, 6]' }, { gems: '[10, 20]' }, { gems: '[]' }],
    want: sumOf('gems'),
    shape: FOR,
    shapeSay: 'Let a loop add them: `worth = 0` first, then `for g in gems:` with `worth = worth + g` in its block.',
    praise: 'Started at `0` before the loop, and added to on every pass. Even no gems at all comes out right: `0`.',
    model: 'gems = [4, 1, 6]\nworth = 0\nfor g in gems:\n    worth = worth + g',
  }),
  {
    beats: [
      { speaker: 'courier', say: 'A door with a sign: "Knock three times."', show: door(0) },
      { say: '`range(3)` hands a loop the numbers `0`, `1` and `2`: three, counting from `0`, like indexes.', code: KNOCK, show: door(0) },
      { say: 'Pass 1: `i` is `0`, and `knocks` goes up to `1`.', code: KNOCK, run: { line: 3, pass: 1 }, mark: ['i', 'knocks'], show: door(1) },
      { say: 'Pass 2: `i` is `1`, `knocks` is `2`.', code: KNOCK, run: { line: 3, pass: 2 }, mark: ['i', 'knocks'], show: door(2) },
      { say: 'Pass 3: `i` is `2`, `knocks` is `3`. That\'s three knocks, and the loop ends.', code: KNOCK, run: 'end', mark: ['i', 'knocks'], show: door(3) },
    ],
    say: 'In `for i in range(5):`, what does `i` point at on the last pass?',
    show: { kind: 'value', text: 'range(5)' },
    ask: 'The last i',
    tag: 'you',
    choices: lastI,
    done: (e) => chose(e, lastI),
    praise: '`range(5)` is `0` to `4`: five numbers, and the last is one less than five.',
  },
  {
    beats: [{ speaker: 'courier', say: 'Another door, and this one wants 10 knocks!', show: door(10) }],
    say: 'Make `knocks` count 10 knocks, with `range`.',
    // Not a goal memory: the loop's own name (`i`) is in memory too, and
    // the step is about `knocks` alone.
    show: { kind: 'hud', title: 'Door', stats: [{ name: 'knocks', value: '10' }] },
    ask: 'Knock 10 times',
    tag: 'you',
    code: 'knocks = 0\n',
    done: (e) => ran(e, (r) => r.ok && /^\s*for\s+\w+\s+in\s+range\s*\(/m.test(r.source) && valueOf(r.final, 'knocks') === '10'),
    praise: '`range(10)`: ten passes, and `knocks` went up by one on each.',
    nudge: (l) =>
      codeMiss(l) ??
      (l.ok && !/\brange\s*\(/.test(l.source)
        ? 'Let a loop count: `for i in range(10):`, and in its block, `knocks = knocks + 1`.'
        : l.ok && valueOf(l.memory!, 'knocks') !== '10'
          ? `\`knocks\` came out \`${valueOf(l.memory!, 'knocks')}\`. How many numbers does your \`range\` hand out?`
          : undefined),
    model: 'knocks = 0\nfor i in range(10):\n    knocks = knocks + 1',
  },
  looping({
    beats: [
      { speaker: 'courier', say: 'Only the big gems are worth carrying: more than 4.', show: gemsAt(-1) },
      { say: 'An `if` inside a loop\'s block is asked again on every pass.', code: BIG, show: gemsAt(-1) },
      { say: 'Pass 1: `g` is `7`. `7 > 4`, so it\'s appended.', code: BIG, run: { line: 5, pass: 1 }, mark: ['g', 'big'], show: gemsAt(0) },
      { say: 'Pass 2: `g` is `2`. `2 > 4` is `False`: the `if`\'s block is skipped.', code: BIG, run: { line: 4, pass: 2 }, mark: ['g', 'big'], show: gemsAt(1) },
      { say: 'Pass 3: `g` is `9`, more than 4: appended.', code: BIG, run: { line: 5, pass: 2 }, mark: ['g', 'big'], show: gemsAt(2) },
      { say: 'Three passes, two appends: `big` is `[7, 9]`.', code: BIG, run: 'end', mark: ['big'], show: gemsAt(3) },
    ],
    say: 'Make `count` count how many `gems` are more than 4.',
    ask: 'Count the big ones',
    code: 'gems = [5, 1, 8, 3]\ncount = 0\n',
    name: 'count',
    cases: [{ gems: '[5, 1, 8, 3]' }, { gems: '[9, 9, 9]' }, { gems: '[1, 2]' }],
    want: over('gems', 4),
    shape: /^\s*for\b[^\n]*:\s*\n(?:[ \t]+[^\n]*\n)*?[ \t]+if\b/m,
    shapeSay: 'Ask about each gem inside the loop: an `if g > 4:` in the `for`\'s block, pushed in.',
    praise: 'The `if` was asked on every pass, and `count` went up only on the yeses.',
    model: 'gems = [5, 1, 8, 3]\ncount = 0\nfor g in gems:\n    if g > 4:\n        count = count + 1',
  }),
  {
    beats: [
      { speaker: 'courier', say: 'That potion only got me to 70 HP. Let\'s rest by a campfire until I\'m back to 100.', show: fire(70) },
      { say: 'A `while` loop runs its block for as long as its question says `True`.', code: HEAL, show: fire(70) },
      { say: 'It asks first: is `hp` under 100? `70` is: yes, so the block runs. `hp` is `80`.', code: HEAL, run: { line: 3, pass: 1 }, mark: ['hp'], show: fire(80) },
      { say: 'Back to the question. `80 < 100`: yes again. `90`… then `100`.', code: HEAL, run: { line: 3, pass: 3 }, mark: ['hp'], show: fire(100) },
      { say: 'Is `100` under 100? No: the loop stops.', code: HEAL, run: 'end', mark: ['hp'], show: fire(100) },
      { say: 'Careful: if `hp` went *down*, the answer would never be no.', code: NEVER, show: fire(60) },
      { say: 'The robot would go round for ever. It gives up after a while, and says so.', code: NEVER, run: 'end', show: fire(60) },
      { say: 'Read this one.', code: HEAL20 },
    ],
    say: 'How many times does its block run?',
    show: { kind: 'hud', stats: [{ name: 'hp', value: '40' }] },
    ask: 'How many passes?',
    tag: 'you',
    choices: heals,
    done: (e) => chose(e, heals),
    praise: '`40`, `60`, `80`, and at `100` the question says no: three passes.',
  },
  looping({
    say: 'Rest until `hp` is at least 100, healing 15 each pass, with a `while` loop.',
    ask: 'Rest by the fire',
    code: 'hp = 55\n',
    name: 'hp',
    cases: [{ hp: '55' }, { hp: '90' }, { hp: '100' }],
    want: healTo(15),
    shape: WHILE,
    shapeSay: 'Let a `while` loop decide when to stop: `while hp < 100:`, and in its block, `hp = hp + 15`.',
    praise: 'Asked before every pass: at 100 HP or more, it stops — and at 100 to start with, it never runs at all.',
    model: 'hp = 55\nwhile hp < 100:\n    hp = hp + 15',
  }),
]

/* -------------------------------- practice -------------------------------- */

/**
 * The practice, from a seed: five, one concept each — predict a total, count
 * with an `if`, fix a broken loop, build a new list, and count the passes.
 */
export function practice(seed: number): LessonStep[] {
  const r = rng(seed)

  // 1. Predict a running total.
  const vals = [between(r, 1, 6), between(r, 1, 6), between(r, 1, 6)]
  const sum = vals.reduce((a, b) => a + b, 0)
  const TOTAL = `coins = ${listText(vals)}\ntotal = 0\nfor c in coins:\n    total = total + c`
  const wrong = [...new Set([vals[2]!, sum + vals[0]!, sum - 1, 0, sum + 1].filter((x) => x !== sum))].slice(0, 2)
  const totalC = predict(
    'practice-total',
    [String(sum), ...wrong.map(String)].map((x) => [x, `\`${x}\``] as [string, string]),
    String(sum),
    (c) => (c === String(vals[2]) ? 'That\'s only the last coin. `total` keeps what it had, and adds each coin to it.' : `Add them up, one pass each: ${vals.join(' + ')}.`),
  )
  const p1: LessonStep = {
    beats: [{ say: 'Now some loops of your own, the deepest part of the cave.' }, { say: 'Read this one.', code: TOTAL }],
    say: 'What does `total` point at when the loop ends?',
    show: tally(vals, undefined, null),
    ask: 'What\'s the total?',
    tag: 'you',
    choices: totalC,
    done: (e) => chose(e, totalC),
    praise: `One coin a pass: ${vals.join(' + ')} is \`${sum}\`.`,
  }

  // 2. Count with an if.
  const target = pick(r, ['coin', 'gem'] as const)
  const finds = ['["coin", "gem", "coin", "key"]', '["gem", "gem"]', '["key"]']
  const countOf: Want = (g) => String(words(g.finds!).filter((w) => w === target).length)
  const p2 = looping({
    speaker: 'courier',
    say: `Count how many times \`"${target}"\` is in \`finds\`, in \`n\`.`,
    ask: `How many ${target}s?`,
    code: `finds = ${finds[0]}\nn = 0\n`,
    name: 'n',
    cases: finds.map((f) => ({ finds: f })),
    want: countOf,
    shape: /^\s*for\b[^\n]*:\s*\n(?:[ \t]+[^\n]*\n)*?[ \t]+if\b/m,
    shapeSay: `Ask about each thing inside the loop: \`if thing == "${target}":\`, then count it.`,
    praise: `Every thing was asked about, and \`n\` went up only for a \`"${target}"\`.`,
    model: `finds = ${finds[0]}\nn = 0\nfor thing in finds:\n    if thing == "${target}":\n        n = n + 1`,
  })

  // 3. Fix a broken loop.
  const bug = pick(r, ['reset', 'indent', 'down'] as const)
  const p3 =
    bug === 'down'
      ? looping({
          speaker: 'courier',
          say: 'This loop should climb 10 at a time until `height` is at least 50. The robot never finishes it. Fix it!',
          ask: 'Fix the loop',
          code: 'height = 10\nwhile height < 50:\n    height = height - 10\n',
          name: 'height',
          cases: [{ height: '10' }, { height: '45' }],
          want: (g) => {
            let h = Number(g.height)
            while (h < 50) h += 10
            return String(h)
          },
          shape: WHILE,
          shapeSay: 'Keep the `while`, and make each pass bring `height` closer to 50.',
          praise: 'Each pass now climbs *up*, so the question does turn `False`, and the loop ends.',
          model: 'height = 10\nwhile height < 50:\n    height = height + 10',
        })
      : looping({
          speaker: 'courier',
          say: 'This loop should add up all the `loot` into `total`, but it gets it wrong. Fix it!',
          ask: 'Fix the loop',
          code:
            bug === 'reset'
              ? 'loot = [2, 7, 4]\nfor x in loot:\n    total = 0\n    total = total + x\n'
              : 'loot = [2, 7, 4]\ntotal = 0\nfor x in loot:\ntotal = total + x\n',
          name: 'total',
          cases: [{ loot: '[2, 7, 4]' }, { loot: '[5, 5]' }],
          want: sumOf('loot'),
          shape: FOR,
          shapeSay: 'Keep the `for` loop, and add each `x` to `total` inside it.',
          praise: bug === 'reset' ? 'The total starts *before* the loop now, so it keeps growing.' : 'The adding is inside the block now, so it happens on every pass.',
          model: 'loot = [2, 7, 4]\ntotal = 0\nfor x in loot:\n    total = total + x',
        })

  // 4. Build a new list.
  const times = pick(r, [2, 3, 10])
  const p4 = looping({
    speaker: 'courier',
    say: `A magic pool makes every coin worth ${times} times as much! Put each coin's new value into \`magic\`.`,
    ask: 'Magic coins',
    code: 'coins = [1, 4, 5]\nmagic = []\n',
    name: 'magic',
    cases: [{ coins: '[1, 4, 5]' }, { coins: '[3]' }],
    want: (g) => listRepr(numbers(g.coins!).map((c) => c * times)),
    shape: FOR,
    shapeSay: `Loop over \`coins\`, and append each one times ${times}: \`magic.append(c * ${times})\`.`,
    praise: `One pass per coin, and each pass appended its coin times ${times}: a whole new list.`,
    model: `coins = [1, 4, 5]\nmagic = []\nfor c in coins:\n    magic.append(c * ${times})`,
  })

  // 5. Count the passes.
  const which = pick(r, ['range', 'while'] as const)
  const n = between(r, 3, 7)
  const PASSES = which === 'range' ? `steps = 0\nfor i in range(${n}):\n    steps = steps + 2` : `steps = 0\nwhile steps < ${n * 2}:\n    steps = steps + 2`
  const passC = predict(
    'practice-passes',
    [
      [String(n), `\`${n}\``],
      [String(n + 1), `\`${n + 1}\``],
      [String(n * 2), `\`${n * 2}\``],
    ],
    String(n),
    (c) =>
      which === 'range'
        ? c === String(n * 2)
          ? `\`steps\` ends at ${n * 2}, but the question is passes: \`range(${n})\` hands out ${n} numbers.`
          : `\`range(${n})\` hands out ${n} numbers, \`0\` to \`${n - 1}\`: one pass each.`
        : c === String(n + 1)
          ? `The question is asked ${n + 1} times, but the last time it says no, so the block runs ${n}.`
          : `\`steps\` goes up 2 a pass: ${n} passes take it from 0 to ${n * 2}, and then the question says no.`,
  )
  const p5: LessonStep = {
    beats: [{ say: 'Last one. Read it.', code: PASSES }],
    say: 'How many times does the block run?',
    show: { kind: 'value', text: which === 'range' ? `range(${n})` : `steps < ${n * 2}` },
    ask: 'How many passes?',
    tag: 'you',
    choices: passC,
    done: (e) => chose(e, passC),
    praise: which === 'range' ? `\`range(${n})\`: ${n} numbers, ${n} passes.` : `Up 2 a pass, from 0 to ${n * 2}: ${n} passes, and then it stops.`,
  }

  return [p1, p2, p3, p4, p5]
}

function seedOfPage(): number {
  if (typeof location === 'undefined') return 1
  const given = Number(new URLSearchParams(location.search).get('seed'))
  return Number.isFinite(given) && given > 0 ? given : Math.floor(Math.random() * 1e9) + 1
}

export const loopsLesson = (seed: number): Lesson => ({
  id: 'v2-loops',
  teaches: ['loop-passes', 'accumulator', 'range'],
  pictureAtAsk: true,
  steps: [...teach, ...practice(seed)],
  outro: [
    { say: 'Now the robot can do things again and again: for each item, or while a question says yes.', focus: 'console' },
    { speaker: 'courier', say: 'Treasure counted, gems sorted, HP back to full. Best adventure ever!' },
  ],
  takeaway: 'A loop runs its block again and again: `for` once per item, and `while` for as long as its question is `True`.',
})

export const v2loops = loopsLesson(seedOfPage())
