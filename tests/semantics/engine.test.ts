import { describe, expect, it } from 'vitest'
import { trace } from './engine'
import type { StepRecord } from '../../src/runtime/types'

describe('the engine in node', () => {
  it('runs a program and reports its output, lines and function defaults', async () => {
    const rs = await trace('def f(x, log=[]):\n    log.append(x)\n    return log\nprint(f(1))\n')
    const steps = rs.filter((r): r is StepRecord => r.kind === 'step')
    expect(steps.map((s) => s.output.stdout_delta).join('')).toBe('[1]\n')
    expect(rs.at(-1)).toMatchObject({ kind: 'terminal', reason: 'completed' })
    const fn = steps.at(-1)!.heap.find((n) => n.kind === 'function')!
    expect(fn.defaults).toEqual([{ kind: 'ref', uid: expect.anything() }])
  })
})
