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

/** Two moods, because there are two points of view: the robot's, about
 *  its own run, and everyone else's, about the robot. */
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
      // Someone is talking to the robot, so it listens — unless it has
      // just failed, which a new line of advice does not undo.
      return { robot: current.robot === 'confused' ? 'confused' : 'attentive', npc: 'attentive' }
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
      // A run that threw is still a real signal, and stays one — for the
      // robot, whose run it was. The guide is not confused by the robot's
      // mistake; it watches, the way a teacher does.
      return e.passed
        ? { robot: 'attentive', npc: 'attentive' }
        : { robot: 'confused', npc: 'attentive' }
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
