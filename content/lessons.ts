/**
 * Guided lessons.
 *
 * A lesson is a list of things to notice, each with a test that reads the
 * robot's memory. Which step the player is on is **derived**, never
 * stored: it is the first step whose test the snapshot does not yet
 * satisfy. Nothing here advances anything, and nothing here can be out of
 * step with what the robot actually has.
 *
 * That has a pleasant consequence for the console. Because replay keeps
 * every accepted line, a step that has been satisfied stays satisfied —
 * so progress only ever moves forward, without a single line of
 * bookkeeping. And because it is derived, scrubbing back through a trace
 * walks the guide backwards too.
 *
 * The rule for writing a step: its test must be answerable from the
 * evidence below, and must stay true once it is true. A step that means
 * "read this and nod" cannot be checked, would need state to remember the
 * nod, and is a paragraph rather than a task.
 *
 * Three things the first two lessons add, all still derived:
 *
 * - **Ordered** lessons count a thought only for the step that was asking
 *   when it was thought. Without that, `"crow"` typed first answered the
 *   text step early and the player never heard the line that names
 *   floats. See `progress`.
 * - A step can **reply to a miss** (`nudge`): the last line, read the way
 *   a teacher reads a wrong answer — `2.0` legs, `yes` without quotes, a
 *   phone number that lost its leading zero. It is said instead of the
 *   step, until the next line.
 * - A step can **show** something (`show`): a picture on the stage that
 *   the answer is drawn into. See `src/scene/props.ts` and `staging`.
 */
import type { Thought } from '../src/memory/extract'
import type { MemorySnapshot } from '../src/memory/model'
import { NO_STAGING, boolOf, numberOf, sameProp, textOf, type Prop, type Staging } from '../src/scene/props'

/** A thought, and the line that produced it — so a step can ask the
 *  robot to work something out rather than accept the player's own sum. */
export type Heard = Thought & { source?: string | undefined }

/** The last line the player typed, whether or not it worked. */
export type Line = {
  source: string
  ok: boolean
  /** As the console said it: begins with the error's type name. */
  error: string | null
  /** What the robot thought, for a bare expression that made something. */
  thought: Thought | null
}

/**
 * What a step is allowed to look at.
 *
 * `snapshot` is memory now. `thoughts` is every value the robot has
 * worked out over the whole session, which is what lets a step ask the
 * player to *retrieve* something rather than only to store it — answering
 * a question leaves no trace in memory, so there would otherwise be
 * nothing to check.
 *
 * All of these grow and none is rewritten, so a step that is satisfied
 * stays satisfied and progress still only moves forward. (Scrubbing the
 * trace rewinds `snapshot` but not `thoughts`: what was said was said.)
 */
export type Evidence = {
  snapshot: MemorySnapshot
  /**
   * Everything the robot has worked out, in order.
   *
   * Not memory. A bare expression's value is gone the moment the line
   * ends — the robot thought of it and let it go — so the early lessons,
   * which never bind anything, can only be judged on what it thought.
   */
  thoughts: Heard[]
  /**
   * Memory as it stood after each accepted line, oldest first, ending
   * with the current one.
   *
   * Needed because memory is not itself monotonic: `x = 99` makes "`x`
   * points at 10" false again, and a lesson whose whole point is to
   * rebind `x` would slide backwards to step one at the moment the player
   * finished it. Asking whether something was *ever* true fixes that
   * without storing any progress.
   */
  history: MemorySnapshot[]
  /** The line just typed. Only a reply reads it; progress never does. */
  last?: Line | null | undefined
}

/** True if this held after any accepted line. */
const ever = (e: Evidence, holds: (s: MemorySnapshot) => boolean): boolean => e.history.some(holds)

/** The robot has worked this exact answer out. */
const worked = (e: Evidence, repr: string): boolean => e.thoughts.some((t) => t.repr === repr)

/** The robot has thought of something this passes. */
const heard = (e: Evidence, holds: (t: Heard) => boolean): boolean => e.thoughts.some(holds)

/** The robot thought of exactly this, of exactly this type. */
const was = (type: string, repr: string) => (t: Heard) => t.type === type && t.repr === repr

export type LessonStep = {
  /** What the guide says while this step is the current one. */
  say: string
  /** Who says it — an actor id in the scene. The crow, when omitted. */
  speaker?: string
  /** True once the evidence shows the step was done. */
  done: (evidence: Evidence) => boolean
  /** The picture this step's question is about. */
  show?: Prop
  /** The question in a few words, kept under the picture. */
  ask?: string
  /**
   * What to say to a line that did not do this step, or undefined to
   * repeat the step. Only ever asked about a line that did not advance
   * the lesson, so it never has to tell a right answer from a wrong one.
   */
  nudge?: (line: Line) => string | undefined
}

export type Lesson = {
  id: string
  /** The skills (`content/skills`) finishing this lesson introduces, and
   *  so makes available to practise. */
  teaches: string[]
  steps: LessonStep[]
  /** Said once every step is done. */
  outro: string
  /** Who says the outro. The crow, when omitted. */
  outroSpeaker?: string
  /** Count a thought only for the step that was asking — see `progress`. */
  ordered?: boolean
  /** On the stage once every step is done. */
  finale?: Prop
}

/* ----------------------------- predicates ----------------------------- */

/** What this name points at, or null if it points at nothing yet. */
const targetOf = (snapshot: MemorySnapshot, name: string): string | null =>
  snapshot.bindings.find((b) => b.name === name)?.target ?? null

/** This name points at an object with this `repr`. */
const points = (snapshot: MemorySnapshot, name: string, repr: string): boolean => {
  const id = targetOf(snapshot, name)
  return id !== null && snapshot.objects[id]?.repr === repr
}

/** Two names on the same object — the thing the binding lesson is for. */
const sameObject = (snapshot: MemorySnapshot, a: string, b: string): boolean => {
  const left = targetOf(snapshot, a)
  return left !== null && left === targetOf(snapshot, b)
}

/* ------------------------------- replies ------------------------------- */

/** The error's type name, from the console's line about it. */
const errorType = (line: Line): string | null =>
  line.ok ? null : (line.error?.match(/^[A-Za-z]+/)?.[0] ?? 'Error')

const article = (w: string) => (/^[AEIOU]/.test(w) ? 'an' : 'a')

/** The last resort: say what stopped it, plainly. */
const stopped = (line: Line, then: string): string | undefined => {
  const kind = errorType(line)
  return kind ? `That stopped the robot with ${article(kind)} \`${kind}\`. ${then}` : undefined
}

/** A plain word typed without quotes, which Python reads as a name. */
const bareWord = (line: Line): string | null =>
  errorType(line) === 'NameError' && /^[A-Za-z]+$/.test(line.source.trim()) ? line.source.trim() : null

/** A comma where the dot goes — `1,5` is a pair of ints to Python. */
const commaDecimal = (line: Line): boolean => line.thought?.type === 'tuple' && /^\s*-?\d+\s*,\s*\d+\s*$/.test(line.source)

/** The usual misses on a yes-or-no question. */
function boolMiss(line: Line): string | undefined {
  const s = line.source.trim()
  if (s === 'true' || s === 'false') return `Nearly — it needs a capital letter: \`${s[0]!.toUpperCase()}${s.slice(1)}\`.`
  const word = bareWord(line)
  if (word) return `The robot doesn't know the word \`${word}\`. Its own yes is \`True\`, and its no is \`False\`.`
  const t = line.thought
  if (t?.type === 'str') return 'Quotes make that a word, for people. The robot\'s own answer has no quotes: `True` or `False`.'
  if (t?.type === 'int' || t?.type === 'float') return 'That\'s a number. A yes-or-no question has only two answers: `True` or `False`.'
  return stopped(line, 'Just `True` or `False`.')
}

/** The usual misses on a how-many question. */
function countMiss(line: Line, things: string): string | undefined {
  const t = line.thought
  const n = numberOf(t)
  if (t?.type === 'float' && n !== null && Number.isInteger(n)) {
    return `${t.repr} ${things}? The dot means *measured*. ${cap(things)} are counted — no dot.`
  }
  if (t?.type === 'float') return `A piece of one? These ${things} are whole — count them.`
  if (t?.type === 'bool') return `\`${t.repr}\` answers yes or no. This asks *how many*.`
  if (t?.type === 'str') return 'That\'s a word, for people. The robot counts with digits and no quotes.'
  if (bareWord(line)) return 'The robot counts with digits, like `3` — it doesn\'t know number words.'
  return stopped(line, 'A whole number, with digits.')
}

/** The usual misses on a how-much question. */
function measureMiss(line: Line): string | undefined {
  const t = line.thought
  if (commaDecimal(line)) return 'Python writes the dot as a full stop, not a comma: `1.5`, not `1,5`.'
  if (t?.type === 'str') return 'That\'s a word. A measurement is a number with a dot in it.'
  if (t?.type === 'bool') return `\`${t.repr}\` answers yes or no. This asks *how much*.`
  if (bareWord(line)) return 'The robot measures with digits and a dot, like `0.5`.'
  return stopped(line, 'A number with a dot.')
}

/** The usual misses when words are wanted. */
function wordsMiss(line: Line, example: string): string | undefined {
  const t = line.thought
  if (textOf(t)?.trim() === '') return 'Those quotes are empty — put some words inside them!'
  if (bareWord(line)) return `Without quotes, the robot thinks \`${line.source.trim()}\` is a name it should already know. Words go inside quotes: \`${example}\`.`
  if (errorType(line) === 'SyntaxError') return `Put the whole thing inside one pair of quotes: \`${example}\`.`
  if (t && t.type !== 'str') return `\`${t.repr}\` is for the robot. People want words — in quotes.`
  return stopped(line, `Words go inside quotes: \`${example}\`.`)
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

/** The digits of a text, so `"0412 555 019"` and `"0412555019"` agree. */
const digits = (s: string) => s.replace(/\D/g, '')

/* ------------------------------ lesson one ------------------------------ */

/**
 * Yes, how many, how much: `bool`, `int`, `float`.
 *
 * Every value answers a question, and the question decides its kind:
 * *is it?* has two answers, *how many?* is counted in whole steps, *how
 * much?* is measured and fills the gaps between them. So each step asks
 * about a situation rather than for a type, and the type is named only
 * after the player has made one.
 *
 * The kinds are built in the order they contain each other. A `bool` is
 * one switch; an `int` has room for every count, below zero too; a
 * `float` has room for the in-betweens. The last two steps show Python
 * agrees: `True + True` is `2`, because a bool *is* an int, and mixing an
 * int with a float climbs to a float. (An int is not a float subclass —
 * the containment is in the values, and very large ints stop fitting in a
 * float exactly. Neither matters to someone learning to count.)
 *
 * The middle of the lesson is where the learning is checked: three
 * questions with no hint about which kind, so choosing is the task.
 * Boundary cases are the teaching throughout — `2.0` apples, a lift
 * stuck at `1.5`, a height of exactly `1` metre — and each has its own
 * reply, and each is visible in the picture.
 *
 * Ordered, so a thought only counts for the question that was asked.
 */
export const threeKinds: Lesson = {
  id: 'kinds',
  teaches: ['bool', 'int', 'float', 'kind'],
  ordered: true,
  finale: { kind: 'kinds' },
  steps: [
    {
      say: 'A robot\'s mind is made of switches: on or off. On is `True`, off is `False`. Watch the lamp, then turn it on: `True`.',
      ask: 'Turn the lamp on.',
      show: { kind: 'lamp' },
      done: (e) => heard(e, was('bool', 'True')),
      nudge: (l) => (l.thought?.repr === 'False' ? 'That\'s off, so the lamp stays dark. On is `True`.' : boolMiss(l)),
    },
    {
      say: 'On! `True` and `False` are called `bool`s: two answers, like a switch. They answer any yes-or-no question. Is a fish a bird?',
      ask: 'Is a fish a bird?',
      show: { kind: 'fish' },
      done: (e) => heard(e, was('bool', 'False')),
      nudge: (l) => (l.thought?.repr === 'True' ? 'A bird? Then where are its feathers? Look again.' : boolMiss(l)),
    },
    {
      say: '`False`. But some questions have more than two answers. How many apples are in the basket?',
      ask: 'How many apples?',
      show: { kind: 'basket', apples: 3 },
      done: (e) => heard(e, was('int', '3')),
      nudge: (l) =>
        l.thought?.type === 'int'
          ? `I drew your ${l.thought.repr} above the basket. Count the apples again.`
          : countMiss(l, 'apples'),
    },
    {
      say: 'Three. Counting numbers are called `int`s: whole steps, forever, and below zero too. The car park is one floor under the ground. Which floor?',
      ask: 'Which floor is one under the ground?',
      show: { kind: 'lift', lowest: -2, highest: 3 },
      done: (e) => heard(e, was('int', '-1')),
      nudge: (l) => {
        const t = l.thought
        const n = numberOf(t)
        if (t?.type === 'float' && n !== null) return 'Stuck between floors! A lift stops at whole floors — an `int`, with no dot.'
        if (t?.type === 'int' && n !== null) {
          if (n === 1) return 'That\'s one floor *up*. Under the ground needs a minus sign: `-1`.'
          if (n === 0) return 'Floor `0` is the ground. One floor below it?'
          if (n < -2 || n > 3) return `There's no floor ${n} in this building! The car park is one under the ground.`
          return `The lift went to floor ${n}. The car park is one floor under the ground.`
        }
        return countMiss(l, 'floors')
      },
    },
    {
      say: 'Floor `-1`. Empty is `0` and full is `1`, but you can\'t count how full this glass is. You have to measure it. How full?',
      ask: 'How full is the glass?',
      show: { kind: 'glass', level: 0.5 },
      done: (e) => heard(e, was('float', '0.5')),
      nudge: (l) => {
        const t = l.thought
        const n = numberOf(t)
        if (t?.type === 'int' && n === 0) return 'Empty? There\'s water in it!'
        if (t?.type === 'int' && n === 1) return 'Full? The water only comes up to the middle.'
        if (t?.type === 'int') return 'No whole number fits — it\'s somewhere between `0` and `1`. Try a number with a dot.'
        if (t?.type === 'float' && n !== null && n > 1) return 'More than full? It would spill! Somewhere between `0` and `1`.'
        if (t?.type === 'float' && n !== null) return `I filled the other glass to ${t.repr}. Compare them — the water is exactly halfway.`
        if (/half/i.test(textOf(t) ?? '')) return 'That\'s the word. The robot writes half as `0.5`.'
        return measureMiss(l)
      },
    },
    {
      say: '`0.5`. Numbers with a dot are called `float`s: they measure the in-betweens that counting skips. How tall are you, in metres? (About `1.4`?)',
      ask: 'How tall are you, in metres?',
      show: { kind: 'height' },
      done: (e) => heard(e, (t) => t.type === 'float' && Number(t.repr) >= 0.5 && Number(t.repr) <= 2.5),
      nudge: (l) => {
        const t = l.thought
        const n = numberOf(t)
        if (n !== null && n >= 50 && n <= 250) return `That sounds like centimetres. In metres it has a dot: ${n} centimetres is \`${n / 100}\`.`
        if (t?.type === 'int' && (n === 1 || n === 2)) return `Hardly anyone is exactly ${n} metre${n === 1 ? '' : 's'} tall. Measure closer — use a dot, like \`1.4\`.`
        if (t?.type === 'int') return 'People aren\'t a whole number of metres tall. Use a dot — like `1.4`.'
        if (t?.type === 'float' && n !== null && n > 2.5) return `${t.repr} metres? You'd bump your head on the door! Most people are between 1 and 2.`
        if (t?.type === 'float' && n !== null) return `${t.repr} metres? That's shorter than a cat! Most people are between 1 and 2.`
        return measureMiss(l)
      },
    },
    {
      say: 'Measured! Now you choose the kind — no hints. How many eggs are in a dozen?',
      ask: 'How many eggs in a dozen?',
      show: { kind: 'carton', slots: 12 },
      done: (e) => heard(e, was('int', '12')),
      nudge: (l) =>
        l.thought?.type === 'int'
          ? `That's ${l.thought.repr}. A dozen fills every hollow in the box — count them.`
          : countMiss(l, 'eggs'),
    },
    {
      say: 'Twelve: counted, so an `int`. Did you have breakfast today?',
      ask: 'Did you have breakfast today?',
      show: { kind: 'plate' },
      done: (e) => heard(e, (t) => t.type === 'bool'),
      nudge: boolMiss,
    },
    {
      say: 'A yes-or-no, so a `bool`. A football match is two halves of 45 minutes. How long is that, in hours?',
      ask: 'How many hours is 90 minutes?',
      show: { kind: 'match' },
      done: (e) => heard(e, was('float', '1.5')),
      nudge: (l) => {
        const t = l.thought
        const n = numberOf(t)
        if (n === 90) return 'That\'s the minutes. How many *hours*? One hour is 60 minutes.'
        if (t?.type === 'int' && n === 1) return 'One hour is only 60 minutes. The match goes on for another half hour.'
        if (t?.type === 'int' && n === 2) return 'Two hours is 120 minutes — too long. It ends halfway between one hour and two.'
        if (t?.type === 'float' && n === 1.3) return '`1.3` isn\'t an hour and 30 minutes: a dot is not a clock. Half an hour is `0.5` of an hour.'
        if (t?.type === 'float' && n !== null && n > 1 && n < 2) return 'Close! It\'s exactly halfway between one hour and two.'
        if (t?.type === 'int') return 'No whole number of hours fits. Measure it: a number with a dot.'
        if (t?.type === 'float') return 'Two halves of 45 minutes is 90 minutes. How many hours is that?'
        return measureMiss(l)
      },
    },
    {
      say: 'One and a half: a `float`. Now a secret about the three kinds. Type `True + True`.',
      ask: 'What is True + True?',
      show: { kind: 'kinds' },
      done: (e) => heard(e, (t) => was('int', '2')(t) && /True/.test(t.source ?? '')),
      nudge: (l) => {
        if (l.thought?.repr === '2') return 'That\'s `2` — but you did the sum, not the robot. Type `True + True`.'
        if (/\btrue\b/.test(l.source)) return 'Capital letters: `True + True`.'
        return 'Type it exactly: `True + True`.'
      },
    },
    {
      say: '`2`! Inside, `True` is 1 and `False` is 0: every `bool` is secretly an `int`. Now mix a count and a measurement: `2 + 0.5`.',
      ask: 'What is 2 + 0.5?',
      show: { kind: 'kinds' },
      done: (e) => heard(e, (t) => was('float', '2.5')(t) && /\+/.test(t.source ?? '')),
      nudge: (l) =>
        l.thought?.repr === '2.5' ? 'Let the robot do the adding: type `2 + 0.5`.' : 'Type it exactly: `2 + 0.5`.',
    },
  ],
  outro:
    '`2.5`, a `float`. Each kind fits inside the next: yes-or-no, how many, how much. Everything you said, sorted — and gone. None of it had a name.',
}

/* ------------------------------ lesson two ------------------------------ */

/**
 * Talking to humans: `str`.
 *
 * The robot thinks in `True`, `12` and `0.5`; people think in words, and
 * a `str` is how the two meet. Mira is here so that the words have
 * somebody to be for — a str is introduced as what you say *to a person*,
 * not as another kind of value.
 *
 * Then the distinctions, each by contrast, which is where they stick:
 * `7 + 7` adds and `"7" + "7"` sticks characters together; a phone number
 * looks like a number but is never added up, and Python itself refuses
 * `0412` as a number (and as an int it would lose its zero); the word
 * `"True"` sits on the lamp as a note while the robot's own `True`
 * lights it. It ends under the words: every character is a number, which
 * is where "computers like bits, people like words" comes from.
 */
export const talkingToHumans: Lesson = {
  id: 'talking',
  teaches: ['str', 'kind'],
  ordered: true,
  finale: { kind: 'letter', char: 'A' },
  steps: [
    {
      say: 'This is Mira. People think in words, not `True` or `12`. Say hello to her — words go inside quotes: `"hello"`.',
      ask: 'Say hello to Mira.',
      show: { kind: 'card' },
      done: (e) => heard(e, (t) => (textOf(t)?.trim() ?? '') !== ''),
      nudge: (l) => wordsMiss(l, '"hello"'),
    },
    {
      speaker: 'courier',
      say: 'Hello! Can your robot do a sum for me? What\'s `7 + 7`?',
      ask: 'What is 7 + 7?',
      show: { kind: 'tiles' },
      done: (e) => heard(e, (t) => was('int', '14')(t) && /7/.test(t.source ?? '')),
      nudge: (l) => {
        if (textOf(l.thought) === '77') return 'That stuck them together. Leave the quotes off, and they add.'
        if (l.thought?.repr === '14') return 'That\'s right — but let the robot work it out: `7 + 7`.'
        return 'Type the sum: `7 + 7`.'
      },
    },
    {
      say: 'Fourteen: numbers add up. Now put each 7 in quotes: `"7" + "7"`.',
      ask: 'What is "7" + "7"?',
      show: { kind: 'tiles' },
      done: (e) => heard(e, (t) => textOf(t) === '77'),
      nudge: (l) => {
        if (l.thought?.repr === '14') return 'That added them. Put quotes round each 7: `"7" + "7"`.'
        if (errorType(l) === 'TypeError') return 'Both 7s need quotes. A word and a number can\'t be added.'
        return 'Type it with the quotes: `"7" + "7"`.'
      },
    },
    {
      say: '`"77"`! In quotes, 7 is a character, and `+` sticks characters together. Mira\'s number is 0412 555 019. Number, or words? Type it.',
      ask: 'Type Mira\'s number: 0412 555 019',
      show: { kind: 'phone', number: '0412555019' },
      done: (e) => heard(e, (t) => digits(textOf(t) ?? '') === '0412555019'),
      nudge: (l) => {
        const t = l.thought
        if (t?.type === 'int' && t.repr === '412555019') return 'Look: the 0 at the front vanished! A number drops it; text keeps every character. Put it in quotes.'
        if (t?.type === 'int' || t?.type === 'float') return 'As a number, the robot could add it up — but nobody adds phone numbers. Put it in quotes.'
        if (errorType(l) === 'SyntaxError') return 'Python won\'t even accept a number that starts with 0 — a clue that a phone number isn\'t an amount. Put it in quotes.'
        if (t?.type === 'str') return 'Check every digit: 0412 555 019.'
        return wordsMiss(l, '"0412 555 019"')
      },
    },
    {
      say: 'Ringing! Nobody adds up phone numbers, so they\'re text. Now the lamp again: type the *word* `"True"`, in quotes.',
      ask: 'Type the word "True".',
      show: { kind: 'lamp' },
      done: (e) => heard(e, (t) => textOf(t) === 'True'),
      nudge: (l) =>
        boolOf(l.thought) === true
          ? 'That\'s the robot\'s own `True` — look, the lamp lit! This time the word: in quotes.'
          : 'Type `"True"`, quotes and all.',
    },
    {
      say: 'No light: `"True"` is a word on a note, not a switch. Now the robot\'s own `True`, no quotes.',
      ask: 'Now True, with no quotes.',
      show: { kind: 'lamp' },
      done: (e) => heard(e, was('bool', 'True')),
      nudge: (l) => (textOf(l.thought) !== null ? 'Still in quotes, so still a word. Leave the quotes off.' : boolMiss(l)),
    },
    {
      speaker: 'courier',
      say: 'Lovely! Is the front door locked? Tell me in words, please — I don\'t speak robot!',
      ask: 'Is the door locked? Tell Mira in words.',
      show: { kind: 'door' },
      done: (e) => heard(e, (t) => /lock|yes/i.test(textOf(t) ?? '')),
      nudge: (l) => {
        if (l.thought?.type === 'bool') return 'That\'s robot for yes. Mira needs words: a sentence, in quotes.'
        if (textOf(l.thought) !== null && textOf(l.thought)!.trim() !== '') return 'Tell Mira about the door. Is it locked?'
        return wordsMiss(l, '"Yes, it is locked"')
      },
    },
    {
      say: 'Mira understood! Last secret: every letter is secretly a number. Ask the robot `ord("A")`.',
      ask: 'What number is "A"?',
      show: { kind: 'letter', char: 'A' },
      done: (e) => heard(e, (t) => was('int', '65')(t) && /ord/.test(t.source ?? '')),
      nudge: (l) => {
        if (errorType(l) === 'NameError' && /ord\s*\(\s*A\s*\)/.test(l.source)) return 'The A needs quotes: `ord("A")`.'
        if (l.thought?.type === 'int' && /ord/.test(l.source)) return 'That\'s the number for a different character — every character has one! Now a capital A: `ord("A")`.'
        if (l.thought?.repr === '65') return 'Right number! Let the robot look it up: `ord("A")`.'
        return 'Type it exactly: `ord("A")`.'
      },
    },
  ],
  outro:
    '`65`. Inside the robot, every letter is a number. A `str` is where two worlds meet: computers like bits, humans like words.',
}

/* ----------------------------- lesson three ----------------------------- */

/**
 * Working things out.
 *
 * Operations on each of the kinds from lesson one, and one point at the
 * end: the answer went nowhere. Nobody but the robot ever knew it, it was
 * never in memory, and asking again means working it out again. That is
 * the itch the *next* lesson scratches, which is why this lesson has to
 * come before names rather than after them.
 *
 * The answers are checked exactly, because "work out this specific thing"
 * is the task. They are also chosen not to collide: no two are the same
 * repr, so satisfying one step cannot satisfy another by accident.
 */
export const operations: Lesson = {
  id: 'operations',
  teaches: ['arith', 'divide', 'join', 'compare', 'order'],
  steps: [
    {
      say: 'It can work things out, too. Seven crates, six bolts in each — how many bolts? `7 * 6`',
      done: (e) => worked(e, '42'),
    },
    {
      say: 'Now share 9 litres of oil between 2 robots: `9 / 2`. Watch what kind comes back.',
      done: (e) => worked(e, '4.5'),
    },
    {
      say: 'Sharing out gives a measurement, so `/` always makes a `float`. Words add up too: `"bot" + "gineer"`',
      done: (e) => worked(e, "'botgineer'"),
    },
    {
      say: '`+` glues text together. Now a yes-or-no question — is 3 more than 5? `3 > 5`',
      done: (e) => worked(e, 'False'),
    },
    {
      say: 'It answered with a `bool`. Last one, in two steps: `(2 + 3) * 4`. Brackets go first.',
      done: (e) => worked(e, '20'),
    },
  ],
  outro:
    'Twenty. And it\'s gone already — nobody else ever knew it. Ask again and it starts from scratch.',
}

/* ------------------------------- progress ------------------------------- */

/**
 * Which step the player is on.
 *
 * Returns `steps.length` when every step is done, which is the caller's
 * cue to say the outro.
 *
 * An **ordered** lesson walks the thoughts in the order they were
 * thought: each step is asked only about what was thought after the step
 * before it was done. Still derived, still monotonic — more thoughts can
 * only move it on — but an answer typed before its question was asked
 * does not count for it, and one line never does two steps.
 */
export function progress(lesson: Lesson, evidence: Evidence): number {
  if (!lesson.ordered) {
    const at = lesson.steps.findIndex((step) => !step.done(evidence))
    return at === -1 ? lesson.steps.length : at
  }
  const all = evidence.thoughts
  let from = 0
  for (let i = 0; i < lesson.steps.length; i++) {
    const step = lesson.steps[i]!
    let end = from + 1
    while (end <= all.length && !step.done({ ...evidence, thoughts: all.slice(from, end) })) end++
    if (end > all.length) return i
    from = end
  }
  return lesson.steps.length
}

/** Where the lesson was before the last line, and where it is now. The
 *  last line did something exactly when they differ. */
function moved(lesson: Lesson, evidence: Evidence): { before: number; at: number } {
  const at = progress(lesson, evidence)
  const last = evidence.last
  // Only a line that made a thought can have moved an ordered lesson, and
  // that thought is the newest one.
  if (!last?.ok || !last.thought || evidence.thoughts.length === 0) return { before: at, at }
  const before = progress(lesson, { ...evidence, thoughts: evidence.thoughts.slice(0, -1) })
  return { before, at }
}

export type Utterance = { text: string; speaker?: string | undefined }

/** What the guide should be saying right now, and who says it. */
export function guidance(lesson: Lesson, evidence: Evidence): Utterance {
  const { before, at } = moved(lesson, evidence)
  if (at === lesson.steps.length) return { text: lesson.outro, speaker: lesson.outroSpeaker }
  const step = lesson.steps[at]!
  // A miss gets an answer rather than the question again. Only a line that
  // did not move the lesson is a miss, so a right answer is never
  // mistaken for a wrong one to the question after it.
  if (evidence.last && before === at && step.nudge) {
    const reply = step.nudge(evidence.last)
    if (reply) return { text: reply, speaker: step.speaker }
  }
  return { text: step.say, speaker: step.speaker }
}

/**
 * What the stage shows: this step's picture, with the last answer drawn
 * into it if it was a miss, and the previous step's picture on its way
 * out with the answer that did it.
 */
export function staging(lesson: Lesson, evidence: Evidence): Staging {
  const { before, at } = moved(lesson, evidence)
  const n = lesson.steps.length
  const last = evidence.last ?? null
  const answer = last?.ok ? last.thought : null
  const heardSoFar: Thought[] = evidence.thoughts.map(({ type, repr }) => ({ type, repr }))
  const step = lesson.steps[at]
  const prop = at < n ? step?.show : lesson.finale
  let current: Staging['current'] = prop
    ? { key: `${lesson.id}:${at}`, prop, ask: step?.ask, answer: null, verdict: null, heard: heardSoFar }
    : null
  let leaving: Staging['leaving'] = null

  if (before < at) {
    const done = lesson.steps[before]!
    if (done.show && current && sameProp(done.show, current.prop)) {
      // Same picture: it stays, and shows the answer that moved it on.
      current = { ...current, answer, verdict: 'right' }
    } else if (done.show) {
      leaving = { key: `${lesson.id}:${before}`, prop: done.show, ask: done.ask, answer, verdict: 'right', heard: heardSoFar }
    }
  } else if (current && at < n && last) {
    current = { ...current, answer, verdict: 'miss' }
  }
  return current || leaving ? { current, leaving } : NO_STAGING
}

/* ------------------------------ lesson four ------------------------------ */

/**
 * Keeping one, and what a name actually is.
 *
 * This follows the operations lesson deliberately: that one ends with an
 * answer nobody kept and the observation that getting it back means
 * working it out again. A name is the fix for that, so the player meets
 * binding as the answer to a problem they have just had rather than as a
 * new piece of syntax.
 *
 * The second half prevents the misconception that `x = 10` puts a 10
 * *inside* `x`. If that were true, `y = x` would copy it and rebinding
 * `x` would leave `y` alone by luck rather than by rule — so the lesson
 * ends by moving `x` and looking at `y`.
 *
 * Every object here is a small int, which CPython interns, so two
 * separately typed `10`s really are one object and the memory view says
 * so. That is why the aliasing step is `y = x` and never `y = 10`: the
 * second looks identical on screen while teaching something untrue of
 * objects in general.
 */
export const namesPoint: Lesson = {
  id: 'names-point',
  teaches: ['bind', 'alias', 'rebind'],
  steps: [
    {
      say: 'Tired of it forgetting? Give a thing a name and the robot keeps it: `x = 10`',
      // `ever`, not `snapshot`: the last step of this lesson moves `x`,
      // which would otherwise un-answer the first two.
      done: (e) => ever(e, (s) => points(s, 'x', '10')),
    },
    {
      say: 'There — `x` in memory, pointing at `10`. Now ask for it back: just `x`.',
      done: (e) => worked(e, '10'),
    },
    {
      say: 'No working out — it just looked. Now point a second name at the same thing: `y = x`',
      done: (e) => ever(e, (s) => sameObject(s, 'x', 'y')),
    },
    {
      say: 'Two names, one `10`. Now point `x` somewhere else with `x = 99`, and keep an eye on `y`.',
      done: ({ snapshot }) => points(snapshot, 'x', '99') && points(snapshot, 'y', '10'),
    },
  ],
  outro:
    '`x` moved; `y` stayed put. A name points at a thing — it never held it.',
}

/* ------------------------------ lesson five ------------------------------ */

/**
 * The first lesson where the robot is useful.
 *
 * Someone walks up, tells the robot two things, and comes back with a
 * question. Storing is no longer an exercise — it is the only reason the
 * robot can answer at all.
 *
 * The final question is deliberately not "what did I tell you?". Echoing
 * back a remembered `7` proves nothing; a player could type the digit from
 * their own memory of the conversation. It asks for the *weight*, which is
 * `parcels * 2` and was never said aloud, so the only way to produce 14 is
 * to use what the robot stored. That is also the more honest lesson: the
 * robot did not remember the answer, it remembered the facts.
 *
 * The names are prescribed here, unlike the earlier lessons, because the
 * scene watches them: the ticket shows whatever `customer` points at, so
 * the player sees storage do something in the world.
 */
export const takeAnOrder: Lesson = {
  id: 'take-an-order',
  teaches: ['bind', 'recall'],
  steps: [
    {
      speaker: 'courier',
      say: 'Afternoon! I\'m Ana, with a delivery. Put me on the ticket, would you? `customer = "Ana"`',
      done: ({ snapshot }) => points(snapshot, 'customer', "'Ana'"),
    },
    {
      speaker: 'courier',
      say: 'Lovely. I\'ve brought seven parcels today — keep hold of that. `parcels = 7`',
      done: ({ snapshot }) => points(snapshot, 'parcels', '7'),
    },
    {
      speaker: 'courier',
      say: 'Each parcel weighs two kilos. So how much am I carrying? Work it out from what you kept.',
      // Never said aloud by anyone, so it can only come from the stored
      // count. Asked of the robot's answers, not of its memory: replying
      // to a question leaves nothing behind in memory to check.
      done: (e) => worked(e, '14'),
    },
  ],
  outro:
    'Fourteen kilos! It never stored that — it kept the seven and worked out the rest.',
}

export const LESSONS: Record<string, Lesson> = {
  [threeKinds.id]: threeKinds,
  [talkingToHumans.id]: talkingToHumans,
  [operations.id]: operations,
  [namesPoint.id]: namesPoint,
  [takeAnOrder.id]: takeAnOrder,
}
