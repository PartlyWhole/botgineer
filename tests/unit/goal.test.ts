/**
 * A goal memory against the robot's (`memory/goal`): exact, by type and
 * value, and no names besides.
 */
import { describe, expect, it } from 'vitest'
import { compare, itemsOf, reprOf, typeOf } from '../../src/memory/goal'
import { bound, snap, value } from './lessons/fixtures'

const memory = (...pairs: [string, string, string][]) => {
  const b = pairs.map(([name, type, repr]) => bound(name, type, repr))
  return snap(b.map((x) => x.object), b.map((x) => x.binding))
}

describe('a goal memory', () => {
  it('reads literals the way the console prints them back', () => {
    expect(reprOf('"Bolt"')).toBe("'Bolt'")
    expect(reprOf('3')).toBe('3')
    expect(typeOf('"3"')).toBe('str')
    expect(typeOf('3.0')).toBe('float')
    expect(typeOf('True')).toBe('bool')
  })

  it('is met by exactly those names and values', () => {
    const goal = [
      { name: 'x', value: '3' },
      { name: 'name', value: '"Bolt"' },
    ]
    expect(compare(goal, memory(['x', 'int', '3'], ['name', 'str', "'Bolt'"])).met).toBe(true)
  })

  it('tells 3 from 3.0, and a word from a number', () => {
    expect(compare([{ name: 'x', value: '3' }], memory(['x', 'float', '3.0'])).met).toBe(false)
    expect(compare([{ name: 'x', value: '"3"' }], memory(['x', 'int', '3'])).met).toBe(false)
  })

  it('names a row that points elsewhere, and a name the goal does not have', () => {
    const c = compare([{ name: 'x', value: '4' }], memory(['x', 'int', '3'], ['z', 'int', '1']))
    expect(c.met).toBe(false)
    expect(c.rows[0]).toMatchObject({ ok: false, have: '3' })
    expect(c.extra).toEqual(['z'])
  })
})

describe('a goal memory with lists', () => {
  const n3 = value('int', '3')
  const n9 = value('int', '9')
  const n2 = value('int', '2')
  const list = (id: string, ...items: ReturnType<typeof value>[]) => ({
    id,
    type: 'list',
    kind: 'reference' as const,
    repr: `${items.length} items`,
    elements: items.map((o, i) => ({ label: String(i), target: o.id })),
    partial: false,
  })
  const at = (name: string, id: string) => ({ name, scope: 'global', target: id })

  it('matches a list slot by slot, not by its size', () => {
    const s = snap([n3, n9, n2, list('L', n3, n9, n2)], [at('parcels', 'L')])
    expect(compare([{ name: 'parcels', value: '[3, 9, 2]' }], s).met).toBe(true)
    expect(compare([{ name: 'parcels', value: '[3, 5, 2]' }], s).met).toBe(false)
    expect(compare([{ name: 'parcels', value: '[3, 9]' }], s).rows[0]!.have).toBe('[3, 9, 2]')
  })

  it('reads a list of words as the console prints them', () => {
    expect(itemsOf('["Mira", "a, b", 2.5]')).toEqual(['"Mira"', '"a, b"', '2.5'])
  })

  it('wants two names on one list to be the very same list, not an equal one', () => {
    const one = snap([n3, list('L', n3)], [at('a', 'L'), at('b', 'L')])
    const two = snap([n3, list('L', n3), list('M', n3)], [at('a', 'L'), at('b', 'M')])
    const goal = [
      { name: 'a', value: '[3]' },
      { name: 'b', value: '[3]', same: 'a' },
    ]
    expect(compare(goal, one).met).toBe(true)
    expect(compare(goal, two).met).toBe(false)
  })
})
