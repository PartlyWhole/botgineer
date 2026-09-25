/**
 * The placeholder lessons the new levels play until their content is
 * written (`wake`). Each is small, but it must be playable and
 * finishable, because the map, practice and the browser journeys stand
 * on it. The content workstreams replace these tests with their lessons;
 * `meet`, `types` and `choose` have their own now.
 */
import { describe, expect, it } from 'vitest'
import { progress, wake } from '../../../content/lessons'
import { bound, over, snap } from './fixtures'

describe('wake (placeholder)', () => {
  const power = (repr: string, type = 'bool') => bound('power', type, repr)
  const name = bound('name', 'str', "'Bolt'")
  const charge = bound('charge', 'int', '72')
  const world = (...xs: ReturnType<typeof bound>[]) => over([snap(xs.map((x) => x.object), xs.map((x) => x.binding))])

  it('wakes on what the bay watches, all three', () => {
    expect(progress(wake, world(power('True'), name, charge))).toBe(1)
    expect(progress(wake, world(power('True'), name))).toBe(0)
  })

  it('does not wake on a power the lamp would not light for', () => {
    expect(progress(wake, world(power('0', 'int'), name, charge))).toBe(0)
    expect(progress(wake, world(power('False'), name, charge))).toBe(0)
  })

  it('does not take a word for a charge', () => {
    expect(progress(wake, world(power('True'), name, bound('charge', 'str', "'full'")))).toBe(0)
  })
})
