/**
 * Programs the app runs *about* a program, rather than for the player.
 *
 * Both leave a JSON verdict under a hidden name (`VERDICT`), which
 * `extract.runEvidence` reads back — the same trick the console uses for
 * `THOUGHT`. Neither changes what the player's code does: the checker runs
 * after it, in a separate run from the one the player watches, and the
 * block finder runs Python's own parser in a fresh namespace, which the
 * engine does not trace, so it costs one step.
 */
import { CHECKER, VERDICT } from '../memory/extract'

const py = (s: string) => JSON.stringify(s)

/**
 * The player's program, then a function that evaluates each check in the
 * program's own namespace and records which held.
 *
 * The checks go in as a JSON array of strings, which is also a Python
 * list literal: JSON's string escapes are a subset of Python's.
 *
 * A check that raises is recorded as the exception's type name rather
 * than as false, so a checker can say "that raised NameError" instead of
 * "that was not true".
 */
export function checkerProgram(source: string, expressions: readonly string[]): string {
  const body = source.endsWith('\n') ? source : source + '\n'
  return (
    body +
    `
def ${CHECKER}(__checks):
    import json
    out = []
    for src in __checks:
        try:
            out.append(bool(eval(src, globals())))
        except BaseException as e:
            out.append(type(e).__name__)
    return json.dumps(out)
${VERDICT} = ${CHECKER}(${JSON.stringify(expressions)})
`
  )
}

/**
 * Asks Python's `ast` which lines belong to each block, keyed by the
 * block's header line. A body is every line of every statement in it —
 * nested blocks included, since their lines are in the outer body too —
 * and the header is a `for`, `while`, `if`, `def`, `with` or `try` line.
 */
export function bodiesProgram(snippet: string): string {
  const helper = `
import ast, json
tree = ast.parse(SOURCE)
out = {}
for node in ast.walk(tree):
    if isinstance(node, (ast.For, ast.While, ast.If, ast.FunctionDef, ast.With, ast.Try)):
        lines = set()
        for stmt in node.body:
            lines.update(range(stmt.lineno, stmt.end_lineno + 1))
        out[str(node.lineno)] = sorted(lines)
RESULT = json.dumps(out)
`
  return `${VERDICT} = (lambda ns: (exec(${py(helper)}, ns), ns["RESULT"])[1])({"__name__": "_bg_helper", "SOURCE": ${py(snippet)}})\n`
}

/** The block finder's answer, as header line → body lines. */
export function readBodies(verdict: unknown): Map<number, number[]> {
  const out = new Map<number, number[]>()
  if (typeof verdict !== 'object' || verdict === null) return out
  for (const [k, v] of Object.entries(verdict as Record<string, unknown>)) {
    if (Array.isArray(v)) out.set(Number(k), v.filter((n): n is number => typeof n === 'number'))
  }
  return out
}
