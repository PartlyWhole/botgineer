/**
 * The roadmap: the levels, grouped into units, in the order they are
 * played.
 *
 * Content, like the activities it points at. A unit is a chapter with a
 * theme colour and a character who keeps it company on the map; a level is
 * an activity id. Adding a level is adding its id here, and the path, the
 * locks and the trophies follow from that — nothing else knows the order.
 */
import { ACTIVITIES } from './activities'

export type Theme = 'sky' | 'grass' | 'sun' | 'berry'

export type Unit = {
  id: string
  title: string
  /** One line under the title: what this unit is about, in the player's
   *  words rather than the curriculum's. */
  blurb: string
  theme: Theme
  /** Activity ids, in play order. */
  levels: string[]
  /** Who stands beside this stretch of the path. */
  mascot: 'crow' | 'robot' | 'courier'
}

export const ROADMAP: Unit[] = [
  {
    id: 'thinking',
    title: 'Thinking',
    blurb: 'What the robot can think of, and work out',
    theme: 'sky',
    levels: ['sandbox', 'operations'],
    mascot: 'crow',
  },
  {
    id: 'remembering',
    title: 'Remembering',
    blurb: 'Give things names, and they stay',
    theme: 'grass',
    levels: ['names', 'order'],
    mascot: 'courier',
  },
  {
    id: 'building',
    title: 'Building',
    blurb: 'Whole programs, all at once',
    theme: 'sun',
    levels: ['wake'],
    mascot: 'robot',
  },
]

/** Every level in play order, across units. */
export const LEVEL_ORDER: string[] = ROADMAP.flatMap((u) => u.levels)

/** The activity a level id names. Throws on a typo, which the roadmap's
 *  unit test turns into a failure instead of a blank node. */
export const levelActivity = (id: string) => {
  const a = ACTIVITIES.find((x) => x.id === id)
  if (!a) throw new Error(`roadmap names a level that does not exist: ${id}`)
  return a
}
