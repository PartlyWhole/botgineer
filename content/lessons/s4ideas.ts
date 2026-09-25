import type { Lesson } from './core'

/**
 * Stage 4, the ideas. PLACEHOLDER: to be written as a console lesson in
 * beats, like s1ideas.ts, from content/collection/stage-04-*.md.
 */
export const s4Ideas: Lesson = {
  id: 's4-ideas',
  teaches: [],
  steps: [
    {
      beats: [{ say: 'Stage 4: the ideas are on their way.' }],
      say: 'Type anything to go on.',
      tag: 'you',
      done: (e) => e.thoughts.length > 0 || e.history.length > 1,
    },
  ],
  outro: 'The exercises are next.',
  takeaway: 'Stage 4.',
}
