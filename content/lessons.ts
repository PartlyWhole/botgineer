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
import type { MemorySnapshot } from '../src/memory/model'
import { unreferenced } from '../src/memory/model'

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
  echoed: string[]
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

/** An object of this type whose `repr` matches, whatever points at it. */
const has = (snapshot: MemorySnapshot, type: string, repr: string): boolean =>
  Object.values(snapshot.objects).some((o) => o.type === type && o.repr === repr)

/** A collection of the given size that no name and no other object holds. */
const loneCollection = (snapshot: MemorySnapshot, size: number): boolean => {
  const free = new Set(unreferenced(snapshot))
  return Object.values(snapshot.objects).some(
    (o) => free.has(o.id) && o.elements !== null && o.elements.length === size,
  )
}

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
 * Objects come before names.
 *
 * Everything here is typed bare, so nothing is ever bound. The point the
 * player should leave with is that `10` is a thing the robot made, not a
 * thing that needs a label to exist.
 */
export const objectsFirst: Lesson = {
  id: 'objects-first',
  steps: [
    {
      say: 'Say `10` to me. Just the number, then Enter.',
      done: ({ snapshot }) => has(snapshot, 'int', '10'),
    },
    {
      say: 'That is an object now, sitting in my memory. Make me a word: `"John"`, quotes and all.',
      done: ({ snapshot }) => has(snapshot, 'str', "'John'"),
    },
    {
      say: 'Now make one you did not type. Try `3 + 4`.',
      done: ({ snapshot }) => has(snapshot, 'int', '7'),
    },
    {
      say: 'One more, and this one holds others: `[1, 2, 3]`.',
      done: ({ snapshot }) => loneCollection(snapshot, 3),
    },
  ],
  outro:
    'Look at my memory. Four objects, and not one of them has a name — nothing is pointing at them at all. A name is something you add later, when you want to find a thing again.',
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
 * A name is an arrow, not a box.
 *
 * The misconception this exists to prevent is that `x = 10` puts a 10
 * *inside* `x`. If that were true, `y = x` would copy it and rebinding `x`
 * would leave `y` alone by luck rather than by rule. So the lesson ends by
 * rebinding `x` and looking at `y`: it did not move, because it was never
 * attached to `x` at all.
 *
 * Every object here is a small int, which CPython interns — so two
 * separately typed `10`s really are one object, and the memory view says
 * so. That is why the aliasing step is `y = x` and never `y = 10`: the
 * second would look identical on screen while teaching something that is
 * not true of objects in general.
 */
export const namesPoint: Lesson = {
  id: 'names-point',
  steps: [
    {
      say: 'Objects again — but this time, give one a handle. Say `x = 10`.',
      // `ever`, not `snapshot`: the last step of this lesson moves `x`,
      // which would otherwise un-answer the first two.
      done: (e) => ever(e, (s) => points(s, 'x', '10')),
    },
    {
      say: 'Now aim a second name at the *same* object: `y = x`.',
      done: (e) => ever(e, (s) => sameObject(s, 'x', 'y')),
    },
    {
      say: 'Here is the test. Point `x` somewhere else: `x = 99`. Watch `y`.',
      done: ({ snapshot }) => points(snapshot, 'x', '99') && points(snapshot, 'y', '10'),
    },
  ],
  outro:
    '`x` moved. `y` did not — it was never attached to `x`, it was pointing at the object, and it still is. A name is an arrow to a thing. Two arrows can land on the same thing, and moving one does not drag the other.',
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
      say: 'Afternoon. I am Ana — put me on the ticket, would you? `customer = "Ana"`',
      done: ({ snapshot }) => points(snapshot, 'customer', "'Ana'"),
    },
    {
      speaker: 'courier',
      say: 'And I am carrying 7 parcels today. `parcels = 7`',
      done: ({ snapshot }) => points(snapshot, 'parcels', '7'),
    },
    {
      speaker: 'courier',
      say: 'One more thing — each parcel weighs 2 kilos. How much am I carrying in total? Work it out from what you kept.',
      // Never said aloud by anyone, so it can only come from the stored
      // count. Asked of the robot's answers, not of its memory: replying
      // to a question leaves nothing behind in memory to check.
      done: ({ echoed }) => echoed.includes('14'),
    },
  ],
  outro:
    'Fourteen kilos. Notice the robot never stored *that* — it stored 7, and worked the rest out when it was asked. Facts go in memory; answers get made on the spot.',
}

export const LESSONS: Record<string, Lesson> = {
  [objectsFirst.id]: objectsFirst,
  [namesPoint.id]: namesPoint,
  [takeAnOrder.id]: takeAnOrder,
}
