import { ever, heard, points, sameObject, targetOf, type Evidence, type Lesson, type Line } from './core'

/**
 * Stage 1, the ideas: reading straight-line code, told in beats.
 *
 * This level used to be the collection's Stage 1 prose, shown whole: two
 * screens of paragraphs, most of it — a name points at an object,
 * rebinding, `b = a` sharing one object — taught already by the Names and
 * Taking an Order lessons. The markdown is still the collection's source
 * of truth; this lesson takes its ideas, not its text, and keeps only
 * what Stage 1 adds:
 *
 * 1. the right-hand side is worked out first (`total = total + 1`),
 *    predicted before it is run;
 * 2. `print` shows an object and hands back `None`;
 * 3. a list is an object too, `b = a` shares it, and `id()` says which
 *    object a name points at — used on lists only, as the stage says,
 *    because small numbers and short strings are shared behind the scenes
 *    (invariant 4 draws them as one object).
 *
 * The picture is the memory graph (R6): every step makes something appear
 * or an arrow move there, and the beat after it points at it (focus
 * `memory`). It opens on the bridge into reading (R12, PEDAGOGY §3).
 */

const typeOf = (e: Evidence, name: string): string | null => {
  const id = targetOf(e.snapshot, name)
  return id === null ? null : (e.snapshot.objects[id]?.type ?? null)
}

/** The line was a bare expression, worked out and let go. */
const letGo = (l: Line) => l.ok && l.thought !== null && !/=/.test(l.source.replace(/==/g, ''))

export const s1Ideas: Lesson = {
  id: 's1-ideas',
  teaches: [],
  steps: [
    {
      beats: [
        { say: 'From here on, other people write the programs, and the robot runs them.' },
        { say: 'A good engineer knows what the robot will do before it does it.' },
        { say: 'So we read a program one line at a time, and ask what each line does to memory.' },
        { say: 'Start with a name to work on.', focus: 'console' },
      ],
      say: 'Type `total = 5`.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'total', '5')),
      praise: 'There\'s `total`, with an arrow to `5`.',
      nudge: (l) => (letGo(l) ? 'That was thought of and let go. Give it the name: `total = 5`.' : undefined),
    },
    {
      beats: [
        { say: 'Now a line with `total` on both sides of the `=`.' },
        { say: 'Python always works out the right side first, before any arrow moves.' },
        { say: 'So `total + 1` uses the `5`, and only then does `total` point at the answer.' },
      ],
      say: 'Type `total = total + 1`, and watch the arrow.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'total', '6')),
      praise: 'The arrow moved to `6`. The `5` was used before it moved.',
      nudge: (l) =>
        letGo(l) ? 'That worked out the answer and let it go. Point `total` at it: `total = total + 1`.' : undefined,
    },
    {
      beats: [{ say: 'Now read before you run.', focus: 'memory' }],
      say: 'If that line runs once more, what will `total` point at? Type just the number.',
      tag: 'you',
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '7' && (t.source ?? '').trim() === '7'),
      praise: 'Seven: the right side uses the `6` that is there now.',
      nudge: (l) => {
        if (/total/.test(l.source)) return 'Predict it first: type just the number you expect.'
        if (l.thought?.type === 'int') return 'Read it again: `total + 1`, with `total` at `6` now.'
        return undefined
      },
    },
    {
      beats: [{ say: 'Now let the robot check your prediction.' }],
      say: 'Run `total = total + 1` again.',
      tag: 'you',
      done: (e) => ever(e, (s) => points(s, 'total', '7')),
      praise: 'Seven, as you said. That is reading a line.',
    },
    {
      beats: [
        { say: '`print` shows an object on the screen.' },
        { say: 'But it hands nothing back to keep: Python calls that nothing `None`.' },
      ],
      say: 'Type `shown = print(total)`, then look at what `shown` points at.',
      tag: 'you',
      done: (e) => points(e.snapshot, 'shown', 'None'),
      praise: 'The `7` was printed, but `shown` points at `None`. Showing is not producing.',
    },
    {
      beats: [
        { say: 'Square brackets make a list, and a list is an object too.' },
        { say: '`[10, 20]` is one list, holding two things.' },
      ],
      say: 'Make a list and name it: `a = [10, 20]`.',
      tag: 'you',
      done: (e) => typeOf(e, 'a') === 'list',
      praise: 'One list, with its own card, and `a` pointing at it.',
    },
    {
      beats: [{ say: '`b = a` copies the arrow, not the list.' }],
      say: 'Type `b = a`, and look below.',
      tag: 'you',
      done: (e) => ever(e, (s) => sameObject(s, 'a', 'b')),
      praise: 'One list, two arrows. There is still only one list.',
      nudge: (l) => (/\[/.test(l.source) ? 'Use the name, not the brackets: `b = a`.' : undefined),
    },
    {
      beats: [
        { say: '`id(x)` gives a number that says which object `x` points at.' },
        { say: 'Two names have the same `id` exactly when they share one object.' },
      ],
      say: 'Ask the robot: `id(a) == id(b)`.',
      tag: 'robot',
      done: (e) => heard(e, (t) => t.type === 'bool' && t.repr === 'True' && /id\s*\(/.test(t.source ?? '')),
      praise: '`True`: `a` and `b` share one list.',
    },
    {
      beats: [{ say: 'A second `[10, 20]`, typed out again, builds a new list.' }],
      say: 'Type `c = [10, 20]`, then ask: `id(c) == id(a)`.',
      tag: 'robot',
      done: (e) =>
        typeOf(e, 'c') === 'list' &&
        heard(e, (t) => t.type === 'bool' && t.repr === 'False' && /id\s*\(\s*[ca]\s*\)/.test(t.source ?? '')),
      praise: '`False`: it looks the same, but `c` has a list of its own.',
      nudge: (l) => (/^\s*c\s*=/.test(l.source) ? 'Now ask the robot: `id(c) == id(a)`.' : undefined),
    },
  ],
  outro: [
    { say: 'Every line did one thing to memory: made an object, moved an arrow, or showed something.' },
    { say: 'Read each line that way, and you know what the robot will do.' },
    { say: 'The exercises are next: you read first, then the robot runs it.' },
  ],
  takeaway: 'Read one line at a time: work out the right side, then see which arrow moves.',
}
