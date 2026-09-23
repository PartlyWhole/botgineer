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

export type Activity = {
  id: string
  title: string
  /** What the player is being asked to do, in one or two sentences. */
  brief: string
  scene: SceneSpec
  /**
   * How the player talks to the robot. `console` is one line at a time and
   * is where everyone starts; `editor` hands over a whole program and is
   * unlocked once there is a whole program worth writing.
   */
  mode: RobotMode
  /** Console only: what the robot says before the first prompt. */
  greeting?: string
  /** Console only: the guide's lesson, by id in `content/lessons`. */
  lesson?: string
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
  next: 'names',
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
  // Where the editor is unlocked: the next activity hands over a whole
  // program instead of a line at a time.
  next: 'wake',
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

const wakeTheRobot: Activity = {
  id: 'wake',
  title: 'Wake the Robot',
  mode: 'editor',
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
 * The starting point: a guided console session.
 *
 * No program, no Run button, no problem to solve — the player says one
 * thing to the robot, the robot thinks of it, and the crow keeps the
 * thread. Nothing is named, so nothing reaches memory: the value appears
 * in the robot's thought bubble and is collected when the line ends.
 * That memory stays empty here is the point, not an omission.
 */
const firstThoughts: Activity = {
  id: 'sandbox',
  title: 'Four Kinds of Thing',
  /** Kept as data, rendered nowhere: the starting point does not need to
   *  be introduced. Activities with something to solve will want it. */
  brief: 'The four basic kinds of value, thought of and let go.',
  mode: 'console',
  lesson: 'primitives',
  next: 'operations',
  greeting: 'Tell me something and I will think of it. One line at a time.',
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

/** The console lesson first: it is the starting point, and `ACTIVITIES[0]`
 *  is what the router opens with. The editor activities are reachable by
 *  hash but are not offered anywhere yet — they are what unlocking looks
 *  like, once there is a progression to unlock them from. */
export const ACTIVITIES: Activity[] = [
  firstThoughts,
  workingOut,
  namingThings,
  takeAnOrder,
  wakeTheRobot,
]

export const activityById = (id: string): Activity | null =>
  ACTIVITIES.find((a) => a.id === id) ?? null
