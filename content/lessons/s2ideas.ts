import { openerOf } from '../collection/story'
import { ever, everBy, heard, points, sameObject, targetOf, type Evidence, type Lesson, type Line } from './core'
import { EMPTY, type MemorySnapshot } from '../../src/memory/model'

/**
 * Stage 2, the ideas: changing an object versus moving a name, told in
 * beats.
 *
 * This level used to be the collection's Stage 2 prose, shown whole. The
 * markdown is still the source of truth; this lesson takes its ideas, not
 * its text, and keeps only what Stage 2 adds to Stage 1:
 *
 * 1. a line can change an object and move no arrow (`nums.append(3)`),
 *    and every name on that object sees it;
 * 2. a line with a bare name before its `=` moves only that name
 *    (`nums = nums + [4]`), predicted before it is run (R7: the same two
 *    names, differing in one kind of line);
 * 3. a method that changes a list hands back `None`, seen by keeping it
 *    under a name — `other = other.sort()`, the trap itself, which loses
 *    the list (the console echoes no `None`, so it is never a thought);
 * 4. `+=` changes a list but, on a number, builds a new object and moves
 *    the arrow — numbers (and strings, and tuples) can only be replaced;
 * 5. a tuple, seen once: its arrows never move, but a list it points at
 *    can still change (Checkpoint 2 asks exactly that).
 *
 * The picture is the memory graph (R6): every step changes a card or
 * moves an arrow there, and the beat after it points at it (focus
 * `memory`). The cloud is emptied (`thought: ''`) once the prediction has
 * been run, so the typed `[1, 2, 3]` is not left floating over later
 * lines. Lists are reference objects, keyed by the engine's uid, so two
 * lists that print alike are two cards; the one number step uses `10`
 * and `11` (not in any list, so their cards sit in their own rows), which
 * CPython shares anyway (invariant 4).
 *
 * The run steps judge the *event*, not exact reprs: a player who took a
 * detour (`nums += [4]` where `nums = nums + [4]` was asked) still has
 * two names, and the next line of the right kind still finishes the step.
 * Where the praise names a kind of line (the change through a shared
 * list, `+=`, `.sort()`), the step asks the line that did it (`changedBy`:
 * its source, memory before it and memory after), so the same memory
 * reached another way never earns a praise that says something false.
 */

/**
 * An accepted line did this: of its source, memory before it and memory
 * as it left it. Derived from the accepted lines like `everBy`, and so
 * true for good once true.
 */
const changedBy = (e: Evidence, holds: (source: string, before: MemorySnapshot, after: MemorySnapshot) => boolean) => {
  const ls = e.lines ?? []
  return ls.some((l, i) => holds(l.source, i > 0 ? ls[i - 1]!.memory : EMPTY, l.memory))
}

/**
 * The list a name points at, written the way Python prints it, or null.
 * Read from the card's slots, since a list's own `repr` in memory is a
 * summary ("3 items"), and every slot is a pointer to its own object.
 */
const listOf = (s: MemorySnapshot, name: string): string | null => {
  const id = targetOf(s, name)
  const o = id === null ? null : s.objects[id]
  if (!o || o.type !== 'list' || o.elements === null) return null
  return `[${o.elements.map((el) => s.objects[el.target]?.repr ?? '?').join(', ')}]`
}

/** The line was a bare expression, worked out and let go. */
const letGo = (l: Line) => l.ok && l.thought !== null && !/=/.test(l.source.replace(/==/g, ''))

/** A list written out, and nothing else: a prediction, not a question. */
const listLiteral = (source: string | undefined) => /^\[[\d\s,]*\]$/.test((source ?? '').trim())

/** A line that changed the one list `nums` and `other` already shared, so
 *  it now holds a 3: not two names pointed at a list typed out with one. */
const sharedAndChanged = (e: Evidence) =>
  changedBy(
    e,
    (_, before, after) =>
      sameObject(before, 'nums', 'other') &&
      targetOf(before, 'nums') === targetOf(after, 'nums') &&
      sameObject(after, 'nums', 'other') &&
      (listOf(after, 'nums') ?? '').startsWith('[1, 2, 3'),
  )

/** `nums` on a new list, one `4` longer than the list `other` kept. */
const movedAway = (e: Evidence) =>
  ever(e, (s) => {
    const n = listOf(s, 'nums')
    const o = listOf(s, 'other')
    return n !== null && o !== null && !sameObject(s, 'nums', 'other') && n === `${o.slice(0, -1)}, 4]`
  })

export const s2Ideas: Lesson = {
  id: 's2-ideas',
  teaches: [],
  steps: [
    {
      beats: [
        { say: openerOf(2) },
        { say: 'Until now, every line you read made an object, or moved an arrow to one.' },
        { say: 'A list opens a second way: a line can leave every arrow still and change the object itself.' },
        { say: 'The two look alike on the page, so let’s watch each one in memory.', focus: 'console' },
      ],
      say: 'Make a list: type `nums = [1, 2]`.',
      tag: 'you',
      done: (e) => ever(e, (s) => listOf(s, 'nums') === '[1, 2]'),
      praise: 'One list card, because square brackets built one, and `nums` points at it.',
      nudge: (l) => (letGo(l) ? 'That was thought of and let go. Give it the name: `nums = [1, 2]`.' : undefined),
    },
    {
      beats: [{ say: 'Mira’s program gave her list a second name, like this.' }],
      say: 'Type `other = nums`.',
      tag: 'you',
      done: (e) => ever(e, (s) => sameObject(s, 'nums', 'other') && listOf(s, 'nums') !== null),
      praise: 'Two arrows on one list, because `other = nums` copied the arrow, not the list.',
      nudge: (l) => (/\[/.test(l.source) ? 'Use the name, not the brackets: `other = nums`.' : undefined),
    },
    {
      beats: [
        { say: '`.append(3)` asks the list itself to put a `3` on its end.' },
        { say: 'There is no `=` in that line, so no arrow can move.' },
      ],
      say: 'Type `nums.append(3)`, and watch `other`.',
      tag: 'you',
      done: sharedAndChanged,
      praise: '`other` sees the `3` too, because there is only one list, and it changed.',
      nudge: (l) => {
        if (/=\s*nums\s*\.\s*append/.test(l.source)) return 'That pointed `nums` at what `.append` handed back. Fix it: `nums = other`.'
        if (/nums\s*=\s*nums\s*\+/.test(l.source)) return 'That built a new list. Put `nums` back with `nums = other`, then `nums.append(3)`.'
        if (/^\s*nums\s*=\s*\[/.test(l.source)) return 'That built a new list. Point it back with `nums = other`, then `nums.append(3)`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Look below: no arrow moved, but the one list card now holds a `3`.', focus: 'memory' },
        { say: 'That is what happened to Mira: she changed the list through one name and read it through another.' },
        { say: 'Now the other kind of line: `nums = nums + [4]`.' },
        { say: 'Its right side builds a brand new list, and then the `nums` arrow moves to it.' },
      ],
      say: 'After that line, what will `other` show? Type the list you expect.',
      tag: 'you',
      // A typed list, and only that: `other` itself would get the robot
      // to look, which is the one thing a prediction may not do.
      done: (e) => heard(e, (t) => t.type === 'list' && t.repr === '[1, 2, 3]' && listLiteral(t.source)),
      praise: 'That’s the one: only `nums` is left of the `=`, so `other` stays on its list.',
      nudge: (l) => {
        if (/nums|other/.test(l.source)) return 'Predict it first: type the list you expect, in square brackets.'
        if (l.thought?.repr === '[1, 2, 3, 4]') return 'Read it again: only `nums` is left of the `=`, so only `nums` moves.'
        if (l.thought?.repr === '[1, 2]') return 'Read it again: the `3` went into the list both names share.'
        return undefined
      },
    },
    {
      beats: [{ say: 'Now let the robot check your prediction.' }],
      say: 'Run it: `nums = nums + [4]`.',
      tag: 'you',
      done: movedAway,
      praise: '`other` stayed where it was, as you said, because only `nums` moved.',
      nudge: (l) => (/\+=/.test(l.source) ? 'That’s a different line, and we’ll meet it soon. Type `nums = nums + [4]`.' : undefined),
    },
    {
      beats: [
        { say: 'Look below: two lists now, and only the `nums` arrow moved.', focus: 'memory', thought: '' },
        { say: 'So read what is just left of the `=`: a bare name there means an arrow moves.', thought: '' },
        { say: 'A line with no `=`, like `nums.append(3)`, asked something of the object instead.', thought: '' },
        { say: '`.sort()` is one of those: it puts a list in order, right where it is.', thought: '' },
        { say: 'Give it something to sort: point `other` at a list that is out of order.', thought: '' },
      ],
      say: 'Type `other = [3, 1, 2]`, then `other.sort()`, and watch its arrows.',
      tag: 'you',
      done: (e) =>
        changedBy(
          e,
          (src, before, after) =>
            /^\s*other\s*\.\s*sort\s*\(\s*\)\s*$/.test(src) &&
            listOf(before, 'other') === '[3, 1, 2]' &&
            targetOf(before, 'other') === targetOf(after, 'other') &&
            listOf(after, 'other') === '[1, 2, 3]',
        ),
      praise: 'Same list card, its arrows reordered, because `.sort()` changes the list where it is.',
      nudge: (l) => {
        if (/^\s*other\s*=\s*\[\s*3\s*,\s*1\s*,\s*2\s*\]\s*$/.test(l.source)) return 'Now `other.sort()`, and watch its arrows.'
        if (/^\s*other\s*=\s*other\s*\.\s*sort/.test(l.source)) return 'Nearly: just `other.sort()`, with no `=`. First point `other` at `[3, 1, 2]` again.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Look below: the same list, now in order, and no arrow of a name moved.', focus: 'memory', thought: '' },
        { say: 'But what does `.sort()` hand back? Keep it under a name, and see.', thought: '' },
      ],
      say: 'Type `other = other.sort()`, and watch `other`.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'other', 'None')),
      praise: '`other` points at `None`, because `.sort()` did its job on the list and handed back nothing.',
      nudge: (l) =>
        l.ok && /^\s*other\s*\.\s*sort/.test(l.source)
          ? 'The robot shows nothing for `None`. Keep it under a name to see it: `other = other.sort()`.'
          : undefined,
    },
    {
      beats: [
        { say: 'Look below: the sorted list is gone, because nothing points at it any more.', focus: 'memory', thought: '' },
        { say: '`.append` and the other methods that change a list hand back `None` too, so keeping it is a trap.', thought: '' },
        { say: 'Now `+=`, which looks like a short way to write `nums = nums + …`.', thought: '' },
        { say: 'Point `other` back at `nums`’s list first, so we can see which kind of line it is.', thought: '' },
      ],
      say: 'Type `other = nums`, then `nums += [5]`.',
      tag: 'you',
      // The `+=` line itself, on the list both names already shared: the
      // same memory reached by `nums = nums + [5]` then `other = nums`
      // would make the praise say something false.
      done: (e) =>
        changedBy(
          e,
          (src, before, after) =>
            /\bnums\s*\+=/.test(src) &&
            sameObject(before, 'nums', 'other') &&
            targetOf(before, 'nums') === targetOf(after, 'nums') &&
            sameObject(after, 'nums', 'other') &&
            (listOf(after, 'nums') ?? '').endsWith(', 5]'),
        ),
      praise: '`other` sees the `5` too, because on a list `+=` changes the list rather than building one.',
      nudge: (l) => {
        if (/^\s*other\s*=\s*nums\s*$/.test(l.source)) return 'Now `nums += [5]`, and watch `other`.'
        if (/nums\s*=\s*nums\s*\+/.test(l.source)) return 'That built a new list and left `other` behind. Type `other = nums`, then `nums += [5]`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Look below: one list, with both `nums` and `other` on it.', focus: 'memory', thought: '' },
        { say: 'Now the same `+=` on a number, with two names on it.', thought: '' },
      ],
      say: 'Type `n = 10`, then `m = n`, then `n += 1`.',
      tag: 'you',
      // `n` moved off a `10` it shared with `m`, by a `+=`: not `n = 11`.
      done: (e) =>
        changedBy(
          e,
          (src, before, after) =>
            /^\s*n\s*\+=\s*1\s*$/.test(src) &&
            points(before, 'n', '10') &&
            sameObject(before, 'n', 'm') &&
            points(after, 'n', '11') &&
            points(after, 'm', '10'),
        ),
      praise: '`m` stayed on `10`, because a number can’t change: `+=` built an `11` and moved `n`.',
      nudge: (l) => {
        if (/^\s*n\s*=\s*10\s*$/.test(l.source)) return 'Now `m = n`.'
        if (/^\s*m\s*=\s*n\s*$/.test(l.source)) return 'Now `n += 1`, and watch both arrows.'
        if (/^\s*n\s*=\s*n\s*\+\s*1\s*$/.test(l.source)) return 'Same effect, but try the short way: `n = 10`, `m = n`, then `n += 1`.'
        if (/^\s*[nm]\s*=\s*1[01]\s*$/.test(l.source)) return 'Let `+=` do it: `n = 10`, then `m = n`, then `n += 1`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Look below: `n` moved to a new `11`, and `m` stayed on `10`.', focus: 'memory', thought: '' },
        { say: 'Round brackets make a **tuple**: like a list, but its arrows can never be pointed anywhere else.', thought: '' },
        { say: 'But a list a tuple points at is still a list, and it can still change.', thought: '' },
      ],
      say: 'Type `inner = [2]`, then `pair = (1, inner)`, then `inner.append(3)`.',
      tag: 'you',
      // The append, with the tuple already made: `pair = (1, [2, 3])`
      // typed out holds the same values and shows nothing changing.
      done: (e) =>
        everBy(e, (src, s) => {
          if (!/^\s*inner\s*\.\s*append\s*\(/.test(src)) return false
          const id = targetOf(s, 'pair')
          const t = id === null ? undefined : s.objects[id]
          return t?.type === 'tuple' && t.elements?.[1]?.target === targetOf(s, 'inner') && (listOf(s, 'inner') ?? '').endsWith(', 3]')
        }),
      praise: 'The tuple’s arrows never moved, but the list its slot points at changed, because lists can.',
      nudge: (l) => {
        if (/^\s*inner\s*=\s*\[\s*2\s*\]\s*$/.test(l.source)) return 'Now the tuple: `pair = (1, inner)`.'
        if (/^\s*pair\s*=\s*\(\s*1\s*,\s*inner\s*\)\s*$/.test(l.source)) return 'Now change the list: `inner.append(3)`, and watch `pair`.'
        if (/^\s*pair\s*=\s*\(/.test(l.source) && !/inner/.test(l.source)) return 'Use the name, so there is a list to change: `pair = (1, inner)`.'
        if (/^\s*inner\s*\.\s*append/.test(l.source)) return 'Make the tuple first, then change the list: `inner = [2]`, then `pair = (1, inner)`.'
        return undefined
      },
    },
  ],
  outro: [
    { say: 'Look below: `pair` still points at its `1` and at the same list, which now holds a `3`.', focus: 'memory', thought: '' },
    { say: 'Strings and tuples can’t be changed, only replaced, though a list inside a tuple still can.', thought: '' },
    { say: 'So when a list changes by itself, look for a line that changed it through another name.', thought: '' },
    { say: 'The exercises are next: you read first, then the robot runs it.', thought: '' },
  ],
  takeaway: 'A bare name before `=` moves one arrow; `.append`, `.sort` and `+=` change a list, and every name on it sees.',
}
