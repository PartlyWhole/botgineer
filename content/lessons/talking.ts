import { boolOf, textOf } from '../../src/scene/props'
import { boolMiss, digits, errorType, heard, was, wordsMiss, type Lesson } from './core'

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
