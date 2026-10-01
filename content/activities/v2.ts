/**
 * Version 2 of the lessons (`#/v2`): its activities.
 *
 * Every id starts `v2-`, so v2's finished levels and v1's never share a
 * name in the one progress store. `version: 2` is what gives a level the
 * v2 robot panel, and what sends Continue back to the v2 map.
 */
import type { SceneSpec } from '../../src/scene/spec'
import type { Activity } from './index'

/** The workshop: the crow and the robot, with the picture slot between. */
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

const meet: Activity = {
  id: 'v2-meet',
  version: 2,
  title: 'Meet the Robot',
  brief: 'Watch the crow give the robot an instruction, then give it one of your own.',
  mode: 'console',
  lesson: 'v2-meet',
  next: 'v2-types',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: WORKSHOP,
}

const types: Activity = {
  id: 'v2-types',
  version: 2,
  title: 'Basic Data Types',
  brief: 'Yes-or-no, counted, measured and words: the four basic data types the robot thinks in.',
  mode: 'console',
  lesson: 'v2-types',
  next: 'v2-ops',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: WORKSHOP,
}

const ops: Activity = {
  id: 'v2-ops',
  version: 2,
  title: 'Working Things Out',
  brief: 'Give the robot a sum and it works out the answer: in the right order, with the right types.',
  mode: 'console',
  lesson: 'v2-ops',
  next: 'v2-bind',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: WORKSHOP,
}

const bind: Activity = {
  id: 'v2-bind',
  version: 2,
  title: 'Memories',
  brief: 'Give the robot memories: names that point at objects, worked out and moved, until you can build any memory you are shown.',
  mode: 'console',
  lesson: 'v2-bind',
  next: 'v2-lists',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: WORKSHOP,
}

/** The workshop with Mira at the far end: she brings the loot. She is
 *  off stage until the lesson's first beat has her `enter`. */
const WORKSHOP_WITH_MIRA: SceneSpec = {
  ...WORKSHOP,
  actors: [
    { id: 'crow', kind: 'crow', x: 10, y: 0, w: 14, stand: true },
    { id: 'robot', kind: 'robot', x: 64, y: 0, w: 19, stand: true },
    { id: 'courier', kind: 'courier', x: 87, y: 0, w: 15, stand: true },
  ],
  props: { x: 36.5, w: 32 },
}

const lists: Activity = {
  id: 'v2-lists',
  version: 2,
  title: 'Lists',
  brief: 'Keep a whole hotbar under one name: pick any slot by its index, swap an item, pick one up, and share a list between names.',
  mode: 'console',
  lesson: 'v2-lists',
  next: 'v2-logic',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  // An adventure: the trailhead, with the cave the backpack is packed for.
  scene: { ...WORKSHOP_WITH_MIRA, id: 'trailhead', title: 'Trailhead', backdrop: 'trailhead' },
}

/** At the cave's mouth, where the questions are asked: can we go in? */
const logic: Activity = {
  id: 'v2-logic',
  version: 2,
  title: 'Asking Questions',
  brief: 'Ask the robot yes-or-no questions about its memory, and join them with and, or and not.',
  mode: 'console',
  lesson: 'v2-logic',
  next: 'v2-if',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: { ...WORKSHOP_WITH_MIRA, id: 'trailhead', title: 'Trailhead', backdrop: 'trailhead' },
}

/** Inside the cave: where the robot has choices to make, and an editor
 *  to write them in. */
const CAVE: SceneSpec = { ...WORKSHOP_WITH_MIRA, id: 'cave', title: 'Cave', backdrop: 'cave' }

const ifs: Activity = {
  id: 'v2-if',
  version: 2,
  title: 'Making Choices',
  brief: 'Write programs in the editor that choose what to do: if, elif and else.',
  mode: 'editor',
  lesson: 'v2-if',
  next: 'v2-loops',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: CAVE,
}

const loops: Activity = {
  id: 'v2-loops',
  version: 2,
  title: 'Again and Again',
  brief: 'Loops: do the same thing for every item in a list, a number of times, or while a question says yes.',
  mode: 'editor',
  lesson: 'v2-loops',
  starter: '',
  options: { max_steps: 3000, wall_clock_s: 15 },
  scene: { ...CAVE, id: 'deep-cave', title: 'Deep in the cave' },
}

export const V2_ACTIVITIES: Activity[] = [meet, types, ops, bind, lists, logic, ifs, loops]
