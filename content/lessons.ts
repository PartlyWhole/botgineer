/**
 * Guided lessons.
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
 */
import type { Thought } from '../src/memory/extract'
import type { MemorySnapshot } from '../src/memory/model'

/**
 * What a step is allowed to look at.
 *
 * `snapshot` is memory now. `echoed` is every value the robot has said
 * back over the whole session, which is what lets a step ask the player to
 * *retrieve* something rather than only to store it — answering a question
 * leaves no trace in memory, so there would otherwise be nothing to check.
 *
 * Both grow and neither is rewritten, so a step that is satisfied stays
 * satisfied and progress still only moves forward. (Scrubbing the trace
 * rewinds `snapshot` but not `echoed`: what was said was said.)
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
  thoughts: Thought[]
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
}

/** True if this held after any accepted line. */
const ever = (e: Evidence, holds: (s: MemorySnapshot) => boolean): boolean => e.history.some(holds)

/** The robot has thought of something of this type. */
const thoughtOfA = (e: Evidence, type: string): boolean => e.thoughts.some((t) => t.type === type)

/** The robot has worked this exact answer out. */
const worked = (e: Evidence, repr: string): boolean => e.thoughts.some((t) => t.repr === repr)

export type LessonStep = {
  /** What the guide says while this step is the current one. */
  say: string
  /** Who says it — an actor id in the scene. The crow, when omitted. */
  speaker?: string
  /** True once the evidence shows the step was done. */
  done: (evidence: Evidence) => boolean
}

export type Lesson = {
  id: string
  steps: LessonStep[]
  /** Said once every step is done. */
  outro: string
}

/* ----------------------------- predicates ----------------------------- */

/** What this name points at, or null if it points at nothing yet. */
const targetOf = (snapshot: MemorySnapshot, name: string): string | null =>
  snapshot.bindings.find((b) => b.name === name)?.target ?? null

/** This name points at an object with this `repr`. */
const points = (snapshot: MemorySnapshot, name: string, repr: string): boolean => {
  const id = targetOf(snapshot, name)
  return id !== null && snapshot.objects[id]?.repr === repr
}

/** Two names on the same object — the thing the binding lesson is for. */
const sameObject = (snapshot: MemorySnapshot, a: string, b: string): boolean => {
  const left = targetOf(snapshot, a)
  return left !== null && left === targetOf(snapshot, b)
}

/* ------------------------------ lesson one ------------------------------ */

/**
 * The four kinds of thing.
 *
 * Nothing is named and nothing is stored: the robot thinks of a value and
 * lets it go. What the player is learning is that Python has a handful of
 * basic kinds of thing and that it can tell them apart — `True` is not
 * `"True"`, and `3` is not `3.0`.
 *
 * Each step is judged on the *type* the robot thought of, not on a
 * particular value, so the player can pick their own number and their own
 * word. `10` and `7` are both ints, and either is a correct answer.
 */
export const primitives: Lesson = {
  id: 'primitives',
  steps: [
    {
      say: 'A whole number. Any one you like.',
      done: (e) => thoughtOfA(e, 'int'),
    },
    {
      say: 'Now one with a dot. `2.5`',
      done: (e) => thoughtOfA(e, 'float'),
    },
    {
      say: 'A word next, in quotes. `"crow"`',
      done: (e) => thoughtOfA(e, 'str'),
    },
    {
      say: 'Last one: `True`. No quotes.',
      done: (e) => thoughtOfA(e, 'bool'),
    },
  ],
  outro:
    'Four kinds: `int`, `float`, `str`, `bool`. All gone — none of them had a name.',
}

/* ------------------------------ lesson two ------------------------------ */

/**
 * Working things out.
 *
 * Operations on each of the kinds from lesson one, and one point at the
 * end: the answer went nowhere. Nobody but the robot ever knew it, it was
 * never in memory, and asking again means working it out again. That is
 * the itch the *next* lesson scratches, which is why this lesson has to
 * come before names rather than after them.
 *
 * The answers are checked exactly, because "work out this specific thing"
 * is the task. They are also chosen not to collide: no two are the same
 * repr, so satisfying one step cannot satisfy another by accident.
 */
export const operations: Lesson = {
  id: 'operations',
  steps: [
    {
      say: 'It can work things out. Ask it `7 * 6`',
      done: (e) => worked(e, '42'),
    },
    {
      say: 'Now `9 / 2`. Mind the dot.',
      done: (e) => worked(e, '4.5'),
    },
    {
      say: 'Words join up too. `"bot" + "gineer"`',
      done: (e) => worked(e, "'botgineer'"),
    },
    {
      say: 'Ask it a question. `3 > 5`',
      done: (e) => worked(e, 'False'),
    },
    {
      say: 'Last one, in two parts. `(2 + 3) * 4`',
      done: (e) => worked(e, '20'),
    },
  ],
  outro:
    'Twenty — and gone. Nobody else ever knew it. Ask again and it starts from scratch.',
}

/**
 * Which step the player is on.
 *
 * Returns `steps.length` when every step is done, which is the caller's
 * cue to say the outro.
 */
export function progress(lesson: Lesson, evidence: Evidence): number {
  const at = lesson.steps.findIndex((step) => !step.done(evidence))
  return at === -1 ? lesson.steps.length : at
}

export type Utterance = { text: string; speaker?: string | undefined }

/** What the guide should be saying right now, and who says it. */
export function guidance(lesson: Lesson, evidence: Evidence): Utterance {
  const at = progress(lesson, evidence)
  if (at === lesson.steps.length) return { text: lesson.outro }
  const step = lesson.steps[at]!
  return { text: step.say, speaker: step.speaker }
}

/* ------------------------------ lesson two ------------------------------ */

/**
 * Keeping one, and what a name actually is.
 *
 * This follows the operations lesson deliberately: that one ends with an
 * answer nobody kept and the observation that getting it back means
 * working it out again. A name is the fix for that, so the player meets
 * binding as the answer to a problem they have just had rather than as a
 * new piece of syntax.
 *
 * The second half prevents the misconception that `x = 10` puts a 10
 * *inside* `x`. If that were true, `y = x` would copy it and rebinding
 * `x` would leave `y` alone by luck rather than by rule — so the lesson
 * ends by moving `x` and looking at `y`.
 *
 * Every object here is a small int, which CPython interns, so two
 * separately typed `10`s really are one object and the memory view says
 * so. That is why the aliasing step is `y = x` and never `y = 10`: the
 * second looks identical on screen while teaching something untrue of
 * objects in general.
 */
export const namesPoint: Lesson = {
  id: 'names-point',
  steps: [
    {
      say: 'Tired of it forgetting? Try `x = 10`',
      // `ever`, not `snapshot`: the last step of this lesson moves `x`,
      // which would otherwise un-answer the first two.
      done: (e) => ever(e, (s) => points(s, 'x', '10')),
    },
    {
      say: 'Look — memory. Now just say `x`',
      done: (e) => worked(e, '10'),
    },
    {
      say: 'No working it out again. Now `y = x`',
      done: (e) => ever(e, (s) => sameObject(s, 'x', 'y')),
    },
    {
      say: 'Now move it. `x = 99` — watch `y`.',
      done: ({ snapshot }) => points(snapshot, 'x', '99') && points(snapshot, 'y', '10'),
    },
  ],
  outro:
    '`x` moved. `y` did not. A name points at a thing — it never held it.',
}

/* ----------------------------- lesson three ----------------------------- */

/**
 * The first lesson where the robot is useful.
 *
 * Someone walks up, tells the robot two things, and comes back with a
 * question. Storing is no longer an exercise — it is the only reason the
 * robot can answer at all.
 *
 * The final question is deliberately not "what did I tell you?". Echoing
 * back a remembered `7` proves nothing; a player could type the digit from
 * their own memory of the conversation. It asks for the *weight*, which is
 * `parcels * 2` and was never said aloud, so the only way to produce 14 is
 * to use what the robot stored. That is also the more honest lesson: the
 * robot did not remember the answer, it remembered the facts.
 *
 * The names are prescribed here, unlike the earlier lessons, because the
 * scene watches them: the ticket shows whatever `customer` points at, so
 * the player sees storage do something in the world.
 */
export const takeAnOrder: Lesson = {
  id: 'take-an-order',
  steps: [
    {
      speaker: 'courier',
      say: 'Afternoon! Ana. Put me on the ticket. `customer = "Ana"`',
      done: ({ snapshot }) => points(snapshot, 'customer', "'Ana'"),
    },
    {
      speaker: 'courier',
      say: 'Seven parcels today. `parcels = 7`',
      done: ({ snapshot }) => points(snapshot, 'parcels', '7'),
    },
    {
      speaker: 'courier',
      say: 'Two kilos each. How much am I carrying?',
      // Never said aloud by anyone, so it can only come from the stored
      // count. Asked of the robot's answers, not of its memory: replying
      // to a question leaves nothing behind in memory to check.
      done: (e) => worked(e, '14'),
    },
  ],
  outro:
    'Fourteen! It never stored that — it stored seven, and worked the rest out.',
}

export const LESSONS: Record<string, Lesson> = {
  [primitives.id]: primitives,
  [operations.id]: operations,
  [namesPoint.id]: namesPoint,
  [takeAnOrder.id]: takeAnOrder,
}
