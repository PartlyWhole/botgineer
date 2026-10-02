/**
 * v2, Level 1: Meet the robot (`v2-meet`).
 *
 * The robot's problem (R12): on its own it does nothing; it needs someone
 * to tell it what to do, and that is the player. It is asleep until the
 * crow says so, and wakes as the line names the player's part.
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
 * after it, until the question. The one question is
 * v1's (any number does), with v1's praise and replies to a miss, none of
 * which hands back the crow's own `7`. It closes by naming the word the
 * later lessons rely on, *instruction*, and by letting the thought go,
 * pointing at the memory it never reached: Lesson 4 opens on "Every
 * thought so far, the robot let go." (docs/reviews/v2-meet.md)
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
        { say: 'Hello! I\'m {CROW_NAME}, and this is my friend, the robot.', act: [{ actor: 'crow', do: 'hop' }, { actor: 'robot', do: 'sleep' }] },
        { say: 'On its own, it does nothing at all. It needs someone to tell it what to do, and that\'s you.', act: [{ actor: 'robot', do: 'wake' }], focus: 'console' },
        { say: 'Watch me first. I type `7`, and press Enter.', types: '7', thought: '7' },
        { say: 'It\'s thinking of `7`, because that\'s what I typed.', thought: '7' },
        { say: 'Now another: `42`.', types: '42', thought: '42' },
        { say: 'A new number in, a new thought.', thought: '42' },
      ],
      say: 'Your turn: make the robot think of a number, any one you like.',
      tag: 'you',
      done: (e) => e.thoughts.some(isNumber),
      praise,
      nudge,
      model: '7',
    },
  ],
  outro: [
    { say: 'That\'s all it takes. Each line you type is an *instruction*, and the robot carries it out.' },
    // Lesson 4 opens on this: "Every thought so far, the robot let go."
    { say: 'Then it lets the thought go. Nothing stays in its memory, yet.', thought: '', focus: 'memory' },
  ],
  takeaway: 'The robot does nothing until you tell it. Each instruction you type, it thinks of, then lets go.',
}
