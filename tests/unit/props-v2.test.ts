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
  asWritten,
  caseResult,
  gateCurrent,
  gateOpens,
  gateShows,
  hudBar,
  hudIcon,
  literalBool,
  pathIcon,
  pathMarks,
  sameLiteral,
  tallyShows,
  type Prop,
  type PropView,
} from '../../src/scene/props'
import type { Run } from '../../content/lessons/core'
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

  it('draws at most four rows with a list, five slots, and keeps a long list inside the frame', () => {
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

/* ------------------------- lessons 6 to 8: the cave ------------------------- */

const snap = (bindings: [string, string, string][]): MemorySnapshot => {
  const objects: MemorySnapshot['objects'] = {}
  const out = bindings.map(([name, type, repr]) => {
    const id = `v:${type}:${repr}`
    objects[id] = { id, type, kind: 'value', repr, elements: null, partial: false }
    return { name, scope: 'global', target: id }
  })
  return { bindings: out, objects, line: null }
}

describe('a status panel', () => {
  const p = (mark?: string[]): Prop => ({
    kind: 'hud',
    stats: [
      { name: 'hp', value: '80' },
      { name: 'has_key', value: 'False' },
      { name: 'bag', value: '["map", "torch"]' },
    ],
    ...(mark ? { mark } : {}),
  })

  it('picks each icon from the name, and a list draws its items', () => {
    expect(hudIcon('hp', '80')).toBe('heart')
    expect(hudIcon('health', '5')).toBe('heart')
    expect(hudIcon('gold', '3')).toBe('coin')
    expect(hudIcon('level', '6')).toBe('star')
    expect(hudIcon('has_key', 'True')).toBe('key')
    expect(hudIcon('torch_lit', 'False')).toBe('torch')
    expect(hudIcon('potions', '2')).toBe('potion')
    expect(hudIcon('gems', '2')).toBe('gem')
    expect(hudIcon('name', '"Mira"')).toBe('tag')
    expect(hudIcon('bag', '["map", "torch"]')).toBe('items')
    expect(hudIcon('speed', '3')).toBe('tile')
    expect(hudBar('80')).toBeCloseTo(0.8)
    expect(hudBar('250')).toBe(1)
    expect(hudBar('"x"')).toBeNull()
    expect(literalBool('True')).toBe(true)
    expect(literalBool('"True"')).toBeNull()
  })

  it('draws a row per stat, the marked ones framed, the False key ghosted', () => {
    const html = drawn(view(p(['has_key'])))
    expect(html).toMatch(/data-testid="hud-hp"/)
    expect(html).toMatch(/data-testid="hud-has_key" data-marked="yes"/)
    expect(html).toMatch(/hud-icon ghost/)
    expect(html).toMatch(/data-kind="int"[^>]*>[\s\S]*?>80</)
    expect(html).not.toContain('hud-badge')
    expect(sentence(view(p(['has_key'])))).toBe('A status panel: hp is 80, has_key is False, bag holds map and torch. The question reads has_key.')
  })

  it('waits with a ? badge on the ask, and a bool is a verdict badge; amber when refused', () => {
    expect(drawn({ ...view(p()), ask: 'Can we go in?' })).toMatch(/hud-badge waiting/)
    const yes = view(p(), th('bool', 'True'), 'right')
    expect(drawn(yes)).toMatch(/class="hud-badge "[\s\S]*>True</)
    expect(refused(yes)).toBe(false)
    const no = view(p(), th('bool', 'False'), 'miss')
    expect(refused(no)).toBe(true)
    expect(drawn(no)).toMatch(/hud-badge refused/)
    expect(drawn(view(p(), th('int', '3'), 'miss'))).not.toContain('hud-badge')
  })

  it('keeps the panel on stage while values change, but not names', () => {
    expect(sameProp(p(), { ...p(['hp']), stats: [{ name: 'hp', value: '20' }, { name: 'has_key', value: 'True' }, { name: 'bag', value: '[]' }] } as Prop)).toBe(true)
    expect(sameProp(p(), { kind: 'hud', stats: [{ name: 'hp', value: '80' }] })).toBe(false)
  })

  it('keeps five rows inside the picture and clear of the answer tag', () => {
    const five: Prop = { kind: 'hud', title: 'Mira', stats: ['hp', 'coins', 'level', 'potions', 'gems'].map((name) => ({ name, value: '12' })) }
    const html = drawn(view(five, th('bool', 'True'), 'right'))
    const rects = [...html.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => m.slice(1, 5).map(Number))
    expect(Math.max(...rects.map((b) => b[1]! + b[3]!))).toBeLessThanOrEqual(116)
    expect(html.match(/class="hud-row/g)).toHaveLength(5)
  })
})

describe('a gate worked by and or or', () => {
  const and = (a: boolean, b: boolean, demo?: 'try'): Prop => ({ kind: 'gate', op: 'and', locks: [{ label: 'has_key', on: a }, { label: 'level >= 5', on: b }], ...(demo ? { demo } : {}) })
  const or = (a: boolean, b: boolean): Prop => ({ kind: 'gate', op: 'or', locks: [{ label: 'has_key', on: a }, { label: 'level >= 5', on: b }] })

  it('opens for and only when every lamp is lit, for or when any is', () => {
    expect(gateOpens({ op: 'and', locks: [{ on: true }, { on: true }] })).toBe(true)
    expect(gateOpens({ op: 'and', locks: [{ on: true }, { on: false }] })).toBe(false)
    expect(gateOpens({ op: 'or', locks: [{ on: false }, { on: true }] })).toBe(true)
    expect(gateOpens({ op: 'or', locks: [{ on: false }, { on: false }] })).toBe(false)
  })

  it('carries the current through a series circuit only as far as the lamps are lit', () => {
    expect(gateCurrent({ op: 'and', locks: [{ on: false }, { on: true }] })).toEqual({ into: [true, false], outOf: [false, false], gate: false })
    expect(gateCurrent({ op: 'and', locks: [{ on: true }, { on: false }] })).toEqual({ into: [true, true], outOf: [true, false], gate: false })
    expect(gateCurrent({ op: 'or', locks: [{ on: false }, { on: true }] })).toEqual({ into: [true, true], outOf: [false, true], gate: true })
  })

  it('waits shut with no current until answered; an agreeing bool opens or shuts it', () => {
    expect(gateShows(view(and(true, true)))).toBe('waiting')
    expect(drawn(view(and(true, true)))).not.toContain('gate-wire live')
    expect(drawn(view(and(true, true)))).toMatch(/data-testid="gate-plaque"[\s\S]*?>\?</)
    const open = view(or(false, true), th('bool', 'True'), 'right')
    expect(gateShows(open)).toBe('open')
    expect(drawn(open)).toMatch(/class="gate-prop open"/)
    expect(drawn(open)).toContain('gate-wire live')
    expect(sentence(open)).toMatch(/gate opens\.$/)
    const shut = view(and(true, false), th('bool', 'False'), 'right')
    expect(gateShows(shut)).toBe('shut')
    expect(sentence(shut)).toMatch(/stays shut\.$/)
  })

  it('moves nothing for a bool that disagrees, or one refused, and says so in amber', () => {
    expect(gateShows(view(and(true, false), th('bool', 'True'), null))).toBe('refused')
    const no = view(and(true, true), th('bool', 'True'), 'miss')
    expect(gateShows(no)).toBe('refused')
    expect(refused(no)).toBe(true)
    expect(drawn(no)).toMatch(/class="gate-prop refused"/)
    expect(drawn(no)).toContain('>True?<')
    expect(drawn(no)).not.toContain('gate-wire live')
    expect(gateShows(view(and(true, true), th('str', "'yes'"), 'miss'))).toBe('waiting')
  })

  it('lets the try demonstration decide, and keeps the gate while lamps change', () => {
    expect(gateShows(view(and(true, true, 'try')))).toBe('open')
    expect(gateShows(view(and(true, false, 'try')))).toBe('shut')
    expect(sameProp(and(true, false), and(true, true, 'try'))).toBe(true)
    expect(sameProp(and(true, false), or(true, false))).toBe(false)
    expect(drawn(view(or(true, false))).match(/class="gate-op"/g)).toHaveLength(1)
    expect(sentence(view(and(true, false)))).toMatch(/^A cave gate worked by lamps in a row on one wire \(and/)
  })
})

describe('a fork of if, elif and else', () => {
  const branches = [
    { test: 'hp > 50', result: '"fight"' },
    { test: 'potions > 0', result: '"drink"' },
    { test: 'else', result: '"run"' },
  ]
  const p = (taken?: number | null, demo?: 'walk'): Prop => ({ kind: 'paths', branches, ...(taken !== undefined ? { taken } : {}), ...(demo ? { demo } : {}) })

  it('ticks the branch taken, crosses those before it and skips those after', () => {
    expect(pathMarks({ branches })).toEqual(['none', 'none', 'none'])
    expect(pathMarks({ branches, taken: 1 })).toEqual(['no', 'yes', 'skipped'])
    expect(pathMarks({ branches, taken: 0 })).toEqual(['yes', 'skipped', 'skipped'])
    expect(pathMarks({ branches, taken: null })).toEqual(['no', 'no', 'no'])
    expect(drawn(view(p(1)))).toMatch(/data-testid="branch-2" data-mark="skipped"/)
  })

  it('names an icon for where a branch leads', () => {
    expect(pathIcon('"fight"')).toBe('sword')
    expect(pathIcon("'drink'")).toBe('potion')
    expect(pathIcon('run')).toBe('boots')
    expect(pathIcon('"sneak"')).toBe('sneak')
    expect(pathIcon('"rest"')).toBe('campfire')
    expect(pathIcon('"open"')).toBe('door')
    expect(pathIcon('"dance"')).toBe('sign')
  })

  it('says the first yes wins and the rest are never checked', () => {
    expect(sentence(view(p(1)))).toBe(
      'A fork in a cave tunnel, its signs checked from the top: if hp > 50, "fight"; if potions > 0, "drink"; else, "run". The first sign said no. potions > 0 says yes: it goes to "drink". The sign after it is never checked.',
    )
    expect(sentence(view(p(null)))).toMatch(/Every sign said no, and the robot walks straight on\.$/)
  })

  it('walks with keyframes made for its rows, and keeps the fork while it decides', () => {
    const html = drawn(view(p(2, 'walk')))
    expect(html).toContain('@keyframes paths-walk-3-2')
    expect(html).toContain('animation-name:paths-walk-3-2')
    expect(drawn(view(p(2)))).not.toContain('@keyframes')
    expect(sameProp(p(), p(1, 'walk'))).toBe(true)
  })
})

describe('a tally of coins', () => {
  const p = (mark?: number, total?: number | null): Prop => ({ kind: 'tally', values: [3, 5, 2], ...(mark !== undefined ? { mark } : {}), ...(total !== undefined ? { total } : {}) })

  it('points at the pass, ticks what is counted, and shows the total', () => {
    const html = drawn(view(p(1, 3)))
    expect(html).toMatch(/data-testid="coin-0" data-counted="yes"/)
    expect(html).toMatch(/data-testid="coin-1" data-marked="yes"/)
    expect(html).toContain('data-testid="tally-pointer"')
    expect(html).toMatch(/data-kind="int" data-testid="tally-card"[\s\S]*?>3</)
    expect(sentence(view(p(1, 3)))).toBe('A row of 3 coins: 3, 5, 2. The loop is at the 5; 3 already counted. total holds 3.')
    expect(drawn(view(p()))).toMatch(/tally-card empty/)
    expect(sentence(view(p(3, 10)))).toMatch(/Every one is counted\. total holds 10\.$/)
  })

  it('writes a number the robot thinks of in the counter, amber when refused', () => {
    expect(tallyShows(view(p(3, null), th('int', '10'), 'right'))).toEqual({ text: '10', kind: 'int', refused: false })
    const no = view(p(3), th('float', '10.0'), 'miss')
    expect(tallyShows(no)!.refused).toBe(true)
    expect(refused(no)).toBe(true)
    expect(drawn(no)).toMatch(/tally-card refused/)
    expect(tallyShows(view(p(), th('str', "'10'"), 'miss'))).toBeNull()
    expect(sameProp(p(0, 0), p(2, 8))).toBe(true)
  })
})

describe('a scoreboard of cases', () => {
  const p: Prop = { kind: 'cases', name: 'action', rows: [{ given: 'hp = 20', want: '"run"' }, { given: 'hp = 80', want: '"fight"' }, { given: 'hp = 0', want: '"rest"' }] }
  const run = (cases: { raised?: string; mem: [string, string, string][] }[]): Run => ({
    source: '',
    ok: true,
    raised: null,
    line: null,
    ran: [],
    final: snap([]),
    cases: cases.map((c, i) => ({ given: { hp: ['20', '80', '0'][i]! }, ok: !c.raised, raised: c.raised ?? null, final: snap(c.mem) })),
  })

  it('reads each case from the run: the value, nothing, or the error', () => {
    const v: PropView = { ...view(p), run: run([{ mem: [['action', 'str', "'run'"]] }, { mem: [['action', 'str', "'run'"]] }, { raised: 'NameError', mem: [] }]) }
    expect(caseResult(v, 0)).toEqual({ got: "'run'", ok: true, how: 'value' })
    expect(caseResult(v, 1)).toEqual({ got: "'run'", ok: false, how: 'value' })
    expect(caseResult(v, 2)).toEqual({ got: 'NameError', ok: false, how: 'error' })
    expect(caseResult({ ...view(p), run: run([{ mem: [['hp', 'int', '20']] }]) }, 0)).toEqual({ got: 'nothing', ok: false, how: 'nothing' })
    expect(caseResult({ ...view(p), run: run([{ raised: 'steps', mem: [] }]) }, 0)!.got).toBe('never ends')
    expect(caseResult(view(p), 0)).toBeNull()
    expect(caseResult(v, 5)).toBeNull()
    // A run tried on another step's cases is not this scoreboard's.
    const other: PropView = { ...v, run: { ...v.run!, cases: v.run!.cases!.map((c) => ({ ...c, given: { cave: '[]' } })) } }
    expect(caseResult(other, 0)).toBeNull()
    const html = drawn(v)
    expect(html).toMatch(/data-testid="case-0" data-state="ok"/)
    expect(html).toMatch(/data-testid="case-1" data-state="wrong"/)
    expect(sentence(v)).toMatch(/With hp = 80, action should be "fight"; it got 'run', not right/)
  })

  it('reads a list by its items, as Python writes them', () => {
    const bag: Prop = { kind: 'cases', name: 'bag', rows: [{ given: 'cave = ["gem"]', want: "['gem']" }] }
    const final: MemorySnapshot = {
      bindings: [{ name: 'bag', scope: 'global', target: 'L' }],
      objects: {
        L: { id: 'L', type: 'list', kind: 'reference', repr: '1 item', elements: [{ label: '0', target: 'g' }], partial: false },
        g: { id: 'g', type: 'str', kind: 'value', repr: "'gem'", elements: null, partial: false },
      },
      line: null,
    }
    const r: Run = { source: '', ok: true, raised: null, line: null, ran: [], final, cases: [{ given: { cave: '["gem"]' }, ok: true, raised: null, final }] }
    expect(caseResult({ ...view(bag), run: r }, 0)).toEqual({ got: "['gem']", ok: true, how: 'value' })
  })

  it('shows a dash and no marks before a run', () => {
    const html = drawn(view(p))
    expect(html).not.toContain('cases-mark')
    expect(html.match(/>—</g)).toHaveLength(3)
    expect(sentence(view(p))).toMatch(/^The robot tries the program on 3 cases, not run yet\./)
  })

  it('compares literals by value, whichever quotes', () => {
    expect(asWritten("'run'")).toBe('"run"')
    expect(asWritten('42')).toBe('42')
    expect(sameLiteral("'it\\'s'", '"it\'s"')).toBe(true)
    expect(sameLiteral('"run"', '"Run"')).toBe(false)
  })
})
