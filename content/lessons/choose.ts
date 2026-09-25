/**
 * Level 1c, Choose the type (`choose`): docs/PEDAGOGY.md §5.
 *
 * The robot can now think of five kinds of thing; what it cannot do is
 * pick one. So the player does (R12): twelve questions, each with one
 * picture and one ask and no hint about the type, because choosing is the
 * whole of the task. The praise always gives the reason in the same few
 * words — yes or no, counted, measured, words for people — which is the
 * rule the close then says aloud.
 *
 * The shelf opens the level as the reference it was left as, and closes
 * it holding the player's right answers, each in its slot (`staging`
 * hands a picture only the answers that did a step, never the misses).
 *
 * Mira is here from the start, and brings the questions a person has:
 * a sign with her name, the letter her name starts with, a phone number
 * that looks like a number and is not one, and a door. The last two
 * questions are one answer for two readers (R7): the robot's yes is
 * `True`, and Mira's is words. The robot's half has its own picture — a
 * lamp that lights for the lock — because a word stuck on a lamp that
 * stays dark is the miss, drawn (R10).
 *
 * Every question's likely miss has a reply, and each is drawn where the
 * picture can draw it: a note stuck on the fish, six eggs "measured",
 * an empty glass that is not empty, a lift gone up, a phone number that
 * lost its zero, a match bar at `1.3`, a blank note on Mira's door. A
 * line that stops the robot (`Mira` without quotes) has nothing to draw,
 * so it is said. Mira speaks her own question and its replies; the
 * crow asks the rest, since its replies talk about the robot.
 *
 * Ordered, so an answer counts only for the question that asked it.
 */
import { numberOf, textOf, type Prop } from '../../src/scene/props'
import { bareWord, boolMiss, commaDecimal, countMiss, digits, errorType, measureMiss, stopped, was, wordsMiss, type Lesson, type Line } from './core'

const SHELF: Prop = { kind: 'shelf', filled: ['bool', 'int', 'float', 'char', 'str'], title: true }

const PHONE = '0412555019'

/** A comma for the decimal point, read from the source too: the console
 *  stops on `1,5` with a `TypeError` rather than making the pair. */
const measured = (l: Line): string | undefined =>
  commaDecimal(l) || /^\s*-?\d+\s*,\s*\d+\s*$/.test(l.source)
    ? 'Python writes a decimal point as a dot, not a comma, like `1.5`.'
    : measureMiss(l)

function fishMiss(l: Line): string | undefined {
  if (l.thought?.repr === 'True') return 'A bird? Then where are its feathers? Look again.'
  if (l.thought?.type === 'str') return 'I stuck your note on the fish, and nothing happened. The robot\'s no is `False`.'
  return boolMiss(l)
}

function eggMiss(l: Line): string | undefined {
  const t = l.thought
  if (t?.type === 'int') return `I put ${t.repr} in the box. Count the hollows: how many fit?`
  return countMiss(l, 'eggs')
}

function quarterMiss(l: Line): string | undefined {
  const t = l.thought
  const n = numberOf(t)
  if (t?.type === 'int' && n === 0) return 'Empty? There\'s water in it!'
  if (t?.type === 'int' && n === 1) return 'Full? The water only comes a quarter of the way up.'
  if (t?.type === 'int') return 'No whole number fits: it\'s between `0` and `1`, so it needs a dot.'
  if (t?.type === 'float' && n !== null && n > 1) return 'More than full? It would spill! It\'s between `0` and `1`.'
  if (t?.type === 'float' && n === 0.5) return '`0.5` is half full. Compare the glasses: this one has less.'
  if (t?.type === 'float') return `I filled the other glass to ${t.repr}. Compare them.`
  if (/quarter/i.test(textOf(t) ?? '')) return 'That\'s the word. The robot writes a quarter as `0.25`.'
  return measured(l)
}

function signMiss(l: Line): string | undefined {
  const text = textOf(l.thought)
  if (text !== null && text.trim() !== '') return 'A lovely sign, but Mira wants her name on it.'
  return wordsMiss(l, '"Mira"')
}

function floorMiss(l: Line): string | undefined {
  const t = l.thought
  const n = numberOf(t)
  if (t?.type === 'float' && n !== null) return 'Stuck between floors! A lift stops at whole floors.'
  if (t?.type === 'int' && n === 1) return 'That sent the lift *up*. Under the ground is below zero.'
  if (t?.type === 'int' && n === 0) return 'Floor `0` is the ground. The car park is one below it.'
  if (t?.type === 'int') return `There's no car park on floor ${t.repr}. It's one under the ground.`
  return countMiss(l, 'floors')
}

/** Mira's own replies: she reads letters, and speaks no robot. */
function initialMiss(l: Line): string | undefined {
  const text = textOf(l.thought)
  if (text !== null && [...text].length > 1) return 'That\'s my whole name! I only wanted the first letter.'
  if (text === 'm') return 'Nearly! My name starts with a big letter, though.'
  if (text !== null && text !== '') return 'That\'s one letter, but my name doesn\'t start with it.'
  if (bareWord(l)) return 'The robot got stuck on that. My letters always come in quotes.'
  if (l.thought) return 'That\'s robot talk to me. I read letters!'
  return stopped(l, 'One letter, in quotes.')
}

function heightMiss(l: Line): string | undefined {
  const t = l.thought
  const n = numberOf(t)
  if (n !== null && n >= 50 && n <= 250) return `That sounds like centimetres. In metres it has a dot: ${n} centimetres is \`${n / 100}\`.`
  if (t?.type === 'int' && (n === 1 || n === 2)) return `Hardly anyone is exactly ${n} metre${n === 1 ? '' : 's'} tall. Measure closer, with a dot.`
  if (t?.type === 'int') return 'People aren\'t a whole number of metres tall. Measure it, with a dot.'
  if (t?.type === 'float' && n !== null && n > 2.5) return `${t.repr} metres? You'd bump your head on the door! Most people are between 1 and 2.`
  if (t?.type === 'float' && n !== null) return `${t.repr} metres? That's shorter than a cat! Most people are between 1 and 2.`
  return measured(l)
}

function breakfastMiss(l: Line): string | undefined {
  if (l.thought?.type === 'str') return 'That\'s for people. Tell the *robot*: its yes and no have no quotes.'
  return boolMiss(l)
}

function phoneMiss(l: Line): string | undefined {
  const t = l.thought
  const text = textOf(t)
  if (errorType(l) === 'SyntaxError') return 'Python can\'t read a number with a `0` in front, or spaces in it. Is this one for adding up?'
  if (t?.type === 'int' && t.repr === PHONE.replace(/^0+/, '')) return 'The `0` at the front fell off: a number doesn\'t keep one. Nobody adds up phone numbers.'
  if (t?.type === 'int' || t?.type === 'float') return 'Nobody adds up phone numbers, so it isn\'t a number to the robot.'
  if (text !== null && digits(text) !== PHONE) return 'Check the digits against Mira\'s: 0412 555 019.'
  return wordsMiss(l, '"0412 555 019"')
}

function matchMiss(l: Line): string | undefined {
  const t = l.thought
  const n = numberOf(t)
  if (n === 90) return 'That\'s the minutes. How many *hours*? One hour is 60 minutes.'
  if (t?.type === 'int' && n === 1) return 'One hour is only 60 minutes. The match goes on for another half hour.'
  if (t?.type === 'int' && n === 2) return 'Two hours is 120 minutes, too long. It ends halfway between one hour and two.'
  if (t?.type === 'float' && n === 1.3) return '`1.3` isn\'t an hour and 30 minutes: a dot is not a clock. Half an hour is `0.5` of an hour.'
  if (t?.type === 'float' && n !== null && n > 1 && n < 2) return 'Close! It\'s exactly halfway between one hour and two.'
  if (t?.type === 'int') return 'No whole number of hours fits. Measure it: a number with a dot.'
  if (t?.type === 'float') return 'Two halves of 45 minutes is 90 minutes. How many hours is that?'
  return measured(l)
}

function lockedMiss(l: Line): string | undefined {
  if (l.thought?.type === 'str') return 'That\'s Mira\'s word, so it sits on the light as a note. The robot\'s yes has no quotes.'
  if (l.thought?.repr === 'False') return 'It *is* locked, I checked. So the robot\'s answer is yes.'
  return boolMiss(l)
}

function tellMiraMiss(l: Line): string | undefined {
  const t = l.thought
  if (t?.type === 'bool') return 'That\'s robot for yes, and it leaves Mira\'s note blank. Mira reads words.'
  if (textOf(t) !== null && textOf(t)!.trim() !== '') return 'Mira wants to know one thing: is it locked? Tell her in words.'
  return wordsMiss(l, '"Yes, it\'s locked"')
}

export const choose: Lesson = {
  id: 'choose',
  teaches: ['kind'],
  ordered: true,
  finale: SHELF,
  steps: [
    {
      beats: [
        { say: 'Now you choose: I\'ll ask, and you give the robot the answer.', show: SHELF },
        { say: 'Pick the right data type each time, and the shelf is here if you need it.', show: SHELF },
      ],
      say: 'Is a fish a bird?',
      ask: 'Is a fish a bird?',
      show: { kind: 'fish' },
      tag: 'you',
      done: (e) => e.thoughts.some(was('bool', 'False')),
      praise: 'Yes or no, so a `bool`.',
      nudge: fishMiss,
    },
    {
      say: 'How many eggs fit in this box?',
      ask: 'How many eggs fit?',
      show: { kind: 'carton', slots: 6 },
      tag: 'you',
      done: (e) => e.thoughts.some(was('int', '6')),
      praise: 'Counted, so an `int`.',
      nudge: eggMiss,
    },
    {
      say: 'How full is this glass?',
      ask: 'How full is this glass?',
      show: { kind: 'glass', level: 0.25 },
      tag: 'you',
      done: (e) => e.thoughts.some(was('float', '0.25')),
      praise: 'Measured, so a `float`.',
      nudge: quarterMiss,
    },
    {
      beats: [{ speaker: 'courier', say: 'I need a sign for my door, with my name on it.' }],
      say: 'What should the sign say?',
      ask: 'What should the sign say?',
      show: { kind: 'card' },
      tag: 'you',
      done: (e) => e.thoughts.some((t) => /mira/i.test(textOf(t) ?? '')),
      praise: 'Words for people, so a `str`.',
      nudge: signMiss,
    },
    {
      say: 'Which floor is the car park, one under the ground?',
      ask: 'Which floor is the car park?',
      show: { kind: 'lift', lowest: -2, highest: 3 },
      tag: 'you',
      done: (e) => e.thoughts.some(was('int', '-1')),
      praise: 'Floors are counted, below zero too, so an `int`.',
      nudge: floorMiss,
    },
    {
      speaker: 'courier',
      say: 'What letter does my name start with?',
      ask: 'The first letter of Mira\'s name.',
      show: { kind: 'card' },
      tag: 'you',
      done: (e) => e.thoughts.some(was('str', "'M'")),
      praise: 'One letter, so a char, which Python keeps as a `str`.',
      nudge: initialMiss,
    },
    {
      say: 'How tall are you, in metres?',
      ask: 'How tall are you, in metres?',
      show: { kind: 'height' },
      tag: 'you',
      done: (e) => e.thoughts.some((t) => t.type === 'float' && Number(t.repr) >= 0.5 && Number(t.repr) <= 2.5),
      praise: 'A height is measured, so a `float`.',
      nudge: heightMiss,
    },
    {
      say: 'Did you have breakfast today?',
      ask: 'Did you have breakfast today?',
      show: { kind: 'plate' },
      tag: 'you',
      done: (e) => e.thoughts.some((t) => t.type === 'bool'),
      praise: 'A yes-or-no, so a `bool`.',
      nudge: breakfastMiss,
    },
    {
      beats: [{ speaker: 'courier', say: 'Can the robot keep my phone number, 0412 555 019?' }],
      say: 'Type Mira\'s number.',
      ask: 'Mira\'s number.',
      show: { kind: 'phone', number: PHONE },
      tag: 'you',
      done: (e) => e.thoughts.some((t) => digits(textOf(t) ?? '') === PHONE),
      praise: 'Nobody adds up phone numbers, so it\'s words: a `str`.',
      nudge: phoneMiss,
    },
    {
      beats: [{ say: 'A football match is two halves of 45 minutes.' }],
      say: 'How long is it, in hours?',
      ask: 'How many hours is the match?',
      show: { kind: 'match' },
      tag: 'you',
      done: (e) => e.thoughts.some(was('float', '1.5')),
      praise: 'Between one hour and two, so a `float`.',
      nudge: matchMiss,
    },
    {
      beats: [
        { speaker: 'courier', say: 'Oh! Is my front door locked?' },
        { say: 'It is, and the robot has a light for it that comes on when it\'s locked.' },
      ],
      say: 'Tell the robot: is it locked?',
      ask: 'Is the door locked?',
      show: { kind: 'lamp' },
      tag: 'you',
      done: (e) => e.thoughts.some(was('bool', 'True')),
      praise: 'The robot\'s yes is `True`, so the light comes on.',
      nudge: lockedMiss,
    },
    {
      beats: [{ say: 'Now tell *Mira*, and she needs words.' }],
      say: 'Tell Mira: is it locked?',
      ask: 'A note for Mira.',
      show: { kind: 'door' },
      tag: 'you',
      done: (e) => e.thoughts.some((t) => /lock|yes/i.test(textOf(t) ?? '')),
      praise: 'Same answer, but Mira reads words, so a `str`.',
      nudge: tellMiraMiss,
    },
  ],
  outro: [
    { say: 'Every answer you gave had a data type, and you picked the right one.', show: { ...SHELF, cheer: true } },
    { say: 'The question tells you the type: yes or no, how many, how much, or words.' },
    { say: 'Next, the robot works things out for itself.' },
  ],
  takeaway: 'Every value has a data type, and the question you are answering decides which one.',
}
