/**
 * What memory draws on each card is what Python prints, for values the
 * decoder leaves alone or used to get wrong: checked against real CPython
 * running in the shipped engine. Found by the sandbox stress run.
 */
import { describe, expect, it } from 'vitest'
import { trace } from './engine'
import { extractMemory } from '../../src/memory/extract'
import type { StepRecord } from '../../src/runtime/types'
import type { MemorySnapshot } from '../../src/memory/model'

async function memoryOf(source: string): Promise<MemorySnapshot> {
  const steps = (await trace(source)).filter((r): r is StepRecord => r.kind === 'step')
  return extractMemory(steps.at(-1)!)
}
const reprOf = (m: MemorySnapshot, name: string) => m.objects[m.bindings.find((b) => b.name === name)!.target]!.repr

describe('a card says what Python would print', () => {
  it('for the values the decoder leaves to memory', async () => {
    const m = await memoryOf(
      [
        'big = 2 ** 100',
        'negbig = -(10 ** 30)',
        'c = 3 + 4j',
        'imag = 4j',
        'neg = 1.5 - 2j',
        'b = b"ab\\x00\\n\\xff"',
        'bq = b"it\'s"',
        'r = range(3)',
        'r2 = range(10, 0, -2)',
        'f1 = 1e16',
        'f2 = 0.000015',
        'f3 = 0.0001',
        'f4 = 123456789.0',
        's1 = "it\'s"',
        's2 = \'say "hi"\'',
        's3 = "both \' and \\""',
        's4 = "tab\\there\\\\slash"',
        'x = 0',
      ].join('\n') + '\n',
    )
    expect(Object.fromEntries(m.bindings.map((b) => [b.name, reprOf(m, b.name)]))).toEqual({
      big: '1267650600228229401496703205376',
      negbig: '-1000000000000000000000000000000',
      c: '(3+4j)',
      imag: '4j',
      neg: '(1.5-2j)',
      b: "b'ab\\x00\\n\\xff'",
      bq: 'b"it\'s"',
      r: 'range(0, 3)',
      r2: 'range(10, 0, -2)',
      f1: '1e+16',
      f2: '1.5e-05',
      f3: '0.0001',
      f4: '123456789.0',
      s1: '"it\'s"',
      s2: '\'say "hi"\'',
      s3: "'both \\' and \"'",
      s4: "'tab\\there\\\\slash'",
      x: '0',
    })
    // A big int is an int, not a str that happens to be digits.
    expect(m.objects[m.bindings.find((b) => b.name === 'big')!.target]!.type).toBe('int')
  })

  it("draws an object's attributes as pointers, labelled the way Python reaches them", async () => {
    const m = await memoryOf('class Robot:\n    kind = "bot"\n    def __init__(self):\n        self.name = "S"\n        self.parts = [1]\nr = Robot()\n')
    const r = m.objects[m.bindings.find((b) => b.name === 'r')!.target]!
    expect(r).toMatchObject({ type: 'Robot', repr: 'Robot object', holds: 'attributes' })
    expect(r.elements!.map((e) => [e.label, m.objects[e.target]!.repr])).toEqual([
      ['.name', "'S'"],
      ['.parts', '1 item'],
    ])
    const cls = m.objects[m.bindings.find((b) => b.name === 'Robot')!.target]!
    expect(cls.repr).toBe('class Robot')
    expect(cls.elements!.map((e) => e.label)).toContain('.kind')
  })

  it('keeps one object for an instance that points at itself', async () => {
    const m = await memoryOf('class N:\n    pass\nn = N()\nn.me = n\n')
    const n = m.bindings.find((b) => b.name === 'n')!.target
    expect(m.objects[n]!.elements).toEqual([{ label: '.me', target: n }])
  })
})

describe('each live call is a scope of its own', () => {
  it('numbers the deeper calls of a recursive function, outermost first', async () => {
    const steps = (await trace('def down(n):\n    if n == 0:\n        return 0\n    return down(n - 1)\ndown(2)\n')).filter((r): r is StepRecord => r.kind === 'step')
    // The deepest moment: three calls live, n = 2, 1, 0.
    const deepest = steps.map(extractMemory).find((m) => m.bindings.filter((b) => b.name === 'n').length === 3)!
    const ns = deepest.bindings.filter((b) => b.name === 'n').map((b) => [b.scope, deepest.objects[b.target]!.repr])
    expect(ns).toEqual([
      ['down', '2'],
      ['down#2', '1'],
      ['down#3', '0'],
    ])
  })
})
