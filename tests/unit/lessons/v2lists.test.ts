/**
 * v2, Lists (`v2-lists`): lists shown slot by slot and asked, then eight
 * that build on one list of names.
 *
 * A small stand-in for the console plays lines into evidence the way the
 * workbench records them, with lists as objects of their own whose slots
 * point at value objects, so `bag = backpack` is the very same list.
 */
import { describe, expect, it } from 'vitest'
import { progress, script, type Evidence, type Heard, type LineMemory, type Pick } from '../../../content/lessons'
import { listsLesson, practice } from '../../../content/lessons/v2/lists'
import type { MemorySnapshot, PyObject } from '../../../src/memory/model'
import { EMPTY } from './fixtures'

type Val = { t: 'int' | 'str'; v: number | string } | { t: 'list'; id: string }

function play(steps: string[], picks: Pick[] = []) {
  let names = new Map<string, Val>()
  let lists = new Map<string, Val[]>()
  let seq = 0
  const lines: LineMemory[] = []
  const thoughts: Heard[] = []
  const lit = (x: string): Val => {
    x = x.trim()
    if (/^".*"$/.test(x)) return { t: 'str', v: x.slice(1, -1) }
    if (/^-?\d+$/.test(x)) return { t: 'int', v: Number(x) }
    if (x.startsWith('[')) {
      const id = `L${++seq}`
      lists.set(id, x.slice(1, -1).split(',').filter((y) => y.trim()).map(lit))
      return { t: 'list', id }
    }
    const idx = /^(\w+)\s*\[\s*(\d+)\s*\]$/.exec(x)
    if (idx) {
      const l = names.get(idx[1]!)
      const items = l && l.t === 'list' ? lists.get(l.id)! : null
      if (!items || Number(idx[2]) >= items.length) throw new Error('IndexError')
      return items[Number(idx[2])]!
    }
    const len = /^len\((\w+)\)$/.exec(x)
    if (len) {
      const l = names.get(len[1]!)!
      return { t: 'int', v: lists.get((l as { id: string }).id)!.length }
    }
    const got = names.get(x)
    if (!got) throw new Error('NameError')
    return got
  }
  const repr = (x: Val): string => (x.t === 'list' ? `${lists.get(x.id)!.length} items` : x.t === 'str' ? `'${x.v}'` : String(x.v))
  const memory = (): MemorySnapshot => {
    const objects: Record<string, PyObject> = {}
    const put = (x: Val): string => {
      if (x.t === 'list') {
        if (!objects[x.id]) {
          objects[x.id] = { id: x.id, type: 'list', kind: 'reference', repr: repr(x), elements: [], partial: false }
          objects[x.id]!.elements = lists.get(x.id)!.map((y, i) => ({ label: String(i), target: put(y) }))
        }
        return x.id
      }
      const id = `v:${x.t}:${repr(x)}`
      objects[id] = { id, type: x.t, kind: 'value', repr: repr(x), elements: null, partial: false }
      return id
    }
    const bindings = [...names].map(([name, x]) => ({ name, scope: 'global', target: put(x) }))
    return { bindings, objects, line: 1 }
  }
  for (const s of steps) {
    if (s === 'WIPE') {
      names = new Map()
      lists = new Map()
      lines.push({ source: '', memory: EMPTY })
      continue
    }
    let m
    if ((m = /^(\w+)\s*\[\s*(\d+)\s*\]\s*=\s*(.+)$/.exec(s))) {
      const l = names.get(m[1]!) as { id: string }
      lists.get(l.id)![Number(m[2])] = lit(m[3]!)
    } else if ((m = /^(\w+)\.append\((.+)\)$/.exec(s))) {
      const l = names.get(m[1]!) as { id: string }
      lists.get(l.id)!.push(lit(m[2]!))
    } else if ((m = /^(\w+)\s*=\s*(.+)$/.exec(s))) {
      names.set(m[1]!, lit(m[2]!))
    } else {
      const x = lit(s)
      thoughts.push({ type: x.t, repr: repr(x), source: s })
    }
    lines.push({ source: s, memory: memory() })
  }
  const now = lines[lines.length - 1]?.memory ?? EMPTY
  const e: Evidence = { snapshot: now, thoughts, history: [...lines.map((l) => l.memory), now], lines, picks, last: null }
  return e
}

const TEACH_PICKS: Pick[] = [
  { ask: 'lists-slot', choice: "'potion'" },
  { ask: 'lists-alias', choice: 'grown' },
]
const TAUGHT = ['hotbar = ["sword", "shield", "potion"]', 'hotbar[0]', 'len(hotbar)', 'hotbar[1] = "bow"', 'hotbar.append("map")']

describe('v2-lists: teaching', () => {
  const lesson = listsLesson(1)

  it('asks each idea in turn, and moves on only for the way it teaches', () => {
    expect(progress(lesson, play([]))).toBe(0)
    const made = TAUGHT[0]!
    expect(progress(lesson, play([made]))).toBe(1)
    expect(progress(lesson, play([made], TEACH_PICKS.slice(0, 1)))).toBe(2)
    // The first item typed in is not looked up.
    expect(progress(lesson, play([made, '"sword"'], TEACH_PICKS.slice(0, 1)))).toBe(2)
    expect(progress(lesson, play([made, 'hotbar[0]'], TEACH_PICKS.slice(0, 1)))).toBe(3)
    // A new list with the bow in it is not a slot moved.
    expect(progress(lesson, play([made, 'hotbar[0]', 'len(hotbar)', 'hotbar = ["sword", "bow", "potion"]'], TEACH_PICKS.slice(0, 1)))).toBe(4)
    expect(progress(lesson, play(TAUGHT, TEACH_PICKS.slice(0, 1)))).toBe(6)
    expect(progress(lesson, play(TAUGHT, TEACH_PICKS))).toBe(7)
  })

  it('says so when the brackets are missing, or the slot is not there yet', () => {
    const step = lesson.steps[0]!
    const tuple: MemorySnapshot = {
      bindings: [{ name: 'hotbar', scope: 'global', target: 'T' }],
      objects: { T: { id: 'T', type: 'tuple', kind: 'reference', repr: '3 items', elements: [], partial: false } },
      line: 1,
    }
    expect(step.nudge!({ source: 'hotbar = "sword", "shield"', ok: true, error: null, thought: null, memory: tuple })).toMatch(/square brackets/)
    expect(step.nudge!({ source: 'hotbar = [sword, shield]', ok: false, error: 'NameError — the robot stopped there.', thought: null })).toMatch(/need quotes/)
    // Appended the wrong item: nothing taught takes it out, and a slot
    // would not be an append, so Undo.
    const typo: MemorySnapshot = play([TAUGHT[0]!, 'hotbar[1] = "bow"', 'hotbar.append("mapp")']).snapshot
    expect(lesson.steps[5]!.nudge!({ source: 'hotbar.append("mapp")', ok: true, error: null, thought: null, memory: typo })).toMatch(/appended the wrong item. Undo/)
    const twice: MemorySnapshot = play([TAUGHT[0]!, 'hotbar[1] = "bow"', 'hotbar.append("map")', 'hotbar.append("map")']).snapshot
    expect(lesson.steps[5]!.nudge!({ source: 'hotbar.append("map")', ok: true, error: null, thought: null, memory: twice })).toMatch(/one item too many now. Undo/)
    expect(lesson.steps[5]!.nudge!({ source: 'hotbar[3] = "map"', ok: false, error: 'IndexError — the robot stopped there.', thought: null })).toMatch(/`append`/)
  })

  it('shows every idea in memory before asking it, and the list is lit as it is read', () => {
    for (const step of lesson.steps.slice(0, 7)) {
      const beats = step.beats ?? []
      if (beats.length === 0) continue
      expect(beats.some((b) => b.memory !== undefined), step.say).toBe(true)
    }
    expect(lesson.steps[1]!.beats!.some((b) => b.stops === 'IndexError')).toBe(true)
  })
})

describe('v2-lists: the eight', () => {
  it('plays through by each step\'s model, a pick for each question, for many seeds', () => {
    for (const seed of [1, 2, 3, 7, 11, 42, 99]) {
      const lesson = listsLesson(seed)
      const p = practice(seed)
      const lines = [...TAUGHT, 'WIPE']
      const picks = [...TEACH_PICKS]
      for (const [i, step] of p.entries()) {
        if (step.choices) picks.push({ ask: step.choices.id, choice: step.choices.answer })
        else lines.push(...step.model!.split('\n'))
        expect(progress(lesson, play(lines, picks)), `seed ${seed}, practice ${i}: ${step.say}`).toBe(8 + i)
      }
      expect(script(lesson, play(lines, picks)).finished).toBe(true)
    }
  })

  it('takes turns, never three of a kind in a row, and asks each concept once', () => {
    for (const seed of Array.from({ length: 100 }, (_, i) => i + 1)) {
      const kinds = practice(seed).map((s) => (s.choices ? 'pick' : s.tag === 'robot' ? 'ask' : 'build'))
      for (let i = 2; i < kinds.length; i++) expect(kinds[i] === kinds[i - 1] && kinds[i] === kinds[i - 2]).toBe(false)
      for (const s of practice(seed).filter((x) => x.choices)) {
        const ids = s.choices!.options.map((o) => o.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.length).toBeGreaterThanOrEqual(2)
        expect(ids).toContain(s.choices!.answer)
      }
    }
  })

  it('wants `bag` to be the very same list, not an equal copy', () => {
    const seed = 3
    const lesson = listsLesson(seed)
    const p = practice(seed)
    const lines = [...TAUGHT, 'WIPE']
    const picks = [...TEACH_PICKS]
    // Up to the `bag` step, which is second to last: the last asks what
    // `bag` holds once `backpack` is pointed at a new list.
    const bagAt = p.findIndex((x) => x.model === 'bag = backpack')
    expect(bagAt).toBe(p.length - 2)
    for (const step of p.slice(0, bagAt)) {
      if (step.choices) picks.push({ ask: step.choices.id, choice: step.choices.answer })
      else lines.push(...step.model!.split('\n'))
    }
    // A copy: a new list with the same names in it, as the goal shows them.
    const shown = (p[bagAt - 1]!.show as { goal: { value: string }[] }).goal[0]!.value
    const before = 7 + bagAt
    expect(progress(lesson, play([...lines, `bag = ${shown}`], picks))).toBe(before)
    expect(progress(lesson, play([...lines, 'bag = backpack'], picks))).toBe(before + 1)
  })
})

describe('v2-lists: a typo', () => {
  it('says first that a name the line just made is not in the goal', () => {
    const lesson = listsLesson(3)
    const first = practice(3)[0]!
    const m = play(['backpack = ["map"]', 'backpak = 1']).snapshot
    expect(first.nudge!({ source: 'backpak = 1', ok: true, error: null, thought: null, memory: m })).toMatch(/`backpak` isn't in the goal. Undo/)
    void lesson
  })
})
