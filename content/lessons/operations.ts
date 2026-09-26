import { textOf, type Prop } from '../../src/scene/props'
import { bareWord, errorType, heard, stopped, type Heard, type Lesson, type Line } from './core'

/**
 * Level 2 — Working things out (`operations`). docs/PEDAGOGY.md §6, and
 * the four questions §5 moved here out of Lesson 1.
 *
 * The robot's problem (R12): it can only think of what you tell it. Mira
 * brings a sum it has never seen — seven crates of six bolts — and the
 * robot cannot know the answer. It can work it out, though, if you give
 * it the sum. It ends able to make new values from old ones, and having
 * forgotten every one of them, which is the itch Level 4 scratches.
 *
 * The rule is said once, before the first question, and every ask wears
 * the *Robot works it out* tag: **don't tell me the answer, give the
 * robot the sum.** So every `done` reads the line's source as well as its
 * value — the step's own numbers (or words), and its sign — and the right
 * answer typed by hand, or dressed up as `42 * 1`, gets a reply, never a
 * pass.
 *
 * Underneath every step is one question from Lesson 1 — *what type comes
 * back?* — and the answer tag on each picture wears the type. An `int`
 * with an `int` is an `int`; `/` measures, so it is always a `float`, even
 * when it shares exactly (`8 / 2` is `4.0`, the boundary that makes the
 * rule a rule); a counted and a measured number make a measured one; a
 * comparison is a question, so a `bool`. Then text, where `+` and `*` mean
 * something else, then the two secrets that every character and every
 * `True` is a number, and last the order the robot does things in.
 *
 * | #  | Beats (who says it; what is on the stage)                            | Ask (tag: robot)                        | Right              |
 * |----|-----------------------------------------------------------------------|-----------------------------------------|--------------------|
 * | 1  | Mira enters: 7 crates of 6; robot thinks `?`; the rule; `*` named      | How many bolts are in the crates?       | `7 * 6` → 42       |
 * | 2  | `+` and `-` named; Mira used 7 of her 20 bolts (bolts)                 | How many bolts are left?                | `20 - 7` → 13      |
 * | 3  | *operations* named; 9 litres for 2 tanks; `/` named (jug and tanks)    | How much oil does each tank get?        | `9 / 2` → 4.5      |
 * | 4  | what if it shares exactly? (8 litres)                                  | How much … from 8 litres?               | `8 / 2` → 4.0      |
 * | 5  | a counted `2` beside a measured `0.5` (contrast); what type comes back? | Let the robot add `2 + 0.5`.            | 2.5, a float       |
 * | 6  | *comparison* named; `>` named (balance, 3 against 5)                   | Is 3 more than 5?                       | `3 > 5` False      |
 * | 7  | `==` named (`2 + 2 == 4` as blocks); the balance levels, lamp: `True`  | Is `7 * 6` the same as `42`?            | `7 * 6 == 42` True |
 * | 8  | Mira: words too? (`7` ≠ `"7"`); `7 + 7` → 14 beside `"7" + "7"` → "77"  | What does `"bot" + "gineer"` make?      | 'botgineer'        |
 * | 9  | `*` on text: `"ha" * 3` stamps itself three times (tiles)              | Make the robot say `"ha"` five times.   | `"ha" * 5`         |
 * | 10 | a secret: A, B, C slide onto 65, 66, 67 (codes); `ord` named, thinks 65 | What is the code for Mira's `"M"`?      | `ord("M")` 77      |
 * | 11 | another: `True` counts as `1`, two lamps make `2` (lamps)               | What is `True + True + True`? (expr)    | 3, an int          |
 * | 12 | a puzzle: which first, `+` or `*`? (expr, working hidden)             | What is `2 + 3 * 4`?                    | 14                 |
 * | 13 | brackets go first of all (expr)                                        | Make the robot add `2 + 3` first, …     | `(2 + 3) * 4`      |
 * |    | outro: Mira thanks the robot · it can make new values from old ones · it worked out twenty, and forgot it (the cloud empties, memory pulses) · next, remembering |||
 *
 * Choices worth keeping:
 *
 * - Thirteen asks where the brief said about twelve. Each is one
 *   operator or one type rule, and the two that look mergeable are the
 *   point of each other: `9 / 2` makes `/` a float, `8 / 2` makes the
 *   rule a rule; `2 + 3 * 4` shows the order, `(2 + 3) * 4` hands it to
 *   the player.
 * - "Typed by hand" means the answer itself is in the line: `42`, or
 *   `42 * 1`. Six sevens added up is the robot's working by another
 *   route, and is told so honestly — then pointed at the sign the step is
 *   about. `-7 + 20` takes 7 from 20 and passes.
 * - `7 + 7` against `"7" + "7"` is *shown* (R7), not asked: asked first,
 *   it is a guess about a sign nobody has explained. The ask then uses
 *   the idea on new words. `"ha" * 3` is likewise the demonstration, and
 *   five is the ask.
 * - The `==` balance can only draw `2 + 2 == 4`, so its lamp answers that
 *   question on a narration beat and the ask moves to Mira's crates:
 *   `7 * 6 == 42`, on Lesson 1's lamp, which lights for `True`. The ask
 *   needs a picture of another kind anyway: `staging` keeps the picture
 *   of the same kind across a narration change, so a balance on the ask
 *   would keep the lamp lit and give the answer away. For the same reason
 *   the naming beat before it lays `2 + 2 == 4` out as blocks, not on the
 *   balance. One `=` still gets the reply that it means *give it a
 *   name*, coming soon, because that confusion lasts.
 * - `True + True` is demonstrated with two lamps, and the ask is three of
 *   them, drawn as the sum and not as lamps: the lamps picture always
 *   adds up to its own count, so it would pre-draw the answer and then
 *   contradict any other. Answered, the sum shows its working to `3`.
 * - A beat's `thought` covers the cloud where the last real thought would
 *   contradict the line: `True` as the lamp lights, `'hahaha'` as it
 *   stamps, and nothing at all once the robot has forgotten twenty.
 * - `ord` is Mira's own letter, on the card that turns over to its code.
 * - `//` is only ever met in a reply, and the reply names it as a new sign
 *   (R5).
 * - `2 + 0,5` reaches a reply as a `TypeError`, not a pair: the console
 *   hands the pending line to its describer as arguments. The reply keys
 *   on the comma in the source, so it says the same thing either way.
 */
const BRACKETS: Prop = { kind: 'expr', text: '(2 + 3) * 4', first: '(2 + 3)', then: ['5 * 4', '20'] }
const PUZZLE: Prop = { kind: 'expr', text: '2 + 3 * 4', first: '3 * 4', then: ['2 + 12', '14'] }

type Said = Heard | Line
const src = (t: Said): string => t.source ?? ''

/** The line with its quoted words blanked, so `"7"` is not a number. */
const unquoted = (s: string) => s.replace(/"[^"]*"|'[^']*'/g, '""')

/** The numbers written in a line, outside quotes, smallest first. */
const numbers = (s: string): number[] => (unquoted(s).match(/\d*\.\d+|\d+/g) ?? []).map(Number).sort((a, b) => a - b)

/** The quoted words in a line, in order. */
const words = (s: string): string[] => [...s.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? '')

/** The line, without spaces or brackets. */
const bare = (s: string) => s.replace(/[\s()]/g, '')

/** The line is written with exactly these numbers, in any order. */
const just = (t: Said, ...ns: number[]): boolean => {
  const got = numbers(src(t))
  const want = [...ns].sort((a, b) => a - b)
  return got.length === want.length && got.every((n, i) => n === want[i])
}

/** The answer is in the line itself — `42`, or `42 * 1` — so the robot
 *  did none of the working, whatever the line looks like. */
const byHand = (l: Line, answer: number): boolean => numbers(l.source).includes(answer)

const yours = (sum: string) => `That's the answer, but you worked it out. Give the robot the sum: \`${sum}\`.`
const route = (sum: string) => `The robot got there, but another way. Give it these numbers: \`${sum}\`.`

const TIMES = /\*/
const SLASH = /(^|[^/])\/([^/]|$)/
const PLUS = /\+/
const SAME = /==/

export const operations: Lesson = {
  id: 'operations',
  teaches: ['arith', 'divide', 'join', 'compare', 'order'],
  ordered: true,
  // No finale: once it is finished the stage is empty, and so is memory,
  // which is the point of the last lines. (The finale view carries no
  // answer, so `expr` would go back to "= ?", which says the wrong thing.)
  steps: [
    {
      beats: [
        {
          say: 'Hi again, I need the robot\'s help with some counting.',
          speaker: 'courier',
          act: [
            { actor: 'courier', do: 'enter' },
            { actor: 'courier', do: 'wave' },
          ],
        },
        { say: 'I have seven crates with six bolts in each, but how many bolts is that?', speaker: 'courier', show: { kind: 'crates', crates: 7, each: 6 } },
        { say: 'The robot has never seen these crates, so it can\'t just know.', thought: '?' },
        { say: 'But it can work an answer out, and that\'s what it\'s for.' },
        { say: 'So don\'t tell me the answer: give the robot the sum, and let it work it out.', focus: 'console' },
        { say: 'Python\'s times sign is a star: `7 * 6` means seven lots of six.' },
      ],
      say: 'How many bolts are in the crates?',
      ask: '7 crates of 6 bolts',
      tag: 'robot',
      show: { kind: 'crates', crates: 7, each: 6 },
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '42' && TIMES.test(src(t)) && just(t, 7, 6)),
      praise: '`42`, an `int`: an `int` times an `int` always makes an `int`.',
      nudge: (l) => {
        const t = l.thought
        if (t?.repr === '42' && byHand(l, 42)) return yours('7 * 6')
        if (t?.repr === '42' && /^[\d\s+]+$/.test(l.source)) return 'That\'s 42, and the robot added it up! Seven lots of six is quicker with a star: `7 * 6`.'
        if (t?.repr === '42') return route('7 * 6')
        if (t?.repr === '13') return 'That\'s `7 + 6`: one of each. Seven lots of six is times: `7 * 6`.'
        if (errorType(l) === 'SyntaxError' && /x/i.test(l.source)) return 'The robot\'s times sign is a star, not an x: `7 * 6`.'
        if (t?.type === 'int') return `That comes to ${t.repr}. Seven crates of six: \`7 * 6\`.`
        return stopped(l, 'Try `7 * 6`.') ?? 'Seven crates of six: `7 * 6`.'
      },
    },
    {
      beats: [
        { say: 'Adding is `+` and taking away is `-`, the same as on paper.' },
        { say: 'I had 20 bolts, and I used 7 of them on my door.', speaker: 'courier', show: { kind: 'bolts', have: 20, use: 7 } },
      ],
      say: 'How many bolts are left?',
      ask: '20 bolts, 7 used',
      tag: 'robot',
      show: { kind: 'bolts', have: 20, use: 7 },
      // `-7 + 20` takes the 7 from the 20 as well, so it passes.
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '13' && /-/.test(src(t)) && just(t, 20, 7)),
      praise: '`13`: an `int` take away an `int` is an `int`, too.',
      nudge: (l) => {
        const t = l.thought
        if (t?.repr === '13' && byHand(l, 13)) return yours('20 - 7')
        if (t?.repr === '13') return route('20 - 7')
        if (t?.repr === '27') return 'That added them. Using bolts up takes them away: `-`.'
        if (t?.repr === '140') return 'That multiplied them. Using bolts up takes them away: `-`.'
        if (t?.repr === '-13') return 'That took 20 from 7. Start with the 20 she had: `20 - 7`.'
        if (t?.type === 'int' && /-/.test(l.source)) return `That leaves ${t.repr}. Start from the 20 she had.`
        return stopped(l, 'Start with 20 and take away 7.') ?? 'Start with 20, and take away the 7 she used.'
      },
    },
    {
      beats: [
        { say: '`*`, `+` and `-` are called operations: each one makes a new value.' },
        { say: 'Now some oil: 9 litres, shared between 2 tanks.', show: { kind: 'share', litres: 9, robots: 2 } },
        { say: 'Sharing out is dividing, and Python\'s divide sign is a slash: `/`.' },
      ],
      say: 'How much oil does each tank get?',
      ask: '9 litres, 2 tanks',
      tag: 'robot',
      show: { kind: 'share', litres: 9, robots: 2 },
      done: (e) => heard(e, (t) => t.type === 'float' && t.repr === '4.5' && SLASH.test(src(t)) && just(t, 9, 2)),
      praise: '`4.5`, a `float`: a share can land between whole numbers, so `/` measures.',
      nudge: (l) => {
        const t = l.thought
        if (/\/\//.test(l.source) && t?.type === 'int') return '`//` is a different sign: it shares whole litres only, and one is left in the jug. Use `/`.'
        if (t?.repr === '4.5' && byHand(l, 4.5)) return yours('9 / 2')
        if (t?.repr === '4.5') return route('9 / 2')
        if (t?.repr === '4') return 'Four each leaves a litre in the jug. Let the robot share it all: `9 / 2`.'
        if (t?.repr === '18') return 'That doubled it. Sharing between two is dividing: `9 / 2`.'
        return stopped(l, 'Share with a slash: `9 / 2`.') ?? 'Share with a slash: `9 / 2`.'
      },
    },
    {
      beats: [{ say: 'And what if it shares out exactly, like 8 litres between the 2 tanks?', show: { kind: 'share', litres: 8, robots: 2 } }],
      say: 'How much does each tank get from 8 litres?',
      ask: '8 litres, 2 tanks',
      tag: 'robot',
      show: { kind: 'share', litres: 8, robots: 2 },
      done: (e) => heard(e, (t) => t.type === 'float' && t.repr === '4.0' && SLASH.test(src(t)) && just(t, 8, 2)),
      praise: '`4.0`, not `4`: `/` always makes a `float`, even when nothing is left over.',
      nudge: (l) => {
        const t = l.thought
        if (t?.type === 'int' && t.repr === '4' && /\/\//.test(l.source)) return '`//` is a different sign, for whole litres. Share with one slash: `8 / 2`.'
        if (t?.type === 'int' && t.repr === '4') return '`4` is an `int`, and you worked it out. Let the robot share with `/`, and see what comes back.'
        if (t?.repr === '4.0' && byHand(l, 4)) return yours('8 / 2')
        if (t?.repr === '4.0') return route('8 / 2')
        return stopped(l, 'Share with a slash: `8 / 2`.') ?? 'Share with a slash: `8 / 2`.'
      },
    },
    {
      beats: [
        {
          say: 'Now mix the two kinds: a counted `2` and a measured `0.5`.',
          show: {
            kind: 'contrast',
            left: { text: '2', kind: 'int', label: 'counted' },
            right: { text: '0.5', kind: 'float', label: 'measured' },
          },
        },
        { say: 'What type comes back when you add them? Don\'t work it out: let the robot, and look.' },
      ],
      say: 'Let the robot add `2 + 0.5`.',
      ask: '2 + 0.5',
      tag: 'robot',
      show: { kind: 'numberline', from: 0, to: 3, want: 2.5 },
      // `type(2 + 0.5)` answers the beat's question, and the robot still
      // did the adding.
      done: (e) =>
        heard(
          e,
          (t) =>
            ((t.type === 'float' && t.repr === '2.5') || (t.type === 'type' && t.repr === "<class 'float'>")) &&
            PLUS.test(src(t)) &&
            just(t, 2, 0.5),
        ),
      praise: (a) =>
        a?.type === 'type'
          ? '`float`: mixing an `int` with a `float` makes a `float`, so the half is kept.'
          : '`2.5`, a `float`: mixing an `int` with a `float` makes a `float`, so the half is kept.',
      nudge: (l) => {
        const t = l.thought
        if (t?.type === 'type' && /^\s*\w+\s*$/.test(l.source)) {
          return `\`${l.source.trim()}\` is a type's name. Let the robot add them, and it will show you the type.`
        }
        if (t?.repr === '2.5' && byHand(l, 2.5)) return yours('2 + 0.5')
        if (t?.repr === '2.5') return route('2 + 0.5')
        // A comma makes two things: typed alone that is a pair, and handed
        // to the robot's describing it is two arguments, so a TypeError.
        if (/\d\s*,\s*\d/.test(l.source)) return 'A comma makes two things. Python writes a half with a dot: `2 + 0.5`.'
        if (bareWord(l)) return 'Don\'t name the type: let the robot add them, and it will show you. `2 + 0.5`.'
        if (t?.type === 'str') return 'That\'s words, for people. Let the robot add the numbers: `2 + 0.5`.'
        return stopped(l, 'Let the robot add them: `2 + 0.5`.') ?? 'Let the robot add them: `2 + 0.5`.'
      },
    },
    {
      beats: [
        { say: 'The robot can answer questions, too, and a question like that is called a comparison.', show: { kind: 'balance', left: 3, right: 5, op: '>' } },
        { say: '`>` asks *is it more than?*, so `3 > 5` asks if 3 is more than 5.' },
      ],
      say: 'Is 3 more than 5?',
      ask: '3 against 5',
      tag: 'robot',
      show: { kind: 'balance', left: 3, right: 5, op: '>' },
      // `5 < 3` asks the same question from the other side.
      done: (e) => heard(e, (t) => t.type === 'bool' && t.repr === 'False' && ['3>5', '5<3'].includes(bare(src(t)))),
      praise: '`False`: a question has a yes-or-no answer, so a comparison makes a `bool`.',
      nudge: (l) => {
        const t = l.thought
        const b = bare(l.source)
        if (t?.type === 'bool' && /^(True|False)$/.test(l.source.trim())) return 'That\'s right, but you answered it. Ask the robot: `3 > 5`.'
        if (b === '5>3' || b === '3<5') return 'That asks it the other way round. *More than* is `>`, with 3 first: `3 > 5`.'
        if (t?.type === 'bool') return 'Ask it just the one question: `3 > 5`.'
        if (bareWord(l)) return 'Let the robot answer, with `>`: `3 > 5`.'
        return stopped(l, 'Ask it with `>`: `3 > 5`.') ?? 'Ask it with `>`: `3 > 5`.'
      },
    },
    {
      beats: [
        { say: 'To ask *is it the same?*, Python uses two equals signs: `==`.', show: { kind: 'tiles', parts: ['2', '+', '2', '==', '4'] } },
        {
          say: 'When both sides weigh the same, the balance levels, and the answer is `True`.',
          show: { kind: 'balance', left: 4, right: 4, op: '==', lamp: true, leftLabel: '2 + 2' },
          thought: 'True',
        },
      ],
      say: 'Is `7 * 6` the same as `42`?',
      ask: '7 * 6 == 42 ?',
      tag: 'robot',
      show: { kind: 'lamp' },
      done: (e) =>
        heard(e, (t) => t.type === 'bool' && t.repr === 'True' && SAME.test(src(t)) && TIMES.test(src(t)) && just(t, 7, 6, 42)),
      praise: '`True`: `==` asks a question, so it makes a `bool`, and it changes nothing.',
      nudge: (l) => {
        const t = l.thought
        if (errorType(l) === 'SyntaxError' && /[^=!<>]=[^=]/.test(l.source)) {
          return 'One `=` means *give it a name*, which is coming soon. To ask *the same?*, use two: `==`.'
        }
        if (t?.type === 'bool' && /^(True|False)$/.test(l.source.trim())) return 'That\'s right, but you answered it. Ask the robot: `7 * 6 == 42`.'
        if (t?.type === 'bool' && SAME.test(l.source)) return 'Let the robot do the times as well: `7 * 6 == 42`.'
        return stopped(l, 'Ask with two equals signs: `7 * 6 == 42`.') ?? 'Ask with two equals signs: `7 * 6 == 42`.'
      },
    },
    {
      beats: [
        {
          say: 'Can the robot do words, too?',
          speaker: 'courier',
          show: {
            kind: 'contrast',
            left: { text: '7', kind: 'int', label: 'a number' },
            right: { text: '"7"', kind: 'char', label: 'a thing to read' },
          },
        },
        { say: 'It can, but remember: `7` is a number, and `"7"` is a thing to read.' },
        {
          say: 'On numbers `+` adds, but on text it glues: `"7" + "7"` makes `"77"`.',
          show: {
            kind: 'contrast',
            left: { text: '7 + 7', kind: 'int', result: '14' },
            right: { text: '"7" + "7"', kind: 'str', result: '"77"' },
          },
        },
      ],
      say: 'What does `"bot" + "gineer"` make?',
      ask: 'glue two words',
      tag: 'robot',
      show: { kind: 'tiles', parts: ['"bot"', '+', '"gineer"'] },
      done: (e) => heard(e, (t) => textOf(t) === 'botgineer' && PLUS.test(src(t)) && words(src(t)).join('|') === 'bot|gineer'),
      praise: '`"botgineer"`: `+` glues two `str`s into one longer `str`, and adds no space.',
      nudge: (l) => {
        const text = textOf(l.thought)
        if (text === 'botgineer' && words(l.source).includes('botgineer')) return yours('"bot" + "gineer"')
        if (text === 'botgineer') return 'The robot glued it, but from other pieces. Glue these two: `"bot" + "gineer"`.'
        if (text === 'bot gineer') return 'You added a space: `+` glues exactly what it is given. Try `"bot" + "gineer"`.'
        if (bareWord(l) || errorType(l) === 'NameError') return 'Each word needs its own quotes: `"bot" + "gineer"`.'
        if (errorType(l) === 'TypeError') return 'Glue text to text: both need quotes. `"bot" + "gineer"`.'
        return stopped(l, 'Type `"bot" + "gineer"`.') ?? 'Glue them with `+`: `"bot" + "gineer"`.'
      },
    },
    {
      beats: [
        {
          say: 'And on text, `*` repeats it: `"ha" * 3` is `"ha"`, three times.',
          show: { kind: 'tiles', parts: ['"ha"', '*', '3'], demo: 'stamp' },
          thought: "'hahaha'",
        },
      ],
      say: 'Make the robot say `"ha"` five times.',
      ask: '"ha", five times',
      tag: 'robot',
      show: { kind: 'tiles', parts: ['"ha"', '*', '5'] },
      done: (e) => heard(e, (t) => textOf(t) === 'hahahahaha' && TIMES.test(src(t)) && words(src(t)).join('|') === 'ha' && just(t, 5)),
      praise: '`"hahahahaha"`: a `str` times an `int` is that `str`, repeated.',
      nudge: (l) => {
        const text = textOf(l.thought)
        if (text === 'hahahahaha' && words(l.source).includes('hahahahaha')) return 'You typed every one! Let the robot repeat it: `"ha" * 5`.'
        if (text === 'hahahahaha') return 'The robot got there, but another way. Repeat just the one `"ha"`: `"ha" * 5`.'
        if (text !== null && /^(ha)+$/.test(text)) return `That's "ha" ${text.length / 2} times. Five, please: \`"ha" * 5\`.`
        if (errorType(l) === 'TypeError') return 'Repeat by a whole number, with no quotes on it: `"ha" * 5`.'
        if (errorType(l) === 'NameError') return '`ha` is a word, so it needs quotes: `"ha" * 5`.'
        return stopped(l, 'Type `"ha" * 5`.') ?? 'Repeat it with `*`: `"ha" * 5`.'
      },
    },
    {
      beats: [
        { say: 'Here\'s a secret: every character has a number, called its code.', show: { kind: 'codes', chars: 'ABC' } },
        { say: '`"A"` is 65, `"B"` is 66, and `"C"` is 67.' },
        { say: 'The robot tells you a character\'s code with `ord`, like this: `ord("A")`.', thought: '65' },
      ],
      say: 'What is the code for Mira\'s `"M"`?',
      ask: 'the code for "M"',
      tag: 'robot',
      show: { kind: 'letter', char: 'M' },
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '77' && /^ord(["'])M\1$/.test(bare(src(t)))),
      praise: '`77`: `ord` turns a character into its code, and a code is an `int`.',
      nudge: (l) => {
        const t = l.thought
        if (t?.repr === '77' && byHand(l, 77)) return 'Right! But let the robot look it up: `ord("M")`.'
        if (t?.repr === '77') return 'The robot got 77 another way. Ask it for Mira\'s letter itself: `ord("M")`.'
        if (t?.repr === '109') return 'That\'s a small `m`, which has its own code. Mira\'s is a capital: `ord("M")`.'
        if (errorType(l) === 'NameError') return 'The letter needs its quotes, or the robot takes it for a name: `ord("M")`.'
        if (errorType(l) === 'TypeError') return '`ord` takes one character, not a whole word: `ord("M")`.'
        if (t?.type === 'int') return `That's the code of another character. Ask for Mira's: \`ord("M")\`.`
        return stopped(l, 'Ask with `ord`: `ord("M")`.') ?? 'Ask with `ord`: `ord("M")`.'
      },
    },
    {
      beats: [
        { say: 'Another secret: to Python, `True` is a number too, and it counts as `1`.', show: { kind: 'lamps', on: 2 } },
        { say: 'So two lit lamps, added up, make `2`.' },
      ],
      say: 'What is `True + True + True`?',
      ask: 'three Trues, added up',
      tag: 'robot',
      // The sum, not lamps: the lamps picture adds up to its own count, so
      // it would draw the answer before it was given. The working (two
      // `True`s make `2`, and one more makes `3`) waits for the robot.
      show: { kind: 'expr', text: 'True + True + True', first: 'True + True', then: ['2 + True', '3'] },
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '3' && bare(src(t)) === 'True+True+True'),
      praise: '`3`, an `int`: each `True` counts as `1`, so adding them counts them.',
      nudge: (l) => {
        const t = l.thought
        const trues = /True/.test(l.source)
        if (t?.repr === '3' && !trues) return yours('True + True + True')
        if (t?.type === 'int' && trues && /\d/.test(l.source)) return 'That mixes a number in. Add up just the `True`s: `True + True + True`.'
        if (t?.repr === '3' && trues) return 'That\'s 3, but add up just three of them: `True + True + True`.'
        if (t?.type === 'int' && trues) return `That's ${t.repr} of them. Three lamps: \`True + True + True\`.`
        if (errorType(l) === 'NameError') return 'It needs a capital T: `True + True + True`.'
        return stopped(l, 'Type `True + True + True`.') ?? 'Add three of them: `True + True + True`.'
      },
    },
    {
      beats: [{ say: 'Here\'s a puzzle: which does the robot do first, the `+` or the `*`?', show: PUZZLE }],
      say: 'What is `2 + 3 * 4`?',
      ask: 'which goes first?',
      tag: 'robot',
      show: PUZZLE,
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '14' && bare(src(t)) === '2+3*4' && !/\(/.test(src(t))),
      praise: '`14`, not 20: `*` goes before `+`, the same as in maths.',
      nudge: (l) => {
        const t = l.thought
        if (/\(/.test(l.source)) return 'Brackets choose the order for the robot. Leave them off, and see what it does: `2 + 3 * 4`.'
        if (t?.repr === '20') return 'That\'s working left to right. Ask the robot, and see what it does: `2 + 3 * 4`.'
        if (t?.repr === '14' && byHand(l, 14)) return 'A good guess! Now check it with the robot: `2 + 3 * 4`.'
        if (t?.repr === '14') return 'The robot got 14, but ask it this one exactly: `2 + 3 * 4`.'
        return stopped(l, 'Ask the robot: `2 + 3 * 4`.') ?? 'Ask the robot: `2 + 3 * 4`.'
      },
    },
    {
      beats: [{ say: 'Brackets go first of all, so you can choose what the robot does first.' }],
      say: 'Make the robot add `2 + 3` first, then times it by `4`.',
      ask: 'add first',
      tag: 'robot',
      show: BRACKETS,
      done: (e) =>
        heard(e, (t) => t.type === 'int' && t.repr === '20' && /\([^)]*\+[^)]*\)/.test(src(t)) && TIMES.test(src(t)) && just(t, 2, 3, 4)),
      praise: '`20`: the brackets went first, so `2 + 3` was done before the `* 4`.',
      nudge: (l) => {
        const t = l.thought
        if (t?.repr === '14') return 'The `*` went first again. Put brackets round the part to do first: `(2 + 3) * 4`.'
        if (t?.repr === '20' && byHand(l, 20)) return yours('(2 + 3) * 4')
        if (t?.repr === '20' && /\(/.test(l.source)) return 'Those brackets hold no adding. Put them round the `2 + 3`: `(2 + 3) * 4`.'
        if (t?.repr === '20') return route('(2 + 3) * 4')
        if (errorType(l) === 'SyntaxError') return 'Every bracket that opens needs one that closes: `(2 + 3) * 4`.'
        return stopped(l, 'Type it with brackets: `(2 + 3) * 4`.') ?? 'Brackets round the adding: `(2 + 3) * 4`.'
      },
    },
  ],
  outro: [
    { say: 'Thanks, robot, that\'s just what I needed.', speaker: 'courier', act: [{ actor: 'courier', do: 'wave' }] },
    { say: 'Now the robot can make new values out of old ones.' },
    // The cloud empties as it is said: the thought was let go (invariant 8).
    { say: 'The robot worked out twenty, and then forgot it.', focus: 'memory', thought: '' },
    { say: 'Next, we\'ll help it remember.', thought: '' },
  ],
  takeaway: 'An operation makes a new value. Its type depends on the operation, and on what you give it.',
}
