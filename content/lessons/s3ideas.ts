import type { MemorySnapshot, PyObject } from '../../src/memory/model'
import { STAGE_OPENERS } from '../collection/story'
import { bareWord, ever, everBy, errorType, heard, targetOf, type Evidence, type Heard, type Lesson, type Line } from './core'

/**
 * Stage 3, the ideas: brackets and keys, told in beats.
 *
 * This level used to be the collection's Stage 3 prose, shown whole. The
 * markdown is still the source of truth; this lesson takes its ideas, not
 * its text, and keeps what Stage 3 adds:
 *
 * 1. `items[i]` reads a slot, counting from 0, and a minus counts from the
 *    end; a slot that is not there is an `IndexError` — predicted, then
 *    seen;
 * 2. `items[i] = v` writes a slot: the same list changes, no name moves;
 * 3. a slice `items[a:b]` stops before `b` and builds a new list —
 *    predicted before it is run;
 * 4. a dictionary's slots are labelled by keys: `d[k]` reads one, a
 *    missing key is a `KeyError` (predicted, then seen), `.get` hands
 *    back a default instead (a
 *    bare `None` is not said aloud by the console, so the ask gives one), and
 *    `in` asks about keys, never values;
 * 5. what may be a key: a tuple can, a list cannot, because a key must
 *    never change (exercise 3.9 and Checkpoint C3.3 ask why);
 * 6. brackets after brackets are read left to right.
 *
 * Cut, because an earlier level or a later stage owns it: rebinding versus
 * changing (Stage 2; one line of reminder here), dictionary order (Stage 6
 * does it properly), and the shared insides of a slice (Stage 4 — one beat
 * points at the arrows, no more).
 *
 * The write step judges the line that wrote (`everBy`), not the first list
 * `items` ever named: a player who rebinds `items` on the way (the miss
 * its nudge names) can still finish it by writing into the new list.
 *
 * The two errors are predictions, not asks to trigger them. A line that
 * stops the robot is never accepted, so it leaves no thought and no
 * memory: nothing derived could say it happened, and a step judged on it
 * would forget it on the next line. So the learner says what the robot
 * will say — the error's name, typed as a word in quotes, which the robot
 * does think of — and the step after asks them to see it happen first,
 * where its nudge greets the error they named. The reads step no longer
 * names `IndexError` for an index past the end, since that would give the
 * prediction away.
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

const from = (t: { source?: string | undefined }, re: RegExp) => re.test(t.source ?? '')

/** The error's name typed as a word in quotes: a prediction, not a run. */
const named = (name: string) => (t: Heard) =>
  t.type === 'str' && t.repr === `'${name}'` && new RegExp(`^\\s*(["'])${name}\\1\\s*$`).test(t.source ?? '')

/**
 * The robot thought something `then` passes after thinking something each
 * of `first` passes. Thoughts are only ever appended, so this stays true
 * once true, like `heard`. It is how a prediction counts only once its
 * question is up: `"KeyError"`, guessed wrong for the missing index, must
 * not answer the missing key two steps later.
 */
const heardAfter = (e: Evidence, first: ((t: Heard) => boolean)[], then: (t: Heard) => boolean): boolean => {
  const at = first.map((f) => e.thoughts.findIndex(f))
  if (at.some((i) => i < 0)) return false
  const last = Math.max(...at)
  return e.thoughts.some((t, i) => i > last && then(t))
}

const readB = (t: Heard) => t.type === 'str' && t.repr === "'b'" && from(t, /items\s*\[/)
const readC = (t: Heard) => t.type === 'str' && t.repr === "'c'" && from(t, /items\s*\[\s*-/)
const readAnn = (t: Heard) => t.type === 'int' && t.repr === '30' && from(t, /ages\s*\[/)

/**
 * The misses on "what will the robot say?": running it instead, the error
 * itself without quotes, a word the robot does not know, and the other
 * error. `what` is what was asked for, `run` the line that would show it.
 */
const predictMiss = (l: Line, name: string, other: string, what: string, run: RegExp): string | undefined => {
  const src = l.source.trim()
  if (errorType(l) === name && run.test(src)) return 'That ran it. Predict first: type the error’s name, in quotes.'
  if (run.test(src)) return 'Predict it first: type the error’s name, in quotes.'
  if (src === name) return `That’s the error itself. Say its name as a word, in quotes: \`"${name}"\`.`
  if (bareWord(l)) return 'Without quotes the robot looks for a name. Put the error’s name in quotes.'
  if (l.thought?.type === 'str' && l.thought.repr === `'${other}'`)
    return other === 'KeyError' ? 'A `KeyError` is a missing key. A list’s slots have numbers: which error is that?' : `The \`${other}\` was the list’s. A dictionary’s slots have keys: which error is that?`
  if (l.thought?.type === 'str') return `Not that one: you asked for ${what} that isn’t there. Which error is that?`
  return undefined
}

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
      done: (e) => heard(e, readB) && heard(e, readC),
      praise: 'Slot 1 is `\'b\'`, the second, because counting starts at 0, and -1 is the last, `\'c\'`.',
      nudge: (l) => {
        // The console names the error; say so, since a question about it is coming.
        if (errorType(l) === 'IndexError') return 'No such slot: this list has only 0, 1 and 2. Remember what the robot said, and read one that is there.'
        if (byHand(l, 'items')) return 'Let the robot read the slot: `items[1]`.'
        if (l.thought?.repr === "'b'") return '`\'b\'` is in slot 1. Now the last slot: `items[-1]`.'
        if (l.thought?.repr === "'c'" && !/-/.test(l.source)) return 'Right slot, counted from the front. Now count from the end: `items[-1]`.'
        if (l.thought?.repr === "'c'") return '`\'c\'` is the last slot. Now ask for slot 1: `items[1]`.'
        if (l.thought?.repr === "'a'") return '`\'a\'` is in slot 0, the first. Ask for slot 1: `items[1]`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'A slot’s number is its index, and `items` has indexes 0, 1 and 2 only.', focus: 'memory' },
        { say: 'Ask for index 3, and there is no slot to read, so the robot stops with an error.' },
        { say: 'Its errors are named for what went wrong, like the `NameError` for a name it didn’t know.' },
      ],
      say: 'What will the robot say to `items[3]`? Type the error’s name, in quotes.',
      tag: 'you',
      done: (e) => heardAfter(e, [readB, readC], named('IndexError')),
      praise: 'Yes, an `IndexError`: there is no index 3 in a list of three, and the robot won’t guess.',
      nudge: (l) => predictMiss(l, 'IndexError', 'KeyError', 'an index', /items\s*\[/),
    },
    {
      beats: [
        { say: 'Now see it happen: type `items[3]`, and the robot stops, leaving memory as it was.' },
        { say: 'Then brackets on the left of `=`, which write into a slot instead of reading it.' },
        { say: 'No name moves: the same list changes, as in Stage 2.' },
      ],
      say: 'Type `items[3]` to see it, then `items[1] = "z"`, and watch slot 1.',
      tag: 'you',
      // The line that wrote into slot 1, whichever list `items` names by
      // then: a rebinding typed out with a `'z'` in it does not count.
      done: (e) => everBy(e, (src, s) => /^\s*items\s*\[\s*1\s*\]\s*=[^=]/.test(src) && slot(s, 'items', '1') === "'z'"),
      praise: 'Slot 1’s arrow moved to `\'z\'`, and `items` still points at the same list.',
      nudge: (l) => {
        if (errorType(l) === 'IndexError') return 'There it is, the `IndexError` you said, and memory is unchanged. Now `items[1] = "z"`.'
        if (/^\s*items\s*=/.test(l.source)) return 'That built a new list and moved the name. Write into the slot: `items[1] = "z"`.'
        return undefined
      },
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
        if (l.thought?.type === 'list' && /^\[[^,]*,[^,]*\]$/.test(l.thought.repr))
          return 'Those are the right slots. Now just count them: how many is that?'
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
      done: (e) => heard(e, readAnn),
      praise: '`30`: the robot found the key `"ann"`, not a position.',
      nudge: (l) => {
        if (errorType(l) === 'KeyError') return 'No slot has that key: remember what the robot said. The keys are `"ann"` and `"bo"`.'
        if (byHand(l, 'ages')) return 'Let the robot look it up: `ages["ann"]`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'No slot of `ages` is labelled `"cy"`: look below, only `\'ann\'` and `\'bo\'`.', focus: 'memory' },
        { say: 'A missing index was an `IndexError`, named for the index; a dictionary’s slots have keys.' },
      ],
      say: 'What will the robot say to `ages["cy"]`? Type the error’s name, in quotes.',
      tag: 'you',
      done: (e) => heardAfter(e, [readAnn], named('KeyError')),
      praise: 'Yes, a `KeyError`: no slot has the key `"cy"`, so there is nothing to hand back.',
      nudge: (l) => predictMiss(l, 'KeyError', 'IndexError', 'a key', /ages\s*\[/),
    },
    {
      beats: [
        { say: 'Now see it happen: `ages["cy"]` stops the robot, and memory stays as it was.' },
        { say: '`.get` asks more gently: for a missing key, it hands back a default you choose.' },
        { say: 'In `ages.get("cy", 0)`, the default is `0`; leave it out, and you get `None`.' },
      ],
      say: 'Type `ages["cy"]` to see it, then ask the robot for `ages.get("cy", 0)`.',
      tag: 'robot',
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '0' && from(t, /ages\s*\.\s*get\s*\(/)),
      praise: '`0`: there is no key `"cy"`, so `.get` handed back the default instead of stopping.',
      nudge: (l) => {
        if (errorType(l) === 'KeyError') return 'There it is, the `KeyError` you said. Now ask gently: `ages.get("cy", 0)`.'
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
      done: (e) => heard(e, (t) => t.type === 'bool' && t.repr === 'False' && from(t, /\b(30|25)\s+in\s+ages\b/)),
      praise: '`False`: `in` asks about keys, and `30` is only what a key points at.',
      nudge: (l) => {
        if (l.thought?.repr === 'True' && /\bin\b/.test(l.source)) return '`True`: that is a key. Now try a value: `30 in ages`.'
        if (l.thought?.repr === 'False' && /\bin\s+ages\b/.test(l.source))
          return '`False`, because that is no key of `ages`. Now try a value that is there: `30 in ages`.'
        if (byHand(l, 'ages')) return 'Let the robot answer: `30 in ages`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'A key must be something that can never change, so the dictionary can always find it again.' },
        { say: 'A list can change, so it can’t be a key; a tuple of numbers can.' },
      ],
      say: 'Try `ages[[1, 2]] = 5`, then `ages[(1, 2)] = 5`.',
      tag: 'you',
      // The line that filed it: the tuple is a key of `ages` now. The list
      // is refused with a `TypeError`, and a refused line leaves nothing.
      done: (e) => everBy(e, (src, s) => /ages\s*\[\s*\(/.test(src) && slot(s, 'ages', '(1, 2)') !== null),
      praise: 'The list was refused with a `TypeError`, because it could change; the tuple was filed as a key.',
      nudge: (l) => {
        if (errorType(l) === 'TypeError' && /\[\s*\[/.test(l.source))
          return 'Refused: a list can change, so it can’t be a key. Now the tuple: `ages[(1, 2)] = 5`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Look below: `ages` has a third key now, the tuple `(1, 2)`.', focus: 'memory' },
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
    { say: 'Now you can find Mira’s line: the one with brackets left of `=`, naming the wrong slot.' },
    { say: 'The exercises are next: find which slot each line reads, or writes.' },
  ],
  takeaway: 'Brackets pick a slot: a number counts from 0 in a list, a key finds its pair in a dictionary.',
}
