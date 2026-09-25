/**
 * PLACEHOLDER — Level 1c, Choose the type (`choose`). Workstream C1
 * replaces this with the script in docs/PEDAGOGY.md §5.
 *
 * One question, no hint about the type — which is the whole of the level
 * in miniature. Mira stands in this scene too; with no `enter` in the
 * lesson she is on stage from the start.
 */
import { boolMiss, heard, was, type Lesson } from './core'

export const choose: Lesson = {
  id: 'choose',
  teaches: ['kind'],
  ordered: true,
  steps: [
    {
      say: 'Is a fish a bird?',
      ask: 'Is a fish a bird?',
      show: { kind: 'fish' },
      tag: 'you',
      done: (e) => heard(e, was('bool', 'False')),
      praise: 'Yes or no, so a `bool`.',
      nudge: (l) => (l.thought?.repr === 'True' ? 'A bird? Then where are its feathers? Look again.' : boolMiss(l)),
    },
  ],
  outro: 'Every answer you gave had a data type. And you picked the right one.',
  takeaway: 'Every value has a data type, and the question you are answering decides which one.',
}
