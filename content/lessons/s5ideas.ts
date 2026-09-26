import { openerOf } from '../collection/story'
import { errorType, ever, everBy, heard, points, targetOf, type Evidence, type Heard, type Lesson, type Line } from './core'
import type { Prop } from '../../src/scene/props'
import type { MemorySnapshot } from '../../src/memory/model'

/**
 * Stage 5, the ideas: following one block, told in beats.
 *
 * This level used to be the collection's Stage 5 prose, shown whole. The
 * markdown is still the source of truth; this lesson takes its ideas, not
 * its text, and keeps what Stage 5 adds:
 *
 * 1. a `for` line points its name at each item in turn and runs the lines
 *    indented under it, once per item — indentation is the block;
 * 2. an accumulator starts before the loop, because the first pass reads
 *    it — predicted, then run; then Mira's bug, `total = 0` inside the
 *    body, predicted and run too, so the story's payoff is seen;
 * 3. the `for` line runs once more than the body, to find nothing left,
 *    and its name is left behind pointing at the last item;
 * 4. moving the loop name inside the body leaves the list alone —
 *    predicted, then run;
 * 5. `range(a, b, step)`, which the robot works out as a list and lets go,
 *    so memory keeps only the parcels, the total and the loop name;
 * 6. `break` (and, in a beat, `continue`);
 * 7. changing a list while walking it skips items — predicted, then run.
 *
 * The console takes a block the way a terminal does: the header's colon
 * opens a continuation and a blank line closes it (src/repl/program.ts).
 * Memory after a block is memory after the whole loop, so every "run it"
 * step is judged on what the loop left: the total, and the loop name still
 * pointing at the item it stopped on. So that a single pass can be seen
 * too, the two "let the robot check you" loops print on every pass; the
 * printout is never evidence, and a loop typed without it still counts.
 *
 * A prediction is about a block that has not run, so the block is on the
 * stage (a `code` picture) from the beat that introduces it to the ask:
 * the indentation is the idea, and a sentence about code cannot show it.
 */

/** The blocks this lesson reads, drawn as written. */
const LOOP: Prop = { kind: 'code', text: 'for p in parcels:\n    total = total + p' }
const CHECK: Prop = { kind: 'code', text: 'for p in parcels:\n    total = total + p\n    print(p, total)' }
const BUG: Prop = { kind: 'code', text: 'for p in parcels:\n    total = 0\n    total = total + p' }
const TIDY: Prop = { kind: 'code', text: 'for p in parcels:\n    parcels.remove(p)' }
const TIDY_CHECK: Prop = { kind: 'code', text: 'for p in parcels:\n    parcels.remove(p)\n    print(p, parcels)' }

/** This name points at a list whose slots point at these, read slot by
 *  slot — memory's own repr of a list is only its size ("3 items"). */
const listIs = (s: MemorySnapshot, name: string, repr: string): boolean => {
  const id = targetOf(s, name)
  const list = id === null ? undefined : s.objects[id]
  if (list?.type !== 'list' || !list.elements) return false
  return `[${list.elements.map((el) => s.objects[el.target]?.repr ?? '?').join(', ')}]` === repr
}

/** A typed prediction: a bare literal, never a line that did the work. */
const said = (e: Evidence, type: string, repr: string): boolean =>
  heard(e, (t) => t.type === type && t.repr === repr && /^[\d\s[\],-]+$/.test((t.source ?? '').trim()))

/** A thought passing `then`, thought after the first one passing `first`:
 *  a second prediction is not answered by a guess made at the first. */
const after = (e: Evidence, first: (t: Heard) => boolean, then: (t: Heard) => boolean): boolean => {
  const i = e.thoughts.findIndex(first)
  return i >= 0 && e.thoughts.slice(i + 1).some(then)
}

/** A typed number and nothing else. */
const typedInt = (repr: string) => (t: Heard) => t.type === 'int' && t.repr === repr && (t.source ?? '').trim() === repr

/** The robot did the working — a sum, a name, a loop — instead of a
 *  prediction: an accepted line that is more than a number typed out. */
const ranInstead = (l: Line) => l.ok && (/[A-Za-z=+*/%]/.test(l.source) || /\d\s*-\s*\d/.test(l.source))

/** A block whose body was not indented, or a stray indent. */
const indentMiss = (l: Line): string | undefined =>
  errorType(l) === 'IndentationError'
    ? 'The body needs spaces in front of it, so Python knows it is inside the loop.'
    : undefined

export const s5Ideas: Lesson = {
  id: 's5-ideas',
  teaches: [],
  steps: [
    {
      beats: [
        { say: openerOf(5) },
        { say: 'Until now every line ran once, but a loop runs some lines again: once per item, and each time is a pass.' },
        { say: 'Start with Mira’s parcels: one number for each day.', focus: 'console' },
      ],
      say: 'Type `parcels = [5, 7, 4]`.',
      tag: 'you',
      done: (e) => ever(e, (s) => listIs(s, 'parcels', '[5, 7, 4]')),
      praise: 'One list, and each of its slots points at a number.',
      nudge: (l) =>
        l.ok && /^\s*parcels\s*=\s*\(?\s*\d+\s*,/.test(l.source) ? 'Square brackets make a list: `parcels = [5, 7, 4]`.' : undefined,
    },
    {
      beats: [
        { say: 'To add them up, the robot needs a running total that starts at nothing.' },
        { say: 'It must exist before the loop, because the loop’s first pass reads it.' },
      ],
      say: 'Type `total = 0`.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'total', '0') && listIs(s, 'parcels', '[5, 7, 4]')),
      praise: '`total` points at `0`, ready before any loop starts.',
    },
    {
      beats: [
        { say: 'Here is the loop: read it before you run it.', show: LOOP },
        { say: 'The `for` line points `p` at the next parcel, then runs the indented line once.', show: LOOP },
        { say: 'The indented lines are the loop’s body: the colon starts it, the indent shows what is in it.', show: LOOP },
        { say: 'Memory holds what it starts from: the parcels, and `total` at `0`.', focus: 'memory', show: LOOP },
      ],
      say: 'After the loop, what will `total` point at? Type just the number.',
      show: LOOP,
      tag: 'you',
      done: (e) => said(e, 'int', '16'),
      praise: 'Sixteen: each pass adds one parcel to whatever the pass before it left.',
      nudge: (l) => {
        if (ranInstead(l)) return 'Predict it first: type just the number you expect.'
        if (l.thought?.repr === '4') return 'That is only the last parcel. Each pass adds to what `total` already holds.'
        if (l.thought?.type === 'int') return 'Walk it: `0 + 5`, then add `7`, then add `4`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Now let the robot check you.' },
        { say: 'The console keeps collecting a block until you give it a blank line.' },
        { say: 'Put spaces in front of the body line: that indent is what puts it inside the loop.', focus: 'console', show: CHECK },
        { say: 'This time the body prints too, so you can watch every pass add its parcel.', show: CHECK },
      ],
      say: 'Type `for p in parcels:`, then `total = total + p` and `print(p, total)` indented, then a blank line.',
      show: CHECK,
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'total', '16') && points(s, 'p', '4')),
      praise: '`total` is at `16`, as you said, because every pass added one parcel to it.',
      nudge: (l) => {
        const indent = indentMiss(l)
        if (indent) return indent
        if (/^\s*for\b/.test(l.source) && !/total/.test(l.source)) return 'Give the loop its body: `total = total + p`, indented.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Read the printout: each pass added one parcel to what the pass before it left.', focus: 'console' },
        { say: 'Mira’s loop was different: her `total = 0` sat inside the body, under the `for`.', show: BUG },
        { say: 'Read it the way the robot will: every pass runs both indented lines, in order.', show: BUG },
      ],
      say: 'After Mira’s loop, what will `total` point at? Type just the number.',
      show: BUG,
      tag: 'you',
      done: (e) => after(e, typedInt('16'), typedInt('4')),
      praise: 'Four: every pass set `total` back to `0`, so only the last parcel was left in it.',
      nudge: (l) => {
        if (ranInstead(l)) return 'Predict it first: type just the number you expect.'
        if (l.thought?.repr === '16') return 'Look again: every pass sets `total` back to `0` before it adds.'
        if (l.thought?.type === 'int') return 'Walk the last pass: `total = 0`, then add that pass’s parcel, `4`.'
        return undefined
      },
    },
    {
      beats: [{ say: 'Now let the robot run Mira’s loop.', show: BUG }],
      say: 'Type `for p in parcels:`, then `total = 0` and `total = total + p`, both indented, then a blank line.',
      show: BUG,
      tag: 'you',
      // Her loop, with the reset inside the body: `total = 4` typed bare
      // leaves the same memory and shows no bug.
      done: (e) =>
        everBy(e, (src, s) => /^\s*for\b/m.test(src) && /^[ \t]+total\s*=\s*0\s*$/m.test(src) && points(s, 'total', '4')),
      praise: 'Four: `total = 0` inside the body started the total again on every pass.',
      nudge: (l) => {
        const indent = indentMiss(l)
        if (indent) return indent
        if (l.ok && /^\s*total\s*=\s*\d+\s*$/.test(l.source)) return 'Let the loop do it: type Mira’s loop, with `total = 0` inside the body.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Look below: `p` is still there after the loop.', focus: 'memory' },
        { say: 'It points at the last parcel, `4`: a loop leaves its name behind.' },
        { say: 'The `for` line ran four times: three to fetch `5`, `7` and `4`, and one to find nothing left.' },
      ],
      say: 'How many times would the `for` line run for the list `[1, 2]`? Type just the number.',
      tag: 'you',
      done: (e) => said(e, 'int', '3'),
      praise: 'Three: once for each item, and once more to find the list is finished.',
      nudge: (l) => {
        if (ranInstead(l)) return 'You answer this one: type just the number.'
        if (l.thought?.repr === '2') return 'That is how often the body runs. The `for` line also looks once more and finds nothing.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Now a body that moves `p` itself: `p = p * 2`.' },
        { say: 'Each pass points `p` at a parcel, then points `p` at double it.' },
        { say: 'Watch the list while it runs.', focus: 'memory' },
      ],
      say: 'Type `for p in parcels:`, then `p = p * 2` indented under it, then a blank line.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'p', '8') && listIs(s, 'parcels', '[5, 7, 4]')),
      praise: 'The list still holds `5`, `7` and `4`, because moving `p` never writes into its slots.',
      nudge: (l) => indentMiss(l),
    },
    {
      beats: [
        { say: 'Only `p` moved: it ends at `8`, and the list was never touched.', focus: 'memory' },
        { say: 'To change the slots themselves, you would write into them by position: `parcels[0] = 10`.' },
        { say: 'Loops often count instead: `range(3)` gives `0`, `1`, `2`, starting at zero and stopping before `3`.' },
        { say: '`range(0, 9, 3)` starts at `0`, counts by `3`, and stops before `9`.' },
        { say: '`list(...)` turns those numbers into a list the robot can show you.' },
        { say: 'Let the robot do the counting: it thinks of the list, then lets it go.' },
      ],
      say: 'Ask the robot: `list(range(0, 9, 3))`.',
      tag: 'robot',
      done: (e) => heard(e, (t) => t.type === 'list' && t.repr === '[0, 3, 6]' && /range\s*\(/.test(t.source ?? '')),
      praise: '`[0, 3, 6]`, and no `9`, because a range stops just before its end.',
      nudge: (l) => {
        if (l.thought?.type === 'range') return 'A range keeps its numbers to itself: wrap it in `list(...)` to see them.'
        return l.thought !== null && !/range/.test(l.source) ? 'Let `range` do the counting: `list(range(0, 9, 3))`.' : undefined
      },
    },
    {
      beats: [
        { say: 'Sometimes a loop should stop early: `break` ends it at once, with items still left.' },
      ],
      say: 'Type `for p in parcels:`, then `break` indented under it, then a blank line.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'p', '5')),
      praise: '`p` stopped at `5`, the first parcel, because `break` ended the loop on its first pass.',
      nudge: (l) => indentMiss(l),
    },
    {
      beats: [
        { say: '`continue` is milder: it skips the rest of the body for this pass, then goes on to the next item.' },
        { say: 'Last, Mira’s tidy-up: `parcels.remove(p)` takes that item out of the list.', show: TIDY },
        { say: 'She loops over `parcels` and removes each parcel as the loop reaches it.', show: TIDY },
      ],
      say: 'After that loop, what will `parcels` hold? Type the list.',
      show: TIDY,
      tag: 'you',
      done: (e) => said(e, 'list', '[7]'),
      praise: '`[7]`: removing `5` slid `7` into the place the loop had just looked at.',
      nudge: (l) => {
        if (ranInstead(l)) return 'Predict it first: type the list you expect, in square brackets.'
        if (l.thought?.repr === '[]') return 'A fair guess, but the loop walks by position, and each removal slides the rest left.'
        if (l.thought?.type === 'list')
          return 'Walk it: pass one removes `5`, leaving `[7, 4]`, and pass two looks at the second place.'
        return undefined
      },
    },
    {
      beats: [{ say: 'Now let the robot check you, printing each pass.', show: TIDY_CHECK }],
      say: 'Type `for p in parcels:`, then `parcels.remove(p)` and `print(p, parcels)` indented, then a blank line.',
      show: TIDY_CHECK,
      tag: 'you',
      done: (e) => ever(e, (s) => listIs(s, 'parcels', '[7]') && points(s, 'p', '4')),
      praise: 'Only `7` is left, and `p` ended at `4`, because the loop never looked at `7`.',
      nudge: (l) => indentMiss(l),
    },
  ],
  outro: [
    { say: 'The printout shows two passes only, `5` and then `4`: the `7` slid past.', focus: 'console' },
    { say: 'And Mira’s total? Her `total = 0` belonged before the loop, where it runs once.' },
    { say: 'Read a loop by its indent: the body runs once per item, and the line after it runs once.' },
    { say: 'Next, the robot learns to choose, and then the exercises: you read first, then the robot runs it.' },
  ],
  takeaway: 'The indented lines under a `for` run once for each item, so anything they build up must exist before the loop starts.',
}
