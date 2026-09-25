/**
 * The concepts: the things a player can get better at, one at a time.
 *
 * Two families, one mastery model. The warm-up's *skills* came first: a
 * lesson introduces them (`Lesson.teaches`) and generated practice
 * exercises them (`src/practice/exercises.ts`). The Reading Python
 * collection's *concepts* are exercised by its own items — each spec tags
 * one or two (`content/collection/specs/`), and generated variants of the
 * templatable families practise them again (`src/collection/variants.ts`).
 *
 * A concept is small on purpose — "a slice builds a new list", not
 * "lists" — so that knowing which one is weak says what to read again.
 *
 * `unit` is the roadmap unit a concept belongs to, which is where its
 * practice lives and where the skills screen files it.
 */

export type Concept = {
  id: string
  title: string
  /** One line, in the player's words: what you can do once you have it. */
  can: string
  /** The roadmap unit it belongs to. */
  unit: string
}

/** The warm-up's skills, taught by lessons and practised by generators.
 *  `char` is an idea rather than a Python type: Python keeps a character
 *  as a `str` one long, and its exercises are judged that way. */
export const SKILLS: Concept[] = [
  { id: 'int', title: 'Whole numbers', can: 'Count with an int', unit: 'thinking' },
  { id: 'float', title: 'Decimals', can: 'Measure with a float', unit: 'thinking' },
  { id: 'char', title: 'Characters', can: 'Write one letter as a str of length one, in quotes', unit: 'thinking' },
  { id: 'str', title: 'Text', can: 'Write a word as a str, in quotes', unit: 'thinking' },
  { id: 'bool', title: 'True and False', can: 'Answer yes or no with a bool', unit: 'thinking' },
  { id: 'kind', title: 'Choosing the kind', can: 'Pick bool, int, float, char or str for the question being asked', unit: 'thinking' },
  { id: 'arith', title: 'Arithmetic', can: 'Add, subtract and multiply', unit: 'thinking' },
  { id: 'divide', title: 'Division', can: 'Share out with /, which always gives a float', unit: 'thinking' },
  { id: 'join', title: 'Joining text', can: 'Stick words together with +', unit: 'thinking' },
  { id: 'compare', title: 'Comparisons', can: 'Ask which is bigger', unit: 'thinking' },
  { id: 'order', title: 'Order of operations', can: 'Know what gets worked out first', unit: 'thinking' },
  { id: 'bind', title: 'Naming things', can: 'Keep a value under a name', unit: 'stage-1' },
  { id: 'alias', title: 'Two names, one thing', can: 'Point a second name at the same object', unit: 'stage-1' },
  { id: 'rebind', title: 'Moving a name', can: 'Point a name somewhere else, and know what stays', unit: 'stage-1' },
  { id: 'recall', title: 'Working from memory', can: 'Work an answer out from what you kept', unit: 'stage-1' },
]

/** The collection's concepts. `bind`, `alias` and `rebind` above are
 *  Stage 1's too, and the collection's items tag them. */
export const COLLECTION_CONCEPTS: Concept[] = [
  // Stage 1 — straight-line code
  { id: 'rhs-first', title: 'Right side first', can: 'Work out the right of = before any name moves', unit: 'stage-1' },
  { id: 'literal-new', title: 'A literal makes a new object', can: 'Know that [1, 2] builds a fresh list every time', unit: 'stage-1' },
  { id: 'identity', title: 'Same object, or equal?', can: 'Tell is and id() apart from ==', unit: 'stage-1' },
  { id: 'print-none', title: 'Printing is not producing', can: 'Know print shows an object and hands back None', unit: 'stage-1' },
  { id: 'call-expr', title: 'A call makes an object', can: 'Read f(x) as work that produces one object', unit: 'stage-1' },

  // Stage 2 — change versus replace
  { id: 'mutate-vs-rebind', title: 'Change, or replace?', can: 'Tell a line that changes an object from one that moves a name', unit: 'stage-2' },
  { id: 'method-returns-none', title: 'Changing methods return None', can: 'Know .append and .sort hand back nothing', unit: 'stage-2' },
  { id: 'plus-equals', title: 'What += does', can: 'Know += changes a list but replaces a number', unit: 'stage-2' },
  { id: 'immutable-replace', title: 'Unchangeable objects', can: 'Know text, numbers and tuples can only be replaced', unit: 'stage-2' },

  // Stage 3 — brackets and keys
  { id: 'index', title: 'Reading a slot', can: 'Read xs[i] from 0, and from the end', unit: 'stage-3' },
  { id: 'slice-new', title: 'A slice is new', can: 'Know xs[a:b] builds a new list and stops before b', unit: 'stage-3' },
  { id: 'slot-write', title: 'Writing a slot', can: 'Know xs[i] = v changes the list, not the name', unit: 'stage-3' },
  { id: 'dict-lookup', title: 'Looking up a key', can: 'Read d[k], d.get(k) and what a missing key does', unit: 'stage-3' },
  { id: 'dict-keys', title: 'What a key can be', can: 'Know in asks about keys, and keys must be hashable', unit: 'stage-3' },
  { id: 'nested-access', title: 'Brackets left to right', can: 'Read d["a"][0]["b"] one step at a time', unit: 'stage-3' },

  // Stage 4 — sharing and copies
  { id: 'container-arrows', title: 'Containers hold arrows', can: 'Draw a list as pointers, not boxes of values', unit: 'stage-4' },
  { id: 'shallow-copy', title: 'Shallow copies', can: 'Know xs[:] copies the outer list and shares the inside', unit: 'stage-4' },
  { id: 'deep-copy', title: 'Deep copies', can: 'Know when copy.deepcopy is needed, and when it is not', unit: 'stage-4' },
  { id: 'repetition-pitfall', title: 'The * pitfall', can: 'See that [[0]] * 3 is one list three times', unit: 'stage-4' },
  { id: 'copy-level', title: 'Which level was copied?', can: 'Ask the diagnostic question before blaming a copy', unit: 'stage-4' },

  // Stage 5 — one block
  { id: 'block-indent', title: 'Indentation is the block', can: 'Mark a loop body by indentation alone', unit: 'stage-5' },
  { id: 'loop-passes', title: 'Counting passes', can: 'Number the lines of a loop, header visits included', unit: 'stage-5' },
  { id: 'accumulator', title: 'Accumulators', can: 'Start the running total before the loop, and follow it', unit: 'stage-5' },
  { id: 'loop-rebind-inert', title: 'Rebinding the loop name', can: 'Know x = … in the body leaves the list alone', unit: 'stage-5' },
  { id: 'range', title: 'range', can: 'Say what range(a, b, step) hands out', unit: 'stage-5' },
  { id: 'break-continue', title: 'break and continue', can: 'Say where each one sends the loop', unit: 'stage-5' },
  { id: 'mutation-during-iteration', title: 'Changing what you walk', can: 'Spot the skipped item when a loop edits its own list', unit: 'stage-5' },

  // Stage 6 — iterating collections
  { id: 'iterable-items', title: 'What a loop is handed', can: 'Say what each kind of collection gives a for loop', unit: 'stage-6' },
  { id: 'dict-iteration', title: 'Walking a dictionary', can: 'Know a dict hands over keys, and .items() pairs', unit: 'stage-6' },
  { id: 'set-order', title: 'Set order', can: 'Never rely on the order a set comes out in', unit: 'stage-6' },
  { id: 'generator-exhaustion', title: 'Generators run once', can: 'Know a generator is used up after one walk', unit: 'stage-6' },
  { id: 'comprehension', title: 'Comprehensions', can: 'Read [e for x in xs if c] as a new list', unit: 'stage-6' },
  { id: 'enumerate-zip', title: 'enumerate and zip', can: 'Unpack the pairs they hand over', unit: 'stage-6' },

  // Stage 7 — nested structure
  { id: 'nested-loops', title: 'Loops inside loops', can: 'Finish the inner loop before the outer one moves on', unit: 'stage-7' },
  { id: 'nested-counts', title: 'Nested counts', can: 'Multiply passes to count how often a line runs', unit: 'stage-7' },
  { id: 'break-scope', title: 'What break leaves', can: 'Know break ends only the innermost loop', unit: 'stage-7' },
  { id: 'nested-build', title: 'Building rows', can: 'Make a fresh inner list on every outer pass', unit: 'stage-7' },

  // Stage 8 — the function boundary
  { id: 'def-vs-call', title: 'def is not a call', can: 'Know def builds a function and runs nothing', unit: 'stage-8' },
  { id: 'param-binding', title: 'Parameters are names', can: 'Know rebinding a parameter leaves the caller alone', unit: 'stage-8' },
  { id: 'param-mutation', title: 'Changes cross the boundary', can: 'Know changing an argument’s object shows up outside', unit: 'stage-8' },
  { id: 'local-scope', title: 'Local names', can: 'Keep a call’s names apart from the caller’s', unit: 'stage-8' },
  { id: 'return-object', title: 'return hands back an object', can: 'Know a returned object is not a copy', unit: 'stage-8' },
  { id: 'return-exits', title: 'return leaves', can: 'Know nothing after return runs', unit: 'stage-8' },
  { id: 'mutable-default', title: 'Mutable defaults', can: 'Know a default list is built once and shared', unit: 'stage-8' },

  // Stage 9 — integration
  { id: 'defect-attribution', title: 'Finding the causing line', can: 'Name the line where the wrong event happens, not the symptom', unit: 'stage-9' },
  { id: 'minimal-repair', title: 'The smallest fix', can: 'Repair a bug by changing as little as possible, and say why', unit: 'stage-9' },
]

export const CONCEPTS: Concept[] = [...SKILLS, ...COLLECTION_CONCEPTS]

export const conceptById = (id: string): Concept | undefined => CONCEPTS.find((s) => s.id === id)

export const conceptsOfUnit = (unit: string): Concept[] => CONCEPTS.filter((s) => s.unit === unit)

/** The warm-up skills of a unit: what its generated console practice asks
 *  about. The collection's concepts are practised by their own variants. */
export const skillsOfUnit = (unit: string): Concept[] => SKILLS.filter((s) => s.unit === unit)
