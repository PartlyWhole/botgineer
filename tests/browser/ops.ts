/**
 * The lines that answer the operations level right, in order, with what
 * the robot makes of each — one per step of `content/lessons/operations.ts`.
 *
 * A module of its own, with no imports, so the unit suite can hold it to
 * the lesson (`tests/unit/lessons/every.test.ts`) without loading
 * Playwright: a list here went stale once, when the lesson was rewritten,
 * and only a browser journey noticed. The browser journeys import it
 * through `helpers.ts` as `OPS`.
 */
export const OPS_ANSWERS: readonly (readonly [source: string, type: string, repr: string])[] = [
  ['7 * 6', 'int', '42'],
  ['20 - 7', 'int', '13'],
  ['9 / 2', 'float', '4.5'],
  ['8 / 2', 'float', '4.0'],
  ['2 + 0.5', 'float', '2.5'],
  ['3 > 5', 'bool', 'False'],
  ['7 * 6 == 42', 'bool', 'True'],
  ['"bot" + "gineer"', 'str', "'botgineer'"],
  ['"ha" * 5', 'str', "'hahahahaha'"],
  ['ord("M")', 'int', '77'],
  ['True + True + True', 'int', '3'],
  ['2 + 3 * 4', 'int', '14'],
  ['(2 + 3) * 4', 'int', '20'],
]
