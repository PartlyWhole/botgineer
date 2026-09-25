/**
 * Guided lessons: one file per lesson, and this registry.
 *
 * Everything a lesson file or an importer needs — the types, `progress`,
 * `script`, `guidance`, `staging`, `castAt` and the predicates — is
 * written in `core.ts` and re-exported from here, so every importer keeps
 * importing `content/lessons`. Lesson files import `./core` directly (see
 * its header for why).
 *
 * `LESSONS` is keyed by lesson id, which is what an activity's `lesson`
 * names. `kinds.ts` and `talking.ts` are the warm-up's first lessons as
 * they were before docs/PEDAGOGY.md; they are no longer registered, and
 * are kept only until their replacements (`meet`, `types`, `choose`) are
 * written.
 */
import type { Lesson } from './core'
import { meet } from './meet'
import { types } from './types'
import { choose } from './choose'
import { operations } from './operations'
import { namesPoint } from './names'
import { takeAnOrder } from './order'
import { wake } from './wake'

export * from './core'
export { meet, types, choose, operations, namesPoint, takeAnOrder, wake }
export { threeKinds } from './kinds'
export { talkingToHumans } from './talking'

export const LESSONS: Record<string, Lesson> = {
  [meet.id]: meet,
  [types.id]: types,
  [choose.id]: choose,
  [operations.id]: operations,
  [namesPoint.id]: namesPoint,
  [takeAnOrder.id]: takeAnOrder,
  [wake.id]: wake,
}
