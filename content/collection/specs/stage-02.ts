/**
 * Stage 2 — Changing a Thing vs. Replacing a Name. How each item is graded.
 */
import type { Part, Spec } from '../../../src/collection/model'
import type { RunEvidence } from '../../../src/memory/extract'
import { countOf, everOf, shown } from '../../../src/collection/facts'
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
  order,
  output,
  prints,
  py,
  requires,
  rule,
  write,
} from './helpers'

/** A choice whose right option is read off the run, with the key's own
 *  pick as the model — so the sweep catches a key that disagrees with
 *  Python, rather than grading the interpreter against itself. */
const derivedChoice = (prompt: string, options: string[], pick: (ev: RunEvidence[]) => string, model: number): Part => ({
  kind: 'choice',
  prompt,
  options,
  answer: (ev) => options.indexOf(pick(ev)),
  model,
})

/** The roles a whole line of 2.1 can have. */
const MOVES_NEW_LIST = 'moves a name, onto a new list'
const CHANGES_LIST = 'changes that list object; no name moves'
const MOVES_NUMBER = 'moves a name, onto a number'
const EMPTIES_OLD = 'changes the old list back to [0]'
const CHANGES_NUMBER = 'changes a number object'

/** Any line that changes an object in place, as source text. */
const CHANGING = String.raw`\.(append|extend|insert|remove|pop|clear|sort|reverse)\(|[-+*]=|\][ \t]*=[^=]|\bdel\b`

export const STAGE_2: Record<string, Spec> = {
  '2.1': {
    concepts: ['mutate-vs-rebind', 'rebind'],
    parts: [
      labels('scores = [10, 20]', [['scores = [10, 20]', MOVES_NEW_LIST]], [CHANGES_LIST, MOVES_NUMBER, CHANGES_NUMBER], {
        prompt: 'Line 1',
      }),
      labels('scores.append(30)', [['scores.append(30)', CHANGES_LIST]], [MOVES_NEW_LIST, MOVES_NUMBER, EMPTIES_OLD], {
        prompt: 'Line 2',
      }),
      labels('scores = [0]', [['scores = [0]', MOVES_NEW_LIST]], [CHANGES_LIST, EMPTIES_OLD, MOVES_NUMBER], {
        prompt: 'Line 3',
      }),
      labels('total = 0', [['total = 0', MOVES_NUMBER]], [CHANGES_NUMBER, MOVES_NEW_LIST, CHANGES_LIST], { prompt: 'Line 4' }),
      number('How many list objects did the program make?', (ev) => everOf(ev[0]!, 'list'), 2, { err: 'object' }),
      number('How many of them still have a name at the end?', (ev) => countOf(ev[0]!.final, 'list'), 1, { err: 'object' }),
    ],
  },

  '2.2': { concepts: ['mutate-vs-rebind', 'alias'], parts: [output('[1, 2, 3]\n[1, 2, 3]')] },

  '2.3': { concepts: ['mutate-vs-rebind', 'literal-new'], parts: [output('[1, 2, 3]\n[1, 2]')] },

  '2.4': {
    concepts: ['mutate-vs-rebind', 'alias'],
    from: ['2.2', '2.3'],
    parts: [
      choice('What did line 3 do in 2.2?', [
        'It changed the one list that both `a` and `b` point at',
        'It built a new list and pointed `a` at it, leaving `b` on the first',
        'It changed `a`’s list, and `b` was updated to match afterwards',
        'It changed `a`’s own copy of the list',
      ]),
      choice('And what did line 3 do in 2.3?', [
        'It built a second list and pointed `a` at it, leaving `b` on the first',
        'It changed the one list that both `a` and `b` point at',
        'It added 3 to the end of `a`’s list',
        'It made a copy of `b` for `a`, then added 3 to the copy',
      ]),
      firstDifference(3),
    ],
  },

  '2.5': {
    concepts: ['method-returns-none', 'mutate-vs-rebind'],
    parts: [
      output('None', { prompt: 'What does it print?' }),
      choice('Why?', [
        '`.sort()` sorts the list where it is and hands back `None`, and line 2 then points `words` at that `None`',
        '`.sort()` cannot sort text, so it gives up and returns `None`',
        '`.sort()` hands back a new sorted list, but `print` cannot show it',
        'The sorted list is still under `words`; `print` shows `None` for a changed list',
      ]),
      fix('words = ["pear", "fig", "apple"]\nwords.sort()\nprint(words)\n', [
        py("words == ['apple', 'fig', 'pear']", 'At the end `words` should point at the sorted list.'),
        prints("['apple', 'fig', 'pear']"),
      ]),
    ],
  },

  '2.6': { concepts: ['plus-equals', 'immutable-replace'], parts: [output('6 5')] },

  '2.7': {
    concepts: ['plus-equals', 'mutate-vs-rebind'],
    parts: [
      output('[1, 2, 3]', { snippet: 'A' }),
      output('[1, 2]', { snippet: 'B' }),
      firstDifference(3),
      choice('Why are `+=` and `= … +` not the same instruction for lists?', [
        '`xs += [3]` asks the existing list to extend itself, so `ys` sees it; `xs = xs + [3]` builds a new list and moves only `xs`',
        'They are the same instruction; the difference comes from `print`',
        '`+=` makes a copy of the list for `xs`, and `= … +` does not',
        '`xs = xs + [3]` changes the list, and `+=` only moves the name',
      ]),
    ],
  },

  '2.8': {
    concepts: ['alias', 'mutate-vs-rebind'],
    parts: [
      diagram({ after: 1 }, ['earlier', 'later'], { prompt: 'Which picture is memory after line 1?' }),
      diagram({ after: 2 }, ['alias-to-copy', 'earlier'], { prompt: 'After line 2?' }),
      diagram({ after: 3 }, ['alias-to-copy', 'earlier'], { prompt: 'After line 3?' }),
      diagram({ after: 4 }, ['earlier', 'follow-rebind', 'later'], { prompt: 'After line 4?' }),
      diagram({ after: 5 }, ['follow-rebind', 'earlier'], { prompt: 'After line 5?' }),
      derivedChoice(
        'What would `print(p, q)` show at the end?',
        ['[9] [1, 2, 3]', '[9, 3] [1, 2]', '[9] [1, 2]', '[9, 3] [9, 3]', '[1, 2, 3] [1, 2, 3]'],
        (ev) => `${shown(ev[0]!.final, 'p')} ${shown(ev[0]!.final, 'q')}`,
        0,
      ),
    ],
  },

  '2.9': {
    concepts: ['plus-equals', 'immutable-replace'],
    parts: [
      output('(1, 2, 3)\n(1, 2)'),
      choice('Why did Python have no other choice?', [
        'A tuple cannot be changed, so `+=` can only build a new tuple and move `t` onto it; `u` stays on the old one',
        'Python copies a tuple whenever a second name points at it',
        '`+=` always builds a new object, whatever it is used on',
        '`u` was a copy of `t` from line 2 on',
      ]),
    ],
  },

  '2.10': {
    concepts: ['immutable-replace', 'mutate-vs-rebind'],
    parts: [
      output('(1, [2, 3, 4])'),
      choice('Is the tuple changed?', [
        'Its own slots are not: it still points at the same 1 and the same list. The list it points at changed',
        'Yes: the tuple itself now holds different things',
        'No, nothing changed: `inner` got its own copy of the list',
        'The tuple cannot hold a changeable list, so line 3 is an error',
      ]),
    ],
  },

  '2.11': {
    concepts: ['alias', 'mutate-vs-rebind'],
    parts: [
      output('[1, 2, 3, 4]\n[1, 2, 3, 4]', { prompt: 'What actually happens?' }),
      line('Which line is the real cause?', 2, 2),
      fix('original = [1, 2, 3]\nextended = original[:]\nextended.append(4)\nprint(original)\nprint(extended)\n', [
        py('original == [1, 2, 3] and extended == [1, 2, 3, 4]', '`original` should be untouched and `extended` should have gained 4.'),
        prints('[1, 2, 3]\n[1, 2, 3, 4]'),
      ]),
    ],
  },

  '2.12': {
    concepts: ['mutate-vs-rebind', 'method-returns-none'],
    parts: [
      output('[3, 1, 2]\n[1, 2, 3]'),
      choice('Which line, if any, changed a list?', [
        'None of them: `sorted` reads `data` and builds a new list',
        'Line 2: `sorted` puts `data` in order',
        'Line 1',
        'Line 2 changed `data`, then line 3 changed it back',
      ]),
    ],
  },

  '2.13': {
    concepts: ['mutate-vs-rebind', 'alias'],
    parts: [
      write(
        'a = [1, 2]\nb = a\na = a + [3]\nprint(a, b)\n',
        [
          finishes(),
          requires(String.raw`^[ \t]*(b[ \t]*=[ \t]*a|a[ \t]*=[ \t]*b)[ \t]*(#.*)?$`, 'First point `a` and `b` at the same list: one name set to the other.'),
          py('isinstance(a, list) and isinstance(b, list) and a is not b', 'At the end `a` and `b` should point at different lists.'),
          forbid(CHANGING, 'Never change `b`’s list: split them by moving `a` with a plain `=`.'),
        ],
        { prompt: 'Four lines that split `a` from `b` by moving a name.', starter: '# a and b on one list, then a moved to a different one.\n' },
      ),
      write(
        'a = [1, 2]\nb = a\nb.append(3)\nprint(a, b)\n',
        [
          finishes(),
          requires(String.raw`^[ \t]*(b[ \t]*=[ \t]*a|a[ \t]*=[ \t]*b)[ \t]*(#.*)?$`, 'Start the same way: `a` and `b` on one list.'),
          requires(String.raw`\bb\.(append|extend|insert)\(|\bb[ \t]*\+=`, 'This time change `b`’s list instead of moving a name.'),
          py('isinstance(b, list) and a is b', 'Changing a list moves no name, so `a` and `b` should still share it.'),
        ],
        { prompt: 'Now four lines that change `b`’s list instead.', starter: '# a and b on one list, then b’s list changed.\n' },
      ),
      choice('Could the second program print what the first did?', [
        'No: the change shows through `a` too, so `a` and `b` always print the same',
        'Yes, with a different number appended',
        'Yes, if `b` is printed before `a`',
      ]),
      choice('Which would be dangerous if other code also pointed at that list?', [
        'The second: changing a shared list is seen by every name pointing at it',
        'The first: moving `a` also moves every other name',
        'Neither: other code keeps its own copy',
      ]),
    ],
  },

  '2.14': {
    concepts: ['mutate-vs-rebind', 'literal-new'],
    parts: [
      order([1, 2, 3, 4, 5, 6, 7], { err: 'flow' }),
      output('1\n2'),
      number('How many list objects did the program make?', (ev) => everOf(ev[0]!, 'list'), 2),
    ],
  },

  '2.15': {
    concepts: ['immutable-replace', 'mutate-vs-rebind'],
    parts: [
      output('abcd', { snippet: 'A' }),
      output('', { snippet: 'B', raises: 'TypeError', err: 'object' }),
      firstDifference(2),
      choice(
        'Why is B’s failure guaranteed, not bad luck?',
        [
          'A text object has no slots that can be changed, so writing into one is refused every time, whatever the position',
          'Position 3 is past the end of `"abc"`; `s[2] = "d"` would work',
          '`s` has to be made longer first, and then it would work',
          'Line 3 has a typo',
        ],
        0,
        { err: 'object' },
      ),
    ],
  },

  '2.16': {
    concepts: ['mutate-vs-rebind', 'rebind'],
    parts: [
      rule({
        prompt: '“If the thing immediately to the left of the `=` is a bare name, then the line …”',
        wrongWord: 'it says the name "gets a new value" rather than being pointed at a new object — the idea is right if it also says no object changes',
      }),
      rule({
        prompt: '“If a line has no `=` at all but ends in `.something(...)`, then the line …”',
        wrongWord: 'it says the method "updates the variable" rather than changing the object — the idea is right if it also says no name moves',
      }),
    ],
  },

  '2.17': {
    concepts: ['plus-equals', 'alias'],
    parts: [
      output('[1, 2, 3, 4]\n[1, 2, 3, 4]', { prompt: 'What does it actually print?' }),
      choice('What went wrong?', [
        'Line 2 did not copy, so there is one list, and `+=` on line 3 changed that shared list',
        'Only line 3: `+=` changed `base` directly',
        '`+=` built a new list, and `base` followed `bigger` onto it',
        '`print(base)` shows `bigger` by mistake',
      ]),
      line('Which line should the fix change?', 2, 2),
      fix('base = [1, 2, 3]\nbigger = base[:]\nbigger += [4]\nprint(base)\nprint(bigger)\n', [
        prints('[1, 2, 3]\n[1, 2, 3, 4]'),
        py('base is not bigger', 'Fix the line that failed to make a second list, so the two names are on separate lists.'),
      ]),
    ],
  },

  /* ------------------------------ checkpoint ------------------------------ */

  'C2.1': {
    concepts: ['mutate-vs-rebind', 'plus-equals'],
    parts: [
      choice(
        'Which of these change an object rather than move a name?',
        ['`x = x + 1`', '`x.append(1)`', '`x = []`', '`x.sort()`'],
        [1, 3],
      ),
      choice('And `x += [1]`, with `x` a list?', ['It changes the list', 'It moves the name `x` onto a new list'], 0, { err: 'object' }),
    ],
  },

  'C2.2': { concepts: ['mutate-vs-rebind', 'alias'], parts: [output('[1] [1, 2, 3]')] },

  'C2.3': {
    concepts: ['method-returns-none', 'immutable-replace'],
    code: ['text = "abc"\ntext = text.upper()\nitems = [3, 1, 2]\nitems = items.sort()\nprint(text, items)\n'],
    parts: [
      output('ABC None', { prompt: 'Both lines, run together: what is printed?' }),
      choice('What is the difference?', [
        '`.upper()` cannot change the text, so it makes a new one and the `=` keeps it; `.sort()` changes the list and hands back `None`, so the `=` throws the list away',
        '`.upper()` works on text and `.sort()` does not work on lists of numbers',
        'Both change their object; `.sort()` just forgets to hand it back',
        '`items.sort()` builds a new sorted list, and the `=` points `items` at an empty copy',
      ]),
    ],
  },

  'C2.4': {
    concepts: ['immutable-replace', 'mutate-vs-rebind'],
    parts: [
      choice('Can a tuple’s contents ever appear to change?', [
        'Yes, if it holds a changeable object: that object can change, while the tuple’s own slots never do',
        'No: a tuple freezes everything inside it',
        'Yes: a tuple’s slots can be pointed at new objects',
      ]),
      write(
        't = ([1], 2)\nt[0].append(9)\n',
        [
          finishes(),
          py(
            "any(isinstance(v, tuple) and any(isinstance(i, (list, dict, set)) for i in v) for v in list(globals().values()))",
            'Make a tuple that holds a changeable object, such as a list.',
          ),
          requires(String.raw`\.(append|extend|insert|add|update)\(|\][ \t]*\.`, 'Then change the object inside it.'),
        ],
        { prompt: 'Give a two-line example.' },
      ),
    ],
  },

  'C2.5': {
    concepts: ['mutate-vs-rebind', 'alias'],
    parts: [
      diagram('end', ['follow-rebind', 'earlier', { at: { after: 2 } }], { prompt: 'Which picture is memory after the last line?' }),
      number('How many list objects have names at the end?', (ev) => countOf(ev[0]!.final, 'list'), 2),
    ],
  },

  'C2.6': {
    concepts: ['plus-equals', 'immutable-replace'],
    code: ['n = 1\nm = n\nn += 1\nnums = [1]\nothers = nums\nnums += [1]\nprint(n is m, nums is others)\n'],
    parts: [
      output('False True', { prompt: 'First, what does this print?' }),
      choice('Why does `n += 1` move `n` when `nums += [1]` does not move `nums`?', [
        'A number object cannot be changed, so `+=` must build a new one and move `n`; a list can change itself, so no name needs to move',
        '`+=` always moves the name; the list only looks the same',
        'Numbers are copied when a second name points at them, and lists are not',
        '`nums += [1]` does move `nums`, onto a copy with the extra item',
      ]),
    ],
  },
}
