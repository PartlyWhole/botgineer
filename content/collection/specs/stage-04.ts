/**
 * Stage 4 — Sharing, Shallow Copies, and Deep Copies. How each item is graded.
 */
import type { Part, Spec } from '../../../src/collection/model'
import type { RunEvidence } from '../../../src/memory/extract'
import { countOf } from '../../../src/collection/facts'
import {
  choice,
  diagram,
  finishes,
  firstDifference,
  fix,
  forbid,
  number,
  output,
  prints,
  py,
  requires,
  rule,
  write,
} from './helpers'

/** How many inner lists: every list at the end but the outer one. */
const innerLists = (ev: RunEvidence) => countOf(ev.final, 'list') - 1

/** A choice whose answer comes from the run, with the key's answer kept as
 *  the model so the sweep can check the two agree. */
const derivedChoice = (
  prompt: string,
  options: string[],
  answer: (ev: RunEvidence[]) => number | number[],
  model: number | number[],
): Part => ({ kind: 'choice', prompt, options, answer, model })

export const STAGE_4: Record<string, Spec> = {
  '4.1': {
    concepts: ['container-arrows', 'alias'],
    // The prompt asks for `print(outer)`, which the snippet does not do.
    code: ['inner = [1, 2]\nouter = [inner, inner]\ninner.append(3)\nprint(outer)\n'],
    parts: [
      diagram({ after: 3 }, ['shared-inner-to-separate', 'earlier', { at: { after: 1 } }], {
        prompt: 'Which picture is memory after the last line?',
      }),
      output('[[1, 2, 3], [1, 2, 3]]', { prompt: 'What does `print(outer)` show?' }),
      number('How many list objects exist?', (ev) => countOf(ev[0]!.final, 'list'), 2),
    ],
  },

  '4.2': { concepts: ['shallow-copy', 'copy-level'], parts: [output('[[1, 2], [3, 4]]\n[[1, 2], [3, 4], [5, 6]]')] },

  '4.3': {
    concepts: ['shallow-copy', 'container-arrows'],
    // The key prints `[[1, 99], [3, 4]]` twice, but appending 99 to [1, 2]
    // gives [1, 2, 99]. Python is the answer key; the markdown needs fixing.
    parts: [output('[[1, 2, 99], [3, 4]]\n[[1, 2, 99], [3, 4]]')],
  },

  '4.4': {
    concepts: ['shallow-copy', 'copy-level'],
    from: ['4.2', '4.3'],
    parts: [
      rule({ wrongWord: 'it only says "it is a shallow copy", or names one half — the outer list — without saying the inside stays shared' }),
      choice(
        'Which sentence is the rule?',
        [
          'A one-level copy protects the outer list — its length and which objects its slots point at — and does not protect the objects those slots point at',
          'A one-level copy protects nothing, because it is not a real copy',
          'A one-level copy protects everything, the same as any other copy',
          'A one-level copy protects the inner lists and not the outer one',
        ],
        0,
        { err: 'object' },
      ),
    ],
  },

  '4.5': { concepts: ['deep-copy', 'copy-level'], parts: [output('[[1, 2], [3, 4]]\n[[1, 2, 99], [3, 4]]')] },

  '4.6': {
    concepts: ['repetition-pitfall', 'container-arrows'],
    parts: [
      output('[[0, 0, 0], [0, 0, 0], [0, 0, 0]]\n[[1, 0, 0], [1, 0, 0], [1, 0, 0]]'),
      number('How many inner list objects exist?', (ev) => innerLists(ev[0]!), 1),
    ],
  },

  '4.7': {
    concepts: ['repetition-pitfall', 'literal-new'],
    parts: [
      output('[[1, 0, 0], [1, 0, 0], [1, 0, 0]]', { snippet: 'A' }),
      output('[[1, 0, 0], [0, 0, 0], [0, 0, 0]]', { snippet: 'B' }),
      firstDifference(1),
      number('In A, how many times does `[0] * 3` run — how many inner lists does it make?', (ev) => innerLists(ev[0]!), 1, { err: 'flow' }),
      number('And in B?', (ev) => innerLists(ev[1]!), 3, { err: 'flow' }),
      choice('Which sentence explains the difference?', [
        'In A, `[0] * 3` runs once and `* 3` repeats the arrow to that one list; in B it is written three times, so it runs three times and makes three lists',
        'The two spellings are shorthand for the same thing; B only prints differently',
        'In A, `* 3` makes three copies of the inner list, but they stay linked',
        'In B, the outer list is copied three times',
      ]),
    ],
  },

  '4.8': {
    concepts: ['repetition-pitfall', 'immutable-replace'],
    parts: [
      output('[1, 0, 0]'),
      choice('Why is there no pitfall here?', [
        'The repeated object is the number 0, which cannot be changed; writing `row[0]` points just that one slot at 1',
        'There is a pitfall — all three slots become 1',
        '`[0] * 3` makes three separate 0 objects',
        '`*` only repeats arrows for lists of lists, and copies everything else',
      ]),
    ],
  },

  '4.9': {
    concepts: ['repetition-pitfall', 'copy-level'],
    parts: [
      output("[['X', '-'], ['X', '-']]", { prompt: 'What does it actually print?' }),
      choice('Why did one write change both rows?', [
        'There is only one row: `["-"] * 2` ran once, and the outer `* 2` points both slots at that one list',
        '`board[0][0] = "X"` writes into every row on purpose',
        'The outer list was copied, and copies stay linked',
        '`print` shows the first row twice',
      ]),
      fix(
        'board = [["-"] * 2, ["-"] * 2]\nboard[0][0] = "X"\nprint(board)\n',
        [
          prints("[['X', '-'], ['-', '-']]"),
          py('board[0] is not board[1]', 'The two rows should be two different lists, so each cell can be set on its own.'),
        ],
      ),
    ],
  },

  '4.10': {
    concepts: ['shallow-copy', 'container-arrows'],
    parts: [output('[[1, 99], [2]]\n[[1, 99], [2], [3]]\n2 3')],
  },

  '4.11': {
    concepts: ['shallow-copy', 'container-arrows'],
    // The prompt asks for `print(d)` and `print(e)`, which the snippet does not do.
    code: ['d = {"xs": [1, 2]}\ne = dict(d)\ne["ys"] = [9]\ne["xs"].append(3)\nprint(d)\nprint(e)\n'],
    parts: [
      diagram({ after: 2 }, ['shared-inner-to-separate', 'earlier', { at: { after: 3 } }], { prompt: 'Which picture is memory after line 2?' }),
      diagram({ after: 3 }, ['shared-inner-to-separate', 'earlier', 'later'], { prompt: 'After line 3?' }),
      diagram({ after: 4 }, ['shared-inner-to-separate', 'earlier', { at: { after: 2 } }], { prompt: 'After line 4?' }),
      // The authoring record says "three lists", but there are two: [1, 2, 3]
      // (shared) and [9]. The third object is a dictionary.
      number('How many list objects exist at the end?', (ev) => countOf(ev[0]!.final, 'list'), 2),
      output("{'xs': [1, 2, 3]}\n{'xs': [1, 2, 3], 'ys': [9]}", { prompt: 'What do `print(d)` and `print(e)` show?' }),
    ],
  },

  '4.12': {
    concepts: ['deep-copy', 'shallow-copy'],
    parts: [
      output("{'players': ['ann', 'bo', 'cy'], 'round': 1}", { prompt: 'What does it actually print?' }),
      choice('Why is the snapshot half right?', [
        '`.copy()` made a new dictionary but its "players" slot points at the same list; line 4 repoints only `state`\'s "round" slot',
        '`.copy()` makes a fully independent copy, so the snapshot is right',
        'A copy follows every change to the original',
        '`state["round"] = 2` changes the number object 1 into 2',
      ]),
      fix(
        'import copy\nstate = {"players": ["ann", "bo"], "round": 1}\nsnapshot = copy.deepcopy(state)\nstate["players"].append("cy")\nstate["round"] = 2\nprint(snapshot)\n',
        [prints("{'players': ['ann', 'bo'], 'round': 1}", 'The snapshot should still show the state as it was when it was taken.')],
      ),
    ],
  },

  '4.13': {
    concepts: ['copy-level', 'identity'],
    parts: [
      output('True True', { snippet: 'A' }),
      output('False True', { snippet: 'B' }),
      output('False False', { snippet: 'C' }),
      choice('What does the pair of answers tell you?', [
        '`True True` is no copy; `False True` is a one-level copy; `False False` is a copy of every level',
        'Only the first answer matters: `False` means the lists are independent',
        '`False True` means the copy failed',
        'The answers depend on whether the lists hold equal numbers',
      ]),
    ],
  },

  '4.14': {
    concepts: ['literal-new', 'repetition-pitfall'],
    parts: [
      write(
        'rows = [[0, 0], [0, 0], [0, 0]]\nrows[0][0] = 5\nprint(rows)\nprint(rows[0] is rows[1], rows[1] is rows[2])\n',
        [
          finishes(),
          py('isinstance(rows, list) and len(rows) == 3 and all(isinstance(r, list) for r in rows)', '`rows` should be a list of three lists.'),
          py('rows[1] == [0, 0] and rows[2] == [0, 0] and rows[0] in ([0, 0], [5, 0])', 'Each row should be `[0, 0]` (the first may have had its 5 written in).'),
          py(
            'rows[0] is not rows[1] and rows[1] is not rows[2] and rows[0] is not rows[2]',
            'The three inner lists must be three different objects, so `rows[0][0] = 5` changes only the first row.',
          ),
          requires(String.raw`^[^#\n]*print\(.*(\bis\b|\bid\()`, 'Print a line that proves the rows are distinct objects — with `is`, or their ids.'),
          forbid(String.raw`^[^#\n]*\b(for|while)\b`, 'Use no loops.'),
          forbid(String.raw`^[^#\n]*\b(import|from)\b`, 'Use no `import`.'),
        ],
        { starter: '# Three rows of [0, 0], each its own list — and proof.\n' },
      ),
      choice('What would you change to make all three rows share one list on purpose?', [
        'Point one name at `[0, 0]` and use that name three times — or write `[[0, 0]] * 3`',
        'Write `rows[:]` instead of `rows`',
        'Use `copy.deepcopy(rows)`',
        'Nothing — equal-looking rows are already one list',
      ]),
    ],
  },

  '4.15': {
    concepts: ['container-arrows', 'shallow-copy'],
    parts: [
      output('[[1, 2, 3], [1, 2, 3]]', { prompt: 'What does it actually print?' }),
      choice('What went wrong?', [
        'Both slots of `history` point at the one list `current` points at, so the later change shows in the "past" entry too',
        '`append` saves what the list looked like at that moment, so the first entry should be `[1, 2]`',
        '`current.append(3)` also appended to `history`',
        'The second `history.append` replaced the first entry',
      ]),
      fix(
        'current = [1, 2]\nhistory = []\nhistory.append(current[:])\ncurrent.append(3)\nhistory.append(current[:])\nprint(history)\n',
        [
          prints('[[1, 2], [1, 2, 3]]', 'Each entry should keep the state it had when it was recorded: `[[1, 2], [1, 2, 3]]`.'),
          py('history[0] is not history[1]', 'The two records should be two different lists.'),
        ],
      ),
    ],
  },

  '4.16': { concepts: ['shallow-copy', 'deep-copy'], parts: [output("{'a': [1, 2, 3]}\n{'a': [1, 2]}")] },

  '4.17': {
    concepts: ['copy-level', 'repetition-pitfall', 'deep-copy'],
    parts: [
      rule({
        wrongWord: 'the ideas are right but the words blur the levels — "copies the list" for the outer list only, or "repeats the value" for repeating the arrow',
      }),
    ],
  },

  '4.18': {
    concepts: ['container-arrows', 'literal-new'],
    parts: [
      output("{'ann': [10], 'bo': [10], 'cy': [10]}", { prompt: 'What does it actually print?' }),
      choice('Which single word in the code was the whole problem?', [
        '`blank` — used three times, it puts that one list in all three slots',
        '`append`',
        '`scores`',
        '`print`',
      ]),
      fix('blank = []\nscores = {"ann": [], "bo": [], "cy": []}\nscores["ann"].append(10)\nprint(scores)\n', [
        prints("{'ann': [10], 'bo': [], 'cy': []}", 'Only ann should have a score.'),
        py('scores["bo"] is not scores["cy"]', 'Each student should have their own list.'),
      ]),
    ],
  },

  /* ------------------------------ checkpoint ------------------------------ */

  'C4.1': {
    concepts: ['shallow-copy', 'mutate-vs-rebind'],
    // One run per change, each printing `a` afterwards, so which ones reach
    // `a` is the interpreter's answer.
    code: [
      'a = [[1], [2]]\nb = a[:]\nb.append([3])\nprint(a)\n',
      'a = [[1], [2]]\nb = a[:]\nb[0].append(3)\nprint(a)\n',
      'a = [[1], [2]]\nb = a[:]\nb[0] = [3]\nprint(a)\n',
      'a = [[1], [2]]\nb = a[:]\nb = [3]\nprint(a)\n',
    ],
    parts: [
      derivedChoice(
        'After `b = a[:]` where `a = [[1], [2]]`, which of these affect `a`? Pick every one that does.',
        ['`b.append([3])`', '`b[0].append(3)`', '`b[0] = [3]`', '`b = [3]`'],
        (ev) => ev.flatMap((e, i) => (e.output.trim() !== '[[1], [2]]' ? [i] : [])),
        [1],
      ),
    ],
  },

  'C4.2': { concepts: ['repetition-pitfall'], parts: [output("[['a'], ['a']]")] },

  'C4.3': {
    concepts: ['repetition-pitfall', 'immutable-replace'],
    parts: [
      choice('Why is `[0] * 5` safe when `[[]] * 5` is a trap?', [
        '0 cannot be changed, so one 0 in five slots acts like five; one empty list in five slots can be changed once and show in all five',
        '`[0] * 5` makes five separate 0 objects, and `[[]] * 5` does not',
        '`*` copies numbers but not lists',
        'Both are traps; `[0] * 5` just hides it better',
      ]),
    ],
  },

  'C4.4': {
    concepts: ['deep-copy', 'copy-level'],
    parts: [
      choice(
        'Which of these are reasons deep-copying everything is a poor default? Pick every one that is.',
        [
          'It duplicates objects that were meant to be shared, so the program quietly stops working as designed',
          'It costs time and memory for the whole structure',
          'It hides the real question — which level needed protecting — so the next bug like this is just as mysterious',
          'It only copies the outer level, so it does not help',
          'It changes the original structure while copying it',
        ],
        [0, 1, 2],
      ),
    ],
  },

  'C4.5': {
    concepts: ['shallow-copy', 'container-arrows'],
    parts: [
      diagram({ after: 3 }, ['shared-inner-to-separate', { at: { after: 2 } }, { at: { after: 1 } }], {
        prompt: 'Which picture is memory after line 3?',
      }),
      output('[[1, 2, 3], [1, 2]]'),
    ],
  },

  'C4.6': {
    concepts: ['copy-level', 'nested-access'],
    code: ['y = {"k": [1]}\nx = y["k"]\nx.append(2)\nprint(y)\n'],
    parts: [
      choice('1. Did `x = y["k"]` copy at all?', [
        'No — looking up a key hands back the existing list, not a copy',
        'Yes — a one-level copy of the list',
        'Yes — a copy of every level',
      ]),
      choice('2 and 3. Which level was copied, and is the changed object above or below it?', [
        'No level was copied: `x` and `y["k"]` are one list, so the change is shared',
        'The outer dictionary was copied, and the list is below that level',
        'The list was copied, so the change stays with `x`',
      ]),
      number('How many list objects exist?', (ev) => countOf(ev[0]!.final, 'list'), 1),
      output("{'k': [1, 2]}", { prompt: 'What does `print(y)` show?' }),
    ],
  },
}
