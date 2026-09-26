import { openerOf } from '../collection/story'
import { errorType, heard, sameObject, targetOf, type Evidence, type Heard, type Lesson, type Line } from './core'
import type { MemorySnapshot, PyObject } from '../../src/memory/model'
import type { Prop } from '../../src/scene/props'

/**
 * Stage 8, the ideas: crossing a function boundary, told in beats.
 *
 * This level used to be the collection's Stage 8 prose, shown whole. The
 * markdown is still the source of truth; this lesson takes its ideas, not
 * its text, and keeps what memory can show after each accepted line:
 *
 * 1. `def` builds a function object and binds a name to it, and runs
 *    nothing: memory gains the function and no parameter;
 * 2. a call binds the parameter to the argument's object, and rebinding
 *    the parameter leaves the caller's name alone — predicted before the
 *    robot runs it — in names of the call's own, gone once it returns;
 *    then the two formal words, **argument** and **parameter**, each on a
 *    beat of its own;
 * 3. changing the argument's object shows outside, and `return` hands
 *    back that same object, not a copy (Mira's problem, R12);
 * 4. a mutable default is built once, at `def`, and shared by every call
 *    that leaves it out — the graph draws it hanging off the function
 *    object (the wheel's encoder is patched to emit `defaults`), and it is
 *    predicted before it is run.
 *
 * What a console cannot show from memory is left to the exercises:
 * nothing after `return` runs, a tuple of several returns, shadowing, and
 * the body's errors found at call time (see the level's notes).
 *
 * Blocks are typed over several lines: Enter adds a line inside a block,
 * and Enter on the blank line sends it (`src/repl/program.ts`).
 *
 * Each prediction is about a function that is only in memory as a card,
 * so its code is on the stage (a `code` picture) while it is read. A
 * "let the robot check" step counts only what was done after the
 * prediction (`after`, `since`): running the call while predicting must
 * not quietly finish the check and skip the prediction's praise.
 */

/** The functions read here, drawn as written. */
const DOUBLE: Prop = { kind: 'code', text: 'def double(n):\n    n = n * 2\n    return n\n\nx = 5\ndouble(x)' }
const ADD: Prop = { kind: 'code', text: 'def add(item, items=[]):\n    items.append(item)\n    return items\n\nadd("x")\nadd("y")' }

const objectOf = (s: MemorySnapshot, name: string): PyObject | null => {
  const id = targetOf(s, name)
  return id === null ? null : (s.objects[id] ?? null)
}

const typeOf = (e: Evidence, name: string): string | null => objectOf(e.snapshot, name)?.type ?? null

/** How many items the list this name points at holds, or null. */
const itemsOf = (s: MemorySnapshot, name: string): number | null => {
  const o = objectOf(s, name)
  return o?.type === 'list' ? (o.elements?.length ?? 0) : null
}

/** The object `fn`'s first default is. */
const defaultOf = (s: MemorySnapshot, fn: string): string | null =>
  objectOf(s, fn)?.elements?.find((el) => el.label === 'default 1')?.target ?? null

/** A typed number and nothing else: a prediction, not a run. */
const predicted = (e: Evidence, n: string) =>
  heard(e, (t) => t.type === 'int' && t.repr === n && (t.source ?? '').trim() === n)

/** A thought passing `then`, thought after the first one passing `first`. */
const after = (e: Evidence, first: (t: Heard) => boolean, then: (t: Heard) => boolean): boolean => {
  const i = e.thoughts.findIndex(first)
  return i >= 0 && e.thoughts.slice(i + 1).some(then)
}

/** A typed number and nothing else. */
const typedInt = (n: string) => (t: Heard) => t.type === 'int' && t.repr === n && (t.source ?? '').trim() === n

/**
 * Some accepted line after the first one that is just `mark` typed (a
 * prediction) passes: of its source and the memory it left. The lines
 * carry every accepted line, a bare prediction included.
 */
const since = (e: Evidence, mark: string, holds: (source: string, s: MemorySnapshot) => boolean): boolean => {
  const ls = e.lines ?? []
  const i = ls.findIndex((l) => l.source.trim() === mark)
  return i >= 0 && ls.slice(i + 1).some((l) => holds(l.source, l.memory))
}

/** How many items `fn`'s default list holds, or null. */
const defaultItems = (s: MemorySnapshot, fn: string): number | null => {
  const id = defaultOf(s, fn)
  const o = id === null ? null : s.objects[id]
  return o?.type === 'list' ? (o.elements?.length ?? 0) : null
}

/**
 * Memory is the picture, and the pane holds five or six rows before it
 * scrolls. So one function does both the call and the rebinding, and the
 * shared default is read off the function's own row rather than bound to
 * two more names: every claim stays on screen at 1400x800.
 */

/** A block that did not go in: the body was not indented, most likely. */
const blockMiss = (l: Line, example: string): string | undefined => {
  const kind = errorType(l)
  if (kind === 'IndentationError' || kind === 'SyntaxError')
    return `Indent the body under the \`def\` line, four spaces in: \`${example}\`.`
  return undefined
}

export const s8Ideas: Lesson = {
  id: 's8-ideas',
  teaches: [],
  steps: [
    {
      beats: [
        { say: openerOf(8) },
        { say: 'A function is lines written now and run later, each time something calls it.' },
        { say: '`def` builds a function object and binds a name to it, and the body does not run yet.' },
        { say: '`return n` hands the object `n` points at back to the line that called the function.' },
        { say: 'A block goes in line by line: indent the body, then press Enter on a blank line.', focus: 'console' },
      ],
      say: 'Type `def double(n):`, then `n = n * 2` and `return n`, both indented under it.',
      tag: 'you',
      done: (e) => typeOf(e, 'double') === 'function',
      praise: 'One new object, a function bound to `double`, and no `n`, because nothing ran.',
      nudge: (l) => blockMiss(l, '    n = n * 2'),
    },
    {
      beats: [
        { say: '`double` names the function object, and brackets are what call it.', focus: 'memory' },
        { say: 'First, a name whose object we can hand in.' },
      ],
      say: 'Type `x = 5`.',
      tag: 'you',
      done: (e) => objectOf(e.snapshot, 'x')?.repr === '5',
    },
    {
      beats: [
        { say: 'A call runs the body, with `n` bound to the same object the brackets hand in.', show: DOUBLE },
        { say: 'Then `n = n * 2` moves the arrow of `n` to a new object.', show: DOUBLE },
        { say: 'Now read before you run: `x` points at `5`.', focus: 'memory', show: DOUBLE },
      ],
      say: 'After `double(x)`, what will `x` point at? Type just the number.',
      show: DOUBLE,
      tag: 'you',
      done: (e) => predicted(e, '5'),
      praise: 'Five: `n = n * 2` moves the arrow of `n`, and `x` is a different name.',
      nudge: (l) => {
        if (l.ok && /double/.test(l.source)) return 'Predict it first: type just the number you expect.'
        if (l.thought?.type === 'int') return 'Read it again: which name does `n = n * 2` move?'
        return undefined
      },
    },
    {
      beats: [{ say: 'Now let the robot check your prediction.', show: DOUBLE }],
      say: 'Run `double(x)`, then look at `x`.',
      show: DOUBLE,
      tag: 'robot',
      done: (e) => after(e, typedInt('5'), (t) => /^\s*double\s*\(\s*x\s*\)\s*$/.test(t.source ?? '')),
      praise: 'The robot thought of `10`, `x` still points at `5`, and there is no `n`: it left with the call.',
      nudge: (l) => (/=\s*double/.test(l.source) ? 'Just call it, binding nothing: `double(x)`.' : undefined),
    },
    {
      beats: [
        { say: 'The call bound `n` to the same `5`, in a fresh set of names all its own.' },
        { say: 'For the object a call hands in, the formal word is **argument**.' },
        { say: 'For a name in the brackets of the `def` line, the formal word is **parameter**.' },
        { say: 'Now Mira’s problem: a function that changes the object it is handed.' },
        { say: 'This one has a default too: `items=[]` is used when a call leaves `items` out.' },
      ],
      say: 'Type `def add(item, items=[]):`, then `items.append(item)` and `return items` under it.',
      tag: 'you',
      done: (e) => typeOf(e, 'add') === 'function' && defaultItems(e.snapshot, 'add') !== null,
      praise: 'There is `add`, and its default list is already there, because `def` built it.',
      nudge: (l) => blockMiss(l, '    items.append(item)'),
    },
    {
      beats: [
        { say: 'Look below: the default list hangs off the function object itself.', focus: 'memory' },
        { say: 'First, hand `add` a list of Mira’s own.' },
      ],
      say: 'Type `things = ["a"]`, then `same = add("b", things)`.',
      tag: 'you',
      done: (e) => sameObject(e.snapshot, 'same', 'things') && (itemsOf(e.snapshot, 'things') ?? 0) >= 2,
      praise: '`things` changed too, because `items` was bound to Mira’s list itself, not a copy.',
      nudge: (l) => {
        if (l.thought && /add\s*\(/.test(l.source)) return 'Bind what comes back: `same = add("b", things)`.'
        if (/^\s*things\s*=/.test(l.source)) return 'Now hand it over: `same = add("b", things)`.'
        if (errorType(l) === 'NameError') return 'Make the list first: `things = ["a"]`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'And `same` points at that very list: `return` hands back the object itself.', focus: 'memory' },
        { say: 'Now leave `items` out, so each call uses the default list.', show: ADD },
        { say: 'Read before you run: that default was built once, when `def` ran.', show: ADD },
      ],
      say: 'After `add("x")`, then `add("y")`, how many items will the default list hold? Type the number.',
      show: ADD,
      tag: 'you',
      done: (e) => predicted(e, '2'),
      praise: 'Two: both calls append to the one default list, because it was built once.',
      nudge: (l) => {
        if (l.ok && /add/.test(l.source)) return 'Predict it first: type just the number you expect.'
        if (l.thought?.type === 'int') return 'Read it again: `items=[]` ran once, at `def`, not on every call.'
        return undefined
      },
    },
    {
      beats: [{ say: 'Now let the robot check, and watch the list on `add`.', focus: 'memory', show: ADD }],
      say: 'Type `add("x")`, then `add("y")`.',
      show: ADD,
      tag: 'robot',
      // The second call, after the prediction: a call made while predicting
      // stays in the list, so only `add("y")` since then, with two or more
      // items on the default, is the check.
      done: (e) =>
        since(e, '2', (src, s) => /^\s*add\s*\(\s*["']y["']\s*\)\s*$/.test(src) && (defaultItems(s, 'add') ?? 0) >= 2),
      praise: 'Every call that left `items` out landed in the one default list, built once, at `def`.',
      nudge: (l) => (/^\s*add\s*\(\s*["']x["']\s*\)\s*$/.test(l.source) ? 'Now the second call: `add("y")`.' : undefined),
    },
  ],
  outro: [
    { say: 'Mira’s list came back changed because the function was handed her list itself.' },
    { say: 'A call binds its parameters to the arguments’ objects, in names of its own that leave when it returns.' },
    { say: 'The exercises are next: follow each call in, and back out.' },
  ],
  takeaway:
    'The object is shared and the name is not: a function can change the object it is handed, but rebinding its parameter never moves the caller’s name.',
}
