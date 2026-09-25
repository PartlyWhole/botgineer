import { points, worked, type Lesson } from './core'

/**
 * The first lesson where the robot is useful.
 *
 * Someone walks up, tells the robot two things, and comes back with a
 * question. Storing is no longer an exercise — it is the only reason the
 * robot can answer at all.
 *
 * The final question is deliberately not "what did I tell you?". Echoing
 * back a remembered `7` proves nothing; a player could type the digit from
 * their own memory of the conversation. It asks for the *weight*, which is
 * `parcels * 2` and was never said aloud, so the only way to produce 14 is
 * to use what the robot stored. That is also the more honest lesson: the
 * robot did not remember the answer, it remembered the facts.
 *
 * The names are prescribed here, unlike the earlier lessons, because the
 * scene watches them: the ticket shows whatever `customer` points at, so
 * the player sees storage do something in the world.
 */
export const takeAnOrder: Lesson = {
  id: 'take-an-order',
  teaches: ['bind', 'recall'],
  steps: [
    {
      speaker: 'courier',
      say: 'Afternoon! Mira again, with a delivery. Put me on the ticket, would you? `customer = "Mira"`',
      done: ({ snapshot }) => points(snapshot, 'customer', "'Mira'"),
    },
    {
      speaker: 'courier',
      say: 'Lovely. I\'ve brought seven parcels today — keep hold of that. `parcels = 7`',
      done: ({ snapshot }) => points(snapshot, 'parcels', '7'),
    },
    {
      speaker: 'courier',
      say: 'Each parcel weighs two kilos. So how much am I carrying? Work it out from what you kept.',
      // Never said aloud by anyone, so it can only come from the stored
      // count. Asked of the robot's answers, not of its memory: replying
      // to a question leaves nothing behind in memory to check.
      done: (e) => worked(e, '14'),
    },
  ],
  outro:
    'Fourteen kilos! It never stored that — it kept the seven and worked out the rest.',
}
