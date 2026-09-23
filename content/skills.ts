/**
 * The skills: the things a player can get better at, one at a time.
 *
 * A lesson *introduces* skills (`Lesson.teaches`); practice *exercises*
 * them, with generated questions (`src/practice/exercises.ts`), and
 * mastery tracks each one separately (`src/mastery/mastery.ts`). A skill
 * is small on purpose — "division gives a float", not "arithmetic" — so
 * that knowing which one is weak says what to practise.
 *
 * Content, like the lessons: adding a skill means naming it here, teaching
 * it in a lesson and giving it a generator. The unit test insists on all
 * three.
 */

export type Skill = {
  id: string
  title: string
  /** One line, in the player's words: what you can do once you have it. */
  can: string
  /** The roadmap unit it belongs to. */
  unit: string
}

export const SKILLS: Skill[] = [
  { id: 'int', title: 'Whole numbers', can: 'Count with an int', unit: 'thinking' },
  { id: 'float', title: 'Decimals', can: 'Measure with a float', unit: 'thinking' },
  { id: 'str', title: 'Text', can: 'Write a word as a str, in quotes', unit: 'thinking' },
  { id: 'bool', title: 'True and False', can: 'Answer yes or no with a bool', unit: 'thinking' },
  { id: 'arith', title: 'Arithmetic', can: 'Add, subtract and multiply', unit: 'thinking' },
  { id: 'divide', title: 'Division', can: 'Share out with /, which always gives a float', unit: 'thinking' },
  { id: 'join', title: 'Joining text', can: 'Stick words together with +', unit: 'thinking' },
  { id: 'compare', title: 'Comparisons', can: 'Ask which is bigger', unit: 'thinking' },
  { id: 'order', title: 'Order of operations', can: 'Know what gets worked out first', unit: 'thinking' },
  { id: 'bind', title: 'Naming things', can: 'Keep a value under a name', unit: 'remembering' },
  { id: 'alias', title: 'Two names, one thing', can: 'Point a second name at the same object', unit: 'remembering' },
  { id: 'rebind', title: 'Moving a name', can: 'Point a name somewhere else, and know what stays', unit: 'remembering' },
  { id: 'recall', title: 'Working from memory', can: 'Work an answer out from what you kept', unit: 'remembering' },
]

export const skillById = (id: string): Skill | undefined => SKILLS.find((s) => s.id === id)

export const skillsOfUnit = (unit: string): Skill[] => SKILLS.filter((s) => s.unit === unit)
