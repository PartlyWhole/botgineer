import { openerOf } from '../collection/story'
import { ever, heard, targetOf, type Heard, type Lesson, type Line } from './core'
import type { MemorySnapshot, ObjectId } from '../../src/memory/model'

/**
 * Stage 4, the ideas: sharing and copies, told in beats.
 *
 * This level used to be the collection's Stage 4 prose, shown whole. The
 * markdown is still the source of truth; this lesson takes its ideas, not
 * its text, and keeps only what Stage 4 adds:
 *
 * 1. a list of lists holds arrows to its inner lists (Mira's seating plan:
 *    a list of tables);
 * 2. `plan[:]` copies one level — a new outer list whose arrows meet at
 *    the same tables — so adding a table to the copy leaves `plan` alone
 *    (predicted), and seating someone at a shared table does not
 *    (predicted);
 * 3. `copy.deepcopy` copies every level, and the strings it leaves shared
 *    are safe to share because a str cannot be changed;
 * 4. `[[0] * 3] * 3` is one row, three arrows to it (predicted);
 * 5. the question to ask: did I copy at all, and which level?
 *
 * `b = a` sharing, `[:]` building a new list (Stage 3) and `append`
 * changing an object (Stage 2) are taught already, so each gets a line at
 * most. The picture is the memory graph (R6): arrows converging on one
 * card is the whole stage, and the beat after each one points at it.
 *
 * Memory draws a list's card as "2 items", so a step reads a list's value
 * by following its arrows (`valueOf`), never from its card.
 */

/** A list's value, written as Python writes it, by following its arrows. */
const valueOf = (s: MemorySnapshot, id: ObjectId | null, depth = 0): string | null => {
  if (id === null || depth > 4) return null
  const o = s.objects[id]
  if (!o) return null
  if (o.type !== 'list' || o.elements === null) return o.repr
  const parts = o.elements.map((e) => valueOf(s, e.target, depth + 1))
  return parts.includes(null) ? null : `[${parts.join(', ')}]`
}

const valueAt = (s: MemorySnapshot, name: string) => valueOf(s, targetOf(s, name))

/** The objects a list's slots point at, in order, or null if not a list. */
const slots = (s: MemorySnapshot, name: string): ObjectId[] | null => {
  const id = targetOf(s, name)
  const o = id === null ? undefined : s.objects[id]
  return o?.type === 'list' && o.elements ? o.elements.map((e) => e.target) : null
}

const slot = (s: MemorySnapshot, name: string, i: number): ObjectId | null => slots(s, name)?.[i] ?? null

const PLAN = "[['Ann'], ['Bo']]"

/** `new` is its own outer list, and its first two slots lead where `plan`'s do. */
const shallow = (s: MemorySnapshot): boolean => {
  const p = slots(s, 'plan')
  const n = slots(s, 'new')
  return (
    p !== null && n !== null && p.length === 2 && n.length >= 2 &&
    targetOf(s, 'new') !== targetOf(s, 'plan') && p[0] === n[0] && p[1] === n[1]
  )
}

/** A typed list, with no name in it: a prediction, not the robot's working. */
const predicted = (repr: string) => (t: Heard) => {
  const source = (t.source ?? '').trim()
  const outsideQuotes = source.replace(/"[^"]*"|'[^']*'/g, '')
  return t.type === 'list' && t.repr === repr && source.startsWith('[') && !/[A-Za-z_]/.test(outsideQuotes)
}

/**
 * The robot read memory for you: a bare expression that used one of these
 * names and came back with a value. Only such a line — never the line
 * that finished the step before, which is still `last` when the question
 * arrives, nor a method call that hands back `None`.
 */
const usesName = (l: Line, ...names: string[]) =>
  l.ok && l.thought !== null && l.thought.type !== 'NoneType' &&
  names.some((n) => new RegExp(`\\b${n}\\b`).test(l.source))

export const s4Ideas: Lesson = {
  id: 's4-ideas',
  teaches: [],
  steps: [
    {
      beats: [
        { say: openerOf(4) },
        { say: 'Her plan is a list of tables, and each table is a list of guests.' },
        { say: 'Build it, and we\'ll follow the arrows.', focus: 'console' },
      ],
      say: 'Type `plan = [["Ann"], ["Bo"]]`.',
      tag: 'you',
      done: (e) => ever(e, (s) => valueAt(s, 'plan') === PLAN),
      praise: 'One outer list, and its two slots are arrows to two tables.',
      nudge: (l) =>
        l.error?.startsWith('NameError')
          ? 'Each guest\'s name needs quotes: `"Ann"`.'
          : l.error?.startsWith('SyntaxError')
            ? 'Check the brackets: two tables, each in `[ ]`, inside one pair of `[ ]`.'
            : undefined,
    },
    {
      beats: [
        { say: 'Look below: the outer list holds arrows, and each arrow leads to a table.', focus: 'memory' },
        { say: '`new = plan` would only copy the arrow to `plan`, as you saw in Stage 1.' },
        { say: '`plan[:]` builds a new outer list, as Stage 3 said.' },
      ],
      say: 'Type `new = plan[:]`, and watch where its arrows go.',
      tag: 'you',
      done: (e) => ever(e, shallow),
      praise: 'Two outer lists now, because `[:]` built a new one.',
      nudge: (l) =>
        /^\s*new\s*=\s*plan\s*$/.test(l.source) ? 'That shares `plan`\'s list. Add `[:]` to build a new one: `new = plan[:]`.' : undefined,
    },
    {
      beats: [
        { say: 'Follow the arrows: both outer lists point at the same two tables.', focus: 'memory' },
        { say: 'So `[:]` copies one level: the outer list, and not the tables inside it.' },
        { say: 'Mira adds a table to her copy: `new.append(["Ed"])`.' },
      ],
      say: 'Before it runs, how many tables will `plan` have? Type just the number.',
      tag: 'you',
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '2' && (t.source ?? '').trim() === '2'),
      praise: 'Two: `append` changes the outer list it is asked of, and that is `new`\'s alone.',
      nudge: (l) => {
        if (usesName(l, 'plan', 'new', 'len')) return 'Predict it first: type just the number you expect.'
        if (l.thought?.repr === '3') return 'Read the arrows again: `new` and `plan` are two outer lists.'
        return undefined
      },
    },
    {
      beats: [{ say: 'Now let the robot check your prediction.' }],
      say: 'Type `new.append(["Ed"])`.',
      tag: 'you',
      done: (e) => ever(e, (s) => shallow(s) && (slots(s, 'new')?.length ?? 0) === 3),
      praise: '`new` has three tables and `plan` still has two, because the outer lists are separate.',
    },
    {
      beats: [
        { say: 'Now Mira seats Flo at the first table of her copy: `new[0].append("Flo")`.' },
        { say: '`new[0]` follows `new`\'s first arrow, to a table.', focus: 'memory' },
      ],
      say: 'Before it runs, what will `plan[0]` be? Type the list you expect.',
      tag: 'you',
      done: (e) => heard(e, predicted("['Ann', 'Flo']")),
      praise: 'Yes: `new[0]` and `plan[0]` are arrows to one table, so both see Flo.',
      nudge: (l) => {
        if (usesName(l, 'plan', 'new')) return 'Predict it first: type the list you expect, in `[ ]`.'
        if (l.thought?.repr === "['Ann']") return 'Follow the arrows: `new[0]` and `plan[0]` lead to the same table.'
        if (l.error?.startsWith('NameError')) return 'Names need quotes inside the list: `"Flo"`.'
        return undefined
      },
    },
    {
      beats: [{ say: 'Let the robot check it.' }],
      say: 'Type `new[0].append("Flo")`, and watch the first table.',
      tag: 'you',
      done: (e) => ever(e, (s) => valueOf(s, slot(s, 'plan', 0)) === "['Ann', 'Flo']"),
      praise: '`plan` changed too, because the table was shared: that is what happened to Mira.',
    },
    {
      beats: [
        { say: 'To copy every level, Python has `deepcopy`, kept in a module called `copy`.' },
        { say: '`import copy` brings the module in, under the name `copy`.' },
      ],
      say: 'Type `import copy`, then `safe = copy.deepcopy(plan)`.',
      tag: 'you',
      done: (e) =>
        ever(e, (s) => {
          const p = slots(s, 'plan')
          const d = slots(s, 'safe')
          return (
            p !== null && d !== null && p.length === d.length && targetOf(s, 'safe') !== targetOf(s, 'plan') &&
            valueAt(s, 'safe') === valueAt(s, 'plan') && d.every((t, i) => t !== p[i])
          )
        }),
      praise: '`safe` has its own outer list and its own tables, because `deepcopy` copies every level.',
      nudge: (l) => {
        if (l.error?.startsWith('NameError') && /copy\./.test(l.source)) return 'Bring the module in first: `import copy`.'
        if (l.ok && /^\s*import\s+copy\s*$/.test(l.source)) return 'Now make the copy: `safe = copy.deepcopy(plan)`.'
        return undefined
      },
    },
    {
      beats: [
        { say: 'Look: no arrow from `safe` reaches a table of `plan`\'s.', focus: 'memory' },
        { say: 'The guests\' names are still shared, but a str can\'t be changed, so that is safe.' },
        { say: 'Copying every level costs time and memory, so use it when you need it, not by habit.' },
        { say: 'Now a trap: `*` on a list repeats its arrows, not the objects they lead to.' },
      ],
      say: 'Build a grid of three rows: `grid = [[0] * 3] * 3`.',
      tag: 'you',
      done: (e) =>
        ever(e, (s) => {
          const g = slots(s, 'grid')
          return g !== null && g.length === 3 && g.every((t) => t === g[0]) && valueAt(s, 'grid') === '[[0, 0, 0], [0, 0, 0], [0, 0, 0]]'
        }),
      praise: 'Printed, it would look like three rows; memory holds one, because `* 3` repeated the arrow.',
    },
    {
      beats: [
        { say: 'Look below: `grid` holds three arrows, and there is only one row card for them to reach.', focus: 'memory' },
        { say: 'Mira writes a 1 at the start of the first row: `grid[0][0] = 1`.' },
      ],
      say: 'Before it runs, what will `grid[1]` be? Type the list you expect.',
      tag: 'you',
      done: (e) => heard(e, predicted('[1, 0, 0]')),
      praise: 'Yes: `grid[1]` is the same row as `grid[0]`, so it has the 1 as well.',
      nudge: (l) => {
        if (usesName(l, 'grid')) return 'Predict it first: type the list you expect, in `[ ]`.'
        if (l.thought?.repr === '[0, 0, 0]') return 'Follow the arrows: `grid[0]` and `grid[1]` lead to one row.'
        return undefined
      },
    },
    {
      beats: [{ say: 'Let the robot check it.' }],
      say: 'Type `grid[0][0] = 1`, and watch the one row.',
      tag: 'you',
      done: (e) => ever(e, (s) => valueOf(s, slot(s, 'grid', 1)) === '[1, 0, 0]'),
      praise: '`grid[1]` has the 1 too, because all three slots lead to that one row.',
    },
  ],
  outro: [
    { say: 'For three real rows, write `[0] * 3` three times over, so each one builds its own list.' },
    { say: 'When a change shows up somewhere else, ask: did I copy at all, and which level did I copy?' },
    { say: 'The exercises are next: draw the arrows, and say which level each copy made new.' },
  ],
  takeaway: 'A copy makes some levels new and shares the rest, so ask which level was copied before you blame it.',
}
