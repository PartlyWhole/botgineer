/**
 * The cloud layout. Its one hard promise is that pills never sit on top of
 * one another while there is room, and these tests hold it to that at
 * densities the panel actually reaches.
 */
import { describe, expect, it } from 'vitest'
import {
  advance,
  anyOverlap,
  makeNode,
  pack,
  settle,
  type CloudNode,
} from '../../src/panels/cloudLayout'

const BOUNDS = { w: 420, h: 220 }

/** Pills of assorted widths, like real names and reprs. */
const pills = (n: number): CloudNode[] =>
  Array.from({ length: n }, (_, i) => makeNode(`p${i}`, 48 + ((i * 17) % 70), 24))

const fill = (nodes: CloudNode[]) =>
  nodes.reduce((t, n) => t + (n.w + 7) * (n.h + 7), 0) / (BOUNDS.w * BOUNDS.h)

const inBox = (nodes: CloudNode[]) =>
  nodes.every(
    (n) =>
      n.x - n.w / 2 >= -1 &&
      n.x + n.w / 2 <= BOUNDS.w + 1 &&
      n.y - n.h / 2 >= -1 &&
      n.y + n.h / 2 <= BOUNDS.h + 1,
  )

describe('packing', () => {
  it.each([1, 2, 6, 14, 20, 30])('keeps %i pills apart and inside the box', (n) => {
    const nodes = pills(n)
    settle(nodes, BOUNDS)
    expect(anyOverlap(nodes)).toBe(false)
    expect(inBox(nodes)).toBe(true)
  })

  it('packs a cloud that is 90% full without overlapping', () => {
    const nodes = pills(30)
    expect(fill(nodes)).toBeGreaterThan(0.85)
    settle(nodes, BOUNDS)
    expect(anyOverlap(nodes)).toBe(false)
  })

  it('keeps everything in the box even when there is genuinely no room', () => {
    // Overfull is allowed to look crowded; it is not allowed to escape.
    const nodes = pills(60)
    settle(nodes, BOUNDS)
    expect(inBox(nodes)).toBe(true)
  })

  it('puts a lone pill exactly in the middle', () => {
    const one = pills(1)
    settle(one, BOUNDS)
    expect(one[0]!.x).toBeCloseTo(BOUNDS.w / 2, 5)
    expect(one[0]!.y).toBeCloseTo(BOUNDS.h / 2, 5)
  })

  it('fills outward from the middle rather than down from the top', () => {
    const nodes = pills(3)
    settle(nodes, BOUNDS)
    const cy = nodes.reduce((t, n) => t + n.y, 0) / nodes.length
    expect(Math.abs(cy - BOUNDS.h / 2)).toBeLessThan(2)
  })

  it('centres a row rather than leaving it left-aligned', () => {
    const nodes = pills(3)
    settle(nodes, BOUNDS)
    const left = Math.min(...nodes.map((n) => n.x - n.w / 2))
    const right = Math.max(...nodes.map((n) => n.x + n.w / 2))
    expect(Math.abs(left - (BOUNDS.w - right))).toBeLessThan(2)
  })

  it('is deterministic, and does not depend on input order', () => {
    const a = pills(16)
    const b = [...pills(16)].reverse()
    settle(a, BOUNDS)
    settle(b, BOUNDS)
    const place = (ns: CloudNode[]) =>
      [...ns].sort((p, q) => p.id.localeCompare(q.id)).map((n) => `${n.id}@${n.x},${n.y}`)
    expect(place(a)).toEqual(place(b))
  })
})

describe('dragging', () => {
  it('leaves a held pill exactly where the pointer put it', () => {
    const nodes = pills(8)
    settle(nodes, BOUNDS)
    const held = nodes[0]!
    held.held = true
    held.x = 60
    held.y = 30
    pack(nodes, BOUNDS)
    expect(held.tx).toBe(60)
    expect(held.ty).toBe(30)
  })

  it('makes the others get out of its way', () => {
    const nodes = pills(8)
    settle(nodes, BOUNDS)
    const held = nodes[0]!
    held.held = true
    held.x = BOUNDS.w / 2
    held.y = BOUNDS.h / 2
    settle(nodes, BOUNDS)
    expect(anyOverlap(nodes)).toBe(false)
  })

  it('keeps a dropped pill where it was put', () => {
    // Packing is deterministic, so a released pill would otherwise go
    // straight back to the spot it came from and dragging would do
    // nothing at all.
    const nodes = pills(6)
    settle(nodes, BOUNDS)
    const one = nodes[0]!
    one.x = 70
    one.y = 40
    one.pinned = true
    settle(nodes, BOUNDS)
    expect([one.x, one.y]).toEqual([70, 40])
    expect(anyOverlap(nodes)).toBe(false)
  })

  it('still packs the rest of a row a pinned pill sits in', () => {
    const nodes = pills(10)
    settle(nodes, BOUNDS)
    const pin = nodes[0]!
    pin.x = 60
    pin.y = BOUNDS.h / 2
    pin.pinned = true
    settle(nodes, BOUNDS)
    const sharing = nodes.filter((n) => n !== pin && Math.abs(n.y - pin.y) < 1)
    expect(sharing.length).toBeGreaterThan(0)
    expect(anyOverlap(nodes)).toBe(false)
  })

  it('unpinning puts it back in the cloud', () => {
    const nodes = pills(6)
    settle(nodes, BOUNDS)
    const home = { x: nodes[0]!.x, y: nodes[0]!.y }
    nodes[0]!.x = 12
    nodes[0]!.y = 12
    nodes[0]!.pinned = true
    settle(nodes, BOUNDS)
    nodes[0]!.pinned = false
    settle(nodes, BOUNDS)
    expect(nodes[0]!.x).toBeCloseTo(home.x, 5)
    expect(nodes[0]!.y).toBeCloseTo(home.y, 5)
  })
})

describe('animating', () => {
  it('eases toward the target and then stops', () => {
    const nodes = pills(4)
    pack(nodes, BOUNDS)
    // Shove everything away from where packing wants it.
    for (const n of nodes) {
      n.x = 0
      n.y = 0
    }
    let left = Infinity
    for (let i = 0; i < 200 && left > 0; i++) left = advance(nodes)
    expect(left).toBe(0)
    for (const n of nodes) {
      expect(n.x).toBe(n.tx)
      expect(n.y).toBe(n.ty)
    }
  })

  it('reports distance remaining so the caller can stop', () => {
    const nodes = pills(2)
    pack(nodes, BOUNDS)
    nodes[0]!.x = 0
    nodes[0]!.y = 0
    const first = advance(nodes)
    const second = advance(nodes)
    expect(second).toBeLessThan(first)
  })

  it('never moves a held pill', () => {
    const nodes = pills(3)
    settle(nodes, BOUNDS)
    const held = nodes[0]!
    held.held = true
    held.x = 100
    held.y = 100
    advance(nodes)
    expect([held.x, held.y]).toEqual([100, 100])
  })
})
