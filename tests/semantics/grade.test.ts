/**
 * The graders on crafted misses, against real Python, and the variants
 * against the engine.
 *
 * The sweep proves the key's answers pass. This proves the wrong ones do
 * not — that each grader rejects the mistake its exercise was written to
 * catch, and says so helpfully when it can.
 */
import { describe, expect, it } from 'vitest'
import { playable } from '../../src/collection'
import { gradePart } from '../../src/collection/grade'
import { prepare, runProgram, originalOf } from '../../src/collection/runner'
import { FAMILIES, variantId } from '../../src/collection/variants'
import type { Part } from '../../src/collection/model'
import { evaluate } from './engine'

const truthOf = async (id: string) => {
  const p = playable(id)
  return { p, truth: await prepare(p, evaluate) }
}

describe('a wrong answer is wrong', () => {
  it('1.2: "y follows x" prints 9 9, and that is a miss', async () => {
    const { p, truth } = await truthOf('1.2')
    const g = gradePart(p.spec.parts[0]!, { kind: 'output', text: '9 9', raises: null }, truth)
    expect(g.right).toBe(false)
    expect(g.expected).toBe('9 4')
  })

  it('1.2: quote style and doubled spaces are presentation, not the answer', async () => {
    const { p, truth } = await truthOf('2.2')
    const g = gradePart(p.spec.parts[0]!, { kind: 'output', text: '[1,  2, 3]\n[1, 2, 3]', raises: null }, truth)
    expect(g.right).toBe(true)
    expect(g.note).toMatch(/single/)
  })

  it('C1.1: the right (empty) output without the NameError is a miss that says why', async () => {
    const { p, truth } = await truthOf('C1.1')
    const g = gradePart(p.spec.parts[0]!, { kind: 'output', text: '', raises: null }, truth)
    expect(g.right).toBe(false)
    const g2 = gradePart(p.spec.parts[0]!, { kind: 'output', text: '', raises: 'NameError' }, truth)
    expect(g2.right).toBe(true)
  })

  it('1.4: numbering 1 2 4 3 5 is caught at the third visit', async () => {
    const { p, truth } = await truthOf('1.4')
    const g = gradePart(p.spec.parts[0]!, { kind: 'order', lines: [1, 2, 4, 3, 5] }, truth)
    expect(g.right).toBe(false)
    expect(g.why).toBe('Visit 3 is line 3, not line 4.')
  })

  it('1.5: line 3 is not where A and B part ways', async () => {
    const { p, truth } = await truthOf('1.5')
    const part = p.spec.parts.find((x) => x.kind === 'line')!
    expect(gradePart(part, { kind: 'line', line: 3 }, truth).right).toBe(false)
    expect(gradePart(part, { kind: 'line', line: 2 }, truth).right).toBe(true)
  })

  it('1.3: every wrong picture is wrong, and only the truth is right', async () => {
    const { p, truth } = await truthOf('1.3')
    const d = truth.diagrams!.get(0)!
    d.options.forEach((_, i) => {
      expect(gradePart(p.spec.parts[0]!, { kind: 'diagram', picked: i }, truth, { index: 0 }).right).toBe(i === d.answer)
    })
  })

  it('1.8: a fix that only changes the print is rejected, with the reason', async () => {
    const { p, truth } = await truthOf('1.8')
    const part = p.spec.parts.find((x) => x.kind === 'fix') as Part & { kind: 'fix' }
    const cheat = 'a = 1\nb = 2\na = b\nb = a\nprint(2, 1)\n'
    const program = await runProgram(part, cheat, evaluate)
    const g = gradePart(part, { kind: 'fix', source: cheat }, { ...truth, program }, { index: 2, original: originalOf(p, part) })
    expect(g.right).toBe(false)
    expect(g.why).toMatch(/`a` should point at 2/)
  })

  it('1.13: two separate lists are not one list, however alike', async () => {
    const { p, truth } = await truthOf('1.13')
    const part = p.spec.parts[0] as Part & { kind: 'write' }
    const wrong = 'm = [1, 2]\nn = [1, 2]\nprint(m == n)\n'
    const program = await runProgram(part, wrong, evaluate)
    const g = gradePart(part, { kind: 'write', source: wrong }, { ...truth, program }, { index: 0 })
    expect(g.right).toBe(false)
    expect(g.why).toMatch(/same list object/)
  })

  it('5.1: the line after the loop is not in the body', async () => {
    const { p, truth } = await truthOf('5.1')
    const part = p.spec.parts.find((x) => x.kind === 'block') as Part & { kind: 'block' }
    const g = gradePart(part, { kind: 'block', body: [...part.model.body, 5], counts: part.model.counts ?? {} }, truth)
    expect(g.right).toBe(false)
  })

  it('9.C3: the three-separate-rows picture of the capstone board is wrong', async () => {
    const { p, truth } = await truthOf('9.C3')
    const index = p.spec.parts.findIndex((x) => x.kind === 'diagram')
    const d = truth.diagrams!.get(index)!
    const separate = d.options.findIndex((o) => o.transform === 'shared-inner-to-separate')
    expect(separate).toBeGreaterThanOrEqual(0)
    expect(gradePart(p.spec.parts[index]!, { kind: 'diagram', picked: separate }, truth, { index }).right).toBe(false)
  })
})

describe('the variants run', () => {
  for (const f of FAMILIES) {
    it(`${f.id} runs to the end, and prints something, for many seeds`, async () => {
      const bad: string[] = []
      for (let seed = 1; seed <= 40; seed++) {
        const p = playable(variantId(f.id, seed * 7919))
        const ev = await evaluate(p.snippets[0]!.code)
        if (ev.reason !== 'completed' || ev.output.trim() === '') bad.push(`seed ${seed}: ${ev.reason} ${ev.raised ?? ''}\n${p.snippets[0]!.code}`)
        // The run is the key: its own output is right, and something else is not.
        const truth = await prepare(p, evaluate)
        const part = p.spec.parts[0]!
        if (!gradePart(part, { kind: 'output', text: ev.output, raises: null }, truth).right) bad.push(`seed ${seed}: own output wrong`)
        if (gradePart(part, { kind: 'output', text: ev.output + '\nextra', raises: null }, truth).right) bad.push(`seed ${seed}: extra passes`)
      }
      expect(bad).toEqual([])
    })
  }
})
