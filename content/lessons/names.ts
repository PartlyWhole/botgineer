import type { Prop } from '../../src/scene/props'
import { bareWord, errorType, ever, heard, points, sameObject, stopped, type Lesson, type Line } from './core'

/**
 * Level 4, Names: keeping one, and what a name actually is.
 *
 * It opens on the robot's problem (R12), and makes the player feel it
 * rather than hear about it: the crow asks what the seven crates of six
 * came to — the first question of the last level, on the same picture —
 * and the robot cannot say, so the player has to make it work the sum out
 * all over again. The `?` in its cloud is a demonstration; the `42` that
 * follows is real, and that step checks the source, so typing `42` from
 * memory gets a reply instead of a pass.
 *
 * Then a name is the fix, met as the answer to a problem just had rather
 * than as syntax. The picture for everything after that is the memory
 * graph itself (R6): each beat that follows something new appearing there
 * points at it (focus `memory`), in the words the screen draws — an arrow
 * from the name to its object. The metaphor is the arrow throughout,
 * because that is what the player can see; Stage 1's markdown says the
 * same in one bridging sentence.
 *
 * "Ask for it back" must be answered *with the name*. `worked(e, '10')`
 * alone passed on a typed `10`, which is exactly the thing the step exists
 * to rule out: the source of the thought has to be `x`.
 *
 * The second half prevents the misconception that `x = 10` puts a 10
 * *inside* `x`. If that were true, `y = x` would copy it and rebinding
 * `x` would leave `y` alone by luck rather than by rule — so the lesson
 * ends by moving `x` and looking at `y` (R7: two names, differing in one
 * move).
 *
 * Every object here is a small int, which CPython caches, so two
 * separately typed `10`s really are one object and the memory view says
 * so. That is why the aliasing step asks for `y = x` and never `y = 10`:
 * the second looks identical on screen while teaching something untrue of
 * objects in general. (It still passes, because memory cannot tell them
 * apart and CPython agrees: the praise says nothing that `y = 10` would
 * make false.)
 */
const CRATES: Prop = { kind: 'crates', crates: 7, each: 6 }

/** Only the name, on its own: `x`, perhaps in brackets. */
const justX = (source: string | undefined) => /^\(?\s*x\s*\)?$/.test((source ?? '').trim())

/** `x == 10` and friends: two signs, where one gives a name. */
const doubled = (l: Line) => /^\s*\w+\s*==/.test(l.source)

/** The usual misses on a line that should give something a name. */
function namingMiss(l: Line, want: string): string | undefined {
  if (doubled(l)) return `Two \`==\` asks a question. One \`=\` gives a name: \`${want}\`.`
  if (errorType(l) === 'SyntaxError' && /^\s*\d/.test(l.source)) return `The name goes first, then the value: \`${want}\`.`
  if (l.ok && l.thought) return `The robot thought of \`${l.thought.repr}\` and let it go. Give it a name: \`${want}\`.`
  return undefined
}

export const namesPoint: Lesson = {
  id: 'names-point',
  teaches: ['bind', 'alias', 'rebind'],
  steps: [
    {
      beats: [
        { say: 'Remember the seven crates of six bolts? How many bolts was that?', show: CRATES },
        { say: 'The robot has no idea. It let that thought go the moment it finished.', thought: '?' },
        { say: 'To tell you, it has to do the whole sum again.' },
      ],
      say: 'Ask the robot again: `7 * 6`.',
      ask: 'How many bolts? 7 crates of 6.',
      show: CRATES,
      tag: 'robot',
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '42' && /\*/.test(t.source ?? '')),
      praise: 'Forty-two, worked out from scratch, because it kept nothing from last time.',
      nudge: (l) => {
        const t = l.thought
        if (t?.repr === '42') return 'That\'s you remembering. The robot has to work it out: `7 * 6`.'
        if (t?.repr === '13') return 'That\'s `7 + 6`. Seven crates *of* six is times: `7 * 6`.'
        if (l.ok && !l.thought) return 'Crates first. Ask the robot for the bolts: `7 * 6`.'
        if (t?.type === 'int') return `That comes to ${t.repr}. Seven crates of six: \`7 * 6\`.`
        return stopped(l, 'Type `7 * 6`.')
      },
    },
    {
      beats: [
        { say: 'Here\'s the fix: give a value a name, and the robot keeps it.' },
        { say: 'You write the name, then `=`, then the value.' },
        { say: 'One `=` gives a name. Two, `==`, asks a question, which is something else.' },
      ],
      say: 'Give `10` the name `x`: type `x = 10`.',
      tag: 'you',
      // `ever`, not `snapshot`: the last step of this lesson moves `x`,
      // which would otherwise un-answer this one.
      done: (e) => ever(e, (s) => points(s, 'x', '10')),
      praise: 'Kept, because now it has a name.',
      nudge: (l) => {
        if (/^\s*X\s*=/.test(l.source)) return 'Names care about capitals. This one is a small `x`.'
        if (l.ok && !l.thought && /^\s*x\s*=/.test(l.source)) return 'That points `x` at something else. Point it at `10`: `x = 10`.'
        return namingMiss(l, 'x = 10') ?? stopped(l, 'Type `x = 10`.')
      },
    },
    {
      beats: [
        { say: 'Look below: there\'s `x`, and an arrow to `10`.', focus: 'memory' },
        { say: 'That arrow is what a name is. It points at an object.' },
        { say: 'So the robot needn\'t work anything out. It can follow the arrow.' },
        { say: 'Don\'t type `10` yourself. Ask with the name, and let the robot look.' },
      ],
      say: 'Ask for it back: type just `x`.',
      tag: 'robot',
      // The thought must have come *from the name*. A typed `10` makes the
      // same thought, and is the very answer this step forbids.
      done: (e) => heard(e, (t) => t.type === 'int' && t.repr === '10' && justX(t.source)),
      praise: 'It didn\'t work anything out: it followed the arrow from `x` to `10`.',
      nudge: (l) => {
        const t = l.thought
        if (t?.repr === '10') return 'That\'s you remembering `10`. Ask the robot with the name: `x`.'
        if (bareWord(l) === 'X') return 'Names care about capitals. This one is a small `x`.'
        if (t && /\bx\b/.test(l.source)) return `That worked out \`${t.repr}\` from \`x\`. Just the name, on its own: \`x\`.`
        if (l.ok && !t) return 'That line kept something. To ask, type the name on its own: `x`.'
        return stopped(l, 'Type just `x`.')
      },
    },
    {
      beats: [
        { say: 'Now a second name, pointing at the same object.' },
        { say: '`y = x` means: point `y` at whatever `x` points at.' },
      ],
      say: 'Point `y` where `x` points: type `y = x`.',
      tag: 'you',
      done: (e) => ever(e, (s) => sameObject(s, 'x', 'y')),
      nudge: (l) => {
        if (errorType(l) === 'NameError' && /^\s*x\s*=\s*y\s*$/.test(l.source)) {
          return 'That way round points `x` at `y`, which doesn\'t exist yet. The new name goes first: `y = x`.'
        }
        return namingMiss(l, 'y = x') ?? stopped(l, 'Type `y = x`.')
      },
    },
    {
      beats: [
        { say: 'Look below: two names, two arrows, and still only one `10`.', focus: 'memory' },
        { say: 'So what if `x` points somewhere else? Does `y` go with it?' },
      ],
      say: 'Point `x` at `99`, and watch `y`.',
      tag: 'you',
      done: ({ snapshot }) => points(snapshot, 'x', '99') && points(snapshot, 'y', '10'),
      nudge: (l) => {
        if (/^\s*y\s*=/.test(l.source) && l.ok) return 'That moved `y`. This time, move `x`: `x = 99`.'
        return namingMiss(l, 'x = 99') ?? stopped(l, 'Type `x = 99`.')
      },
    },
  ],
  outro: [
    { say: 'Look below: `x`\'s arrow moved to `99`, and `y` still points at `10`.', focus: 'memory' },
    { say: 'Moving an arrow never changes the object it pointed at.' },
    { say: 'And now the robot can keep things, under names, for as long as you need.' },
  ],
  takeaway: 'A name is an arrow to an object. Moving the arrow never changes the object.',
}

