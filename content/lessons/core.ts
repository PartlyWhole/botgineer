/**
 * Guided lessons: the model, the predicates, and everything derived from
 * them. Each lesson is its own file beside this one; `index.ts` gathers
 * them into the registry and re-exports all of this, so importers keep
 * importing `content/lessons`.
 *
 * (The lesson files import from here rather than from `index.ts`, which
 * imports them: a module cycle would make every `nudge: boolMiss` at the
 * top level of a lesson depend on which file happened to load first.)
 *
 * A lesson is a list of things to notice, each with a test that reads the
 * robot's memory. Which step the player is on is **derived**, never
 * stored: it is the first step whose test the snapshot does not yet
 * satisfy. Nothing here advances anything, and nothing here can be out of
 * step with what the robot actually has.
 *
 * That has a pleasant consequence for the console. Because replay keeps
 * every accepted line, a step that has been satisfied stays satisfied —
 * so progress only ever moves forward, without a single line of
 * bookkeeping. And because it is derived, scrubbing back through a trace
 * walks the guide backwards too.
 *
 * The rule for writing a step: its test must be answerable from the
 * evidence below, and must stay true once it is true. A step that means
 * "read this and nod" cannot be checked, would need state to remember the
 * nod, and is a paragraph rather than a task.
 *
 * Three things the first two lessons add, all still derived:
 *
 * - **Ordered** lessons count a thought only for the step that was asking
 *   when it was thought. Without that, `"crow"` typed first answered the
 *   text step early and the player never heard the line that names
 *   floats. See `progress`.
 * - A step can **reply to a miss** (`nudge`): the last line, read the way
 *   a teacher reads a wrong answer — `2.0` legs, `yes` without quotes, a
 *   phone number that lost its leading zero. It is said instead of the
 *   step, until the next line.
 * - A step can **show** something (`show`): a picture on the stage that
 *   the answer is drawn into. See `src/scene/props.ts` and `staging`.
 *
 * ## Beats (docs/PEDAGOGY.md §4 and §7)
 *
 * A "read this and nod" paragraph is still not a step — but it can be a
 * **beat**: a line told *before* a step's question, which the player
 * advances with Next and which nobody checks. So a step is now a short
 * run of beats ending on its ask, and `script` lays that run out:
 *
 *     [praise of the step before] + beats of this step + the ask
 *
 * (or `[praise of the last step] + outro` once every step is done). Which
 * item is showing is the workbench's one piece of view state, an index
 * into this list, reset whenever the step changes. Which *step* it is
 * stays `progress`, derived as ever: a beat is narration, never a step,
 * and no beat is ever checked. A lesson with no beats, no praise and a
 * string outro has a script of exactly one item, and behaves as it did
 * before beats existed.
 */
import type { Thought } from '../../src/memory/extract'
import { EMPTY, type MemorySnapshot } from '../../src/memory/model'
import { NO_STAGING, numberOf, sameProp, textOf, type Prop, type PropView, type Staging } from '../../src/scene/props'
import { CROW_NAME } from '../cast'

/** A thought, and the line that produced it — so a step can ask the
 *  robot to work something out rather than accept the player's own sum. */
export type Heard = Thought & { source?: string | undefined }

/** The last line the player typed, whether or not it worked. */
export type Line = {
  source: string
  ok: boolean
  /** As the console said it: begins with the error's type name. */
  error: string | null
  /** What the robot thought, for a bare expression that made something. */
  thought: Thought | null
  /**
   * Memory as this line left it — the entry it added to `history`, the
   * same object — for an accepted line. It is how `beforeLast` takes the
   * line back out of the evidence, which is how a binding that did a step
   * is known to have moved the lesson (and so is never answered as a miss
   * to the step after it).
   */
  memory?: MemorySnapshot | undefined
}

/**
 * What a step is allowed to look at.
 *
 * `snapshot` is memory now. `thoughts` is every value the robot has
 * worked out over the whole session, which is what lets a step ask the
 * player to *retrieve* something rather than only to store it — answering
 * a question leaves no trace in memory, so there would otherwise be
 * nothing to check.
 *
 * All of these grow and none is rewritten, so a step that is satisfied
 * stays satisfied and progress still only moves forward. (Scrubbing the
 * trace rewinds `snapshot` but not `thoughts`: what was said was said.)
 */
export type Evidence = {
  snapshot: MemorySnapshot
  /**
   * Everything the robot has worked out, in order.
   *
   * Not memory. A bare expression's value is gone the moment the line
   * ends — the robot thought of it and let it go — so the early lessons,
   * which never bind anything, can only be judged on what it thought.
   */
  thoughts: Heard[]
  /**
   * Memory as it stood after each accepted line, oldest first, ending
   * with the current one.
   *
   * Needed because memory is not itself monotonic: `x = 99` makes "`x`
   * points at 10" false again, and a lesson whose whole point is to
   * rebind `x` would slide backwards to step one at the moment the player
   * finished it. Asking whether something was *ever* true fixes that
   * without storing any progress.
   */
  history: MemorySnapshot[]
  /** The line just typed. Only a reply reads it; progress never does. */
  last?: Line | null | undefined
}

/** True if this held after any accepted line. */
export const ever = (e: Evidence, holds: (s: MemorySnapshot) => boolean): boolean => e.history.some(holds)

/** The robot has worked this exact answer out. */
export const worked = (e: Evidence, repr: string): boolean => e.thoughts.some((t) => t.repr === repr)

/** The robot has thought of something this passes. */
export const heard = (e: Evidence, holds: (t: Heard) => boolean): boolean => e.thoughts.some(holds)

/** The robot thought of exactly this, of exactly this type. */
export const was = (type: string, repr: string) => (t: Heard) => t.type === type && t.repr === repr

/* ------------------------------- the model ------------------------------- */

/**
 * Something a character does while a beat is showing. Cosmetic, like the
 * moods: nothing reads it back, and the scene still causes nothing.
 *
 * - `enter` / `hide`: on and off the stage. An actor whose first action
 *   in the lesson is `enter` waits off stage until that beat — which is
 *   how Mira can be in a scene and still *arrive* in it.
 * - `wave` / `hop`: a one-shot, played while the beat is current.
 * - `sleep` / `wake`: the robot's screen dark, or lit. Kept until undone.
 */
export type CastAction = { actor: string; do: 'enter' | 'hide' | 'wave' | 'hop' | 'sleep' | 'wake' }

/** A part of the screen a beat points at, which pulses while it shows. */
export type Focus = 'console' | 'memory' | 'run'

/**
 * One line of narration, told before a step's question (R2: one idea, one
 * sentence). Advanced by the player with Next; never checked.
 */
export type Beat = {
  /** One line, ≤ 20 words (R2). */
  say: string
  /** An actor id in the scene; the crow when omitted. */
  speaker?: string
  /** The stage picture from this beat on, until another beat (or the
   *  ask) sets one. A demonstration, not an answer: nothing is drawn in. */
  show?: Prop
  /** A demonstration thought in the robot's cloud, for this beat only.
   *  Never evidence: only what the robot really thought is. */
  thought?: string
  /** What the cast does while this beat shows. */
  act?: CastAction[]
  /** Pulse that part of the screen. */
  focus?: Focus
}

export type LessonStep = {
  /** The ask: the question alone (R3), said while the console waits. */
  say: string
  /** Who says it — an actor id in the scene. The crow, when omitted. */
  speaker?: string
  /** True once the evidence shows the step was done. */
  done: (evidence: Evidence) => boolean
  /** The picture this step's question is about. */
  show?: Prop
  /** The question in a few words, kept under the picture. */
  ask?: string
  /**
   * What to say to a line that did not do this step, or undefined to
   * repeat the step. Only ever asked about a line that did not advance
   * the lesson, so it never has to tell a right answer from a wrong one.
   */
  nudge?: (line: Line) => string | undefined
  /** Told before the ask, one Next at a time. */
  beats?: Beat[]
  /**
   * Why it was right (R9) — the first thing said once this step is done,
   * before the next step's beats. Said by the crow. A function is handed
   * the thought that did the step, for praise that names the answer:
   * "It's thinking of 7!"
   */
  praise?: string | ((answer: Heard | null) => string)
  /** Who does the work (R4): the player answers, or the robot works it
   *  out. Shown on the ask. */
  tag?: 'you' | 'robot'
}

export type Lesson = {
  id: string
  /** The skills (`content/skills`) finishing this lesson introduces, and
   *  so makes available to practise. */
  teaches: string[]
  steps: LessonStep[]
  /** Said once every step is done: one line, or closing beats. */
  outro: string | Beat[]
  /** Who says a string outro, and any outro beat without a speaker of its
   *  own. The crow, when omitted. */
  outroSpeaker?: string
  /** Count a thought only for the step that was asking — see `progress`. */
  ordered?: boolean
  /** On the stage once every step is done. */
  finale?: Prop
  /** The bar shown when the lesson is finished (R11): one or two whole
   *  sentences. */
  takeaway?: string
}

/* ----------------------------- predicates ----------------------------- */

/** What this name points at, or null if it points at nothing yet. */
export const targetOf = (snapshot: MemorySnapshot, name: string): string | null =>
  snapshot.bindings.find((b) => b.name === name)?.target ?? null

/** This name points at an object with this `repr`. */
export const points = (snapshot: MemorySnapshot, name: string, repr: string): boolean => {
  const id = targetOf(snapshot, name)
  return id !== null && snapshot.objects[id]?.repr === repr
}

/** Two names on the same object — the thing the binding lesson is for. */
export const sameObject = (snapshot: MemorySnapshot, a: string, b: string): boolean => {
  const left = targetOf(snapshot, a)
  return left !== null && left === targetOf(snapshot, b)
}

/* ------------------------------- replies ------------------------------- */

/** The error's type name, from the console's line about it. */
export const errorType = (line: Line): string | null =>
  line.ok ? null : (line.error?.match(/^[A-Za-z]+/)?.[0] ?? 'Error')

const article = (w: string) => (/^[AEIOU]/.test(w) ? 'an' : 'a')

/** The last resort: say what stopped it, plainly. */
export const stopped = (line: Line, then: string): string | undefined => {
  const kind = errorType(line)
  return kind ? `That stopped the robot with ${article(kind)} \`${kind}\`. ${then}` : undefined
}

/** A plain word typed without quotes, which Python reads as a name. */
export const bareWord = (line: Line): string | null =>
  errorType(line) === 'NameError' && /^[A-Za-z]+$/.test(line.source.trim()) ? line.source.trim() : null

/** A comma where the dot goes — `1,5` is a pair of ints to Python. */
export const commaDecimal = (line: Line): boolean =>
  line.thought?.type === 'tuple' && /^\s*-?\d+\s*,\s*\d+\s*$/.test(line.source)

/** The usual misses on a yes-or-no question. */
export function boolMiss(line: Line): string | undefined {
  const s = line.source.trim()
  if (s === 'true' || s === 'false') return `Nearly — it needs a capital letter: \`${s[0]!.toUpperCase()}${s.slice(1)}\`.`
  const word = bareWord(line)
  if (word) return `The robot doesn't know the word \`${word}\`. Its own yes is \`True\`, and its no is \`False\`.`
  const t = line.thought
  if (t?.type === 'str') return 'Quotes make that a word, for people. The robot\'s own answer has no quotes: `True` or `False`.'
  if (t?.type === 'int' || t?.type === 'float') return 'That\'s a number. A yes-or-no question has only two answers: `True` or `False`.'
  return stopped(line, 'Just `True` or `False`.')
}

/** The usual misses on a how-many question. */
export function countMiss(line: Line, things: string): string | undefined {
  const t = line.thought
  const n = numberOf(t)
  if (t?.type === 'float' && n !== null && Number.isInteger(n)) {
    return `${t.repr} ${things}? The dot means *measured*. ${cap(things)} are counted — no dot.`
  }
  if (t?.type === 'float') return `A piece of one? These ${things} are whole — count them.`
  if (t?.type === 'bool') return `\`${t.repr}\` answers yes or no. This asks *how many*.`
  if (t?.type === 'str') return 'That\'s a word, for people. The robot counts with digits and no quotes.'
  if (bareWord(line)) return 'The robot counts with digits, like `3` — it doesn\'t know number words.'
  return stopped(line, 'A whole number, with digits.')
}

/** The usual misses on a how-much question. */
export function measureMiss(line: Line): string | undefined {
  const t = line.thought
  if (commaDecimal(line)) return 'Python writes the dot as a full stop, not a comma: `1.5`, not `1,5`.'
  if (t?.type === 'str') return 'That\'s a word. A measurement is a number with a dot in it.'
  if (t?.type === 'bool') return `\`${t.repr}\` answers yes or no. This asks *how much*.`
  if (bareWord(line)) return 'The robot measures with digits and a dot, like `0.5`.'
  return stopped(line, 'A number with a dot.')
}

/** The usual misses when words are wanted. */
export function wordsMiss(line: Line, example: string): string | undefined {
  const t = line.thought
  if (textOf(t)?.trim() === '') return 'Those quotes are empty — put some words inside them!'
  if (bareWord(line)) return `Without quotes, the robot thinks \`${line.source.trim()}\` is a name it should already know. Words go inside quotes: \`${example}\`.`
  if (errorType(line) === 'SyntaxError') return `Put the whole thing inside one pair of quotes: \`${example}\`.`
  if (t && t.type !== 'str') return `\`${t.repr}\` is for the robot. People want words — in quotes.`
  return stopped(line, `Words go inside quotes: \`${example}\`.`)
}

export const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

/** The digits of a text, so `"0412 555 019"` and `"0412555019"` agree. */
export const digits = (s: string) => s.replace(/\D/g, '')

/* ------------------------------- progress ------------------------------- */

/**
 * Walks the lesson against the evidence: which step it is on and, for an
 * ordered lesson, how many thoughts each finished step consumed — so the
 * thought that did a step can be named in its praise.
 */
function walk(lesson: Lesson, evidence: Evidence): { at: number; ends: number[] } {
  if (!lesson.ordered) {
    const at = lesson.steps.findIndex((step) => !step.done(evidence))
    return { at: at === -1 ? lesson.steps.length : at, ends: [] }
  }
  const all = evidence.thoughts
  const ends: number[] = []
  let from = 0
  for (let i = 0; i < lesson.steps.length; i++) {
    const step = lesson.steps[i]!
    let end = from + 1
    while (end <= all.length && !step.done({ ...evidence, thoughts: all.slice(from, end) })) end++
    if (end > all.length) return { at: i, ends }
    ends.push(end)
    from = end
  }
  return { at: lesson.steps.length, ends }
}

/**
 * Which step the player is on.
 *
 * Returns `steps.length` when every step is done, which is the caller's
 * cue to say the outro.
 *
 * An **ordered** lesson walks the thoughts in the order they were
 * thought: each step is asked only about what was thought after the step
 * before it was done. Still derived, still monotonic — more thoughts can
 * only move it on — but an answer typed before its question was asked
 * does not count for it, and one line never does two steps.
 */
export function progress(lesson: Lesson, evidence: Evidence): number {
  return walk(lesson, evidence).at
}

/**
 * The evidence as it stood before the last line: without its thought, if
 * it made one, and without its entry in `history`, if it has one. Only an
 * accepted line left anything behind — a line that failed was never kept —
 * so for one of those it is the evidence unchanged.
 *
 * The line names its own entry (`Line.memory`, the very object the
 * workbench appended), so nothing here has to guess which one it was:
 * memory before it is the entry before that one, or nothing before the
 * first. A line that says nothing about memory is taken back by its
 * thought alone, which is all it could have changed.
 */
export function beforeLast(evidence: Evidence): Evidence {
  const last = evidence.last
  if (!last?.ok) return evidence
  const thought = last.thought !== null && evidence.thoughts.length > 0
  const thoughts = thought ? evidence.thoughts.slice(0, -1) : evidence.thoughts
  const entry = last.memory ? evidence.history.lastIndexOf(last.memory) : -1
  if (entry === -1) return thought ? { ...evidence, thoughts, last: null } : evidence
  const kept = evidence.history.slice(0, entry)
  const then = kept[kept.length - 1] ?? EMPTY
  return { snapshot: then, thoughts, history: [...kept, then], last: null }
}

/**
 * Where the lesson was before the last line, and where it is now. The
 * last line did something exactly when they differ.
 *
 * Asked of everything the line left behind, not only of a thought: a
 * binding (`x = 10`) does a step through memory and thinks of nothing,
 * and when this looked only at thoughts, the next step's `nudge` was
 * asked about that right line and could call it a miss.
 */
function moved(lesson: Lesson, evidence: Evidence): { before: number; at: number } {
  const at = progress(lesson, evidence)
  const was = beforeLast(evidence)
  return { before: was === evidence ? at : progress(lesson, was), at }
}

/** The thought that finished step `i`: exact for an ordered lesson, and
 *  the newest thought otherwise (an unordered step may finish on memory,
 *  with no thought at all). */
function answerTo(lesson: Lesson, evidence: Evidence, i: number): Heard | null {
  const { ends } = walk(lesson, evidence)
  const end = lesson.ordered ? ends[i] : evidence.thoughts.length
  return end !== undefined && end > 0 ? (evidence.thoughts[end - 1] ?? null) : null
}

/**
 * The thoughts that did a step, oldest first: what a picture that
 * collects answers (the shelf) is handed as `heard`. A miss is not among
 * them — it is drawn into the picture that asked, once, and then it is
 * gone — so the shelf only ever holds answers the player got right.
 *
 * Derived, like everything here. An ordered lesson knows exactly which
 * thought finished each step (`walk`); an unordered one counts a thought
 * when adding it moved the lesson on.
 */
function rightAnswers(lesson: Lesson, evidence: Evidence): Thought[] {
  const all = evidence.thoughts
  let did: Heard[]
  if (lesson.ordered) {
    did = walk(lesson, evidence).ends.map((end) => all[end - 1]!)
  } else {
    did = []
    let at = progress(lesson, { ...evidence, thoughts: [] })
    for (let k = 1; k <= all.length; k++) {
      const next = progress(lesson, { ...evidence, thoughts: all.slice(0, k) })
      if (next > at) did.push(all[k - 1]!)
      at = next
    }
  }
  return did.map(({ type, repr }) => ({ type, repr }))
}

/* -------------------------------- script -------------------------------- */

/**
 * One thing said, in the order `script` lays them out.
 *
 * - `praise`: why the step before was right. Narration.
 * - `beat`: a line told before the ask. Narration.
 * - `ask`: the question alone; the console opens.
 * - `reply`: the answer to a miss, said in the ask's place while it
 *   applies. The console stays open.
 * - `outro`: the closing lines, once every step is done.
 */
export type ScriptItem = {
  kind: 'praise' | 'beat' | 'ask' | 'reply' | 'outro'
  /** True for the ask and a reply: this item waits for a typed line. */
  asking: boolean
  text: string
  /** An actor id; the crow when undefined. */
  speaker?: string | undefined
  show?: Prop | undefined
  thought?: string | undefined
  act?: CastAction[] | undefined
  focus?: Focus | undefined
  /** On the ask and a reply: who does the work. */
  tag?: 'you' | 'robot' | undefined
  /** A beat's (or outro beat's) index in its own list, which keys its
   *  picture. */
  beat?: number | undefined
}

export type Script = {
  /** The step, as `progress` has it: `steps.length` once finished. */
  at: number
  /** The last line moved the lesson on from `before`. */
  before: number
  finished: boolean
  items: ScriptItem[]
  /**
   * Where the player comes to rest: the ask (or reply), or — once the
   * lesson is finished — its last line. Everything before it is
   * narration, and the console is closed while narration shows.
   */
  rest: number
}

/** `{CROW_NAME}` in a line becomes the crow's name, so a rename is one
 *  constant (docs/PEDAGOGY.md §8). */
const named = (text: string): string => text.split('{CROW_NAME}').join(CROW_NAME)

const beatItem = (kind: 'beat' | 'outro', b: Beat, i: number, speaker?: string): ScriptItem => ({
  kind,
  asking: false,
  text: named(b.say),
  speaker: b.speaker ?? speaker,
  show: b.show,
  thought: b.thought,
  act: b.act,
  focus: b.focus,
  beat: i,
})

/**
 * Everything said at this point in the lesson, in order:
 * `[praise of step at-1] + beats of step at + the ask of step at`, or,
 * once every step is done, `[praise of the last step] + outro`.
 *
 * Pure and derived, like `progress`. The praise is there whenever the
 * step before has one — not only on the line that did it — so the list
 * for a step never changes shape under the workbench's index: a miss
 * swaps the ask for a reply in the same place, and nothing moves.
 */
export function script(lesson: Lesson, evidence: Evidence): Script {
  const { before, at } = moved(lesson, evidence)
  const n = lesson.steps.length
  const items: ScriptItem[] = []

  const prev = at > 0 ? lesson.steps[at - 1] : undefined
  if (prev?.praise !== undefined) {
    const text = typeof prev.praise === 'function' ? prev.praise(answerTo(lesson, evidence, at - 1)) : prev.praise
    items.push({ kind: 'praise', asking: false, text: named(text) })
  }

  if (at === n) {
    const outro = typeof lesson.outro === 'string' ? [{ say: lesson.outro }] : lesson.outro
    outro.forEach((b, i) => items.push(beatItem('outro', b, i, lesson.outroSpeaker)))
    return { at, before, finished: true, items, rest: items.length - 1 }
  }

  const step = lesson.steps[at]!
  ;(step.beats ?? []).forEach((b, i) => items.push(beatItem('beat', b, i)))
  // A miss gets an answer rather than the question again. Only a line that
  // did not move the lesson is a miss, so a right answer is never
  // mistaken for a wrong one to the question after it.
  const reply = evidence.last && before === at && step.nudge ? step.nudge(evidence.last) : undefined
  items.push({
    kind: reply ? 'reply' : 'ask',
    asking: true,
    text: named(reply ?? step.say),
    speaker: step.speaker,
    show: step.show,
    tag: step.tag,
  })
  return { at, before, finished: false, items, rest: items.length - 1 }
}

export type Utterance = { text: string; speaker?: string | undefined }

/**
 * What the guide should be saying right now, and who says it: the item
 * the player comes to rest on — the ask, a reply to a miss, or the
 * outro's last line.
 */
export function guidance(lesson: Lesson, evidence: Evidence): Utterance {
  const s = script(lesson, evidence)
  const item = s.items[s.rest]!
  return { text: item.text, speaker: item.speaker }
}

/**
 * What the guide hands the scene: one line, or a script of them. Practice
 * passes a line today; a script is welcome whenever it has beats to tell.
 */
export type Spoken = { text: string; speaker?: string | undefined; script?: ScriptItem[] | undefined }

/* --------------------------------- cloud --------------------------------- */

/**
 * Where a step's telling began, for the robot's cloud: the newest thought
 * then (`stale`), and — when the line that moved the lesson on made it —
 * that same thought as the `answer` the praise is about. Taken once when
 * the step changes; view state, like the index into the script.
 */
export type CloudFrom = { stale: Heard | undefined; answer: Heard | undefined }

/**
 * What the robot's cloud shows at an item of the script.
 *
 * A beat's demonstration thought, while that beat shows (`''` for an
 * empty cloud). Otherwise the robot's newest real thought — but only for
 * as long as it belongs to what is being told: a thought made since this
 * step began, or the answer, while its praise is read. A thought from a
 * step already done is not what the robot is thinking about now, and
 * left up it read as an answer to the next question: `42` over "Ask for
 * it back: `x`".
 *
 * Compared by identity: `thoughts` only grows (or starts over, for a
 * practice exercise), so a newest thought that is not the one the step
 * began with was thought since.
 */
export function cloud(item: ScriptItem | undefined, newest: Heard | undefined, from: CloudFrom): string | null {
  if (item?.thought !== undefined) return item.thought
  if (newest === undefined) return null
  if (newest !== from.stale) return newest.repr
  return item?.kind === 'praise' && newest === from.answer ? newest.repr : null
}

/* -------------------------------- staging -------------------------------- */

/**
 * What the stage shows: this step's picture, with the last answer drawn
 * into it if it was a miss, and the previous step's picture on its way
 * out with the answer that did it.
 *
 * With beats, `beat` is the index into `script(...).items` being shown,
 * and defaults to where the player rests (the ask). While narration
 * shows, the picture is the latest `show` at or before that beat, falling
 * back to the step's own. A beat's picture is keyed by the beat that set
 * it, and only when it differs from the step's — so a picture that
 * several beats share, or that the ask goes on to ask about, is the same
 * element throughout (invariant 26: one keyed list), and its
 * demonstration plays once.
 *
 * Praise holds the picture that was just answered, with its answer drawn
 * in, for as long as it is being read. That is the payoff, so the next
 * picture then simply arrives: nothing leaves after a praise.
 */
export function staging(lesson: Lesson, evidence: Evidence, beat?: number): Staging {
  const s = script(lesson, evidence)
  const { before, at } = s
  const n = lesson.steps.length
  const i = Math.max(0, Math.min(beat ?? s.rest, s.items.length - 1))
  const item = s.items[i]!
  const last = evidence.last ?? null
  const answer = last?.ok ? last.thought : null
  const heardSoFar: Thought[] = rightAnswers(lesson, evidence)
  const view = (key: string, prop: Prop, extra: Partial<PropView> = {}): Staging['current'] => ({
    key,
    prop,
    ask: undefined,
    answer: null,
    verdict: null,
    heard: heardSoFar,
    ...extra,
  })

  if (item.kind === 'praise') {
    const done = lesson.steps[at - 1]!
    if (done.show) {
      const answered = answerTo(lesson, evidence, at - 1)
      // No question under it: it has been answered, and the floor is where
      // Next stands while the praise is read.
      return {
        current: view(`${lesson.id}:${at - 1}`, done.show, {
          answer: answered ? { type: answered.type, repr: answered.repr } : answer,
          verdict: 'right',
        }),
        leaving: null,
      }
    }
  }

  // The picture at this item: the step's (or the finale), unless a beat at
  // or before it has set another.
  const step = lesson.steps[at]
  const base = at < n ? step?.show : lesson.finale
  const baseKey = `${lesson.id}:${at}`
  let prop = base
  let key = baseKey
  for (let j = 0; j <= i; j++) {
    const show = s.items[j]!.show
    if (!show) continue
    // The same picture with its narration changed: the change plays on the
    // element already standing (its key is kept), and an ask that reuses
    // the picture puts the narration back, so a demonstration never
    // answers the question that follows it.
    if (prop && sameProp(show, prop)) {
      prop = show
      continue
    }
    prop = show
    key = base && sameProp(show, base) ? baseKey : `${lesson.id}:${at}:b${s.items[j]!.beat ?? j}`
  }

  const resting = i === s.rest
  let current: Staging['current'] = prop
    ? view(key, prop, resting && key === baseKey ? { ask: step?.ask } : {})
    : null
  let leaving: Staging['leaving'] = null
  const praised = s.items[0]?.kind === 'praise'

  if (before < at && !praised) {
    const done = lesson.steps[before]!
    if (done.show && current && sameProp(done.show, current.prop)) {
      // Same picture: it stays, and shows the answer that moved it on.
      current = { ...current, answer, verdict: 'right' }
    } else if (done.show) {
      leaving = { key: `${lesson.id}:${before}`, prop: done.show, ask: done.ask, answer, verdict: 'right', heard: heardSoFar }
    }
  } else if (before === at && current && at < n && last && resting && key === baseKey) {
    current = { ...current, answer, verdict: 'miss' }
  }
  return current || leaving ? { current, leaving } : NO_STAGING
}

/* --------------------------------- cast --------------------------------- */

/** Who is where, and doing what, at an item of the script. */
export type CastView = {
  /** Off stage: waiting for their `enter`, or sent off by `hide`. */
  hidden: string[]
  /** Screens dark. */
  asleep: string[]
  /** One-shots playing during this item. */
  acting: { actor: string; do: 'wave' | 'hop' }[]
}

export const NO_CAST: CastView = { hidden: [], asleep: [], acting: [] }

/**
 * The cast at item `beat` of the script: every action of every beat the
 * lesson has already told, folded in order. Derived, so Back walks it
 * backwards and a remount resumes it — Mira is on stage at step 5 because
 * step 4's beats brought her on, not because anything remembered that
 * she came.
 */
export function castAt(lesson: Lesson, evidence: Evidence, beat?: number): CastView {
  const s = script(lesson, evidence)
  const i = Math.max(0, Math.min(beat ?? s.rest, s.items.length - 1))
  const every: CastAction[][] = [
    ...lesson.steps.flatMap((st) => (st.beats ?? []).map((b) => b.act ?? [])),
    ...(typeof lesson.outro === 'string' ? [] : lesson.outro.map((b) => b.act ?? [])),
  ]
  const hidden = new Set<string>()
  const first = new Map<string, CastAction['do']>()
  for (const a of every.flat()) if (!first.has(a.actor)) first.set(a.actor, a.do)
  for (const [actor, d] of first) if (d === 'enter') hidden.add(actor)
  const asleep = new Set<string>()
  const apply = (acts: CastAction[] | undefined) => {
    for (const a of acts ?? []) {
      if (a.do === 'enter') hidden.delete(a.actor)
      if (a.do === 'hide') hidden.add(a.actor)
      if (a.do === 'sleep') asleep.add(a.actor)
      if (a.do === 'wake') asleep.delete(a.actor)
    }
  }
  for (const st of lesson.steps.slice(0, s.at)) for (const b of st.beats ?? []) apply(b.act)
  for (const item of s.items.slice(0, i + 1)) apply(item.act)
  const acting = (s.items[i]!.act ?? []).flatMap((a) =>
    a.do === 'wave' || a.do === 'hop' ? [{ actor: a.actor, do: a.do }] : [],
  )
  return { hidden: [...hidden], asleep: [...asleep], acting }
}
