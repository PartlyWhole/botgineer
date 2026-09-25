/**
 * PLACEHOLDER — Level 1b, Five data types (`types`). Workstream C1
 * replaces this with the script in docs/PEDAGOGY.md §5.
 *
 * One step, so the level is playable and finishable while the real one
 * is written. It teaches the kinds the old `kinds` and `talking` lessons
 * taught, because practice needs every warm-up skill to be taught by a
 * registered lesson. Mira is in this scene, off stage until the outro's
 * `enter` brings her on.
 */
import { boolMiss, heard, was, type Lesson } from './core'

export const types: Lesson = {
  id: 'types',
  teaches: ['bool', 'int', 'float', 'str', 'kind'],
  ordered: true,
  steps: [
    {
      say: 'Turn the lamp on.',
      ask: 'Turn the lamp on.',
      show: { kind: 'lamp' },
      tag: 'you',
      done: (e) => heard(e, was('bool', 'True')),
      nudge: boolMiss,
    },
  ],
  outro: [
    {
      say: 'Here\'s Mira. Mira is a person.',
      act: [
        { actor: 'courier', do: 'enter' },
        { actor: 'courier', do: 'wave' },
      ],
    },
  ],
  takeaway: 'There are five basic data types — bool, int, float, char and str — and everything else is built from them.',
}
