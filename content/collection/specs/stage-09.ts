/**
 * Stage 9 — Integration and Capstone. How each item is graded.
 *
 * Part A items are small programs that mix the earlier stages; 9.C1–9.C8
 * all read the one capstone program (line numbers as in its listing).
 */
import type { Spec } from '../../../src/collection/model'
import { countOf, visitsTo } from '../../../src/collection/facts'
import {
  block,
  choice,
  diagram,
  finishes,
  fix,
  line,
  number,
  order,
  output,
  prints,
  printsLike,
  py,
  requires,
  write,
} from './helpers'

/** The capstone's three functions with all three defects repaired, as 9.C7's
 *  key gives them. 9.C7's model and 9.C8's starter both begin here. */
const REPAIRED = `def new_board(rows, cols):
    return [[0] * cols for _ in range(rows)]

def record(board, row, col, points, log=None):
    if log is None:
        log = []
    board[row][col] = board[row][col] + points
    log.append((row, col, points))
    return log

def row_totals(board):
    totals = []
    for row in board:
        total = 0
        for cell in row:
            total = total + cell
        totals.append(total)
    return totals

def best_row(totals):
    best = 0
    for i, t in enumerate(totals):
        if t > totals[best]:
            best = i
    return best
`

/** The capstone as given, with the two lines 9.C6 adds. */
const EXPOSED = `def new_board(rows, cols):
    return [[0] * cols] * rows

def record(board, row, col, points, log=[]):
    board[row][col] = board[row][col] + points
    log.append((row, col, points))
    return log

def row_totals(board):
    totals = []
    for row in board:
        total = 0
        for cell in row:
            total = total + cell
        totals.append(total)
    return totals

def best_row(totals):
    best = 0
    for i, t in enumerate(totals):
        if t > totals[best]:
            best = i
            break
    return best

board = new_board(3, 3)
record(board, 0, 0, 5)
record(board, 1, 1, 7)
history = record(board, 2, 2, 12)
print(board)
print(row_totals(board))
print(best_row(row_totals(board)))
print(history)
board2 = new_board(3, 3)
print(record(board2, 0, 0, 1))
`

/** Per call of `row_totals`: the program calls it twice (lines 31 and 32),
 *  and line 10 runs once per call. */
const perCall = (ev: Parameters<typeof visitsTo>[0], n: number) => visitsTo(ev, n) / visitsTo(ev, 10)

export const STAGE_9: Record<string, Spec> = {
  '9.1': {
    concepts: ['param-mutation', 'return-object'],
    parts: [
      output("['ann', 'bo'] ['ann', 'bo'] True"),
      choice('Why does `team_a` hold both names?', [
        '`register` changes the list it is given and hands back that same object, so `team_b` is a second name for `team_a`’s list',
        '`return roster` hands back a copy, and the second call writes the copy back into `team_a`',
        '`team_b = register(…)` makes a new team, but `append` adds to every list',
        'Parameters are linked to the caller’s names, so `roster` follows `team_a` wherever it goes',
      ]),
    ],
  },

  '9.2': {
    concepts: ['shallow-copy', 'copy-level'],
    parts: [
      output("{'a': [1, 2, 0], 'b': [3, 0]}\n{'a': [1, 2, 0], 'b': [3, 0]}"),
      choice('Which level did `dict(data)` copy, and which change crossed?', [
        'The outer level — its own pairs — but both dictionaries’ pairs point at the same two lists, so the appends crossed',
        'Both levels, so nothing should have crossed',
        'No level: `backup` is a second name for `data`',
        'The inner lists, but not the keys',
      ]),
    ],
  },

  '9.3': {
    concepts: ['mutable-default', 'defect-attribution'],
    parts: [
      output("{'ann': [90], 'bo': [90]}"),
      line('Click the line of the first fault: one list, built once, reused by every call.', 1, 1),
      line('Click the line of the second fault: every key pointed at one list.', 4, 4),
      choice('Which fault alone explains the output you see?', [
        'The loop line: within one call both keys point at one list, wherever that list came from',
        'The default argument: it only makes one list, so both keys share it',
        'Neither alone — it takes both together',
      ]),
      fix(
        'def make_records(names):\n    records = {}\n    for n in names:\n        records[n] = []\n    return records\n\nr = make_records(["ann", "bo"])\nr["ann"].append(90)\nprint(r)\n',
        [
          prints("{'ann': [90], 'bo': []}"),
          py('r["ann"] is not r["bo"]', 'Each student needs a list object of their own.'),
          py('make_records(["cy"])["cy"] == []', 'A second call must start with an empty list, not one left over from the first.'),
        ],
      ),
    ],
  },

  '9.4': {
    concepts: ['break-continue', 'call-expr'],
    parts: [
      // The key numbers line 9 again after `half` returns
      // ("out.append(4)"); the comparison treats that revisit as optional.
      order([1, 4, 5, 6, 7, 9, 2, 9, 6, 7, 8, 6, 10]),
      output('[4]'),
    ],
  },

  '9.5': {
    concepts: ['param-binding', 'mutate-vs-rebind'],
    parts: [
      output('[7] [7, 0, 1]'),
      number('How many list objects are there at the end?', (ev) => countOf(ev[0]!.final, 'list'), 2),
      choice('Why is `original` untouched?', [
        'Line 2 rebinds the local `xs` to a new list before anything is changed, so the `.append` changes the new list',
        '`xs.append(1)` changes a copy of the argument',
        'Functions can never change the caller’s lists',
        '`return xs` undoes the changes on the way out',
      ]),
    ],
  },

  '9.6': {
    concepts: ['mutation-during-iteration', 'comprehension'],
    parts: [
      output('[[1], [], [2]]'),
      choice('Why does one empty row survive?', [
        'Removing a row shifts the rest left, so the next empty row slides into a position the loop has already passed',
        '`.remove` only works on the first pass of a loop',
        '`len(row) == 0` is false for the second empty row',
        'The loop walks a copy of `grid`, so the removal is lost',
      ]),
      fix('grid = [[1], [], [], [2]]\ngrid = [row for row in grid if len(row) > 0]\nprint(grid)\n', [prints('[[1], [2]]')]),
    ],
  },

  '9.7': { concepts: ['local-scope', 'identity'], parts: [output("{'a': 2, 'b': 1, 'z': 1} {'a': 2, 'b': 1} False False")] },

  '9.8': {
    concepts: ['param-mutation', 'return-object'],
    parts: [
      output('[[1, 0], [2, 0]] [[1, 0], [2, 0]] True', { snippet: 'A' }),
      output('[[1], [2]] [[1, 0], [2, 0]] False', { snippet: 'B' }),
      choice('What does the caller end up sharing with the result?', [
        'A: everything — `h` is `g`, and its rows were changed in place. B: nothing — a new outer list and a new list per row',
        'A: only the outer list. B: the inner lists',
        'Nothing in either: a function’s result is always a copy',
        'Everything in both: the rows are the same rows either way',
      ]),
    ],
  },

  '9.9': {
    concepts: ['alias', 'shallow-copy'],
    parts: [
      output("[['bo', 'ann'], ['bo', 'ann']]"),
      choice('Why is the round-1 record rewritten?', [
        'Both entries are the one list `standings` points at, and `.reverse()` changed that list in place',
        '`.reverse()` returns a new list, which replaces both entries',
        '`rounds.append` copies the list, but the copy follows the original',
        'The second append overwrites the first',
      ]),
      fix(
        'standings = ["ann", "bo"]\nrounds = []\nrounds.append(standings[:])\nstandings.reverse()\nrounds.append(standings[:])\nprint(rounds)\n',
        [
          prints("[['ann', 'bo'], ['bo', 'ann']]"),
          py('rounds[0] is not standings and rounds[1] is not standings', 'Each round should record a snapshot, not the live list.'),
        ],
      ),
    ],
  },

  '9.10': {
    concepts: ['nested-build', 'nested-loops'],
    parts: [
      write(
        'def transpose(grid):\n    result = []\n    for c in range(len(grid[0])):\n        new_row = []\n        for r in range(len(grid)):\n            new_row.append(grid[r][c])\n        result.append(new_row)\n    return result\n\ng = [[1, 2, 3], [4, 5, 6]]\nt = transpose(g)\nprint(t)\nprint(g)\nprint(t[0] is t[1])\nt[0].append(99)\nprint(t, g)\n',
        [
          finishes(),
          py("callable(globals().get('transpose'))", 'Define a function called `transpose`.'),
          py('transpose([[1, 2, 3], [4, 5, 6]]) == [[1, 4], [2, 5], [3, 6]]', 'Rows and columns should swap: `[[1, 2, 3], [4, 5, 6]]` becomes `[[1, 4], [2, 5], [3, 6]]`.'),
          py('transpose([[1, 2], [3, 4]]) == [[1, 3], [2, 4]]', 'A square grid should transpose too.'),
          py(
            '(lambda g: (transpose(g), g == [[1, 2, 3], [4, 5, 6]])[1])([[1, 2, 3], [4, 5, 6]])',
            'The input grid must not change.',
          ),
          py(
            '(lambda g: (lambda t: t[0] is not t[1] and all(r is not s for r in t for s in g))(transpose(g)))([[1, 2], [3, 4]])',
            'Every row of the result must be a new list of its own — not shared with another row, and not one of the input’s rows.',
          ),
          requires(String.raw`print\(`, 'Show the three properties with printed evidence.'),
          requires(String.raw`print\(.*\bis\b`, 'Print a line that proves the rows are distinct objects — with `is`.'),
        ],
        { starter: 'def transpose(grid):\n    ...\n' },
      ),
    ],
  },

  /* ------------------------------ capstone ------------------------------ */

  '9.C1': {
    concepts: ['block-indent', 'nested-counts'],
    parts: [
      block(11, [12, 13, 14, 15], null, { prompt: 'Which lines are the body of the outer loop on line 11?' }),
      block(13, [14], null, { prompt: 'And of the inner loop on line 13?' }),
      number('During one call of `row_totals`, how many visits does line 11 get?', (ev) => perCall(ev[0]!, 11), 4),
      number('How many times does line 12 run in one call?', (ev) => perCall(ev[0]!, 12), 3),
      number('How many visits does line 13 get on each pass of the outer loop?', (ev) => visitsTo(ev[0]!, 13) / visitsTo(ev[0]!, 12), 4),
      number('How many times does line 14 run in one call?', (ev) => perCall(ev[0]!, 14), 9),
      number('How many times does line 15 run in one call?', (ev) => perCall(ev[0]!, 15), 3),
      number('How many times does line 16 run in one call?', (ev) => perCall(ev[0]!, 16), 1),
    ],
  },

  '9.C2': {
    concepts: ['call-expr', 'return-object'],
    parts: [order([26, 2, 27, 5, 6, 7, 28, 5, 6, 7, 29, 5, 6, 7, 30], { lines: [26, 30] })],
  },

  '9.C3': {
    concepts: ['repetition-pitfall', 'mutable-default'],
    parts: [
      diagram({ after: 26 }, ['shared-inner-to-separate', { at: { after: 27 } }], { prompt: 'Which picture is memory immediately after line 26?' }),
      diagram({ after: 27 }, ['shared-inner-to-separate', { at: { after: 26 } }, { at: { after: 28 } }], {
        prompt: 'And immediately after line 27?',
      }),
      number('How many list objects exist after line 27, the default log included?', (ev) => countOf(ev[0]!.at({ after: 27 })!, 'list'), 3),
    ],
  },

  '9.C4': {
    concepts: ['repetition-pitfall', 'break-continue'],
    parts: [output('[[5, 7, 12], [5, 7, 12], [5, 7, 12]]\n[24, 24, 24]\n0\n[(0, 0, 5), (1, 1, 7), (2, 2, 12)]')],
  },

  '9.C5': {
    concepts: ['defect-attribution'],
    parts: [
      line('Every row shows the same scores. Click the line where the wrong event happens.', 2, 2, { err: 'object' }),
      choice(
        'What is that event?',
        [
          '`[0] * cols` is worked out once, making one list, and `* rows` points every slot of the outer list at it',
          '`* rows` copies the row three times, and the copies are later merged',
          '`board[row][col] = …` writes to every row on purpose',
        ],
        0,
        { err: 'object' },
      ),
      line('A second board’s log would start with the first board’s scores. Click the line where the wrong event happens.', 4, 4, { err: 'object' }),
      choice(
        'Which misconception is behind it?',
        [
          'That a default value is created fresh on each call — it is built once, when the `def` line runs',
          'That `.append` makes a copy of the log',
          'That `return log` shares the log with the caller',
        ],
        0,
        { err: 'object' },
      ),
      line('`best_row` reports the first improvement, not the best row. Click the line where the wrong event happens.', 23, 23, { err: 'flow' }),
      choice(
        'What kind of defect is that one?',
        ['Flow: the loop stops at the first better total instead of scanning them all', 'Object-model: `best` is shared between calls', 'Syntax-reading: `break` is indented one level too far'],
        0,
        { err: 'flow' },
      ),
    ],
  },

  '9.C6': {
    concepts: ['mutable-default', 'defect-attribution'],
    parts: [
      choice('Which defect is invisible in this program’s output?', [
        'The mutable default `log=[]` on line 4: one board and one read of the log, so every entry belongs there',
        'The shared row from line 2',
        'The `break` on line 23',
      ]),
      fix(
        EXPOSED,
        [
          finishes(),
          py(
            "any(isinstance(v, list) and v is not board and v and all(isinstance(r, list) for r in v) for k, v in list(globals().items()) if not k.startswith('_'))",
            'Make a second board.',
          ),
          py('len(record.__defaults__[0]) > 3', 'Score the second board with `record`, leaving out the log — that is what shares it.'),
          printsLike(
            String.raw`\(0, 0, 5\), \(1, 1, 7\), \(2, 2, 12\), \(`,
            'Print the log that call hands back: the first board’s three entries should show up in it, with the new one after them.',
          ),
        ],
        { prompt: 'Add two lines at the end that expose it.' },
      ),
    ],
  },

  '9.C7': {
    concepts: ['minimal-repair'],
    parts: [
      fix(
        REPAIRED +
          '\nboard = new_board(3, 3)\nhistory = record(board, 0, 0, 5)\nrecord(board, 1, 1, 7, history)\nrecord(board, 2, 2, 12, history)\nprint(board)\nprint(row_totals(board))\nprint(best_row(row_totals(board)))\nprint(history)\n',
        [
          prints('[[5, 0, 0], [0, 7, 0], [0, 0, 12]]\n[5, 7, 12]\n2\n[(0, 0, 5), (1, 1, 7), (2, 2, 12)]'),
          py('(lambda b: b[0] is not b[1] and b[1] is not b[2] and b[0] is not b[2])(new_board(3, 3))', '`new_board` must build a separate list for each row.'),
          py('record(new_board(2, 2), 0, 0, 1) == [(0, 0, 1)]', 'A fresh board’s first score must start a fresh log — nothing leaked from earlier calls.'),
          py('best_row([5, 7, 12]) == 2 and best_row([3, 1, 2]) == 0', '`best_row` must find the largest total, not the first improvement.'),
        ],
        { small: 10 },
      ),
      choice('Which fix makes a previously invisible defect start giving wrong output?', [
        'Fixing the shared row (line 2) reveals the `break`: with equal totals it never fired, but with `[5, 7, 12]` it stops at row 1',
        'Fixing the default log reveals the shared row',
        'Removing the `break` reveals the default log',
        'None of them: each fix only removes its own symptom',
      ]),
    ],
  },

  '9.C8': {
    concepts: ['deep-copy', 'copy-level'],
    parts: [
      write(
        'import copy\n\n' +
          REPAIRED +
          '\ndef snapshot(board):\n    return copy.deepcopy(board)\n\nboard = new_board(3, 3)\nhistory = record(board, 0, 0, 5)\nbefore = snapshot(board)\nrecord(board, 1, 1, 7, history)\nprint(before)\nprint(board)\n',
        [
          finishes(),
          py("callable(globals().get('snapshot'))", 'Define a function called `snapshot`.'),
          py('(lambda b: snapshot(b) == b)([[1, 2], [3, 4]])', 'A snapshot should look like the board it was taken of.'),
          py(
            '(lambda b: (lambda s: (b[0].__setitem__(0, 9), s == [[1, 2], [3, 4]])[1])(snapshot(b)))([[1, 2], [3, 4]])',
            'Scoring the board afterwards must not change the snapshot — the rows need copying too, not just the outer list.',
          ),
          requires(String.raw`^(?!\s*def\b)[^#\n]*\bsnapshot\(`, 'Show it working: take a snapshot, score the board, and print both.'),
        ],
        { starter: REPAIRED + '\n# Add snapshot(board) here, then show it working.\n' },
      ),
    ],
  },
}
