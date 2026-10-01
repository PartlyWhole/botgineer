/**
 * What the editor lessons (`v2-if`, `v2-loops`) share: reading a run's
 * memory, judging a program on the cases the robot tried it on, and the
 * usual replies to a program that stopped the robot — a header without
 * its colon, a block not pushed in, a word without quotes.
 *
 * A program is judged on what it *does*: the memory each case left
 * (`Run.cases`, real Python), plus the shape the step is about (an `if`, a
 * `for`), because a program that sets the answer by hand does the right
 * thing on one case and not the next.
 */
import type { MemorySnapshot } from '../../../src/memory/model'
import { allCases, ran, type CaseRun, type Evidence, type Line } from '../core'

/** The repr of what `name` points at, or null for no such name. */
export function reprOf(s: MemorySnapshot, name: string): string | null {
  const b = s.bindings.find((x) => x.name === name)
  return b ? (s.objects[b.target]?.repr ?? null) : null
}

/**
 * What `name` points at, as Python would write it — a list with its items
 * (`[7, 9]`, `['gem', 'coin']`), since a list's own repr here is only how
 * many it holds — or null for no such name.
 */
export function valueOf(s: MemorySnapshot, name: string): string | null {
  const b = s.bindings.find((x) => x.name === name)
  const o = b ? s.objects[b.target] : undefined
  if (!o) return null
  if (o.type === 'list' && o.elements) return `[${o.elements.map((el) => s.objects[el.target]?.repr ?? '?').join(', ')}]`
  return o.repr
}

/** How a case is said: `hp = 20, potions = 1`. */
export const givenText = (g: Record<string, string>) =>
  Object.entries(g)
    .map(([k, v]) => `${k} = ${v}`)
    .join(', ')

/** What a case should leave `name` pointing at, as Python writes it. */
export type Want = (given: Record<string, string>) => string | null

/** The rows of a `cases` picture, in the step's order. */
export const caseRows = (cases: Record<string, string>[], want: Want) =>
  cases.map((g) => ({ given: givenText(g), want: want(g) ?? 'nothing' }))

/**
 * What a case should leave, or undefined for a case that is not this
 * step's: every run is in the evidence, and an earlier step's run was
 * tried on other names (`cave`, where this step gives `gems`).
 */
function wanted(want: Want, given: Record<string, string>): string | null | undefined {
  try {
    return want(given)
  } catch {
    return undefined
  }
}

/** Some run had this shape, and every case left `name` as wanted. */
export const decides = (e: Evidence, shape: RegExp, name: string, want: Want): boolean =>
  ran(e, (r) => shape.test(r.source) && allCases(r, (c) => {
    const w = wanted(want, c.given)
    return w !== undefined && valueOf(c.final, name) === w
  }))

/** The first case the last run got wrong, said plainly. */
export function wrongCase(l: Line, name: string, want: Want): string | undefined {
  const c: CaseRun | undefined = l.run?.cases?.find((x) => !x.ok || valueOf(x.final, name) !== wanted(want, x.given))
  if (!c) return undefined
  const w = wanted(want, c.given)
  if (w === undefined) return undefined
  if (!c.ok) return `With \`${givenText(c.given)}\`, the program stopped the robot${c.raised === 'steps' ? ': it never finished' : ` with a \`${c.raised}\``}.`
  const got = valueOf(c.final, name)
  if (got === null) return `With \`${givenText(c.given)}\`, \`${name}\` was never made. It should be \`${w}\`.`
  if (w === null) return `With \`${givenText(c.given)}\`, \`${name}\` shouldn't be made at all, but it's \`${got}\`.`
  return `With \`${givenText(c.given)}\`, \`${name}\` came out \`${got}\`. It should be \`${w}\`.`
}

const HEADER = /^\s*(if|elif|else|for|while)\b/

/**
 * The usual replies to a program that stopped the robot, by the line it
 * stopped on: a header with no colon, `else if`, one `=` asking a
 * question, a block not pushed in, a line pushed in with no header, a
 * word without quotes. Undefined when none of them fits.
 */
export function codeMiss(l: Line): string | undefined {
  const r = l.run
  if (!r || r.ok) return undefined
  const lines = l.source.split('\n')
  const at = r.line ?? 0
  const text = lines[at - 1] ?? ''
  const where = at > 0 ? `Line ${at}` : 'A line'
  if (r.raised === 'steps') return 'The robot never finished: the loop kept going round. Check what makes its question `False`.'
  if (r.raised === 'SyntaxError') {
    const elseIf = lines.findIndex((x) => /^\s*else\s+if\b/.test(x))
    if (elseIf >= 0) return `Line ${elseIf + 1}: Python says \`elif\`, in one word.`
    const oneEq = lines.findIndex((x) => /^\s*(if|elif|while)\b[^#]*[^=!<>]=[^=]/.test(x))
    if (oneEq >= 0) return `Line ${oneEq + 1}: one \`=\` points a name. To ask *is it the same?*, use two: \`==\`.`
    const noColon = lines.findIndex((x) => HEADER.test(x) && !/:\s*(#.*)?$/.test(x))
    if (noColon >= 0) return `Line ${noColon + 1} is a header: it ends with a colon \`:\`, which opens its block.`
    return `${where} stopped the robot with a \`SyntaxError\`: check its spelling, brackets and quotes.`
  }
  if (r.raised === 'IndentationError') {
    const prev = lines.slice(0, Math.max(0, at - 1)).filter((x) => x.trim()).pop() ?? ''
    if (HEADER.test(prev) || /:\s*$/.test(prev)) return `${where} belongs to the block above it: push it in four spaces (Tab).`
    if (/^\s+/.test(text)) return `${where} is pushed in, but there's no header above it for it to belong to.`
    return `${where}: the lines of a block must all be pushed in by the same amount.`
  }
  if (r.raised === 'NameError') {
    const bare = /=\s*([A-Za-z_]\w*)\s*$/.exec(text)?.[1]
    if (bare && !/^(True|False|None)$/.test(bare)) return `${where}: words need quotes, or the robot reads \`${bare}\` as a name: \`"${bare}"\`.`
    return `${where} uses a name the robot has no memory of. Is it spelt the same everywhere?`
  }
  return `${where} stopped the robot with a \`${r.raised}\`.`
}
