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
 * Every line is one sentence or two short ones, at most 20 words
 * (docs/PEDAGOGY.md R2), and says what to do rather than how hard it is.
 * `tests/unit/reading.test.ts` counts them.
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

const TASK: Record<Form, [plain: string, formal: string]> = {
  predict: ['Read it, and write down what it prints. Nothing runs until you commit.', 'Predict the output. Commit, and then the interpreter runs it.'],
  compare: ['Two programs, nearly twins. Say what each prints, and the first line where they part ways.', 'Two near-matches. Predict both, and find the first line where the control flow or bindings diverge.'],
  fix: ['Something here doesn’t do what was meant. First, say what it actually does.', 'There is a defect. Say what the code actually does, then repair it minimally.'],
  order: ['Number the lines in the order Python reaches them. A line reached twice gets two numbers.', 'Number the control flow: every visit to every line, in order.'],
  table: ['Fill in the table, one row for each pass through the loop.', 'Build the trace table, one row per iteration.'],
  block: ['Which lines are inside the block, and how many times does each one run?', 'Mark the block by its indentation, and count how many times each line runs.'],
  draw: ['Which picture shows the names, and the objects they point at?', 'Which diagram shows the bindings, and the objects they are bound to?'],
  write: ['Your turn to write it. The robot will check it does what was asked.', 'Write the program. The robot runs it to check the behaviour asked for.'],
  label: ['Say what each piece of the line does.', 'Label each piece of the line with its role.'],
  rule: ['Put the rule in your own words, then check it against the key.', 'State the rule in your own words, then mark yourself against the key.'],
}

export const taskLine = (form: Form, v: Vocabulary): string => TASK[form][v === 'plain' ? 0 : 1]

/** Every task line, for the tests that count words. */
export const TASK_LINES: readonly string[] = Object.values(TASK).flat()

export const CHECKPOINT_LINE = 'Checkpoint. Nothing new here, just what you know. Only first answers count.'

/** After committing: right, or which kind of mistake, and where to look. */
export function verdictLine(right: boolean, err: ErrorType | null, goBack: string[], soft = false): string {
  if (right) return 'Right. Read the key anyway: the reasoning is the point.'
  if (soft) return 'The idea is right and the word is not. That’s the cheapest mistake there is.'
  const kind = err ? `${article(ERROR_NAMES[err])} ${ERROR_NAMES[err].toLowerCase()} mistake` : 'a miss'
  const back = goBack.length ? ` The key sends you back to ${goBack.join(' and ')}.` : ''
  return `Not quite — ${kind}.${back}`
}

const article = (w: string) => (/^[AEIOU]/i.test(w) ? 'an' : 'a')

/** Said before a repair or a program is owed, after the predictions. */
export const ACT_LEAD = { right: 'Right so far. ', wrong: 'Not quite — the key says why. ' } as const

export const ACT_LINE: Record<'fix' | 'write', string> = {
  fix: 'Now repair it: the smallest change that works. Then send it to the robot.',
  write: 'Your turn to write it. Send it to the robot when it’s ready.',
}

export const RULE_LINE = 'Now read the key’s rule, and mark yours honestly.'

export function doneLine(right: number, of: number, kind: 'set' | 'checkpoint' | 'review' | 'capstone' | 'practice', passed?: boolean): string {
  if (kind === 'checkpoint') {
    return passed
      ? `Checkpoint passed: ${right} of ${of} right first time. The stage is yours.`
      : `${right} of ${of} right first time, not enough to pass yet. There’s a short review on the map first.`
  }
  if (kind === 'review') return 'Review done. The checkpoint is open again.'
  if (kind === 'capstone') return `Capstone done: ${right} of ${of} right first time. You can read a real program now.`
  return `Done: ${right} of ${of} right first time. Each one counts towards your concepts.`
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
  'loop variable': 'You’ve been saying *the name the `for` line rebinds*. That’s the **loop variable**.',
  block: 'You’ve been saying *the indented lines that belong together*. That’s a **block**.',
  'control flow': 'You’ve been saying *the order the lines run in*. The formal word is **control flow**.',
  mutable: 'You’ve been saying *changeable* and *unchangeable*. The words are **mutable** and **immutable**.',
  hashable: 'You’ve been saying *allowed as a dictionary key*. The formal word is **hashable**.',
}

/**
 * Stage 8's two, which have nothing to have been called before: the
 * player has never written a function of their own. So they are shown
 * first, on the idea's own example (`double(x)`), and then named — told
 * after the example's beat, before the paragraph that uses both words.
 */
const CALL_WORDS: { term: string; say: string }[] = [
  { term: 'arguments', say: 'The call sends in the object `x` points at. What a call sends in is an **argument**.' },
  { term: 'parameters', say: '`n` is the name that receives it. A name in the `def` line’s brackets is a **parameter**.' },
]

const EXAMPLE_INVITE = 'Every example can run. Press Run this, and memory draws what it builds.'

export const IDEAS_CLOSE = 'That’s the idea. Next, you read programs that use it, and say what they do first.'

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
      const first = j === 0 ? introduce(idea.title, k, stage.ideas.length) : undefined
      // Stage 6: the table of formal words, one row a beat.
      if (b.kind === 'table' && b.rows.some((r) => FORMAL_WORDS[formalOf(r[r.length - 1] ?? '') ?? ''])) {
        if (first) beats.push({ say: first, at: { section, block: j, row: -1 } })
        b.rows.forEach((r, row) => {
          const term = formalOf(r[r.length - 1] ?? '')
          const say = term ? FORMAL_WORDS[term] : undefined
          if (say) beats.push({ say, at: { section, block: j, row }, term: term === 'mutable' ? 'mutable · immutable' : term! })
          else block({ section, block: j, row })
        })
        return
      }
      block({ section, block: j }, first)
      afterExample(b)
      // Stage 8: show the call, then name its two halves.
      if (j === 0 && runnable(b) && /\bargument/i.test(idea.title) && /\bparameter/i.test(idea.title)) {
        for (const w of CALL_WORDS) beats.push({ say: w.say, at: null, term: w.term })
      }
    })
  })

  if (stage.capstone) {
    const section = stage.ideas.length + 1
    stage.capstone.intro.forEach((_, j) => {
      block({ section, block: j }, j === 0 ? 'Last, the capstone. Read it now if you like, but predict it before it runs.' : undefined)
    })
  }

  beats.push({ say: IDEAS_CLOSE, at: null, end: true })
  return beats
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
export const raisedNote = (error: string): string => `Python stopped with ${article(error)} \`${error}\`. Memory shows everything up to that line.`

/** The crow's line when an example ran and named nothing. */
export const NOTHING_NAMED = 'This one names nothing, so memory stays empty. Its output is at the bottom right.'

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
