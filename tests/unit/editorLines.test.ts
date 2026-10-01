import { describe, expect, test } from 'vitest'
import { guideDepths, lineShapes, lineStates, runKeyHint, sameMarks, type LineMarks } from '../../src/ui/editorLines'

const marks = (m: Partial<LineMarks>): LineMarks => ({ ran: [], current: null, finished: false, error: null, ...m })
const kinds = (text: string, m: Partial<LineMarks>) =>
  lineStates(text, marks(m)).map((s) =>
    s.error ? `err:${s.error}` : s.now ? 'now' : s.skipped ? 'skip' : s.visits > 1 ? `ran${s.visits}` : s.visits ? 'ran' : s.quiet ? '.' : '-',
  )

const IFS = `gold = 7
if gold > 10:
    print("sword")
elif gold > 5:
    print("shield")
else:
    print("save")
`

describe('lineStates', () => {
  test('a finished run fades the branches it did not take', () => {
    expect(kinds(IFS, { ran: [1, 2, 4, 5], finished: true })).toEqual(['ran', 'ran', 'skip', 'ran', 'ran', 'skip', 'skip', '.'])
  })

  test('nothing is skipped until the run is over', () => {
    expect(kinds(IFS, { ran: [1, 2], current: 2 })).toEqual(['ran', 'now', '-', '-', '-', '-', '-', '.'])
  })

  test('an else whose body ran is a branch taken, though the trace never reports it', () => {
    expect(kinds(IFS, { ran: [1, 2, 4, 7], finished: true })).toEqual(['ran', 'ran', 'skip', 'ran', 'skip', 'ran', 'ran', '.'])
  })

  test('a statement over several lines shares its first line’s fate', () => {
    const text = 'items = [\n    "rope",  # first\n    "map",\n]\nprint(items)'
    expect(kinds(text, { ran: [1, 5], finished: true })).toEqual(['ran', 'ran', 'ran', 'ran', 'ran'])
    expect(kinds(text, { ran: [1], current: 1 })).toEqual(['now', 'now', 'now', 'now', '-'])
  })

  test('strings with brackets and quotes in them do not open a statement', () => {
    const text = 'cave = ["torch", "map", "apple", "coin"]\nbag = []\ns = "(\'["\nt = 1'
    expect(kinds(text, { ran: [1, 2, 3, 4], finished: true })).toEqual(['ran', 'ran', 'ran', 'ran'])
  })

  test('a triple-quoted string spans its lines', () => {
    const text = 's = """one\n(two\nthree"""\nx = 1'
    expect(kinds(text, { ran: [1], finished: true })).toEqual(['ran', 'ran', 'ran', 'skip'])
  })

  test('blank lines and comments are never skipped', () => {
    expect(kinds('# hi\n\nx = 1\n', { ran: [], finished: true })).toEqual(['.', '.', 'skip', '.'])
  })

  test('a line listed more than once counts its visits', () => {
    const text = 'for c in "ab":\n    print(c)\nprint("done")'
    expect(kinds(text, { ran: [1, 2, 1, 2, 1, 3], finished: true })).toEqual(['ran3', 'ran2', 'ran'])
  })

  test('the error is drawn on its statement, and is not also skipped', () => {
    const text = 'x = 1\ny = x + nope\nprint(y)'
    expect(kinds(text, { ran: [1, 2], finished: true, error: { line: 2, text: 'NameError' } })).toEqual([
      'ran',
      'err:NameError',
      'skip',
    ])
    // A SyntaxError on a line that never ran.
    expect(kinds('if x\n    y = 1', { finished: true, error: { line: 1, text: 'SyntaxError' } })).toEqual([
      'err:SyntaxError',
      'skip',
    ])
  })

  test('an unclosed bracket mid-edit does not swallow the lines after it', () => {
    const shapes = lineShapes('x = [1,\ny = 2\nz = 3')
    expect(shapes.map((s) => s.start)).toEqual([1, 2, 3])
  })
})

describe('guideDepths', () => {
  test('one guide per four columns, carried across blank lines inside a block', () => {
    const text = 'for x in y:\n    if x:\n        a = 1\n\n        b = 2\n\nprint(x)'
    expect(guideDepths(text)).toEqual([0, 1, 2, 2, 2, 0, 0])
  })
})

describe('sameMarks', () => {
  test('compares by value', () => {
    expect(sameMarks(marks({ ran: [1, 2] }), marks({ ran: [1, 2] }))).toBe(true)
    expect(sameMarks(marks({ ran: [1, 2] }), marks({ ran: [1, 2], current: 2 }))).toBe(false)
    expect(sameMarks(null, undefined)).toBe(true)
    expect(sameMarks(null, marks({}))).toBe(false)
  })
})

test('runKeyHint follows the platform', () => {
  expect(runKeyHint('MacIntel')).toBe('⌘↵')
  expect(runKeyHint('macOS')).toBe('⌘↵')
  expect(runKeyHint('Win32')).toBe('Ctrl↵')
  expect(runKeyHint('Linux x86_64')).toBe('Ctrl↵')
})
