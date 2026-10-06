/**
 * v2, Level 2: Basic data types (`v2-types`).
 *
 * The robot's problem (R12): it thinks of things, but a light, a basket of
 * apples, a car and a phone number are different kinds of thing, and it
 * has to hold each the right way. It ends knowing the four basic data
 * types everything else is built from: `bool`, `int`, `float`, `str`.
 *
 * Each type is shown before it is named (R1): the crow points at real
 * things and the robot thinks of them — a lamp on and off, a door open
 * and shut, apples counted up and down, a car speeding up and slowing
 * down, a name, a note and a phone number — with the crow typing the
 * first of each so the player sees how it is written. Then the type gets
 * its name and its slot on the shelf, and the player is asked for one
 * straight away: bool, then int, then float, then str.
 *
 * Then a short quiz mixes them up (`quiz`): eight questions, five picked
 * on the stage (multiple choice: the player answers the crow, not the
 * robot, so the console stays shut) and three typed to the robot. The set
 * is fixed by concept, and only the values and pictures are drawn from a
 * seed, so every visit asks about each of these once:
 *
 * - `3` against `3.0`: the dot makes a float, even `.0`;
 * - `True` against `"True"`: quotes make text of anything;
 * - digits in quotes (`"42"`) are text too;
 * - which type a situation wants — two of the four types by picking, the
 *   other two by typing them for the robot;
 * - the word `True`, typed as text for a sign.
 *
 * The questions take turns between picking and typing, never more than
 * two of a kind in a row, and no concept is asked twice.
 */
import { pageSeed } from '../seed'
import { pick, rng, type Rng } from '../../../src/practice/exercises'
import { textOf, type Prop, type TypeSlot } from '../../../src/scene/props'
import {
  boolFor,
  chose,
  countMiss,
  digits,
  measureMiss,
  was,
  wordsMiss,
  type Choice,
  type Choices,
  type Evidence,
  type Lesson,
  type LessonStep,
  type Line,
} from '../core'

/* --------------------------------- pictures --------------------------------- */

const FOUR: TypeSlot[] = ['bool', 'int', 'float', 'str']
const shelf = (filled: TypeSlot[], more: Partial<Extract<Prop, { kind: 'shelf' }>> = {}): Prop => ({
  kind: 'shelf',
  slots: FOUR,
  filled,
  title: true,
  ...more,
})

const TYPES: Choice[] = [
  { id: 'bool', label: '`bool`' },
  { id: 'int', label: '`int`' },
  { id: 'float', label: '`float`' },
  { id: 'str', label: '`str`' },
]

/* --------------------------------- replies --------------------------------- */

const PHONE = '0412 555 019'

function phoneMiss(l: Line): string | undefined {
  const t = l.thought
  const text = textOf(t)
  if (t?.type === 'int') return `A number can't start with \`0\`, so the robot can't keep it that way. Put the whole thing in quotes: \`"${PHONE}"\`.`
  if (t?.type === 'float' || t?.type === 'tuple') return 'Nobody adds up phone numbers. Keep it as text, in quotes.'
  if (text !== null && digits(text) !== digits(PHONE)) return `Check the digits: ${PHONE}.`
  return wordsMiss(l, `"${PHONE}"`)
}

function speedMiss(speed: number) {
  return (l: Line): string | undefined => {
    const t = l.thought
    if (t?.type === 'int') return `A speed is measured, so it keeps its dot: \`${speed}\`.`
    return measureMiss(l)
  }
}

function textMiss(example: string) {
  return (l: Line): string | undefined => {
    if (l.thought?.type === 'bool') return `That's the robot's yes, a \`bool\`. As words it needs quotes: \`${example}\`.`
    return wordsMiss(l, example)
  }
}

/** Why each type fits, said when a situation question is missed. */
const FITS: Record<string, string> = {
  bool: 'It can only ever be one of two things, yes or no. That\'s a `bool`.',
  int: 'You count these in whole steps, so it\'s an `int`.',
  float: 'It\'s measured, and can land between whole numbers: a `float`.',
  str: 'It\'s for people to read, not to add up: text, a `str`.',
}

/* ------------------------------- the lesson ------------------------------- */

const teach: LessonStep[] = [
  {
    beats: [
      { say: 'The robot thinks of all sorts of things. But not all things are the same kind.', act: [{ actor: 'crow', do: 'hop' }] },
      { say: 'Each kind of thing is called a *data type*.', show: shelf([], { pulse: true }) },
      { say: 'There are four basic ones, and everything the robot does is built on them.', show: shelf([], { pulse: true }) },
      // bool
      { say: 'Some things are only ever one of two ways. This light is on…', show: { kind: 'lamp', demo: 'on' }, types: 'True', thought: 'True' },
      { say: '…or off. On is `True`, and off is `False`.', show: { kind: 'lamp', demo: 'off' }, types: 'False', thought: 'False' },
      { say: 'A door is open, `True`…', show: { kind: 'doorway', demo: 'open' }, types: 'True', thought: 'True' },
      { say: '…or it\'s shut, `False`.', show: { kind: 'doorway', demo: 'closed' }, types: 'False', thought: 'False' },
      { say: '`True` and `False` are called *bools*.', show: shelf(['bool']) },
    ],
    say: 'The lamp is off. Turn it on.',
    show: { kind: 'lamp' },
    ask: 'Turn the lamp on.',
    tag: 'you',
    done: (e) => e.thoughts.some(was('bool', 'True')),
    model: 'True',
    praise: 'The lamp is on, because `True` is the robot\'s yes.',
    nudge: boolFor('True', '`False` is no, so the lamp stays dark. On is `True`.'),
  },
  {
    beats: [
      { say: 'Next, things you count. Here are three apples.', show: { kind: 'basket', apples: 3, demo: 'tally' }, types: '3', thought: '3' },
      { say: 'Add two more, and I tell the robot `5`.', show: { kind: 'basket', apples: 5, demo: 'tally' }, types: '5', thought: '5' },
      { say: 'Take three away: `2`. Always a whole number.', show: { kind: 'basket', apples: 2, demo: 'tally' }, types: '2', thought: '2' },
      { say: 'Whole numbers are called *ints*, short for *integer*.', show: shelf(['bool', 'int']) },
    ],
    say: 'How many apples are in the basket?',
    show: { kind: 'basket', apples: 4 },
    ask: 'How many apples?',
    tag: 'you',
    done: (e) => e.thoughts.some(was('int', '4')),
    model: '4',
    praise: 'Four, counted, so it\'s an `int`.',
    nudge: (l) => countMiss(l, 'apples'),
  },
  {
    beats: [
      { say: 'Some things aren\'t counted, they\'re measured. Like how fast a car goes.', show: { kind: 'car', speed: 12.5, demo: 'drive' }, types: '12.5', thought: '12.5' },
      { say: 'It speeds up: `48.5`.', show: { kind: 'car', speed: 48.5, demo: 'drive' }, types: '48.5', thought: '48.5' },
      { say: 'And slows down: `30.2`. It can land anywhere between the whole numbers.', show: { kind: 'car', speed: 30.2, demo: 'drive' }, types: '30.2', thought: '30.2' },
      { say: 'Numbers with a dot are called *floats*.', show: shelf(['bool', 'int', 'float']) },
    ],
    say: 'The car is going 36.5 km/h. Tell the robot its speed.',
    show: { kind: 'car', speed: 36.5 },
    ask: 'How fast is it going?',
    tag: 'you',
    done: (e) => e.thoughts.some(was('float', '36.5')),
    model: '36.5',
    praise: 'A measurement with a dot, so it\'s a `float`.',
    nudge: speedMiss(36.5),
  },
  {
    beats: [
      { say: 'Last, words, for people to read. They go in quotes.', show: { kind: 'note', text: 'Mira', title: 'name' }, types: '"Mira"', thought: "'Mira'" },
      // The robot's own way of writing words: Lesson 3's cards and answers
      // are all in single quotes, and nothing else says the two agree.
      { say: 'The robot writes words back with single quotes. Either kind works, as long as both ends match.', show: { kind: 'note', text: 'Mira', title: 'name' }, thought: "'Mira'" },
      { say: 'A note is words too.', show: { kind: 'note', text: 'buy more bolts', title: 'note' }, types: '"buy more bolts"', thought: "'buy more bolts'" },
      { say: 'So is a phone number. It can start with `0`, and it has spaces.', show: { kind: 'phone', number: PHONE }, types: `"${PHONE}"`, thought: `'${PHONE}'` },
      { say: 'Nobody adds up phone numbers, so to the robot it\'s words, not a number.', show: { kind: 'phone', number: PHONE }, thought: `'${PHONE}'` },
      { say: 'Words in quotes are called *strs*, short for *string*.', show: shelf(FOUR, { cheer: true }) },
    ],
    say: `Make the robot think of this phone number: ${PHONE}.`,
    show: { kind: 'phone', number: PHONE },
    ask: 'The phone number',
    tag: 'you',
    done: (e) => e.thoughts.some((t) => t.type === 'str' && digits(textOf(t) ?? '') === digits(PHONE)),
    model: `"${PHONE}"`,
    praise: 'In quotes, so the robot keeps it as words, `0` and all.',
    nudge: phoneMiss,
  },
]

/* --------------------------------- the quiz --------------------------------- */

type Kind = 'bool' | 'int' | 'float' | 'str'

/** A situation, drawn, and the type that fits it; `typed` is how to ask
 *  for it when the player types it for the robot instead. */
type Situation = {
  kind: Kind
  show: Prop
  /** "Which type fits …?" */
  about: string
  typed: Omit<LessonStep, 'beats' | 'praise'> & { praise: string }
}

const situations = (r: Rng): Record<Kind, Situation> => {
  // Never the teaching step's own count (4), or the quiz repeats it word
  // for word with the old answer still in the console.
  const apples = pick(r, [3, 5, 6, 7, 8])
  const speed = pick(r, [24.5, 52.5, 61.5, 18.5])
  const name = pick(r, ['Bolt', 'Sprocket', 'Pip'])
  const bool: Situation = pick(r, [
    {
      kind: 'bool' as const,
      show: { kind: 'lamp' } as Prop,
      about: 'whether the lamp is on',
      // The other way round from the teaching step's "turn it on".
      typed: {
        say: 'The lamp is on. Turn it off.',
        show: { kind: 'lamp', demo: 'on' } as Prop,
        ask: 'Turn the lamp off.',
        tag: 'you' as const,
        done: (e: Evidence) => e.thoughts.some(was('bool', 'False')),
        model: 'False',
        praise: 'Off, because `False` is the robot\'s no.',
        nudge: boolFor('False', '`True` is yes, so the lamp stays on. Off is `False`.'),
      },
    },
    {
      kind: 'bool' as const,
      show: { kind: 'doorway', demo: 'open' } as Prop,
      about: 'whether the door is open',
      typed: {
        say: 'Shut the door.',
        show: { kind: 'doorway' } as Prop,
        ask: 'Shut the door.',
        tag: 'you' as const,
        done: (e: Evidence) => e.thoughts.some(was('bool', 'False')),
        model: 'False',
        praise: 'Shut, because `False` is the robot\'s no.',
        nudge: boolFor('False', '`True` is yes, so the door stays open. Shut is `False`.'),
      },
    },
  ])
  return {
    bool,
    int: {
      kind: 'int',
      show: { kind: 'basket', apples },
      about: 'how many apples there are',
      typed: {
        say: 'How many apples are in the basket?',
        show: { kind: 'basket', apples },
        ask: 'How many apples?',
        tag: 'you',
        done: (e) => e.thoughts.some(was('int', String(apples))),
        model: String(apples),
        praise: `${apples}, counted, so an \`int\`.`,
        nudge: (l) => countMiss(l, 'apples'),
      },
    },
    float: {
      kind: 'float',
      show: { kind: 'car', speed, demo: 'drive' },
      about: 'how fast the car is going',
      typed: {
        say: `The car is going ${speed} km/h. Tell the robot its speed.`,
        show: { kind: 'car', speed },
        ask: 'How fast is it going?',
        tag: 'you',
        done: (e) => e.thoughts.some(was('float', String(speed))),
        model: String(speed),
        praise: 'Measured, with a dot: a `float`.',
        nudge: speedMiss(speed),
      },
    },
    str: {
      kind: 'str',
      show: { kind: 'note', text: name, title: 'name' },
      about: 'a name',
      typed: {
        say: `The robot's new friend is called ${name}. Make the robot think of the name.`,
        show: { kind: 'note', text: name, title: 'name' },
        ask: 'Its friend\'s name',
        tag: 'you',
        done: (e) => e.thoughts.some(was('str', `'${name}'`)),
        model: `"${name}"`,
        praise: 'Words in quotes: a `str`.',
        nudge: (l) => wordsMiss(l, `"${name}"`),
      },
    },
  }
}

/** A "what type is this?" question about one literal. */
function literal(id: string, text: string, answer: Kind, why: Partial<Record<Kind, string>>, praise: string): LessonStep {
  const choices: Choices = { id, options: TYPES, answer, nudge: (c) => why[c as Kind] }
  return {
    say: 'What type is this?',
    show: { kind: 'value', text },
    ask: 'What type is it?',
    tag: 'you',
    choices,
    done: (e) => chose(e, choices),
    praise,
  }
}

/**
 * The quiz, from a seed: the same eight concepts every time, in the same
 * alternation of picking and typing, with the values and pictures drawn.
 */
export function quiz(seed: number): LessonStep[] {
  const r = rng(seed)
  // 3 against 3.0.
  const n = pick(r, [3, 7, 12])
  const dotted = r() < 0.5
  const numeric = dotted
    ? literal(
        'q-dot',
        `${n}.0`,
        'float',
        {
          int: 'The dot makes it a `float`, even when it\'s `.0`.',
          bool: 'Only `True` and `False` are bools. This is a number with a dot: a `float`.',
          str: 'No quotes, so it isn\'t words. The dot makes it a `float`.',
        },
        `The dot makes \`${n}.0\` a \`float\`, even with \`.0\`.`,
      )
    : literal(
        'q-dot',
        String(n),
        'int',
        {
          float: 'No dot, so it\'s a whole number: an `int`.',
          bool: 'Only `True` and `False` are bools. This is a whole number: an `int`.',
          str: 'No quotes, so it isn\'t words. A whole number is an `int`.',
        },
        `No dot, so \`${n}\` is an \`int\`.`,
      )
  // True against "True".
  const word = pick(r, ['True', 'False'])
  const quoted = r() < 0.5
  const truth = quoted
    ? literal(
        'q-quote',
        `"${word}"`,
        'str',
        {
          bool: 'The quotes make it words: a `str`, not the robot\'s yes or no.',
          int: 'The quotes make it words: a `str`.',
          float: 'The quotes make it words: a `str`.',
        },
        `The quotes make \`"${word}"\` words: a \`str\`.`,
      )
    : literal(
        'q-quote',
        word,
        'bool',
        {
          str: 'No quotes, so it\'s the robot\'s own yes or no: a `bool`.',
          int: 'No quotes, and it\'s one of the robot\'s two answers, yes or no: a `bool`.',
          float: 'No quotes, and it\'s one of the robot\'s two answers, yes or no: a `bool`.',
        },
        `No quotes: \`${word}\` is a \`bool\`.`,
      )
  // Digits in quotes.
  const inside = pick(r, ['42', '3.5', '0'])
  const digitsIn = literal(
    'q-digits',
    `"${inside}"`,
    'str',
    {
      int: 'The quotes make it words, even with digits inside: a `str`.',
      float: 'The quotes make it words, even with digits inside: a `str`.',
      bool: 'The quotes make it words, even a `0`: a `str`.',
    },
    `Quotes, so \`"${inside}"\` is words: a \`str\`.`,
  )

  // Two situations by picking, the other two by typing.
  const all = situations(r)
  const kinds: Kind[] = ['bool', 'int', 'float', 'str']
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!]
  }
  const [pickA, pickB, typeA, typeB] = kinds.map((k) => all[k])
  const which = (id: string, s: Situation): LessonStep => {
    const choices: Choices = { id, options: TYPES, answer: s.kind, nudge: () => FITS[s.kind] }
    return {
      say: `Which type fits ${s.about}?`,
      show: s.show,
      ask: `Which type fits ${s.about}?`,
      tag: 'you',
      choices,
      done: (e) => chose(e, choices),
      praise: FITS[s.kind]!.replace(/^It/, 'Right: it'),
    }
  }
  const typed = (s: Situation): LessonStep => ({ ...s.typed })
  const sign: LessonStep = {
    say: 'The sign says True, in words. Make the robot think of it as words too.',
    show: { kind: 'note', text: 'True', title: 'sign' },
    ask: 'The word True, as words',
    tag: 'you',
    done: (e) => e.thoughts.some(was('str', "'True'")),
    model: '"True"',
    praise: 'In quotes, `"True"` is just a word, not the robot\'s yes.',
    nudge: textMiss('"True"'),
  }

  const steps = [numeric, typed(typeA!), which('q-sit-a', pickA!), truth, sign, which('q-sit-b', pickB!), typed(typeB!), digitsIn]
  steps[0] = { ...steps[0]!, beats: [{ say: 'Now let\'s mix them up. Some you pick, some you tell the robot.' }] }
  return steps
}

export const typesLesson = (seed: number): Lesson => ({
  id: 'v2-types',
  teaches: ['bool', 'int', 'float', 'str', 'kind'],
  pictureAtAsk: true,
  ordered: true,
  steps: [...teach, ...quiz(seed)],
  outro: [
    { say: 'Four types, and you can tell them apart.', show: shelf(FOUR, { cheer: true }) },
    { say: 'Everything the robot does from here is built out of these.', show: shelf(FOUR) },
  ],
  finale: shelf(FOUR),
  takeaway: 'Yes-or-no is a `bool`, a whole number is an `int`, a number with a dot is a `float`, and words in quotes are a `str`.',
})

export const v2types = typesLesson(pageSeed())
