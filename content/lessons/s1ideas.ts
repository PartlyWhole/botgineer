import { ever, everBy, heard, points, sameObject, targetOf, type Evidence, type Lesson, type Line } from './core'

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
 * 2. `print` shows an object and hands back `None`, and shows two with a
 *    space between; `len` counts a string's characters;
 * 3. a list is an object too, `b = a` shares it, and `id()` says which
 *    object a name points at — used on lists only, as the stage says,
 *    because small numbers and short strings are shared behind the scenes
 *    (invariant 4 draws them as one object).
 *
 * The picture is the memory graph (R6): every step makes something appear
 * or an arrow move there, and the beat after it points at it (focus
 * `memory`). It opens on the bridge into reading (R12, PEDAGOGY §3), and
 * names what Stage 1's exercises and keys lean on (R5): *program*,
 * *expression*, *rebinding*, `print` with two things, `len`, *literal*,
 * and *label* as the text's word for our arrow.
 */

const typeOf = (e: Evidence, name: string): string | null => {
  const id = targetOf(e.snapshot, name)
  return id === null ? null : (e.snapshot.objects[id]?.type ?? null)
}

/** `name` points at a list holding `10` then `20`, read from its slots
 *  (a list's own repr is only its shape, `2 items`). */
const tenTwenty = (e: Evidence, name: string): boolean => {
  const id = targetOf(e.snapshot, name)
  const o = id === null ? undefined : e.snapshot.objects[id]
  if (o?.type !== 'list' || !o.elements) return false
  return o.elements.map((el) => e.snapshot.objects[el.target]?.repr).join(', ') === '10, 20'
}

/** The line asks `id` of both names: `id(a) == id(b)`, either way round. */
const ids = (source: string | undefined, p: string, q: string): boolean =>
  [p, q].every((n) => new RegExp(`id\\s*\\(\\s*${n}\\s*\\)`).test(source ?? ''))

/** The misses at an `id` question: a typed answer, `==` on the lists
 *  themselves, or one name asked about twice. */
function idMiss(l: Line, p: string, q: string): string | undefined {
  const ask = `\`id(${p}) == id(${q})\``
  if (/^\s*(True|False)\s*$/.test(l.source)) return `That's you saying \`${l.source.trim()}\`. Let the robot check: ${ask}.`
  if (/==/.test(l.source) && !/id\s*\(/.test(l.source)) return `\`==\` asks if they look the same. \`id\` asks if they are one object: ${ask}.`
  if (/id\s*\(/.test(l.source) && l.thought?.type === 'bool') return `Ask about both names, one on each side: ${ask}.`
  return undefined
}

/** The line was a bare expression, worked out and let go. */
const letGo = (l: Line) => l.ok && l.thought !== null && !/=/.test(l.source.replace(/==/g, ''))

export const s1Ideas: Lesson = {
  id: 's1-ideas',
  teaches: [],
  steps: [
    {
      beats: [
        { say: 'Instructions in a row, run one after another, are called a program.' },
        { say: 'Soon you\'ll read programs other people wrote, and the robot will run them.' },
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
        { say: 'The right side, `total + 1`, is an **expression**: Python works it out to one object.' },
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
      beats: [
        { say: 'Pointing a name at a new object like that is called **rebinding** it.', focus: 'memory' },
        { say: 'Now read before you run.', focus: 'memory' },
      ],
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
      praise: '`total` points at `7` now, as you predicted. That is reading a line.',
    },
    {
      beats: [
        { say: '`print` shows an object on the screen.' },
        { say: 'But it hands nothing back to keep: Python calls that nothing `None`.' },
      ],
      say: 'Type `shown = print(total)`, then look at what `shown` points at.',
      tag: 'you',
      done: (e) => points(e.snapshot, 'shown', 'None'),
      praise: '`shown` points at `None`: `print` shows things, but hands back nothing. Showing is not producing.',
      nudge: (l) => {
        if (/^\s*print\s*\(/.test(l.source)) return 'That showed it, but kept nothing. Keep what `print` hands back: `shown = print(total)`.'
        if (/^\s*shown\s*=(?!=)/.test(l.source) && l.ok) return 'That points `shown` at something else. Point it at what `print` hands back: `shown = print(total)`.'
        return undefined
      },
    },
    {
      beats: [{ say: 'Give `print` two things, and it shows both on one line, with a space between.' }],
      say: 'Type `print(total, 5)`.',
      tag: 'you',
      // Not a thought: `print` hands back `None`, which the robot does not
      // describe, so the line itself is the evidence (`everBy`).
      done: (e) => everBy(e, (source) => /^\s*print\s*\(.+,.+\)/.test(source)),
      praise: 'Both on one line, with a space between.',
      nudge: (l) =>
        /^\s*print\s*\(/.test(l.source) && l.ok && !/,/.test(l.source)
          ? 'That gave `print` one thing. Give it two, with a comma between: `print(total, 5)`.'
          : undefined,
    },
    {
      beats: [
        { say: '`len` is a function built into Python: it counts the characters in a string.' },
        { say: '`len("hello")` is `5`, one for each letter.' },
      ],
      say: 'Ask the robot: `len("Mira")`.',
      tag: 'robot',
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '4' && /len\s*\(/.test(t.source ?? '')),
      praise: '`4`: the robot counted the letters in `"Mira"`.',
      nudge: (l) => {
        if (/^\s*\d+\s*$/.test(l.source)) return 'That\'s you counting. Let the robot count: `len("Mira")`.'
        if (/len\s*\(\s*Mira\s*\)/.test(l.source)) return 'The word needs its quotes: `len("Mira")`.'
        return undefined
      },
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
      nudge: (l) => (letGo(l) && /^\s*\[/.test(l.source) ? 'That list was built and let go. Give it a name: `a = [10, 20]`.' : undefined),
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
      done: (e) => heard(e, (t) => t.type === 'bool' && t.repr === 'True' && ids(t.source, 'a', 'b')),
      praise: '`True`: `a` and `b` share one list.',
      nudge: (l) => idMiss(l, 'a', 'b'),
    },
    {
      beats: [
        { say: 'Brackets written out like `[10, 20]` are a **literal**, and each one builds a new list.' },
        { say: 'So a second `[10, 20]`, typed out again, is a list of its own.' },
      ],
      say: 'Type `c = [10, 20]`, then ask: `id(c) == id(a)`.',
      tag: 'robot',
      done: (e) =>
        tenTwenty(e, 'c') &&
        heard(e, (t) => t.type === 'bool' && t.repr === 'False' && ids(t.source, 'c', 'a')),
      praise: '`False`: it looks the same, but `c` has a list of its own.',
      nudge: (l) => {
        if (/^\s*c\s*=(?!=)/.test(l.source) && l.ok) return 'Now ask the robot: `id(c) == id(a)`.'
        return idMiss(l, 'c', 'a')
      },
    },
  ],
  outro: [
    { say: 'Every line did one thing to memory: made an object, moved an arrow, or showed something.' },
    { say: 'Read each line that way, and you know what the robot will do.' },
    { say: 'The exercises sometimes call a name a **label**, stuck on its object: the same thing as our arrow.' },
    { say: 'Next, you\'ll write a program to wake the robot. Then the exercises: you read first, then it runs.' },
  ],
  takeaway: 'Read one line at a time: work out the right side, then see which arrow moves.',
}
