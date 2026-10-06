/**
 * The grid layout. Its promises are in the module header, and these tests
 * are those promises: names left, elements in index order, an object drawn
 * once however many things point at it, and — the reason it replaced a
 * force layout — nothing that was already there moves when something new
 * arrives.
 */
import { describe, expect, it } from 'vitest'
import {
  along,
  approach,
  beside,
  lerpBox,
  swing,
  SWING_FROM,
  SWING_TO,
  tripProgress,
  cameraDistance,
  COL_GAP,
  curve,
  ease,
  frame,
  grid,
  hidden,
  LABEL_CHAR,
  LABEL_ROOM,
  MAX_K,
  MIN_K,
  NAME_GAP,
  orderNames,
  overview,
  overviewZoom,
  OVERVIEW_MIN_K,
  place,
  scrolled,
  slotLabel,
  spread,
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

  it('widens the gap in front of a column to hold the slot labels on the arrows into it', () => {
    const m: Mem = { names: [['ages', 'o:D']], children: { 'o:D': ['v:30', 'v:25'] } }
    const inp = input(m)
    // `'customer'` is 10 characters: wider than the plain gap allows.
    const w = slotLabel("'customer'").w
    expect(w + LABEL_ROOM).toBeGreaterThan(COL_GAP)
    const p = place({ ...inp, labelW: new Map([['v:30', w], ['v:25', slotLabel("'bo'").w]]) }, sized(grid(inp).keys()))
    expect(at(p, 'v:30').x - 30 - (at(p, 'o:D').x + 30)).toBe(w + LABEL_ROOM)
    // Short labels — a list's indices — fit the plain gap, which stays.
    const q = place({ ...inp, labelW: new Map([['v:30', slotLabel('0').w], ['v:25', slotLabel('1').w]]) }, sized(grid(inp).keys()))
    expect(at(q, 'v:30').x - 30 - (at(q, 'o:D').x + 30)).toBe(COL_GAP)
    // And the name column's gap is not touched by labels further right.
    expect(at(p, 'o:D').x).toBe(at(q, 'o:D').x)
  })

  it('cuts a long slot label short, so one key cannot push the grid across the pane', () => {
    expect(slotLabel('0')).toEqual({ text: '0', w: Math.ceil(LABEL_CHAR) })
    const long = slotLabel("'a very long key indeed'")
    expect(long.text).toHaveLength(16)
    expect(long.text.endsWith('…')).toBe(true)
    // Two attributes sharing one arrow (both `None`) are drawn whole.
    expect(slotLabel('.left, .right').text).toBe('.left, .right')
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

  it('stands a slot label halfway along the arrow, above it', () => {
    const c = curve(box(0, 0), box(300, 40))
    expect(c.label.anchor).toBe('middle')
    expect(c.label.x).toBeCloseTo((30 + 300 - 30 - 4) / 2, 5)
    expect(c.label.y).toBeCloseTo(20 - 4, 5)
  })

  it('keeps apart the labels of a fan, and of arrows converging on one card', () => {
    // One list's slots 0..2 into three rows, and a second list's slot into
    // the first list's row-1 element: every label at its own place.
    const list = box(0, 0)
    const other = box(0, 150)
    const labels = [curve(list, box(200, 0)), curve(list, box(200, 50)), curve(list, box(200, 100)), curve(other, box(200, 50))].map((c) => c.label)
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) expect(Math.abs(labels[i]!.y - labels[j]!.y)).toBeGreaterThanOrEqual(20)
  })

  it("moves a label off a card its arrow passes close under", () => {
    // A plain arrow from (0,0) to (400,40), clear of a card that sits just
    // above its middle: halfway, the label (standing above the line) would
    // land on the card; it moves along the arrow instead.
    const a = box(0, 0)
    const b = box(400, 40)
    const card = { x: 200, y: 4, w: 60, h: 20 }
    const plain = curve(a, b, [], 40).label
    const moved = curve(a, b, [a, b, card], 40).label
    const on = (l: { x: number; y: number }) => l.x + 20 > card.x - 30 && l.x - 20 < card.x + 30 && l.y > card.y - 10 && l.y - 12 < card.y + 10
    expect(on(plain)).toBe(true)
    expect(on(moved)).toBe(false)
    expect(moved.x).toBeLessThan(plain.x)
  })

  it('routes an arrow round a card in its way, never through it', () => {
    // `scores` → a list → `0`, and `total` → that same `0` from the row
    // below: drawn straight, total's arrow went through the list card.
    const total = box(0, 50)
    const list = box(150, 0)
    const zero = box(300, 0)
    const inside = (x: number, y: number, o: ReturnType<typeof box>) =>
      x > o.x - o.w / 2 && x < o.x + o.w / 2 && y > o.y - o.h / 2 && y < o.y + o.h / 2
    const path = (d: string) => {
      // Sample the path by its own geometry, in the browser's way.
      const n = numbers(d)
      const pts: [number, number][] = []
      const cub = (p: number[], t: number) => {
        const u = 1 - t
        return u * u * u * p[0]! + 3 * u * u * t * p[1]! + 3 * u * t * t * p[2]! + t * t * t * p[3]!
      }
      // M x y C 6 L 2 C 6 (routed), or M x y C 6 (plain).
      const segs: number[][] = []
      let at = [n[0]!, n[1]!]
      let i = 2
      const letters = d.match(/[CL]/g)!
      for (const l of letters) {
        if (l === 'C') {
          segs.push([at[0]!, n[i]!, n[i + 2]!, n[i + 4]!, at[1]!, n[i + 1]!, n[i + 3]!, n[i + 5]!])
          at = [n[i + 4]!, n[i + 5]!]
          i += 6
        } else {
          segs.push([at[0]!, at[0]!, n[i]!, n[i]!, at[1]!, at[1]!, n[i + 1]!, n[i + 1]!])
          at = [n[i]!, n[i + 1]!]
          i += 2
        }
      }
      for (const s of segs) for (let k = 0; k <= 40; k++) pts.push([cub(s.slice(0, 4), k / 40), cub(s.slice(4), k / 40)])
      return pts
    }
    const straight = curve(total, zero)
    expect(path(straight.d).some(([x, y]) => inside(x, y, list))).toBe(true)
    const routed = curve(total, zero, [total, list, zero])
    expect(path(routed.d).some(([x, y]) => inside(x, y, list))).toBe(false)
    // It still ends on the target's left edge, level with it.
    const n = numbers(routed.d)
    expect(n[n.length - 1]).toBe(0)
    expect(n[n.length - 2]).toBeLessThan(300 - 30)
    // A clear path is left alone.
    expect(curve(box(0, 0), box(200, 50), [box(0, 0), box(200, 50), box(100, 200)]).d).toBe(curve(box(0, 0), box(200, 50)).d)
  })

  it('keeps labels off each other where arrows converge', () => {
    // `0` and `1` from two cards ended on one spot and read as `61`.
    const ys = spread([
      { x: 100, y: 50, w: 8 },
      { x: 102, y: 52, w: 8 },
      { x: 300, y: 50, w: 8 },
    ])
    expect(Math.abs(ys[0]! - ys[1]!)).toBeGreaterThanOrEqual(12)
    // One far enough away stays put.
    expect(ys[2]).toBe(50)
  })

  it('stands it on the loop of an arrow back to something already drawn', () => {
    const c = curve(box(300, 100), box(100, 0))
    expect(c.label.x).toBeGreaterThan(100 + 30)
    expect(c.label.y).toBeLessThan(100)
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

  it('never scrolls the names column away to reveal a card on the right', () => {
    // A phone's pane, and a row that runs past its right edge: `add`, its
    // default list, and that list's strings.
    const phone = { w: 358, h: 360 }
    const row = [card(30, 15), card(160, 15), card(300, 15), card(440, 15), card(580, 15)]
    const top = overview(row, phone, null)
    const shown = overview(row, phone, top, [row[4]!])
    expect(shown.x).toBe(top.x)
    // The first column's left edge is on screen.
    expect((30 - 30 - shown.x) * shown.k + phone.w / 2).toBeGreaterThanOrEqual(0)
    // The player can still scroll there.
    expect(scrolled(top, 400, 0, row, phone).x).toBeGreaterThan(top.x)
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

  // A memory wider than a phone's pane is cut on the right. What is off
  // each side is reported, so the pane can say so; it moves nothing.
  it('reports what a wide memory leaves off the right, and nothing for one that fits', () => {
    const phone = { w: 358, h: 360 }
    const row = [card(30, 15), card(160, 15), card(300, 15), card(440, 15), card(580, 15)]
    const top = overview(row, phone, null)
    const off = hidden(top, row, phone)
    expect(off.left).toBe(0)
    expect(off.right).toBeGreaterThan(100)
    // Scrolled all the way over, the right is shown and the left is not.
    const end = scrolled(top, 1e6, 0, row, phone)
    expect(hidden(end, row, phone).right).toBe(0)
    expect(hidden(end, row, phone).left).toBeGreaterThan(100)
    // And asking changed nothing about where the overview looks.
    expect(overview(row, phone, null)).toEqual(top)

    const small = [card(30, 15), card(160, 15)]
    expect(hidden(overview(small, V, null), small, V)).toEqual({ left: 0, right: 0 })
    expect(hidden(overview([], V, null), [], V)).toEqual({ left: 0, right: 0 })
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

describe('comings and goings', () => {
  // A card that left memory is drawn by the component, never placed: these
  // are the timings it reads, and they promise a replacement is seen
  // beside the old card before it takes the old card's place.
  it('waits a replacement beside the card it replaces, to the right and a little lower, clear of it', () => {
    const old = { x: 100, y: 40, w: 50, h: 30 }
    const at = beside(old, { w: 40, h: 30 })
    expect(at.x - 20).toBeGreaterThan(old.x + old.w / 2)
    expect(at.y).toBeGreaterThan(old.y)
  })

  it('creeps, then glides, and never goes backwards', () => {
    const trip = { x: 200, y: 60, t0: 0, dur: 1000, wait: 0.6, creep: 0.12 }
    let last = -1
    for (let t = 0; t <= 1000; t += 50) {
      const p = tripProgress(trip, t)
      expect(p).toBeGreaterThan(last)
      last = p
    }
    expect(tripProgress(trip, 599)).toBeLessThanOrEqual(0.12)
    expect(along(trip, { x: 100, y: 40 }, 1000)).toEqual({ x: 100, y: 40, done: true })
    expect(along(trip, { x: 100, y: 40 }, 300).done).toBe(false)
    // No wait: a plain slide, decelerating.
    const slide = { ...trip, wait: 0, creep: 0 }
    expect(tripProgress(slide, 500)).toBeGreaterThan(0.5)
  })

  it('swings an arrow from its old target to its new one over its window', () => {
    expect(swing(0)).toBe(0)
    expect(swing(SWING_FROM)).toBe(0)
    expect(swing((SWING_FROM + SWING_TO) / 2)).toBeCloseTo(0.5)
    expect(swing(SWING_TO)).toBe(1)
    expect(lerpBox({ x: 0, y: 0, w: 10, h: 10 }, { x: 100, y: 50, w: 30, h: 10 }, 0.5)).toEqual({ x: 50, y: 25, w: 20, h: 10 })
  })
})
