/**
 * Practice: the Python subset, the generators, mastery and sessions.
 *
 * What these cannot check is that the Python subset agrees with CPython —
 * that is the browser suite's job, which types each generated answer into
 * the real interpreter and asks the judge about what came back.
 */
import { describe, expect, it } from 'vitest'
import { SKILLS } from '../../content/concepts'
import { LESSONS } from '../../content/lessons'
import { bin, evaluate, float, int, name, render, repr, str } from '../../src/practice/python'
import { GENERATORS, generate, rng, type Attempt } from '../../src/practice/exercises'
import { holdDays, level, record, strength, due, type Mastery } from '../../src/mastery/mastery'
import { planSession, SESSION_LENGTH } from '../../src/practice/session'
import { OPENING, SHELVED, WHO_WORKS, closingOf, mayStart, replyOf, scriptOf } from '../../src/practice/usePractice'
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
    // `char` is taught by Level 1b (content/lessons/types.ts), which is
    // being rewritten alongside this; drop it from here once that lesson
    // lists it in `teaches`.
    const pending = new Set(['char'])
    for (const s of SKILLS) {
      expect(GENERATORS[s.id], s.id).toBeDefined()
      if (!pending.has(s.id)) expect(taught.has(s.id), s.id).toBe(true)
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

/** Every exercise a skill's generator makes over many seeds, one per key. */
const spread = (skill: string, seeds = 400) => {
  const byKey = new Map<string, ReturnType<typeof generate>>()
  for (let seed = 0; seed < seeds; seed++) {
    const ex = generate(skill, seed)
    byKey.set(ex.key, ex)
  }
  return [...byKey.values()]
}

/** Misses a player might type, for any exercise: the ones every judge
 *  has to answer with a reason. */
const MISSES: Attempt[] = [
  attempt({ source: 'undefined_name', ok: false, error: 'NameError — the robot stopped there.' }),
  attempt({ source: '1 +', ok: false, error: 'SyntaxError — that is not a whole line.' }),
  attempt({ source: '999', thought: { type: 'int', repr: '999' } }),
  attempt({ source: '0.25', thought: { type: 'float', repr: '0.25' } }),
  attempt({ source: '"zz"', thought: { type: 'str', repr: "'zz'" } }),
  attempt({ source: 'True', thought: { type: 'bool', repr: 'True' } }),
  attempt({ source: 'true', ok: false, error: 'NameError — the robot stopped there.' }),
]

describe('what an exercise says', () => {
  it('says every line in one short sentence (R2)', () => {
    for (const s of SKILLS) {
      for (const ex of spread(s.id)) {
        const lines = [ex.say, ex.praise, ...(ex.lead ?? []), ...(ex.who ? [ex.who] : []), ...(ex.ask ? [ex.ask] : [])]
        for (const m of MISSES) {
          const j = ex.judge(m)
          if (j.why) lines.push(j.why)
        }
        for (const l of lines) expect(l.length, `${ex.key}: ${l}`).toBeLessThanOrEqual(110)
        // One sentence in the question: it stands alone (R3).
        expect(ex.say.split(/[.?!](\s|$)/).filter((x) => x && x.trim()).length, ex.say).toBeLessThanOrEqual(2)
        expect(ex.say, ex.key).not.toMatch(/^(Can|Could) (you|the robot)/)
      }
    }
  })

  it('declares who does the work, and a robot question refuses the typed answer (R4)', () => {
    for (const s of SKILLS) {
      for (const ex of spread(s.id)) {
        expect(['you', 'robot'], ex.key).toContain(ex.tag)
        if (ex.tag !== 'robot' || !ex.expect) continue
        // The answer itself, typed as a literal, is what a robot question
        // forbids: it has to be refused.
        const j = ex.judge(attempt({ source: ex.expect.repr, thought: ex.expect, snapshot: bound([]) }))
        expect(j.verdict, `${ex.key}: typed ${ex.expect.repr}`).toBe('wrong')
      }
    }
  })

  it('refuses the answer plus a no-op on a robot question: the working must be the question’s own', () => {
    // A probe found `6 + 0`, `3.0/1` and `'sunflower' + ""` passing: the
    // judges looked for *some* operator, not this question's working.
    const noOps = (ans: string) => [`${ans} + 0`, `${ans}*1`, `${ans} - 0`, `${ans}/1`, `(${ans}) * 1`, `${ans} + ""`]
    let checked = 0
    for (const s of SKILLS) {
      for (const ex of spread(s.id)) {
        if (ex.tag !== 'robot' || !ex.expect) continue
        for (const source of noOps(ex.expect.repr)) {
          const j = ex.judge(attempt({ source, thought: ex.expect, snapshot: bound([]) }))
          expect(j.verdict, `${ex.key}: ${source}`).toBe('wrong')
          expect(j.why, `${ex.key}: ${source}`).toBeTruthy()
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(100)
  })

  it('refuses robot work on every question that is yours, the same way everywhere (R4)', () => {
    // `3 > 5` on the balance was refused by one skill and accepted by
    // another: a `you` question now wants the answer typed as itself.
    for (const s of SKILLS) {
      for (const ex of spread(s.id)) {
        if (ex.tag !== 'you' || !ex.expect) continue
        const source = `${ex.answer} if True else 0`
        const j = ex.judge(attempt({ source, thought: ex.expect, snapshot: bound([]) }))
        expect(j.verdict, `${ex.key}: ${source}`).toBe('wrong')
      }
    }
    const bool = spread('bool').find((e) => e.key === 'bool:3:5')!
    const kind = spread('kind', 2000).find((e) => e.key === 'kind:Is 3 more than 5?')!
    for (const ex of [bool, kind]) {
      expect(ex.judge(attempt({ source: '3 > 5', thought: { type: 'bool', repr: 'False' } })).verdict, ex.key).toBe('wrong')
      expect(ex.judge(attempt({ source: 'False', thought: { type: 'bool', repr: 'False' } })).verdict, ex.key).toBe('correct')
    }
  })

  it('names the likeliest bool miss, a bare yes, without a word it has not taught', () => {
    const ex = spread('bool').find((e) => e.key.startsWith('bool:') && !e.key.includes('lamp'))!
    const j = ex.judge(attempt({ source: 'yes', ok: false, error: 'NameError — the robot stopped there.' }))
    expect(j.verdict).toBe('wrong')
    expect(j.why).toMatch(/`True` or `False`/)
    expect(j.why).not.toMatch(/NameError/)
  })

  it('tells the answer typed from the kept number typed, when asked to work from a name', () => {
    const ex = spread('recall')[0]!
    const [, n, k, each] = ex.key.split(':')
    const product = String(Number(k) * Number(each))
    const typed = ex.judge(attempt({ source: product, thought: { type: 'int', repr: product } }))
    expect(typed.why).toMatch(/let the robot work it out from/)
    expect(typed.why).not.toContain(`from ${k}`)
    const fromK = ex.judge(attempt({ source: `${k} * ${each}`, thought: { type: 'int', repr: product } }))
    expect(fromK.why).toContain(`not from ${k}`)
    expect(ex.judge(attempt({ source: `${n} * ${each}`, thought: { type: 'int', repr: product } })).verdict).toBe('correct')
  })

  it('names a reason whenever it says no (R10)', () => {
    for (const s of SKILLS) {
      for (const ex of spread(s.id, 100)) {
        for (const m of MISSES) {
          const j = ex.judge(m)
          if (j.verdict === 'wrong') expect(j.why, `${ex.key}: ${m.source}`).toBeTruthy()
        }
      }
    }
  })

  it('the robot-or-you split matches the questions', () => {
    const tagOf = (skill: string) => new Set(spread(skill).map((e) => e.tag))
    for (const s of ['int', 'float', 'char', 'str', 'bool', 'kind', 'rebind', 'bind']) expect([...tagOf(s)], s).toEqual(['you'])
    for (const s of ['arith', 'divide', 'join', 'compare', 'alias', 'recall']) expect([...tagOf(s)], s).toEqual(['robot'])
    expect(tagOf('order')).toEqual(new Set(['you', 'robot']))
  })
})

describe('the char exercises', () => {
  const chars = spread('char')
  const one = chars.find((e) => e.key.startsWith('char:first:'))!
  const word = one.key.split(':')[2]!
  const letter = word[0]!

  it('are judged as a str one character long, since Python has no char type (R8)', () => {
    for (const ex of chars) {
      expect(ex.expect!.type).toBe('str')
      expect(JSON.parse(ex.answer).length).toBe(1)
      expect(ex.show?.kind).toBe('tiles')
    }
    expect(chars.some((e) => e.key.startsWith('char:name:'))).toBe(true)
    expect(chars.some((e) => e.key.startsWith('char:last:'))).toBe(true)
  })

  it('names the whole word, the missing quotes and two letters as different mistakes', () => {
    const whole = one.judge(attempt({ source: `"${word}"`, thought: { type: 'str', repr: `'${word}'` } }))
    expect(whole.verdict).toBe('wrong')
    expect(whole.why).toMatch(/whole word/)
    const bare = one.judge(attempt({ source: letter, ok: false, error: 'NameError — the robot stopped there.' }))
    expect(bare.why).toMatch(/quotes/)
    const two = one.judge(attempt({ source: `"${word.slice(0, 2)}"`, thought: { type: 'str', repr: `'${word.slice(0, 2)}'` } }))
    expect(two.why).toMatch(/2 characters/)
    const empty = one.judge(attempt({ source: '""', thought: { type: 'str', repr: "''" } }))
    expect(empty.why).toMatch(/nothing/)
    expect(one.judge(attempt({ source: `"${letter}"`, thought: { type: 'str', repr: `'${letter}'` } })).verdict).toBe('correct')
  })

  it('tells a small letter from a capital', () => {
    const mira = chars.find((e) => e.key === 'char:name:Mira')!
    const small = mira.judge(attempt({ source: '"m"', thought: { type: 'str', repr: "'m'" } }))
    expect(small.verdict).toBe('wrong')
    expect(small.why).toMatch(/capital/)
  })

  it('are among the kind questions too', () => {
    const kinds = spread('kind', 2000).filter((e) => e.expect?.type === 'str' && JSON.parse(e.answer).length === 1)
    expect(kinds.length).toBeGreaterThan(0)
    for (const ex of kinds) {
      expect(ex.praise).toMatch(/length one/)
      const whole = ex.judge(attempt({ source: '"gear"', thought: { type: 'str', repr: "'gear'" } }))
      expect(whole.verdict).toBe('wrong')
    }
  })
})

describe('when the next exercise starts', () => {
  it('starts the first at once, and any other once its praise is read', () => {
    expect(mayStart(0, null)).toBe(true)
    expect(mayStart(0, 0)).toBe(true)
    // Unpaced: nobody says which line is told, so it starts at once.
    expect(mayStart(3, null)).toBe(true)
    // Paced: line 0 is the praise, read over the last answer's evidence.
    expect(mayStart(3, 0)).toBe(false)
    expect(mayStart(3, 1)).toBe(true)
  })
})

describe("a session's script", () => {
  const exercises = planSession(['int', 'arith', 'char', 'bool', 'compare'], {}, 1_000_000_000_000, 3)

  it('opens on what practice is, then who works, then the question', () => {
    const items = scriptOf(exercises, 0, null)
    expect(items[0]!.text).toBe(OPENING)
    expect(items[1]!.text).toBe(exercises[0]!.who ?? WHO_WORKS[exercises[0]!.tag])
    const ask = items[items.length - 1]!
    expect(ask.kind).toBe('ask')
    expect(ask.asking).toBe(true)
    expect(ask.tag).toBe(exercises[0]!.tag)
    expect(ask.text).toBe(exercises[0]!.say)
    for (const i of items.slice(0, -1)) expect(i.asking).toBe(false)
  })

  it('praises the last answer as its own beat, before the next question', () => {
    const items = scriptOf(exercises, 1, null)
    expect(items[0]!.kind).toBe('praise')
    expect(items[0]!.text).toContain(exercises[0]!.praise)
    expect(items[0]!.asking).toBe(false)
    expect(items[items.length - 1]!.text).toBe(exercises[1]!.say)
    // Who works is said only when it changes.
    const says = items.some((i) => i.text === (exercises[1]!.who ?? WHO_WORKS[exercises[1]!.tag]))
    expect(says).toBe(exercises[0]!.tag !== exercises[1]!.tag)
  })

  it('puts a miss where the question was, and a working line after two', () => {
    const one = scriptOf(exercises, 0, replyOf(exercises[0]!, 'A reason.', 1))
    expect(one[one.length - 1]!.kind).toBe('reply')
    expect(one[one.length - 1]!.text).toBe('A reason.')
    expect(one.length).toBe(scriptOf(exercises, 0, null).length)
    expect(replyOf(exercises[0]!, 'A reason.', 2)).toContain(`One way: \`${exercises[0]!.answer}\``)
  })

  it('closes on the shelf, then the tally', () => {
    const items = scriptOf(exercises, exercises.length, null, { right: 4, shelf: true })
    expect(items.map((i) => i.kind)).toEqual(['praise', 'outro', 'outro'])
    expect(items[1]!.text).toBe(SHELVED)
    expect(items[2]!.text).toBe(closingOf(4, exercises.length))
  })

  it('keeps every line it says short (R2)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const ex = planSession(SKILLS.map((s) => s.id), {}, 0, seed)
      for (let at = 0; at <= ex.length; at++) {
        for (const i of scriptOf(ex, at, null, { right: 5, shelf: true })) expect(i.text.length, i.text).toBeLessThanOrEqual(110)
      }
    }
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
