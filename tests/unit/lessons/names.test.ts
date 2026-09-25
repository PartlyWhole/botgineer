/**
 * Names point at objects.
 */
import { describe, expect, it } from 'vitest'
import { guidance, namesPoint, progress } from '../../../content/lessons'
import { NOTHING, bound, over, snap, th, value } from './fixtures'

/* ---------------------------- three: names ---------------------------- */

describe('names point at objects', () => {
  const x10 = bound('x', 'int', '10')
  const named = snap([x10.object], [x10.binding])
  const aliased = snap([x10.object], [x10.binding, { ...x10.binding, name: 'y' }])
  const moved = snap(
    [value('int', '10'), value('int', '99')],
    [
      { name: 'x', scope: 'global', target: 'v:int:99' },
      { name: 'y', scope: 'global', target: 'v:int:10' },
    ],
  )

  it('asks for a name because the last lesson kept nothing', () => {
    expect(guidance(namesPoint, NOTHING).text).toMatch(/forgetting/)
  })

  it('wants the name, then wants it read back without recomputing', () => {
    expect(progress(namesPoint, over([named]))).toBe(1)
    expect(progress(namesPoint, over([named], [th('int', '10')]))).toBe(2)
  })

  it('finishes when x has moved and y has not', () => {
    expect(progress(namesPoint, over([named, aliased, moved], [th('int', '10')]))).toBe(
      namesPoint.steps.length,
    )
  })

  it('does not slide backwards when the last step un-answers the first', () => {
    // `x = 99` makes "x points at 10" false again.
    expect(progress(namesPoint, over([moved], [th('int', '10')]))).toBe(0)
    expect(progress(namesPoint, over([named, aliased, moved], [th('int', '10')]))).toBe(4)
  })
})
