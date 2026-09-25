/**
 * What the crow says in the reading stages. Pure, so it can be read and
 * tested as text.
 *
 * The language policy lives here (README §7): Stages 1–5 say "a name
 * pointing at an object", "change the list", "the lines inside the loop";
 * from Stage 6 the formal words — binding, iterable, loop variable,
 * parameter — are labels for ideas the player already has. Each formal
 * word is *earned*: it is named once, on a beat of its own, in the ideas
 * where it arrives (`ideaBeats`), and only then used.
 *
 * Every line is one sentence of at most 20 words (docs/PEDAGOGY.md R2),
 * and says what to do rather than how hard it is. One kind of line is two:
 * Stage 6's "You've been saying *…*. The formal word is **…**.", which
 * is the spec's own wording (§6) — the pause between the idea and its
 * word is the point. `tests/unit/reading.test.ts` counts words and
 * sentences, and holds every formal word out of the lines said before
 * its beat.
 *
 * Three kinds of line:
 *
 * - **Tasks and verdicts**, during an exercise: what to do with this
 *   form, and after the commit, right or which kind of mistake.
 * - **The ideas, told in beats** (`ideaBeats`): a stage's reading, one
 *   paragraph a beat. The crow opens on Mira's problem (R12), names each
 *   idea as it arrives, and at Stage 6 and 8 gives each formal word its
 *   own labelled beat. The paragraphs themselves stay the collection's,
 *   on the sheet, in its own words (invariant 21): the crow never
 *   paraphrases them, because a second wording would be a second source.
 * - **What changed in memory** (`memoryNote`), when an example runs:
 *   the crow points at it, read from the same snapshot memory draws.
 */
import type { MemorySnapshot, PyObject } from '../memory/model'
import { ERROR_NAMES, type Block, type ErrorType, type Form, type Stage } from './model'
import { BRIDGE, STAGE_1_LEAD, openerOf } from '../../content/collection/story'

export type Vocabulary = 'plain' | 'formal'

// `block` has a plain line that says "block": the collection names it at
// Stage 5.1 (the glossary's "first met"), which is before any block task.
const TASK: Record<Form, [plain: string, formal: string]> = {
  predict: ['Read it and write down what it prints, and I’ll run it once you commit.', 'Predict the output, and the interpreter runs it once you commit.'],
  compare: ['Say what each of these two prints, and the first line where they part ways.', 'Predict both, and name the first line where their control flow or bindings diverge.'],
  fix: ['Something here doesn’t do what was meant, so first say what it actually does.', 'There is a defect: say what the code actually does, then repair it minimally.'],
  order: ['Number the lines in the order Python reaches them, twice for a line it reaches twice.', 'Number the control flow: every visit to every line, in order.'],
  table: ['Fill in the table, one row for each pass through the loop.', 'Build the trace table, one row per iteration.'],
  block: ['Which lines are inside the block, and how many times does each one run?', 'Mark the block by its indentation, and count how many times each line runs.'],
  draw: ['Which picture shows the names, and the objects they point at?', 'Which diagram shows the bindings, and the objects they are bound to?'],
  write: ['Your turn to write it, and the robot will check it does what was asked.', 'Write the program, and the robot runs it to check the behaviour asked for.'],
  label: ['Say what each piece of the line does.', 'Label each piece of the line with its role.'],
  rule: ['Put the rule in your own words, then check it against the key.', 'State the rule in your own words, then mark yourself against the key.'],
}

export const taskLine = (form: Form, v: Vocabulary): string => TASK[form][v === 'plain' ? 0 : 1]

/** Every task line, for the tests that count words. */
export const TASK_LINES: readonly string[] = Object.values(TASK).flat()

export const CHECKPOINT_LINE = 'A checkpoint: nothing new, just what you know, and only first answers count.'

/** After committing: right, or which kind of mistake, and where to look. */
export function verdictLine(right: boolean, err: ErrorType | null, goBack: string[], soft = false): string {
  if (right) return 'Right, and read the key anyway, because the reasoning is the point.'
  if (soft) return 'The idea is right and only the word is off, which is the cheapest mistake there is.'
  const kind = err ? `${article(ERROR_NAMES[err])} ${ERROR_NAMES[err].toLowerCase()} mistake` : 'a miss'
  const back = goBack.length ? `, and the key sends you back to ${goBack.join(' and ')}` : ''
  return `Not quite: that’s ${kind}${back}.`
}

const article = (w: string) => (/^[AEIOU]/i.test(w) ? 'an' : 'a')

/** Said before a repair or a program is owed, after the predictions: the
 *  lead and the line make one sentence (`actLine`). */
export const ACT_LEAD = { right: 'Right so far, and ', wrong: 'Not quite, and the key says why, but ' } as const

export const ACT_LINE: Record<'fix' | 'write', string> = {
  fix: 'now make the smallest repair that works and send it to the robot.',
  write: 'now write it, and send it to the robot when it’s ready.',
}

/** The act line, after a lead or on its own. */
export const actLine = (kind: 'fix' | 'write', lead: keyof typeof ACT_LEAD | null): string =>
  lead ? ACT_LEAD[lead] + ACT_LINE[kind] : ACT_LINE[kind][0]!.toUpperCase() + ACT_LINE[kind].slice(1)

export const RULE_LINE = 'Now read the key’s rule, and mark yours honestly.'

export function doneLine(right: number, of: number, kind: 'set' | 'checkpoint' | 'review' | 'capstone' | 'practice', passed?: boolean): string {
  if (kind === 'checkpoint') {
    return passed
      ? `Checkpoint passed with ${right} of ${of} right first time, so the stage is yours.`
      : `${right} of ${of} right first time isn’t a pass yet, so there’s a short review on the map first.`
  }
  if (kind === 'review') return 'Review done, and the checkpoint is open again.'
  if (kind === 'capstone') return `Capstone done with ${right} of ${of} right first time: you can read a real program now.`
  return `Done: ${right} of ${of} right first time, and each one counts towards your concepts.`
}

/* -------------------------------- the ideas -------------------------------- */

/**
 * Where a beat has got to on the sheet: a section (0 is the stage's
 * opening, 1…n its ideas, n + 1 the capstone's introduction), a block in
 * it, and for a table told row by row, the row. Everything before it is
 * on the sheet; nothing after it is yet.
 */
export type Reach = { section: number; block: number; row?: number }

export type IdeaBeat = {
  /** The crow's line (R2). Several beats in a row may share one: the
   *  paragraphs of one idea are read under the line that named it. */
  say: string
  /** What this beat puts on the sheet; null for a line that adds none. */
  at: Reach | null
  /** A formal word this beat names. It is shown as a label from this beat
   *  on ("vocabulary is earned", docs/PEDAGOGY.md §2). */
  term?: string
  /** The last beat: the stage's reading is done. */
  end?: boolean
}

/**
 * The formal words, each on a labelled beat of its own. Stage 6's ideas
 * open with the collection's table of them; each row is told on its own
 * beat, in the words of the glossary's left-hand column, and the word
 * becomes a label. Keyed by the term as the table bolds it.
 */
const FORMAL_WORDS: Record<string, string> = {
  binding: 'You’ve been saying *a name pointing at an object*. The formal word is **binding**.',
  iterable: 'You’ve been saying *the thing being looped over*. The formal word is **iterable**.',
  'loop variable': 'You’ve been saying *the name the loop rebinds*. The formal word is **loop variable**.',
  'control flow': 'You’ve been saying *the order in which lines run*. The formal word is **control flow**.',
  mutable: 'You’ve been saying *changeable* and *unchangeable*. The words are **mutable** and **immutable**.',
  hashable: 'You’ve been saying *may be a dictionary key or set item*. The formal word is **hashable**.',
}

/**
 * The table's rows with no "You've been saying" of their own: `block` is
 * the collection's word from Stage 5.1 on, and the crow has said it all
 * through Stage 5, so claiming it as new here would be untrue. Its row is
 * still told on a beat, as the one word already earned.
 */
const KNOWN_WORDS: Record<string, string> = {
  block: 'One you have already: indented lines that belong together are a **block**, as in Stage 5.',
}

/** Said over the table's first beat, before any word is named. */
const FORMAL_OPEN = 'Nothing new to learn here: just the formal names for ideas you already have.'

/** Said over the paragraphs after the table. */
const FORMAL_AFTER = 'Same ideas, new words, and you’ll hear me use them from now on.'

/**
 * Stage 8's two, which have nothing to have been called before: the
 * player has never written a function of their own. So they are shown
 * first, on the idea's own example (`double(x)`), and then named — told
 * after the example's beat, before the paragraph that uses both words.
 * Each is two beats, the thing and then its word (R2: one idea a beat),
 * and the idea is introduced without either word (`CALL_INTRO`) while
 * its heading, which has both, waits for them (`heldTitle`).
 */
const CALL_WORDS: { term?: string; say: string }[] = [
  { say: 'The call `double(x)` sends in the object `x` points at: the number 5.' },
  { term: 'arguments', say: 'What a call sends in is its **argument**.' },
  { say: 'Inside, `n` is the name that receives that same object.' },
  { term: 'parameters', say: 'A name in the brackets of the `def` line is a **parameter**.' },
]

/** Stage 8's calling idea, introduced before its two words exist. */
const CALL_INTRO = 'Next: what happens when you call a function.'

/** Said over the paragraphs after the two words are named. */
const CALL_AFTER = 'Here is the whole call, step by step, in those two words.'

const EXAMPLE_INVITE = 'Every example can run: press Run this, and memory draws what it builds.'

export const IDEAS_CLOSE = 'That’s the idea, and next you read programs that use it and say what they do first.'

/** Stage 9's capstone: introduced here, met at the end of the stage. */
const CAPSTONE_LINE = 'Last, the capstone, which you’ll meet at the end of this stage.'

/** An idea's title as the crow says it: "Next: rebinding moves the label." */
function introduce(title: string, k: number, of: number): string {
  const t = /^[A-Z]([a-z]|\s)/.test(title) ? title[0]!.toLowerCase() + title.slice(1) : title
  const one = !/\s/.test(title.replace(/`[^`]*`/g, 'x'))
  if (one) return `${k === 0 ? 'First' : 'Next'}, a word on ${t}.`
  // "Dictionaries: lookup by key" would make two colons in a row.
  if (t.includes(':')) return `${k === 0 ? 'First' : k === of - 1 ? 'Last' : 'Next'}, ${t}.`
  if (k === 0) return `First: ${t}.`
  if (k === of - 1) return `Last one: ${t}.`
  return `Next: ${t}.`
}

/** Stage 8's calling idea: its title names both of the call's words. */
const isCallIdea = (title: string) => /\bargument/i.test(title) && /\bparameter/i.test(title)

/** The bolded formal word of a Stage 6 table row, as FORMAL_WORDS keys it. */
const formalOf = (cell: string): string | null => cell.match(/\*\*([^*]+)\*\*/)?.[1]?.trim() ?? null

const runnable = (b: Block): boolean => b.kind === 'code' && b.lang === 'python'

/**
 * A stage's ideas as beats: the story line, the stage's opening, each
 * idea one block a beat, the capstone's introduction, and the close.
 * Derived from the stage alone, so it is the same every time and a unit
 * test can read it.
 */
export function ideaBeats(stage: Stage): IdeaBeat[] {
  const beats: IdeaBeat[] = []
  let invited = false
  // The line for the first block after a run of named words, if any.
  let after: string | undefined
  // A block with no line of its own is read under the last one said.
  const said = () => beats[beats.length - 1]?.say ?? ''
  const block = (at: Reach, say?: string) => beats.push({ say: say ?? said(), at })
  const afterExample = (b: Block) => {
    if (invited || !runnable(b)) return
    invited = true
    beats.push({ say: EXAMPLE_INVITE, at: null })
  }

  // The robot's problem first (R12), and at Stage 1 the bridge into
  // reading and a nod to the console lessons that came before.
  const opener = openerOf(stage.stage)
  if (stage.stage === 1) {
    beats.push({ say: opener, at: null }, { say: BRIDGE, at: null })
    stage.adds.forEach((b, j) => {
      block({ section: 0, block: j }, j === 0 ? STAGE_1_LEAD : undefined)
      afterExample(b)
    })
  } else {
    stage.adds.forEach((b, j) => {
      block({ section: 0, block: j }, j === 0 ? opener : undefined)
      afterExample(b)
    })
    if (stage.adds.length === 0) beats.push({ say: opener, at: null })
  }

  stage.ideas.forEach((idea, k) => {
    const section = k + 1
    idea.blocks.forEach((b, j) => {
      const first = j === 0 ? (isCallIdea(idea.title) ? CALL_INTRO : introduce(idea.title, k, stage.ideas.length)) : undefined
      // Stage 6: the table of formal words, one row a beat.
      if (b.kind === 'table' && b.rows.some((r) => FORMAL_WORDS[formalOf(r[r.length - 1] ?? '') ?? ''])) {
        if (first) beats.push({ say: FORMAL_OPEN, at: { section, block: j, row: -1 } })
        b.rows.forEach((r, row) => {
          const term = formalOf(r[r.length - 1] ?? '')
          const say = term ? (FORMAL_WORDS[term] ?? KNOWN_WORDS[term]) : undefined
          if (say) beats.push({ say, at: { section, block: j, row }, term: term === 'mutable' ? 'mutable · immutable' : term! })
          else block({ section, block: j, row })
        })
        after = FORMAL_AFTER
        return
      }
      block({ section, block: j }, first ?? after)
      after = undefined
      afterExample(b)
      // Stage 8: show the call, then name its two halves.
      if (j === 0 && runnable(b) && isCallIdea(idea.title)) {
        for (const w of CALL_WORDS) beats.push({ say: w.say, at: null, ...(w.term ? { term: w.term } : {}) })
        after = CALL_AFTER
      }
    })
  })

  if (stage.capstone) {
    const section = stage.ideas.length + 1
    stage.capstone.intro.forEach((_, j) => {
      block({ section, block: j }, j === 0 ? CAPSTONE_LINE : undefined)
    })
  }

  beats.push({ say: IDEAS_CLOSE, at: null, end: true })
  return beats
}

/**
 * Whether an idea's heading must wait: it uses a word this stage names on
 * a later beat. Stage 8's "Calling: arguments are objects, parameters are
 * local names" is on the sheet from its example on, and the two words are
 * named two beats later; the heading appears with the second of them.
 */
export function heldTitle(title: string, beats: IdeaBeat[], terms: string[]): boolean {
  return beats.some(
    (b) =>
      b.term !== undefined &&
      !terms.includes(b.term) &&
      b.term.split(' · ').some((t) => new RegExp(`\\b${t.replace(/s$/, '')}`, 'i').test(title)),
  )
}

/** How many sections the sheet has, the capstone included. */
export const sectionsOf = (stage: Stage): number => 1 + stage.ideas.length + (stage.capstone ? 1 : 0)

/**
 * How far the sheet has got by beat `at`: the furthest reach of any beat
 * up to it, and the formal words named so far. Beats only ever move
 * forward through the sheet, so the last reach is the furthest.
 */
export function readTo(beats: IdeaBeat[], at: number): { reach: Reach | null; terms: string[]; now: Reach | null; end: boolean } {
  let reach: Reach | null = null
  const terms: string[] = []
  const upto = beats.slice(0, Math.max(0, at) + 1)
  for (const b of upto) {
    if (b.at) reach = b.at
    if (b.term && !terms.includes(b.term)) terms.push(b.term)
  }
  const here = beats[at]
  return { reach, terms, now: here?.at ?? null, end: here?.end === true }
}

/* ---------------------------- what changed in memory ---------------------------- */

const TYPE_WORD: Record<string, string> = {
  list: 'list',
  dict: 'dictionary',
  tuple: 'tuple',
  set: 'set',
  function: 'function',
  generator: 'generator',
  range: 'range',
  module: 'module',
}

const kindWord = (o: PyObject): string => TYPE_WORD[o.type] ?? `\`${o.type}\` object`

/** An object as the crow names it: a value by what it is (`7`), anything
 *  else by its kind ("a list"). */
function nameOf(o: PyObject | undefined, fresh: boolean): string {
  if (!o) return 'an object'
  if (o.kind === 'value' && o.repr.length <= 16) return `\`${o.repr}\``
  const w = kindWord(o)
  if (fresh) return `a new ${w}`
  return `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`
}

const key = (b: { name: string; scope: string }) => `${b.scope}:${b.name}`
const same = (a: PyObject, b: PyObject) => a.repr === b.repr && JSON.stringify(a.elements) === JSON.stringify(b.elements)

/**
 * What the crow points at when an example has run: the one thing that is
 * different in memory now from memory then. Null when nothing it can
 * name changed.
 *
 * In order: an object that changed while every name stayed put (the
 * lesson of Stage 2, and the one most worth pointing at); a name that
 * now shares an object with another; a name that moved; a name that
 * appeared. Sharing is only ever claimed of a *reference* object. Two
 * names at one `7` are drawn as one card (invariant 4), and whether
 * CPython made one object or two is its business, not the reader's —
 * so the crow never says "the same object" about a value (R8).
 */
export function memoryNote(before: MemorySnapshot, after: MemorySnapshot, v: Vocabulary): string | null {
  const formal = v === 'formal'
  const was = new Map(before.bindings.map((b) => [key(b), b]))
  const who = (id: string) => after.bindings.find((b) => b.target === id)

  // 1. An object changed in place.
  for (const [id, o] of Object.entries(after.objects)) {
    const old = before.objects[id]
    if (o.kind !== 'reference' || !old || same(old, o)) continue
    const named = who(id)
    if (named) {
      return formal
        ? `Look at memory: the ${kindWord(o)} bound to \`${named.name}\` was mutated, and no binding moved.`
        : `Look at memory: the ${kindWord(o)} \`${named.name}\` points at has changed, and no name moved.`
    }
    const holder = Object.values(after.objects).find((h) => (h.elements ?? []).some((e) => e.target === id))
    const outer = holder ? who(holder.id) : undefined
    if (outer) return `Look at memory: the ${kindWord(o)} inside \`${outer.name}\` has changed, and no name moved.`
  }

  const moved = after.bindings.filter((b) => {
    const w = was.get(key(b))
    return !w || w.target !== b.target
  })

  // 2. A name that now shares a reference object with another.
  for (const b of moved) {
    const o = after.objects[b.target]
    if (o?.kind !== 'reference') continue
    const other = after.bindings.find((x) => x !== b && x.target === b.target)
    if (other) {
      return formal
        ? `Look at memory: \`${b.name}\` is bound to the same ${kindWord(o)} as \`${other.name}\`.`
        : `Look at memory: \`${other.name}\` and \`${b.name}\` point at one ${kindWord(o)}, not two.`
    }
  }

  // 3. A name that moved, or 4. appeared: the latest one.
  const last = moved[moved.length - 1]
  if (last) {
    const o = after.objects[last.target]
    const fresh = !before.objects[last.target]
    const what = nameOf(o, fresh)
    if (was.has(key(last))) {
      return formal ? `Look at memory: \`${last.name}\` is rebound to ${what}.` : `Look at memory: \`${last.name}\` has moved to ${what}.`
    }
    return formal ? `Look at memory: \`${last.name}\` is bound to ${what}.` : `Look at memory: \`${last.name}\` points at ${what}.`
  }
  return null
}

/** The crow's line when the example stopped with an exception. */
export const raisedNote = (error: string): string => `Python stopped with ${article(error)} \`${error}\`, and memory shows everything up to that line.`

/** The crow's line when an example ran and named nothing. */
export const NOTHING_NAMED = 'This one names nothing, so memory stays empty and its output is at the bottom right.'

/**
 * The note for the moment being shown: walk back from it until memory
 * was different, and say what is new since. `at(i)` is memory at step i.
 */
export function noteAt(at: (i: number) => MemorySnapshot, shown: number, v: Vocabulary): string | null {
  const after = at(shown)
  for (let j = shown - 1; j >= 0; j--) {
    const note = memoryNote(at(j), after, v)
    if (note) return note
  }
  return after.bindings.length === 0 ? NOTHING_NAMED : null
}
