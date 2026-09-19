/**
 * Semantic event bus — the seam between the Python runtime and the scene.
 *
 * Modules emit small, stable events; the director and the tests subscribe.
 * Purely additive: nothing in the app depends on having listeners, and
 * removing the director must leave a working app.
 *
 * Direction rule (DESIGN.md §5): the runtime initiates, the scene responds.
 * Nothing subscribed here may call into a live run.
 */
import type { TerminalReason } from '../runtime/types'

export type GameEvent =
  | { type: 'runtime-booting' }
  | { type: 'runtime-ready'; isolated: boolean }
  | { type: 'runtime-failed'; message: string }
  | { type: 'scenario-loaded'; scenarioId: string }
  | { type: 'npc-spoke'; text: string }
  | { type: 'attempt-started'; scenarioId: string; attempt: number }
  | { type: 'run-ended'; reason: TerminalReason; traceComplete: boolean }
  | { type: 'attempt-graded'; scenarioId: string; passed: boolean; misconception: string | null }
  | { type: 'robot-spoke'; text: string }
  | { type: 'edited' }

export type EmittedEvent = GameEvent & { t: number }

const listeners = new Set<(e: EmittedEvent) => void>()
const log: EmittedEvent[] = []
const MAX_LOG = 2000

export const events = {
  emit(event: GameEvent): EmittedEvent {
    const e = { ...event, t: Math.round(performance.now()) } as EmittedEvent
    log.push(e)
    if (log.length > MAX_LOG) log.shift()
    for (const fn of [...listeners]) {
      try {
        fn(e)
      } catch (err) {
        // A failing cosmetic listener must never break a run.
        console.error('event listener failed:', err)
      }
    }
    return e
  },
  on(fn: (e: EmittedEvent) => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  log: (): EmittedEvent[] => log.slice(),
  clear: (): void => {
    log.length = 0
  },
}
