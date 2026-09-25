/**
 * The roadmap: the levels, grouped into units, in the order they are
 * played.
 *
 * Content, like the activities it points at. A unit is a chapter with a
 * theme colour and a character who keeps it company on the map; a level is
 * an activity id. Adding a level is adding its id here, and the path, the
 * locks and the trophies follow from that — nothing else knows the order.
 */
import { ACTIVITIES, activityById } from './activities'
import { stageLevelIds } from './activities/reading'
import { STAGES } from '../src/collection'

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
  /** The collection stage this unit plays, if it is one. */
  stage?: number
}

const THEMES: Theme[] = ['sky', 'grass', 'sun', 'berry']
const MASCOTS: Unit['mascot'][] = ['crow', 'courier', 'robot']

/**
 * The warm-up, then the collection's nine stages. The warm-up is where the
 * console lessons begin; the stages are the Reading Python collection,
 * and Stage 1 opens on the console lessons about names that used to be
 * a unit of their own.
 */
export const ROADMAP: Unit[] = [
  {
    id: 'thinking',
    title: 'Warm-up: Thinking',
    blurb: 'Meet the robot, and the five kinds of thing it thinks of',
    theme: 'sky',
    levels: ['sandbox', 'types', 'choose', 'operations', 'practice-thinking'],
    mascot: 'crow',
  },
  ...STAGES.map(
    (s, i): Unit => ({
      id: `stage-${s.stage}`,
      title: `Stage ${s.stage}: ${s.title}`,
      blurb: s.summary,
      theme: THEMES[(i + 1) % THEMES.length]!,
      levels: stageLevelIds(s.stage),
      mascot: MASCOTS[(i + 1) % MASCOTS.length]!,
      stage: s.stage,
    }),
  ),
]

/** Every level in play order, across units. */
export const LEVEL_ORDER: string[] = ROADMAP.flatMap((u) => u.levels)

/** The activity a level id names. Throws on a typo, which the roadmap's
 *  unit test turns into a failure instead of a blank node. */
export const levelActivity = (id: string) => {
  const a = ACTIVITIES.find((x) => x.id === id) ?? activityById(id)
  if (!a) throw new Error(`roadmap names a level that does not exist: ${id}`)
  return a
}
