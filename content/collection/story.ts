/**
 * The story the reading stages are told in: one line from the crow at
 * the start of each stage's ideas (docs/PEDAGOGY.md §2, R12).
 *
 * The warm-up ends with a robot that can run a whole program. From here
 * on other people write the programs, and the robot runs them faithfully,
 * bugs and all. Mira is the thread: each stage opens on something her
 * program did that she did not expect, and it is always the thing that
 * stage teaches you to see coming. The line states the robot's problem —
 * or Mira's — and never the answer; the ideas are the answer.
 *
 * Content, not code, and kept apart from the collection's markdown, which
 * stays the source of truth for the collection's own prose (invariant 21).
 * Each line is one sentence a person would say, ≤ 110 characters (R2);
 * `tests/unit/reading.test.ts` holds them to it.
 */

/** Said first, by the crow, at `sN-ideas`. Index 0 is Stage 1. */
export const STAGE_OPENERS: readonly string[] = [
  // 1 — straight-line code: names, objects, one line at a time.
  'Mira has written the robot a program, and she wants to know what it does before she runs it.',
  // 2 — changing an object vs moving a name.
  'Mira’s program changed her list, and she swears she didn’t touch it.',
  // 3 — brackets and keys: reading out of a slot, or writing into one.
  'Mira’s program wrote into the wrong slot of her list, and she can’t see which line did it.',
  // 4 — sharing and copies.
  'Mira copied her seating plan, changed the copy, and the original changed as well.',
  // 5 — one block: the lines a loop repeats.
  'Mira’s loop should add up the week’s parcels, but the total comes out wrong.',
  // 6 — what a loop hands you, for each kind of collection.
  'Mira looped over her price list and got the names of things back, not the prices.',
  // 7 — nested loops.
  'Mira’s search found the parcel, then carried on looking through every other shelf.',
  // 8 — the function boundary.
  'Mira handed her list to a function to read, and it came back changed.',
  // 9 — everything at once.
  'Mira’s delivery program is long, and it has three bugs in it that nobody has found.',
]

/** The bridge into reading, said once, at `s1-ideas` (§3). */
export const BRIDGE = 'A good engineer knows what the robot will do before it does it.'

/** Stage 1 follows the console lessons on names: the same idea, now written
 *  down. Said after the bridge. */
export const STAGE_1_LEAD = 'You met names at the console. Here is the same idea, written down.'

export const openerOf = (stage: number): string => STAGE_OPENERS[stage - 1] ?? ''
