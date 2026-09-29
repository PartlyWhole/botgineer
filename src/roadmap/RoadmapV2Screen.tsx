/**
 * The map for version 2 of the lessons: `#/v2`.
 *
 * The same map as v1's, drawn from v2's own path (`ROADMAP_V2`). The two
 * share the one progress store, which is safe because every v2 level id
 * starts `v2-`.
 */
import { ROADMAP_V2 } from '../../content/roadmap'
import { RoadmapScreen } from './RoadmapScreen'

export function RoadmapV2Screen() {
  return <RoadmapScreen roadmap={ROADMAP_V2} />
}
