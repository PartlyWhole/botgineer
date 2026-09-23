/**
 * Every grading spec, keyed by item id. Content, like the markdown it
 * grades; `tests/unit/collection.test.ts` insists every item has exactly
 * one and every spec has an item.
 */
import type { Spec } from '../../../src/collection/model'
import { STAGE_1 } from './stage-01'
import { STAGE_2 } from './stage-02'
import { STAGE_3 } from './stage-03'
import { STAGE_4 } from './stage-04'
import { STAGE_5 } from './stage-05'
import { STAGE_6 } from './stage-06'
import { STAGE_7 } from './stage-07'
import { STAGE_8 } from './stage-08'
import { STAGE_9 } from './stage-09'

export const SPECS: Record<string, Spec> = {
  ...STAGE_1,
  ...STAGE_2,
  ...STAGE_3,
  ...STAGE_4,
  ...STAGE_5,
  ...STAGE_6,
  ...STAGE_7,
  ...STAGE_8,
  ...STAGE_9,
}
