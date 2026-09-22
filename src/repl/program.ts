/**
 * The REPL's program builder.
 *
 * The engine runs whole programs: `run({ source })` and nothing else.
 * There is no call that execs one line into a namespace that persists, so
 * a line-at-a-time console cannot be a session that stays open. It is
 * **replay** — every submission re-runs the accepted history plus the new
 * line, from scratch.
 *
 * That sounds wasteful and is: a session of N lines costs O(N^2) steps.
 * For a console of short teaching lines it is nothing, and it buys three
 * things worth more than the cycles:
 *
 *   - Memory persists without the engine persisting anything.
 *   - A line that raises is simply not accepted, so the state the player
 *     can see is always the state some program actually produced. That is
 *     what a real REPL does too.
 *   - The history *is* a program. Unlocking the editor later hands the
 *     player the thing they have been writing all along, rather than
 *     switching them to a different artifact.
 *
 * What replay does not survive: a nondeterministic line (`random`, clocks,
 * `input`) is re-executed on every later submission and may answer
 * differently. Nothing in the early lessons does this, and the console
 * says so when it matters rather than pretending otherwise.
 */

/** A line the robot accepted. `echo` marks a bare expression, which has a
 *  value to report. */
export type Entry = { source: string; echo: boolean }

/**
 * How a bare expression's value is reported.
 *
 * `>>> 10` evaluates an int and drops it. Nothing refers to it, so it is
 * collectable the instant the line ends and it will never appear in
 * memory — and that is the point. The robot *thinks* of the number; the
 * number is not stored anywhere, and asking again means working it out
 * again. Memory is for things with names.
 *
 * (An earlier version kept these values alive in a hidden list so they
 * would show up in memory. That taught "an object needs no name" at the
 * price of implying an object needs no reference either, which is not
 * true and is not what Python does.)
 *
 * So the value is turned into a *description* — its type and its repr —
 * and only the description is held, under a hidden name. The object
 * itself is already gone by the time anything reads it.
 */
export const THOUGHT = '__bg_thought__'

/** The one-line helper that makes a description. Hidden, like `THOUGHT`. */
export const DESCRIBE = '__bg_think__'

/** Separates type from repr in a description. A repr can never contain a
 *  literal tab — `repr` escapes it — and no type name does either. */
export const THOUGHT_SEP = '\t'

/** Opens a block or is otherwise unambiguously a statement. `lambda` is
 *  missing on purpose: it begins an expression. */
const STATEMENT_WORDS = new Set([
  'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del',
  'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if',
  'import', 'nonlocal', 'pass', 'raise', 'return', 'try', 'while', 'with',
  'yield',
])

const OPENERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

type Scan = { depth: number; inString: false | string; continued: boolean; topLevelAssign: boolean }

/**
 * One pass over the text, tracking strings and brackets.
 *
 * Everything the console needs to know about a line is a property of this
 * scan, so there is one place that understands quoting rather than three
 * regexes that each get it slightly wrong.
 */
function scan(text: string): Scan {
  let depth = 0
  let inString: false | string = false
  let topLevelAssign = false
  let i = 0

  while (i < text.length) {
    const c = text[i]!

    if (inString) {
      if (c === '\\') { i += 2; continue }
      if (text.startsWith(inString, i)) { i += inString.length; inString = false; continue }
      i += 1
      continue
    }

    if (c === '#') break // a comment ends the interesting part of the line

    if (c === '"' || c === "'") {
      const triple = text.slice(i, i + 3)
      inString = triple === '"""' || triple === "'''" ? triple : c
      i += inString.length
      continue
    }

    if (c === '(' || c === '[' || c === '{') { depth += 1; i += 1; continue }
    if (c === ')' || c === ']' || c === '}') {
      if (depth > 0 && OPENERS[c]) depth -= 1
      i += 1
      continue
    }

    if (c === '=' && depth === 0) {
      const next = text[i + 1]
      const prev = text[i - 1]
      // `==` and `!= <= >=` are comparisons. Anything else with an `=` at
      // the top level binds something: plain, augmented, or a walrus that
      // would not be legal bare anyway. All of those are statements.
      if (next === '=') { i += 2; continue }
      if (prev === '=' || prev === '!' || prev === '<' || prev === '>') { i += 1; continue }
      topLevelAssign = true
    }

    i += 1
  }

  const code = text.split('#')[0]!.trimEnd()
  return {
    depth,
    inString,
    continued: code.endsWith('\\') || code.endsWith(':'),
    topLevelAssign,
  }
}

/**
 * True while the console should keep collecting lines before running
 * anything — an open bracket, an open triple-quote, a block header, or an
 * explicit backslash. Mirrors what a terminal REPL shows as `...`.
 */
export function needsContinuation(buffer: string): boolean {
  if (buffer.trim() === '') return false
  const s = scan(buffer)
  if (s.depth > 0 || s.inString !== false) return true
  // A *blank* line ends a block, the way it does in IDLE — which means two
  // newlines, not one. One newline is just the end of the line you typed;
  // treating it as the end of the block closed every block immediately,
  // before a single line of its body could be entered.
  if (buffer.endsWith('\n\n')) return false
  if (s.continued) return true
  return buffer.includes('\n')
}

/**
 * Whether a submission is a bare expression, and so has a value to echo
 * and to keep.
 *
 * Conservative by construction: anything it cannot confidently call an
 * expression is treated as a statement, which costs only the echo. The
 * reverse mistake would wrap a statement in a call and turn a working
 * line into a SyntaxError.
 */
export function isExpression(source: string): boolean {
  const text = source.trim()
  if (text === '') return false
  if (text.includes('\n')) return false // a block is never a bare expression

  const s = scan(text)
  if (s.depth !== 0 || s.inString !== false) return false
  if (s.continued || s.topLevelAssign) return false

  const first = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text)?.[0]
  if (first && STATEMENT_WORDS.has(first)) return false

  return true
}

export type Built = {
  /** The whole program: preamble, history, then the pending submission. */
  source: string
  /** Program line where the pending submission starts, 1-based. Output and
   *  errors are attributed from here on; everything earlier is replay. */
  pendingLine: number
  /** Program line → index in `history`, or null for our own plumbing.
   *  1-based, so `lineOwner[0]` is unused. */
  lineOwner: (number | null)[]
}

/**
 * Turns an entry into the line that will run.
 *
 * Only the *pending* entry is wrapped. A bare expression replayed from
 * history is emitted exactly as typed — `10` on its own is a legal
 * statement that evaluates and discards, which is precisely the behaviour
 * being taught — and leaving it alone means the description belongs
 * unambiguously to the line just submitted. A statement is never wrapped,
 * so a submission that binds nothing reports no thought at all.
 */
const compile = (entry: Entry, pending: boolean): string =>
  pending && entry.echo ? `${THOUGHT} = ${DESCRIBE}(${entry.source.trim()})` : entry.source

/**
 * Builds the program for one submission.
 *
 * `pending` is the line being tried. It is compiled exactly like an
 * accepted line — if it completes, the caller appends it to history and
 * the next build replays it unchanged, so what the player saw happen is
 * what keeps happening.
 */
export function buildProgram(history: Entry[], pending: Entry | null): Built {
  const preamble = [`${DESCRIBE} = lambda v: f"{type(v).__name__}${THOUGHT_SEP}{v!r}"`]
  // Index 0 is unused: program lines are 1-based, like the trace's.
  const lineOwner: (number | null)[] = [null, ...preamble.map(() => null)]
  const body: string[] = []

  const emit = (entry: Entry, owner: number, isPending = false) => {
    const compiled = compile(entry, isPending)
    for (let i = 0; i < compiled.split('\n').length; i += 1) lineOwner.push(owner)
    body.push(compiled)
  }

  history.forEach((entry, index) => emit(entry, index))

  // The pending line starts immediately after everything already emitted.
  const pendingLine = lineOwner.length

  if (pending) emit(pending, history.length, true)

  return {
    source: [...preamble, ...body].join('\n') + '\n',
    pendingLine: pending ? pendingLine : preamble.length,
    lineOwner,
  }
}
