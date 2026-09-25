/**
 * Level 1a, Meet the robot (`sandbox`): docs/PEDAGOGY.md §5.
 *
 * The robot's problem (R12): it is switched on, and it does nothing. So
 * the lesson is introductions, in the order a person would make them —
 * the crow, then the robot (asleep, then awake and still doing nothing),
 * then the player, who is the one with the instructions. The console is
 * pointed at, on the stage and on the screen, before anyone is asked to
 * type into it, and a demonstration thought (`7`) shows what will happen
 * before it happens (R1). None of that is checked: it is narration.
 *
 * The one question asks for a number, and any number does. What is being
 * learned is only that a line typed here becomes a thought over there, so
 * the praise names the thought, and says where it came from: the player
 * wrote it, or wrote something the robot worked it out from (`3 + 4`).
 * The likely misses are the ones a person makes who has never met a
 * programming language — a number word, a comma for the decimal point,
 * quotes round the digits — and each has its own reply.
 *
 * The close lets the thought go: the last beat clears the cloud (an empty
 * demonstration thought hides it), so the stage shows what the line says.
 * Level 4 pays that off, when the robot is given somewhere to keep things.
 *
 * This lesson doubles as the beat engine's demonstration
 * (`tests/browser/beats.spec.ts` plays it by shape, not by its words):
 * several beats before the ask, a demonstration thought, the robot asleep
 * and woken, a beat that points at the console, a step praise, closing
 * beats and a takeaway. It also has to finish on its one number, which is
 * why the script's second "another one" question is not a step here.
 */
import { bareWord, commaDecimal, stopped, type Heard, type Lesson, type Line } from './core'

const isNumber = (t: Heard) => t.type === 'int' || t.type === 'float'

function praise(a: Heard | null): string {
  if (!a) return 'It\'s thinking of your number!'
  // Worked out, not copied: `3 + 4` is thought of as `7`.
  if (a.source !== undefined && a.source.trim() !== a.repr) return `It's thinking of \`${a.repr}\`: it worked that out from what you wrote.`
  return `It's thinking of \`${a.repr}\`, because that's what you wrote.`
}

function nudge(l: Line): string | undefined {
  const word = bareWord(l)
  if (word) return `The robot doesn't know the word \`${word}\`. Try digits: \`7\`.`
  if (commaDecimal(l)) return 'Python writes the dot as a full stop: `1.5`.'
  const t = l.thought
  if (t?.type === 'str') return 'The quotes make that a word, not a number. Leave them off: `7`.'
  if (t?.type === 'bool') return `\`${t.repr}\` is a yes-or-no, not a number. Try digits: \`7\`.`
  return stopped(l, 'A number, in digits: `7`.')
}

export const meet: Lesson = {
  id: 'meet',
  teaches: [],
  ordered: true,
  steps: [
    {
      beats: [
        { say: 'Hello, I\'m {CROW_NAME}: a crow who knows a lot about robots.', act: [{ actor: 'crow', do: 'hop' }] },
        { say: 'And this is my friend, the robot.', act: [{ actor: 'robot', do: 'sleep' }] },
        { say: 'It\'s very clever, but on its own it does nothing at all.', act: [{ actor: 'robot', do: 'wake' }] },
        {
          say: 'It needs someone to give it instructions, and that\'s you.',
          focus: 'console',
          show: { kind: 'pointer', to: 'console', label: 'your instructions go here' },
        },
        { say: 'Type one on the right and press Enter, and the robot will think of it.', thought: '7' },
      ],
      say: 'Make the robot think of a number.',
      tag: 'you',
      done: (e) => e.thoughts.some(isNumber),
      praise,
      nudge,
    },
  ],
  outro: [
    { say: 'See? It thinks of whatever you write.' },
    // An empty thought hides the cloud for this beat: the thought is gone.
    { say: 'Then it lets the thought go, and waits for your next instruction.', thought: '' },
  ],
  takeaway: 'The robot does nothing until you give it an instruction. Then it thinks of whatever you write.',
}
