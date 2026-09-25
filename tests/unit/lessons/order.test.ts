/**
 * Taking an order.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, takeAnOrder } from '../../../content/lessons'
import { NOTHING, bound, over, snap, th, value } from './fixtures'

/* -------------------------- four: taking an order -------------------------- */

describe('taking an order', () => {
  const customer = bound('customer', 'str', "'Mira'")
  const parcels = bound('parcels', 'int', '7')
  const stored = snap([customer.object, parcels.object], [customer.binding, parcels.binding])

  it('is asked by the courier, not the crow', () => {
    expect(guidance(takeAnOrder, NOTHING).speaker).toBe('courier')
  })

  it('wants both facts before the question', () => {
    expect(progress(takeAnOrder, over([snap([customer.object], [customer.binding])]))).toBe(1)
    expect(progress(takeAnOrder, over([stored]))).toBe(2)
  })

  it('finishes when the robot works the weight out', () => {
    expect(progress(takeAnOrder, over([stored], [th('int', '14')]))).toBe(takeAnOrder.steps.length)
  })

  it('is not satisfied by storing the answer instead of working it out', () => {
    const cheated = snap(
      [customer.object, parcels.object, value('int', '14')],
      [customer.binding, parcels.binding, { name: 'total', scope: 'global', target: 'v:int:14' }],
    )
    expect(progress(takeAnOrder, over([cheated]))).toBe(2)
  })
})
