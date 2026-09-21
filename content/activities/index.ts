/**
 * The activities. Each brings its own scene; nothing assumes a continuous
 * world between them.
 *
 * An activity is content, not code: a scene, a brief, and a starting
 * point. What the player does is change memory, and the scene is a view of
 * memory, so there is no separate "game logic" anywhere.
 */
import type { SceneSpec } from '../../src/scene/spec'

export type Activity = {
  id: string
  title: string
  /** What the player is being asked to do, in one or two sentences. */
  brief: string
  scene: SceneSpec
  /** What sits in the robot interface when the activity opens. */
  starter: string
  /** Budget for one run of this activity's session. */
  options: { max_steps: number; wall_clock_s: number }
}

/* ---------------------------------------------------------------- */

const wakeTheRobot: Activity = {
  id: 'wake',
  title: 'Wake the Robot',
  brief:
    'The robot is asleep. It reads three things out of its own memory: whether it has power, what it should call itself, and how charged it is. Give those names values.',
  starter: '# Give the robot what it needs.\n# power, name, charge\n\n',
  options: { max_steps: 2000, wall_clock_s: 15 },
  scene: {
    id: 'bay',
    title: 'Charging bay',
    caption: 'A robot on a plinth, waiting to be told about itself.',
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
    caption: 'Parcels the robot will lift the moment you name them.',
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

const sandbox: Activity = {
  id: 'sandbox',
  title: 'Sandbox',
  brief:
    'Nothing to solve. Make objects and watch memory fill up — names on the left, the objects they point at on the right.',
  starter: `a = 10
b = a
letters = ["x", "y"]
same = letters
copy = list(letters)
counts = {"x": 1, "y": 2}
`,
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: {
    id: 'workshop',
    title: 'Workshop',
    caption: 'A crow, a robot, and whatever you decide to build.',
    actors: [
      { id: 'crow', kind: 'crow', x: 30, y: 48, w: 20 },
      { id: 'robot', kind: 'robot', x: 68, y: 48, w: 22 },
      { id: 'bench', kind: 'plinth', x: 50, y: 78, w: 62 },
    ],
    watches: [],
  },
}

export const ACTIVITIES: Activity[] = [wakeTheRobot, parcelBelt, sandbox]

export const activityById = (id: string): Activity | null =>
  ACTIVITIES.find((a) => a.id === id) ?? null
