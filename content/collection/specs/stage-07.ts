/**
 * Stage 7 — Following Nested Structure. How each item is graded.
 */
import type { Spec } from '../../../src/collection/model'
import type { RunEvidence } from '../../../src/memory/extract'
import { shown, visitsTo } from '../../../src/collection/facts'
import {
  block,
  choice,
  diagram,
  finishes,
  firstDifference,
  fix,
  forbid,
  line,
  number,
  order,
  output,
  prints,
  printsLine,
  py,
  requires,
  rule,
  write,
} from './helpers'

/** One row per visit to `bodyLine`: the named values once that line is done. */
const passes = (ev: RunEvidence, bodyLine: number, names: string[]): string[][] =>
  ev.visits.flatMap((v, i) => (v.line === bodyLine ? [names.map((n) => shown(ev.afterVisit(i), n) ?? '')] : []))

const printedLines = (ev: RunEvidence): string[] => ev.output.replace(/\n+$/, '').split('\n')

const C71_LAST = ['3 4', '4 5', '3 5', '4 4']

export const STAGE_7: Record<string, Spec> = {
  '7.1': {
    concepts: ['block-indent', 'nested-counts'],
    parts: [
      // The key counts the inner header as "2 times … 4 visits each": 8 visits.
      block(1, [2, 3, 4], { 1: 3, 2: 8, 3: 6, 4: 2, 5: 1 }, { prompt: 'Mark the outer loop’s body, and how many times each line is reached.' }),
      block(2, [3], null, { prompt: 'Now the inner loop’s body.' }),
    ],
  },

  '7.2': {
    concepts: ['nested-loops', 'loop-passes'],
    parts: [order([1, 2, 3, 2, 3], { first: 5 }), output('a 1\na 2\nb 1\nb 2')],
  },

  '7.3': {
    concepts: ['nested-loops', 'block-indent'],
    parts: [
      output('0 0\n0 1\n1 0\n1 1', { snippet: 'A' }),
      output('0 1\n1 1', { snippet: 'B' }),
      firstDifference(3),
      choice('In B, what is `b` bound to when the print runs, and why?', [
        '1 — the print is in the outer body, so it runs after the inner loop has finished, and `b` keeps the last value it was given',
        'Nothing — `b` is unbound outside its loop, so it raises NameError',
        '2 — the inner loop leaves `b` at the end of the range',
        '0 — the inner loop starts `b` over when it finishes',
      ]),
    ],
  },

  '7.4': {
    concepts: ['accumulator', 'nested-loops'],
    parts: [
      output('after row 3\nafter row 10\ntotal 10'),
      number('How many times does `total = total + cell` run?', (ev) => visitsTo(ev[0]!, 4), 4),
    ],
  },

  '7.5': {
    concepts: ['nested-counts', 'nested-loops'],
    parts: [
      {
        kind: 'table',
        prompt: 'One row per pass of the inner loop: `i`, `j` and `count` after the body runs.',
        columns: ['i', 'j', 'count'],
        truth: (ev) => passes(ev[0]!, 4, ['i', 'j', 'count']),
        model: [
          ['0', '0', '1'],
          ['0', '1', '2'],
          ['1', '0', '3'],
          ['1', '1', '4'],
          ['2', '0', '5'],
          ['2', '1', '6'],
        ],
      },
      output('6 2 1'),
    ],
  },

  '7.6': {
    concepts: ['break-scope', 'nested-loops'],
    parts: [
      output('found\nsearch over', { prompt: 'What does it actually print?' }),
      number('How many cells does the search look at (how many times does line 5 run)?', (ev) => visitsTo(ev[0]!, 5), 4),
      choice('So what actually happens?', [
        'The `break` leaves only the inner loop; the outer loop goes on and scans `[3, 4]` in full',
        'The `break` leaves both loops, so the search stops at once',
        'The `break` ends the program, and `search over` is printed by accident',
        'The `break` skips only the cell `2`, and the inner loop carries on',
      ]),
      fix(
        'grid = [[1, 2], [3, 4]]\ntarget = 2\nfound = False\nfor row in grid:\n    for cell in row:\n        if cell == target:\n            print("found")\n            found = True\n            break\n    if found:\n        break\nprint("search over")\n',
        [
          prints('found\nsearch over'),
          py('row is grid[0] and cell == target', 'The search should stop on the row and cell where the target was found — no row after it is scanned.'),
        ],
        { small: 4 },
      ),
    ],
  },

  '7.7': { concepts: ['break-continue', 'break-scope'], parts: [output('0 0\n0 2\n1 0\n1 2')] },

  '7.8': {
    concepts: ['mutate-vs-rebind', 'loop-rebind-inert'],
    parts: [
      output('[[1, 2, 0], [3, 4, 0]]\n[[1, 2], [3, 4]]'),
      choice('Why do the two grids end differently?', [
        '`row` is the inner list itself: `.append` changes that list, while `row = row + [0]` builds a new one and only moves the loop name',
        'The loop hands out copies of the rows, and only `.append` copies back',
        '`row + [0]` changes the row, but `print(grid2)` shows it before the change',
        'The second loop never runs, because `row` is already in use',
      ]),
    ],
  },

  '7.9': {
    concepts: ['loop-rebind-inert', 'slot-write'],
    parts: [
      output('[[1, 2], [3, 4]]', { prompt: 'What does it actually print?' }),
      choice('Why?', [
        '`cell = cell * 2` only moves the loop name `cell` to a new number; no list slot is written',
        'Numbers cannot be doubled inside a loop',
        'The inner loop is walking a copy of each row',
        '`print(grid)` shows the grid as it was before the loops',
      ]),
      fix(
        'grid = [[1, 2], [3, 4]]\nfor r in range(len(grid)):\n    for c in range(len(grid[r])):\n        grid[r][c] = grid[r][c] * 2\nprint(grid)\n',
        [py('grid == [[2, 4], [6, 8]]', 'Every cell of `grid` should be doubled.'), prints('[[2, 4], [6, 8]]')],
      ),
    ],
  },

  '7.10': {
    concepts: ['nested-loops', 'index'],
    parts: [
      output('[[10, 20, 30], [40, 50]]'),
      choice('Why would `range(3)` for the inner loop have been wrong?', [
        'The second row has only two slots, so `c = 2` would raise IndexError on `grid[1][2]`',
        'It would be fine — every grid has rows of the same length',
        'It would skip the last cell of the first row',
        'It would multiply the first row twice',
      ]),
    ],
  },

  '7.11': { concepts: ['enumerate-zip', 'nested-loops'], parts: [output('0 0 a\n0 1 b\n1 0 c\n1 1 d')] },

  '7.12': {
    concepts: ['nested-build', 'nested-loops', 'comprehension'],
    parts: [
      write(
        'table = []\nfor r in range(3):\n    row = []\n    for c in range(3):\n        row.append((r + 1) * (c + 1))\n    table.append(row)\n\nfor row in table:\n    print(row)\n',
        [
          finishes(),
          py('table == [[1, 2, 3], [2, 4, 6], [3, 6, 9]]', '`table[r][c]` should be `(r + 1) * (c + 1)`, for a 3×3 grid.'),
          py('len({id(r) for r in table}) == 3', 'The three rows must be three separate list objects.'),
          prints('[1, 2, 3]\n[2, 4, 6]\n[3, 6, 9]', 'Print the table one row per line.'),
          requires(String.raw`\bfor\b`, 'Build the rows with a loop or a comprehension.'),
          forbid(String.raw`\[\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\]`, 'Do not write the rows out as literals.'),
        ],
        { starter: '# Build table, then print it row by row.\n' },
      ),
    ],
  },

  '7.13': {
    concepts: ['nested-build', 'literal-new'],
    parts: [
      output('[[0, 1], [0, 1]] False', { snippet: 'A' }),
      output('[[0, 1, 0, 1], [0, 1, 0, 1]] True', { snippet: 'B' }),
      // The deciding line is `row = []`: line 3 of A, line 2 of B. The
      // traces agree — B's line 2 is where the two first behave differently.
      firstDifference(2),
      diagram({ before: 7 }, ['separate-inner-to-shared', { at: { after: 6, occurrence: 1 } }], {
        snippet: 'A',
        prompt: 'Which picture is A’s memory just before the print?',
      }),
      diagram({ before: 7 }, ['shared-inner-to-separate', { at: { after: 6, occurrence: 1 } }], {
        snippet: 'B',
        prompt: 'And B’s?',
      }),
    ],
  },

  '7.14': {
    concepts: ['nested-loops', 'range'],
    parts: [
      number('How many pairs does it collect?', (ev) => Number(printedLines(ev[0]!).at(-1)), 9),
      choice(
        'Which two things are wrong with the output? (Pick two.)',
        [
          'It pairs each name with itself, such as `("ann", "ann")`',
          'It has both orders of each pair, such as `("ann", "bo")` and `("bo", "ann")`',
          'It misses the last name, `"cy"`',
          'The inner loop only runs once',
        ],
        [0, 1],
      ),
      fix(
        'names = ["ann", "bo", "cy"]\npairs = []\nfor i in range(len(names)):\n    for j in range(i + 1, len(names)):\n        pairs.append((names[i], names[j]))\nprint(pairs)\nprint(len(pairs))\n',
        [
          py("pairs == [('ann', 'bo'), ('ann', 'cy'), ('bo', 'cy')]", 'Each pair of different names, once, in order: ann–bo, ann–cy, bo–cy.'),
          printsLine('3', 'It should report 3 pairs.'),
        ],
        { small: 3 },
      ),
    ],
  },

  '7.15': {
    concepts: ['break-continue', 'nested-counts'],
    parts: [
      output('6'),
      number('How many times does the `if a == b:` line run?', (ev) => visitsTo(ev[0]!, 4), 9),
    ],
  },

  '7.16': {
    concepts: ['break-scope', 'loop-passes'],
    parts: [
      order([1, 2, 3, 4, 3, 4, 3, 7, 2, 3, 4, 5, 6, 7, 8, 9]),
      output('3'),
      line('After the `break` on line 6, which line runs next?', 7, 7),
    ],
  },

  '7.17': {
    concepts: ['comprehension', 'nested-loops'],
    parts: [
      output('[1, 2, 3, 4]\n[1, 2, 3, 4]'),
      choice('In `[cell for row in matrix for cell in row]`, which loop is the outer one?', [
        '`for row in matrix` — the `for` clauses go outer to inner, in the same order as the written-out loops',
        '`for cell in row` — the clauses read right to left',
        '`cell` — the expression written first is the outer loop',
      ]),
    ],
  },

  '7.18': {
    concepts: ['repetition-pitfall', 'nested-build'],
    parts: [
      output('[[2, 0], [2, 0], [2, 0]]', { prompt: 'What does it actually print?' }),
      choice('Why does it fail?', [
        '`[[0, 0]] * 3` makes one inner list with three arrows to it, so each write lands on the same list',
        'The loop writes to the wrong index',
        '`counters[i][0] = i` copies the row before writing it',
        'The loop runs three times but only the last pass counts',
      ]),
      diagram('end', ['shared-inner-to-separate', { at: { after: 1 } }], { prompt: 'Which picture is memory at the end?' }),
      fix(
        'counters = [[0, 0] for _ in range(3)]\nfor i in range(3):\n    counters[i][0] = i\nprint(counters)\n',
        [
          py('len({id(c) for c in counters}) == 3', 'The three counters must be three separate lists.'),
          py('counters == [[0, 0], [1, 0], [2, 0]]', 'Each counter should get its own number in slot 0.'),
        ],
        { prompt: 'First fix: build the list so the inner literal runs three times.' },
      ),
      fix(
        'counters = [[0, 0], [0, 0], [0, 0]]\nfor i in range(3):\n    counters[i][0] = i\nprint(counters)\n',
        [
          py('len({id(c) for c in counters}) == 3', 'The three counters must be three separate lists.'),
          py('counters == [[0, 0], [1, 0], [2, 0]]', 'Each counter should get its own number in slot 0.'),
          forbid(String.raw`\bfor\s+_\b`, 'A different fix from the first one: no comprehension this time.'),
        ],
        { prompt: 'Second fix, a different way.' },
      ),
    ],
  },

  '7.19': {
    concepts: ['nested-counts', 'break-scope'],
    parts: [
      rule({ prompt: 'How do you work out how many times the innermost line runs?', wrongWord: 'it says "add" the loop sizes, or counts only the inner loop' }),
      rule({ prompt: 'Which loop does a `break` leave?', wrongWord: 'it says "the loop" without saying which one, or "the block"' }),
      rule({ prompt: 'On each outer pass, is the inner iterable walked from the start or from where it left off?', wrongWord: 'it says the inner loop "resets its variable" rather than walking its iterable afresh' }),
      rule({ prompt: 'How do you decide which loop a given line belongs to?', wrongWord: 'it says "the loop above it" without mentioning indentation' }),
    ],
  },

  /* ------------------------------ checkpoint ------------------------------ */

  'C7.1': {
    concepts: ['nested-counts'],
    parts: [
      number('How many lines does it print?', (ev) => printedLines(ev[0]!).length, 20),
      choice('And what is the last one?', C71_LAST, (ev) => C71_LAST.indexOf(printedLines(ev[0]!).at(-1) ?? ''), { err: 'flow' }),
    ],
  },

  'C7.2': { concepts: ['block-indent', 'nested-loops'], parts: [output('0 0\n0 1\n-\n1 0\n1 1\n-')] },

  'C7.3': {
    concepts: ['break-scope'],
    parts: [
      choice('What is the cause?', [
        'The `break` leaves only the inner loop, so the outer loop keeps going',
        'The `break` is in the wrong `if`',
        '`print` restarts the loop',
        'The target is found twice',
      ]),
      choice(
        'Which of these repair it? (Pick two.)',
        [
          'Set a flag before the inner `break`, then `break` again in the outer body when the flag is set',
          'Put the search in a function and `return` when the target is found',
          'Use `continue` instead of `break`',
          'Copy the grid before searching it',
        ],
        [0, 1],
      ),
    ],
  },

  'C7.4': {
    concepts: ['nested-build', 'comprehension'],
    parts: [
      output('[[9, 0], [0, 0]] False'),
      choice('Why is the identity check `False`?', [
        'The comprehension evaluates `[0] * 2` afresh on each pass, so the two rows are separate lists',
        '`rows[0][0] = 9` made a copy of the first row',
        '`is` compares the values, and the rows now hold different numbers',
        '`[0] * 2` always makes shared rows, but the write split them apart',
      ]),
      diagram({ before: 2 }, ['separate-inner-to-shared', { at: { after: 2 } }], { prompt: 'Which picture is memory after line 1, just before the write?' }),
    ],
  },

  'C7.5': {
    concepts: ['block-indent', 'nested-counts'],
    parts: [
      // The key says the `for b` line runs "twice" — once per outer pass.
      // The collection counts header visits (a pass + the "nothing left"
      // check each time), so it is reached 4 times; the trace agrees.
      block(2, [3, 4, 5], { 1: 1, 2: 3, 3: 2, 4: 4, 5: 2, 6: 1 }, { prompt: 'Mark the outer loop’s body, and how many times each line is reached.' }),
      block(4, [5], null, { prompt: 'Now the inner loop’s body.' }),
      output('23'),
    ],
  },

  'C7.6': {
    concepts: ['comprehension', 'nested-loops'],
    parts: [
      write(
        'out = [cell * 2 for row in [[1, 2], [3]] for cell in row]\n',
        [
          finishes(),
          py('out == [2, 4, 6]', '`out` should be `[2, 4, 6]`.'),
          requires(String.raw`\[.*\bfor\b.*\bfor\b.*\]`, 'Write one comprehension with two `for` clauses.'),
          forbid(String.raw`^\s*for\b`, 'No `for` statements — only the comprehension.'),
          forbid(String.raw`\.append\(`, 'No `.append` — the comprehension builds the list.'),
        ],
        { starter: 'out = \n' },
      ),
    ],
  },
}
