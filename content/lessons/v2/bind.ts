/**
 * v2, Level 4: Memories (`v2-bind`).
 *
 * The robot's problem (R12): everything it has thought so far, it let go.
 * It ends able to keep things — names pointing at objects — and the player
 * ends knowing how to build any memory they are shown, which is what
 * everything after this is made of.
 *
 * Each idea is played out by the crow a step at a time in the robot's own
 * memory panel (the crow's demonstration memory, `Beat.memory`, run by
 * real Python and never evidence), with the name being read or moved lit
 * up (`Beat.mark`), then asked:
 *
 * 1. `x = 1`: an `int` object `1`, and the name `x` pointing at it.
 * 2. `x`: the robot follows the arrow and thinks of `1`.
 * 3. `x = 1 + 2`: the right side is worked out first, into a new object,
 *    and only then is `x` moved to it; the old `1`, nameless, is let go.
 *    Asked as a prediction (multiple choice).
 * 4. `x = y + 2`: follow `y`, work out a new `3`, point `x` at it; `y`
 *    does not move. Asked as a typed instruction.
 * 5. `count = count + 1`: a name worked out from itself, which is how the
 *    robot counts. Predicted, then typed.
 *
 * Then the main exercise: the crow shows a goal memory on the stage, and
 * the player instructs the robot until its memory is exactly that
 * (`memory/goal`: every name, its value and type, and no names besides).
 * The robot's memory is wiped for them as the goals begin. Each goal
 * changes the last one — a name added, a value moved, a float doubled —
 * and the last starts from scratch, so it needs the memory wiped (`wipe`),
 * which the player may do at any time. A mistake is easy to go back on:
 * Undo takes the last line back, and a reply to a line says which row is
 * off, from the memory that line left, and how to get back.
 */
import { between, pick, rng } from '../../../src/practice/exercises'
import { compare, type Goal } from '../../../src/memory/goal'
import type { Prop } from '../../../src/scene/props'
import {
  chose,
  errorType,
  ever,
  everBy,
  heard,
  points,
  reached,
  stopped,
  type Choices,
  type Lesson,
  type LessonStep,
  type Line,
} from '../core'

/* --------------------------------- replies --------------------------------- */

/** A name the robot has no memory of. */
function unknownName(l: Line): string | undefined {
  if (errorType(l) !== 'NameError') return undefined
  const name = /name '(\w+)'/.exec(l.error ?? '')?.[1]
  return name ? `The robot has no memory called \`${name}\` yet.` : 'That uses a name the robot has no memory of yet.'
}

/** What a line left memory looking like, against a goal: the first thing off. */
function goalMiss(goal: Goal) {
  return (l: Line): string | undefined => {
    const why = unknownName(l)
    if (why) return why
    if (!l.ok) return stopped(l, 'Check the line against the goal.')
    if (!l.memory) return undefined
    const { rows, extra } = compare(goal, l.memory)
    // A name this very line made, that the goal does not have: most likely
    // a typo, and the thing to put right first.
    const made = /^\s*([A-Za-z_]\w*)\s*=(?!=)/.exec(l.source)?.[1]
    if (made && extra.includes(made)) return `\`${made}\` isn't in the goal. Undo that line, and try again.`
    const off = rows.find((r) => !r.ok)
    if (off && off.have !== null) return `\`${off.name}\` points at \`${off.have}\` now. The goal has it at \`${off.value}\`.`
    // Extra names this line did not make came from earlier lines: Undo
    // would take back the one right line, so the way back is a wipe.
    if (extra.length) return `\`${extra[0]}\` isn't in the goal. Wipe the memory, then build just what the goal shows.`
    if (off) return `Nearly: \`${off.name}\` is still missing.`
    return undefined
  }
}

const bare = (source: string | undefined) => (source ?? '').trim()

/* --------------------------------- teaching --------------------------------- */

const afterSum: Choices = {
  id: 'bind-sum',
  options: [
    { id: '10', label: '`10`' },
    { id: 'sum', label: '`2 * 5`' },
    { id: '2', label: '`2`' },
    { id: '5', label: '`5`' },
  ],
  answer: '10',
  nudge: (c) =>
    c === 'sum'
      ? 'The robot never keeps a sum. It works it out first, and points `x` at the answer.'
      : 'The right side is worked out first: `2 * 5` is `10`, and `x` points at that.',
}

const counted: Choices = {
  id: 'bind-count',
  options: [
    { id: '7', label: '`7`' },
    { id: '6', label: '`6`' },
    { id: '5', label: '`5`' },
    { id: 'sum', label: '`n + 1`' },
  ],
  answer: '7',
  nudge: (c) =>
    c === 'sum'
      ? 'The sum is worked out each time: `n` moves to the answer, never to the sum.'
      : 'Each line moves `n` on by one: `5`, then `6`, then `7`.',
}

const teach: LessonStep[] = [
  {
    beats: [
      { say: 'Every thought so far, the robot let go. Now you\'ll give it *memories*.', focus: 'memory', act: [{ actor: 'crow', do: 'hop' }] },
      { say: 'Its memory lives down here. It\'s empty.', focus: 'memory', memory: [] },
      { say: 'A memory is a *name*, an `=`, and a value. Watch.', types: 'x = 1', memory: ['x = 1'] },
      { say: 'The robot makes an `int` object, `1`, and points the name `x` at it.', memory: ['x = 1'], mark: ['x'] },
      { say: 'That arrow is the memory. The name is how the robot finds the object again.', memory: ['x = 1'], mark: ['x'] },
      { say: 'Ask for `x`, and it follows the arrow and thinks of `1`.', types: 'x', thought: '1', memory: ['x = 1'], mark: ['x'] },
    ],
    say: 'Your turn. Give the robot a memory: point `x` at `1`.',
    tag: 'you',
    done: (e) => ever(e, (s) => points(s, 'x', '1')),
    praise: '`x` points at `1`. The line is over, and the robot still remembers.',
    nudge: (l) => (l.ok && /^\s*1\s*$/.test(l.source) ? 'That\'s a thought, let go at once. Give it a name: `x = 1`.' : unknownName(l) ?? stopped(l, 'A name, `=`, then the value: `x = 1`.')),
    model: 'x = 1',
  },
  {
    say: 'Now ask the robot for `x`.',
    tag: 'you',
    done: (e) => heard(e, (t) => t.repr === '1' && bare(t.source) === 'x'),
    praise: 'It followed the arrow from `x` and thought of `1`. The memory is still there.',
    nudge: (l) => (l.thought?.repr === '1' ? 'That\'s `1` typed out. Ask for it by its name: `x`.' : unknownName(l)),
    model: 'x',
  },
  {
    beats: [
      { say: 'A memory can be worked out first.', memory: ['x = 1'], mark: ['x'] },
      { say: 'In `x = 1 + 2`, the robot works out the right side before anything moves…', types: 'x = 1 + 2', memory: ['x = 1'] },
      { say: '…`1 + 2` is a new object, `3`…', thought: '3', memory: ['x = 1'] },
      { say: '…and only then does it move `x` to the `3`.', memory: ['x = 1', 'x = 1 + 2'], mark: ['x'] },
      { say: 'Nothing points at the old `1` now, so the robot lets it go.', memory: ['x = 1', 'x = 1 + 2'] },
    ],
    say: 'After `x = 2 * 5`, what does `x` point at?',
    show: { kind: 'value', text: 'x = 2 * 5' },
    ask: 'What does x point at?',
    tag: 'you',
    choices: afterSum,
    done: (e) => chose(e, afterSum),
    praise: 'The right side first: `2 * 5` is `10`, so that line points `x` at the `10`.',
  },
  {
    beats: [
      { say: 'A sum can use a memory too.', types: 'y = 1', memory: ['y = 1'] },
      { say: 'For `x = y + 2`, the robot first follows `y` to its object, `1`…', types: 'x = y + 2', memory: ['y = 1'], mark: ['y'] },
      { say: '…works out `1 + 2`, a new object `3`…', thought: '3', memory: ['y = 1'] },
      { say: '…and points `x` at it.', memory: ['y = 1', 'x = y + 2'], mark: ['x'] },
      { say: '`y` still points at `1`. Reading a name never moves it.', memory: ['y = 1', 'x = y + 2'], mark: ['y'] },
    ],
    say: 'Point `a` at `4`. Then let the robot work out `b` from it: `b = a + 1`.',
    tag: 'you',
    done: (e) => everBy(e, (src, s) => /^\s*b\s*=.*\ba\b/m.test(src) && points(s, 'a', '4') && points(s, 'b', '5')),
    praise: 'The robot followed `a` to `4`, worked out `5`, and pointed `b` at it. `a` didn\'t move.',
    nudge: (l) =>
      /^\s*b\s*=\s*5\s*$/.test(l.source)
        ? 'That\'s the answer typed in. Let the robot work it out from `a`: `b = a + 1`.'
        : unknownName(l) ?? stopped(l, 'Two lines: `a = 4`, then `b = a + 1`.'),
    model: 'a = 4\nb = a + 1',
  },
  {
    beats: [
      { say: 'A name can even be worked out from itself. Here\'s `count`.', types: 'count = 0', memory: ['count = 0'] },
      { say: '`count = count + 1`: follow `count` to `0`…', types: 'count = count + 1', memory: ['count = 0'], mark: ['count'] },
      { say: '…work out `0 + 1`, a new `1`…', thought: '1', memory: ['count = 0'] },
      { say: '…and move `count` to it.', memory: ['count = 0', 'count = count + 1'], mark: ['count'] },
      { say: 'Again, and it\'s `2`. That\'s how the robot counts.', types: 'count = count + 1', memory: ['count = 0', 'count = count + 1', 'count = count + 1'], mark: ['count'] },
    ],
    say: '`n = 5`, then `n = n + 1`, then `n = n + 1` again. Where does `n` point?',
    show: { kind: 'code', text: 'n = 5\nn = n + 1\nn = n + 1' },
    ask: 'Where does n point?',
    tag: 'you',
    choices: counted,
    done: (e) => chose(e, counted),
    praise: 'One up each time: `5`, `6`, `7`.',
  },
  {
    say: 'Make the robot count: point `score` at `0`, then move it on by one, three times.',
    tag: 'you',
    done: (e) => everBy(e, (src, s) => /^\s*score\s*=\s*score\s*\+\s*1\s*$/m.test(src) && points(s, 'score', '3')),
    praise: '`0`, `1`, `2`, `3`: `score` moved on one each time.',
    nudge: (l) =>
      /^\s*score\s*=\s*\d+\s*$/.test(l.source) && !/^\s*score\s*=\s*0\s*$/.test(l.source)
        ? 'Count up from `0`, one at a time: `score = score + 1`.'
        : unknownName(l),
    model: 'score = 0\nscore = score + 1\nscore = score + 1\nscore = score + 1',
  },
]

/* --------------------------------- the goals --------------------------------- */

const goalPicture = (goal: Goal, title = 'Goal'): Prop => ({ kind: 'goal', goal, title })

/** A line of literal assignments that builds this goal from nothing. */
const build = (goal: Goal) => goal.map((g) => `${g.name} = ${g.value}`).join('\n')

function goalStep(goal: Goal, say: string, praise: string, beats: LessonStep['beats'] = [], model = build(goal)): LessonStep {
  return {
    beats,
    say,
    show: goalPicture(goal),
    ask: 'Make memory match.',
    tag: 'you',
    done: (e) => reached(e, goal),
    praise,
    nudge: goalMiss(goal),
    model,
  }
}

/**
 * The goals, from a seed: each one a change to the last, so the player
 * keeps editing one memory — add a name, move one, add a float, double it
 * — and the last a new memory from scratch, which needs a wipe.
 */
export function goals(seed: number): LessonStep[] {
  const r = rng(seed)
  const n = between(r, 3, 9)
  const name = pick(r, ['Bolt', 'Sprocket', 'Pip', 'Dot'])
  const speed = pick(r, [1.5, 2.5, 3.5])
  const doubled = String(speed * 2).includes('.') ? String(speed * 2) : `${speed * 2}.0`
  const total = between(r, 10, 20)
  const g1: Goal = [{ name: 'x', value: String(n) }]
  const g2: Goal = [...g1, { name: 'name', value: `"${name}"` }]
  const g3: Goal = [{ name: 'x', value: String(n + 1) }, g2[1]!]
  const g4: Goal = [...g3, { name: 'speed', value: String(speed) }]
  const g5: Goal = [g4[0]!, g4[1]!, { name: 'speed', value: doubled }]
  const g6: Goal = [{ name: 'total', value: String(total) }]
  return [
    {
      ...goalStep(g1, 'Make the robot\'s memory look like the goal.', `That's it: \`x\` points at \`${n}\`.`, [
        { say: 'Now you\'re the one making memories. I\'ll show you one, and you build it.', show: goalPicture(g1) },
        // The wipe happens here, on the line that says so, not during the
        // praise of the counting step, which is about the learner's `score`.
        { say: 'I\'ve wiped the robot\'s memory, so you start clean.', show: goalPicture(g1), focus: 'memory', wipe: true },
        { say: 'Make it look exactly like the goal: the same names, the same values.', show: goalPicture(g1) },
        { say: 'A line went wrong? Undo takes it back. Wipe starts the whole memory again.', show: goalPicture(g1), focus: 'memory-tools' },
      ]),
    },
    goalStep(g2, 'I\'ve added to the goal. Make the robot\'s memory match again.', `\`name\` points at the words \`"${name}"\`.`),
    goalStep(g3, '`x` has moved on by one. Move the robot\'s `x` to match.', `\`x\` moved to \`${n + 1}\`, and \`name\` stayed put.`, [], 'x = x + 1'),
    goalStep(g4, 'Give the robot a `speed`.', `\`speed\` points at a \`float\`, \`${speed}\`.`, [], `speed = ${speed}`),
    // Worked out, as the ask says, and as Step 4 refuses a typed `b = 5`:
    // the goal alone would take `speed = 5.0` typed in.
    {
      ...goalStep(g5, 'The robot\'s speed has doubled. Let it work out the new one.', `\`speed * 2\` is \`${doubled}\`: still a \`float\`.`, [], 'speed = speed * 2'),
      done: (e) => everBy(e, (src, s) => /^\s*speed\s*=.*\bspeed\b.*\*/m.test(src) && compare(g5, s).met),
      nudge: (l) =>
        /^\s*speed\s*=\s*[\d.]+\s*$/.test(l.source)
          ? 'That\'s the answer typed in. Let the robot double it: `speed = speed * 2`.'
          : l.ok && /^\s*speed\s*=/.test(l.source) && !/\*/.test(l.source)
            ? 'Doubled is times two: `speed = speed * 2`.'
            : goalMiss(g5)(l),
    },
    goalStep(g6, 'A new memory: only `total`, pointing at `' + total + '`. Nothing else.', 'A fresh memory, just as the goal shows.', [], `total = ${total}`),
  ]
}

function seedOfPage(): number {
  if (typeof location === 'undefined') return 1
  const given = Number(new URLSearchParams(location.search).get('seed'))
  return Number.isFinite(given) && given > 0 ? given : Math.floor(Math.random() * 1e9) + 1
}

export const bindLesson = (seed: number): Lesson => ({
  id: 'v2-bind',
  teaches: ['bind', 'rebind', 'recall'],
  pictureAtAsk: true,
  wipe: true,
  steps: [...teach, ...goals(seed)],
  outro: [
    { say: 'Names pointing at objects. That\'s what the robot\'s memories are.', focus: 'memory' },
    { say: 'And you can build any memory you\'re shown. Everything next is made of these.' },
  ],
  takeaway: 'A name points at an object. The robot works out the right side of `=` first, then points the name at the result.',
})

export const v2bind = bindLesson(seedOfPage())
