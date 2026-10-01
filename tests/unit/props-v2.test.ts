/**
 * The Basic data types pictures: a shelf of four slots, a doorway, a
 * tally of apples, a car's speed, a note with words on it and a literal
 * on a card; and for operations, the operator keys, the working played,
 * a clash that stops the robot and packs for a chained sum; and for
 * binding, a goal memory to make; and for lists, a goal with a list in
 * it and an inventory hotbar. What each one
 * draws and says, and which of its fields are narration.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  CHIP_CHARS,
  carReading,
  chipChars,
  cubbyWidth,
  exprWorking,
  GOAL_ITEMS,
  GOAL_ROWS,
  GOAL_ROWS_WITH_LIST,
  BACKPACK_MAX,
  backpackTicks,
  HOTBAR_ICONS,
  HOTBAR_MAX,
  goalShown,
  hotbarLit,
  literalKind,
  looksRight,
  packsSum,
  packsTotal,
  rightNumber,
  unworked,
  needleAngle,
  refused,
  sameProp,
  shelfSlots,
  shelved,
  slotOf,
  type Prop,
  type PropView,
} from '../../src/scene/props'
import { PropLayer, describe as sentence } from '../../src/ui/Props'
import type { MemorySnapshot } from '../../src/memory/model'

const th = (type: string, repr: string) => ({ type, repr })
const view = (prop: Prop, answer: { type: string; repr: string } | null = null, verdict: PropView['verdict'] = null, heard: { type: string; repr: string }[] = []): PropView => ({
  prop,
  answer,
  verdict,
  heard,
})
const drawn = (v: PropView) => renderToStaticMarkup(createElement(PropLayer, { view: v, role: 'current' }))

/** A goal's rows are laid out in base units and scaled as one into its
 *  frame: every box drawn inside that group, in the picture's units. */
const goalBoxes = (html: string) => {
  const m = /<g transform="translate\(([-\d.]+),([-\d.]+)\) scale\(([\d.]+)\)" data-scale/.exec(html)!
  const [ox, oy, k] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return [...html.slice(m.index).matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((b) => {
    const [x, y, w, h] = b.slice(1, 5).map(Number) as [number, number, number, number]
    return { x: ox + k * x, y: oy + k * y, r: ox + k * (x + w), b: oy + k * (y + h), raw: { x, y } }
  })
}
const goalScale = (html: string) => Number(/data-scale="([\d.]+)"/.exec(html)![1])

const FOUR = ['bool', 'int', 'float', 'str'] as const

describe('a shelf of four slots', () => {
  it('draws the slots it is given, sharing the whole width', () => {
    expect(shelfSlots({ slots: [...FOUR] })).toEqual(FOUR)
    expect(shelfSlots({})).toHaveLength(5)
    expect(shelfSlots({ slots: [] })).toHaveLength(5)
    expect(cubbyWidth(5)).toBeCloseTo(38.5)
    expect(4 * cubbyWidth(4) + 3 * 1.875).toBeCloseTo(200)
    expect(chipChars(5)).toBe(CHIP_CHARS)
    expect(chipChars(4)).toBeGreaterThan(CHIP_CHARS)
    const html = drawn(view({ kind: 'shelf', filled: [...FOUR], slots: [...FOUR] }))
    expect(html.match(/class="cubby /g)).toHaveLength(4)
    expect(html).not.toContain('data-kind="char"')
    expect(sentence(view({ kind: 'shelf', filled: [], slots: [...FOUR] }))).toMatch(/^A shelf of four slots/)
  })

  it('files a one-character str under str when there is no char slot', () => {
    expect(slotOf(th('str', "'A'"))).toBe('char')
    expect(slotOf(th('str', "'A'"), FOUR)).toBe('str')
    const s = shelved([...FOUR], [th('str', "'A'")], {}, {}, FOUR)
    expect(s.str.heard).toEqual(['"A"'])
    expect(s.char.heard).toEqual([])
  })

  it('is a different picture with a different set of slots', () => {
    expect(sameProp({ kind: 'shelf', filled: [], slots: [...FOUR] }, { kind: 'shelf', filled: ['bool'], slots: [...FOUR], title: true })).toBe(true)
    expect(sameProp({ kind: 'shelf', filled: [], slots: [...FOUR] }, { kind: 'shelf', filled: [] })).toBe(false)
  })
})

describe('the doorway', () => {
  it('swings for its narration while nothing is answered, and an answer wins', () => {
    expect(sameProp({ kind: 'doorway', demo: 'open' }, { kind: 'doorway', demo: 'closed' })).toBe(true)
    expect(sameProp({ kind: 'doorway', demo: 'open' }, { kind: 'doorway' })).toBe(true)
    expect(drawn(view({ kind: 'doorway', demo: 'open' }))).toMatch(/class="doorway open/)
    expect(drawn(view({ kind: 'doorway' }))).not.toMatch(/doorway open/)
    expect(drawn(view({ kind: 'doorway', demo: 'open' }, th('bool', 'False'), 'miss'))).not.toMatch(/doorway open/)
    expect(drawn(view({ kind: 'doorway' }, th('bool', 'True'), 'right'))).toMatch(/doorway open/)
  })

  it('sticks a word on as a note, and opens nothing', () => {
    const v = view({ kind: 'doorway' }, th('str', "'open'"), 'miss')
    expect(drawn(v)).not.toMatch(/doorway open/)
    expect(drawn(v)).toContain('class="note"')
    expect(refused(v)).toBe(false)
    expect(sentence(v)).toContain('note stuck on it says open')
  })

  it('draws any refused bool refused, since either one swings the door', () => {
    expect(looksRight(view({ kind: 'doorway' }, th('bool', 'False')))).toBe(true)
    const v = view({ kind: 'doorway' }, th('bool', 'False'), 'miss')
    expect(refused(v)).toBe(true)
    expect(drawn(v)).toMatch(/class="doorway\s+refused/)
    expect(sentence(v)).toContain('is not the answer yet')
  })
})

describe('a tally of apples', () => {
  it('keeps the count as narration, and only in tally mode', () => {
    const at = (apples: number): Prop => ({ kind: 'basket', apples, demo: 'tally' })
    expect(sameProp(at(3), at(5))).toBe(true)
    expect(sameProp(at(5), at(2))).toBe(true)
    // A tally is its own picture: not a counted basket of the same size.
    expect(sameProp(at(3), { kind: 'basket', apples: 3 })).toBe(false)
    expect(sameProp(at(3), { kind: 'basket', apples: 3, demo: 'count' })).toBe(false)
    // Outside it, a different count is still a different basket.
    expect(sameProp({ kind: 'basket', apples: 3 }, { kind: 'basket', apples: 5 })).toBe(false)
  })

  it('draws every place, the ones past the count waiting out, and the counter at the count', () => {
    const html = drawn(view({ kind: 'basket', apples: 5, demo: 'tally' }))
    expect(html.match(/apple-lift in/g)).toHaveLength(5)
    expect(html.match(/apple-lift out/g)).toHaveLength(1)
    expect(html).toContain('--count:5')
    expect(sentence(view({ kind: 'basket', apples: 2, demo: 'tally' }))).toContain('The counter beside it says 2.')
  })

  it('refuses a 5.0 counted into a tally of five', () => {
    expect(refused(view({ kind: 'basket', apples: 5, demo: 'tally' }, th('float', '5.0'), 'miss'))).toBe(true)
  })
})

describe("a car's speed", () => {
  it('reads a speed as a float, always with its point', () => {
    expect(carReading(48.5)).toBe('48.5')
    expect(carReading(50)).toBe('50.0')
    expect(needleAngle(0)).toBe(-120)
    expect(needleAngle(60)).toBe(0)
    expect(needleAngle(120)).toBe(120)
    expect(needleAngle(1000)).toBeLessThan(130)
  })

  it('is one picture through the drive and the ask', () => {
    expect(sameProp({ kind: 'car', speed: 20, demo: 'drive' }, { kind: 'car', speed: 96.5, demo: 'drive' })).toBe(true)
    expect(sameProp({ kind: 'car', speed: 48.5, demo: 'drive' }, { kind: 'car', speed: 48.5 })).toBe(true)
  })

  it('drives at its speed, waits at 0 on the ask, and moves to a numeric answer', () => {
    const drive = drawn(view({ kind: 'car', speed: 48.5, demo: 'drive' }))
    expect(drive).toContain('>48.5<')
    expect(drive).toContain('data-kind="float"')
    expect(drawn(view({ kind: 'car', speed: 50, demo: 'drive' }))).toContain('>50.0<')
    const ask = drawn(view({ kind: 'car', speed: 48.5 }))
    expect(ask).toContain('rotate:-120.00deg')
    expect(ask).toContain('>?<')
    expect(sentence(view({ kind: 'car', speed: 48.5 }))).toContain('? km/h')
    // An int is an honest miss, drawn as itself in its own colour.
    const int = view({ kind: 'car', speed: 48.5 }, th('int', '50'), 'miss')
    expect(drawn(int)).toContain('data-kind="int"')
    expect(drawn(int)).toContain('>50<')
    expect(refused(int)).toBe(false)
  })

  it('sticks a word on as a note, and the needle stays', () => {
    const v = view({ kind: 'car', speed: 48.5 }, th('str', "'fast'"), 'miss')
    expect(drawn(v)).toContain('class="note"')
    expect(drawn(v)).toContain('rotate:-120.00deg')
  })
})

describe('a note', () => {
  it('shows its words, and the robot’s copy only once there is one', () => {
    const before = drawn(view({ kind: 'note', text: 'Mira', title: 'name' }))
    expect(before).toContain('>Mira<')
    expect(before).toContain('>name<')
    expect(before).toContain('robot-tag empty')
    const str = drawn(view({ kind: 'note', text: 'Mira', title: 'name' }, th('str', "'Mira'"), 'right'))
    expect(str).toContain('&quot;Mira&quot;')
    expect(str).toMatch(/robot-tag " data-kind="str"/)
  })

  it('draws anything else as itself, in its own kind', () => {
    const v = view({ kind: 'note', text: 'Mira' }, th('int', '42'), 'miss')
    expect(drawn(v)).toMatch(/data-kind="int"/)
    expect(sentence(v)).toContain('an int, not words')
    expect(refused(v)).toBe(false)
  })

  it('refuses its own words when the step does', () => {
    expect(looksRight(view({ kind: 'note', text: 'Mira' }, th('str', "'Mira'")))).toBe(true)
    expect(looksRight(view({ kind: 'note', text: 'Mira' }, th('str', "'mira'")))).toBe(false)
    expect(refused(view({ kind: 'note', text: 'Mira' }, th('str', "'Mira'"), 'miss'))).toBe(true)
  })
})

describe('a literal on a card', () => {
  it('shows the literal, quotes and all, in no kind’s colour', () => {
    for (const text of ['3', '3.0', 'True', '"True"', '"42"']) {
      const html = drawn(view({ kind: 'value', text }))
      expect(html).toContain(`>${text.replaceAll('"', '&quot;')}<`)
      // Nothing inside the picture carries a kind.
      const svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>'))
      expect(svg).not.toContain('data-kind')
    }
    expect(sentence(view({ kind: 'value', text: '"42"' }))).toBe('A card with "42" written on it.')
    expect(sameProp({ kind: 'value', text: '3' }, { kind: 'value', text: '3.0' })).toBe(false)
  })

  it('draws no answer into the card', () => {
    expect(looksRight(view({ kind: 'value', text: '3' }, th('int', '3')))).toBe(false)
  })
})

describe('the operator keys', () => {
  it('presses the marked key, and moving the mark keeps the picture', () => {
    expect(sameProp({ kind: 'ops', mark: '+' }, { kind: 'ops', mark: '/' })).toBe(true)
    expect(sameProp({ kind: 'ops' }, { kind: 'ops', mark: '*' })).toBe(true)
    const html = drawn(view({ kind: 'ops', mark: '*' }))
    expect(html.match(/op-key pressed/g)).toHaveLength(1)
    for (const w of ['add', 'take away', 'times', 'divide']) expect(html).toContain(`>${w}<`)
    expect(drawn(view({ kind: 'ops' }))).not.toContain('pressed')
    expect(sentence(view({ kind: 'ops', mark: '/' }))).toContain('The / key is pressed: divide.')
  })
})

describe('the working, played', () => {
  const span = (line: { text: string }, s?: [number, number]) => (s ? line.text.slice(s[0], s[1]) : undefined)

  it('finds each step: precedence, brackets, left to right, and a float', () => {
    const w = exprWorking('2 + 3 * 4', '3 * 4', ['2 + 12', '14'])
    expect(w.map((l) => [span(l, l.work), span(l, l.made)])).toEqual([
      ['3 * 4', undefined],
      ['2 + 12', '12'],
      [undefined, '14'],
    ])
    const b = exprWorking('(2 + 3) * 4', '(2 + 3)', ['5 * 4', '20'])
    expect(span(b[0]!, b[0]!.work)).toBe('(2 + 3)')
    expect(span(b[1]!, b[1]!.made)).toBe('5')
    expect(span(b[1]!, b[1]!.work)).toBe('5 * 4')
    const l = exprWorking('10 - 2 - 3', '10 - 2', ['8 - 3', '5'])
    expect(span(l[0]!, l[0]!.work)).toBe('10 - 2')
    expect(span(l[1]!, l[1]!.made)).toBe('8')
    const f = exprWorking('8 / 2', '8 / 2', ['4.0'])
    expect(span(f[1]!, f[1]!.made)).toBe('4.0')
    // A later step found piece by piece, not character by character.
    const long = exprWorking('2 + 3 * 4 - 1', '3 * 4', ['2 + 12 - 1', '14 - 1', '13'])
    expect(span(long[1]!, long[1]!.work)).toBe('2 + 12')
    expect(span(long[2]!, long[2]!.made)).toBe('14')
  })

  it('plays only while nothing is answered, and is narration', () => {
    const p: Prop = { kind: 'expr', text: '2 + 3 * 4', first: '3 * 4', then: ['2 + 12', '14'], demo: 'work' }
    expect(sameProp(p, { kind: 'expr', text: '2 + 3 * 4', first: '3 * 4', then: ['2 + 12', '14'] })).toBe(true)
    const html = drawn(view(p))
    expect(html).toContain('expr working')
    expect(html).toContain('>14<')
    expect(html).not.toContain('= ?')
    expect(sentence(view(p))).toContain('3 * 4 first')
    // Answered, today's rules: a miss asks, and the right number typed by
    // hand still waits in amber.
    const miss = view(p, th('int', '20'), 'miss')
    expect(drawn(miss)).not.toContain('expr working')
    expect(drawn(miss)).toContain('= ?')
    expect(unworked(view(p, th('int', '14'), 'miss'))).toBe(true)
    expect(drawn(view(p, th('int', '14'), 'right'))).toContain('expr shown')
  })

  it('colours the final value by its kind', () => {
    expect(drawn(view({ kind: 'expr', text: '8 / 2', first: '8 / 2', then: ['4.0'], demo: 'work' }))).toMatch(/data-kind="float">4\.0</)
  })
})

describe('a clash', () => {
  it('reads each literal’s kind from how it is written', () => {
    expect(literalKind('"3"')).toBe('str')
    expect(literalKind("'ha'")).toBe('str')
    expect(literalKind('True')).toBe('bool')
    expect(literalKind('2.5')).toBe('float')
    expect(literalKind('4')).toBe('int')
    expect(literalKind('-1')).toBe('int')
  })

  it('draws both tiles in their kinds, the operator between, and says the robot stops', () => {
    const v = view({ kind: 'clash', left: '"3"', op: '+', right: '4' })
    const html = drawn(v)
    expect(html).toMatch(/clash-tile left" data-kind="str"/)
    expect(html).toMatch(/clash-tile right" data-kind="int"/)
    expect(html).toContain('>TypeError<')
    expect(html).toContain('>+<')
    expect(sentence(v)).toContain('The robot stops with a TypeError.')
    expect(looksRight(view({ kind: 'clash', left: '"ha"', op: '-', right: '"a"' }, th('str', "'h'")))).toBe(false)
  })
})

describe('packs, for a chained sum', () => {
  const pk = (packs: number, each: number[], loose?: number): Prop => (loose === undefined ? { kind: 'packs', packs, each } : { kind: 'packs', packs, each, loose })

  it('knows what its sum makes, and says it as the sum', () => {
    expect(packsTotal({ packs: 3, each: [4], loose: 2 })).toBe(14)
    expect(packsTotal({ packs: 2, each: [3, 4] })).toBe(14)
    expect(packsSum({ packs: 3, each: [4], loose: 2 })).toBe('3 * 4 + 2')
    expect(packsSum({ packs: 2, each: [3, 4] })).toBe('2 * (3 + 4)')
    expect(rightNumber(pk(3, [4], 2))).toBe(14)
  })

  it('draws every item, in two colours, and lights as many as the robot says', () => {
    const html = drawn(view(pk(2, [3, 4]), th('int', '5'), 'miss'))
    expect(html.match(/class="item a/g)).toHaveLength(6)
    expect(html.match(/class="item b/g)).toHaveLength(8)
    expect(html.match(/ lit"/g)).toHaveLength(5)
    const loose = drawn(view(pk(3, [4], 2), th('int', '14'), 'right'))
    expect(loose.match(/ lit"/g)).toHaveLength(14)
    expect(loose).toContain('class="loose"')
  })

  it('caps what it draws, not what it asks', () => {
    const html = drawn(view(pk(7, [9, 9], 9)))
    expect(html.match(/class="pack-box"/g)).toHaveLength(5)
    expect(html.match(/class="item /g)).toHaveLength(5 * 12 + 6)
    expect(rightNumber(pk(7, [9, 9], 9))).toBe(7 * 18 + 9)
  })

  it('waits for the right number typed by hand, and refuses one that looks right', () => {
    // Typed by hand: nothing lit, an amber `?` where the sum is.
    const typed = view(pk(2, [3, 4]), th('int', '14'), 'miss')
    expect(unworked(typed)).toBe(true)
    expect(drawn(typed)).not.toContain(' lit"')
    expect(drawn(typed)).toContain('2 * (3 + 4) = ?')
    // `14.0` looks right (every item lit)…
    expect(looksRight(view(pk(2, [3, 4]), th('float', '14.0')))).toBe(true)
    // …and, like every picture with a right number, the same value
    // refused is drawn as not worked out (compared by value) rather than
    // refused.
    expect(unworked(view(pk(2, [3, 4]), th('float', '14.0'), 'miss'))).toBe(true)
    // A wrong number is an honest miss, drawn as itself.
    expect(refused(view(pk(2, [3, 4]), th('int', '20'), 'miss'))).toBe(false)
    expect(looksRight(view(pk(2, [3, 4]), th('int', '13')))).toBe(false)
  })
})

describe('the operations pictures at their largest', () => {
  it('keeps four tanks between the jug and the edge', () => {
    const html = drawn(view({ kind: 'share', litres: 12, robots: 4 }, th('float', '3.0'), 'right'))
    const xs = [...html.matchAll(/class="tank" transform="translate\(([\d.]+),0\)"/g)].map((m) => Number(m[1]))
    expect(xs).toHaveLength(4)
    // The jug's handle ends at 76; the last tank's numbers stand 10 past
    // its edge.
    expect(Math.min(...xs) - 21 / 2).toBeGreaterThanOrEqual(78)
    expect(Math.max(...xs) + 21 / 2 + 10).toBeLessThanOrEqual(192)
  })

  it("sizes a parcel's label to sit inside it", () => {
    const html = drawn(view({ kind: 'scale', parcels: 4, each: 2.5 }))
    const size = Number(/font-size:([\d.]+)px">2.5 kg/.exec(html)?.[1])
    expect(size * 0.6 * '2.5 kg'.length).toBeLessThanOrEqual(32 - 4 + 0.05)
  })
})

describe('a goal memory', () => {
  const snap = (rows: [string, string, string][]): MemorySnapshot => {
    const objects: MemorySnapshot['objects'] = {}
    const bindings = rows.map(([name, type, repr]) => {
      const id = `v:${type}:${repr}`
      objects[id] = { id, type, kind: 'value', repr, elements: null, partial: false }
      return { name, scope: 'global', target: id }
    })
    return { bindings, objects, line: null }
  }
  const goal: Prop = { kind: 'goal', goal: [{ name: 'x', value: '3' }, { name: 'robot', value: '"Bolt"' }] }
  const withMemory = (rows: [string, string, string][]): PropView => ({ ...view(goal), memory: snap(rows) })

  it('is a blueprint without memory: every row owed, nothing ticked, nothing extra', () => {
    const g = goalShown(goal.goal, undefined)
    expect(g).toMatchObject({ checked: false, met: false, extra: [] })
    const html = drawn(view(goal))
    expect(html).toContain('data-prop="goal"')
    expect(html.match(/class="goal-row owed"/g)).toHaveLength(2)
    expect(html).not.toContain('goal-tick')
    expect(html).toContain('>Goal</text>')
    expect(html).toContain("&#x27;Bolt&#x27;")
    expect(html).toMatch(/class="goal-value" data-kind="str"/)
    expect(sentence(view(goal))).toBe("Goal, a memory to make: x points at 3; robot points at 'Bolt'.")
  })

  it('ticks what memory already has, says what a name points at now, and lists extra names', () => {
    const v = withMemory([['x', 'int', '3'], ['robot', 'int', '5'], ['z', 'int', '7']])
    const html = drawn(v)
    expect(html).toContain('data-testid="goal-row-x" data-ok="yes"')
    expect(html).toContain('data-testid="goal-row-robot" data-ok="no"')
    expect(html).toMatch(/class="goal-now"[^>]*>now: 5</)
    expect(html).toMatch(/not in the goal: z/)
    expect(html).not.toMatch(/class="goal checked met/)
    expect(sentence(v)).toBe(
      "Goal, a memory to make: x points at 3: done; robot points at 'Bolt': not yet, robot points at 5 now. Not in the goal: z.",
    )
  })

  it('settles once met, and a float is not an int', () => {
    const met = withMemory([['x', 'int', '3'], ['robot', 'str', "'Bolt'"]])
    expect(drawn(met)).toMatch(/class="goal checked met"/)
    expect(drawn(met)).toContain('✓ matches')
    expect(sentence(met)).toMatch(/The robot's memory matches it\.$/)
    expect(goalShown(goal.goal, snap([['x', 'float', '3.0'], ['robot', 'str', "'Bolt'"]])).met).toBe(false)
  })

  it('draws at most four rows but is met only by the whole goal', () => {
    const five: Prop = { kind: 'goal', goal: ['a', 'b', 'c', 'd', 'e'].map((name) => ({ name, value: '1' })) }
    const four = snap(['a', 'b', 'c', 'd'].map((n) => [n, 'int', '1']))
    const g = goalShown((five as Extract<Prop, { kind: 'goal' }>).goal, four)
    expect(g.rows).toHaveLength(GOAL_ROWS)
    expect(g.met).toBe(false)
    expect(sentence({ ...view(five), memory: four })).toMatch(/And 1 more\./)
  })

  it('keeps long names and values inside the frame', () => {
    const long: Prop = { kind: 'goal', goal: [{ name: 'greeting_for_everyone', value: '"hello there, friend"' }] }
    const html = drawn(view(long))
    const boxes = goalBoxes(html)
    expect(Math.max(...boxes.map((b) => b.r))).toBeLessThanOrEqual(197)
    expect(Math.min(...boxes.map((b) => b.x))).toBeGreaterThanOrEqual(3)
    expect(html).toContain('…')
  })

  it('fills its frame: one or two rows read large, and a full goal still fits', () => {
    const one = drawn(view({ kind: 'goal', goal: [{ name: 'x', value: '3' }] }))
    expect(goalScale(one) * 10).toBeGreaterThanOrEqual(13)
    const two = drawn(view({ kind: 'goal', goal: [{ name: 'x', value: '3' }, { name: 'name', value: '"Bolt"' }] }))
    expect(goalScale(two) * 10.5).toBeGreaterThanOrEqual(13)
    const three = drawn(view({ kind: 'goal', goal: [{ name: 'x', value: '3' }, { name: 'name', value: '"Bolt"' }, { name: 'speed', value: '2.5' }] }))
    expect(goalScale(three) * 10).toBeGreaterThanOrEqual(11)
    for (const html of [one, two, three]) {
      const boxes = goalBoxes(html)
      expect(Math.max(...boxes.map((b) => b.b))).toBeLessThanOrEqual(114)
      expect(Math.min(...boxes.map((b) => b.y))).toBeGreaterThanOrEqual(19)
    }
  })

  it('is its own goal: a different goal is a different picture, and it draws no answer into itself', () => {
    expect(sameProp(goal, { ...goal })).toBe(true)
    expect(sameProp(goal, { kind: 'goal', goal: [{ name: 'x', value: '4' }] })).toBe(false)
    expect(looksRight({ ...withMemory([['x', 'int', '3']]), answer: th('int', '3'), verdict: 'miss' })).toBe(false)
    expect(rightNumber(goal)).toBeNull()
  })
})

describe('a goal memory with a list', () => {
  const val = (repr: string) => {
    const type = /^'/.test(repr) ? 'str' : repr.includes('.') ? 'float' : 'int'
    return { id: `v:${type}:${repr}`, type, kind: 'value' as const, repr, elements: null, partial: false }
  }
  /** A memory of lists and scalars: `[name, items]` makes a list of its own,
   *  `[name, '=other']` points at other's object. */
  const memoryOf = (...rows: [string, string[] | string][]): MemorySnapshot => {
    const objects: MemorySnapshot['objects'] = {}
    const bindings: MemorySnapshot['bindings'] = []
    for (const [name, what] of rows) {
      if (typeof what === 'string' && what.startsWith('=')) {
        bindings.push({ name, scope: 'global', target: bindings.find((b) => b.name === what.slice(1))!.target })
      } else if (typeof what === 'string') {
        const o = val(what)
        objects[o.id] = o
        bindings.push({ name, scope: 'global', target: o.id })
      } else {
        const els = what.map((r, i) => {
          const o = val(r)
          objects[o.id] = o
          return { label: String(i), target: o.id }
        })
        objects[`r:${name}`] = { id: `r:${name}`, type: 'list', kind: 'reference', repr: `list[${what.length}]`, elements: els, partial: false }
        bindings.push({ name, scope: 'global', target: `r:${name}` })
      }
    }
    return { bindings, objects, line: null }
  }
  const list: Prop = { kind: 'goal', goal: [{ name: 'scores', value: '[3, 9, 2]' }] }
  const alias: Prop = {
    kind: 'goal',
    goal: [
      { name: 'scores', value: '[3, 9, 2, 4]' },
      { name: 'backup', value: '[3, 9, 2, 4]', same: 'scores' },
    ],
  }
  const goalOf = (p: Prop) => (p as Extract<Prop, { kind: 'goal' }>).goal

  it('draws a list as numbered slots, each pointing at a chip of its own, never values in the list', () => {
    const html = drawn(view(list))
    expect(html.match(/class="goal-slot"/g)).toHaveLength(3)
    expect(html.match(/class="slot-index">\d</g)?.map((m) => m.slice(-2, -1))).toEqual(['0', '1', '2'])
    const card = /<rect[^>]*class="goal-list-card slot-strip"[^>]*>/.exec(html)
    expect(card).not.toBeNull()
    expect(html.match(/class="goal-card goal-chip" data-kind="int"/g)).toHaveLength(3)
    expect(sentence(view(list))).toBe('Goal, a memory to make: scores points at a list: index 0 → 3, index 1 → 9, index 2 → 2.')
  })

  it('says what the list holds now, slot by slot', () => {
    const v = { ...view(list), memory: memoryOf(['scores', ['3', '5', '2']]) }
    // Compactly, and never cut: its type shrinks to fit the row instead.
    expect(drawn(v)).toContain('now: 3, 5, 2')
    expect(drawn(v)).toContain('data-testid="goal-row-scores" data-ok="no"')
    const ok = { ...view(list), memory: memoryOf(['scores', ['3', '9', '2']]) }
    expect(drawn(ok)).toContain('data-testid="goal-row-scores" data-ok="yes"')
    expect(goalShown(goalOf(list), ok.memory).met).toBe(true)
  })

  it('draws a same row as an arrow converging on the list, not a second list', () => {
    const g = goalShown(goalOf(alias), undefined)
    expect(g.rows.map((r) => r.alias)).toEqual([null, 0])
    expect(g.rows[1]!.items).toBeNull()
    const html = drawn(view(alias))
    expect(html.match(/class="goal-list-card/g)).toHaveLength(1)
    expect(html).toContain('goal-alias')
    expect(sentence(view(alias))).toMatch(/backup points at the very same list as scores\.$/)
  })

  it('ticks a same row only for the very same list, and calls an equal one a copy', () => {
    const copy = memoryOf(['scores', ['3', '9', '2', '4']], ['backup', ['3', '9', '2', '4']])
    const g = goalShown(goalOf(alias), copy)
    expect(g.rows.map((r) => r.ok)).toEqual([true, false])
    expect(g.rows[1]!.sameNow).toBe(false)
    expect(drawn({ ...view(alias), memory: copy })).toContain('now: a copy')
    expect(sentence({ ...view(alias), memory: copy })).toMatch(/backup points at a copy now/)
    const same = memoryOf(['scores', ['3', '9', '2', '4']], ['backup', '=scores'])
    expect(goalShown(goalOf(alias), same)).toMatchObject({ met: true })
    expect(drawn({ ...view(alias), memory: same })).toMatch(/class="goal checked met"/)
  })

  it('draws at most three rows with a list, five slots, and keeps a long list inside the frame', () => {
    const mixed = [
      { name: 'crew', value: '["Mira", "Bolt", "Sprocket", "Ada", "Zed", "Kit"]' },
      { name: 'total', value: '19' },
      { name: 'name', value: '"Bolt"' },
      { name: 'ready', value: 'True' },
    ]
    const g = goalShown(mixed, undefined)
    expect(g.rows).toHaveLength(GOAL_ROWS_WITH_LIST)
    expect(g.rows[0]!.items).toHaveLength(GOAL_ITEMS)
    const html = drawn(view({ kind: 'goal', goal: mixed }))
    const boxes = goalBoxes(html)
    expect(Math.max(...boxes.map((b) => b.r))).toBeLessThanOrEqual(197)
    expect(Math.max(...boxes.map((b) => b.b))).toBeLessThanOrEqual(127)
    const chips = chipsOf(html)
    expect(chips.map((c) => c.text)).toEqual(["'Mira'", "'Bolt'", "'Sprocket'", "'Ada'", "'Zed'"])
    expect(inReadingOrder(chips)).toBe(true)
    // Five strs on their own would scale small on one line, so they wrap
    // onto a second, as a last resort, still in slot order.
    const crew = drawn(view({ kind: 'goal', goal: [{ name: 'crew', value: '["Mira", "Bolt", "Sprocket", "Ada", "Zed"]' }] }))
    expect(new Set(chipsOf(crew).map((c) => c.y)).size).toBe(2)
    expect(inReadingOrder(chipsOf(crew))).toBe(true)
  })

  /** A list's chips in slot order, where each is drawn and what it says. */
  const chipsOf = (html: string) =>
    [...html.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="[\d.]+" height="13" rx="3" class="goal-card goal-chip"[^>]*><\/rect><text[^>]*>([^<]*)</g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
      text: m[3]!.replace(/&#x27;/g, "'"),
    }))
  const inReadingOrder = (cs: { x: number; y: number }[]) => cs.every((c, i) => i === 0 || c.y > cs[i - 1]!.y || (c.y === cs[i - 1]!.y && c.x > cs[i - 1]!.x))

  it('lays four short items out on one line, each under its own slot, in slot order', () => {
    for (const value of ['["sword", "bow", "potion"]', '["sword", "bow", "potion", "map"]', '["Pip", "Bolt", "Mira"]']) {
      const html = drawn(view({ kind: 'goal', goal: [{ name: 'hotbar', value }] }))
      const chips = chipsOf(html)
      expect(new Set(chips.map((c) => c.y)).size).toBe(1)
      expect(inReadingOrder(chips)).toBe(true)
      // Each chip sits under its own slot number.
      const idx = [...html.matchAll(/<text x="([-\d.]+)"[^>]*class="slot-index">(\d)</g)].map((m) => Number(m[1]))
      const mids = [...html.matchAll(/<rect x="([-\d.]+)" y="[-\d.]+" width="([\d.]+)" height="13" rx="3" class="goal-card goal-chip"/g)].map((m) => Number(m[1]) + Number(m[2]) / 2)
      idx.forEach((x, j) => expect(Math.abs(x - mids[j]!)).toBeLessThan(0.01))
    }
    const party = drawn(view({ kind: 'goal', goal: [{ name: 'party', value: '["Pip", "Bolt", "Mira"]' }, { name: 'team', value: '["Pip", "Bolt", "Mira"]', same: 'party' }] }))
    expect(new Set(chipsOf(party).map((c) => c.y)).size).toBe(1)
  })

  it('writes what a list holds now compactly, whole, shrunk to fit rather than cut', () => {
    const goal: Prop = { kind: 'goal', goal: [{ name: 'hotbar', value: '["sword", "bow", "potion"]' }] }
    const html = drawn({ ...view(goal), memory: memoryOf(['hotbar', ["'sword'", "'shield'", "'potion'"]]) })
    const now = /class="goal-now" style="font-size:([\d.]+)px">([^<]*)</.exec(html)!
    expect(now[2]).toBe('now: sword, shield, potion')
    expect(Number(now[1]) * goalScale(html)).toBeGreaterThanOrEqual(7.5)
    const long = drawn({ ...view(goal), memory: memoryOf(['hotbar', ["'sword'", "'shield'", "'potion'", "'pickaxe'", "'helmet'"]]) })
    expect(/class="goal-now"[^>]*>([^<]*)</.exec(long)![1]).toBe('now: sword, shield, potion, pickaxe, helmet')
  })

  it('draws no answer tag: memory is the answer, and the tag would cover its foot', () => {
    expect(drawn({ ...view(list), answer: th('int', '3') })).not.toContain('answer-tag')
  })
})

describe('an inventory hotbar', () => {
  const p = (items: string[], mark?: number): Prop => (mark === undefined ? { kind: 'hotbar', items } : { kind: 'hotbar', items, mark })
  const bar = (items: string[], mark?: number) => p(items, mark) as Extract<Prop, { kind: 'hotbar' }>
  const three = ['sword', 'shield', 'potion']

  it('draws a cell per item with its icon and name, and numbers the slots from 0', () => {
    const html = drawn(view(p(three)))
    expect(html.match(/class="hotbar-cell"/g)).toHaveLength(3)
    expect(html.match(/data-item="(\w+)"/g)).toEqual(['data-item="sword"', 'data-item="shield"', 'data-item="potion"'])
    expect(html.match(/class="hotbar-name"[^>]*>\w+</g)).toHaveLength(3)
    expect(html.match(/class="slot-index"[^>]*>(\d)</g)?.map((m) => m.slice(-2, -1))).toEqual(['0', '1', '2'])
    expect(drawn(view(p(['a', 'b', 'c', 'd', 'e', 'f', 'g']))).match(/class="hotbar-cell"/g)).toHaveLength(HOTBAR_MAX)
  })

  it('has an icon for every listed item, and writes any other name on a plain tile', () => {
    for (const it of HOTBAR_ICONS) expect(drawn(view(p([it])))).toMatch(/class="icon"/)
    const odd = drawn(view(p(['banana'])))
    expect(odd).not.toMatch(/class="icon"/)
    expect(odd).toMatch(/class="hotbar-word"[^>]*>banana</)
  })

  it('says what each slot holds, and which is selected', () => {
    expect(sentence(view(p(three, 1)))).toBe('A hotbar of three slots: index 0 holds a sword, index 1 a shield, index 2 a potion. Index 1 is selected.')
    expect(sentence(view(p(['apple'])))).toBe('A hotbar of one slot: index 0 holds an apple.')
  })

  it('selects the marked slot, and moving the mark or swapping an item is narration', () => {
    const html = drawn(view(p(three, 1)))
    expect(html).toMatch(/class="hotbar-slot marked" data-testid="hotbar-1"/)
    expect(html.match(/data-testid="hotbar-select"/g)).toHaveLength(1)
    expect(drawn(view(p(three)))).not.toContain('hotbar-select')
    expect(sameProp(p(three, 0), p(three, 2))).toBe(true)
    expect(sameProp(p(three, 1), p(['sword', 'bow', 'potion'], 1))).toBe(true)
    expect(sameProp(p(three), p([...three, 'map']))).toBe(false)
  })

  it('lights the cell a str names, the selected one first; a str none holds, or a number, is only its tag', () => {
    expect(hotbarLit(bar(['key', 'gem', 'key'], 2), th('str', "'key'"))).toBe(2)
    expect(hotbarLit(bar(['key', 'gem', 'key']), th('str', "'key'"))).toBe(0)
    expect(hotbarLit(bar(three), th('int', '1'))).toBeNull()
    const lit = view(p(three, 1), th('str', "'shield'"), 'right')
    expect(drawn(lit)).toMatch(/data-testid="hotbar-1"[^>]*data-lit="yes"/)
    expect(drawn(lit).match(/data-lit="yes"/g)).toHaveLength(1)
    expect(drawn(lit)).toContain('data-testid="answer-tag"')
    expect(sentence(lit)).toBe(
      "A hotbar of three slots: index 0 holds a sword, index 1 a shield, index 2 a potion. Index 1 is selected. The robot's 'shield' lights index 1.",
    )
    const miss = view(p(three), th('str', "'bow'"), 'miss')
    expect(drawn(miss)).not.toContain('data-lit')
    expect(sentence(miss)).toMatch(/No slot holds 'bow'\.$/)
    const num = view(p(three), th('int', '1'), 'miss')
    expect(drawn(num)).not.toContain('data-lit')
    expect(drawn(num)).toContain('data-kind="int"')
  })

  it('looks right with the selected cell’s item, so a refused one is amber, and is never unworked', () => {
    expect(looksRight(view(p(three, 1), th('str', "'shield'")))).toBe(true)
    expect(looksRight(view(p(three, 1), th('str', "'sword'")))).toBe(false)
    expect(looksRight(view(p(three), th('str', "'shield'")))).toBe(false)
    const no = view(p(three, 1), th('str', "'shield'"), 'miss')
    expect(refused(no)).toBe(true)
    expect(drawn(no)).toMatch(/class="hotbar refused"/)
    expect(rightNumber(p(three, 1))).toBeNull()
    expect(unworked(no)).toBe(false)
  })

  it('keeps six slots inside the picture and clear of the answer tag', () => {
    const html = drawn(view(p(['sword', 'shield', 'potion', 'pickaxe', 'helmet', 'torch'], 5)))
    // The bar's own boxes; the icons' shapes are drawn inside their cells.
    const boxes = [...html.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*class="(?:hotbar|slot)/g)].map((m) => m.slice(1, 5).map(Number))
    expect(boxes.length).toBeGreaterThan(12)
    expect(Math.min(...boxes.map((b) => b[0]!))).toBeGreaterThanOrEqual(4)
    expect(Math.max(...boxes.map((b) => b[0]! + b[2]!))).toBeLessThanOrEqual(196)
    expect(Math.max(...boxes.map((b) => b[1]! + b[3]!))).toBeLessThanOrEqual(117)
  })
})

describe('a backpack', () => {
  const p = (items: string[], mark?: number): Prop => (mark === undefined ? { kind: 'backpack', items } : { kind: 'backpack', items, mark })
  const four = ['map', 'torch', 'rope', 'apple']

  it('tucks each item into a pocket with its icon or a tile, its name, and its index under the pack', () => {
    const html = drawn(view(p(four)))
    expect(html.match(/class="pack-pocket"/g)).toHaveLength(4)
    expect(html.match(/data-item="(\w+)"/g)).toEqual(four.map((it) => `data-item="${it}"`))
    expect(html.match(/class="icon"/g)).toHaveLength(3)
    expect(html).toMatch(/class="hotbar-word"[^>]*>rope</)
    expect(html.match(/class="slot-index"[^>]*>(\d)</g)?.map((m) => m.slice(-2, -1))).toEqual(['0', '1', '2', '3'])
    expect(drawn(view(p(['a', 'b', 'c', 'd', 'e', 'f', 'g']))).match(/class="pocket-back"/g)).toHaveLength(BACKPACK_MAX)
    expect(sentence(view(p(four, 1)))).toBe('A backpack with four pockets: index 0 holds a map, index 1 a torch, index 2 a rope, index 3 an apple. The item at index 1 is lifted out.')
  })

  it('lifts the marked item, and moving the mark or swapping an item is narration', () => {
    expect(drawn(view(p(four, 2)))).toMatch(/class="pack-pocket marked" data-testid="pocket-2"/)
    expect(sameProp(p(four, 0), p(four, 3))).toBe(true)
    expect(sameProp(p(four, 1), p(['map', 'gem', 'rope', 'apple'], 1))).toBe(true)
    expect(sameProp(p(four), p([...four, 'key']))).toBe(false)
    expect(sameProp(p(four), { kind: 'hotbar', items: four })).toBe(false)
  })

  it('lights the item a str names, the marked one first; a str none holds is only its tag', () => {
    const lit = view(p(['key', 'gem', 'key'], 2), th('str', "'key'"), 'right')
    expect(drawn(lit)).toMatch(/data-testid="pocket-2"[^>]*data-lit="yes"/)
    expect(drawn(lit).match(/data-lit="yes"/g)).toHaveLength(1)
    expect(sentence(lit)).toMatch(/The robot's 'key' lights index 2\.$/)
    const miss = view(p(four), th('str', "'bow'"), 'miss')
    expect(drawn(miss)).not.toContain('data-lit')
    expect(drawn(miss)).toContain('data-testid="answer-tag"')
    expect(sentence(miss)).toMatch(/No pocket holds 'bow'\.$/)
  })

  it('counts with an int: a tag, and that many pockets ticked in order', () => {
    const right = view(p(four), th('int', '4'), 'right')
    expect(backpackTicks(right)).toBe(4)
    expect(drawn(right).match(/data-ticked="yes"/g)).toHaveLength(4)
    expect(drawn(right)).toMatch(/class="pack-count all"[\s\S]*>4 things</)
    expect(sentence(right)).toMatch(/The robot counts 4 things, ticking every pocket\.$/)
    const two = view(p(four), th('int', '2'), 'miss')
    expect(backpackTicks(two)).toBe(2)
    expect(drawn(two)).toMatch(/data-testid="pocket-0"[^>]*data-ticked="yes"/)
    expect(drawn(two)).toMatch(/data-testid="pocket-1"[^>]*data-ticked="yes"/)
    expect(drawn(two)).not.toMatch(/data-testid="pocket-2"[^>]*data-ticked/)
    expect(backpackTicks(view(p(four), th('int', '9'), 'miss'))).toBe(4)
  })

  it('draws the right count typed by hand unworked: an amber ?, nothing ticked', () => {
    expect(rightNumber(p(four))).toBe(4)
    const typed = view(p(four), th('int', '4'), 'miss')
    expect(unworked(typed)).toBe(true)
    expect(refused(typed)).toBe(false)
    expect(backpackTicks(typed)).toBeNull()
    expect(drawn(typed)).not.toContain('data-ticked')
    expect(drawn(typed)).toMatch(/class="pack-count waiting"[\s\S]*>\? things</)
    expect(drawn(typed)).toContain('data-worked="no"')
    expect(sentence(typed)).toMatch(/has not counted them yet\./)
  })

  it('looks right with the marked item or the count, so a refused item is amber', () => {
    expect(looksRight(view(p(four, 1), th('str', "'torch'")))).toBe(true)
    expect(looksRight(view(p(four, 1), th('str', "'map'")))).toBe(false)
    expect(looksRight(view(p(four), th('int', '4')))).toBe(true)
    expect(looksRight(view(p(four), th('int', '3')))).toBe(false)
    const no = view(p(four, 1), th('str', "'torch'"), 'miss')
    expect(refused(no)).toBe(true)
    expect(drawn(no)).toMatch(/class="backpack refused"/)
  })

  it('keeps six pockets inside the picture and clear of the answer tag', () => {
    const html = drawn(view(p(['sword', 'shield', 'potion', 'pickaxe', 'helmet', 'torch'], 5), th('int', '6'), 'right'))
    const boxes = [...html.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*class="(?:pack|pocket|slot)/g)].map((m) => m.slice(1, 5).map(Number))
    expect(boxes.length).toBeGreaterThan(12)
    expect(Math.min(...boxes.map((b) => b[0]!))).toBeGreaterThanOrEqual(4)
    expect(Math.max(...boxes.map((b) => b[0]! + b[2]!))).toBeLessThanOrEqual(196)
    expect(Math.max(...boxes.map((b) => b[1]! + b[3]!))).toBeLessThanOrEqual(117)
  })
})
