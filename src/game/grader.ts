/**
 * Turns a finished run into a verdict.
 *
 * The host never computes what the robot should say — it reads what Python
 * produced. `answer` is lifted out of the trace's own snapshots, decoded, and
 * compared against a contract whose expectation is itself verified against
 * real CPython by a semantic test.
 */
import { decodeValue, decodedEquals, isUndecidable, type Decoded } from '../runtime/decode'
import type { StepRecord, TerminalRecord } from '../runtime/types'
import type { Scenario } from './scenario'

export type Verdict =
  | { status: 'passed'; answer: Decoded }
  | { status: 'failed'; answer: Decoded; message: string; misconception: string | null }
  | { status: 'crashed'; message: string; detail: string }
  | { status: 'stopped'; message: string }
  | { status: 'undecidable'; answer: Decoded; message: string }
  | { status: 'no-answer'; message: string }

const ANSWER = 'answer'

/** One line naming the exception and where it started.
 *
 *  The terminal record carries only a type name: the encoder never calls a
 *  user `__repr__`, so the exception object comes back opaque and there is
 *  no message to quote. The origin is recovered from the FIRST `exception`
 *  step instead — later ones are the same error unwinding outwards.
 *
 *  Lines are reported relative to the player's own code where possible: the
 *  assembled program has a preamble in front of it, and a learner should not
 *  have to subtract an offset to find their mistake.
 */
export function describeException(
  exc: TerminalRecord['exception'],
  steps: StepRecord[] = [],
  solutionStartLine = 1,
): string {
  const type = exc?.type_name ?? 'Error'
  const origin = steps.find((s) => s.event === 'exception') ?? null
  const location = origin?.location ?? exc?.location ?? null
  if (!location) return type

  const inSolution = location.line >= solutionStartLine
  const line = inSolution ? location.line - solutionStartLine + 1 : location.line
  const where = inSolution ? `line ${line} of your code` : `line ${line}`
  const fn = location.function && location.function !== '<module>' ? ` in ${location.function}()` : ''
  return `${type} at ${where}${fn}`
}

/** The last snapshot in which `answer` was bound in `__main__`.
 *
 *  Scanned backwards rather than taken from the final record: `line` events
 *  fire before their line executes, so the binding appears in whichever
 *  snapshot follows the assignment, and that is not always the last one.
 */
export function findAnswer(steps: StepRecord[]): Decoded | undefined {
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i]
    if (!step) continue
    const main = step.globals.find((g) => g.module === '__main__')
    const binding = main?.bindings.find((b) => b.name === ANSWER)
    if (binding) return decodeValue(binding.value, step.heap)
  }
  return undefined
}

export function grade(
  scenario: Scenario,
  steps: StepRecord[],
  terminal: TerminalRecord | null,
  solutionStartLine = 1,
): Verdict {
  const reason = terminal?.reason ?? 'engine_error'

  if (reason === 'uncaught_exception') {
    return {
      status: 'crashed',
      message: 'The robot stopped with an error.',
      detail: describeException(terminal?.exception, steps, solutionStartLine),
    }
  }

  if (reason === 'step_limit' || reason === 'trace_limit') {
    return {
      status: 'stopped',
      message:
        'The robot ran out of steps. That usually means a loop never finished — check that the loop can actually end.',
    }
  }

  if (reason === 'interrupted' || reason === 'killed') {
    return { status: 'stopped', message: 'The run was stopped before it finished.' }
  }

  if (reason === 'needs_input') {
    return { status: 'stopped', message: 'The program asked for input that was not available.' }
  }

  if (reason !== 'completed') {
    return { status: 'stopped', message: `The run ended unexpectedly (${reason}).` }
  }

  const answer = findAnswer(steps)
  if (answer === undefined) {
    return {
      status: 'no-answer',
      message:
        'The robot never produced an answer. Check that `respond` is defined and that the program reached the end.',
    }
  }

  // A value the decoder could not faithfully reconstruct must not be graded.
  // "Too big to check" is a different statement from "wrong".
  if (isUndecidable(answer)) {
    return {
      status: 'undecidable',
      answer,
      message:
        'The answer was too large or too unusual for the robot to check. Try returning a simple list of ids.',
    }
  }

  if (decodedEquals(answer, scenario.contract.expected)) {
    return { status: 'passed', answer }
  }

  for (const m of scenario.contract.misconceptions) {
    if (m.when(answer, scenario.world)) {
      return { status: 'failed', answer, message: m.say, misconception: m.id }
    }
  }

  return {
    status: 'failed',
    answer,
    message: 'That is not the list Mira needs. Compare what the robot said with the crates on the belt.',
    misconception: null,
  }
}
