/**
 * Practice: the Python subset, the generators, mastery and sessions.
 *
 * What these cannot check is that the Python subset agrees with CPython —
 * that is the browser suite's job, which types each generated answer into
 * the real interpreter and asks the judge about what came back.
 */
import { describe, expect, it } from 'vitest'
import { SKILLS } from '../../content/skills'
import { LESSONS } from '../../content/lessons'
import { bin, evaluate, float, int, name, render, repr, str } from '../../src/practice/python'
import { GENERATORS, generate, rng, type Attempt } from '../../src/practice/exercises'
import { holdDays, level, record, strength, due, type Mastery } from '../../src/mastery/mastery'
import { planSession, SESSION_LENGTH } from '../../src/practice/session'
import { EMPTY, type MemorySnapshot } from '../../src/memory/model'

const v = (e: Parameters<typeof evaluate>[0], env = {}) => repr(evaluate(e, env))

describe('the Python subset', () => {
  it('divides into a float, always', () => {
    expect(v(bin('/', int(8), int(2)))).toBe('4.0')
    expect(v(bin('/', int(9), int(2)))).toBe('4.5')
    expect(v(bin('/', int(7), int(3)))).toBe('2.3333333333333335')
  })

  it('floors // and % towards negative infinity, as Python does', () => {
    expect(v(bin('//', int(-7), int(2)))).toBe('-4')
    expect(v(bin('%', int(-7), int(3)))).toBe('2')
    expect(v(bin('%', int(7), int(-3)))).toBe('-2')
  })

  it('keeps ints as ints and floats as floats', () => {
    expect(v(bin('*', int(7), int(6)))).toBe('42')
    expect(v(bin('+', int(1), float(2)))).toBe('3.0')
  })

  it("writes strings as Python's repr does", () => {
    expect(repr({ t: 'str', v: 'bot' })).toBe("'bot'")
    expect(repr({ t: 'str', v: "it's" })).toBe('"it\'s"')
    expect(v(bin('+', str('bot'), str('gineer')))).toBe("'botgineer'")
    expect(v(bin('*', str('ab'), int(3)))).toBe("'ababab'")
  })

  it('compares, and answers with a bool', () => {
    expect(v(bin('>', int(3), int(5)))).toBe('False')
    expect(v(bin('==', int(2), float(2)))).toBe('True')
  })

  it('brackets only where the tree needs them', () => {
    expect(render(bin('+', int(2), bin('*', int(3), int(4))))).toBe('2 + 3 * 4')
    expect(render(bin('*', bin('+', int(2), int(3)), int(4)))).toBe('(2 + 3) * 4')
    expect(render(bin('-', int(9), bin('-', int(4), int(1))))).toBe('9 - (4 - 1)')
  })

  it('looks names up, and says so when one is missing', () => {
    expect(v(bin('*', name('crates'), int(3)), { crates: { t: 'int', v: 4 } })).toBe('12')
    expect(() => evaluate(name('nope'))).toThrow(/NameError/)
  })
})

/** An attempt, as the workbench would report it. */
const attempt = (over: Partial<Attempt>): Attempt => ({
  source: '',
  ok: true,
  error: null,
  thought: null,
  snapshot: EMPTY,
  ...over,
})

const bound = (pairs: [string, string, string][]): MemorySnapshot => ({
  bindings: pairs.map(([n, id]) => ({ name: n, scope: 'global', target: id })),
  objects: Object.fromEntries(
    pairs.map(([, id, r]) => [id, { id, type: 'int', kind: 'value' as const, repr: r, elements: null, partial: false }]),
  ),
  line: null,
})

describe('the generators', () => {
  it('cover every skill, and every skill is taught by some lesson', () => {
    const taught = new Set(Object.values(LESSONS).flatMap((l) => l.teaches))
    for (const s of SKILLS) {
      expect(GENERATORS[s.id], s.id).toBeDefined()
      expect(taught.has(s.id), s.id).toBe(true)
    }
  })

  it('are deterministic in their seed', () => {
    for (const s of SKILLS) expect(generate(s.id, 42).key).toBe(generate(s.id, 42).key)
  })

  it('vary with the seed', () => {
    for (const s of SKILLS) {
      const keys = new Set(Array.from({ length: 30 }, (_, i) => generate(s.id, i).key))
      expect(keys.size, s.id).toBeGreaterThan(3)
    }
  })

  it("accept their own answer, on every seed", () => {
    // Memory after running `name = <int or name>` lines, which is every
    // setup and every assignment answer a generator produces.
    const memoryOf = (lines: string[]): MemorySnapshot => {
      const env = new Map<string, string>()
      for (const line of lines) {
        const m = /^(\w+) = (\w+)$/.exec(line)
        if (!m) continue
        env.set(m[1]!, /^\d+$/.test(m[2]!) ? m[2]! : env.get(m[2]!)!)
      }
      return bound([...env].map(([n, r]) => [n, `v:int:${r}`, r]))
    }
    for (const s of SKILLS) {
      for (let seed = 0; seed < 3000; seed++) {
        const ex = generate(s.id, seed)
        const assigns = /^\w+ = \w+$/.test(ex.answer)
        const a = attempt({
          source: ex.answer,
          thought: ex.expect ?? null,
          snapshot: memoryOf([...ex.setup, ...(assigns ? [ex.answer] : [])]),
        })
        const j = ex.judge(a)
        expect(j.verdict, `${ex.key}: ${ex.answer} → ${j.why}`).toBe('correct')
      }
    }
  })

  it('ignore a line that is not an answer at all', () => {
    for (const s of ['int', 'arith', 'join', 'compare']) {
      expect(generate(s, 1).judge(attempt({ source: 'x = 1', snapshot: bound([['x', 'v:1', '1']]) })).verdict).toBe(
        'ignore',
      )
    }
  })

  it('tell a missing quote from a wrong word', () => {
    const ex = generate('str', 3)
    const word = ex.answer.slice(1, -1)
    const noQuotes = ex.judge(attempt({ source: word, ok: false, error: 'NameError — the robot stopped there.' }))
    expect(noQuotes.verdict).toBe('wrong')
    expect(noQuotes.why).toMatch(/quotes/)
    expect(ex.judge(attempt({ source: ex.answer, thought: { type: 'str', repr: `'${word}'` } })).verdict).toBe('correct')
  })

  it('catch * before + in a prediction', () => {
    // Seeds are searched rather than hard-coded, so the test survives the
    // generator changing its numbers.
    const ex = Array.from({ length: 50 }, (_, i) => generate('order', i)).find((e) => e.key.includes('predict'))!
    const [, , x, y, z] = ex.key.split(':').map(Number)
    const wrong = ex.judge(attempt({ source: String((x! + y!) * z!), thought: { type: 'int', repr: String((x! + y!) * z!) } }))
    expect(wrong.why).toMatch(/left to right/)
    expect(ex.judge(attempt({ source: ex.answer, thought: { type: 'int', repr: ex.answer } })).verdict).toBe('correct')
    // Letting the robot work it out is not predicting.
    expect(ex.judge(attempt({ source: ex.say.match(/`([^`]+)`/)![1]!, thought: { type: 'int', repr: ex.answer } })).verdict).toBe(
      'wrong',
    )
  })

  it('know a copied name does not follow the original', () => {
    const ex = generate('rebind', 5)
    const [, , v1, v2] = ex.key.split(':')
    expect(ex.judge(attempt({ source: v1! })).verdict).toBe('correct')
    expect(ex.judge(attempt({ source: v2! })).why).toMatch(/does not follow/)
  })

  it('want the name used, not the number typed again', () => {
    const ex = generate('alias', 2)
    const [, a, b, n] = ex.key.split(':')
    const same = bound([
      [a!, `v:int:${n}`, n!],
      [b!, `v:int:${n}`, n!],
    ])
    expect(ex.judge(attempt({ source: `${b} = ${a}`, snapshot: same })).verdict).toBe('correct')
    expect(ex.judge(attempt({ source: `${b} = ${n}`, snapshot: same })).why).toMatch(/typed/)
  })

  it('say when something was named, just not the right thing', () => {
    const ex = generate('bind', 4)
    const j = ex.judge(attempt({ source: 'zz = 1', snapshot: bound([['zz', 'v:1', '1']]) }))
    expect(j.verdict).toBe('wrong')
    expect(j.why).toMatch(/name should be/)
  })
})

describe('mastery', () => {
  const t0 = 1_000_000_000_000
  const DAY = 86_400_000

  it('climbs to mastered with five right first time', () => {
    let m: Mastery = {}
    const seen: string[] = []
    for (let i = 0; i < 5; i++) {
      m = record(m, 'int', true, t0)
      seen.push(level(m.int, t0))
    }
    expect(seen).toEqual(['attempted', 'familiar', 'proficient', 'proficient', 'mastered'])
  })

  it('is set back by a miss, and the streak with it', () => {
    let m: Mastery = {}
    for (let i = 0; i < 5; i++) m = record(m, 'int', true, t0)
    m = record(m, 'int', false, t0)
    expect(m.int!.streak).toBe(0)
    expect(level(m.int, t0)).not.toBe('mastered')
    expect(m.int!.tries).toBe(6)
    expect(m.int!.right).toBe(5)
  })

  it('fades with time, but never below half', () => {
    const m = record({}, 'int', true, t0)
    expect(strength(m.int, t0)).toBeCloseTo(0.35)
    expect(strength(m.int, t0 + 400 * DAY)).toBeCloseTo(0.175, 2)
    expect(due(m.int, t0)).toBe(false)
    expect(due(m.int, t0 + 30 * DAY)).toBe(true)
  })

  it('holds longer the longer the streak', () => {
    expect(holdDays(0)).toBeLessThan(holdDays(3))
    expect(holdDays(10)).toBe(holdDays(4))
  })

  it('starts from nothing for a skill never tried', () => {
    expect(level(undefined, t0)).toBe('new')
    expect(strength(undefined, t0)).toBe(0)
    expect(due(undefined, t0)).toBe(true)
  })
})

describe('a session', () => {
  const pool = ['int', 'float', 'str', 'bool', 'arith']
  const now = 1_000_000_000_000

  it('has the right length, from the pool, and never the same question twice', () => {
    const s = planSession(pool, {}, now, 7)
    expect(s).toHaveLength(SESSION_LENGTH)
    expect(s.every((e) => pool.includes(e.skill))).toBe(true)
    expect(new Set(s.map((e) => e.key)).size).toBe(s.length)
  })

  it('never asks the same skill twice running', () => {
    for (let seed = 0; seed < 40; seed++) {
      const s = planSession(pool, {}, now, seed)
      for (let i = 1; i < s.length; i++) expect(s[i]!.skill).not.toBe(s[i - 1]!.skill)
    }
  })

  it('asks more about what is weak', () => {
    let m: Mastery = {}
    for (const s of ['int', 'float', 'str', 'bool']) for (let i = 0; i < 6; i++) m = record(m, s, true, now)
    let weak = 0
    let total = 0
    for (let seed = 0; seed < 200; seed++) {
      for (const e of planSession(pool, m, now, seed)) {
        total++
        if (e.skill === 'arith') weak++
      }
    }
    // One skill in five, but asked about far more than a fifth of the time.
    expect(weak / total).toBeGreaterThan(0.3)
  })

  it('is the same session for the same seed', () => {
    expect(planSession(pool, {}, now, 99).map((e) => e.key)).toEqual(planSession(pool, {}, now, 99).map((e) => e.key))
  })

  it('is empty for an empty pool', () => {
    expect(planSession([], {}, now, 1)).toEqual([])
  })

  it('draws from a seeded generator, not Math.random', () => {
    const r = rng(1)
    expect(r()).toBe(rng(1)())
  })
})
