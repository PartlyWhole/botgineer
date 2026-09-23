/**
 * Stage 5 — Following One Block. How each item is graded.
 */
import type { Spec } from '../../../src/collection/model'
import type { RunEvidence } from '../../../src/memory/extract'
import { shown, visitsTo } from '../../../src/collection/facts'
import {
  block,
  choice,
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

/** One row per pass of the loop whose body starts on `bodyLine`: what
 *  each name showed, read from the run rather than typed in. `cols` says
 *  what each cell is — the pass number, a name just after the loop line
 *  handed it over, or a name before / after the body line ran. */
type Col = { pass: true } | { name: string; when: 'before' | 'after' }

function passRows(ev: RunEvidence, bodyLine: number, cols: Col[]): string[][] {
  const rows: string[][] = []
  for (let k = 1; k <= visitsTo(ev, bodyLine); k++) {
    rows.push(
      cols.map((c) =>
        'pass' in c
          ? String(k)
          : (shown(ev.at(c.when === 'before' ? { before: bodyLine, occurrence: k } : { after: bodyLine, occurrence: k }), c.name) ?? '—'),
      ),
    )
  }
  return rows
}

export const STAGE_5: Record<string, Spec> = {
  '5.1': {
    concepts: ['block-indent', 'loop-passes'],
    parts: [block(2, [3, 4], { 1: 1, 2: 4, 3: 3, 4: 3, 5: 1 })],
  },

  '5.2': {
    concepts: ['loop-passes', 'accumulator'],
    parts: [order([1, 2, 3, 2, 3, 2, 4]), output('10', { err: 'object' })],
  },

  '5.3': {
    concepts: ['range', 'loop-passes'],
    parts: [
      output('0\n1\n2\ndone 2'),
      choice('Why does the last line work at all?', [
        '`i` is an ordinary name; nothing takes it away when the loop ends, so it still points at 2',
        'The loop name belongs to the loop and should be gone — Python prints a leftover copy',
        'The last line runs once per pass, while `i` still exists',
        '`range(3)` hands out 3 last, and `i` keeps it',
      ]),
    ],
  },

  '5.4': {
    concepts: ['block-indent', 'loop-passes'],
    parts: [
      output('1\nend\n2\nend', { snippet: 'A' }),
      output('1\n2\nend', { snippet: 'B' }),
      firstDifference(3),
      choice(
        'What does the indentation change?',
        [
          'In A, `print("end")` is inside the loop and runs once per pass; in B it is after the loop and runs once',
          'Nothing — indentation only makes the code easier to read',
          'In B, `print("end")` runs before the loop',
          'In A, `print("end")` runs only on the last pass',
        ],
        0,
        { err: 'flow' },
      ),
    ],
  },

  '5.5': {
    concepts: ['range'],
    parts: [output('range(0, 3)\n[0, 1, 2]\n[2, 3, 4]\n[0, 3, 6, 9]\n3')],
  },

  '5.6': {
    concepts: ['accumulator', 'loop-passes'],
    parts: [
      {
        kind: 'table',
        prompt: 'One row per pass, then a last row for the moment the loop ends.',
        columns: ['pass', 'n', 'total before', 'total after'],
        // The key's last cell reads "24 (loop ends)"; the annotation is
        // prose, not a value, so the cell asks for the value alone.
        truth: (ev) => {
          const run = ev[0]!
          const rows = passRows(run, 3, [
            { pass: true },
            { name: 'n', when: 'after' },
            { name: 'total', when: 'before' },
            { name: 'total', when: 'after' },
          ])
          const total = shown(run.final, 'total') ?? '—'
          return [...rows, ['—', shown(run.final, 'n') ?? '—', total, total]]
        },
        model: [
          ['1', '2', '1', '2'],
          ['2', '3', '2', '6'],
          ['3', '4', '6', '24'],
          ['—', '4', '24', '24'],
        ],
      },
      output('24'),
    ],
  },

  '5.7': {
    concepts: ['loop-rebind-inert', 'rebind'],
    parts: [output('[1, 2, 3]\n30')],
  },

  '5.8': {
    concepts: ['loop-rebind-inert', 'mutate-vs-rebind'],
    parts: [
      output('[[1], [2]]', { snippet: 'A' }),
      output('[[1, 0], [2, 0]]', { snippet: 'B' }),
      firstDifference(3),
      choice('Which Stage 2 distinction is doing the work?', [
        'Replacing versus changing: A builds a new list and moves `row` onto it; B changes the list `row` points at, which is the one in the grid',
        'A loop can only read, so neither line should affect the grid',
        'Both mention `row`, so both change the grid — A just prints too early',
        '`+` changes the list and `.append` builds a new one',
      ]),
    ],
  },

  '5.9': {
    concepts: ['loop-rebind-inert', 'slot-write'],
    parts: [
      output('[1, 2, 3]', { prompt: 'What does it actually print?' }),
      fix('nums = [1, 2, 3]\nfor i in range(len(nums)):\n    nums[i] = nums[i] * 2\nprint(nums)\n', [
        py('nums == [2, 4, 6]', 'At the end the list should hold 2, 4, 6.'),
        prints('[2, 4, 6]'),
      ]),
    ],
  },

  '5.10': {
    concepts: ['break-continue'],
    parts: [output('1\n2\nstopped at 3')],
  },

  '5.11': {
    concepts: ['break-continue'],
    parts: [
      output('1\n3\n4', { snippet: 'A' }),
      output('1', { snippet: 'B' }),
      firstDifference(3),
      choice('Which pair of sentences is right?', [
        'A: `continue` skips the rest of the body for that one pass and the loop goes on. B: `break` ends the loop entirely.',
        'A: `continue` skips the next item. B: `break` skips one pass.',
        'A: `continue` ends the loop. B: `break` skips the rest of this pass.',
        'Both skip only the pass where `n` is 2; they differ in what they print.',
      ]),
    ],
  },

  '5.12': {
    concepts: ['accumulator', 'mutate-vs-rebind'],
    parts: [
      output('[4]', { prompt: 'What does it actually print?' }),
      line('Which line causes it?', 5, 5),
      choice('Why?', [
        'Line 5 points `evens` at a brand-new one-item list on every match, so only the last match survives',
        '`evens = [n]` adds `n` to `evens`, but the loop stops early',
        'The `if` is only true for 4',
        '`print` shows only the last item of a list',
      ]),
      fix('nums = [1, 2, 3, 4]\nevens = []\nfor n in nums:\n    if n % 2 == 0:\n        evens.append(n)\nprint(evens)\n', [
        py('evens == [2, 4]', '`evens` should end up holding every even number: 2 and 4.'),
        prints('[2, 4]'),
      ]),
    ],
  },

  '5.13': {
    concepts: ['mutation-during-iteration'],
    parts: [
      output('[1, 3]'),
      {
        kind: 'table',
        prompt: 'One row each time the loop hands over an item, then a row for when it ends.',
        columns: ['loop is at position', 'xs at that moment', 'x'],
        truth: (ev) => {
          const run = ev[0]!
          const rows = passRows(run, 3, [{ pass: true }, { name: 'xs', when: 'before' }, { name: 'x', when: 'before' }]).map(
            ([k, ...rest]) => [String(Number(k) - 1), ...rest],
          )
          return [...rows, [String(rows.length), shown(run.final, 'xs') ?? '—', '—']]
        },
        model: [
          ['0', '[1, 2, 3, 4]', '1'],
          ['1', '[1, 2, 3, 4]', '2'],
          ['2', '[1, 3, 4]', '4'],
          ['3', '[1, 3]', '—'],
        ],
      },
      choice(
        'Which item is never looked at by the `if`?',
        ['3', '1', '2', '4', 'None — every item is looked at'],
        (ev) => {
          const seen = new Set<string>()
          const run = ev[0]!
          for (let k = 1; k <= visitsTo(run, 3); k++) seen.add(shown(run.at({ before: 3, occurrence: k }), 'x') ?? '')
          const opts = ['3', '1', '2', '4']
          const missed = opts.findIndex((o) => !seen.has(o))
          return missed < 0 ? 4 : missed
        },
        { err: 'object' },
      ),
    ],
  },

  '5.14': {
    concepts: ['mutation-during-iteration', 'accumulator'],
    from: ['5.13'],
    parts: [
      fix(
        'nums = [1, 2, 3, 4]\nodds = []\nfor n in nums:\n    if n % 2 == 1:\n        odds.append(n)\nprint(odds)\n',
        [
          printsLine('[1, 3]', 'It should print the odd numbers, `[1, 3]`.'),
          forbid(String.raw`\.(remove|pop)\(|^\s*del\b`, 'Do not take items out of the list you are looping over — build a new one.'),
          requires(String.raw`\.append\(`, 'Collect the odd numbers into a new list with `.append`.'),
        ],
        { small: 4 },
      ),
    ],
  },

  '5.15': {
    concepts: ['loop-passes', 'accumulator'],
    parts: [
      order([1, 2, 3, 4, 5, 2, 3, 4, 5, 2, 3, 4, 5, 2, 6, 7]),
      output('pass 0 [0]\npass 1 [0, 2]\npass 2 [0, 2, 4]\nfinal [0, 2, 4]\nlast doubled 4', { err: 'object' }),
    ],
  },

  '5.16': {
    concepts: ['accumulator', 'rhs-first'],
    parts: [
      output('', { raises: 'NameError', prompt: 'What happens when it runs?' }),
      choice('Why?', [
        'On the first pass Python must work out `total + n` before `total` is pointed anywhere, and `total` does not exist yet',
        'The loop starts `total` at zero, but `print` runs too early',
        '`total = total + n` makes `total` on the way past, then fails on the second pass',
        '`n` does not exist until the loop ends',
      ]),
      fix('total = 0\nfor n in [1, 2, 3]:\n    total = total + n\nprint(total)\n', [
        finishes(),
        prints('6'),
      ]),
    ],
  },

  '5.17': {
    concepts: ['accumulator', 'range'],
    parts: [
      write(
        'squares = []\nfor n in range(1, 6):\n    squares.append(n * n)\nprint(squares)\nprint(len(squares))\n',
        [
          finishes(),
          py('squares == [1, 4, 9, 16, 25]', '`squares` should hold the squares of 1 through 5: [1, 4, 9, 16, 25].'),
          printsLine('[1, 4, 9, 16, 25]', 'Print the list.'),
          printsLine('5', 'Print its length.'),
          requires(String.raw`^squares[ \t]*=[\s\S]*^for\b`, 'Point `squares` at an empty list before the loop.'),
          requires(String.raw`^for\b.*\brange\(`, 'Use `range` in the `for` line.'),
          forbid(String.raw`^[ \t]+\S.*\n[ \t]+\S`, 'Put exactly one line inside the loop body.'),
        ],
        { starter: 'squares = []\n' },
      ),
    ],
  },

  '5.18': {
    concepts: ['repetition-pitfall', 'slot-write'],
    code: ['xs = [[0], [0]]\nfor row in xs:\n    row[0] = row[0] + 1\nprint(xs)\n', 'xs = [[0]] * 2\nfor row in xs:\n    row[0] = row[0] + 1\nprint(xs)\n'],
    parts: [
      output('[[1], [1]]', { snippet: 'A' }),
      output('[[2], [2]]', { snippet: 'B', prompt: 'And if line 1 were `xs = [[0]] * 2`?' }),
      choice('Why does B reach 2?', [
        'Both slots hold the one inner list, so the body runs twice on the same object: 0 → 1 → 2',
        'Each slot is its own list, and `* 2` doubles the numbers in them',
        'The display repeats the same list, but only one slot was really changed',
        'The loop runs four times in B',
      ]),
    ],
  },

  '5.19': {
    concepts: ['block-indent', 'loop-rebind-inert'],
    parts: [
      rule({
        prompt: '1. How do you tell which lines belong to a loop body?',
        err: 'syntax',
        wrongWord: 'the idea is right but it says the lines "after the for" rather than the lines indented under it',
      }),
      rule({
        prompt: '2. How many times does the `for` line itself run, compared with the body?',
        err: 'flow',
        wrongWord: 'it says "one more" but not that the extra visit is the one that finds nothing left',
      }),
      rule({
        prompt: '3. What happens to the loop name after the loop finishes?',
        err: 'flow',
        wrongWord: 'it says the name "keeps its value" rather than still pointing at the last object it was given',
      }),
      rule({
        prompt: '4. When does changing the loop name change the collection?',
        err: 'object',
        wrongWord: 'the idea is right but it calls changing the object the name points at "changing the name"',
      }),
    ],
  },

  /* ------------------------------ checkpoint ------------------------------ */

  'C5.1': {
    concepts: ['block-indent', 'loop-passes'],
    parts: [
      number('How many lines of output?', (ev) => ev[0]!.output.replace(/\n$/, '').split('\n').length, 3, { err: 'flow' }),
      output('a\na\nb'),
    ],
  },

  'C5.2': { concepts: ['accumulator', 'range'], parts: [output('6 3')] },

  'C5.3': {
    concepts: ['loop-rebind-inert', 'slot-write'],
    code: ['xs = [1, 2, 3]\nfor x in xs:\n    x = 0\nprint(xs)\n'],
    parts: [
      choice('Why does `x = 0` leave the list alone?', [
        '`x = 0` points the loop name at the number 0 and never writes into the list’s slots',
        '`x` is a copy of the list, so the change is lost when the loop ends',
        'Numbers cannot be put into a list',
        'It does change the list, but only after the loop finishes',
      ]),
      fix('xs = [1, 2, 3]\nfor i in range(len(xs)):\n    xs[i] = 0\nprint(xs)\n', [
        py('xs == [0, 0, 0]', 'Every slot of the list should end up pointing at 0.'),
        requires(String.raw`xs\[[^\]]+\][ \t]*=[^=]`, 'Write into the list’s slots by position.'),
      ]),
    ],
  },

  'C5.4': {
    concepts: ['loop-passes', 'break-continue'],
    parts: [block(2, [3, 4, 5], { 1: 1, 2: 4, 3: 3, 4: 0, 5: 0, 6: 1 })],
  },

  'C5.5': { concepts: ['accumulator', 'mutate-vs-rebind'], parts: [output("['a', 'a', 'b', 'b'] 4")] },

  'C5.6': {
    concepts: ['range'],
    code: ['print(range(5))\n'],
    parts: [
      output('range(0, 5)', { prompt: 'What does `print(range(5))` show?' }),
      choice('Why not a list?', [
        'A range hands out its numbers only as they are asked for, so it has no list to show',
        'A range is a list, but `print` shortens long lists',
        '`range(5)` is empty until a loop runs over it',
      ]),
      write('print(list(range(5)))\n', [printsLine('[0, 1, 2, 3, 4]', 'Show the numbers as a list: [0, 1, 2, 3, 4].'), requires(String.raw`range\(`, 'Use `range`.')]),
    ],
  },
}
