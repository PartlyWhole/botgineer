/**
 * One Python session for the whole page, booted once.
 *
 * Boot is a module-level promise rather than an effect, so React's
 * development double-invoke cannot start two boots — the second would be
 * rejected by the one-run-at-a-time guard and look like a boot failure.
 */
import { useEffect, useState } from 'react'
import { PythonSession } from './session'
import { events } from '../game/events'

export const session = new PythonSession()

export type Boot =
  | { state: 'booting' }
  | { state: 'ready'; isolated: boolean }
  | { state: 'failed'; message: string }

let bootPromise: Promise<Boot> | null = null

/** Runs a trivial program to bring the worker up. The first real run is
 *  then instant, boot failure surfaces at load rather than mid-encounter,
 *  and the header reports the real isolation posture instead of a guess. */
export function bootRuntime(): Promise<Boot> {
  bootPromise ??= session
    .run({ source: 'pass\n', options: { max_steps: 10, wall_clock_s: 30 }, onRecord: () => {} })
    .then((outcome): Boot => {
      const isolated = outcome.header?.host.capabilities.cross_origin_isolated ?? false
      events.emit({ type: 'runtime-ready', isolated })
      return { state: 'ready', isolated }
    })
    .catch((err: unknown): Boot => {
      const message = err instanceof Error ? err.message : String(err)
      events.emit({ type: 'runtime-failed', message })
      return { state: 'failed', message }
    })
  return bootPromise
}

export function useRuntime(): Boot {
  const [boot, setBoot] = useState<Boot>({ state: 'booting' })
  useEffect(() => {
    let live = true
    events.emit({ type: 'runtime-booting' })
    void bootRuntime().then((b) => {
      if (live) setBoot(b)
    })
    return () => {
      live = false
    }
  }, [])
  return boot
}
