import { ever, heard, points, targetOf, type Evidence, type Lesson, type LessonStep, type Line } from './core'
import type { MemorySnapshot } from '../../src/memory/model'

/**
 * Stage 6, the ideas: what a `for` loop is handed, told in beats.
 *
 * This level was the collection's Stage 6 prose, shown whole. The
 * markdown is still the source of truth; this lesson takes its ideas, not
 * its text, and keeps what Stage 6 adds:
 *
 * 1. a dict hands a loop its **keys** (Mira's bug, predicted before it
 *    runs), and `.items()` hands it pairs, which `for k, v` unpacks;
 * 2. a list comprehension builds a new list in one line;
 * 3. a generator holds no items and is used up after one walk;
 * 4. a string hands over characters, and `enumerate` pairs each with its
 *    position; `zip` and a set's order are told, not asked (a set's order
 *    is not the player's to rely on, so nothing may be judged on it);
 * 5. the formal words, each on its own beat just after the player did
 *    the thing it names: binding, iterable, loop variable, block, control
 *    flow. From its beat on, the lesson uses the word.
 *
 * Memory is the picture (R6): each loop leaves what it was handed in a
 * list, so the effect of a pass survives the line, and the beat after it
 * points at it. A block is one accepted line, so memory is seen only once
 * the loop has finished — which is why every loop here collects.
 */

/**
 * What a name's object looks like, written the way Python would write
 * it, from memory's pointers. Memory gives a list's repr as "2 items", so
 * a step compares this instead. Lists, tuples and values only: enough for
 * what this lesson builds.
 */
function shapeOf(s: MemorySnapshot, id: string, depth = 0): string | null {
  const o = s.objects[id]
  if (!o || depth > 4) return null
  if (o.kind === 'value') return o.repr
  if (o.type !== 'list' && o.type !== 'tuple') return null
  const parts = (o.elements ?? []).map((e) => shapeOf(s, e.target, depth + 1))
  if (parts.some((p) => p === null)) return null
  return o.type === 'list' ? `[${parts.join(', ')}]` : `(${parts.join(', ')})`
}

const shape = (s: MemorySnapshot, name: string): string | null => {
  const id = targetOf(s, name)
  return id === null ? null : shapeOf(s, id)
}

const typeOf = (s: MemorySnapshot, name: string): string | null => {
  const id = targetOf(s, name)
  return id === null ? null : (s.objects[id]?.type ?? null)
}

/** `prices` is Mira's price list: `"tea"` at 3, `"jam"` at 5. */
const priceList = (s: MemorySnapshot): boolean => {
  const id = targetOf(s, 'prices')
  const o = id === null ? undefined : s.objects[id]
  if (o?.type !== 'dict') return false
  const at = (key: string) => {
    const e = o.elements?.find((x) => x.label === key)
    return e ? s.objects[e.target]?.repr : undefined
  }
  return o.elements?.length === 2 && at("'tea'") === '3' && at("'jam'") === '5'
}

/**
 * `got` was appended to by the loop: the same list object that was bound
 * empty now ends with both keys. Rebinding `got` to a list typed out by
 * hand makes a different object, so it does not count.
 */
const collectedKeys = (e: Evidence): boolean => {
  const start = e.history.find((s) => typeOf(s, 'got') === 'list' && shape(s, 'got') === '[]')
  const id = start ? targetOf(start, 'got') : null
  return (
    id !== null &&
    e.history.some((s) => targetOf(s, 'got') === id && (shape(s, 'got') ?? '').endsWith("'tea', 'jam']"))
  )
}

/** A literal typed as a prediction: square brackets and no names outside
 *  the quotes, so the robot worked nothing out. */
const literalList = (source: string): boolean => {
  const t = source.trim()
  const bare = t.replace(/"[^"]*"|'[^']*'/g, '')
  return /^\[.*\]$/s.test(t) && !/[A-Za-z_]/.test(bare)
}

const errorIs = (l: Line, kind: string) => !l.ok && (l.error ?? '').startsWith(kind)

/** The usual ways a block goes wrong in the console. */
const blockMiss = (l: Line, body: string): string | undefined => {
  if (errorIs(l, 'IndentationError')) return `Put four spaces before \`${body}\`, so it belongs to the loop.`
  if (errorIs(l, 'SyntaxError') && /^\s*for\b/.test(l.source) && !/:/.test(l.source.split('\n')[0]!)) {
    return 'The `for` line ends with a colon.'
  }
  return undefined
}

/**
 * From the loop on, the robot's cloud is cleared while a beat talks: the
 * last thing it thought is the player's prediction, and a guess of
 * `[3, 5]` floating over a memory full of keys would argue with it.
 */
const letGo = (steps: LessonStep[], from: number): LessonStep[] =>
  steps.map((s, i) => (i < from || !s.beats ? s : { ...s, beats: s.beats.map((b) => ({ thought: '', ...b })) }))

export const s6Ideas: Lesson = {
  id: 's6-ideas',
  teaches: [],
  steps: letGo([
    {
      beats: [
        { say: 'Mira looped over her price list and got the names of things back, not the prices.' },
        { say: 'A `for` loop can walk more than a list, and what each pass hands over depends on what it walks.' },
        { say: 'The formal words arrive here too, as names for things you already do.' },
        { say: 'First, Mira\'s price list: a dict, with each price under its name.', focus: 'console' },
      ],
      say: 'Type `prices = {"tea": 3, "jam": 5}`.',
      tag: 'you',
      done: (e) => ever(e, priceList),
      praise: 'One dict, holding two prices: `3` filed under `"tea"`, and `5` under `"jam"`.',
      nudge: (l) =>
        errorIs(l, 'SyntaxError') ? 'Copy it exactly: curly brackets, and a colon between each key and its price.' : undefined,
    },
    {
      beats: [
        { say: 'Look below: `prices` points at one dict, and the dict points at its prices, `3` and `5`.', focus: 'memory' },
        { say: 'Click the dict card to see the key each arrow is filed under, then click it again to let go.', focus: 'memory' },
        { say: 'You\'ve been saying *a name pointing at an object*. The formal word is **binding**.' },
        { say: 'Mira\'s loop collects what it is handed, so first it needs an empty list.' },
      ],
      say: 'Type `got = []`.',
      tag: 'you',
      done: (e) => ever(e, (s) => typeOf(s, 'got') === 'list' && shape(s, 'got') === '[]'),
      praise: 'An empty list, and a new binding: `got` to it.',
    },
    {
      beats: [
        { say: 'Here is Mira\'s loop: `for x in prices:`, and under it, indented, `got.append(x)`.' },
        { say: 'Read it before it runs: each pass adds to `got` whatever `x` is bound to.' },
      ],
      say: 'What will `got` hold after the loop? Type the list you expect.',
      tag: 'you',
      done: (e) => heard(e, (t) => t.type === 'list' && literalList(t.source ?? '')),
      praise: (a) => `\`${a?.repr ?? 'That'}\`, you say. Now let the robot run it, and check.`,
      nudge: (l) => {
        // A statement line has no thought: `got = []`, which did the step
        // before, must not be answered as a miss of this one.
        if ((l.thought && /\b(prices|got)\b/.test(l.source)) || /^\s*for\b/.test(l.source)) return 'Predict it first: type the list itself, in square brackets.'
        if (errorIs(l, 'NameError')) return 'Words need their quotes inside a list too, like `"tea"`.'
        if (l.thought && l.thought.type !== 'list') return 'Type a list, in square brackets: what you expect `got` to hold.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'In the console, a block ends when you press Enter on an empty line.', thought: '' },
      ],
      say: 'Type `for x in prices:`, then four spaces and `got.append(x)`, then Enter on an empty line.',
      tag: 'you',
      done: collectedKeys,
      praise: 'The keys, not the prices: a `for` over a dict is handed each key, in the order they went in.',
      nudge: (l) => blockMiss(l, 'got.append(x)'),
    },
    {
      beats: [
        { say: 'Look below: `got` holds both keys, and `x` is still bound to the last one, `"jam"`.', focus: 'memory' },
        { say: 'You\'ve been saying *the thing being looped over*. The formal word is **iterable**.' },
        { say: 'You\'ve been saying *the name the `for` line rebinds*. The formal word is **loop variable**.' },
        { say: 'To get the prices as well, ask the dict for its pairs: `prices.items()`.' },
        { say: 'Rebind `got` to them, and the list of keys, with nothing bound to it, is let go.' },
        { say: '`list()` walks any iterable and keeps what it is handed, so you can see it.' },
      ],
      say: 'Type `got = list(prices.items())`.',
      tag: 'you',
      done: (e) => ever(e, (s) => shape(s, 'got') === "[('tea', 3), ('jam', 5)]"),
      praise: 'Two tuples, because `.items()` hands over each key together with its price.',
    },
    {
      beats: [
        { say: 'Look below: each tuple holds a key and its price, side by side.', focus: 'memory' },
        { say: '`for k, v in` unpacks each pair, so every pass has two loop variables: `k` and `v`.' },
        { say: 'Mira wants her total, so start at `0` and add each price, `v`.' },
      ],
      say: 'Type `total = 0`, then `for k, v in prices.items():` and four spaces and `total = total + v`.',
      tag: 'you',
      // The loop did it, not `total = 8`: the loop variables are left bound
      // to the last pair.
      done: (e) =>
        ever(e, (s) => points(s, 'total', '0')) &&
        ever(e, (s) => points(s, 'total', '8') && points(s, 'k', "'jam'") && points(s, 'v', '5')),
      praise: '`8`: `v` was bound to each price in turn, so both were added. That is Mira\'s fix.',
      nudge: (l) => {
        if (errorIs(l, 'TypeError') && /\+\s*k\b/.test(l.source)) return '`k` is the key, a `str`: add the price, `v`.'
        if (l.ok && /^\s*total\s*=\s*0\s*$/.test(l.source)) {
          return 'Now the loop: `for k, v in prices.items():`, then four spaces and `total = total + v`.'
        }
        return blockMiss(l, 'total = total + v')
      },
    },
    {
      beats: [
        { say: 'You\'ve been saying *indented lines belonging together*. The formal word is **block**.' },
        { say: 'You\'ve been saying *the order in which lines run*. The formal word is **control flow**.' },
        { say: 'Control flow went back to the `for` line after each pass, so the block ran twice.' },
        { say: 'A loop that builds a list can be one line: a **list comprehension**, in square brackets.' },
        { say: '`[k for k, v in prices.items() if v < 4]` keeps each `k` whose price `v` is under `4`.' },
      ],
      say: 'Type `cheap = [k for k, v in prices.items() if v < 4]`.',
      tag: 'you',
      done: (e) => ever(e, (s) => shape(s, 'cheap') === "['tea']"),
      praise: 'Only `"tea"`, because its price, `3`, is the one under `4`.',
    },
    {
      beats: [
        { say: 'Look below: `cheap` is a brand new list, with one item in it.', focus: 'memory' },
        { say: 'Round brackets instead of square ones make a **generator**, not a list.' },
        { say: 'A generator holds no items: it works out each one when asked, and only once.' },
      ],
      say: 'Type `squares = (n * n for n in range(3))`.',
      tag: 'you',
      done: (e) => ever(e, (s) => typeOf(s, 'squares') === 'generator'),
      praise: 'A generator card with nothing inside, because no value has been worked out yet.',
      nudge: (l) => (/^\s*squares\s*=\s*\[/.test(l.source) ? 'Round brackets, not square: `(n * n for n in range(3))`.' : undefined),
    },
    {
      beats: [
        { say: '`list()` asks a generator for every value it has left.' },
        { say: 'Walk it once, then walk it again, and watch the second list.' },
      ],
      say: 'Type `first = list(squares)`, then `again = list(squares)`.',
      tag: 'you',
      done: (e) => ever(e, (s) => shape(s, 'first') === '[0, 1, 4]' && shape(s, 'again') === '[]'),
      praise: '`again` is empty, because the first walk used the generator up.',
      nudge: (l) => (/^\s*first\s*=/.test(l.source) ? 'Now walk it again: `again = list(squares)`.' : undefined),
    },
    {
      beats: [
        { say: 'Look below: `first` holds `0`, `1` and `4`, and `again` holds nothing.', focus: 'memory' },
        { say: 'The generator is **exhausted**. A list or a `range` can be walked again; a generator can\'t.' },
        { say: 'A string is an iterable too: it hands over one character at a time.' },
        { say: '`enumerate` pairs each thing it is handed with its position, counting from `0`.' },
      ],
      say: 'Type `nums = list(enumerate("tea"))`.',
      tag: 'you',
      done: (e) => ever(e, (s) => shape(s, 'nums') === "[(0, 't'), (1, 'e'), (2, 'a')]"),
      praise: 'Three tuples, because `enumerate` hands over each character with its position.',
    },
  ], 3),
  outro: [
    { say: "`zip` pairs two iterables in step: `list(zip('ab', [3, 5]))` is `[('a', 3), ('b', 5)]`.", thought: '' },
    { say: 'A set is an iterable too, but it hands its items over in no order you can rely on.', thought: '' },
    { say: 'Now you can say what a loop is handed, whatever it walks, before the robot runs it.', thought: '' },
  ],
  takeaway:
    'A for loop is handed whatever its iterable gives out: keys from a dict, pairs from .items(), and from a generator, only one walk.',
}
