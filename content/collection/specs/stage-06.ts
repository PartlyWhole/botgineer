/**
 * Stage 6 — Iterating Different Collections. How each item is graded.
 *
 * Set order is the collection's one deliberately unpinned output: 6.10 is
 * graded on "the same words, any order" and on the source asking for an
 * order, never on the order this run happened to produce.
 */
import type { Part, Spec } from '../../../src/collection/model'
import type { MemorySnapshot } from '../../../src/memory/model'
import { countOf, targetOf, visitsTo } from '../../../src/collection/facts'
import {
  choice,
  diagram,
  finishes,
  firstDifference,
  fix,
  forbid,
  labels,
  line,
  number,
  output,
  prints,
  printsLine,
  py,
  requires,
  rule,
  write,
} from './helpers'

/** How many slots the collection a name points at holds. */
const sizeOf = (s: MemorySnapshot, name: string): number => {
  const id = targetOf(s, name)
  return (id !== null ? s.objects[id]?.elements?.length : undefined) ?? -1
}

/** Which of C6.2's six iterables gave the same items on a second walk,
 *  read from the probe's `True`/`False` lines. */
const rewalkable = (text: string): number[] =>
  text
    .trim()
    .split('\n')
    .flatMap((l, i) => (l.trim() === 'True' ? [i] : []))

/** A comprehension anywhere in the source: a bracket, then `for … in`
 *  later on the same line. A `for` statement starts its line instead. */
const COMPREHENSION = String.raw`[\[{(][^\n]*\bfor\s+[\w, ]+\s+in\s`

export const STAGE_6: Record<string, Spec> = {
  '6.1': {
    concepts: ['iterable-items'],
    parts: [
      output('h 1\ni 1'),
      choice('What is `c` bound to on each pass?', [
        'A one-character string',
        'A separate character type, which `len` happens to accept',
        'The position of the character, 0 then 1',
      ]),
    ],
  },

  '6.2': { concepts: ['dict-iteration'], parts: [output('ann\nbo\n---\n30\n25')] },

  '6.3': {
    concepts: ['dict-iteration', 'iterable-items'],
    parts: [
      output('a 1\nb 2', { snippet: 'A' }),
      output('a 1\nb 2', { snippet: 'B' }),
      choice('One advantage of each form?', [
        'A suits walking the keys and only sometimes needing a value; B hands over each value with its key, so there is no repeated lookup to get wrong',
        '`.items()` makes the loop walk the dictionary in a different order',
        'B runs the loop body fewer times than A',
        'A cannot reach the values at all',
      ]),
    ],
  },

  '6.4': {
    concepts: ['iterable-items', 'dict-iteration'],
    parts: [
      labels(
        'for k, v in scores.items():',
        [
          ['for', 'opens a loop and its block'],
          ['k, v', 'two loop variables: each pass unpacks the tuple handed over, binding k to its first item and v to its second'],
          ['scores.items()', 'an iterable of two-item (key, value) tuples'],
          [':', 'ends the header; the indented block runs once per pass'],
        ],
        ['one compound name bound to the whole pair', 'a list of the values only'],
      ),
    ],
  },

  '6.5': {
    concepts: ['iterable-items', 'enumerate-zip'],
    parts: [output("1 a\n2 b\n(1, 'a') 2\n(2, 'b') 2")],
  },

  '6.6': {
    concepts: ['generator-exhaustion'],
    parts: [
      output('[0, 1, 4, 9]\n[]\n14'),
      choice('Why is the second line `[]`?', [
        'The first `list(...)` ran the recipe to the end; an exhausted generator has nothing further to produce, so the second list is empty',
        'The generator stored its values, and the first `list(...)` moved them out',
        'Exhaustion raised an error, and `list` turned it into an empty list',
        'The first `print` rebound `squares` to an empty list',
      ]),
    ],
  },

  '6.7': {
    concepts: ['generator-exhaustion', 'range'],
    parts: [
      output('3\n0', { snippet: 'A' }),
      output('3\n3', { snippet: 'B' }),
      // The traces part at line 1 — a generator is bound in A, a range in
      // B — but the key's "why" is about what line 3 prints, so ask that.
      line('Which line of A prints something B does not?', 3, 3, { snippet: 'A' }),
      choice('Why do they differ?', [
        'A range is a description, recomputed from the start on every walk; a generator is a position in a computation, and once past the end it is exhausted',
        'The range stores its three numbers and the generator stores none',
        'The first `list(g)` deletes the generator',
        '`len` counts a generator’s items differently from a range’s',
      ]),
    ],
  },

  '6.8': {
    concepts: ['generator-exhaustion', 'comprehension'],
    parts: [
      output('6\n0', { prompt: 'What does it actually print?' }),
      choice('Why?', [
        'The first `sum` walks the generator to its end; the second finds it exhausted and totals nothing',
        'The first `sum` removes the items from a list',
        'The second `sum` fails, and a failed `sum` prints 0',
        '`sum` can only be used once per program',
      ]),
      fix('values = [n for n in [1, 2, 3]]\nprint(sum(values))\nprint(sum(values))\n', [prints('6\n6', 'It should print the total, 6, twice.')]),
    ],
  },

  '6.9': {
    concepts: ['set-order', 'dict-keys'],
    parts: [
      output('3\n[1, 2, 3]\n3'),
      number('How many items does `nums` hold at the end?', (ev) => sizeOf(ev[0]!.final, 'nums'), 3),
      choice('What can you *not* safely predict about this snippet?', [
        'The order the set would hand out its items if you looped over it directly',
        'How many items the set holds after `nums.add(1)`',
        'What `sorted(nums)` prints',
        'Whether `nums.add(1)` raises an error',
      ]),
    ],
  },

  '6.10': {
    concepts: ['set-order'],
    parts: [
      // Unpinned: which words, not which order.
      output('apple\nfig\npear', { match: 'unordered-lines', prompt: 'Which words does it print? (Any order.)' }),
      choice('Why is the order unreliable?', [
        'A set keeps no order you may rely on; for text it depends on a value Python randomizes at start-up, so it can differ between runs of the same program',
        'A set keeps the words in the order they were typed, so it is reliable',
        'A set sorts text alphabetically, so it only goes wrong for numbers',
        'The loop variable is rebound in a random order on purpose',
      ]),
      fix('words = {"pear", "fig", "apple"}\nfor w in sorted(words):\n    print(w)\n', [
        finishes(),
        printsLine('apple', 'Every word should still be printed.'),
        printsLine('fig', 'Every word should still be printed.'),
        printsLine('pear', 'Every word should still be printed.'),
        // The one check the unfixed snippet fails every run, whatever order
        // the set happens to hand out today: the source must ask for one.
        requires(
          String.raw`\bsorted\(|^\s*words\s*=\s*\[`,
          'Ask for an order — loop over `sorted(words)` — or keep the words in a list.',
        ),
      ]),
    ],
  },

  '6.11': {
    concepts: ['enumerate-zip'],
    parts: [
      output('0 a\n1 b\n2 c\n---\n1 a\n2 b\n3 c'),
      choice('What does `start=1` change?', [
        'Only the first number handed over; every character is still walked',
        'It skips the first character',
        'It makes the loop run one extra pass',
      ]),
    ],
  },

  '6.12': {
    concepts: ['enumerate-zip', 'range'],
    parts: [
      output('0 a\n1 b\n2 c', { snippet: 'A' }),
      output('0 a\n1 b\n2 c', { snippet: 'B' }),
      choice('When is **A** still the right choice?', [
        'When you need the position to address the list — writing back with `xs[i] = …`, indexing a second list, or looking at `xs[i + 1]`',
        'Whenever the list is long',
        'When you only want each item',
        'Never — `range(len(xs))` is always a mistake',
      ]),
    ],
  },

  '6.13': {
    concepts: ['enumerate-zip'],
    parts: [
      output("[(1, 'x'), (2, 'y')]\n1 x\n2 y"),
      number('How many passes does the `for` loop make?', (ev) => visitsTo(ev[0]!, 3), 2),
    ],
  },

  '6.14': {
    concepts: ['comprehension', 'generator-exhaustion'],
    parts: [
      output('[0, 2, 4, 6] list', { snippet: 'A' }),
      output('True generator\n[0, 2, 4, 6]', { snippet: 'B' }),
      firstDifference(1),
      choice('Which punctuation decides it?', [
        'Square brackets versus round brackets around the comprehension',
        'The `for` inside the brackets',
        'The `*` in `n * 2`',
        'Nothing — the brackets are interchangeable styling',
      ]),
    ],
  },

  '6.15': {
    concepts: ['repetition-pitfall', 'comprehension'],
    parts: [
      output('[[1, 0, 0], [1, 0, 0], [1, 0, 0]]', { prompt: 'What does it actually print?' }),
      diagram('end', ['shared-inner-to-separate', { at: { before: 3 } }], { prompt: 'Which picture is memory at the end?' }),
      number('How many inner list objects are there?', (ev) => countOf(ev[0]!.final, 'list') - 1, 1),
      fix('size = 3\ngrid = [[0] * size for _ in range(size)]\ngrid[0][0] = 1\nprint(grid)\n', [
        prints('[[1, 0, 0], [0, 0, 0], [0, 0, 0]]'),
        py(
          'len(grid) == size and all(grid[i] is not grid[j] for i in range(size) for j in range(size) if i != j)',
          'Every row must be its own list object.',
        ),
        requires(COMPREHENSION, 'Build it with a comprehension, so it works for any size.'),
      ]),
    ],
  },

  '6.16': {
    concepts: ['comprehension', 'dict-iteration'],
    parts: [
      output("{'a': 2, 'b': 1}\n{'a': [1, 2], 'b': [3]}"),
      choice('Did the comprehension change `data`?', [
        'No — it read `data` and built a new dictionary',
        'Yes — it replaced each list in `data` with its length',
        'Yes — it added the lengths to `data` as new keys',
      ]),
      number('How many dictionary objects exist at the end?', (ev) => countOf(ev[0]!.final, 'dict'), 2),
    ],
  },

  '6.17': {
    concepts: ['mutation-during-iteration', 'dict-iteration'],
    parts: [
      output('', { raises: 'RuntimeError', prompt: 'What happens?' }),
      choice('Why?', [
        'Deleting a key while the loop walks the dictionary invalidates the walk, and a dictionary detects the change and stops',
        'It skips a key silently, the way a list would',
        '`del` cannot be used inside a loop body',
        '`counts[k] == 0` is an error for a key with value 0',
      ]),
      fix('counts = {"a": 1, "b": 0, "c": 0}\nfor k in list(counts):\n    if counts[k] == 0:\n        del counts[k]\nprint(counts)\n', [
        finishes(),
        py("counts == {'a': 1}", 'Only the key with a non-zero value should be left.'),
        prints("{'a': 1}"),
      ]),
    ],
  },

  '6.18': {
    concepts: ['accumulator', 'dict-lookup', 'dict-iteration'],
    parts: [
      write(
        'text = "hello world"\ncounts = {}\nfor c in text:\n    if c == " ":\n        continue\n    counts[c] = counts.get(c, 0) + 1\nfor c in sorted(counts):\n    print(c, counts[c])\n',
        [
          finishes(),
          py('text == "hello world"', 'Start from `text = "hello world"`.'),
          prints('d 1\ne 1\nh 1\nl 3\no 2\nr 1\nw 1', 'Print each character and its count, in alphabetical order, skipping the space.'),
          forbid(COMPREHENSION, 'No comprehension — build the dictionary with a loop.'),
          requires(String.raw`\.get\(|\bif\b`, 'Use `.get(...)` or an `if` to handle a character seen for the first time.'),
        ],
        { starter: 'text = "hello world"\n' },
      ),
    ],
  },

  '6.19': {
    concepts: ['generator-exhaustion', 'iterable-items'],
    parts: [
      output('1\n2\nloop 3\n[]'),
      choice('Where does the `for` loop start?', [
        'Where the iterator already is — only the third item is left',
        'At the start of `xs`, since `xs` still has three items',
        'After the end, so it makes no passes',
      ]),
    ],
  },

  '6.20': {
    concepts: ['dict-iteration', 'generator-exhaustion', 'comprehension'],
    parts: [
      rule({ prompt: 'What does a `for` loop hand you when you loop over a dictionary?', wrongWord: 'it says "the keys" but not that iterating a dictionary yields them' }),
      rule({
        prompt: 'What is the difference between `[...]` and `(...)` around a comprehension?',
        wrongWord: 'it says "now versus on demand" without naming a list comprehension and a generator expression',
        err: 'syntax',
      }),
      rule({
        prompt: 'Why can you loop over a `range` twice but not a generator?',
        wrongWord: 'it says the generator "runs out" without the word exhausted, or iterable versus iterator',
        err: 'object',
      }),
      rule({
        prompt: 'What must be true of an object for it to be a set item?',
        wrongWord: 'it says "it cannot change" without the word hashable',
        err: 'object',
      }),
    ],
  },

  /* ------------------------------ checkpoint ------------------------------ */

  'C6.1': { concepts: ['dict-iteration'], parts: [output('x!')] },

  'C6.2': {
    concepts: ['generator-exhaustion', 'iterable-items'],
    // Walks each one twice and says whether the second walk saw the same
    // items, so the answer is the interpreter's.
    code: [
      'items = [[1, 2, 3], range(3), (n for n in range(3)), "abc", {1, 2}, {"a": 1}.items()]\nfor it in items:\n    print(list(it) == list(it))\n',
    ],
    parts: [
      {
        ...(choice(
          'Which of these can be walked more than once? Pick every one.',
          ['`[1, 2, 3]`', '`range(3)`', '`(n for n in range(3))`', '`"abc"`', '`{1, 2}`', '`{"a": 1}.items()`'],
          (ev) => rewalkable(ev[0]!.output),
        ) as Part & { kind: 'choice' }),
        model: [0, 1, 3, 4, 5],
      },
    ],
  },

  'C6.3': {
    concepts: ['generator-exhaustion'],
    parts: [
      output('True\n[3, 4]'),
      choice('Why only `[3, 4]`?', [
        'The `in` test walked the generator up to and including 2, and that part is consumed',
        '`in` removes the item it finds from the generator, and nothing else',
        '`list(g)` skips the first three values on purpose',
      ]),
    ],
  },

  'C6.4': {
    concepts: ['enumerate-zip', 'iterable-items'],
    code: ['xs = [1, 2, 3]\nfor i, x in xs:\n    print(i, x)\n'],
    parts: [
      output('', { raises: 'TypeError', prompt: 'What happens?' }),
      choice('What does unpacking `i, x` expect?', [
        'Each item handed over to be a container of exactly two things — here each is a plain number',
        'The list to have exactly two items',
        'A second list to take the positions from',
      ]),
      fix('xs = [1, 2, 3]\nfor i, x in enumerate(xs):\n    print(i, x)\n', [
        finishes(),
        py('x == 3', 'The loop should still walk every item.'),
      ]),
    ],
  },

  'C6.5': {
    concepts: ['comprehension'],
    parts: [
      write(
        'out = [w.upper() for w in ["ann", "bo", "cy"] if len(w) > 2]\n',
        [
          finishes(),
          py("out == ['ANN']", '`out` should be the list `[\'ANN\']`.'),
          requires(COMPREHENSION, 'Use a comprehension.'),
          forbid(String.raw`\.append\(`, 'No `.append` — the comprehension builds the list.'),
        ],
        { starter: 'out = []\nfor w in ["ann", "bo", "cy"]:\n    if len(w) > 2:\n        out.append(w.upper())\n' },
      ),
    ],
  },

  'C6.6': {
    concepts: ['iterable-items', 'dict-keys'],
    parts: [rule({ wrongWord: 'each is described correctly in plain words, but without the terms iterable, loop variable and hashable' })],
  },
}
