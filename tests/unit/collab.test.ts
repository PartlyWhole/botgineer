import { describe, expect, it } from 'vitest'
import { checked, isStep, pack, unpack } from '../../src/collab/trace'
import { transportsFrom } from '../../src/collab/room'
import { hashWithoutRoom, roomInHash } from '../../src/app/router'

const step = (line: number, out = '') => ({
  kind: 'step',
  seq: line,
  step: line,
  event: 'line',
  location: { module: '__main__', line },
  stack: [],
  globals: [{ module: '__main__', bindings: [] }],
  heap: [],
  output: { stdout_delta: out, stderr_delta: '', stdout_bytes: 0, stderr_bytes: 0 },
})

describe('a shared run, packed and unpacked', () => {
  it('comes back as it went', async () => {
    const run = { steps: [step(1), step(2, 'hi\n')], terminal: { kind: 'terminal', seq: 3, reason: 'completed' }, threw: null }
    const bytes = await pack(run as never)
    expect(bytes.length).toBeLessThan(JSON.stringify(run).length)
    expect(await unpack(bytes)).toEqual(run)
  })

  it('is refused when it is not gzip, or not a run', async () => {
    expect(await unpack(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(await unpack(await pack({ nope: true } as never))).toBeNull()
  })

  it('is refused whole when any step is not shaped like engine output', () => {
    expect(checked({ steps: [step(1), { kind: 'step' }] })).toBeNull()
    expect(checked({ steps: [{ ...step(1), output: { stdout_delta: 5 } }] })).toBeNull()
    expect(checked({ steps: [{ ...step(1), heap: ['<b>'] }] })).toBeNull()
    expect(isStep(step(4))).toBe(true)
  })

  it('keeps only a terminal that is one, and a short error', () => {
    const got = checked({ steps: [], terminal: { kind: 'evil' }, threw: 'x'.repeat(2000) })
    expect(got?.terminal).toBeNull()
    expect(got?.threw).toHaveLength(500)
  })
})

describe('a room in a link', () => {
  it('rides after the route, and comes off it', () => {
    const hash = '#/code&room=automerge:2msnuYvwyiFnEpr2Wg2FZSLe8PCz&via=tabs'
    expect(roomInHash(hash)).toEqual({ url: 'automerge:2msnuYvwyiFnEpr2Wg2FZSLe8PCz', via: 'tabs' })
    expect(roomInHash('#/code&room=automerge:abc')).toEqual({ url: 'automerge:abc', via: null })
    expect(roomInHash('#/code')).toBeNull()
    expect(roomInHash('#/code&room=<script>')).toBeNull()
    expect(hashWithoutRoom(hash)).toBe('#/code')
  })

  it('uses the test seam, else the link, else every transport', () => {
    expect([...transportsFrom('?transports=tabs', 'ws')]).toEqual(['tabs'])
    expect([...transportsFrom('', 'ws')]).toEqual(['ws'])
    expect([...transportsFrom('', null)]).toEqual(['ws', 'tabs'])
    expect([...transportsFrom('?transports=bogus', null)]).toEqual(['ws', 'tabs'])
  })
})
