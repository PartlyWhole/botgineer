/**
 * Level 1b, Five data types (`types`): docs/PEDAGOGY.md §5.
 *
 * The robot's problem (R12): it has been thinking of everything the same
 * way. It ends knowing five kinds of data, each one met in the same
 * order — a situation that needs it, shown on the stage; then its name;
 * then one line the player types to use it (R1). The asks are copy tasks
 * on purpose (§8): choosing between the types is the next level's job,
 * and this one only has to make each of them familiar.
 *
 * The **shelf** is the lesson's spine. It stands on the stage between
 * the situations, and each type, the moment it is named, flies into its
 * slot with its examples and stays. It replaces the nested boxes, which
 * claimed an `int` sits inside a `float` (R8: `3` and `3.0` are different
 * objects of different types). The answers the player got right are
 * filed into it too (`staging` hands it only those), so by the end the
 * shelf holds what they said.
 *
 *  - `bool`: a lamp on a switch, flipped by the narration to `True` and
 *    back to `False` before the player turns it on.
 *  - `int`: apples dropping into a basket in whole steps, half an apple
 *    bouncing off, then a lift that goes below the ground.
 *  - `float`: a glass filling smoothly, then a number line where the
 *    level lands between the ticks and gets its dot.
 *  - char: Mira arrives, a person who reads letters rather than `True`,
 *    and `7` stands beside `"7"` (R7). Python has no char type (R8), and
 *    the crow says so where it names one: a char is a `str` one letter
 *    long, which is what its slot's tag says.
 *  - `str`: letters threaded into a string, the quotes clipped on each
 *    end as where it starts and stops.
 *
 * Ordered, so each answer counts only for the question that asked it.
 * The likely misses — `true`, `1.5` floors, a bare `M`, a string with no
 * quotes — each have a reply, and each is visible in the picture that
 * asked: a word stuck on the lamp, a lift stuck between floors.
 */
import { numberOf, textOf, type Prop } from '../../src/scene/props'
import { bareWord, boolMiss, countMiss, measureMiss, stopped, was, wordsMiss, type Lesson, type Line } from './core'

const ALL: ('bool' | 'int' | 'float' | 'char' | 'str')[] = ['bool', 'int', 'float', 'char', 'str']
const shelf = (n: number, more: Partial<Extract<Prop, { kind: 'shelf' }>> = {}): Prop => ({
  kind: 'shelf',
  filled: ALL.slice(0, n),
  title: true,
  ...more,
})

const LAMP: Prop = { kind: 'lamp' }
const LIFT: Prop = { kind: 'lift', lowest: -2, highest: 3 }
const GLASS: Prop = { kind: 'glass', level: 0.5 }
const CARD: Prop = { kind: 'card' }

function liftMiss(l: Line): string | undefined {
  const t = l.thought
  const n = numberOf(t)
  if (t?.type === 'float' && n !== null) return 'Stuck between floors! A lift stops at whole floors, so no dot.'
  if (t?.type === 'int' && n !== null) {
    if (n === 1) return 'That\'s one floor *up*. Under the ground needs a minus sign: `-1`.'
    if (n === 0) return 'Floor `0` is the ground. The car park is one below it: `-1`.'
    return `The lift went to floor ${n}. The car park is one under the ground: \`-1\`.`
  }
  return countMiss(l, 'floors')
}

function glassMiss(l: Line): string | undefined {
  const t = l.thought
  const n = numberOf(t)
  if (t?.type === 'int' && n === 0) return 'Empty? There\'s water in it!'
  if (t?.type === 'int' && n === 1) return 'Full? The water only comes up to the middle.'
  if (t?.type === 'int') return 'No whole number fits: it\'s between `0` and `1`, so it needs a dot.'
  if (t?.type === 'float' && n !== null && n > 1) return 'More than full? It would spill! It\'s between `0` and `1`.'
  if (t?.type === 'float' && n !== null) return `I filled the other glass to ${t.repr}. Compare them: the water is exactly halfway.`
  if (/half/i.test(textOf(t) ?? '')) return 'That\'s the word. The robot writes half as `0.5`.'
  return measureMiss(l)
}

function letterMiss(l: Line): string | undefined {
  const text = textOf(l.thought)
  if (bareWord(l) === 'M') return 'Without quotes, the robot looks for something called `M`. Quotes make it a character: `"M"`.'
  if (text === 'm') return 'Nearly: Mira\'s name starts with a capital, `"M"`.'
  if (text !== null && text.length > 1) return 'That\'s more than one letter. Just the first one: `"M"`.'
  if (text !== null) return `\`"${text}"\` is one character, but Mira's name starts with \`"M"\`.`
  if (l.thought) return `\`${l.thought.repr}\` is for the robot. Mira reads letters, in quotes: \`"M"\`.`
  return stopped(l, 'A character goes in quotes: `"M"`.')
}

export const types: Lesson = {
  id: 'types',
  teaches: ['bool', 'int', 'float', 'str'],
  ordered: true,
  steps: [
    {
      beats: [
        { say: 'The robot doesn\'t think of everything the same way.', show: shelf(0, { title: false }) },
        { say: 'It sorts things into kinds, and programmers call a kind a **data type**.', show: shelf(0) },
        { say: 'There are five basic ones, so let\'s meet them one at a time.', show: shelf(0, { pulse: true }) },
        { say: 'First, questions with only two answers, like: is the lamp on?', show: LAMP },
        { say: 'The robot says yes as `True`…', show: { kind: 'lamp', demo: 'on' } },
        { say: '…and no as `False`.', show: { kind: 'lamp', demo: 'off' } },
        { say: 'This type is called `bool`: a capital letter, and no quotes.', show: shelf(1) },
      ],
      say: 'Your turn. Turn the lamp on.',
      ask: 'Turn the lamp on.',
      show: LAMP,
      tag: 'you',
      done: (e) => e.thoughts.some(was('bool', 'True')),
      praise: 'The lamp is on, because `True` is the robot\'s yes.',
      nudge: (l) => (l.thought?.repr === 'False' ? 'That\'s no, so the lamp stays dark. Yes is `True`.' : boolMiss(l)),
    },
    {
      beats: [
        { say: 'Next come questions that ask *how many*.', show: { kind: 'basket', apples: 3, demo: 'count' } },
        { say: 'You count in whole steps, with no halves in between.', show: { kind: 'basket', apples: 3, demo: 'half' } },
        { say: 'Counting numbers are called `int`s, short for *integer*.', show: shelf(2, { examples: { int: ['3', '12'] } }) },
        { say: 'They go below zero, too.', show: { ...LIFT, demo: -1 } },
      ],
      say: 'Send the lift down to the car park: `-1`.',
      ask: 'Send the lift to the car park.',
      show: LIFT,
      tag: 'you',
      done: (e) => e.thoughts.some(was('int', '-1')),
      praise: 'Floor `-1`: a whole floor, counted below the ground, so an `int`.',
      nudge: liftMiss,
    },
    {
      beats: [
        { say: 'Some things you can\'t count, so you *measure* them instead.', show: { kind: 'glass', level: 0.5, demo: 'fill' } },
        { say: 'A measurement can land between the whole numbers.', show: { kind: 'numberline', from: 0, to: 1, mark: 0.5, unnamed: true } },
        { say: 'Python writes that with a dot: `0.5`.', show: { kind: 'numberline', from: 0, to: 1, mark: 0.5 } },
        { say: 'Numbers with a dot are called `float`s.', show: shelf(3) },
      ],
      say: 'Tell the robot how full the glass is.',
      ask: 'How full is the glass?',
      show: GLASS,
      tag: 'you',
      done: (e) => e.thoughts.some(was('float', '0.5')),
      praise: 'Half full, and measured, so a `float`.',
      nudge: glassMiss,
    },
    {
      beats: [
        {
          say: 'Here\'s Mira, and she\'s a person, not a robot.',
          show: shelf(3),
          act: [
            { actor: 'courier', do: 'enter' },
            { actor: 'courier', do: 'wave' },
          ],
        },
        { speaker: 'courier', say: 'Hi! I don\'t speak `True` or `12`: I read letters.', show: { kind: 'letters', chars: ['M', 'i', 'r', 'a', '!', '7'] } },
        { say: 'One letter, digit or symbol is a **character**, or a *char* for short.', show: { kind: 'char', char: 'A', clasps: true } },
        {
          say: 'The quotes make it a character: `"7"` is a thing to read, and `7` is a number.',
          show: { kind: 'contrast', left: { text: '7', kind: 'int', label: 'a number' }, right: { text: '"7"', kind: 'char', label: 'a thing to read' } },
        },
        { say: 'Python has no char type of its own: it calls `"A"` a `str`, one letter long.', show: shelf(4), thought: "'A'" },
      ],
      say: 'Write the first letter of Mira\'s name: `"M"`.',
      ask: 'The first letter of Mira\'s name.',
      show: CARD,
      tag: 'you',
      done: (e) => e.thoughts.some(was('str', "'M'")),
      praise: 'One character in quotes: a char, which Python keeps as a `str`.',
      nudge: letterMiss,
    },
    {
      beats: [
        { say: 'Put characters in a row and you get a **string**.', show: { kind: 'beads', text: 'hello' } },
        { say: 'The quotes show where the string starts and where it stops.', show: { kind: 'beads', text: 'hello', glow: true } },
        { say: 'Strings are called `str` too, and they\'re for talking to people.', show: shelf(5) },
      ],
      say: 'Say hello to Mira.',
      ask: 'Say hello to Mira.',
      show: CARD,
      tag: 'you',
      done: (e) => e.thoughts.some((t) => (textOf(t)?.trim() ?? '') !== ''),
      praise: 'Mira can read that, because it\'s words in quotes: a `str`.',
      nudge: (l) => wordsMiss(l, '"hello"'),
    },
  ],
  finale: shelf(5),
  outro: [
    { say: 'Five data types, and everything the robot thinks is built from these.', show: shelf(5, { cheer: true }) },
    { say: 'Bigger things are these, arranged: a list is a row of them, for example.', show: shelf(5, { later: true }) },
  ],
  takeaway: 'There are five basic data types: bool, int, float, char and str. Everything else is built from them.',
}
