import { errorType, ever, everBy, heard, points, targetOf, type Evidence, type Lesson, type Line } from './core'
import type { MemorySnapshot } from '../../src/memory/model'

/**
 * Making Choices: `if`, told in beats.
 *
 * Stage 5's exercises (5.10–5.13, C5.4) put an `if` in a loop's body —
 * `if n == 3: break`, `if n % 2 == 0: ...` — and nothing before them
 * taught one. This lesson does, straight after Stage 5's ideas, because
 * it needs what they teach: a `for` block, and `break`.
 *
 * 1. a condition is a `bool`, the kind a comparison already makes
 *    (Working things out) — asked of a name, so it is about the parcel;
 * 2. `if` runs its indented block only when the condition is `True`;
 * 3. when it is `False` the block is skipped and nothing moves —
 *    predicted, never run, because a skipped block leaves no trace;
 * 4. `else` runs only when it is `False`, and is optional;
 * 5. an `if` inside a loop's body, a block inside a block, asked again
 *    each pass: keep only the heavy parcels;
 * 6. `break` under an `if`, which stops the loop only on the pass the
 *    question says so.
 *
 * Evidence is memory after each accepted line (a block is one line), the
 * source of that line, and the robot's thoughts. Memory cannot tell an
 * `if` that ran from the line under it typed alone, so the `if` and
 * `else` steps ask which line made the change (`everBy`): it must have an
 * `if` in it, and for the `else` step an `else` too. The loop steps
 * cannot be typed out, because the loop leaves `w` behind.
 * Nothing here prints: printed output is not evidence.
 */

/** This name points at a list whose slots point at these, slot by slot. */
const listIs = (s: MemorySnapshot, name: string, repr: string): boolean => {
  const id = targetOf(s, name)
  const list = id === null ? undefined : s.objects[id]
  if (list?.type !== 'list' || !list.elements) return false
  return `[${list.elements.map((el) => s.objects[el.target]?.repr ?? '?').join(', ')}]` === repr
}

/** A typed prediction: a bare string in quotes, never a line that did the work. */
const saidText = (e: Evidence, repr: string): boolean =>
  heard(e, (t) => t.type === 'str' && t.repr === repr && /^\s*(["'])\w+\1\s*$/.test(t.source ?? ''))

/** The source's lines, with how far each is indented. */
const rows = (source: string) =>
  source
    .split('\n')
    .filter((r) => r.trim() !== '')
    .map((r) => ({ text: r.trim(), indent: r.length - r.trimStart().length }))

/** A header line typed without its colon, or asking with one `=`. Both
 *  stop the robot with a `SyntaxError`, which names neither. */
function headerMiss(l: Line): string | undefined {
  if (errorType(l) !== 'SyntaxError') return undefined
  const header = rows(l.source).find((r) => /^(if|else|for)\b/.test(r.text))
  if (!header) return undefined
  if (/^if\b/.test(header.text) && /[^=!<>]=[^=]/.test(header.text))
    return 'One `=` gives a name. To ask *is it the same?*, use two: `==`.'
  if (!header.text.endsWith(':')) return 'A header ends with a colon, which opens the block under it.'
  if (/^else\b/.test(header.text)) return 'An `else` can’t stand alone: it goes right under an `if` block.'
  return undefined
}

/** A block whose body was not indented, or a stray indent. */
const indentMiss = (l: Line): string | undefined =>
  errorType(l) === 'IndentationError'
    ? 'The block needs spaces in front of it, so Python knows it is inside.'
    : undefined

/** A line of this source that starts with this header: `if`, `else`. */
const has = (source: string, word: 'if' | 'else') => new RegExp(`^\\s*${word}\\b`, 'm').test(source)

/** `ride = …` typed on its own, which chooses for the robot. */
const bareRide = (l: Line): string | undefined =>
  l.ok && /^\s*ride\s*=/.test(l.source) && !has(l.source, 'if')
    ? 'Let the robot decide: put that line inside an `if`.'
    : undefined

/** The line the `if` sits on and the line it guards, if both were typed. */
function guarded(source: string, inner: RegExp): { cond: number; body: number } | null {
  const r = rows(source)
  const cond = r.find((x) => /^if\b/.test(x.text))
  const body = r.find((x) => inner.test(x.text))
  return cond && body ? { cond: cond.indent, body: body.indent } : null
}

export const decide: Lesson = {
  id: 'decide',
  teaches: [],
  steps: [
    {
      beats: [
        { say: 'Mira sends heavy parcels in the van, and light ones on the bike.' },
        { say: 'The robot can’t choose between them yet: it runs every line it is given.' },
        { say: 'It needs a question to decide by, and a way to skip lines when the answer is no.' },
        { say: 'Start with a parcel: it weighs 12 kilos.', focus: 'console' },
      ],
      say: 'Type `weight = 12`.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'weight', '12')),
      praise: '`weight` points at `12`, so the robot can ask about it as often as it needs.',
    },
    {
      beats: [
        { say: 'In Working things out, a comparison answered a question with `True` or `False`.' },
        { say: '`>` asks *is it more than?*, and a parcel over 10 kilos is heavy.' },
        { say: 'Ask about the name, not the number, so the question fits any parcel.' },
      ],
      say: 'Ask the robot: `weight > 10`.',
      tag: 'robot',
      done: (e) =>
        heard(e, (t) => t.type === 'bool' && t.repr === 'True' && /weight\s*>\s*10/.test(t.source ?? '')),
      praise: '`True`, because `12` is more than `10`: a comparison always answers with a `bool`.',
      nudge: (l) => {
        if (l.thought?.type === 'bool' && /^\s*(True|False)\s*$/.test(l.source))
          return 'That’s right, but you answered it. Ask the robot: `weight > 10`.'
        if (l.thought?.type === 'bool' && !/weight/.test(l.source))
          return 'Ask about the name, so the question works for any parcel: `weight > 10`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'The robot thought `True` and let it go, but an `if` can act on the answer.' },
        { say: '`if weight > 10:` asks the question, and its colon opens a block under it.' },
        { say: 'The indented lines under it run only when the answer is `True`.' },
        { say: 'Type it the way you typed a loop: the header, the body indented, then a blank line.', focus: 'console' },
      ],
      say: 'Type `if weight > 10:`, then `ride = "van"` indented under it, then a blank line.',
      tag: 'you',
      done: (e) => everBy(e, (src, s) => has(src, 'if') && points(s, 'weight', '12') && points(s, 'ride', "'van'")),
      praise: '`ride` points at `\'van\'`, because `weight > 10` was `True`, so the block ran.',
      nudge: (l) => headerMiss(l) ?? indentMiss(l) ?? bareRide(l),
    },
    {
      beats: [{ say: 'Mira’s next parcel is light: only 3 kilos.', focus: 'memory' }],
      say: 'Point `weight` at it: `weight = 3`.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'weight', '3') && points(s, 'ride', "'van'")),
      praise: '`weight` moved to `3`, and `ride` still says `\'van\'`, because no line told it to change.',
    },
    {
      beats: [
        { say: 'Read this block before anything runs: `if weight > 10:`, with `ride = "truck"` under it.' },
        { say: 'Ask its question in your head: is `weight`, at `3` now, more than `10`?', thought: 'weight > 10 ?', focus: 'memory' },
      ],
      say: 'After that block, what will `ride` point at? Type it, in quotes.',
      tag: 'you',
      done: (e) => saidText(e, "'van'"),
      praise: 'Still `\'van\'`, because `3 > 10` is `False`, so the robot skipped the block.',
      nudge: (l) => {
        if (errorType(l) === 'NameError' && /^\s*\w+\s*$/.test(l.source))
          return 'A word for the robot to keep needs quotes: `"like this"`.'
        if (l.ok && /^\s*if\b/.test(l.source)) return 'Predict it first: type what you expect `ride` to point at, in quotes.'
        // Asking the question out loud is fair: say what it answered, and ask again.
        if (l.thought?.type === 'bool' && /weight/.test(l.source))
          return `That's the question, and the robot says \`${l.thought.repr}\`. So what will \`ride\` point at? Type it, in quotes.`
        if (l.thought && !/^\s*(["'])\w+\1\s*$/.test(l.source)) return 'Predict it first: type what you expect, in quotes.'
        if (l.thought?.repr === "'truck'") return '`3 > 10` is `False`, so the indented line is skipped and never runs.'
        if (l.thought?.type === 'str') return 'Skipping a block moves nothing: `ride` keeps the arrow it already had.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'But `ride` still says `\'van\'`, the heavy parcel’s ride, for a light parcel.', focus: 'memory' },
        { say: '`else:` adds a second block, which runs only when the answer is `False`.' },
        { say: 'The `else:` line sits level with its `if`, and its own lines are indented under it.' },
        { say: '`else` is optional: without one, a `False` answer just skips the block, as you saw.' },
      ],
      say: 'Type `if weight > 10:`, `ride = "van"` indented, `else:`, `ride = "bike"` indented, then a blank line.',
      tag: 'you',
      done: (e) =>
        everBy(
          e,
          (src, s) => has(src, 'if') && has(src, 'else') && points(s, 'weight', '3') && points(s, 'ride', "'bike'"),
        ),
      praise: '`ride` points at `\'bike\'`, because `3 > 10` was `False`, so the `else` block ran instead.',
      nudge: (l) => {
        const miss = headerMiss(l) ?? indentMiss(l) ?? bareRide(l)
        if (miss) return miss
        if (l.ok && /^\s*if\b/.test(l.source) && !/else/.test(l.source))
          return 'That `if` had no `else`, so a `False` answer skipped it. Add `else:` and its block.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Now Mira has three parcels to sort: `[12, 3, 15]`.' },
        { say: 'She wants a list of just the heavy ones, and it starts empty.' },
      ],
      say: 'Type `heavy = []`.',
      tag: 'you',
      done: (e) => ever(e, (s) => listIs(s, 'heavy', '[]') && points(s, 'ride', "'bike'")),
      praise: '`heavy` points at an empty list, so the loop has somewhere to put the heavy ones.',
    },
    {
      beats: [
        { say: 'A loop’s body can hold an `if`, which makes a block inside a block, one indent deeper.' },
        { say: 'Each pass asks the question again, about that pass’s parcel.' },
        { say: '`heavy.append(w)` puts the object `w` points at on the end of `heavy`.' },
        { say: 'The console keeps collecting until the blank line, however deep the blocks go.', focus: 'console' },
      ],
      say: 'Type `for w in [12, 3, 15]:`, `if w > 10:` indented, `heavy.append(w)` indented deeper, then a blank line.',
      tag: 'you',
      done: (e) => ever(e, (s) => listIs(s, 'heavy', '[12, 15]') && points(s, 'w', '15')),
      praise: 'Only `12` and `15`, because the `append` ran only on passes where `w > 10` was `True`.',
      nudge: (l) => {
        const miss = headerMiss(l) ?? indentMiss(l)
        if (miss) return miss
        if (!l.ok || !/^\s*for\b/.test(l.source)) return undefined
        if (!/\bif\b/.test(l.source)) return 'Every parcel went in: put `if w > 10:` between the loop and the `append`.'
        const g = guarded(l.source, /append/)
        if (g && g.body <= g.cond) return 'The `append` isn’t inside the `if`, so it ran every pass: indent it deeper.'
        if (!/w\s*>\s*10/.test(l.source)) return 'Ask the question Mira asks of each parcel: `if w > 10:`.'
        return 'Right loop, but `heavy` wasn’t empty: type `heavy = []`, then run the loop again.'
      },
    },
    {
      beats: [
        { say: 'Look below: the loop left `w` at `15`, the last parcel.', focus: 'memory' },
        { say: 'Now Mira wants the robot to stop looking once it reaches the `3`.' },
        { say: '`==` asks *is it the same?*, and a `break` under an `if` stops the loop only when it’s `True`.' },
      ],
      say: 'Type `for w in [12, 3, 15]:`, `if w == 3:` indented, `break` indented deeper, then a blank line.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'w', '3') && listIs(s, 'heavy', '[12, 15]')),
      praise: '`w` stopped at `3`, because `break` ran on the pass where `w == 3` was `True`.',
      nudge: (l) => {
        const miss = headerMiss(l) ?? indentMiss(l)
        if (miss) return miss
        if (!l.ok || !/^\s*for\b/.test(l.source)) return undefined
        const g = guarded(l.source, /^break\b/)
        if (g && g.body <= g.cond) return 'The `break` isn’t inside the `if`, so it stopped the first pass: indent it deeper.'
        if (!/\bif\b/.test(l.source)) return 'A bare `break` stops the first pass: put `if w == 3:` above it.'
        return undefined
      },
    },
  ],
  outro: [
    { say: 'Now the robot can choose: it asks a question, and the answer decides which lines run.' },
    { say: 'Inside a loop, the question is asked again on every pass, about that pass’s item.' },
    { say: 'The exercises are next: find each `if`, and ask its question the way the robot would.' },
  ],
  takeaway: 'An `if` runs its indented block only when its condition is `True`, and an `else` block only when it is `False`.',
}
