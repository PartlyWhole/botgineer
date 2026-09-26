/**
 * The console's block indentation (`src/repl/indent.ts`): what Enter, Tab,
 * Shift-Tab and Backspace do while a block is typed, and how a line that
 * is only indentation is judged when Enter asks whether the block is done.
 */
import { describe, expect, it } from 'vitest'
import { asBlank, backspace, newline, tab, untab } from '../../src/repl/indent'
import { needsContinuation } from '../../src/repl/program'

const end = (text: string) => text.length

describe('Enter in a block', () => {
  it('starts the line after a header four spaces in', () => {
    const t = 'for i in range(3):'
    expect(newline(t, end(t))).toEqual({ text: 'for i in range(3):\n    ', caret: t.length + 5 })
  })

  it('keeps a body line’s indent, and goes deeper after a nested header', () => {
    expect(newline('def f(n):\n    x = n', 20).text).toBe('def f(n):\n    x = n\n    ')
    expect(newline('for a in b:\n    if a:', 21).text).toBe('for a in b:\n    if a:\n        ')
  })

  it('reads the header through a comment', () => {
    expect(newline('while n > 0:  # count down', 26).text).toBe('while n > 0:  # count down\n    ')
  })

  it('does not indent inside an open bracket, which is not a block', () => {
    expect(newline('xs = [1,', 8).text).toBe('xs = [1,\n')
  })

  it('judges a line of indent alone as the blank line that closes the block', () => {
    const t = 'for i in range(3):\n    print(i)\n    '
    expect(asBlank(t, end(t))).toBe('for i in range(3):\n    print(i)\n')
    expect(needsContinuation(`${asBlank(t, end(t))}\n`)).toBe(false)
    // A body still being typed does not close it.
    const u = 'for i in range(3):\n    '
    expect(needsContinuation(`${asBlank(u + 'print(i)', end(u) + 8)}\n`)).toBe(true)
  })
})

describe('Tab, Shift-Tab and Backspace in a block', () => {
  it('Tab adds four spaces at the caret, over a selection', () => {
    expect(tab('if x:\n', 6)).toEqual({ text: 'if x:\n    ', caret: 10 })
    expect(tab('if x:\nab', 6, 8)).toEqual({ text: 'if x:\n    ', caret: 10 })
  })

  it('Shift-Tab takes up to four off the front of the line', () => {
    expect(untab('if x:\n        y', 15)).toEqual({ text: 'if x:\n    y', caret: 11 })
    expect(untab('if x:\n  y', 9)).toEqual({ text: 'if x:\ny', caret: 7 })
    expect(untab('if x:\ny', 7)).toEqual({ text: 'if x:\ny', caret: 7 })
  })

  it('Backspace in the indent goes back a level, and is ordinary elsewhere', () => {
    expect(backspace('if x:\n        ', 14)).toEqual({ text: 'if x:\n    ', caret: 10 })
    expect(backspace('if x:\n      ', 12)).toEqual({ text: 'if x:\n    ', caret: 10 })
    expect(backspace('if x:\n    y', 11)).toBeNull()
    expect(backspace('if x:\n', 6)).toBeNull()
    expect(backspace('if x:\n    ', 8, 10)).toBeNull()
  })
})
