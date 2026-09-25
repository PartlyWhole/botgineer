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
import { BAY } from '../lessons/wake'
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
  /** The guide's lesson, by id in `content/lessons`. A console lesson is
   *  judged on lines; an editor one (`wake`) on what a run left in memory. */
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
 * The workshop the first level and `operations` share: the crow and the robot
 * with room between them for the lesson's pictures (`props`), which stand
 * no taller than the robot and so stay under the speech band.
 *
 * The robot is no further right than 74%: its thought cloud is centred
 * over it but clamped to 69% so it cannot leave the stage, and further
 * out the cloud drifted off the robot's head.
 */
const WORKSHOP: SceneSpec = {
  id: 'workshop',
  title: 'Workshop',
  floor: { at: 76 },
  actors: [
    { id: 'crow', kind: 'crow', x: 12, y: 0, w: 16, stand: true },
    { id: 'robot', kind: 'robot', x: 74, y: 0, w: 22, stand: true },
  ],
  props: { x: 41.5, w: 40 },
  watches: [],
}

/**
 * Level 2: working things out.
 *
 * Same room, same empty memory, and Mira back with a sum: seven crates
 * of six bolts, which the robot cannot know and can work out. Each
 * question is drawn on the stage, and the lesson ends on the fact that
 * every answer went nowhere — the itch the naming lesson scratches. That
 * ordering is the whole reason this activity sits between them.
 *
 * Mira stands where she does in the Lesson 1 workshop, and the lesson's
 * first beat is her `enter`, so she arrives rather than waits (`castAt`).
 * The scene is its own, not `WORKSHOP_WITH_MIRA`, which is declared
 * further down and is Lesson 1's to change.
 */
const workingOut: Activity = {
  id: 'operations',
  title: 'Working Things Out',
  brief: 'Give the robot the sum and let it work it out: numbers, questions and words, and what type comes back.',
  mode: 'console',
  lesson: 'operations',
  next: 'practice-thinking',
  greeting: 'Give me a sum. I will work it out.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: {
    id: 'workshop',
    title: 'Workshop',
    floor: { at: 76 },
    actors: [
      { id: 'crow', kind: 'crow', x: 10, y: 0, w: 14, stand: true },
      { id: 'robot', kind: 'robot', x: 64, y: 0, w: 19, stand: true },
      { id: 'courier', kind: 'courier', x: 87, y: 0, w: 15, stand: true },
    ],
    props: { x: 36.5, w: 32 },
    watches: [],
  },
}

/**
 * Level 4: names.
 *
 * A fresh session on purpose. Starting from an empty memory is what makes
 * the first binding legible — one name, one arrow, one object — where
 * continuing from an earlier level would open on a field that already
 * looks busy.
 *
 * The same workshop as `operations`, because the lesson opens on that
 * level's first picture (the crates of bolts) to show the robot has
 * forgotten it. After that the picture is the memory graph, which the
 * crow points at.
 */
const namingThings: Activity = {
  id: 'names',
  title: 'Names',
  brief: 'A name does not hold an object. It points at one.',
  mode: 'console',
  lesson: 'names-point',
  next: 'order',
  greeting: 'Nothing kept yet. Let\'s fix that.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  // The workshop's own geometry, restated rather than shared: this level
  // stands one picture, at its start, and should not move when another
  // level's cast does.
  scene: {
    id: 'workshop',
    title: 'Workshop',
    floor: { at: 76 },
    actors: [
      { id: 'crow', kind: 'crow', x: 12, y: 0, w: 16, stand: true },
      { id: 'robot', kind: 'robot', x: 74, y: 0, w: 22, stand: true },
    ],
    props: { x: 41.5, w: 40 },
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
      { id: 'crow', kind: 'crow', x: 9, y: 0, w: 12, stand: true },
      { id: 'robot', kind: 'robot', x: 28, y: 0, w: 21, stand: true },
      { id: 'courier', kind: 'courier', x: 79, y: 0, w: 19, stand: true },
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
    // The scale stands between the robot and Mira: her parcels, weighed
    // by what the robot works out.
    props: { x: 54, w: 30 },
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
  lesson: 'wake',
  next: 's1-set-1',
  brief:
    'The robot is asleep. It reads three things out of its own memory: whether it has power, what it should call itself, and how charged it is. Give those names values.',
  starter: '# Give the robot what it needs.\n# power, name, charge\n\n',
  options: { max_steps: 2000, wall_clock_s: 15 },
  // The lesson's own bay (`content/lessons/wake`), so that finishing the
  // lesson and satisfying these watches are one test, not two that agree.
  scene: BAY,
}

/**
 * The starting point: meet the robot.
 *
 * No program, no Run button: the crow introduces the robot, and the player
 * makes it think of something in one line. Nothing is named, so nothing
 * reaches memory; that memory stays empty here is the point, not an
 * omission.
 *
 * The pictures stand between the crow and the robot (`WORKSHOP`).
 */
const meetTheRobot: Activity = {
  id: 'sandbox',
  title: 'Meet the Robot',
  /** Kept as data, rendered nowhere: the starting point does not need to
   *  be introduced. Activities with something to solve will want it. */
  brief: 'The robot does nothing until you give it an instruction. Then it thinks of whatever you write.',
  mode: 'console',
  lesson: 'meet',
  next: 'types',
  greeting: 'Ready. One instruction per line.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: WORKSHOP,
}

/**
 * The workshop with Mira in it: the crow, the pictures, the robot, and
 * Mira at the far end, who gives the words (`str`) somebody to be for.
 *
 * She is in the scene from the start, but a lesson whose first action for
 * her is `enter` keeps her off stage until that beat (`castAt` in
 * `content/lessons`) — so she can arrive part-way through without the
 * scene holding any state about it. Everyone is pulled in a little to make
 * room: the robot at 64% keeps its thought cloud inside the 31–69 clamp,
 * and the pictures narrow to fit between the crow and the robot.
 */
const WORKSHOP_WITH_MIRA: SceneSpec = {
  id: 'workshop',
  title: 'Workshop',
  floor: { at: 76 },
  actors: [
    { id: 'crow', kind: 'crow', x: 10, y: 0, w: 14, stand: true },
    { id: 'robot', kind: 'robot', x: 64, y: 0, w: 19, stand: true },
    { id: 'courier', kind: 'courier', x: 87, y: 0, w: 15, stand: true },
  ],
  props: { x: 36.5, w: 32 },
  watches: [],
}

/** Level 1b: the five basic data types, met one at a time, each named
 *  into its slot on the shelf. Mira arrives part-way, with the letters. */
const fiveDataTypes: Activity = {
  id: 'types',
  title: 'Five Data Types',
  brief: 'Yes or no, how many, how much, one character, and words: the five basic data types.',
  mode: 'console',
  lesson: 'types',
  next: 'choose',
  greeting: 'Ready. One instruction per line.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: WORKSHOP_WITH_MIRA,
}

/** Level 1c: twelve questions, each answered with the right data type
 *  and no hint about which. Mira is on stage from the start. */
const chooseTheType: Activity = {
  id: 'choose',
  title: 'Choose the Type',
  brief: 'Each question decides its own data type. Answer it with the right one.',
  mode: 'console',
  lesson: 'choose',
  next: 'operations',
  greeting: 'Ready. One instruction per line.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: WORKSHOP_WITH_MIRA,
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

/**
 * Practice on the warm-up: the same pictures as its lessons, with new
 * numbers each time, so practice is the lessons' world rather than a
 * quiz beside it. The remembering practice keeps the plain yard: its
 * questions are about memory, which the memory graph already draws.
 */
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
  scene: { ...WORKSHOP, id: 'practice-thinking', title: 'Practice yard' },
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
/**
 * Stage 1's ideas, as a console lesson rather than the collection's page
 * of prose (content/lessons/s1ideas.ts says why). Same id and place on
 * the map as the reading level it replaces, so progress and links hold.
 * The memory graph is the picture, so the stage needs no props slot.
 */
const stage1Ideas: Activity = {
  id: 's1-ideas',
  title: 'The Ideas',
  brief: 'Read straight-line code one line at a time: right side first, then see which arrow moves.',
  mode: 'console',
  lesson: 's1-ideas',
  next: 'wake',
  greeting: 'Type an instruction and press Enter.',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: practiceScene('s1-ideas'),
}

export const ACTIVITIES: Activity[] = [
  meetTheRobot,
  fiveDataTypes,
  chooseTheType,
  workingOut,
  practiceThinking,
  namingThings,
  takeAnOrder,
  practiceRemembering,
  stage1Ideas,
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
