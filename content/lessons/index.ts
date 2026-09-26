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
 * names.
 */
import type { Lesson } from './core'
import { meet } from './meet'
import { types } from './types'
import { choose } from './choose'
import { operations } from './operations'
import { namesPoint } from './names'
import { takeAnOrder } from './order'
import { wake } from './wake'
import { s1Ideas } from './s1ideas'
import { s2Ideas } from './s2ideas'
import { s3Ideas } from './s3ideas'
import { s4Ideas } from './s4ideas'
import { s5Ideas } from './s5ideas'
import { s6Ideas } from './s6ideas'
import { s7Ideas } from './s7ideas'
import { s8Ideas } from './s8ideas'
import { decide } from './decide'

export * from './core'
export { meet, types, choose, operations, namesPoint, takeAnOrder, wake, s1Ideas, s2Ideas, s3Ideas, s4Ideas, s5Ideas, s6Ideas, s7Ideas, s8Ideas, decide }

export const LESSONS: Record<string, Lesson> = {
  [meet.id]: meet,
  [types.id]: types,
  [choose.id]: choose,
  [operations.id]: operations,
  [namesPoint.id]: namesPoint,
  [takeAnOrder.id]: takeAnOrder,
  [wake.id]: wake,
  [s1Ideas.id]: s1Ideas,
  [s2Ideas.id]: s2Ideas,
  [s3Ideas.id]: s3Ideas,
  [s4Ideas.id]: s4Ideas,
  [s5Ideas.id]: s5Ideas,
  [s6Ideas.id]: s6Ideas,
  [s7Ideas.id]: s7Ideas,
  [s8Ideas.id]: s8Ideas,
  [decide.id]: decide,
}
