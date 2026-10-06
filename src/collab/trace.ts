/**
 * A finished run, packed for a shared room, and unpacked on the other side.
 *
 * A room shares the run the driver's engine produced rather than asking
 * every peer to run the program again: a program with `random` or the
 * clock would come out differently on each machine, and then "step 7" would
 * mean two different memories. Exactly one peer runs Python.
 *
 * The records go in as one gzipped JSON blob, a single bytes value in the
 * document. Thousands of step records as Automerge maps would be thousands
 * of operations each run, all of them kept in the room's history.
 *
 * Unpacking is a trust boundary: the bytes came from another browser, not
 * from our engine. `isStep` checks the shape every view reads, so a
 * malformed or hostile record is dropped instead of crashing the page. The
 * views render text through React, so markup cannot be injected; this is
 * about not throwing.
 */
import type { StepRecord, TerminalRecord } from '../runtime/types'

export type PackedRun = {
  steps: StepRecord[]
  terminal: TerminalRecord | null
  threw: string | null
}

/** Above this, a run is not shared: the room says so and each peer can run
 *  it themselves. The relay keeps every run a room makes. */
export const TRACE_CAP = 4 * 1024 * 1024
/** Unpacked, a hostile blob could claim to be anything. */
const UNPACKED_CAP = 64 * 1024 * 1024

export async function pack(run: PackedRun): Promise<Uint8Array> {
  const json = new TextEncoder().encode(JSON.stringify(run))
  return new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())
}

export async function unpack(bytes: Uint8Array): Promise<PackedRun | null> {
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
    const reader = stream.getReader()
    const parts: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > UNPACKED_CAP) return null
      parts.push(value)
    }
    const text = new TextDecoder().decode(await new Blob(parts as BlobPart[]).arrayBuffer())
    return checked(JSON.parse(text))
  } catch {
    return null
  }
}

/** The run, keeping only what is shaped like engine output. */
export function checked(raw: unknown): PackedRun | null {
  if (!isObject(raw) || !Array.isArray(raw.steps)) return null
  const steps = raw.steps.filter(isStep)
  if (steps.length !== raw.steps.length) return null
  const terminal = isTerminal(raw.terminal) ? raw.terminal : null
  const threw = typeof raw.threw === 'string' ? raw.threw.slice(0, 500) : null
  return { steps, terminal, threw }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function isStep(v: unknown): v is StepRecord {
  if (!isObject(v) || v.kind !== 'step') return false
  const loc = v.location
  const out = v.output
  return (
    typeof v.event === 'string' &&
    isObject(loc) &&
    typeof loc.module === 'string' &&
    typeof loc.line === 'number' &&
    Array.isArray(v.stack) &&
    Array.isArray(v.globals) &&
    v.globals.every((g) => isObject(g) && typeof g.module === 'string' && Array.isArray(g.bindings)) &&
    Array.isArray(v.heap) &&
    v.heap.every(isObject) &&
    isObject(out) &&
    typeof out.stdout_delta === 'string' &&
    typeof out.stderr_delta === 'string'
  )
}

function isTerminal(v: unknown): v is TerminalRecord {
  return isObject(v) && v.kind === 'terminal' && typeof v.reason === 'string'
}
