/**
 * Just enough Python to know the answer to an exercise before asking it.
 *
 * Generators build small expression trees — literals, names and binary
 * operators — and need two things from them: the source to show, and the
 * value Python will produce. Parsing Python is not needed and not done:
 * the tree is the exercise, and `render` and `evaluate` are two readings
 * of it, so they cannot disagree about what was asked.
 *
 * This is deliberately a tiny subset, and every generator stays inside it:
 * ints and floats of modest size, short ASCII strings, bools, and
 * `+ - * / // % < > <= >= == !=`. Inside that subset it follows Python,
 * not JavaScript — `/` always gives a float, `//` and `%` floor towards
 * negative infinity, `7 / 7` is `1.0`, a string's repr takes single
 * quotes. The browser suite checks it against real CPython over many
 * generated exercises, because the interpreter is the answer key; this is
 * only a copy of it that can run before the question is asked.
 */

export type PyValue =
  | { t: 'int'; v: number }
  | { t: 'float'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }

export type BinOp = '+' | '-' | '*' | '/' | '//' | '%' | '<' | '>' | '<=' | '>=' | '==' | '!='

export type Expr =
  | { k: 'lit'; value: PyValue }
  | { k: 'name'; id: string }
  | { k: 'bin'; op: BinOp; l: Expr; r: Expr }

export class PyError extends Error {}

/* ------------------------------ building ------------------------------ */

export const int = (v: number): Expr => ({ k: 'lit', value: { t: 'int', v } })
export const float = (v: number): Expr => ({ k: 'lit', value: { t: 'float', v } })
export const str = (v: string): Expr => ({ k: 'lit', value: { t: 'str', v } })
export const bool = (v: boolean): Expr => ({ k: 'lit', value: { t: 'bool', v } })
export const name = (id: string): Expr => ({ k: 'name', id })
export const bin = (op: BinOp, l: Expr, r: Expr): Expr => ({ k: 'bin', op, l, r })

/* ------------------------------ rendering ------------------------------ */

/** Python's binding strength, loosest first. */
const PREC: Record<BinOp, number> = {
  '<': 1,
  '>': 1,
  '<=': 1,
  '>=': 1,
  '==': 1,
  '!=': 1,
  '+': 2,
  '-': 2,
  '*': 3,
  '/': 3,
  '//': 3,
  '%': 3,
}

/**
 * The source for an expression, with exactly the brackets the tree needs.
 *
 * A child is bracketed when it binds more loosely than its parent, or
 * equally on the right (`a - (b - c)` is not `a - b - c`). Comparisons
 * are never chained: Python reads `a < b < c` as two comparisons, which a
 * tree of one comparison inside another does not mean.
 */
export function render(e: Expr): string {
  if (e.k === 'lit') return repr(e.value)
  if (e.k === 'name') return e.id
  const p = PREC[e.op]
  const side = (child: Expr, right: boolean) => {
    const s = render(child)
    if (child.k !== 'bin') return s
    const q = PREC[child.op]
    const wrap = q < p || (right && q === p) || (q === 1 && p === 1)
    return wrap ? `(${s})` : s
  }
  return `${side(e.l, false)} ${e.op} ${side(e.r, true)}`
}

/* ------------------------------ evaluating ------------------------------ */

const num = (x: PyValue): number | null => (x.t === 'int' || x.t === 'float' ? x.v : x.t === 'bool' ? +x.v : null)

/** Python's floor modulo: the result takes the sign of the divisor. */
const pymod = (a: number, b: number) => a - Math.floor(a / b) * b

export function evaluate(e: Expr, env: Record<string, PyValue> = {}): PyValue {
  if (e.k === 'lit') return e.value
  if (e.k === 'name') {
    const v = env[e.id]
    if (!v) throw new PyError(`NameError: ${e.id}`)
    return v
  }
  const a = evaluate(e.l, env)
  const b = evaluate(e.r, env)
  const op = e.op

  if (op === '==' || op === '!=') {
    const same = a.t === 'str' || b.t === 'str' ? a.t === b.t && a.v === b.v : num(a) === num(b)
    return { t: 'bool', v: op === '==' ? same : !same }
  }

  if (a.t === 'str' || b.t === 'str') {
    if (a.t === 'str' && b.t === 'str') {
      if (op === '+') return { t: 'str', v: a.v + b.v }
      if (op === '<') return { t: 'bool', v: a.v < b.v }
      if (op === '>') return { t: 'bool', v: a.v > b.v }
      if (op === '<=') return { t: 'bool', v: a.v <= b.v }
      if (op === '>=') return { t: 'bool', v: a.v >= b.v }
    }
    if (op === '*' && (a.t === 'int' || b.t === 'int')) {
      const s = a.t === 'str' ? a.v : (b as { v: string }).v
      const n = a.t === 'int' ? a.v : (b as { v: number }).v
      return { t: 'str', v: s.repeat(Math.max(0, n)) }
    }
    throw new PyError(`TypeError: ${a.t} ${op} ${b.t}`)
  }

  const x = num(a)!
  const y = num(b)!
  const floaty = a.t === 'float' || b.t === 'float'
  const out = (v: number): PyValue => (floaty ? { t: 'float', v } : { t: 'int', v })

  switch (op) {
    case '+':
      return out(x + y)
    case '-':
      return out(x - y)
    case '*':
      return out(x * y)
    case '/':
      if (y === 0) throw new PyError('ZeroDivisionError')
      return { t: 'float', v: x / y }
    case '//':
      if (y === 0) throw new PyError('ZeroDivisionError')
      return out(Math.floor(x / y))
    case '%':
      if (y === 0) throw new PyError('ZeroDivisionError')
      return out(pymod(x, y))
    case '<':
      return { t: 'bool', v: x < y }
    case '>':
      return { t: 'bool', v: x > y }
    case '<=':
      return { t: 'bool', v: x <= y }
    case '>=':
      return { t: 'bool', v: x >= y }
  }
}

/* ------------------------------ printing ------------------------------ */

/**
 * `repr` of a value, as Python writes it.
 *
 * Floats are the careful part. Python prints the shortest string that
 * reads back as the same float, and so does JavaScript's `String` — but
 * Python always keeps a decimal point (`4.0`, not `4`) and switches to
 * exponent form at different thresholds. Generators keep floats between
 * 1e-4 and 1e15, where the two agree once the point is added.
 */
export function repr(x: PyValue): string {
  switch (x.t) {
    case 'int':
      return String(x.v)
    case 'bool':
      return x.v ? 'True' : 'False'
    case 'float': {
      if (!Number.isFinite(x.v)) return x.v > 0 ? 'inf' : x.v < 0 ? '-inf' : 'nan'
      if (Object.is(x.v, -0)) return '-0.0'
      const s = String(x.v)
      return /[.e]/.test(s) ? s : `${s}.0`
    }
    case 'str': {
      // Single quotes unless the text has one and no double quote, which
      // is Python's rule. Generators use plain words, so escapes beyond
      // the quote and backslash never arise.
      const q = x.v.includes("'") && !x.v.includes('"') ? '"' : "'"
      const body = x.v.replace(/\\/g, '\\\\').replace(new RegExp(q, 'g'), `\\${q}`)
      return `${q}${body}${q}`
    }
  }
}

/** Reads a repr the console reported back into a number, for checks like
 *  "a whole number between 10 and 20". Null if it is not one. */
export function numberOf(reprText: string): number | null {
  if (!/^-?\d+(\.\d+)?(e-?\d+)?$/.test(reprText)) return null
  return Number(reprText)
}
