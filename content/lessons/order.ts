import { numberOf, type Prop } from '../../src/scene/props'
import { bareWord, errorType, heard, points, stopped, type Heard, type Lesson, type Line } from './core'

/**
 * Level 5, Taking an order: the first lesson where the robot is useful.
 *
 * Mira walks up, tells the robot two things, and asks a question (R12:
 * she needs something remembered and worked out; by the end the robot can
 * do that for a person). Storing is no longer an exercise — it is the
 * only reason the robot can answer at all.
 *
 * Mira speaks in her own words, because she is a person and speaks no
 * robot; the crow translates each fact into code, and the ask is the
 * crow's. That split is the lesson's other point: the player's job is to
 * turn what people say into instructions.
 *
 * The final question is deliberately not "what did I tell you?". Echoing
 * back a remembered `7` proves nothing; a player could type the digit from
 * their own memory of the conversation. It asks for the *weight*, which is
 * `parcels * 2` and was never said aloud — and the step checks the source
 * as `recall` does in practice: `parcels` must be in it, and a bare `7`
 * must not, so `7 * 2` and `14` both get a reply rather than a pass. That
 * is also the more honest lesson: the robot did not remember the answer,
 * it remembered the facts.
 *
 * The scale (R6) holds seven 2 kg parcels on the floor and `? kg` until
 * the robot works it out; then they drop onto it and it reads the answer,
 * amber if it is not seven twos. It stays for the outro (`finale`), with
 * the answer drawn in.
 *
 * The names are prescribed here, unlike the earlier lessons, because the
 * scene watches them: the ticket shows whatever `customer` points at, so
 * the player sees storage do something in the world.
 *
 * Step one has no praise on purpose: the ticket changing *is* the praise,
 * and Mira's first line of step two, which says so, is what the player
 * sees next.
 */
const SCALE: Prop = { kind: 'scale', parcels: 7, each: 2 }

/** A 7 standing on its own in the source, not as part of another number. */
const saysSeven = (source: string) => /(^|[^\w.])7(?![\w.])/.test(source)

/** Worked out from the name the robot kept, never from a typed seven. */
const fromParcels = (t: Heard): boolean =>
  numberOf(t) === 14 && (t.type === 'int' || t.type === 'float') && /\bparcels\b/.test(t.source ?? '') && !saysSeven(t.source ?? '')

/** `name == value`, or the value alone: said, not kept. */
function keepMiss(l: Line, want: string): string | undefined {
  if (/^\s*\w+\s*==/.test(l.source)) return `Two \`==\` asks a question. One \`=\` keeps it: \`${want}\`.`
  if (l.ok && l.thought) return `The robot thought of \`${l.thought.repr}\` and let it go. Keep it under a name: \`${want}\`.`
  return undefined
}

export const takeAnOrder: Lesson = {
  id: 'take-an-order',
  teaches: ['bind', 'recall'],
  finale: SCALE,
  steps: [
    {
      beats: [
        { speaker: 'courier', say: 'Afternoon! Mira again, with a delivery. Can you put me on the ticket?', act: [{ actor: 'courier', do: 'wave' }] },
        { say: 'Mira talks like a person. We have to tell the robot in code.' },
        { say: 'The ticket up there shows whatever the name `customer` points at.' },
      ],
      say: 'Keep her name: type `customer = "Mira"`.',
      tag: 'you',
      done: ({ snapshot }) => points(snapshot, 'customer', "'Mira'"),
      nudge: (l) => {
        if (errorType(l) === 'NameError' && /=\s*Mira\s*$/.test(l.source)) {
          return 'Without quotes, the robot thinks `Mira` is a name it should know. Her name is words: `"Mira"`.'
        }
        if (l.ok && !l.thought && !/^\s*customer\s*=/.test(l.source)) return 'The ticket reads `customer`, all small letters: `customer = "Mira"`.'
        if (l.ok && !l.thought) return 'The ticket shows exactly what you kept. Her name is `"Mira"`, capital M.'
        return keepMiss(l, 'customer = "Mira"') ?? stopped(l, 'Type `customer = "Mira"`.')
      },
    },
    {
      beats: [
        { speaker: 'courier', say: 'That\'s me! Now, I\'ve brought seven parcels today.' },
        { say: 'The ticket changed because `customer` points at her name now.' },
        { say: 'Seven parcels is a count, so it\'s a number. In code: `parcels = 7`.' },
      ],
      say: 'Keep the count: type `parcels = 7`.',
      tag: 'you',
      done: ({ snapshot }) => points(snapshot, 'parcels', '7'),
      nudge: (l) => {
        if (/^\s*parcels\s*=\s*["']/.test(l.source) && l.ok) return 'Quotes make that a word. A count is a number, no quotes: `parcels = 7`.'
        if (/^\s*parcel\s*=/.test(l.source)) return 'Nearly: the name is `parcels`, with an s.'
        if (/^\s*parcels\s*=/.test(l.source) && l.ok) return 'She said seven parcels: `parcels = 7`.'
        return keepMiss(l, 'parcels = 7') ?? stopped(l, 'Type `parcels = 7`.')
      },
    },
    {
      beats: [
        { speaker: 'courier', say: 'Each parcel weighs two kilos.', show: SCALE },
        { speaker: 'courier', say: 'So how much am I carrying, all together?' },
        { say: 'Nobody said that number. But the robot kept the count.' },
        { say: 'Don\'t type the seven. Let the robot work it out from `parcels`.' },
      ],
      say: 'Work out the weight from `parcels`.',
      ask: '7 parcels of 2 kg. How many kg?',
      show: SCALE,
      tag: 'robot',
      done: (e) => heard(e, fromParcels),
      nudge: (l) => {
        const t = l.thought
        const n = numberOf(t)
        if (bareWord(l) === 'parcel' || /\bparcel\b/.test(l.source)) return 'Nearly: the name is `parcels`, with an s.'
        if (n === 14 && saysSeven(l.source)) return 'Right weight, but that\'s the seven you remember. Use the name the robot kept: `parcels`.'
        if (n === 14) return 'Right, but that\'s your sum. Let the robot work it out from `parcels`.'
        if (n === 7) return 'That\'s the count: seven parcels. Each weighs two kilos, so it\'s times: `*`.'
        if (n === 9) return 'That\'s two more parcels. Each one weighs two: times, `*`.'
        if (n !== null) return `That comes to ${t!.repr} kg. Seven parcels of two kilos each is times: \`*\`.`
        return stopped(l, 'Use `parcels`, and `*`.')
      },
    },
  ],
  outro: [
    { say: 'Fourteen kilos, because it took the seven it kept and doubled it.' },
    { speaker: 'courier', say: 'Fourteen kilos! Thank you, robot.', act: [{ actor: 'courier', do: 'wave' }] },
    { say: 'It never kept fourteen. It kept what she told it, and worked the rest out.' },
  ],
  takeaway: 'Keep the facts under names, and the robot can work out answers nobody said.',
}
