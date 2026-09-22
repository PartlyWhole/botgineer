/**
 * The director: maps runtime events onto character expressions.
 *
 * Strictly cosmetic. It subscribes to the event bus and drives nothing —
 * deleting this module must leave a working app. Nothing here may call into
 * a live run.
 */
import { useEffect, useState } from 'react'
import { events } from './events'

export type Mood = 'idle' | 'attentive' | 'thinking' | 'pleased' | 'confused' | 'celebrate'

export type Cast = { robot: Mood; npc: Mood }

const START: Cast = { robot: 'idle', npc: 'idle' }

export function nextCast(current: Cast, e: { type: string } & Record<string, unknown>): Cast {
  switch (e.type) {
    case 'runtime-booting':
      return { robot: 'thinking', npc: 'idle' }
    case 'runtime-ready':
      return { robot: 'idle', npc: 'idle' }
    case 'runtime-failed':
      return { robot: 'confused', npc: 'confused' }
    case 'npc-spoke':
      return { robot: 'attentive', npc: 'attentive' }
    case 'edited':
      return { robot: 'attentive', npc: current.npc === 'celebrate' ? 'pleased' : current.npc }
    case 'attempt-started':
      return { robot: 'thinking', npc: 'attentive' }
    case 'attempt-graded':
      // `passed` here means only that the interpreter reached the end
      // without raising. That is not success, and the robot must not
      // celebrate it: `power = 0` runs perfectly and leaves the lamp
      // dark. Whether anything actually worked is a property of the
      // picture, so the scene decides celebration (`SceneView.solved`)
      // and this decides nothing more than attentiveness.
      //
      // A run that threw is still a real signal, and stays one.
      return e.passed
        ? { robot: 'attentive', npc: 'attentive' }
        : { robot: 'confused', npc: 'confused' }
    default:
      return current
  }
}

/** Subscribes the cast to the bus. One listener for the whole scene. */
export function useCast(): Cast {
  const [cast, setCast] = useState<Cast>(START)
  useEffect(() => events.on((e) => setCast((c) => nextCast(c, e))), [])
  return cast
}
