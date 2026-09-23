/**
 * Stage 1 — Reading Straight-Line Code. How each item is graded.
 */
import type { Spec } from '../../../src/collection/model'
import { arrowsTo, countOf, everOf, nameCount } from '../../../src/collection/facts'
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
  printsLine,
  py,
  rule,
  write,
} from './helpers'

export const STAGE_1: Record<string, Spec> = {
  '1.1': {
    concepts: ['bind', 'rhs-first'],
    parts: [
      labels(
        'days = 30 + 1',
        [
          ['days', 'a name, pointed at whatever the right side makes'],
          ['=', 'work out the right side, then point the left name at it'],
          ['30 + 1', 'an expression that makes one number object'],
        ],
        ['a box the number is stored in', 'says the two sides are equal'],
      ),
    ],
  },

  '1.2': { concepts: ['rebind', 'alias'], parts: [output('9 4')] },

  '1.3': {
    concepts: ['literal-new', 'alias'],
    parts: [
      diagram('end', ['copy-to-alias', 'alias-to-copy'], { prompt: 'Which picture is memory after the last line?' }),
      number('How many list objects exist?', (ev) => countOf(ev[0]!.final, 'list'), 2),
      number('How many names?', (ev) => nameCount(ev[0]!.final), 3),
    ],
  },

  '1.4': {
    concepts: ['rebind', 'rhs-first'],
    parts: [order([1, 2, 3, 4, 5], { err: 'flow' }), output('2\n7', { err: 'object' })],
  },

  '1.5': {
    concepts: ['rebind', 'bind'],
    parts: [output('4', { snippet: 'A' }), output('3', { snippet: 'B' }), firstDifference(2)],
  },

  '1.6': { concepts: ['immutable-replace', 'alias'], parts: [output('cats\ncat')] },

  '1.7': { concepts: ['rhs-first', 'bind'], parts: [rule({ wrongWord: 'the idea is right but it says the value is "stored in" the name' })] },

  '1.8': {
    concepts: ['rebind', 'rhs-first'],
    parts: [
      output('2 2', { prompt: 'What does it actually print?' }),
      choice(
        'Why?',
        [
          'Line 3 moves `a` onto 2, so the 1 has no name left by the time line 4 needs it',
          'The two assignment lines happen at the same moment',
          '`b = a` makes `b` follow `a` from then on',
          '`print` shows the names in the wrong order',
        ],
      ),
      fix(
        'a = 1\nb = 2\na, b = b, a\nprint(a, b)\n',
        [py('a == 2 and b == 1', 'At the end `a` should point at 2 and `b` at 1.'), prints('2 1')],
        { err: 'flow' },
      ),
    ],
  },

  '1.9': { concepts: ['print-none', 'call-expr'], parts: [output('hello\nNone')] },

  '1.10': {
    concepts: ['rebind', 'alias'],
    parts: [
      diagram({ after: 3 }, ['follow-rebind', { at: { after: 2 } }], { prompt: 'Which picture is memory after line 3?' }),
      diagram({ after: 4 }, ['earlier', { at: { after: 2 } }], { prompt: 'And after line 4?' }),
      number('How many text objects did the program create?', (ev) => everOf(ev[0]!, 'str'), 2),
      number('How many are still labelled at the end?', (ev) => countOf(ev[0]!.final, 'str'), 1),
    ],
  },

  '1.11': {
    concepts: ['identity', 'literal-new'],
    parts: [
      output('True', { snippet: 'A' }),
      output('False', { snippet: 'B' }),
      firstDifference(2),
      choice('Which sentence explains the difference?', [
        'In A, `w = v` points `w` at the same object; in B each `[1, 2]` builds a separate object',
        'In B the two lists hold different numbers',
        '`id()` gives a new number every time it is called',
        'In A, `w` is a copy of `v`, so their ids match',
      ]),
    ],
  },

  '1.12': {
    concepts: ['call-expr', 'rhs-first'],
    parts: [
      labels(
        'size = len("hello")',
        [
          ['size', 'a name, pointed at the result — last'],
          ['len', 'a name already pointing at a built-in function object'],
          ['( … )', 'use that function now, on what is inside'],
          ['"hello"', 'a text literal, which makes a text object — first'],
        ],
        ['a link that keeps `size` tied to the word', 'a box the length is stored in'],
      ),
      choice('In what order does the work happen?', [
        'the text object is made, then `len` is called on it, then `size` is pointed at the result',
        '`size` is pointed first, then `len` fills it in',
        '`len` is called first, then the text object is made for it',
      ]),
    ],
  },

  '1.13': {
    concepts: ['alias', 'identity'],
    parts: [
      write(
        'm = [1, 2, 3]\nn = m\nprint(id(m) == id(n))\nprint(m is n)\n',
        [
          finishes(),
          py("sorted(k for k in globals() if not k.startswith('__')) == ['m', 'n']", 'Exactly two names, `m` and `n`.'),
          py('isinstance(m, list) and m is n', '`m` and `n` must point at the same list object.'),
          printsLine('True', 'Print a line that proves they are the same object — `m is n`, or their ids.'),
          forbid(
            String.raw`^(?![ \t]*(#|$))(?![ \t]*[A-Za-z_]\w*[ \t]*=[^=])(?![ \t]*print\().+`,
            'Use only assignment and `print`.',
          ),
        ],
        { starter: '# Four lines: two names, one list, and proof.\n' },
      ),
    ],
  },

  '1.14': {
    concepts: ['rebind', 'identity'],
    parts: [
      output('6 6 True'),
      choice('Are `a` and `b` connected at the end?', [
        'No — each was rebound on its own, and they arrived at equal numbers independently',
        'Yes — `b = a` tied them together, which is why both are 6',
      ]),
    ],
  },

  '1.15': {
    concepts: ['rebind', 'call-expr'],
    parts: [
      output('6\n6', { prompt: 'What does it actually print?' }),
      fix('word = "banana"\nsize = len(word)\nprint(size)\nprint(word)\n', [prints('6\nbanana')]),
    ],
  },

  '1.16': { concepts: ['alias', 'bind'], parts: [rule({ wrongWord: 'it says "a copy of the variable" rather than a second name for the same object' })] },

  /* ------------------------------ checkpoint ------------------------------ */

  'C1.1': {
    concepts: ['rhs-first', 'bind'],
    code: ['x = x\n'],
    parts: [
      output('', { raises: 'NameError', prompt: 'Run on its own, with no `x` yet — what happens?' }),
      choice('So what does `x = x` do?', [
        'Nothing, if `x` already exists — and a NameError if it does not',
        'It is always an error',
        'It makes a copy of `x`',
        'Nothing, and it can never go wrong',
      ]),
    ],
  },

  'C1.2': { concepts: ['literal-new', 'identity'], parts: [output('False')] },

  'C1.3': {
    concepts: ['alias', 'literal-new'],
    parts: [
      number('How many list objects exist?', (ev) => countOf(ev[0]!.final, 'list'), 2),
      number('How many arrows point at the list `one` points at?', (ev) => arrowsTo(ev[0]!.final, 'one'), 3),
      number('And at the list `four` points at?', (ev) => arrowsTo(ev[0]!.final, 'four'), 1),
    ],
  },

  'C1.4': {
    concepts: ['rhs-first'],
    parts: [
      choice('In `total = total * 2`, which happens first?', [
        'Python looks up what `total` points at',
        '`total` is pointed somewhere new',
      ]),
    ],
  },

  'C1.5': { concepts: ['alias'], parts: [rule({ wrongWord: 'it keeps the word "value" where it should say "object"' })] },

  'C1.6': { concepts: ['rhs-first', 'rebind'], parts: [order([1, 2, 3, 4]), output('3 2')] },
}
