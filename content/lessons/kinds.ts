import { numberOf, textOf } from '../../src/scene/props'
import { boolMiss, countMiss, heard, measureMiss, was, type Lesson } from './core'

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
