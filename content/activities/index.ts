/**
 * The activities. Each brings its own scene; nothing assumes a continuous
 * world between them.
 *
 * An activity is content, not code: a scene, a brief, and a starting
 * point. What the player does is change memory, and the scene is a view of
 * memory, so there is no separate "game logic" anywhere.
 */
import type { SceneSpec } from '../../src/scene/spec'
import type { RobotMode } from '../../src/panels/RobotPanel'
import { readingActivities, reviewActivity, singleActivity, type ReadLevel } from './reading'

export type Activity = {
  id: string
  title: string
  /** What the player is being asked to do, in one or two sentences. */
  brief: string
  scene: SceneSpec
  /**
   * How the player talks to the robot. `console` is one line at a time and
   * is where everyone starts; `editor` hands over a whole program and is
   * unlocked once there is a whole program worth writing; `read` is the
   * Reading Python collection, where the player says what a program will
   * do before the robot runs it.
   */
  mode: RobotMode
  /** Read only: which part of the collection this level plays. */
  read?: ReadLevel
  /** Console only: what the robot says before the first prompt. */
  greeting?: string
  /** Console only: the guide's lesson, by id in `content/lessons`. */
  lesson?: string
  /** Console only: a practice session instead of a lesson — generated
   *  exercises on the skills of this roadmap unit. */
  practice?: { unit: string }
  /** The level after this one. Play order only — finishing returns to the
   *  map, which is where the order is shown — and it must agree with
   *  `content/roadmap` (there is a test). */
  next?: string
  /** Editor only: what sits in the editor when the activity opens. */
  starter: string
  /** Budget for one run of this activity's session. */
  options: { max_steps: number; wall_clock_s: number }
}

/* ---------------------------------------------------------------- */

/**
 * The second lesson: working things out.
 *
 * Same room, same empty memory. The robot computes and reports, and the
 * lesson ends on the fact that the answer went nowhere — which is the
 * itch the naming lesson scratches. That ordering is the whole reason
 * this activity exists between them.
 */
const workingOut: Activity = {
  id: 'operations',
  title: 'Working Things Out',
  brief: 'Arithmetic, comparisons and joining words — none of it kept.',
  mode: 'console',
  lesson: 'operations',
  next: 'practice-thinking',
  greeting: 'Give me something to work out.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: {
    id: 'workshop',
    title: 'Workshop',
    floor: { at: 78 },
    actors: [
      { id: 'crow', kind: 'crow', x: 32, y: 0, w: 17, stand: true },
      { id: 'robot', kind: 'robot', x: 66, y: 0, w: 24, stand: true },
    ],
    watches: [],
  },
}

/**
 * The third lesson: names.
 *
 * A fresh session on purpose. Starting from an empty memory is what makes
 * the first binding legible — one name, one arrow, one object — where
 * continuing from the first lesson's four loose objects would open on a
 * field that already looks busy.
 */
const namingThings: Activity = {
  id: 'names',
  title: 'Names',
  brief: 'A name does not hold an object. It points at one.',
  mode: 'console',
  lesson: 'names-point',
  next: 'order',
  greeting: 'Still nothing kept. Let us fix that.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: {
    id: 'workshop',
    title: 'Workshop',
    // The bench is gone: it was a floating pill that nobody stood on.
    // The floor is the thing they stand on now.
    floor: { at: 78 },
    actors: [
      { id: 'crow', kind: 'crow', x: 32, y: 0, w: 17, stand: true },
      { id: 'robot', kind: 'robot', x: 66, y: 0, w: 24, stand: true },
    ],
    watches: [],
  },
}

/**
 * The third lesson: the robot earns its keep.
 *
 * A courier arrives, tells the robot two things and comes back with a
 * question. This is the loop the whole game is built on — someone speaks,
 * the player programs the robot to keep what matters, and the robot
 * answers from what it kept.
 *
 * It is also the first scene that *reacts*: the ticket watches `customer`,
 * so storing a name puts it on the board. That is why this lesson
 * prescribes its names where the earlier ones did not.
 */
const takeAnOrder: Activity = {
  id: 'order',
  title: 'Taking an Order',
  brief: 'A courier tells the robot two things, then asks it a question.',
  mode: 'console',
  lesson: 'take-an-order',
  next: 'practice-remembering',
  greeting: 'Someone is coming. Keep whatever she tells you — she will want it back.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: {
    id: 'counter',
    title: 'The counter',
    floor: { at: 82 },
    actors: [
      { id: 'crow', kind: 'crow', x: 13, y: 0, w: 13, stand: true },
      { id: 'robot', kind: 'robot', x: 38, y: 0, w: 23, stand: true },
      { id: 'courier', kind: 'courier', x: 72, y: 0, w: 21, stand: true },
      // A board over the counter, not a plaque on the floor: it is the
      // one thing here that is genuinely mounted rather than standing,
      // and putting it at the robot's feet had it overlapping them.
      //
      // High, and between the robot and the courier rather than over the
      // robot's head: everything just above the cast is the speech band,
      // and directly over the robot is where its thought goes. There, the
      // `14` cloud sat on the ticket in any wide stage, and the ticket is
      // the lesson's evidence. Measured clear of every bubble and face at
      // the default shapes and the stacked layout down to 900px wide.
      { id: 'ticket', kind: 'sign', x: 62, y: 9, w: 26, label: 'no customer' },
    ],
    watches: [
      {
        name: 'customer',
        effect: { kind: 'caption', actor: 'ticket' },
        hint: 'the ticket is waiting for `customer`',
      },
    ],
  },
}

/**
 * Stage 1's first "write a small program": the editor is unlocked here,
 * after the ideas, and the sets come after it.
 */
const wakeTheRobot: Activity = {
  id: 'wake',
  title: 'Wake the Robot',
  mode: 'editor',
  next: 's1-set-1',
  brief:
    'The robot is asleep. It reads three things out of its own memory: whether it has power, what it should call itself, and how charged it is. Give those names values.',
  starter: '# Give the robot what it needs.\n# power, name, charge\n\n',
  options: { max_steps: 2000, wall_clock_s: 15 },
  scene: {
    id: 'bay',
    title: 'Charging bay',
    floor: { at: 80 },
    actors: [
      { id: 'robot', kind: 'robot', x: 50, y: 0, w: 27, stand: true },
      // Fixtures, not cast: a lamp and a gauge are mounted on the wall
      // and a nameplate hangs above the bay. None of them stands.
      { id: 'lamp', kind: 'lamp', x: 78, y: 20, w: 9 },
      { id: 'battery', kind: 'gauge', x: 20, y: 26, w: 17 },
      { id: 'nameplate', kind: 'sign', x: 50, y: 14, w: 38, label: 'unnamed' },
    ],
    watches: [
      {
        name: 'power',
        effect: { kind: 'lit', actor: 'lamp' },
        hint: 'the lamp is waiting for `power`',
      },
      {
        name: 'name',
        effect: { kind: 'caption', actor: 'nameplate' },
        hint: 'the nameplate is waiting for `name`',
      },
      {
        name: 'charge',
        effect: { kind: 'level', actor: 'battery', max: 100 },
        hint: 'the battery is waiting for `charge` (0 to 100)',
      },
    ],
  },
}

/**
 * The starting point: yes, how many, how much.
 *
 * No program, no Run button: the crow asks about a situation on the
 * stage, the player answers in one line, and the answer is drawn into the
 * picture — `True` lights the lamp, `-1` sends the lift down. Nothing is
 * named, so nothing reaches memory; that memory stays empty here is the
 * point, not an omission.
 *
 * The cast stands at the edges so the question's picture can stand
 * between them (`scene.props`), no taller than the robot, which keeps it
 * under the speech band.
 */
const firstThoughts: Activity = {
  id: 'sandbox',
  title: 'Yes, How Many, How Much',
  /** Kept as data, rendered nowhere: the starting point does not need to
   *  be introduced. Activities with something to solve will want it. */
  brief: 'True and False, counting numbers and measurements: which kind of value answers which kind of question.',
  mode: 'console',
  lesson: 'kinds',
  next: 'words',
  greeting: 'Type an answer and press Enter. I will think of it.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: {
    id: 'workshop',
    title: 'Workshop',
    floor: { at: 76 },
    actors: [
      { id: 'crow', kind: 'crow', x: 15, y: 0, w: 16, stand: true },
      { id: 'robot', kind: 'robot', x: 84, y: 0, w: 22, stand: true },
    ],
    props: { x: 49.5, w: 42 },
    watches: [],
  },
}

/**
 * Talking to humans: text.
 *
 * Mira is a person, so words have someone to be for. The robot stands
 * between the crow and her, and what it says to her appears between the
 * robot and her — on a card, a phone, a note on a door.
 */
const talkingToHumans: Activity = {
  id: 'words',
  title: 'Talking to Humans',
  brief: 'Text is for people: words in quotes, and why a phone number is text, not a number.',
  mode: 'console',
  lesson: 'talking',
  next: 'operations',
  greeting: 'I think in True, 12 and 0.5. Mira thinks in words.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: {
    id: 'porch',
    title: 'The porch',
    floor: { at: 76 },
    actors: [
      { id: 'crow', kind: 'crow', x: 9, y: 0, w: 16, stand: true },
      { id: 'robot', kind: 'robot', x: 30, y: 0, w: 17, stand: true },
      { id: 'courier', kind: 'courier', x: 88.5, y: 0, w: 17, stand: true },
    ],
    props: { x: 59, w: 34 },
    watches: [],
  },
}

/**
 * Practice: generated exercises on what a unit taught, after its lessons.
 *
 * The same workshop and cast, because practice is more of the same world
 * rather than a quiz bolted on beside it. What the crow asks comes from
 * `src/practice`; what these define is only where, and on which skills.
 */
const practiceScene = (id: string): SceneSpec => ({
  id,
  title: 'Practice yard',
  floor: { at: 78 },
  actors: [
    { id: 'crow', kind: 'crow', x: 32, y: 0, w: 17, stand: true },
    { id: 'robot', kind: 'robot', x: 66, y: 0, w: 24, stand: true },
  ],
  watches: [],
})

const practiceThinking: Activity = {
  id: 'practice-thinking',
  title: 'Practice: Thinking',
  brief: 'Fresh questions on values and working things out, weighted towards what you know least.',
  mode: 'console',
  practice: { unit: 'thinking' },
  next: 'names',
  greeting: 'Practice time. Every question is new.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: practiceScene('practice-thinking'),
}

const practiceRemembering: Activity = {
  id: 'practice-remembering',
  title: 'Practice: Remembering',
  brief: 'Fresh questions on names: keeping things, sharing them and moving them.',
  mode: 'console',
  practice: { unit: 'stage-1' },
  next: 's1-ideas',
  greeting: 'Practice time. Watch the arrows.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: practiceScene('practice-remembering'),
}

/** The console lesson first: it is the starting point, and `ACTIVITIES[0]`
 *  is what the router opens with. The editor activities are reachable by
 *  hash but are not offered anywhere yet — they are what unlocking looks
 *  like, once there is a progression to unlock them from. */
export const ACTIVITIES: Activity[] = [
  firstThoughts,
  talkingToHumans,
  workingOut,
  practiceThinking,
  namingThings,
  takeAnOrder,
  practiceRemembering,
  wakeTheRobot,
  ...readingActivities(),
]

/** A level by id: one on the path, or one made on demand — a stage's
 *  review (`s2-review`) or a single item (`x-4.6`). */
export function activityById(id: string): Activity | null {
  const found = ACTIVITIES.find((a) => a.id === id)
  if (found) return found
  const review = /^s(\d)-review$/.exec(id)
  if (review) return reviewActivity(Number(review[1]))
  if (id.startsWith('x-')) return singleActivity(id.slice(2))
  return null
}
