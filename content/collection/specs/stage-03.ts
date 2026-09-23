/**
 * Stage 3 — Reading Brackets and Keys Precisely. How each item is graded.
 */
import type { Part, Spec } from '../../../src/collection/model'
import { countOf, shown } from '../../../src/collection/facts'
import {
  choice,
  diagram,
  finishes,
  firstDifference,
  fix,
  forbid,
  labels,
  number,
  order,
  output,
  prints,
  py,
  requires,
  rule,
  write,
} from './helpers'

/** A choice whose answer comes from the run, with the key's pick kept as
 *  the model — so the sweep checks the key against the interpreter. */
const derived = (part: Part, model: number): Part => ({ ...part, model }) as Part

const OUTER = ["[[1, 2, 3], 'x']", "[[1, 2], 'x']", "[inner, 'x']", "[[1, 2], 'x', 3]"]

export const STAGE_3: Record<string, Spec> = {
  '3.1': {
    concepts: ['slot-write', 'slice-new'],
    parts: [
      labels(
        'row[2] = 99',
        [
          ['row[2]', 'slot 2 of the list `row` points at'],
          ['=', 'point that slot at the right side — no name moves'],
          ['99', 'a number object'],
        ],
        ['a new list, and `row` moves onto it', 'changes what `row` points at'],
      ),
      labels(
        'row = row[0:2]',
        [
          ['row', 'a name, moved onto the new list'],
          ['=', 'work out the right side, then point the left name at it'],
          ['row[0:2]', 'reads slots 0 and 1 into a new two-item list'],
        ],
        ['changes the list in place', 'a copy that stays tied to the old list'],
      ),
      choice(
        'Which lines move a name?',
        ['line 1, `row = [10, 20, 30]`', 'line 2, `first = row[0]`', 'line 3, `row[2] = 99`', 'line 4, `row = row[0:2]`'],
        [0, 1, 3],
      ),
      number('At the end, how many list objects still have a name?', (ev) => countOf(ev[0]!.final, 'list'), 1, { err: 'object' }),
    ],
  },

  '3.2': { concepts: ['index', 'slice-new'], parts: [output("b\nd\n['b', 'c']\n['a', 'b', 'c', 'd']")] },

  '3.3': {
    concepts: ['slice-new', 'alias'],
    parts: [
      output('[99, 2, 3]', { snippet: 'A' }),
      output('[1, 2, 3]', { snippet: 'B' }),
      firstDifference(2),
      choice('What does line 2 produce in each?', [
        'In A it points `ys` at the same list as `xs`; in B `xs[:]` builds a new list that only `ys` points at',
        'In both it makes a copy; `[:]` only changes how the list is printed',
        'In both, `ys` is tied to `xs`, but B writes to a slot that A does not',
        'In A it makes a copy; in B it points `ys` at the same list',
      ]),
    ],
  },

  '3.4': { concepts: ['nested-access', 'index'], parts: [output('[1, 2]\n2\n3\n2\n2')] },

  '3.5': {
    // `[1]` reads a position, which is what C3.4 relies on.
    concepts: ['nested-access', 'dict-lookup', 'index'],
    parts: [
      labels(
        'value = record["scores"][1]',
        [
          ['record', 'the dictionary — first'],
          ['["scores"]', 'looks up the key "scores", producing the list [7, 9, 8]'],
          ['[1]', 'position 1 of that list, producing the number 9'],
          ['value', 'a name, pointed at 9 — last'],
        ],
        ['one two-part key, "scores" and 1 together', 'position 1 of the dictionary'],
      ),
    ],
  },

  '3.6': {
    concepts: ['dict-lookup', 'slot-write'],
    parts: [
      output("{'ann': 31, 'bo': 25, 'cy': 41}\n3"),
      choice('Why are the pairs in that order?', [
        'Keys stay in the order they were first put in; replacing `"ann"`’s value did not move it, and `"cy"` came last',
        'Changing a key’s value moves it to the end',
        'A dictionary sorts its keys',
        'The order is random and just happened to come out this way',
      ]),
    ],
  },

  '3.7': {
    concepts: ['dict-lookup'],
    parts: [
      output('', { raises: 'KeyError', prompt: 'What happens instead?' }),
      choice('Why?', [
        '`ages[1]` looks for the key 1, and there is no key 1 — a dictionary is not read by position',
        'Positions in a dictionary count from 0, so the second pair is `ages[0]`',
        '`ages[1]` gives the second pair, `("bo", 25)`, which `print` cannot show',
        'A dictionary cannot be read with square brackets',
      ]),
      fix('ages = {"ann": 30, "bo": 25}\nprint(ages["bo"])\n', [
        prints('25'),
        forbid(String.raw`print\(\s*25\s*\)`, 'Read the 25 out of the dictionary, rather than typing it.'),
      ]),
    ],
  },

  '3.8': {
    concepts: ['dict-keys'],
    parts: [
      output('True\nFalse', { snippet: 'A' }),
      output('True\nTrue', { snippet: 'B' }),
      choice('What does `in` ask?', [
        'For a dictionary: is this one of the keys? For a list: is this one of the items?',
        'For both: is this anywhere in there, key or value?',
        'For a dictionary: is this one of the values? For a list: is this one of the positions?',
        'For both: is this at position 0?',
      ]),
    ],
  },

  '3.9': {
    concepts: ['dict-keys'],
    parts: [
      output("pair\n{(1, 2): 'pair'}"),
      choice('And if line 2 were `d[[1, 2]] = "pair"`?', [
        'It stops with a TypeError: a list can change after it is filed, so it cannot be a key',
        'It works the same way — the brackets are just different punctuation',
        'It stops with a KeyError, because `[1, 2]` is not in the dictionary yet',
        'It works, but stores a copy of the list as the key',
      ]),
    ],
  },

  '3.10': {
    concepts: ['container-arrows', 'alias'],
    parts: [
      diagram('end', ['shared-inner-to-separate', 'earlier', { at: { after: 2 } }], {
        prompt: 'Which picture is memory after the last line?',
      }),
      derived(
        choice('What does `print(outer)` show?', OUTER, (ev) => OUTER.indexOf(shown(ev[0]!.final, 'outer') ?? '')),
        0,
      ),
    ],
  },

  '3.11': {
    concepts: ['nested-access', 'slot-write'],
    parts: [
      output('[[1, 2], 0]', { prompt: 'What does it actually print?' }),
      choice('Why?', [
        '`grid[1]` is the whole second row’s slot, so line 2 replaced that row with the number 0',
        '`grid[1]` counts the numbers flat, so it is the 2',
        'Line 2 moved the name `grid` onto 0',
        'Line 2 changed the first item of the second row, as intended, but `print` shows it wrongly',
      ]),
      fix('grid = [[1, 2], [3, 4]]\ngrid[1][0] = 0\nprint(grid)\n', [
        py('grid == [[1, 2], [0, 4]]', 'Only the second row’s first item should become 0.'),
        prints('[[1, 2], [0, 4]]'),
        forbid(String.raw`\[\s*\[\s*1\s*,\s*2\s*\]\s*,\s*\[\s*0`, 'Change the slot, rather than typing the whole grid out again.'),
      ]),
    ],
  },

  '3.12': {
    concepts: ['dict-lookup'],
    parts: [
      output("3\nNone\n0\n{'apple': 3}"),
      derived(
        choice(
          'Did any of these four lines change the dictionary?',
          ['No — `.get` only reads, and does not store the default', 'Yes — `.get("pear", 0)` stored `"pear": 0`'],
          (ev) => (shown(ev[0]!.final, 'stock') === "{'apple': 3}" ? 0 : 1),
        ),
        0,
      ),
    ],
  },

  '3.13': {
    concepts: ['nested-access', 'alias'],
    parts: [
      order([1, 2, 3, 4, 5], { err: 'flow' }),
      output("[['-', 'X'], ['O', '-']]"),
      choice('Which line changed which object?', [
        'Line 2 changed the first inner list; line 3 changed nothing; line 4 changed the second inner list, which `row` and `board[1]` both point at',
        'Line 2 changed the first inner list; line 3 copied the second row out; line 4 changed only that copy',
        'Lines 2 and 4 both changed `board` itself; line 3 changed `row`',
        'Line 3 changed `board` by taking its second row away',
      ]),
    ],
  },

  '3.14': {
    concepts: ['dict-keys'],
    parts: [
      output("{1: 'yes'}", { snippet: 'A' }),
      output("{1: 'one', '1': 'yes'}", { snippet: 'B' }),
      choice('Why does A print only one pair?', [
        '`True` is equal to 1, so it is filed under the key already there: the value is replaced and the key stays the original 1',
        '`True` is not allowed as a key, so Python skips it',
        'The second pair replaced the whole first pair, key and all, so the key should now be `True`',
        'A dictionary keeps only one number key',
      ]),
    ],
  },

  '3.15': {
    concepts: ['nested-access', 'slot-write'],
    parts: [
      write(
        'scores = {"ann": [7, 9], "bo": [8], "cy": [6, 6]}\nscores["bo"].append(10)          # changes the inner list only\nscores["cy"] = [1, 2, 3]         # changes the dictionary only\nprint(scores)\n',
        [
          finishes(),
          py(
            "any(isinstance(v, dict) and len(v) == 3 and all(isinstance(x, list) for x in v.values()) for v in list(globals().values()))",
            'Build one dictionary mapping three names to lists of scores.',
          ),
          requires(String.raw`\]\s*\.\s*(append|extend|insert)\s*\(`, 'Add the score by changing the list in place, as in `d[name].append(...)`.'),
          requires(String.raw`^[ \t]*[A-Za-z_]\w*\s*\[[^\]\n]+\]\s*=[^=]`, 'Replace the third person’s list with a slot write, as in `d[name] = [...]`.'),
          requires(String.raw`print\(`, 'Print the whole dictionary.'),
        ],
        { starter: '# A dictionary of three names to score lists, two changes, then print it.\n' },
      ),
      choice('The line that adds a score (`scores["bo"].append(10)`) changed:', [
        'a list inside the dictionary',
        'the dictionary itself',
        'both',
      ]),
      choice('The line that replaces a list (`scores["cy"] = [1, 2, 3]`) changed:', [
        'the dictionary itself',
        'a list inside the dictionary',
        'both',
      ]),
    ],
  },

  '3.16': {
    concepts: ['slice-new', 'identity'],
    parts: [output('[2, 3, 4]\n[1, 2]\n[4, 5]\n[1, 2, 3, 4, 5]\n[]\nFalse')],
  },

  '3.17': {
    concepts: ['slot-write', 'nested-access'],
    parts: [
      rule({ wrongWord: 'it has the idea — the object changes and the name stays put — but calls it "updating the variable"' }),
      choice(
        'How do you read `a[b][c]`?',
        [
          'Work out `a[b]` first, producing some object, then apply `[c]` to that object',
          'As one address, `b` and `c` together, looked up all at once',
          'Apply `[c]` first, then `[b]`',
        ],
        0,
        { err: 'syntax' },
      ),
    ],
  },

  '3.18': {
    concepts: ['alias', 'mutate-vs-rebind'],
    parts: [
      output("{'volume': 0}", { prompt: 'What does it actually print?' }),
      choice('Why?', [
        '`backup = settings` points a second name at the one dictionary, so line 3 writes into the original',
        '`backup = settings` makes a copy, but line 3 writes into both',
        'Line 3 moves the name `settings`',
        '`print` shows the most recent change to any dictionary',
      ]),
      fix('settings = {"volume": 5}\nbackup = dict(settings)\nbackup["volume"] = 0\nprint(settings)\n', [
        py("settings == {'volume': 5} and backup == {'volume': 0} and backup is not settings", '`backup` should be a separate dictionary, and `settings` untouched.'),
        prints("{'volume': 5}"),
      ]),
    ],
  },

  /* ------------------------------ checkpoint ------------------------------ */

  'C3.1': {
    concepts: ['slot-write', 'mutate-vs-rebind'],
    parts: [
      choice('In `row[2] = 7`, what changes, and what is rebound?', [
        'The list `row` points at is changed, at slot 2; no name is rebound',
        '`row` is pointed at a new list with 7 in it',
        'The number in slot 2 is turned into 7; no list changes',
        'The list changes, and `row` is rebound to it',
      ]),
    ],
  },

  'C3.2': { concepts: ['alias', 'nested-access'], parts: [output("{'xs': [1, 2, 3]}")] },

  'C3.3': {
    concepts: ['dict-keys'],
    parts: [
      choice('Why can a tuple be a key while a list cannot?', [
        'A tuple’s contents can never change after it is built, so the dictionary can always find it again; a list could change after being filed',
        'Tuples are written with round brackets, and keys need round brackets',
        'Lists are too big to be keys',
        'A list can be a key too, as long as it holds only numbers',
      ]),
      rule({ wrongWord: 'the idea is right but it leans on the word "hashable" instead of saying why' }),
    ],
  },

  'C3.4': { concepts: ['index'], parts: [output('', { raises: 'IndexError' })] },

  'C3.5': {
    concepts: ['nested-access', 'dict-lookup'],
    parts: [
      labels(
        'menu["drinks"][0]["price"]',
        [
          ['menu', 'must be a dictionary with a "drinks" key'],
          ['["drinks"]', 'must produce a list or tuple, read by position'],
          ['[0]', 'must produce a dictionary with a "price" key'],
          ['["price"]', 'produces the price itself'],
        ],
        ['one three-part key, looked up all at once', 'must produce a number'],
      ),
    ],
  },

  'C3.6': {
    concepts: ['dict-lookup', 'slot-write'],
    parts: [
      choice('What is different about the resulting dictionary?', [
        'Absent: it gains a pair, and the new key goes last. Present: same number of pairs, the key keeps its place, only its value is replaced',
        'Both add a pair; the present key ends up in there twice',
        'Absent: it gains a pair at the front. Present: the key moves to the end',
        'Absent: it stops with a KeyError. Present: the value is replaced',
      ]),
    ],
  },
}
