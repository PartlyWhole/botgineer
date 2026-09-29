/**
 * v2, Level 1: Meet the robot (`v2-meet`).
 *
 * Version 2 opens on a demonstration before anything is asked (R1, show
 * first): the crow types instructions into the console itself, one
 * character at a time, and each time the robot thinks of what was
 * typed. By the time the console opens, the player has watched the whole
 * loop — a line goes in, a thought comes out — twice, with two different
 * numbers, so what is being shown is "whatever you type", not "7".
 *
 * The demonstrations are beats (`types`), so they are narration: never
 * run, never evidence. A typed line stays in the console for the beats
 * after it, until the next demonstration or the question. The one question is
 * v1's (any number does), with v1's praise and replies to a miss, until
 * v2's own follow.
 */
import { isNumber, nudge, praise } from '../meet'
import type { Lesson } from '../core'

export const v2meet: Lesson = {
  id: 'v2-meet',
  teaches: [],
  ordered: true,
  pictureAtAsk: true,
  steps: [
    {
      beats: [
        { say: 'Hello! I\'m {CROW_NAME}, and this is my friend, the robot.', act: [{ actor: 'crow', do: 'hop' }] },
        { say: 'It thinks of whatever it\'s told. Watch: I\'ll tell it a number.', focus: 'console' },
        { say: 'I type `7`, and press Enter.', types: '7', thought: '7' },
        { say: 'It\'s thinking of `7`, because that\'s what I typed.', thought: '7' },
        { say: 'Now another: `42`.', types: '42', thought: '42' },
        { say: 'Whatever goes in, it thinks of.', thought: '42' },
      ],
      say: 'Your turn: make the robot think of a number.',
      tag: 'you',
      done: (e) => e.thoughts.some(isNumber),
      praise,
      nudge,
    },
  ],
  outro: [{ say: 'That\'s all it takes: you write it, and the robot thinks of it.' }],
  takeaway: 'The robot thinks of whatever you type, one instruction at a time.',
}
