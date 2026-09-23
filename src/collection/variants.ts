/**
 * Fresh versions of the collection's templatable exercises.
 *
 * A family is one exercise's *shape* — 1.2's "copy a name, then move the
 * original" — with the numbers, words and lengths left open. A seed fills
 * them in, and the same seed always gives the same program, so a session
 * can be replayed in a test.
 *
 * Nothing here knows an answer. The generated program is run in the real
 * engine before the question is asked (the player's item is prepared like
 * any other), and the run is the key — simpler and more trustworthy than
 * the small Python evaluator the warm-up's practice uses, which cannot
 * follow a loop, a copy or a call.
 */
import type { Block, ErrorType, Exercise, Spec } from './model'
import { between, pick, rng, type Rng } from '../practice/exercises'

export type Family = {
  id: string
  stage: number
  /** The exercise this is a version of — where a miss sends you back. */
  from: string
  concepts: string[]
  err: ErrorType
  /** What to notice, shown in the key after the commit. */
  reasoning: string
  misconception: string
  make: (r: Rng) => string
}

const WORDS = ['ann', 'bo', 'cy', 'dee', 'eli', 'fay', 'gus']
const list = (xs: (number | string)[]) => `[${xs.map((x) => (typeof x === 'string' ? `"${x}"` : String(x))).join(', ')}]`
const nums = (r: Rng, n: number, lo = 1, hi = 9) => Array.from({ length: n }, () => between(r, lo, hi))
const lines = (...ls: string[]) => ls.join('\n') + '\n'

export const FAMILIES: Family[] = [
  /* ------------------------------ Stage 1 ------------------------------ */
  {
    id: 'copy-then-move',
    stage: 1,
    from: '1.2',
    concepts: ['rebind', 'alias'],
    err: 'object',
    reasoning: 'The second name was pointed at the *object* the first one pointed at. Moving the first name afterwards moves only that label.',
    misconception: 'That `y = x` links the names, so later changes to `x` show up in `y`.',
    make: (r) => {
      const [a, b] = [between(r, 1, 20), between(r, 21, 40)]
      const [x, y] = pick(r, [['x', 'y'], ['p', 'q'], ['m', 'n']])
      return lines(`${x} = ${a}`, `${y} = ${x}`, `${x} = ${b}`, `print(${x}, ${y})`)
    },
  },
  {
    id: 'text-plus',
    stage: 1,
    from: '1.6',
    concepts: ['immutable-replace', 'alias'],
    err: 'object',
    reasoning: '`+` on text builds a new text object; the name on the left is pointed at it. The other name still points at the original.',
    misconception: 'That `+` on a string changes it in place, taking the other name along.',
    make: (r) => {
      const w = pick(r, WORDS)
      const tail = pick(r, ['s', '!', 'y', 'ie'])
      return lines(`s = "${w}"`, 't = s', `s = s + "${tail}"`, 'print(s)', 'print(t)')
    },
  },

  /* ------------------------------ Stage 2 ------------------------------ */
  {
    id: 'change-or-replace',
    stage: 2,
    from: '2.2',
    concepts: ['mutate-vs-rebind', 'alias'],
    err: 'object',
    reasoning: '`.append` changes the one list both names point at; `b = b + [...]` builds a new list and moves only `b`.',
    misconception: 'That changing a list and giving the name a new list are the same event.',
    make: (r) => {
      const xs = nums(r, between(r, 1, 3))
      const n = between(r, 10, 99)
      const line = pick(r, [`b.append(${n})`, `b = b + [${n}]`])
      return lines(`a = ${list(xs)}`, 'b = a', line, 'print(a)', 'print(b)')
    },
  },
  {
    id: 'plus-equals',
    stage: 2,
    from: '2.7',
    concepts: ['plus-equals', 'mutate-vs-rebind'],
    err: 'object',
    reasoning: 'On a list, `+=` changes the existing list, so every name on it sees the change. On a number it can only build a new number.',
    misconception: 'That `+=` is only shorthand for `x = x + ...`.',
    make: (r) => {
      if (r() < 0.5) {
        const xs = nums(r, 2)
        return lines(`a = ${list(xs)}`, 'b = a', `b += [${between(r, 10, 99)}]`, 'print(a, b)')
      }
      const n = between(r, 1, 9)
      return lines(`a = ${n}`, 'b = a', `b += ${between(r, 1, 9)}`, 'print(a, b)')
    },
  },
  {
    id: 'method-returns-none',
    stage: 2,
    from: '2.5',
    concepts: ['method-returns-none'],
    err: 'object',
    reasoning: 'A method that changes a list hands back `None`. The list itself is changed; the name on the left gets nothing useful.',
    misconception: 'That a method which changes an object also returns the changed object.',
    make: (r) => {
      const xs = nums(r, 3)
      const m = pick(r, ['sort()', 'reverse()', `append(${between(r, 10, 99)})`])
      return lines(`xs = ${list(xs)}`, `ys = xs.${m}`, 'print(xs)', 'print(ys)')
    },
  },

  /* ------------------------------ Stage 3 ------------------------------ */
  {
    id: 'index-and-slice',
    stage: 3,
    from: '3.2',
    concepts: ['index', 'slice-new'],
    err: 'syntax',
    reasoning: 'Positions count from 0, negative ones from the end, and a slice stops *before* its second number — and builds a new list.',
    misconception: 'That positions count from 1, or that a slice includes its end.',
    make: (r) => {
      const xs = Array.from({ length: between(r, 4, 6) }, (_, i) => String.fromCharCode(97 + i))
      const i = between(r, 0, xs.length - 1)
      const j = between(r, 1, xs.length)
      const a = between(r, 0, xs.length - 2)
      const b = between(r, a + 1, xs.length)
      return lines(`xs = ${list(xs)}`, `print(xs[${i}])`, `print(xs[-${j}])`, `print(xs[${a}:${b}])`)
    },
  },
  {
    id: 'dict-lookup',
    stage: 3,
    from: '3.6',
    concepts: ['dict-lookup', 'dict-keys'],
    err: 'syntax',
    reasoning: '`in` asks about keys, `.get` gives a fallback for a missing key, and `d[k] = v` adds a key or replaces its value.',
    misconception: 'That `in` on a dictionary asks about values.',
    make: (r) => {
      const [k1, k2, k3] = [pick(r, WORDS), pick(r, ['x', 'y', 'z']), pick(r, ['q', 'w'])]
      const [v1 = 1, v2 = 2] = nums(r, 2, 1, 20)
      return lines(`d = {"${k1}": ${v1}, "${k2}": ${v2}}`, `d["${k2}"] = ${v1 + 1}`, `print(d.get("${k3}", 0), "${k1}" in d, ${v1} in d)`, 'print(d)')
    },
  },

  /* ------------------------------ Stage 4 ------------------------------ */
  {
    id: 'grid-repetition',
    stage: 4,
    from: '4.6',
    concepts: ['repetition-pitfall', 'container-arrows'],
    err: 'object',
    reasoning: '`[inner] * n` puts n arrows to the *same* inner list; a comprehension builds a fresh inner list on every pass.',
    misconception: 'That `*` makes independent inner lists.',
    make: (r) => {
      const rows = between(r, 2, 3)
      const cols = between(r, 2, 3)
      const build = r() < 0.6 ? `[[0] * ${cols}] * ${rows}` : `[[0] * ${cols} for _ in range(${rows})]`
      return lines(`grid = ${build}`, `grid[${between(r, 0, rows - 1)}][${between(r, 0, cols - 1)}] = ${between(r, 1, 9)}`, 'print(grid)')
    },
  },
  {
    id: 'shallow-copy',
    stage: 4,
    from: '4.3',
    concepts: ['shallow-copy', 'container-arrows'],
    err: 'object',
    reasoning: 'A one-level copy has its own outer list, but its slots point at the same inner lists. Changing an inner list shows through both.',
    misconception: 'That a new outer container means new inner objects.',
    make: (r) => {
      const how = pick(r, ['a[:]', 'list(a)', 'a.copy()'])
      const inner = between(r, 0, 1)
      return lines(
        `a = [${list(nums(r, 2))}, ${list(nums(r, 1))}]`,
        `b = ${how}`,
        `b[${inner}].append(${between(r, 10, 99)})`,
        `b.append(${list([between(r, 10, 99)])})`,
        'print(a)',
        'print(b)',
      )
    },
  },

  /* ------------------------------ Stage 5 ------------------------------ */
  {
    id: 'accumulate',
    stage: 5,
    from: '5.2',
    concepts: ['accumulator', 'loop-passes'],
    err: 'flow',
    reasoning: 'The running total starts before the loop and is rebound once per pass, using its old value each time.',
    misconception: 'That the loop body runs once, or that the total starts over each pass.',
    make: (r) => {
      const xs = nums(r, between(r, 2, 4))
      const op = pick(r, ['+', '*'])
      const start = op === '*' ? 1 : between(r, 0, 5)
      return lines(`total = ${start}`, `for n in ${list(xs)}:`, `    total = total ${op} n`, 'print(total)')
    },
  },
  {
    id: 'range-passes',
    stage: 5,
    from: '5.10',
    concepts: ['range', 'loop-passes'],
    err: 'flow',
    reasoning: '`range(a, b, step)` starts at `a` and stops *before* `b`. Count the passes, then follow the name.',
    misconception: 'That `range` includes its end.',
    make: (r) => {
      const a = between(r, 0, 3)
      const b = a + between(r, 3, 7)
      const step = pick(r, [1, 2])
      return lines('count = 0', `for i in range(${a}, ${b}${step === 1 ? '' : `, ${step}`}):`, '    count = count + 1', 'print(count, i)')
    },
  },
  {
    id: 'loop-rebind',
    stage: 5,
    from: '5.7',
    concepts: ['loop-rebind-inert'],
    err: 'object',
    reasoning: 'Each pass points the loop name at an item, then the body points it somewhere else. No slot of the list is ever on the left of `=`.',
    misconception: 'That rebinding the loop name changes the list.',
    make: (r) => {
      const xs = nums(r, 3)
      const k = between(r, 2, 10)
      return lines(`xs = ${list(xs)}`, 'for x in xs:', `    x = x * ${k}`, 'print(xs)', 'print(x)')
    },
  },

  /* ------------------------------ Stage 6 ------------------------------ */
  {
    id: 'dict-walk',
    stage: 6,
    from: '6.2',
    concepts: ['dict-iteration', 'iterable-items'],
    err: 'syntax',
    reasoning: 'A `for` loop over a dictionary binds the loop variable to each **key**, in insertion order; `.items()` hands over pairs.',
    misconception: 'That iterating a dictionary hands over its values.',
    make: (r) => {
      const keys = [...new Set(Array.from({ length: 3 }, () => pick(r, WORDS)))]
      const vals = nums(r, keys.length)
      const d = `{${keys.map((k, i) => `"${k}": ${vals[i]}`).join(', ')}}`
      return r() < 0.5 ? lines(`d = ${d}`, 'for k in d:', '    print(k)') : lines(`d = ${d}`, 'for k, v in d.items():', '    print(k, v * 2)')
    },
  },
  {
    id: 'generator-once',
    stage: 6,
    from: '6.6',
    concepts: ['generator-exhaustion'],
    err: 'flow',
    reasoning: 'A generator produces its values once. The first walk uses them up; the second finds it **exhausted**.',
    misconception: 'That a generator can be walked again, like a list.',
    make: (r) => {
      const xs = nums(r, 3)
      const k = between(r, 2, 5)
      const use = pick(r, ['sum', 'list', 'max'])
      return lines(`g = (x * ${k} for x in ${list(xs)})`, `print(${use}(g))`, 'print(list(g))')
    },
  },

  /* ------------------------------ Stage 7 ------------------------------ */
  {
    id: 'nested-count',
    stage: 7,
    from: '7.1',
    concepts: ['nested-counts', 'nested-loops'],
    err: 'flow',
    reasoning: 'The inner loop runs to completion on every outer pass, so the innermost line runs outer × inner times — fewer if a `break` cuts the inner loop short.',
    misconception: 'That the two loops advance together, or that `break` ends both.',
    make: (r) => {
      const a = between(r, 2, 4)
      const b = between(r, 2, 4)
      if (r() < 0.5) return lines('count = 0', `for i in range(${a}):`, `    for j in range(${b}):`, '        count = count + 1', 'print(count)')
      const t = between(r, 1, b - 1)
      return lines('count = 0', `for i in range(${a}):`, `    for j in range(${b}):`, `        if j == ${t}:`, '            break', '        count = count + 1', 'print(count, i)')
    },
  },
  {
    id: 'rows-fresh',
    stage: 7,
    from: '7.13',
    concepts: ['nested-build', 'repetition-pitfall'],
    err: 'object',
    reasoning: 'Where `row = []` sits decides how many row lists there are: in the outer body it runs once per pass; before the loop, once in all.',
    misconception: 'That appending a name to a list stores a copy of what it points at.',
    make: (r) => {
      const n = between(r, 2, 3)
      const m = between(r, 2, 3)
      const inside = r() < 0.5
      return inside
        ? lines('grid = []', `for i in range(${n}):`, '    row = []', `    for j in range(${m}):`, '        row.append(i + j)', '    grid.append(row)', 'print(grid)')
        : lines('grid = []', 'row = []', `for i in range(${n}):`, `    for j in range(${m}):`, '        row.append(i + j)', '    grid.append(row)', 'print(grid)')
    },
  },

  /* ------------------------------ Stage 8 ------------------------------ */
  {
    id: 'param-rebind-or-change',
    stage: 8,
    from: '8.6',
    concepts: ['param-binding', 'param-mutation'],
    err: 'object',
    reasoning: 'The parameter is a new name for the caller’s object. Changing the object is visible outside; rebinding the parameter is not.',
    misconception: 'That function parameters are copies — or that rebinding one reaches the caller.',
    make: (r) => {
      const xs = nums(r, 2)
      const n = between(r, 10, 99)
      const body = pick(r, [`xs.append(${n})`, `xs = xs + [${n}]`, `xs += [${n}]`])
      return lines('def f(xs):', `    ${body}`, '    return len(xs)', '', `a = ${list(xs)}`, 'print(f(a))', 'print(a)')
    },
  },
  {
    id: 'default-shared',
    stage: 8,
    from: '8.16',
    concepts: ['mutable-default'],
    err: 'object',
    reasoning: 'The default list is built once, when `def` runs, and belongs to the function. Every call that leaves it out shares it.',
    misconception: 'That defaults are created fresh for each call.',
    make: (r) => {
      const [a = 1, b = 2, c = 3] = nums(r, 3, 1, 9)
      return lines('def add(x, log=[]):', '    log.append(x)', '    return log', '', `print(add(${a}))`, `print(add(${b}))`, `print(add(${c}, []))`, `print(add(${a + b}))`)
    },
  },
]

export const variantFamilies = (stage: number): Family[] => FAMILIES.filter((f) => f.stage === stage)

export const variantId = (family: string, seed: number): string => `v:${family}:${seed >>> 0}`

const para = (text: string): Block => ({ kind: 'p', text })

/**
 * The item a variant id names, as an exercise, and its spec: one
 * prediction of the output, graded against the run.
 */
export function variant(id: string): { exercise: Exercise; spec: Spec } | null {
  const m = /^v:([a-z-]+):(\d+)$/.exec(id)
  if (!m) return null
  const f = FAMILIES.find((x) => x.id === m[1])
  if (!f) return null
  const code = f.make(rng(Number(m[2])))
  const exercise: Exercise = {
    id,
    stage: f.stage,
    form: 'Predict the result',
    kind: 'predict',
    prompt: [para(`A fresh version of ${f.from}. What does it print?`), { kind: 'code', lang: 'python', text: code.replace(/\n$/, '') }],
    snippets: [{ label: null, code }],
    key: {
      sections: [
        { label: 'Reasoning', blocks: [para(f.reasoning)] },
        { label: 'Targeted misconception', blocks: [para(f.misconception)] },
      ],
      answer: [],
      reasoning: [para(f.reasoning)],
      misconception: f.misconception,
      missed: '',
      errorTypes: [f.err],
      goBack: [f.from],
      authoring: null,
    },
  }
  const spec: Spec = {
    concepts: f.concepts,
    // The answer is whatever Python prints; `model` is only for the sweep
    // over the collection's own items, which variants are not.
    parts: [{ kind: 'output', model: { text: '', raises: null } }],
  }
  return { exercise, spec }
}
