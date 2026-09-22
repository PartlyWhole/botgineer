/**
 * Turning the engine's wire format into the app's two collections.
 *
 * This is the one translation in the codebase, so its edge cases are
 * pinned here rather than discovered in a panel: aliasing, value identity,
 * cycles, frames, and the things the engine refuses to show.
 */
import { describe, expect, it } from 'vitest'
import { extractMemory, thought } from '../../src/memory/extract'
import { holdersOf, namesFor, unreferenced } from '../../src/memory/model'
import type { Binding, HeapNode, StepRecord, TraceValue } from '../../src/runtime/types'
import { DESCRIBE, THOUGHT } from '../../src/repl/program'

const int = (n: number): TraceValue => ({ kind: 'int', decimal: String(n) })
const str = (s: string): TraceValue => ({ kind: 'str', value: s })
const ref = (uid: string): TraceValue => ({ kind: 'ref', uid })
const bind = (name: string, value: TraceValue): Binding => ({ name, value })

function step(opts: {
  globals?: Binding[]
  heap?: HeapNode[]
  frame?: { function: string; locals: Binding[] }
  line?: number
}): StepRecord {
  const location = {
    filename: '<pytrace>',
    module: '__main__',
    function: '<module>',
    line: opts.line ?? 1,
  }
  return {
    kind: 'step',
    seq: 1,
    step: 0,
    event: 'line',
    location,
    stack: opts.frame
      ? [
          {
            frame_id: 'f1',
            function: opts.frame.function,
            module: '__main__',
            location,
            locals: opts.frame.locals,
          },
        ]
      : [],
    globals: [{ module: '__main__', bindings: opts.globals ?? [] }],
    heap: opts.heap ?? [],
    output: { stdout_delta: '', stderr_delta: '', stdout_bytes: 0, stderr_bytes: 0 },
  }
}

describe('names and objects', () => {
  it('is empty when there is no step', () => {
    const s = extractMemory(undefined)
    expect(s.bindings).toEqual([])
    expect(Object.keys(s.objects)).toEqual([])
  })

  it('binds a name to an object', () => {
    const s = extractMemory(step({ globals: [bind('a', int(10))] }))
    expect(s.bindings).toHaveLength(1)
    const target = s.objects[s.bindings[0]!.target]!
    expect(target.type).toBe('int')
    expect(target.repr).toBe('10')
  })

  it('gives two names of the same value ONE object', () => {
    const s = extractMemory(step({ globals: [bind('a', int(10)), bind('b', int(10))] }))
    expect(s.bindings[0]!.target).toBe(s.bindings[1]!.target)
    expect(Object.keys(s.objects)).toHaveLength(1)
  })

  it('keeps equal-but-different types apart', () => {
    const s = extractMemory(step({ globals: [bind('a', int(1)), bind('b', { kind: 'bool', value: true })] }))
    expect(s.bindings[0]!.target).not.toBe(s.bindings[1]!.target)
  })

  it('gives values no identity and references one', () => {
    const heap: HeapNode[] = [{ uid: 'h1', kind: 'list', type_name: 'list', items: [] }]
    const s = extractMemory(step({ globals: [bind('n', int(1)), bind('xs', ref('h1'))], heap }))
    const byName = (name: string) => s.objects[s.bindings.find((b) => b.name === name)!.target]!
    expect(byName('n').kind).toBe('value')
    expect(byName('xs').kind).toBe('reference')
  })

  it('shows aliasing: two names, one list', () => {
    const heap: HeapNode[] = [{ uid: 'h1', kind: 'list', type_name: 'list', items: [int(1)] }]
    const s = extractMemory(step({ globals: [bind('xs', ref('h1')), bind('ys', ref('h1'))], heap }))
    expect(s.bindings[0]!.target).toBe(s.bindings[1]!.target)
    expect(namesFor(s, s.bindings[0]!.target).map((b) => b.name)).toEqual(['xs', 'ys'])
  })

  it('keeps two equal lists apart, because they really are apart', () => {
    const heap: HeapNode[] = [
      { uid: 'h1', kind: 'list', type_name: 'list', items: [int(1)] },
      { uid: 'h2', kind: 'list', type_name: 'list', items: [int(1)] },
    ]
    const s = extractMemory(step({ globals: [bind('xs', ref('h1')), bind('ys', ref('h2'))], heap }))
    expect(s.bindings[0]!.target).not.toBe(s.bindings[1]!.target)
    // …while the int inside them is one object, pointed at by both.
    const one = s.objects[s.bindings[0]!.target]!.elements![0]!.target
    const two = s.objects[s.bindings[1]!.target]!.elements![0]!.target
    expect(one).toBe(two)
    expect(holdersOf(s, one)).toHaveLength(2)
  })
})

describe('collections hold pointers', () => {
  it('labels list items by index', () => {
    const heap: HeapNode[] = [
      { uid: 'h1', kind: 'list', type_name: 'list', items: [str('x'), str('y')] },
    ]
    const s = extractMemory(step({ globals: [bind('xs', ref('h1'))], heap }))
    const xs = s.objects['o:h1']!
    expect(xs.repr).toBe('2 items')
    expect(xs.elements!.map((e) => e.label)).toEqual(['0', '1'])
    expect(s.objects[xs.elements![0]!.target]!.repr).toBe("'x'")
  })

  it('labels dict entries by key and says "entries"', () => {
    const heap: HeapNode[] = [
      {
        uid: 'h1',
        kind: 'dict',
        type_name: 'dict',
        entries: [{ key: str('a'), value: int(1) }],
      },
    ]
    const s = extractMemory(step({ globals: [bind('d', ref('h1'))], heap }))
    const d = s.objects['o:h1']!
    expect(d.repr).toBe('1 entry')
    expect(d.elements![0]!.label).toBe("'a'")
  })

  it('leaves set members unlabelled, because position means nothing', () => {
    const heap: HeapNode[] = [{ uid: 'h1', kind: 'set', type_name: 'set', items: [int(1)] }]
    const s = extractMemory(step({ globals: [bind('t', ref('h1'))], heap }))
    expect(s.objects['o:h1']!.elements![0]!.label).toBeNull()
  })

  it('distinguishes "not a collection" from "an empty one"', () => {
    const heap: HeapNode[] = [
      { uid: 'h1', kind: 'list', type_name: 'list', items: [] },
      { uid: 'h2', kind: 'function', type_name: 'function', qualname: 'f' },
    ]
    const s = extractMemory(step({ globals: [bind('xs', ref('h1')), bind('f', ref('h2'))], heap }))
    expect(s.objects['o:h1']!.elements).toEqual([])
    expect(s.objects['o:h2']!.elements).toBeNull()
  })

  it('survives a list that contains itself', () => {
    const heap: HeapNode[] = [{ uid: 'h1', kind: 'list', type_name: 'list', items: [ref('h1')] }]
    const s = extractMemory(step({ globals: [bind('xs', ref('h1'))], heap }))
    expect(s.objects['o:h1']!.elements![0]!.target).toBe('o:h1')
  })
})

describe('honesty about what the engine would not show', () => {
  it('marks a budget-elided collection partial', () => {
    const heap: HeapNode[] = [
      { uid: 'h1', kind: 'list', type_name: 'list', items: [int(1)], elided_count: 9 },
    ]
    const s = extractMemory(step({ globals: [bind('xs', ref('h1'))], heap }))
    expect(s.objects['o:h1']!.partial).toBe(true)
    expect(s.objects['o:h1']!.repr).toContain('+')
  })

  it('marks an object the engine refuses to inspect', () => {
    const heap: HeapNode[] = [{ uid: 'h1', kind: 'opaque', type_name: 'Socket' }]
    const s = extractMemory(step({ globals: [bind('s', ref('h1'))], heap }))
    expect(s.objects['o:h1']!.partial).toBe(true)
    expect(s.objects['o:h1']!.repr).toBe('<Socket>')
  })

  it('does not invent an object for a reference the heap lost', () => {
    const s = extractMemory(step({ globals: [bind('x', ref('missing'))] }))
    expect(s.objects['o:missing']!.partial).toBe(true)
  })
})

describe('scopes and reachability', () => {
  it('shows a live frame locals alongside the globals', () => {
    const s = extractMemory(
      step({
        globals: [bind('total', int(0))],
        frame: { function: 'add', locals: [bind('n', int(5))] },
      }),
    )
    expect(s.bindings.map((b) => `${b.scope}.${b.name}`)).toEqual(['global.total', 'add.n'])
  })

  it('leaves out the interpreter own plumbing', () => {
    const s = extractMemory(step({ globals: [bind('__name__', str('__main__')), bind('a', int(1))] }))
    expect(s.bindings.map((b) => b.name)).toEqual(['a'])
  })

  it('reports an object nothing points at', () => {
    const heap: HeapNode[] = [{ uid: 'h1', kind: 'list', type_name: 'list', items: [int(7)] }]
    const s = extractMemory(step({ globals: [bind('xs', ref('h1'))], heap }))
    // The list is named; the int inside it is held by the list.
    expect(unreferenced(s)).toEqual([])
  })

  it('records the line the snapshot was taken at', () => {
    expect(extractMemory(step({ line: 12 })).line).toBe(12)
  })
})

/**
 * A bare expression is thought of and let go.
 *
 * Nothing holds the value, so nothing about it reaches memory. What
 * survives is a description of it under a hidden name, which is what the
 * robot's thought bubble shows and what the early lessons are judged on.
 */
describe('what the robot thought', () => {
  const described = (text: string) => step({ globals: [bind(THOUGHT, str(text))] })

  it('reads the type and the repr', () => {
    expect(thought(described('int\t10'))).toEqual({ type: 'int', repr: '10' })
    expect(thought(described("str\t'crow'"))).toEqual({ type: 'str', repr: "'crow'" })
    expect(thought(described('bool\tTrue'))).toEqual({ type: 'bool', repr: 'True' })
    expect(thought(described('float\t4.5'))).toEqual({ type: 'float', repr: '4.5' })
  })

  it('leaves memory completely empty', () => {
    const s = extractMemory(described('int\t10'))
    expect(s.bindings).toEqual([])
    expect(Object.keys(s.objects)).toEqual([])
  })

  it('hides its own helper too', () => {
    const s = extractMemory(step({ globals: [bind(DESCRIBE, int(0)), bind(THOUGHT, str('int\t1'))] }))
    expect(s.bindings).toEqual([])
  })

  it('is null when the line reported nothing', () => {
    expect(thought(step({ globals: [bind('x', int(1))] }))).toBeNull()
    expect(thought(undefined)).toBeNull()
  })

  it('keeps a repr that contains an escaped tab', () => {
    // `repr` escapes a tab, so the separator can never be ambiguous.
    expect(thought(described("str\t'a\\tb'"))).toEqual({ type: 'str', repr: "'a\\tb'" })
  })

  it('survives a repr with its own separator-looking text', () => {
    expect(thought(described('str\t"int\\t9"'))?.type).toBe('str')
  })

  it('does not stop a named object from appearing', () => {
    // The thought is bookkeeping; real bindings are unaffected.
    const s = extractMemory(step({ globals: [bind(THOUGHT, str('int\t7')), bind('x', int(7))] }))
    expect(s.bindings.map((b) => b.name)).toEqual(['x'])
    expect(Object.values(s.objects).map((o) => o.repr)).toEqual(['7'])
  })
})
