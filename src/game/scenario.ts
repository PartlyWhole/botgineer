/**
 * What a BotGineer encounter is made of.
 *
 * A scenario owns one situation: the world, the Python the player cannot
 * edit, the Python they can, and the contract that decides whether the robot
 * answered correctly. The scene and the preamble are generated from the SAME
 * world object, so the crates on screen and the data in the editor cannot
 * drift apart.
 */
import type { Decoded } from '../runtime/decode'
import type { TraceOptions } from '../runtime/types'

export type Parcel = { id: string; weight: number }

export type World = {
  parcels: Parcel[]
  limit: number
}

export type Misconception = {
  id: string
  /** Recognises a specific wrong answer. Checked in order, before the
   *  generic failure, so feedback diagnoses rather than shrugs. */
  when: (got: Decoded, world: World) => boolean
  say: string
}

export type Contract = {
  entry: string
  /** Shipped as data and verified against `reference` by a semantic test
   *  running real Pyodide. The interpreter is the answer key. */
  expected: Decoded
  reference: string
  misconceptions: Misconception[]
}

export type Scenario = {
  id: string
  title: string
  npc: { name: string; line: string }
  world: World
  /** Visible, locked. A tool that conjures data from nowhere teaches that
   *  data comes from nowhere. */
  preamble: string
  starter: string
  /** Visible, locked. The trailing call is load-bearing: `line` events fire
   *  BEFORE the line executes, so a final statement guarantees at least one
   *  snapshot in which `answer` is bound. */
  harness: string
  options: TraceOptions
  contract: Contract
}

/** Renders a Python float the way a source file would spell it, so `5.0`
 *  does not appear as `5`. */
export function pyFloat(n: number): string {
  return Number.isInteger(n) ? `${n}.0` : String(n)
}

export function parcelsLiteral(parcels: Parcel[]): string {
  const items = parcels.map((p) => `(${JSON.stringify(p.id)}, ${pyFloat(p.weight)})`)
  return `[${items.join(', ')}]`
}

/** Assembles the three regions into the single source string the engine runs.
 *  Line offsets let trace locations map back to the region that owns them. */
export function assembleProgram(
  scenario: Scenario,
  solution: string,
): { source: string; solutionStartLine: number; solutionEndLine: number } {
  const preambleLines = scenario.preamble.split('\n').length
  const solutionLines = solution.split('\n').length
  const solutionStartLine = preambleLines + 1
  return {
    source: `${scenario.preamble}\n${solution}\n${scenario.harness}`,
    solutionStartLine,
    solutionEndLine: solutionStartLine + solutionLines - 1,
  }
}
