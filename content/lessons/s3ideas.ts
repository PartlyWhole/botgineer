import type { MemorySnapshot, PyObject } from '../../src/memory/model'
import { STAGE_OPENERS } from '../collection/story'
import { ever, errorType, heard, targetOf, type Evidence, type Lesson, type Line } from './core'

/**
 * Stage 3, the ideas: brackets and keys, told in beats.
 *
 * This level used to be the collection's Stage 3 prose, shown whole. The
 * markdown is still the source of truth; this lesson takes its ideas, not
 * its text, and keeps what Stage 3 adds:
 *
 * 1. `items[i]` reads a slot, counting from 0, and a minus counts from the
 *    end; a slot that is not there is an `IndexError`;
 * 2. `items[i] = v` writes a slot: the same list changes, no name moves;
 * 3. a slice `items[a:b]` stops before `b` and builds a new list —
 *    predicted before it is run;
 * 4. a dictionary's slots are labelled by keys: `d[k]` reads one, a
 *    missing key is a `KeyError`, `.get` hands back a default instead (a
 *    bare `None` is not said aloud by the console, so the ask gives one), and
 *    `in` asks about keys, never values;
 * 5. brackets after brackets are read left to right.
 *
 * Cut, because an earlier level or a later stage owns it: rebinding versus
 * changing (Stage 2; one line of reminder here), what may be a key and
 * dictionary order (Stage 6 does them properly), and the shared insides of
 * a slice (Stage 4 — one beat points at the arrows, no more).
 *
 * The picture is the memory graph (R6): a list's slots carry their
 * numbers there and a dictionary's carry their keys, so every read has
 * something to point at and every write moves an arrow.
 */

/** The object a name points at, or null. */
const objectOf = (s: MemorySnapshot, name: string): PyObject | null => {
  const id = targetOf(s, name)
  return id === null ? null : (s.objects[id] ?? null)
}

const typeOf = (s: MemorySnapshot, name: string): string | null => objectOf(s, name)?.type ?? null

/** What the slot with this label (an index, or a key's repr) points at. */
const slot = (s: MemorySnapshot, name: string, label: string): string | null => {
  const o = objectOf(s, name)
  const target = o?.elements?.find((e) => e.label === label)?.target
  return target === undefined ? null : (s.objects[target]?.repr ?? null)
}

/** The first list `items` pointed at: the one that was made, not a
 *  replacement typed out afresh. */
const firstItems = (e: Evidence): string | null => {
  for (const s of e.history) if (typeOf(s, 'items') === 'list') return targetOf(s, 'items')
  return null
}

const from = (t: { source?: string | undefined }, re: RegExp) => re.test(t.source ?? '')

/** A line the player typed out by hand, rather than letting the robot read. */
const byHand = (l: Line, name: string) => l.ok && l.thought !== null && !new RegExp(`\\b${name}\\b`).test(l.source)

export const s3Ideas: Lesson = {
  id: 's3-ideas',
  teaches: [],
  steps: [
    {
      beats: [
        { say: STAGE_OPENERS[2]! },
        { say: 'To find that line, you read brackets exactly: which object, and which slot in it.' },
        { say: 'Start with a list of three letters.', focus: 'console' },
      ],
      say: 'Type `items = ["a", "b", "c"]`.',
      tag: 'you',
      done: (e) => ever(e, (s) => typeOf(s, 'items') === 'list' && (objectOf(s, 'items')?.elements?.length ?? 0) === 3),
      praise: 'One list with three slots, and `items` pointing at it.',
    },
    {
      beats: [
        { say: 'Press the list card below: its arrows are its slots, numbered 0, 1 and 2, as Python counts from 0.', focus: 'memory' },
        { say: '`items[1]` means: go to the list `items` points at, and hand back what slot 1 points at.' },
        { say: 'A minus counts from the end instead: `items[-1]` is the last slot.' },
      ],
      say: 'Ask the robot for `items[1]`, then for `items[-1]`.',
      tag: 'robot',
      done: (e) =>
        heard(e, (t) => t.type === 'str' && t.repr === "'b'" && from(t, /items\s*\[/)) &&
        heard(e, (t) => t.type === 'str' && t.repr === "'c'" && from(t, /items\s*\[\s*-/)),
      praise: '`\'b\'`, then `\'c\'`: slot 1 is the second, because counting starts at 0, and -1 is the last.',
      nudge: (l) => {
        if (errorType(l) === 'IndexError') return 'There is no such slot: this list has only 0, 1 and 2, so the robot stopped with an `IndexError`.'
        if (byHand(l, 'items')) return 'Let the robot read the slot: `items[1]`.'
        if (l.thought?.repr === "'b'") return '`\'b\'` is in slot 1. Now the last slot: `items[-1]`.'
        if (l.thought?.repr === "'c'") return '`\'c\'` is the last slot. Now ask for slot 1: `items[1]`.'
        if (l.thought?.repr === "'a'") return '`\'a\'` is in slot 0, the first. Ask for slot 1: `items[1]`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Ask for a slot that isn’t there, like `items[3]`, and the robot stops with an `IndexError`.' },
        { say: 'Brackets on the left of `=` write into a slot instead of reading it.' },
        { say: 'No name moves: the same list changes, as in Stage 2.' },
      ],
      say: 'Type `items[1] = "z"`, and watch slot 1.',
      tag: 'you',
      done: (e) => {
        const made = firstItems(e)
        return made !== null && ever(e, (s) => targetOf(s, 'items') === made && slot(s, 'items', '1') === "'z'")
      },
      praise: 'Slot 1’s arrow moved to `\'z\'`, and `items` still points at the same list.',
      nudge: (l) =>
        /^\s*items\s*=/.test(l.source)
          ? 'That built a new list and moved the name. Write into the slot: `items[1] = "z"`.'
          : undefined,
    },
    {
      beats: [
        { say: 'A slice, `items[1:3]`, reads the slots from 1 up to 3, but stops before 3.' },
        { say: 'Now read before you run.' },
      ],
      say: 'How many slots will `items[1:3]` hand back? Type just the number.',
      tag: 'you',
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '2' && (t.source ?? '').trim() === '2'),
      praise: 'Two: slots 1 and 2, because a slice stops before its end.',
      nudge: (l) => {
        if (/items/.test(l.source)) return 'Predict it first: type just the number you expect.'
        if (l.thought?.type === 'int' && l.thought.repr === '3') return 'A slice stops *before* its end: which slots does `1:3` take?'
        if (l.thought?.type === 'int') return 'Count the slots from 1, stopping before 3.'
        return undefined
      },
    },
    {
      beats: [{ say: 'Now let the robot check, and give the slice a name so it stays.' }],
      say: 'Type `part = items[1:3]`.',
      tag: 'you',
      done: (e) =>
        ever(
          e,
          (s) =>
            typeOf(s, 'part') === 'list' &&
            (objectOf(s, 'part')?.elements?.length ?? 0) === 2 &&
            targetOf(s, 'part') !== targetOf(s, 'items'),
        ),
      praise: 'Two slots, as you said, and `part` has a new list of its own.',
      nudge: (l) => (l.thought !== null ? 'Give it a name, so it stays in memory: `part = items[1:3]`.' : undefined),
    },
    {
      beats: [
        { say: 'Look below: two list cards now, one for `items` and one for `part`.', focus: 'memory' },
        { say: 'The new list’s slots point at the same `\'z\'` and `\'c\'`: Stage 4 is about that.' },
        { say: 'A dictionary labels its slots with keys, not numbers.' },
        { say: 'Curly brackets make one: each key, a colon, then what it points at.' },
      ],
      say: 'Type `ages = {"ann": 30, "bo": 25}`.',
      tag: 'you',
      done: (e) => ever(e, (s) => typeOf(s, 'ages') === 'dict' && slot(s, 'ages', "'ann'") !== null),
      praise: 'One dictionary, and `ages` pointing at it.',
    },
    {
      beats: [
        { say: 'Press the dictionary card below: its arrows are labelled `\'ann\'` and `\'bo\'`, not numbers.', focus: 'memory' },
        { say: '`ages["ann"]` means: find the slot labelled `"ann"`, and hand back what it points at.' },
      ],
      say: 'Ask the robot for `ages["ann"]`.',
      tag: 'robot',
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '30' && from(t, /ages\s*\[/)),
      praise: '`30`: the robot found the key `"ann"`, not a position.',
      nudge: (l) => {
        if (errorType(l) === 'KeyError') return 'No slot has that key. The keys are `"ann"` and `"bo"`, in quotes.'
        if (byHand(l, 'ages')) return 'Let the robot look it up: `ages["ann"]`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Ask for a key that isn’t there, like `ages["cy"]`, and the robot stops with a `KeyError`.' },
        { say: '`.get` asks more gently: for a missing key, it hands back a default you choose.' },
        { say: 'In `ages.get("cy", 0)`, the default is `0`; leave it out, and you get `None`.' },
      ],
      say: 'Ask the robot for `ages.get("cy", 0)`.',
      tag: 'robot',
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '0' && from(t, /ages\s*\.\s*get\s*\(/)),
      praise: '`0`: there is no key `"cy"`, so `.get` handed back the default instead of stopping.',
      nudge: (l) => {
        if (errorType(l) === 'KeyError') return 'That was the `KeyError`. Now ask gently: `ages.get("cy", 0)`.'
        if (l.ok && l.thought === null && /\.get\s*\(/.test(l.source))
          return 'That handed back `None`, which the robot doesn’t say aloud. Give it a default: `ages.get("cy", 0)`.'
        if (l.thought !== null && /get/.test(l.source)) return 'Ask for a key that isn’t there: `ages.get("cy", 0)`.'
        if (byHand(l, 'ages')) return 'Let the robot look it up: `ages.get("cy", 0)`.'
        return undefined
      },
    },
    {
      beats: [{ say: '`in` asks a dictionary a yes-or-no question about what it holds.' }],
      say: 'Ask the robot: `30 in ages`.',
      tag: 'robot',
      done: (e) => heard(e, (t) => t.type === 'bool' && t.repr === 'False' && from(t, /\bin\s+ages\b/)),
      praise: '`False`: `in` asks about keys, and `30` is only what a key points at.',
      nudge: (l) => {
        if (l.thought?.repr === 'True' && /\bin\b/.test(l.source)) return '`True`: that is a key. Now try a value: `30 in ages`.'
        if (byHand(l, 'ages')) return 'Let the robot answer: `30 in ages`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Brackets can follow brackets, and Python reads them left to right.' },
        { say: 'In `grid[1][0]`, `grid[1]` hands back an inner list, then `[0]` reads that list.' },
      ],
      say: 'Type `grid = [[1, 2], [3, 4]]`, then ask the robot for `grid[1][0]`.',
      tag: 'robot',
      done: (e) =>
        ever(e, (s) => typeOf(s, 'grid') === 'list') &&
        heard(e, (t) => t.type === 'int' && t.repr === '3' && from(t, /grid\s*\[[^\]]*\]\s*\[/)),
      praise: '`3`: `grid[1]` is the list `[3, 4]`, and slot 0 of that is `3`.',
      nudge: (l) => {
        if (/^\s*grid\s*=/.test(l.source)) return 'Now ask the robot: `grid[1][0]`.'
        if (errorType(l) === 'NameError') return 'Make `grid` first: `grid = [[1, 2], [3, 4]]`.'
        if (l.thought?.type === 'list') return 'That is the inner list. Add `[0]` to read its first slot: `grid[1][0]`.'
        if (byHand(l, 'grid')) return 'Let the robot read it: `grid[1][0]`.'
        return undefined
      },
    },
  ],
  outro: [
    { say: 'Look below: `grid` points at a list whose slots point at two more lists.', focus: 'memory' },
    { say: 'Every bracket named one container and one slot in it, read left to right.' },
    { say: 'The exercises are next: find which slot each line reads, or writes.' },
  ],
  takeaway: 'Brackets pick a slot: a number counts from 0 in a list, a key finds its pair in a dictionary.',
}
