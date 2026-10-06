import { describe, expect, it } from 'vitest'
import { IDLE, keyIn, refused, startWaiting, type LineState } from '../../src/console/lineDiscipline'
import { checkedChunks, engineText, styled, sysLine, transcript, viewAt, type Chunk } from '../../src/console/store'

const chunks: Chunk[] = [
  { stream: 'sys', text: '── run ──\n', at: 0 },
  { stream: 'stdout', text: 'Name? ', at: 3 },
  { stream: 'echo', text: 'Ann\n', at: 3 },
  { stream: 'stderr', text: 'warn\n', at: 4 },
  { stream: 'stdout', text: 'hi Ann\n', at: 5 },
  { stream: 'sys', text: '── program finished ──\n', at: 6 },
]

describe('the transcript store (PLP: the store is the truth)', () => {
  it('reads back the program and its user, without the page lines', () => {
    expect(transcript(chunks)).toBe('Name? Ann\nwarn\nhi Ann\n')
    expect(engineText(chunks)).toBe('Name? warn\nhi Ann\n')
  })

  it('shows what had been said by a step, typed answers included', () => {
    expect(viewAt(chunks, 2, 6).map((c) => c.text)).toEqual(['── run ──\n'])
    expect(transcript(viewAt(chunks, 3, 6))).toBe('Name? Ann\n')
    expect(transcript(viewAt(chunks, 4, 6))).toBe('Name? Ann\nwarn\n')
  })

  it('shows everything at the last step and the live end, closing lines too', () => {
    expect(viewAt(chunks, 5, 6)).toBe(chunks)
    expect(viewAt(chunks, null, 6)).toBe(chunks)
  })

  it('colours stderr red and page lines dim, and leaves output as it is', () => {
    expect(styled(chunks[3]!)).toBe('\x1b[91mwarn\n\x1b[0m')
    expect(styled(chunks[0]!)).toBe('\x1b[2m── run ──\n\x1b[0m')
    expect(styled({ stream: 'stdout', text: '\x1b[31mred', at: 0 })).toBe('\x1b[31mred')
  })

  it('starts a page line on a line of its own', () => {
    expect(sysLine('note', true)).toBe('note\n')
    expect(sysLine('note', false)).toBe('\nnote\n')
  })

  it("takes another browser's chunks only if they are chunks", () => {
    expect(checkedChunks(chunks)).toEqual(chunks)
    expect(checkedChunks([{ stream: 'html', text: '<b>', at: 0 }])).toBeNull()
    expect(checkedChunks([{ stream: 'stdout', text: 5, at: 0 }])).toBeNull()
    expect(checkedChunks([{ stream: 'stdout', text: 'x'.repeat(20), at: 0 }], 10)).toBeNull()
    expect(checkedChunks('nope')).toBeNull()
  })
})

/** Types `keys` from `state`, collecting what was written and done. */
function type(state: LineState, keys: string[], max?: number) {
  const writes: string[] = []
  const done: string[] = []
  for (const k of keys) {
    const r = keyIn(state, k, max)
    state = r.state
    for (const e of r.effects) {
      if (e.kind === 'write') writes.push(e.text)
      else done.push(e.kind === 'submit' ? `submit:${e.line}` : e.kind === 'notice' ? `notice:${e.text}` : e.kind)
    }
  }
  return { state, writes, done }
}

describe('typing a line to input() (PLP line discipline)', () => {
  const waiting = startWaiting(IDLE)

  it('edits at the end and submits, erasing the preview (the echo comes back from the engine)', () => {
    const r = type(waiting, ['A', 'n', 'x', '\x7f', 'n', '\r'])
    expect(r.done).toEqual(['submit:Ann'])
    expect(r.writes).toEqual(['A', 'n', 'x', '\b \b', 'n', '\b \b'.repeat(3)])
    expect(r.state.waiting).toBe(false)
    expect(r.state.history).toEqual(['Ann'])
  })

  it('takes nothing typed while no input() waits, except Ctrl+C', () => {
    expect(type(IDLE, ['a', '\r']).done).toEqual([])
    expect(type(IDLE, ['\x03']).done).toEqual(['interrupt'])
    expect(type(waiting, ['\x03']).done).toEqual(['interrupt'])
  })

  it('recalls earlier lines with the arrows, and comes back to a fresh one', () => {
    let s = type(waiting, ['o', 'n', 'e', '\r']).state
    s = type(startWaiting(s), ['t', 'w', 'o', '\r']).state
    const up = type(startWaiting(s), ['\x1b[A'])
    expect(up.state.line).toBe('two')
    const up2 = type(up.state, ['\x1b[A'])
    expect(up2.state.line).toBe('one')
    expect(up2.writes).toEqual(['\b \b'.repeat(3) + 'one'])
    expect(type(up2.state, ['\x1b[A']).state.line).toBe('one')
    const down = type(up2.state, ['\x1b[B', '\x1b[B'])
    expect(down.state.line).toBe('')
    expect(down.state.pos).toBe(-1)
  })

  it('keeps the first line of a paste, without control characters', () => {
    expect(type(waiting, ['ab\x07c\nsecond line']).state.line).toBe('abc')
  })

  it("says Ctrl+D can't end the input, and stops at the byte limit", () => {
    expect(type(waiting, ['\x04']).done[0]).toMatch(/EOF/)
    const r = type(waiting, ['abcd', 'é'], 5)
    expect(r.state.line).toBe('abcd')
    expect(r.done[0]).toMatch(/limit/)
  })

  it('ignores other escape sequences, and a Backspace with nothing typed', () => {
    expect(type(waiting, ['\x1b[C', '\x7f']).writes).toEqual([])
  })

  it('gives a refused line back, waiting again', () => {
    const s = refused(type(waiting, ['h', 'i', '\r']).state, 'hi')
    expect(s).toMatchObject({ waiting: true, line: 'hi' })
  })

  it('rubs out a character, not a byte: one Backspace takes an emoji', () => {
    expect(type(waiting, ['a🙂', '\x7f']).state.line).toBe('a')
  })
})
