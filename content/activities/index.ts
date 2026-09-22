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
  /** Editor only: what sits in the editor when the activity opens. */
  starter: string
  /** Budget for one run of this activity's session. */
  options: { max_steps: number; wall_clock_s: number }
}

/* ---------------------------------------------------------------- */

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
    actors: [
      { id: 'plinth', kind: 'plinth', x: 50, y: 74, w: 42 },
      { id: 'robot', kind: 'robot', x: 50, y: 44, w: 26 },
      { id: 'lamp', kind: 'lamp', x: 76, y: 22, w: 9 },
      { id: 'nameplate', kind: 'sign', x: 50, y: 88, w: 40, label: 'unnamed' },
      { id: 'battery', kind: 'gauge', x: 22, y: 22, w: 18 },
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

const parcelBelt: Activity = {
  id: 'belt',
  title: 'The Parcel Belt',
  mode: 'editor',
  brief:
    'Five parcels are on the belt. The robot lifts whichever ones you put in a list called `heavy`. Anything over 5 kilos is too heavy for the belt.',
  starter: `parcels = [("A7", 3.2), ("B1", 7.4), ("C2", 1.1), ("D3", 9.8), ("E5", 5.0)]

heavy = []
for parcel in parcels:
    pass
`,
  options: { max_steps: 2000, wall_clock_s: 15 },
  scene: {
    id: 'depot',
    title: 'Depot belt',
    actors: [
      { id: 'robot', kind: 'robot', x: 12, y: 40, w: 20 },
      { id: 'A7', kind: 'crate', x: 34, y: 66, w: 12, label: 'A7', group: 'parcels' },
      { id: 'B1', kind: 'crate', x: 48, y: 66, w: 12, label: 'B1', group: 'parcels' },
      { id: 'C2', kind: 'crate', x: 62, y: 66, w: 12, label: 'C2', group: 'parcels' },
      { id: 'D3', kind: 'crate', x: 76, y: 66, w: 12, label: 'D3', group: 'parcels' },
      { id: 'E5', kind: 'crate', x: 90, y: 66, w: 12, label: 'E5', group: 'parcels' },
    ],
    watches: [
      {
        name: 'heavy',
        effect: { kind: 'pick', group: 'parcels' },
        hint: 'the robot is waiting for a list called `heavy`',
      },
    ],
  },
}

/**
 * The starting point: a guided console session.
 *
 * No program, no Run button, no problem to solve — the player says one
 * thing to the robot and the robot answers, and the crow keeps the thread.
 * The whole lesson is that an object exists before anyone names it, which
 * is why every line here is typed bare.
 */
const firstWords: Activity = {
  id: 'sandbox',
  title: 'First Words',
  /** Kept as data, rendered nowhere: the starting point does not need to
   *  be introduced. Activities with something to solve will want it. */
  brief: 'Learn to make objects in the robot\'s memory, before learning to name them.',
  mode: 'console',
  lesson: 'objects-first',
  greeting: 'Say something to me and I will make it. One line at a time.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: {
    id: 'workshop',
    title: 'Workshop',
    actors: [
      { id: 'crow', kind: 'crow', x: 30, y: 48, w: 20 },
      { id: 'robot', kind: 'robot', x: 68, y: 48, w: 22 },
      { id: 'bench', kind: 'plinth', x: 50, y: 78, w: 62 },
    ],
    watches: [],
  },
}

/** The console lesson first: it is the starting point, and `ACTIVITIES[0]`
 *  is what the router opens with. The editor activities are reachable by
 *  hash but are not offered anywhere yet — they are what unlocking looks
 *  like, once there is a progression to unlock them from. */
export const ACTIVITIES: Activity[] = [firstWords, wakeTheRobot, parcelBelt]

export const activityById = (id: string): Activity | null =>
  ACTIVITIES.find((a) => a.id === id) ?? null
