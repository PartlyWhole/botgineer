/**
 * Stage 6's ideas, as a lesson: memory in, step out. The steps to guard
 * are the prediction (a typed list, not one the robot worked out), and
 * the loops, which a line typed out by hand must not pass for.
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, s6Ideas, script, type Evidence } from '../../../content/lessons'
import type { Binding, MemorySnapshot, PyObject } from '../../../src/memory/model'
import { NOTHING, failed, line, snap, th, value } from './fixtures'

/** A tiny heap: values by repr, collections by uid. */
type Mem = { objects: PyObject[]; bindings: Binding[] }
const v = (type: string, repr: string) => value(type, repr)
const seq = (id: string, type: 'list' | 'tuple' | 'dict' | 'generator', targets: string[], labels?: string[]): PyObject => ({
  id,
  type,
  kind: 'reference',
  repr: type === 'generator' ? '<generator>' : `${targets.length} items`,
  elements: type === 'generator' ? null : targets.map((t, i) => ({ label: labels ? labels[i]! : String(i), target: t })),
  partial: false,
})
const bind = (name: string, target: string): Binding => ({ name, scope: 'global', target })
const S = (...parts: Mem[]): MemorySnapshot =>
  snap(
    parts.flatMap((p) => p.objects),
    parts.flatMap((p) => p.bindings),
  )

const INT = (n: number) => v('int', String(n))
const STR = (s: string) => v('str', `'${s}'`)
const values: Mem = {
  objects: [INT(0), INT(1), INT(2), INT(3), INT(4), INT(5), INT(8), STR('tea'), STR('jam'), STR('t'), STR('e'), STR('a')],
  bindings: [],
}
const prices: Mem = {
  objects: [seq('d', 'dict', [INT(3).id, INT(5).id], ["'tea'", "'jam'"])],
  bindings: [bind('prices', 'd')],
}
const got = (id: string, ...keys: string[]): Mem => ({
  objects: [seq(id, 'list', keys.map((k) => STR(k).id))],
  bindings: [bind('got', id)],
})
const name = (n: string, target: string): Mem => ({ objects: [], bindings: [bind(n, target)] })

const ev = (history: MemorySnapshot[], ...said: [string, string, string][]): Evidence => ({
  snapshot: history[history.length - 1]!,
  history,
  thoughts: said.map(([type, repr, source]) => ({ ...th(type, repr), source })),
})

describe('s6-ideas', () => {
  const at = (e: Evidence) => progress(s6Ideas, e)

  it('opens on Mira’s price list, before its first question', () => {
    const s = script(s6Ideas, NOTHING)
    expect(s.items[0]!.text).toContain('got the names of things back, not the prices')
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', text: 'Type `prices = {"tea": 3, "jam": 5}`.' })
  })

  it('keeps every beat and ask to one short line', () => {
    const lines = s6Ideas.steps.flatMap((s) => [s.say, ...(s.beats ?? []).map((b) => b.say)])
    for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(110)
  })

  it('gives each formal word its own beat, after the thing it names', () => {
    const beats = s6Ideas.steps.flatMap((s) => (s.beats ?? []).map((b) => b.say))
    const where = (term: string) => beats.findIndex((b) => b.includes(`The formal word is **${term}**.`))
    for (const term of ['binding', 'iterable', 'loop variable', 'block', 'control flow']) {
      expect(where(term), term).toBeGreaterThan(-1)
      expect(beats[where(term)]).toMatch(/^You've been saying \*[^*]+\*\. The formal word is \*\*[a-z ]+\*\*\.$/)
    }
    // The loop ran before its words were said.
    const step = (term: string) => s6Ideas.steps.findIndex((s) => (s.beats ?? []).some((b) => b.say.includes(`**${term}**`)))
    const loop = s6Ideas.steps.findIndex((s) => s.say.startsWith('Type `for x in prices:`'))
    expect(step('iterable')).toBeGreaterThan(loop)
    expect(step('loop variable')).toBeGreaterThan(loop)
  })

  it('walks the dict, the prediction, the loop, pairs, the total, the comprehension, the generator, enumerate', () => {
    const base = S(values, prices)
    expect(at(ev([base]))).toBe(1)
    const empty = S(values, prices, got('g'))
    expect(at(ev([base, empty]))).toBe(2)

    // The prediction must be a typed list, not one the robot worked out.
    expect(at(ev([base, empty], ['list', "['tea', 'jam']", 'got']))).toBe(2)
    expect(at(ev([base, empty], ['list', "['tea', 'jam']", 'list(prices)']))).toBe(2)
    // Any typed list is a prediction: the run is what checks it.
    const guess: [string, string, string] = ['list', '[3, 5]', '[3, 5]']
    expect(at(ev([base, empty], guess))).toBe(3)

    // Rebinding `got` to a list typed out by hand is not the loop.
    expect(at(ev([base, empty, S(values, prices, got('h', 'tea', 'jam'))], guess))).toBe(3)
    const looped = S(values, prices, got('g', 'tea', 'jam'), name('x', STR('jam').id))
    expect(at(ev([base, empty, looped], guess))).toBe(4)

    const pairs: Mem = {
      objects: [seq('t1', 'tuple', [STR('tea').id, INT(3).id]), seq('t2', 'tuple', [STR('jam').id, INT(5).id]), seq('p', 'list', ['t1', 't2'])],
      bindings: [bind('got', 'p')],
    }
    const withPairs = S(values, prices, pairs)
    const h = [base, empty, looped, withPairs]
    expect(at(ev(h, guess))).toBe(5)

    // `total = 8` typed by hand leaves no loop variables behind.
    const zero = S(values, prices, pairs, name('total', INT(0).id))
    expect(at(ev([...h, zero, S(values, prices, pairs, name('total', INT(8).id))], guess))).toBe(5)
    const summed = S(values, prices, pairs, name('total', INT(8).id), name('k', STR('jam').id), name('v', INT(5).id))
    h.push(zero, summed)
    expect(at(ev(h, guess))).toBe(6)

    const cheap: Mem = { objects: [seq('c', 'list', [STR('tea').id])], bindings: [bind('cheap', 'c')] }
    h.push(S(values, prices, cheap))
    expect(at(ev(h, guess))).toBe(7)

    const gen: Mem = { objects: [seq('q', 'generator', [])], bindings: [bind('squares', 'q')] }
    h.push(S(values, gen))
    expect(at(ev(h, guess))).toBe(8)

    const first: Mem = { objects: [seq('f', 'list', [INT(0).id, INT(1).id, INT(4).id])], bindings: [bind('first', 'f')] }
    h.push(S(values, gen, first))
    expect(at(ev(h, guess))).toBe(8)
    const again: Mem = { objects: [seq('a', 'list', [])], bindings: [bind('again', 'a')] }
    h.push(S(values, gen, first, again))
    expect(at(ev(h, guess))).toBe(9)

    const nums: Mem = {
      objects: [
        seq('n0', 'tuple', [INT(0).id, STR('t').id]),
        seq('n1', 'tuple', [INT(1).id, STR('e').id]),
        seq('n2', 'tuple', [INT(2).id, STR('a').id]),
        seq('n', 'list', ['n0', 'n1', 'n2']),
      ],
      bindings: [bind('nums', 'n')],
    }
    h.push(S(values, nums))
    expect(at(ev(h, guess))).toBe(s6Ideas.steps.length)
  })

  it('says the guess back, without saying whether it was right, until the robot runs it', () => {
    const e = ev([S(values, prices), S(values, prices, got('g'))], ['list', '[3, 5]', '[3, 5]'])
    const s = script(s6Ideas, e)
    expect(s.items[0]).toMatchObject({ kind: 'praise' })
    expect(s.items[0]!.text).toContain('`[3, 5]`, you say')
  })

  it('answers a prediction that asked the robot, and a block that lost its indent', () => {
    const base = ev([S(values, prices), S(values, prices, got('g'))])
    // The line that did the step before is not a miss of this one.
    expect(guidance(s6Ideas, { ...base, last: line('got = []', null) }).text).toContain('Type the list you expect')
    const asked = guidance(s6Ideas, { ...base, last: line('list(prices)', th('list', "['tea', 'jam']")) })
    expect(asked.text).toContain('Predict it first')
    const unquoted = guidance(s6Ideas, { ...base, last: failed('[tea, jam]', 'NameError') })
    expect(unquoted.text).toContain('quotes')

    const predicted = { ...base, thoughts: [{ ...th('list', "['tea', 'jam']"), source: "['tea', 'jam']" }] }
    const flat = guidance(s6Ideas, { ...predicted, last: failed('for x in prices:\ngot.append(x)', 'IndentationError') })
    expect(flat.text).toContain('four spaces')
  })

  it('names the key when the total adds it', () => {
    const h = [S(values, prices), S(values, prices, got('g')), S(values, prices, got('g', 'tea', 'jam'))]
    const e = ev(h, ['list', "['tea', 'jam']", "['tea', 'jam']"])
    const pairs: Mem = {
      objects: [seq('t1', 'tuple', [STR('tea').id, INT(3).id]), seq('t2', 'tuple', [STR('jam').id, INT(5).id]), seq('p', 'list', ['t1', 't2'])],
      bindings: [bind('got', 'p')],
    }
    const e2 = { ...e, history: [...h, S(values, prices, pairs)], snapshot: S(values, prices, pairs) }
    const g = guidance(s6Ideas, { ...e2, last: failed('for k, v in prices.items():\n    total = total + k', 'TypeError') })
    expect(g.text).toContain('`k` is the key')
  })
})
