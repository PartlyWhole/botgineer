/**
 * The director is cosmetic, but it was telling a lie: it read "the
 * interpreter reached the end" as success and made the robot celebrate.
 */
import { describe, expect, it } from 'vitest'
import { nextCast } from '../../src/game/director'

const START = { robot: 'idle', npc: 'idle' } as const

describe('what the cast makes of a run', () => {
  it('does not celebrate a run that merely completed', () => {
    // `power = 0` completes without raising and leaves the lamp dark.
    // Celebration is the scene's call, not the interpreter's.
    const cast = nextCast(START, { type: 'attempt-graded', passed: true })
    expect(cast.robot).not.toBe('celebrate')
    expect(cast.robot).toBe('attentive')
  })

  it('still takes an exception seriously', () => {
    expect(nextCast(START, { type: 'attempt-graded', passed: false })).toEqual({
      robot: 'confused',
      npc: 'confused',
    })
  })

  it('thinks while a run is in flight', () => {
    expect(nextCast(START, { type: 'attempt-started' }).robot).toBe('thinking')
  })

  it('never invents a mood for an event it does not know', () => {
    expect(nextCast(START, { type: 'something-else' })).toEqual(START)
  })
})
