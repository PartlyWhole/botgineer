/**
 * Taking an order (Level 5).
 */
import { describe, expect, it } from 'vitest'
import { guidance, progress, script, staging, takeAnOrder, type Evidence, type Heard, type Line } from '../../../content/lessons'
import { NOTHING, bound, failed, line, over, snap, th, value } from './fixtures'

const customer = bound('customer', 'str', "'Mira'")
const parcels = bound('parcels', 'int', '7')
const stored = snap([customer.object, parcels.object], [customer.binding, parcels.binding])

const said = (source: string, type: string, repr: string): Heard => ({ type, repr, source })
/** Memory as stored, having thought these, the last line being `last`. */
const asked = (thoughts: Heard[], last: Line | null = null): Evidence => ({ ...over([stored], thoughts), last })

describe('taking an order', () => {
  it('opens on Mira, in her own words, and the crow translates', () => {
    const s = script(takeAnOrder, NOTHING)
    expect(s.items[0]).toMatchObject({ speaker: 'courier' })
    expect(s.items[0]!.act).toEqual([{ actor: 'courier', do: 'wave' }])
    // Mira never says code; the ask, which does, is the crow's.
    expect(s.items[0]!.text).not.toMatch(/`/)
    expect(s.items[s.rest]).toMatchObject({ kind: 'ask', speaker: undefined, tag: 'you' })
    expect(s.items[s.rest]!.text).toContain('customer = "Mira"')
  })

  it('wants both facts before the question', () => {
    expect(progress(takeAnOrder, over([snap([customer.object], [customer.binding])]))).toBe(1)
    expect(progress(takeAnOrder, over([stored]))).toBe(2)
  })

  it('has Mira mention the parcels first once she is on the ticket', () => {
    const s = script(takeAnOrder, over([snap([customer.object], [customer.binding])]))
    expect(s.items[0]).toMatchObject({ kind: 'beat', speaker: 'courier' })
    expect(s.items[0]!.text).toMatch(/seven parcels/)
  })

  it('replies to her name without quotes, and the count as a word', () => {
    expect(guidance(takeAnOrder, { ...NOTHING, last: failed('customer = Mira', 'NameError') }).text).toMatch(/Without quotes/)
    const once = { ...over([snap([customer.object], [customer.binding])]), last: line('parcels = "7"', null) }
    expect(guidance(takeAnOrder, once).text).toMatch(/Quotes make that a word/)
  })

  it('shows the scale when Mira gives the weight, and asks the robot to work it out', () => {
    const s = script(takeAnOrder, over([stored]))
    const weigh = s.items.findIndex((i) => i.show?.kind === 'scale')
    expect(s.items[weigh]!.speaker).toBe('courier')
    expect(staging(takeAnOrder, over([stored]), weigh).current?.prop).toEqual({ kind: 'scale', parcels: 7, each: 2 })
    expect(s.items[s.rest]!.tag).toBe('robot')
    expect(s.items.slice(0, s.rest).some((i) => /Don't type the seven/.test(i.text))).toBe(true)
  })

  it('finishes when the robot works the weight out from parcels', () => {
    expect(progress(takeAnOrder, asked([said('parcels * 2', 'int', '14')]))).toBe(takeAnOrder.steps.length)
    expect(progress(takeAnOrder, asked([said('2 * parcels', 'int', '14')]))).toBe(3)
    expect(progress(takeAnOrder, asked([said('parcels + parcels', 'int', '14')]))).toBe(3)
  })

  it('is not passed by typing 14, nor by working it out from a typed 7', () => {
    // The bug this lesson had: `worked(e, '14')` passed on typing `14`.
    const fourteen = asked([said('14', 'int', '14')], line('14', th('int', '14')))
    expect(progress(takeAnOrder, fourteen)).toBe(2)
    expect(guidance(takeAnOrder, fourteen).text).toMatch(/wrote the answer in yourself/)
    const seven = asked([said('7 * 2', 'int', '14')], line('7 * 2', th('int', '14')))
    expect(progress(takeAnOrder, seven)).toBe(2)
    expect(guidance(takeAnOrder, seven).text).toMatch(/seven you remember/)
    // Both, even: the name and the digit.
    expect(progress(takeAnOrder, asked([said('parcels * 2 + 7 - 7', 'int', '14')]))).toBe(2)
    // Nor by hiding a typed answer behind the name.
    const hidden = asked([said('parcels * 0 + 14', 'int', '14')], line('parcels * 0 + 14', th('int', '14')))
    expect(progress(takeAnOrder, hidden)).toBe(2)
    expect(guidance(takeAnOrder, hidden).text).toMatch(/wrote the answer in yourself/)
    expect(progress(takeAnOrder, asked([said('parcels * 2.0', 'float', '14.0')]))).toBe(3)
  })

  it('answers a weight kept under a new name kindly, and asks for the sum itself', () => {
    const kept = asked([], line('weight = parcels * 2', null))
    expect(guidance(takeAnOrder, kept).text).toMatch(/sum on its own/)
    const back = asked([said('weight', 'int', '14')], line('weight', th('int', '14')))
    expect(progress(takeAnOrder, back)).toBe(2)
    expect(guidance(takeAnOrder, back).text).toMatch(/^Right, fourteen!/)
    expect(guidance(takeAnOrder, back).text).not.toMatch(/your sum|remember/)
  })

  it('does not call the right `parcels = 7` a miss at the weighing', () => {
    const s = script(takeAnOrder, asked([], line('parcels = 7', null)))
    expect(s.items[s.rest]!.kind).toBe('ask')
  })

  it('says which mistake a wrong weight is', () => {
    const reply = (src: string, repr: string) => guidance(takeAnOrder, asked([said(src, 'int', repr)], line(src, th('int', repr)))).text
    expect(reply('parcels', '7')).toMatch(/That's the count/)
    expect(reply('parcels + 2', '9')).toMatch(/two more parcels/)
    expect(reply('parcels * 3', '21')).toMatch(/21 kg/)
    expect(guidance(takeAnOrder, asked([], failed('parcel * 2', 'NameError'))).text).toMatch(/with an s/)
  })

  it('draws the miss on the scale, and the answer stays for the outro', () => {
    const miss = asked([said('parcels * 3', 'int', '21')], line('parcels * 3', th('int', '21')))
    expect(staging(takeAnOrder, miss).current).toMatchObject({ verdict: 'miss', answer: { repr: '21' } })
    const done = asked([said('parcels * 2', 'int', '14')], line('parcels * 2', th('int', '14')))
    expect(staging(takeAnOrder, done, 0).current).toMatchObject({ prop: { kind: 'scale' }, verdict: 'right', answer: { repr: '14' } })
    expect(script(takeAnOrder, done).items[0]!.text).toMatch(/because/)
  })

  it('is not satisfied by storing the answer instead of working it out', () => {
    const cheated = snap(
      [customer.object, parcels.object, value('int', '14')],
      [customer.binding, parcels.binding, { name: 'total', scope: 'global', target: 'v:int:14' }],
    )
    expect(progress(takeAnOrder, over([cheated]))).toBe(2)
  })

  it('is not satisfied by moving parcels to 14 and reading it back', () => {
    const moved = snap([customer.object, value('int', '14')], [customer.binding, { name: 'parcels', scope: 'global', target: 'v:int:14' }])
    expect(progress(takeAnOrder, over([stored, moved], [said('parcels', 'int', '14')]))).toBe(1)
  })
})
