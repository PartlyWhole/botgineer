/**
 * v2, Memories (`v2-bind`): binding shown a step at a time and asked, then
 * goal memories the player builds, with a wipe to start again.
 *
 * A small stand-in for the console plays lines into evidence: each
 * accepted line leaves its memory in `history` and `lines`, a bare name
 * leaves a thought, and a wipe is an entry with no source and an empty
 * memory, as the workbench keeps them.
 */
import { describe, expect, it } from 'vitest'
import { progress, script, type Evidence, type Heard, type LineMemory, type Pick } from '../../../content/lessons'
import { bindLesson, goals } from '../../../content/lessons/v2/bind'
import type { MemorySnapshot } from '../../../src/memory/model'
import { EMPTY, bound, snap } from './fixtures'

type V = { type: string; v: number | string }

function valueOf(token: string, env: Map<string, V>): V {
  if (/^".*"$/.test(token)) return { type: 'str', v: token.slice(1, -1) }
  if (/^-?\d+\.\d+$/.test(token)) return { type: 'float', v: Number(token) }
  if (/^-?\d+$/.test(token)) return { type: 'int', v: Number(token) }
  const got = env.get(token)
  if (!got) throw new Error(`NameError: name '${token}' is not defined`)
  return got
}

function evaluate(expr: string, env: Map<string, V>): V {
  const [a, op, b] = expr.trim().split(/\s+/)
  const l = valueOf(a!, env)
  if (!op) return l
  const r = valueOf(b!, env)
  const n = op === '+' ? Number(l.v) + Number(r.v) : op === '-' ? Number(l.v) - Number(r.v) : Number(l.v) * Number(r.v)
  return { type: l.type === 'float' || r.type === 'float' ? 'float' : 'int', v: n }
}

const reprOf = (x: V) => (x.type === 'str' ? `'${x.v}'` : x.type === 'float' && Number.isInteger(x.v) ? `${x.v}.0` : String(x.v))

/** Plays lines (and `WIPE`) into evidence. */
const WIPE = Symbol('wipe')
function play(steps: (string | typeof WIPE)[], picks: Pick[] = []): Evidence {
  let env = new Map<string, V>()
  const lines: LineMemory[] = []
  const thoughts: Heard[] = []
  const memoryOf = (): MemorySnapshot => {
    const b = [...env].map(([name, x]) => bound(name, x.type, reprOf(x)))
    return snap(b.map((x) => x.object), b.map((x) => x.binding))
  }
  for (const s of steps) {
    if (s === WIPE) {
      env = new Map()
      lines.push({ source: '', memory: EMPTY })
      continue
    }
    const m = /^\s*(\w+)\s*=\s*(.+)$/.exec(s)
    if (m) env.set(m[1]!, evaluate(m[2]!, env))
    else {
      const x = evaluate(s, env)
      thoughts.push({ type: x.type, repr: reprOf(x), source: s })
    }
    lines.push({ source: s, memory: memoryOf() })
  }
  const now = lines[lines.length - 1]?.memory ?? EMPTY
  return { snapshot: now, thoughts, history: [...lines.map((l) => l.memory), now], lines, picks, last: null }
}

const lesson = bindLesson(4)
const PICKS: Pick[] = [
  { ask: 'bind-sum', choice: '10' },
  { ask: 'bind-count', choice: '7' },
]
const TAUGHT = ['x = 1', 'x', 'a = 4', 'b = a + 1', 'score = 0', 'score = score + 1', 'score = score + 1', 'score = score + 1']

describe('v2-bind: teaching', () => {
  it('asks for a binding, then the name back, then predictions and instructions in turn', () => {
    expect(progress(lesson, play([]))).toBe(0)
    expect(progress(lesson, play(['x = 1']))).toBe(1)
    expect(progress(lesson, play(['x = 1', 'x']))).toBe(2)
    expect(progress(lesson, play(['x = 1', 'x'], PICKS.slice(0, 1)))).toBe(3)
  })

  it('wants `b` worked out from `a`, not typed', () => {
    const typedIn = play(['x = 1', 'x', 'a = 4', 'b = 5'], PICKS.slice(0, 1))
    expect(progress(lesson, typedIn)).toBe(3)
    expect(lesson.steps[3]!.nudge!({ source: 'b = 5', ok: true, error: null, thought: null })).toMatch(/Let the robot work it out/)
    expect(progress(lesson, play(['x = 1', 'x', 'a = 4', 'b = a + 1'], PICKS.slice(0, 1)))).toBe(4)
  })

  it('wants `score` counted up one at a time', () => {
    expect(progress(lesson, play(['x = 1', 'x', 'a = 4', 'b = a + 1', 'score = 3'], PICKS))).toBe(5)
    expect(progress(lesson, play(TAUGHT, PICKS))).toBe(6)
  })

  it('shows every idea in memory, a step at a time, before asking it', () => {
    for (const step of lesson.steps.slice(0, 6)) {
      const beats = step.beats ?? []
      if (beats.length === 0) continue
      expect(beats.some((b) => b.memory !== undefined)).toBe(true)
      expect(beats.some((b) => b.mark !== undefined)).toBe(true)
    }
    // x = y + 2: y is read, the new 3 thought of, then x pointed at it.
    const yx = lesson.steps[3]!.beats!
    const marks = yx.map((b) => b.mark?.join() ?? (b.thought ? `thought ${b.thought}` : ''))
    expect(marks.slice(1, 4)).toEqual(['y', 'thought 3', 'x'])
  })
})

describe('v2-bind: goal memories', () => {
  it('wipes the memory for the player as the goals begin, and the last goal needs a wipe of theirs', () => {
    const g = goals(4)
    expect(g).toHaveLength(6)
    // Wiped on the beat that says so, not as the step begins (where the
    // counting step's praise is still being read over the learner's work).
    expect(g[0]!.wipeFirst).toBeUndefined()
    expect((g[0]!.beats ?? []).filter((b) => b.wipe).map((b) => b.say)).toEqual(['I\'ve wiped the robot\'s memory, so you start clean.'])
    expect(g.slice(1).some((x) => x.wipeFirst || (x.beats ?? []).some((b) => b.wipe))).toBe(false)
    // No step asks the player to wipe first: the goals start as soon as
    // the teaching is done.
    expect(progress(lesson, play(TAUGHT, PICKS))).toBe(6)
  })

  it('plays every goal by its model lines, each goal a change to the last, the last from scratch', () => {
    for (const seed of [1, 2, 3, 4, 5, 17, 99]) {
      const l = bindLesson(seed)
      const g = goals(seed)
      // The wipe the workbench makes as the goals begin.
      const lines: (string | typeof WIPE)[] = [...TAUGHT, WIPE]
      for (const [i, step] of g.entries()) {
        if (i === g.length - 1) lines.push(WIPE)
        lines.push(...step.model!.split('\n'))
        expect(progress(l, play(lines, PICKS)), `seed ${seed}, goal ${i + 1}`).toBe(7 + i)
      }
      expect(script(l, play(lines, PICKS)).finished).toBe(true)
    }
  })

  it('says which row is off, and when a name is not in the goal', () => {
    const g = goals(4)
    const first = g[0]!
    const e = play([...TAUGHT, WIPE, 'x = 100'], PICKS)
    const last = e.lines![e.lines!.length - 1]!
    expect(first.nudge!({ source: 'x = 100', ok: true, error: null, thought: null, memory: last.memory })).toMatch(/`x` points at `100`/)
    const extra = play([...TAUGHT, WIPE, 'y = 2'], PICKS)
    const m = extra.lines![extra.lines!.length - 1]!.memory
    expect(first.nudge!({ source: 'y = 2', ok: true, error: null, thought: null, memory: m })).toMatch(/`y` isn't in the goal. Undo that line/)
    // The console reports only the error's type (an uncaught exception
    // comes back as its type name), so the reply names no name.
    expect(first.nudge!({ source: 'x = q', ok: false, error: 'NameError — the robot stopped there.', thought: null })).toMatch(/no memory of yet/)
  })

  it('does not undo progress when the memory is wiped', () => {
    const before = play([...TAUGHT, WIPE, ...goals(4)[0]!.model!.split('\n')], PICKS)
    const after = play([...TAUGHT, WIPE, ...goals(4)[0]!.model!.split('\n'), WIPE], PICKS)
    expect(progress(lesson, after)).toBe(progress(lesson, before))
  })
})

describe('v2-bind: replies after a pick', () => {
  it('answers a wrong line to a goal, though multiple-choice steps came before it', () => {
    // Taking the last line back out used to drop the picks too, so every
    // line after a pick looked as if it had moved the lesson on, and was
    // never answered.
    const e = play([...TAUGHT, WIPE, 'x = 100'], PICKS)
    const memory = e.lines![e.lines!.length - 1]!.memory
    const withLast = { ...e, history: [...e.lines!.map((l) => l.memory), memory], snapshot: memory, last: { source: 'x = 100', ok: true, error: null, thought: null, memory } }
    const s = script(lesson, withLast)
    expect(s.items[s.rest]).toMatchObject({ kind: 'reply' })
    expect(s.items[s.rest]!.text).toMatch(/`x` points at `100`/)
  })
})

describe('v2-bind: pictures', () => {
  it("keeps a question's card off the stage until the question is asked", async () => {
    const { staging } = await import('../../../content/lessons')
    // Praising the recall, and the beats that show `x = 1 + 2`: no card.
    const e = play(['x = 1', 'x'])
    const s = script(lesson, e)
    for (let i = 0; i < s.rest; i++) expect(staging(lesson, e, i).current?.prop.kind, `item ${i}`).not.toBe('value')
    // At the question, the card it asks about.
    expect(staging(lesson, e, s.rest).current?.prop).toMatchObject({ kind: 'value', text: 'x = 2 * 5' })
  })
})
