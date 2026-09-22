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
 * The rule for writing a step: its test must be answerable from memory
 * alone. A step that means "read this and nod" cannot be checked, would
 * need state to remember the nod, and is a paragraph rather than a task.
 */
import type { MemorySnapshot } from '../src/memory/model'
import { unreferenced } from '../src/memory/model'

export type LessonStep = {
  /** What the guide says while this step is the current one. */
  say: string
  /** True once the robot's memory shows the step was done. */
  done: (snapshot: MemorySnapshot) => boolean
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
      done: (s) => has(s, 'int', '10'),
    },
    {
      say: 'That is an object now, sitting in my memory. Make me a word: `"John"`, quotes and all.',
      done: (s) => has(s, 'str', "'John'"),
    },
    {
      say: 'Now make one you did not type. Try `3 + 4`.',
      done: (s) => has(s, 'int', '7'),
    },
    {
      say: 'One more, and this one holds others: `[1, 2, 3]`.',
      done: (s) => loneCollection(s, 3),
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
export function progress(lesson: Lesson, snapshot: MemorySnapshot): number {
  const at = lesson.steps.findIndex((step) => !step.done(snapshot))
  return at === -1 ? lesson.steps.length : at
}

/** What the guide should be saying right now. */
export function guidance(lesson: Lesson, snapshot: MemorySnapshot): string {
  const at = progress(lesson, snapshot)
  return at === lesson.steps.length ? lesson.outro : lesson.steps[at]!.say
}

export const LESSONS: Record<string, Lesson> = { [objectsFirst.id]: objectsFirst }
