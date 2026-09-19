/**
 * The interpreter is the answer key.
 *
 * Every scenario ships an `expected` value as data. These tests run the
 * scenario's reference solution in real CPython (via Pyodide) and assert the
 * shipped expectation is what Python actually produces. A contract that
 * drifts from the interpreter fails CI rather than quietly grading students
 * against a stale answer.
 *
 * Misconceptions are checked the same way: the wrong code is executed, and
 * the diagnosis it should trigger is asserted against the real output.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { loadPyodide, type PyodideInterface } from 'pyodide'
import { heavyParcels } from '../../content/scenarios/heavy-parcels'
import type { Scenario } from '../../src/game/scenario'
import type { Decoded } from '../../src/runtime/decode'
import { decodedEquals } from '../../src/runtime/decode'

const scenarios: Scenario[] = [heavyParcels]

let pyodide: PyodideInterface

beforeAll(async () => {
  pyodide = await loadPyodide()
}, 120_000)

afterAll(() => {
  // Pyodide has no teardown; the worker process exits.
})

/** Runs preamble + solution + harness and returns `answer` as plain JS,
 *  exactly as the browser grader would see it after decoding. */
async function runForAnswer(scenario: Scenario, solution: string): Promise<Decoded> {
  const source = `${scenario.preamble}\n${solution}\n${scenario.harness}`
  const namespace = pyodide.globals.get('dict')()
  try {
    await pyodide.runPythonAsync(source, { globals: namespace })
    const answer = namespace.get('answer')
    if (answer === undefined) return null
    const js = typeof answer?.toJs === 'function' ? answer.toJs() : answer
    if (typeof answer?.destroy === 'function') answer.destroy()
    return js as Decoded
  } finally {
    namespace.destroy()
  }
}

describe.each(scenarios)('$id', (scenario) => {
  it('the shipped expectation is what the reference solution really produces', async () => {
    const actual = await runForAnswer(scenario, scenario.contract.reference)
    expect(
      decodedEquals(actual, scenario.contract.expected),
      `reference produced ${JSON.stringify(actual)}, contract expects ` +
        `${JSON.stringify(scenario.contract.expected)}`,
    ).toBe(true)
  })

  it('the reference solution defines the entry point the harness calls', () => {
    expect(scenario.contract.reference).toContain(`def ${scenario.contract.entry}(`)
  })

  it('the starter code is not already the answer', async () => {
    const actual = await runForAnswer(scenario, scenario.starter)
    expect(decodedEquals(actual, scenario.contract.expected)).toBe(false)
  })

  it('every misconception is reachable and no two claim the same answer', () => {
    const ids = scenario.contract.misconceptions.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('no misconception fires on the correct answer', () => {
    for (const m of scenario.contract.misconceptions) {
      expect(
        m.when(scenario.contract.expected, scenario.world),
        `misconception "${m.id}" matches the CORRECT answer`,
      ).toBe(false)
    }
  })
})

describe('heavy-parcels misconceptions', () => {
  const inclusive = `def respond(parcels, limit):
    heavy = []
    for parcel in parcels:
        if parcel[1] >= limit:
            heavy.append(parcel[0])
    return heavy
`

  const weights = `def respond(parcels, limit):
    heavy = []
    for parcel in parcels:
        if parcel[1] > limit:
            heavy.append(parcel[1])
    return heavy
`

  const everything = `def respond(parcels, limit):
    heavy = []
    for parcel in parcels:
        heavy.append(parcel[0])
    return heavy
`

  const prints = `def respond(parcels, limit):
    for parcel in parcels:
        if parcel[1] > limit:
            print(parcel[0])
`

  it.each([
    ['inclusive-comparison', inclusive],
    ['returned-weights', weights],
    ['everything', everything],
    ['returned-none', prints],
  ])('%s is diagnosed from what Python really returns', async (id, solution) => {
    const actual = await runForAnswer(heavyParcels, solution)
    const hit = heavyParcels.contract.misconceptions.find((m) => m.when(actual, heavyParcels.world))
    expect(hit?.id, `answer ${JSON.stringify(actual)} matched ${hit?.id ?? 'nothing'}`).toBe(id)
  })

  it('the inclusive-comparison answer really differs from the correct one', async () => {
    const wrong = await runForAnswer(heavyParcels, inclusive)
    expect(decodedEquals(wrong, heavyParcels.contract.expected)).toBe(false)
  })
})
