import { textOf, type Prop } from '../../src/scene/props'
import { bareWord, errorType, heard, stopped, was, type Lesson } from './core'

/**
 * Working things out: an operation takes objects and makes a new one.
 *
 * The same shape as the first two levels — a situation on the stage, the
 * answer drawn into it — and the same question underneath: *what kind
 * comes back?* An int times an int is an int; sharing out with `/` is
 * measuring, so it is always a float, even when it shares exactly (`8 /
 * 2` is `4.0`, the boundary case that makes the rule a rule); a
 * comparison is a question, so it makes a bool; `+` and `*` on text glue
 * and repeat. `==` is met here, as a question, one level before `=` is
 * met as naming, because confusing the two is the mistake that lasts.
 *
 * The robot must do the working: a step asks for the answer *from an
 * operation*, so typing `42` gets a reply rather than a pass. One step
 * gives no operator at all, and choosing `-` is the task.
 *
 * It ends where the next level begins: the answer went nowhere. Nobody
 * but the robot ever knew it, and asking again means working it out
 * again.
 */
const BRACKETS: Prop = { kind: 'expr', text: '(2 + 3) * 4', first: '(2 + 3)', then: ['5 * 4', '20'] }

export const operations: Lesson = {
  id: 'operations',
  teaches: ['arith', 'divide', 'join', 'compare', 'order'],
  ordered: true,
  // The last picture stays, with its working, while the crow says the
  // answer went nowhere.
  finale: BRACKETS,
  steps: [
    {
      say: 'The robot can work things out. Seven crates, six bolts in each. Don\'t count them one by one — ask: `7 * 6`.',
      ask: 'How many bolts? 7 crates of 6.',
      show: { kind: 'crates', crates: 7, each: 6 },
      done: (e) => heard(e, (t) => was('int', '42')(t) && /\*/.test(t.source ?? '')),
      nudge: (l) => {
        const t = l.thought
        if (t?.repr === '42') return 'Right — but let the robot work it out: `7 * 6`.'
        if (t?.repr === '13') return 'That\'s `7 + 6`: one lot of each. Seven crates *of* six is times: `7 * 6`.'
        if (errorType(l) === 'SyntaxError' && /x/i.test(l.source)) return 'The robot\'s times sign is a star: `7 * 6`.'
        if (t?.type === 'int') return `That comes to ${t.repr}. Seven crates of six: \`7 * 6\`.`
        return stopped(l, 'Type `7 * 6`.') ?? 'Type `7 * 6`.'
      },
    },
    {
      say: 'Forty-two: an `int` times an `int` is an `int`. Now share 9 litres of oil between 2 robots: `9 / 2`. What kind comes back?',
      ask: 'Share 9 litres between 2 robots.',
      show: { kind: 'share', litres: 9, robots: 2 },
      done: (e) => heard(e, (t) => was('float', '4.5')(t) && /\//.test(t.source ?? '')),
      nudge: (l) => {
        const t = l.thought
        if (t?.repr === '4' && /\/\//.test(l.source)) return '`//` shares out whole litres only — look, one is left in the jug. `/` shares it all: `9 / 2`.'
        if (t?.repr === '4.5') return 'Right — but let the robot share it: `9 / 2`.'
        if (t?.repr === '4') return 'Four each leaves a litre in the jug. Let the robot share it all: `9 / 2`.'
        return 'Share with a slash: `9 / 2`.'
      },
    },
    {
      say: '`4.5` each. Sharing is measuring, so `/` makes a `float`. What if it shares out exactly? Try `8 / 2`.',
      ask: 'Share 8 litres between 2 robots.',
      show: { kind: 'share', litres: 8, robots: 2 },
      done: (e) => heard(e, (t) => was('float', '4.0')(t) && /\//.test(t.source ?? '')),
      nudge: (l) => {
        const t = l.thought
        if (t?.type === 'int' && t.repr === '4') return '`4` is an `int`. Let the robot share with `/`, and look at what kind comes back.'
        return 'Share with a slash: `8 / 2`.'
      },
    },
    {
      say: '`4.0`, not `4`: `/` always makes a `float`, even when nothing is left over. Now you write the sum: the robot has 20 bolts and uses 7. How many are left?',
      ask: '20 bolts, 7 used. How many left?',
      show: { kind: 'bolts', have: 20, use: 7 },
      done: (e) => heard(e, (t) => was('int', '13')(t) && /-/.test(t.source ?? '')),
      nudge: (l) => {
        const t = l.thought
        if (t?.repr === '13') return 'Right! Now make the robot work it out — write the sum.'
        if (t?.repr === '27') return 'That added them. Using bolts up takes them away: `-`.'
        if (t?.repr === '140') return 'That multiplied them. Using bolts up takes them away: `-`.'
        if (t?.type === 'int' && /-/.test(l.source)) return `That leaves ${t.repr}. Start from the 20 the robot has.`
        return 'Start with 20, and take away the 7 it used.'
      },
    },
    {
      say: 'Thirteen: taking away is `-`. The robot can answer questions, too. Is 3 more than 5? Ask it: `3 > 5`.',
      ask: 'Is 3 more than 5?',
      show: { kind: 'balance', left: 3, right: 5, op: '>' },
      done: (e) => heard(e, (t) => was('bool', 'False')(t) && /[<>]/.test(t.source ?? '')),
      nudge: (l) => {
        const t = l.thought
        if (t?.repr === 'False') return 'Right — but ask the robot: `3 > 5`.'
        if (t?.repr === 'True') return 'That asks it the other way round. *More than* is `>`, with 3 first: `3 > 5`.'
        return 'Ask it with `>`: `3 > 5`.'
      },
    },
    {
      say: '`False` — a question makes a `bool`. To ask *is it the same?*, use two equals signs: `2 + 2 == 4`.',
      ask: 'Is 2 + 2 the same as 4?',
      show: { kind: 'balance', left: 4, right: 4, op: '==' },
      done: (e) => heard(e, (t) => was('bool', 'True')(t) && /==/.test(t.source ?? '')),
      nudge: (l) => {
        if (errorType(l) === 'SyntaxError' && /[^=!<>]=[^=]/.test(l.source)) return 'One `=` means *give it a name* — that\'s coming soon. To ask *the same?*, use two: `==`.'
        if (l.thought?.repr === 'True') return 'Right — but ask the robot: `2 + 2 == 4`.'
        return 'Ask with two equals signs: `2 + 2 == 4`.'
      },
    },
    {
      say: '`True`. `==` asks; it never changes anything. Words work too, but differently. Glue two: `"bot" + "gineer"`.',
      ask: 'Glue "bot" and "gineer".',
      show: { kind: 'tiles', parts: ['"bot"', '+', '"gineer"'] },
      done: (e) => heard(e, (t) => textOf(t) === 'botgineer'),
      nudge: (l) => {
        if (textOf(l.thought) === 'bot gineer') return 'One word — `+` adds no space.'
        if (bareWord(l) || errorType(l) === 'NameError') return 'Each word needs its own quotes: `"bot" + "gineer"`.'
        return 'Type `"bot" + "gineer"`.'
      },
    },
    {
      say: 'On text, `+` glues. And `*` repeats — try `"ha" * 3`.',
      ask: 'Repeat "ha" three times.',
      show: { kind: 'tiles', parts: ['"ha"', '*', '3'] },
      done: (e) => heard(e, (t) => textOf(t) === 'hahaha'),
      nudge: (l) => {
        if (errorType(l) === 'TypeError') return 'Repeat by a number, not a word: `"ha" * 3`.'
        if (errorType(l) === 'NameError') return '`ha` is a word, so it needs quotes: `"ha" * 3`.'
        return 'Type `"ha" * 3`.'
      },
    },
    {
      say: 'Ha! Now a puzzle. What is `2 + 3 * 4`? Guess first — then ask the robot.',
      ask: 'What is 2 + 3 * 4?',
      show: { kind: 'expr', text: '2 + 3 * 4', first: '3 * 4', then: ['2 + 12', '14'] },
      done: (e) => heard(e, (t) => was('int', '14')(t) && /\*/.test(t.source ?? '') && /\+/.test(t.source ?? '')),
      nudge: (l) => {
        if (l.thought?.repr === '14') return 'Good guess! Now check it with the robot: `2 + 3 * 4`.'
        if (l.thought?.repr === '20') return 'That\'s working left to right. Ask the robot: `2 + 3 * 4`.'
        return 'Ask the robot: `2 + 3 * 4`.'
      },
    },
    {
      say: '`14`, not 20: `*` goes before `+`, as in maths. Brackets go first of all: `(2 + 3) * 4`.',
      ask: 'What is (2 + 3) * 4?',
      show: BRACKETS,
      done: (e) => heard(e, (t) => was('int', '20')(t) && /\(/.test(t.source ?? '')),
      nudge: (l) =>
        l.thought?.repr === '14'
          ? 'Put brackets round the part to do first: `(2 + 3) * 4`.'
          : 'Type it with the brackets: `(2 + 3) * 4`.',
    },
  ],
  outro:
    'Twenty. And it\'s gone already — nobody else ever knew it. Ask again and it starts from scratch.',
}
