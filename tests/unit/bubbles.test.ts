/**
 * The speech bubble's tail and the thought's cloud, as shapes: pure
 * functions of where things are (`tailShape`, `cloudPath` in ScenePanel).
 */
import { describe, expect, it } from 'vitest'
import { cloudPath, tailShape } from '../../src/panels/ScenePanel'

const bubble = { left: 55, right: 317, bottom: 478, radius: 20 }

describe('the tail', () => {
  it('leaves the flat of the bubble, never its rounded corner, when the speaker is past the edge', () => {
    // The crow stands left of the clamped bubble: the old fixed tail's
    // root landed in the corner and read as a separate sliver.
    const s = tailShape({ ...bubble, at: 68, tip: 515 })
    const [, x] = s.edge.match(/^M ([\d.]+) 0/)!
    expect(s.box.left + Number(x)).toBeGreaterThanOrEqual(bubble.left + bubble.radius)
  })

  it('ends on the speaker, and its box is centred there', () => {
    const s = tailShape({ ...bubble, at: 68, tip: 515 })
    expect(s.box.left + s.box.width / 2).toBeCloseTo(68, 5)
    expect(s.box.top + s.box.height).toBeCloseTo(515, 5)
  })

  it('points straight down from under a speaker the bubble is over', () => {
    const s = tailShape({ ...bubble, at: 180, tip: 510 })
    expect(s.box.width).toBeLessThan(40)
  })
})

describe('the cloud', () => {
  it('is one closed outline of puffs', () => {
    const d = cloudPath(60, 30)
    expect(d.startsWith('M ')).toBe(true)
    expect(d.endsWith(' Z')).toBe(true)
    expect((d.match(/ A /g) ?? []).length).toBeGreaterThanOrEqual(7)
  })

  it('keeps its puffs the same size however long the value is', () => {
    const radius = (d: string) => Number(d.match(/ A ([\d.]+) /)![1])
    expect(radius(cloudPath(160, 30))).toBeCloseTo(radius(cloudPath(60, 30)), 0)
  })
})
