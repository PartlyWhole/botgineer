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
    expect(nextCast(START, { type: 'attempt-graded', passed: false }).robot).toBe('confused')
  })

  it("does not make the guide wear the robot's mistake", () => {
    // Every actor used to take the robot's mood, so the crow looked
    // confused whenever the robot raised.
    expect(nextCast(START, { type: 'attempt-graded', passed: false }).npc).not.toBe('confused')
  })

  it('has the guide attend when it speaks, and the robot listen', () => {
    expect(nextCast(START, { type: 'npc-spoke', text: 'hi' })).toEqual({
      robot: 'attentive',
      npc: 'attentive',
    })
  })

  it('does not let a new line of advice paper over a failure', () => {
    const failed = nextCast(START, { type: 'attempt-graded', passed: false })
    expect(nextCast(failed, { type: 'npc-spoke', text: 'try again' }).robot).toBe('confused')
  })

  it('thinks while a run is in flight', () => {
    expect(nextCast(START, { type: 'attempt-started' }).robot).toBe('thinking')
  })

  it('never invents a mood for an event it does not know', () => {
    expect(nextCast(START, { type: 'something-else' })).toEqual(START)
  })
})
