/**
 * The grid layout. Its promises are in the module header, and these tests
 * are those promises: names left, elements in index order, an object drawn
 * once however many things point at it, and — the reason it replaced a
 * force layout — nothing that was already there moves when something new
 * arrives.
 */
import { describe, expect, it } from 'vitest'
import {
  approach,
  cameraDistance,
  COL_GAP,
  curve,
  ease,
  frame,
  grid,
  MAX_K,
  MIN_K,
  NAME_GAP,
  orderNames,
  overview,
  overviewZoom,
  OVERVIEW_MIN_K,
  place,
  scrolled,
  transformOf,
  type LayoutInput,
  type Placed,
  type Size,
} from '../../src/panels/graphLayout'

const V = { w: 900, h: 420 }

type Mem = { names: [string, string][]; children?: Record<string, string[]>; scope?: Record<string, string> }

/** A small memory, written as `[name, target]` pairs and a child list. */
const input = (m: Mem): LayoutInput => ({
  names: m.names.map(([n, t]) => ({ id: `n:${m.scope?.[n] ?? 'global'}:${n}`, scope: m.scope?.[n] ?? 'global', target: t })),
  children: new Map(Object.entries(m.children ?? {})),
})

const nid = (n: string, scope = 'global') => `n:${scope}:${n}`

/** Every node the same size unless it says otherwise, so the arithmetic in
 *  a failure message is readable. */
const sized = (ids: Iterable<string>, w = 60, h = 30, over: Record<string, Size> = {}) =>
  new Map([...ids].map((id) => [id, over[id] ?? { w, h }]))

const layout = (m: Mem, over: Record<string, Size> = {}) => {
  const inp = input(m)
  const cells = grid(inp)
  return place(inp, sized(cells.keys(), 60, 30, over))
}

const at = (p: Map<string, Placed>, id: string) => {
  const v = p.get(id)
  if (!v) throw new Error(`${id} was not placed`)
  return v
}

describe('the grid', () => {
  it('puts every name in the first column and every object after it', () => {
    const p = layout({ names: [['a', 'o:1'], ['b', 'o:2']], children: { 'o:1': ['o:3'] } })
    for (const id of [nid('a'), nid('b')]) expect(at(p, id).col).toBe(0)
    for (const id of ['o:1', 'o:2']) expect(at(p, id).col).toBe(1)
    expect(at(p, 'o:3').col).toBe(2)
    const rightmostName = Math.max(at(p, nid('a')).x, at(p, nid('b')).x) + 30
    for (const id of ['o:1', 'o:2', 'o:3']) expect(at(p, id).x - 30).toBeGreaterThan(rightmostName)
  })

  it('starts each name’s object in the name’s own row', () => {
    const p = layout({ names: [['a', 'o:1'], ['b', 'o:2']] })
    expect(at(p, 'o:1').row).toBe(at(p, nid('a')).row)
    expect(at(p, 'o:2').row).toBe(at(p, nid('b')).row)
    expect(at(p, 'o:1').y).toBe(at(p, nid('a')).y)
  })

  it('lays a list’s elements out in index order, top to bottom', () => {
    const p = layout({ names: [['xs', 'o:L']], children: { 'o:L': ['v:a', 'v:b', 'v:c'] } })
    const ys = ['v:a', 'v:b', 'v:c'].map((id) => at(p, id).y)
    expect(ys).toEqual([...ys].sort((a, b) => a - b))
    expect(new Set(ys).size).toBe(3)
    // The list sits level with its first element, so that arrow is flat.
    expect(at(p, 'o:L').y).toBe(at(p, 'v:a').y)
  })

  it('makes room below a nested list before the next name', () => {
    const p = layout({
      names: [['g', 'o:G'], ['next', 'o:N']],
      children: { 'o:G': ['o:A', 'o:B'], 'o:A': ['v:1', 'v:2'], 'o:B': ['v:3'] },
    })
    // [[1, 2], [3]] needs three rows; the next name takes the fourth.
    expect(at(p, 'v:1').row).toBe(0)
    expect(at(p, 'v:2').row).toBe(1)
    expect(at(p, 'o:B').row).toBe(2)
    expect(at(p, nid('next')).row).toBe(3)
  })

  it('draws a shared object once, where it was first reached', () => {
    // a = 10; b = a
    const inp = input({ names: [['a', 'v:10'], ['b', 'v:10']] })
    const cells = grid(inp)
    expect([...cells.keys()].filter((id) => id === 'v:10')).toHaveLength(1)
    expect(cells.get('v:10')!.row).toBe(cells.get(nid('a'))!.row)
    // The second name still gets a row of its own, and an arrow — which is
    // what makes the sharing visible.
    expect(cells.get(nid('b'))!.row).toBe(1)
  })

  it('draws an element shared between two slots once', () => {
    // xs = [1, 1]
    const p = layout({ names: [['xs', 'o:L']], children: { 'o:L': ['v:1', 'v:1'] } })
    expect([...p.keys()].filter((id) => id === 'v:1')).toHaveLength(1)
  })

  it('survives a collection that holds itself', () => {
    const p = layout({ names: [['xs', 'o:L']], children: { 'o:L': ['o:L', 'v:1'] } })
    expect(at(p, 'o:L').col).toBe(1)
    expect(at(p, 'v:1').col).toBe(2)
  })

  it('puts a function’s locals after the globals, with a gap', () => {
    const p = layout({
      names: [['g', 'v:1'], ['h', 'v:2'], ['n', 'v:3']],
      scope: { n: 'f' },
    })
    const pitch = at(p, nid('h')).y - at(p, nid('g')).y
    expect(at(p, nid('n', 'f')).y - at(p, nid('h')).y).toBeGreaterThan(pitch)
  })

  it('right-aligns names and left-aligns objects, so arrows start and end in line', () => {
    const p = layout(
      { names: [['a', 'v:1'], ['longer_name', 'o:L']] },
      { [nid('a')]: { w: 30, h: 30 }, [nid('longer_name')]: { w: 110, h: 30 }, 'o:L': { w: 90, h: 30 } },
    )
    expect(at(p, nid('a')).x + 15).toBe(at(p, nid('longer_name')).x + 55)
    expect(at(p, 'v:1').x - 30).toBe(at(p, 'o:L').x - 45)
    // And the gap between them is the one declared.
    expect(at(p, 'v:1').x - 30 - (at(p, nid('a')).x + 15)).toBe(NAME_GAP)
  })

  it('spaces object columns by the declared gap', () => {
    const p = layout({ names: [['xs', 'o:L']], children: { 'o:L': ['v:1'] } })
    expect(at(p, 'v:1').x - 30 - (at(p, 'o:L').x + 30)).toBe(COL_GAP)
  })

  it('lays the same memory out the same way twice', () => {
    const m: Mem = { names: [['a', 'o:1'], ['b', 'o:1'], ['c', 'o:2']], children: { 'o:1': ['v:x', 'v:y'] } }
    expect([...layout(m)]).toEqual([...layout(m)])
  })
})

describe('nothing already there moves when something new arrives', () => {
  it('leaves every existing card where it was when a name is added', () => {
    const before = layout({ names: [['a', 'o:1'], ['b', 'v:2']], children: { 'o:1': ['v:x', 'v:y'] } })
    const after = layout({
      names: [['a', 'o:1'], ['b', 'v:2'], ['c', 'o:3']],
      children: { 'o:1': ['v:x', 'v:y'], 'o:3': ['v:z'] },
    })
    for (const [id, p] of before) expect(at(after, id)).toEqual(p)
  })

  it('keeps a rebound name in its row', () => {
    const seen = new Map<string, number>()
    const names = (pairs: [string, string][]) => input({ names: pairs }).names
    orderNames(names([['x', 'v:10'], ['y', 'v:10']]), seen)
    // The engine may enumerate them in any order; the column does not care.
    const later = orderNames(names([['y', 'v:10'], ['x', 'v:99']]), seen)
    expect(later.map((n) => n.id)).toEqual([nid('x'), nid('y')])
  })

  it('adds a new name at the bottom of its scope, not where the engine listed it', () => {
    const seen = new Map<string, number>()
    const names = (pairs: [string, string][]) => input({ names: pairs }).names
    orderNames(names([['b', 'v:1'], ['c', 'v:2']]), seen)
    const later = orderNames(names([['a', 'v:3'], ['b', 'v:1'], ['c', 'v:2']]), seen)
    expect(later.map((n) => n.id)).toEqual([nid('b'), nid('c'), nid('a')])
  })

  it('lists globals first even when a local was seen earlier', () => {
    const seen = new Map<string, number>()
    const inp = input({ names: [['n', 'v:1'], ['g', 'v:2']], scope: { n: 'f' } }).names
    expect(orderNames(inp, seen).map((n) => n.scope)).toEqual(['global', 'f'])
  })
})

describe('the arrows', () => {
  const box = (x: number, y: number, w = 60, h = 30) => ({ x, y, w, h })
  const numbers = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number)

  it('goes from the right edge of one card to the left edge of the next', () => {
    const [sx, sy, , , , , ex, ey] = numbers(curve(box(0, 0), box(200, 50)).d)
    expect(sx).toBe(30)
    expect(sy).toBe(0)
    expect(ex).toBeLessThan(200 - 30)
    expect(ex).toBeGreaterThan(200 - 30 - 8)
    expect(ey).toBe(50)
  })

  it('comes into the right edge of something already drawn to its left', () => {
    // A back-reference: a slot pointing at an object in an earlier column.
    const [, , , , , , ex] = numbers(curve(box(300, 100), box(100, 0)).d)
    expect(ex).toBeGreaterThan(100 + 30)
  })

  it('loops over the top of a collection that holds itself', () => {
    const b = box(100, 100)
    const d = numbers(curve(b, b).d)
    expect(d.every(Number.isFinite)).toBe(true)
    expect(d[d.length - 1]).toBeLessThan(100 - 15)
  })

  it('puts a label near the far end and above the line', () => {
    const c = curve(box(0, 0), box(300, 0))
    expect(c.label.x).toBeGreaterThan(150)
    expect(c.label.y).toBeLessThan(0)
  })
})

describe('the tween', () => {
  it('arrives, and says so', () => {
    const p = { x: 0, y: 0 }
    let n = 0
    while (ease(p, { x: 100, y: -40 }) > 0 && n < 200) n++
    expect(p).toEqual({ x: 100, y: -40 })
    // About a quarter of a second at 60fps, not the five the forces took.
    expect(n).toBeLessThan(40)
  })

  it('does nothing to something already there', () => {
    const p = { x: 5, y: 5 }
    expect(ease(p, { x: 5, y: 5 })).toBe(0)
    expect(p).toEqual({ x: 5, y: 5 })
  })
})

describe('the overview', () => {
  const card = (x: number, y: number) => ({ x, y, w: 60, h: 30 })

  it('does not zoom with the amount of memory', () => {
    const small = overview([card(0, 0)], V, null)
    const big = overview(Array.from({ length: 40 }, (_, i) => card(0, i * 45)), V, null)
    expect(small.k).toBe(big.k)
    expect(small.k).toBe(overviewZoom(V))
  })

  it('shrinks only for a narrow pane, and not past readable', () => {
    expect(overviewZoom({ w: 1200, h: 400 })).toBe(1)
    expect(overviewZoom({ w: 320, h: 400 })).toBe(OVERVIEW_MIN_K)
  })

  it('is anchored at the top left, so growing memory moves nothing on screen', () => {
    const one = overview([card(30, 15)], V, null)
    const more = overview([card(30, 15), card(30, 60), card(200, 60)], V, one)
    // The first card is at the same screen point in both.
    const screen = (c: typeof one) => ({ x: (30 - c.x) * c.k + V.w / 2, y: (15 - c.y) * c.k + V.h / 2 })
    expect(screen(more)).toEqual(screen(one))
  })

  it('scrolls to show something that arrived below the fold', () => {
    const rows = Array.from({ length: 30 }, (_, i) => card(30, i * 45))
    const top = overview(rows, V, null)
    const last = rows[rows.length - 1]!
    const shown = overview(rows, V, top, [last])
    expect(last.y + last.h / 2).toBeLessThanOrEqual(shown.y + V.h / shown.k / 2)
  })

  it('scrolls inside what there is to see, and no further', () => {
    const rows = Array.from({ length: 30 }, (_, i) => card(30, i * 45))
    const top = overview(rows, V, null)
    const up = scrolled(top, 0, -500, rows, V)
    expect(up.y).toBe(top.y)
    const down = scrolled(top, 0, 1e6, rows, V)
    expect(down.y).toBeGreaterThan(top.y)
    expect(scrolled(down, 0, 1e6, rows, V).y).toBe(down.y)
  })

  it('does not scroll a memory that fits', () => {
    const one = overview([card(30, 15)], V, null)
    expect(scrolled(one, 0, 300, [card(30, 15)], V)).toEqual(one)
  })
})

describe('the camera', () => {
  it('frames what it is given, and keeps zoom inside its limits', () => {
    const c = frame([{ x: 0, y: 0, w: 60, h: 30 }, { x: 400, y: 0, w: 60, h: 30 }], V)
    expect(c.x).toBe(200)
    expect(c.k).toBeGreaterThanOrEqual(MIN_K)
    expect(c.k).toBeLessThanOrEqual(MAX_K)
    expect(frame([{ x: 0, y: 0, w: 1, h: 1 }], V).k).toBe(MAX_K)
  })

  it('handles being asked to frame nothing', () => {
    expect(frame([], V)).toEqual({ x: V.w / 2, y: V.h / 2, k: 1 })
    expect(overview([], V, null)).toEqual({ x: V.w / 2, y: V.h / 2, k: 1 })
  })

  it('eases to its target and arrives', () => {
    let c = { x: 0, y: 0, k: 1 }
    const to = { x: 100, y: 50, k: 1.5 }
    for (let i = 0; i < 120; i++) c = approach(c, to)
    expect(cameraDistance(c, to, V)).toBeLessThan(0.6)
  })

  it('writes a transform both layers can share', () => {
    expect(transformOf({ x: 10, y: 20, k: 2 }, V)).toBe('translate(450px, 210px) scale(2) translate(-10px, -20px)')
  })
})
