/**
 * PLACEHOLDER — Level 1a, Meet the robot (`sandbox`). Workstream C1
 * replaces this with the script in docs/PEDAGOGY.md §5.
 *
 * Minimal but real, because it is also the engine's own demonstration:
 * a few beats before the ask (a hop, the robot asleep and woken, the
 * console pointed at, a demonstration thought), a praise that names the
 * answer, closing beats and a takeaway. The browser journey for beats
 * (`tests/browser/beats.spec.ts`) plays it without reading its words, so
 * rewriting the words breaks nothing there.
 */
import { bareWord, commaDecimal, heard, stopped, type Lesson } from './core'

export const meet: Lesson = {
  id: 'meet',
  teaches: [],
  ordered: true,
  steps: [
    {
      beats: [
        { say: 'Hello! I\'m {CROW_NAME}. I\'m a crow, and I know a lot about robots.', act: [{ actor: 'crow', do: 'hop' }] },
        { say: 'And this is my friend, the robot.', act: [{ actor: 'robot', do: 'sleep' }] },
        { say: 'It\'s very clever. But on its own, it does nothing at all.', act: [{ actor: 'robot', do: 'wake' }] },
        { say: 'It needs someone to give it instructions. That\'s you.', focus: 'console' },
        { say: 'Write an instruction on the right and press Enter. The robot will think of it.', thought: '7' },
      ],
      say: 'Try it. Make the robot think of a number.',
      tag: 'you',
      done: (e) => heard(e, (t) => t.type === 'int' || t.type === 'float'),
      praise: (a) => (a ? `It's thinking of \`${a.repr}\`!` : 'It\'s thinking of it!'),
      nudge: (l) => {
        const word = bareWord(l)
        if (word) return `The robot doesn't know the word \`${word}\`. Try digits: \`7\`.`
        if (commaDecimal(l)) return 'Python writes the dot as a full stop: `1.5`.'
        return stopped(l, 'A number, in digits: `7`.')
      },
    },
  ],
  outro: [
    { say: 'See? It thinks of whatever you write.' },
    { say: 'Then it lets the thought go.' },
  ],
  takeaway: 'The robot does nothing until you give it an instruction — and it thinks of whatever you write.',
}
