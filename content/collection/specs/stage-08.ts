/**
 * Stage 8 — Crossing a Function Boundary. How each item is graded.
 */
import type { Spec } from '../../../src/collection/model'
import { countOf } from '../../../src/collection/facts'
import {
  block,
  choice,
  diagram,
  finishes,
  fix,
  forbid,
  line,
  number,
  order,
  output,
  printsLine,
  py,
  requires,
  rule,
  write,
} from './helpers'

export const STAGE_8: Record<string, Spec> = {
  '8.1': {
    concepts: ['def-vs-call'],
    parts: [order([1, 4, 5, 2, 6, 7, 2]), output('before\nin 1\nafter\nin 2')],
  },

  '8.2': {
    concepts: ['def-vs-call', 'call-expr'],
    parts: [
      output('A\nB\nrunning'),
      choice('What does line 5, `f` on its own, do?', [
        'It produces the function object and does nothing with it — no call, no output, no error',
        'It calls `f`, so `running` is printed there',
        'It is an error, because a function name needs parentheses',
        'It prints the function object',
      ]),
    ],
  },

  '8.3': {
    concepts: ['def-vs-call', 'local-scope'],
    parts: [block(1, [2, 3, 4, 5], { 1: 1, 2: 2, 3: 5, 4: 3, 5: 2, 7: 1, 8: 1 })],
  },

  '8.4': { concepts: ['param-binding', 'rebind'], parts: [output('5 6')] },

  '8.5': { concepts: ['param-mutation', 'alias'], parts: [output("['a', 'new']")] },

  '8.6': {
    concepts: ['param-binding', 'param-mutation'],
    parts: [
      output("['a']", { snippet: 'A' }),
      output("['a', 'new']", { snippet: 'B' }),
      // The automatic rule charges a call's effects to the calling line, so
      // it lands on line 5; the key's point is the body line that differs.
      // The key names no line, so both are accepted.
      line('Click the first line where the two snippets’ behaviour differs.', [2, 5], 2),
      choice('Which sentence states the rule?', [
        'The caller sees a change only when the body changes the object its name points at; rebinding the parameter moves a name the caller cannot see',
        'Lists are passed by reference, so any change to `items` reaches the caller',
        'Whether the caller sees a change depends on the type of the argument',
        'A function always gets a copy of the list, so neither snippet can affect `xs`',
      ]),
    ],
  },

  '8.7': {
    concepts: ['param-mutation', 'param-binding'],
    parts: [
      diagram({ before: 3 }, ['alias-to-copy', 'earlier', 'later'], {
        prompt: 'Which picture is memory just before line 3 runs — the caller’s names and the call’s?',
      }),
      output('[1, 2, 3]'),
    ],
  },

  '8.8': { concepts: ['local-scope', 'return-object'], parts: [output('1', { raises: 'NameError' })] },

  '8.9': { concepts: ['local-scope'], parts: [output('inside 99\noutside 0')] },

  '8.10': { concepts: ['return-object', 'print-none'], parts: [output('hi\nNone')] },

  '8.11': {
    concepts: ['return-object', 'literal-new'],
    parts: [
      output('[1, 2, 3] [1, 2] False'),
      number('How many list objects exist at the end?', (ev) => countOf(ev[0]!.final, 'list'), 2),
    ],
  },

  '8.12': {
    concepts: ['return-object', 'alias'],
    parts: [
      output('[1, 2, 3]', { prompt: 'What does it actually print?' }),
      choice('Why?', [
        '`return box["items"]` hands back the very list inside the dictionary, so `snapshot` is another name for it',
        'Returning a list makes a copy, but the copy is refreshed when the original changes',
        '`snapshot` follows the name `box` wherever it goes',
        'The append happens before the call',
      ]),
      fix(
        'def contents(box):\n    return box["items"][:]\n\nbox = {"items": [1, 2]}\nsnapshot = contents(box)\nbox["items"].append(3)\nprint(snapshot)\n',
        [
          finishes(),
          py('snapshot == [1, 2]', '`snapshot` should still be `[1, 2]` after the box’s list changes.'),
          py('snapshot is not box["items"]', '`snapshot` should be its own list, not the box’s.'),
          requires(String.raw`^box\["items"\]\.append\(3\)`, 'Fix it inside the function; leave the later append as it is.'),
        ],
      ),
    ],
  },

  '8.13': {
    concepts: ['local-scope', 'param-binding'],
    parts: [
      output('', { raises: 'UnboundLocalError', prompt: 'What happens?' }),
      choice('Why, precisely?', [
        '`count` is assigned in the body, so it is local for the whole body — and the right side reads that local before it is bound',
        'The outer `count` is read first, but the assignment is not allowed to change it',
        '`count` has not been defined anywhere in the program',
        'A function cannot read any name from outside it',
      ]),
      fix(
        'count = 0\n\ndef bump(count):\n    return count + 1\n\ncount = bump(count)\nprint(count)\n',
        [
          finishes(),
          py('count == 1', 'At the end the outer `count` should be 1.'),
          forbid(String.raw`\bglobal\b`, 'For this fix, do not use `global`: take a parameter and return.'),
        ],
        { prompt: 'Fix one: without `global` — take a parameter and return the result.', small: 3 },
      ),
      fix(
        'count = 0\n\ndef bump():\n    global count\n    count = count + 1\n    return count\n\nprint(bump())\n',
        [
          finishes(),
          py('count == 1', 'After the call the outer `count` should be 1.'),
          printsLine('1', 'It should print 1.'),
          requires(String.raw`^\s*global\s+count\b`, 'For this fix, declare that `bump` assigns to the outer `count`.'),
        ],
        { prompt: 'Fix two: declare the intent to assign to the outer name.' },
      ),
    ],
  },

  '8.14': {
    concepts: ['return-object', 'enumerate-zip'],
    parts: [
      output('(3, 1)\n3 1\ntuple'),
      choice('What does `return a // b, a % b` hand back?', [
        'One tuple object holding two numbers',
        'Two separate objects, one per name on the left',
        'Only the first value; the second is dropped',
      ]),
    ],
  },

  '8.15': {
    concepts: ['return-exits', 'break-scope'],
    parts: [
      fix(
        'def find_above(grid, limit):\n    for row in grid:\n        for cell in row:\n            if cell > limit:\n                return cell\n    return None\n\nprint(find_above([[1, 2], [3, 4]], 2))\n',
        [
          finishes(),
          printsLine('3', 'It should still print 3.'),
          requires(String.raw`^def\s`, 'Put the search in a function.'),
          requires(String.raw`^\s+return\b`, 'Leave both loops with `return`.'),
          forbid(String.raw`\bbreak\b`, 'No `break` — `return` leaves both loops at once.'),
          forbid(String.raw`^\s*found\s*=`, 'No flag.'),
        ],
        { small: 10 },
      ),
    ],
  },

  '8.16': {
    concepts: ['mutable-default'],
    parts: [
      output("['a']\n['a', 'b']\n['c']\n['a', 'b', 'd']"),
      choice('Why does the fourth line print `[\'a\', \'b\', \'d\']`?', [
        'It omitted the list, so it got the one default list — built once when `def` ran, still holding `a` and `b` — and appended to it',
        'The third call’s list replaced the default, but the old items came back',
        'Every call starts a fresh empty list, then Python replays the earlier calls',
        '`acc` is a local name that survives between calls',
      ]),
    ],
  },

  '8.17': {
    concepts: ['mutable-default'],
    from: ['8.16'],
    parts: [
      fix(
        'def collect(item, acc=None):\n    if acc is None:\n        acc = []\n    acc.append(item)\n    return acc\n\nprint(collect("a"))\nprint(collect("b"))\n',
        [
          finishes(),
          py('collect("x") == ["x"] and collect("y") == ["y"]', 'Two calls without a list should each start empty.'),
          py('collect("z", ["q"]) == ["q", "z"]', 'A list passed in should still be the one appended to.'),
          py('collect("p") is not collect("p")', 'Each call without a list should build its own list.'),
        ],
        { small: 8 },
      ),
      choice('Which line of the fix does the work?', [
        '`acc = []`, inside the body — it runs on every call that reaches it',
        '`acc=None` in the header',
        '`if acc is None:`',
        '`acc.append(item)`',
      ]),
    ],
  },

  '8.18': {
    concepts: ['def-vs-call', 'local-scope'],
    parts: [
      output('outer start\ninner running\nouter got 42\nouter done'),
      choice('`inner` is defined after `outer`. Why is that not a problem?', [
        'The body of `outer` only runs when `outer()` is called, and by then both `def` lines have run — names in a body are looked up when it runs',
        'Python reads every `def` in the file before running anything',
        'Functions can always see each other, wherever they are defined',
        'It would be a problem, but Python fixes the order for you',
      ]),
    ],
  },

  '8.19': {
    concepts: ['return-object', 'local-scope'],
    parts: [
      write(
        'def tally(words):\n    counts = {}\n    for w in words:\n        counts[w] = counts.get(w, 0) + 1\n    return counts\n\ndata = ["a", "b", "a"]\nfirst = tally(data)\nsecond = tally(data)\nprint(first)\nprint(data)\nprint(first is second)\nfirst["z"] = 99\nprint(second)\n',
        [
          finishes(),
          py('tally(["a", "b", "a"]) == {"a": 2, "b": 1}', '`tally(["a", "b", "a"])` should be `{\'a\': 2, \'b\': 1}`.'),
          py('(lambda w: (tally(w), w == ["a", "b", "a"])[1])(["a", "b", "a"])', '`tally` must not change the list it is given.'),
          py('tally(["x"]) == {"x": 1} and tally(["x"]) == {"x": 1}', 'Calling it twice in a row should give the same answer.'),
          py('tally(["x"]) is not tally(["x"])', 'Each call should hand back its own dictionary.'),
          py('(lambda r: (r.__setitem__("z", 9), tally(["x"]) == {"x": 1})[1])(tally(["x"]))', 'Changing a returned dictionary should not affect a later call.'),
          printsLine('False', 'Prove it: print whether the two results are the same object.'),
        ],
        { starter: 'def tally(words):\n    ...\n' },
      ),
    ],
  },

  '8.20': {
    concepts: ['param-mutation', 'return-object'],
    parts: [
      output('[3, 1, 2] [1, 2, 3]', { snippet: 'A' }),
      output('[1, 2, 3] [1, 2, 3] True', { snippet: 'B' }),
      // As in 8.6: the automatic rule lands on the call (line 6); the body
      // line that differs is line 2. Both are accepted.
      line('Click the first line where the two snippets’ behaviour differs.', [2, 6], 2),
      choice('Which would you rather be handed by a colleague, and why?', [
        'A — it leaves the caller’s list alone and hands back a new sorted one; B changes the caller’s list and returns that same object',
        'B — returning the changed list makes it more convenient, at no cost',
        'Either — both return a sorted list, so they behave the same',
        'A — because `sorted` is faster than `.sort()`',
      ]),
    ],
  },

  '8.21': {
    concepts: ['def-vs-call', 'param-binding'],
    parts: [
      rule({ prompt: 'What does the `def` line actually do when Python reaches it?', err: 'flow', wrongWord: 'it says the function is "saved" or "declared" without saying a function object is built and the name bound to it' }),
      rule({ prompt: 'What is bound to a parameter when a function is called?', err: 'object', wrongWord: 'it says the parameter gets "the variable" or "a reference" instead of the argument’s object' }),
      rule({ prompt: 'When can a caller see a change made inside a function?', err: 'object', wrongWord: 'it says "pass by reference" instead of changing the object versus rebinding the name' }),
      rule({ prompt: 'What does `return` hand back, and what does it not do?', err: 'object', wrongWord: 'it says "returns the value" without saying it is the same object, not a copy' }),
      rule({ prompt: 'When is a default argument’s value created?', err: 'flow', wrongWord: 'it says "when the function is defined" loosely rather than when the `def` line runs' }),
    ],
  },

  /* ------------------------------ checkpoint ------------------------------ */

  'C8.1': { concepts: ['param-binding', 'param-mutation'], parts: [output('0 [1]')] },

  'C8.2': {
    concepts: ['def-vs-call', 'return-object'],
    parts: [
      choice('What does the first line print?', ['None', 'Nothing — an empty line', 'An error, because `return` has no value']),
      // The function's text includes an address, so its exact form is not pinned.
      choice('And the second line — why does it surprise people?', [
        'It prints the function object itself, something like `<function f at 0x…>`, because naming a function does not call it',
        'It prints `None` again, because `f` returns nothing',
        'It is a NameError, because `f` needs parentheses',
        'It prints nothing, because `f` on its own does nothing',
      ]),
    ],
  },

  'C8.3': {
    concepts: ['param-mutation', 'param-binding'],
    parts: [
      choice('Which correction is right?', [
        'Python does not copy arguments: the parameter is a new name bound to the same object, so the function can change the caller’s list — though rebinding the parameter cannot affect the caller',
        'They are right: lists are copied, but dictionaries are not',
        'They are right for small lists, which are copied; large ones are shared',
        'Python passes the caller’s name itself, so the function can make it point anywhere',
      ]),
      choice('Which one-line function is a counterexample?', [
        '`def f(xs): xs.clear()`',
        '`def f(xs): xs = []`',
        '`def f(xs): return xs + [1]`',
        '`def f(xs): print(xs)`',
      ]),
    ],
  },

  'C8.4': { concepts: ['mutable-default'], parts: [output('1 2 3')] },

  'C8.5': {
    concepts: ['return-exits', 'loop-passes'],
    parts: [block(1, [2, 3, 4], { 1: 1, 2: 2, 3: 1, 4: 1, 6: 1, 7: 1 }), output('0\nnever')],
  },

  'C8.6': {
    concepts: ['param-binding', 'mutate-vs-rebind'],
    parts: [
      choice('Why can `items = []` at the top of a function not clear the caller’s list?', [
        'It binds the local parameter name to a brand-new list; the caller’s name still points at the original, untouched object',
        'It does clear it — the caller’s list becomes empty',
        'It makes a copy of the caller’s list and clears the copy',
        'Assigning to a parameter is an error',
      ]),
      choice('What would the body have to do instead?', [
        'Change the object itself — `items.clear()` or `items[:] = []`',
        'Write `items = None` first',
        '`return []`',
        'Use `global items`',
      ]),
    ],
  },
}
