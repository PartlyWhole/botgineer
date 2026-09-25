import type { MemorySnapshot } from '../../src/memory/model'
import { openerOf } from '../collection/story'
import { errorType, ever, heard, points, targetOf, type Evidence, type Heard, type Lesson, type Line } from './core'

/**
 * Stage 7, the ideas: nested loops, told in beats.
 *
 * This level used to be the collection's Stage 7 prose, shown whole. The
 * markdown is still the source of truth; this lesson takes its ideas, not
 * its text, and keeps what Stage 7 adds:
 *
 * 1. the inner loop runs all the way through, and starts over, on every
 *    pass of the outer one (the robot prints, so the order is visible);
 * 2. a line runs once per pass of every loop it sits in: multiply,
 *    predicted before it is run;
 * 3. `break` leaves only the loop it is directly inside, predicted too;
 * 4. a grid's rows need a fresh `[]` on every outer pass, against the
 *    shared-row bug, where one list is appended twice.
 *
 * Every block is two lines at most, so it can be typed at the console
 * (a header, then one line four spaces in, then an empty line). What a
 * block leaves in memory is the evidence: the loop variables where they
 * finished, a count, and a grid whose slots point at one card or two.
 * The printout shows the order, but it is never evidence.
 */

const listOf = (s: MemorySnapshot, name: string) => {
  const id = targetOf(s, name)
  const o = id === null ? undefined : s.objects[id]
  return o?.type === 'list' ? o : null
}

const empty = (s: MemorySnapshot, name: string) => listOf(s, name)?.elements?.length === 0

/** `grid` holds two rows, each a list; `shared` says whether they are one. */
const rows = (s: MemorySnapshot, shared: boolean): boolean => {
  const els = listOf(s, 'grid')?.elements
  if (!els || els.length !== 2) return false
  if (!els.every((el) => s.objects[el.target]?.type === 'list')) return false
  const [a, b] = els.map((el) => el.target)
  if (shared) return a === b && a === targetOf(s, 'row')
  return a !== b && a !== targetOf(s, 'row') && b !== targetOf(s, 'row')
}

/** A number typed as a prediction: the literal alone, nothing worked out. */
const typedInt = (repr: string) => (t: Heard) => t.type === 'int' && t.repr === repr && (t.source ?? '').trim() === repr

/** A thought passing `then`, thought after the first one passing `first`. */
const after = (e: Evidence, first: (t: Heard) => boolean, then: (t: Heard) => boolean): boolean => {
  const i = e.thoughts.findIndex(first)
  return i >= 0 && e.thoughts.slice(i + 1).some(then)
}

/** The two ways a nested block goes wrong at the console. */
const blockMiss = (l: Line): string | undefined => {
  const kind = errorType(l)
  if (kind === 'IndentationError') return 'The inner line needs four spaces in front, so it sits inside the outer loop.'
  if (kind === 'SyntaxError' && /:\s*for\b/.test(l.source))
    return 'A second `for` cannot follow a colon on the same line: start a new line, four spaces in.'
  return undefined
}

/**
 * A prediction that got the robot to do the working: a name asked for,
 * or this step's own block run. Deliberately narrow: a reply is also
 * asked about the line that finished the step before (a memory step moves
 * the lesson without a thought), so it must not match that line.
 */
const ranIt = (l: Line, block: RegExp) => (l.thought !== null && /[A-Za-z_]/.test(l.source)) || block.test(l.source)

export const s7Ideas: Lesson = {
  id: 's7-ideas',
  teaches: [],
  steps: [
    {
      beats: [
        { say: openerOf(7) },
        { say: 'Her program has a loop inside a loop, and that is where guessing starts.' },
        { say: 'So first, let the robot print as it goes, and watch the order.' },
        { say: 'Start a line with four spaces to put it inside a loop, and end the block with an empty line.', focus: 'console' },
      ],
      say: 'Type `for r in range(2):`, then `for c in range(2): print(r, c)` below it, four spaces in.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'r', '1') && points(s, 'c', '1')),
      praise: 'The inner loop took `c` through `0` and `1` before `r` moved on to `1`.',
      nudge: blockMiss,
    },
    {
      beats: [
        { say: 'Read the printout: `c` went 0, 1, and then 0, 1 again.', focus: 'console' },
        { say: 'The inner loop starts over from the beginning on every pass of the outer one.' },
        { say: 'Below, each loop variable stayed where it finished: `r` and `c` are both bound to `1`.', focus: 'memory' },
        { say: 'Now a counter, `n`, to see how many times an inner line runs.' },
      ],
      say: 'Type `n = 0`.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'n', '0')),
      praise: '`n` is bound to `0`, ready to go up.',
    },
    {
      beats: [
        { say: 'Inside `for r in range(3):` goes `for c in range(2): n = n + 1`, four spaces in.' },
        { say: 'The inner line runs once per inner pass, and the inner loop runs once per outer pass.' },
      ],
      say: 'Before it runs: what will `n` be bound to? Type just the number.',
      tag: 'you',
      done: (e) => heard(e, typedInt('6')),
      praise: 'Six: 3 outer passes, and 2 inner passes on each, because the inner loop starts over.',
      nudge: (l) => {
        if (ranIt(l, /\bn\s*=\s*n\b/)) return 'Predict it first: type just the number you expect.'
        if (l.thought?.type !== 'int') return undefined
        if (l.thought.repr === '5') return 'Multiply, don\'t add: the inner line runs twice on each outer pass.'
        if (l.thought.repr === '3' || l.thought.repr === '2')
          return 'That counts one loop: the inner loop runs again on every outer pass.'
        return undefined
      },
    },
    {
      beats: [{ say: 'Now let the robot check your prediction.' }],
      say: 'Type `for r in range(3):`, then `for c in range(2): n = n + 1` below it, four spaces in.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'n', '6')),
      praise: '`n` is bound to `6`, as you said: multiply the passes of every loop a line is in.',
      nudge: blockMiss,
    },
    {
      beats: [
        { say: 'Now Mira’s bug: a search that should stop once the parcel is found.' },
        { say: '`break` stops a loop straight away, and the line after the loop runs next.' },
        { say: 'Say the parcel is at the first spot, so the inner loop, `for spot in range(2): break`, stops at once.' },
        { say: 'The outer loop is `for shelf in range(3):`, with that inner loop inside it.' },
      ],
      say: 'When it has run, which number will `shelf` be bound to? Type just the number.',
      tag: 'you',
      done: (e) => after(e, typedInt('6'), typedInt('2')),
      praise: 'Two: `break` left only the inner loop, so the outer one went on to its last shelf.',
      nudge: (l) => {
        if (ranIt(l, /\bshelf\b|\bbreak\b/)) return 'Predict it first: type just the number you expect.'
        if (l.thought?.type !== 'int') return undefined
        if (l.thought.repr === '0') return 'That would be so if `break` left both loops: which one is it directly inside?'
        if (l.thought.repr === '3') return '`range(3)` stops before `3`: which is the last shelf it hands out?'
        return undefined
      },
    },
    {
      beats: [{ say: 'Now let the robot run the search.' }],
      say: 'Type `for shelf in range(3):`, then `for spot in range(2): break` below it, four spaces in.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'shelf', '2') && points(s, 'spot', '0')),
      praise: '`shelf` got to `2` while `spot` never passed `0`: the robot searched every shelf.',
      nudge: blockMiss,
    },
    {
      beats: [
        { say: 'Look below: `shelf` is bound to `2`, so the outer loop never stopped.', focus: 'memory' },
        { say: 'That is Mira’s bug: `break` leaves only the loop it is directly inside.' },
        { say: 'To stop both, the outer loop needs a `break` of its own as well.' },
        { say: 'Last, nested data: a grid is a list of rows, and each row is a list.' },
      ],
      say: 'Type `grid = []`, then `row = []`, to make two empty lists.',
      tag: 'you',
      done: (e) => ever(e, (s) => empty(s, 'grid') && empty(s, 'row') && targetOf(s, 'grid') !== targetOf(s, 'row')),
      praise: 'Two lists, two cards, and nothing in either yet.',
    },
    {
      beats: [{ say: 'This loop puts `row` into `grid` on each of its two passes.' }],
      say: 'Type `for r in range(2): grid.append(row)`, and look below.',
      tag: 'you',
      done: (e) => ever(e, (s) => rows(s, true)),
      praise: 'Both slots of `grid` point at one list, because `row = []` ran once, before the loop.',
      nudge: (l) => (/append\(\s*\[/.test(l.source) ? 'Append the list you already made: `grid.append(row)`.' : undefined),
    },
    {
      beats: [
        { say: 'One card, two arrows: change one row, and both rows change.', focus: 'memory' },
        { say: 'A row of its own needs a fresh `[]` on every pass, inside the loop.' },
      ],
      say: 'Start again with `grid = []`, then run `for r in range(2): grid.append([])` and look below.',
      tag: 'you',
      done: (e) => ever(e, (s) => rows(s, false)),
      praise: 'Two rows, two cards: the `[]` was inside the loop, so every pass made a new list.',
    },
  ],
  outro: [
    { say: 'A line ran once per pass of every loop it sits in, and the inner loop started over each time.' },
    { say: '`break` left one loop only, and a row of its own needed its `[]` inside the loop.' },
    { say: 'The exercises are next: read the indentation, count the passes, then let the robot run it.' },
  ],
  takeaway: 'The inner loop runs all the way through on every outer pass, so multiply the passes to count a line.',
}
