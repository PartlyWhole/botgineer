/**
 * The graders: one pure function per interaction.
 *
 * Every one of them compares what the learner committed with what the
 * interpreter did, and never with a stored answer — the truth arrives as
 * `RunEvidence`, one per snippet, built from the real run. The `model`
 * answers in a spec are only for the sweep, which feeds each back through
 * the grader here to prove the key and the interpreter agree.
 *
 * Graders are lenient about presentation and strict about substance. A
 * list typed with double quotes where Python prints single ones, or two
 * spaces where it prints one, is right with a note: that is not what the
 * exercise is about. The wrong number, the wrong order, the wrong object —
 * those are the exercise, and they are wrong.
 */
import type { RunEvidence, Visit } from '../memory/extract'
import { canonical } from './distractors'
import { compareOrder, collectionOrder } from './traceOrder'
import type { Answer, Check, DiagramChoice, Graded, Part, SnippetRef } from './model'

/* ------------------------------- context ------------------------------- */

/** What a grader may consult: the runs of the snippets, and what the
 *  runner worked out alongside them. */
export type Truth = {
  /** One run per snippet, in snippet order. */
  runs: RunEvidence[]
  /** The snippets' labels, for resolving `'A'` / `'B'`. */
  labels: (string | null)[]
  /** The snippets' source, for `divergence`. */
  sources: string[]
  /** Block bodies per snippet, from Python's `ast`. */
  bodies?: Map<number, number[]>[]
  /** The pictures offered for a `diagram` part, by part index. */
  diagrams?: Map<number, DiagramChoice>
  /** A repair or a program, run: for `fix` and `write`. */
  program?: { source: string; run: RunEvidence; verdict: unknown } | undefined
}

export function snippetIndex(ref: SnippetRef | undefined, labels: readonly (string | null)[]): number {
  if (ref === undefined) return 0
  if (typeof ref === 'number') return ref
  const i = labels.indexOf(ref)
  return i < 0 ? 0 : i
}

/* ------------------------------- output ------------------------------- */

/** The comparison that matters: trailing space on a line and the final
 *  newline are not part of what a program "prints". */
export const normalise = (text: string): string =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '')

/** Presentation only: quote style and runs of spaces. */
const loosen = (text: string): string => normalise(text).replace(/"/g, "'").replace(/[ \t]+/g, ' ')

/** One printed set or dict-of-set, with its items in a fixed order. */
const setItems = (line: string): string => {
  const m = /^\{(.*)\}$/.exec(line.trim())
  if (!m || m[1]!.includes('{')) return line
  return `{${m[1]!
    .split(',')
    .map((x) => x.trim())
    .sort()
    .join(', ')}}`
}

export function gradeOutput(
  learner: { text: string; raises: string | null },
  run: RunEvidence,
  match: 'exact' | 'unordered-lines' | 'unordered-items' = 'exact',
): Graded {
  const expected = run.output
  const shown = normalise(expected) + (run.raised ? `\n… then it stops: ${run.raised}` : '')
  const raisedRight = (learner.raises ?? null) === (run.raised ?? null)

  const shape = (t: string) => {
    let lines = normalise(t).split('\n')
    if (match === 'unordered-items') lines = lines.map(setItems)
    if (match !== 'exact') lines = [...lines].sort()
    return lines.join('\n')
  }
  const loose = (t: string) => shape(loosen(t))

  const exact = shape(learner.text) === shape(expected)
  const close = !exact && loose(learner.text) === loose(expected)

  if ((exact || close) && raisedRight) {
    return {
      right: true,
      expected: shown,
      ...(close ? { note: 'Right — Python writes it with single quotes and single spaces, as shown.' } : {}),
      ...(match !== 'exact' ? { note: 'The order these come out in is not guaranteed, so any order counts.' } : {}),
    }
  }
  if ((exact || close) && !raisedRight) {
    return {
      right: false,
      expected: shown,
      why: run.raised
        ? `The printing is right, but then it stops with ${an(run.raised)}.`
        : `The printing is right, but it does not stop with an error — it runs to the end.`,
    }
  }
  if (run.raised && learner.raises === run.raised) {
    return { right: false, expected: shown, why: `Right that it stops with ${an(run.raised)}, but not what it prints first.` }
  }
  return { right: false, expected: shown }
}

const an = (w: string) => `${/^[AEIOU]/.test(w) ? 'an' : 'a'} ${w}`

/* ------------------------------ divergence ------------------------------ */

/**
 * The first line where two snippets' behaviour differs.
 *
 * The two runs are walked a step at a time — one line visit, at any
 * depth — and a line's effect is what changed between reaching it and
 * reaching whatever comes next: memory, and anything printed. Walking
 * steps rather than whole lines matters when the difference is inside a
 * function: a whole call line's effect includes its body, and it would be
 * named instead of the body line that actually differs.
 *
 * Where the two go to different lines the difference is in flow, and it
 * starts with a difference in the code, so the first line whose text
 * differs is the answer.
 */
export function divergence(a: RunEvidence, b: RunEvidence, sourceA: string, sourceB: string): number | null {
  const n = Math.min(a.visits.length, b.visits.length)
  const textual = firstTextDifference(sourceA, sourceB)
  const after = (ev: RunEvidence, i: number) => (i + 1 < ev.visits.length ? ev.beforeVisit(i + 1) : ev.final)
  for (let i = 0; i < n; i++) {
    if (a.visits[i]!.line !== b.visits[i]!.line) return textual ?? a.visits[Math.max(0, i - 1)]!.line
    const ea = canonical(after(a, i)) + '\u0000' + a.printedUntilNext(i)
    const eb = canonical(after(b, i)) + '\u0000' + b.printedUntilNext(i)
    if (ea !== eb) return a.visits[i]!.line
  }
  if (a.visits.length !== b.visits.length) return textual
  if (a.raised !== b.raised) return a.visits.at(-1)?.line ?? textual
  return null
}

function firstTextDifference(a: string, b: string): number | null {
  const la = a.split('\n')
  const lb = b.split('\n')
  for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) return i + 1
  return null
}

/* -------------------------------- checks -------------------------------- */

export type CheckResult = { ok: boolean; say: string; why?: string }

/** The Python expressions among a spec's checks, in order: what the
 *  checker program has to evaluate. */
export const pythonChecks = (checks: readonly Check[]): string[] =>
  checks.flatMap((c) => ('py' in c ? [c.py] : []))

export function runChecks(
  checks: readonly Check[],
  program: { source: string; run: RunEvidence; verdict: unknown },
): CheckResult[] {
  const verdict = Array.isArray(program.verdict) ? program.verdict : null
  let pyAt = 0
  return checks.map((c): CheckResult => {
    if ('py' in c) {
      const v = verdict?.[pyAt++]
      if (verdict === null) {
        return { ok: false, say: c.say, why: program.run.raised ? `it stopped with ${an(program.run.raised)}` : 'it did not finish' }
      }
      if (typeof v === 'string') return { ok: false, say: c.say, why: `checking it raised ${an(v)}` }
      return { ok: v === true, say: c.say }
    }
    if ('output' in c) return { ok: normalise(program.run.output) === normalise(c.output), say: c.say }
    if ('printedMatch' in c) return { ok: new RegExp(c.printedMatch, 'm').test(normalise(program.run.output)), say: c.say }
    if ('printed' in c) return { ok: normalise(program.run.output).split('\n').includes(normalise(c.printed)), say: c.say }
    if ('forbid' in c) return { ok: !new RegExp(c.forbid, 'm').test(program.source), say: c.say }
    if ('require' in c) return { ok: new RegExp(c.require, 'm').test(program.source), say: c.say }
    return { ok: (program.run.raised ?? null) === c.raises, say: c.say }
  })
}

/** How many lines a repair changed, for the smallest-fix note. Lines are
 *  compared as a multiset, so moving a line is one change, not two. */
export function changedLines(before: string, after: string): number {
  const count = (s: string) => {
    const m = new Map<string, number>()
    for (const l of s.split('\n').map((x) => x.trimEnd()).filter((x) => x.trim() !== '')) m.set(l, (m.get(l) ?? 0) + 1)
    return m
  }
  const a = count(before)
  const b = count(after)
  let removed = 0
  let added = 0
  for (const [l, n] of a) removed += Math.max(0, n - (b.get(l) ?? 0))
  for (const [l, n] of b) added += Math.max(0, n - (a.get(l) ?? 0))
  return Math.max(removed, added)
}

/* ------------------------------ the graders ------------------------------ */

const sameSet = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && [...a].sort((x, y) => x - y).every((x, i) => x === [...b].sort((p, q) => p - q)[i])

const derive = <T>(v: T | ((ev: RunEvidence[]) => T), runs: RunEvidence[]): T =>
  typeof v === 'function' ? (v as (ev: RunEvidence[]) => T)(runs) : v

/** How many times each line was reached. */
export function lineCounts(visits: readonly Visit[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const v of visits) m.set(v.line, (m.get(v.line) ?? 0) + 1)
  return m
}

const cell = (s: string) => loosen(s).replace(/^'(.*)'$/, '$1')

/**
 * Grades one part. `fix` and `write` need `truth.program`: the learner's
 * source, run, with the checker's verdict.
 */
export function gradePart(
  part: Part,
  answer: Answer,
  truth: Truth,
  where: { index: number; original?: string } = { index: 0 },
): Graded {
  const original = where.original ?? ''
  const run = (ref?: SnippetRef) => truth.runs[snippetIndex(ref, truth.labels)]!

  switch (part.kind) {
    case 'output': {
      if (answer.kind !== 'output') return { right: false }
      return gradeOutput(answer, run(part.snippet), part.match)
    }

    case 'choice': {
      if (answer.kind !== 'choice') return { right: false }
      const want = derive(part.answer, truth.runs)
      const wants = Array.isArray(want) ? want : [want]
      return {
        right: sameSet(answer.picked, wants),
        expected: wants.map((i) => part.options[i]).join('; '),
      }
    }

    case 'number': {
      if (answer.kind !== 'number') return { right: false }
      const want = derive(part.answer, truth.runs)
      return { right: answer.value === want, expected: String(want) }
    }

    case 'line': {
      if (answer.kind !== 'line') return { right: false }
      let wants: number[]
      if (part.answer === 'divergence') {
        const d = divergence(truth.runs[0]!, truth.runs[1]!, truth.sources[0] ?? '', truth.sources[1] ?? '')
        wants = d === null ? [] : [d]
      } else wants = Array.isArray(part.answer) ? part.answer : [part.answer]
      return { right: answer.line !== null && wants.includes(answer.line), expected: `line ${wants.join(' or line ')}` }
    }

    case 'order': {
      if (answer.kind !== 'order') return { right: false }
      const ev = run(part.snippet)
      const window = { first: part.first, lines: part.lines }
      const truthSeq = collectionOrder(ev.visits, window)
      const miss = compareOrder(answer.lines, ev.visits, window)
      return {
        right: miss === null,
        expected: truthSeq.join(' → '),
        ...(miss
          ? {
              why:
                miss.got === null
                  ? `It stops too soon: visit ${miss.at + 1} is line ${miss.expected}.`
                  : miss.expected === null
                    ? `Python has stopped by visit ${miss.at + 1}.`
                    : `Visit ${miss.at + 1} is line ${miss.expected}, not line ${miss.got}.`,
            }
          : {}),
      }
    }

    case 'table': {
      if (answer.kind !== 'table') return { right: false }
      const want = part.truth(truth.runs)
      const ok =
        want.length === answer.cells.length &&
        want.every((row, r) => row.every((c, k) => cell(c) === cell(answer.cells[r]?.[k] ?? '')))
      return { right: ok, expected: want.map((r) => r.join(' | ')).join('\n') }
    }

    case 'block': {
      if (answer.kind !== 'block') return { right: false }
      const i = snippetIndex(part.snippet, truth.labels)
      const body = truth.bodies?.[i]?.get(part.header) ?? []
      const bodyOk = sameSet(answer.body, body)
      let countsOk = true
      const counts = lineCounts(truth.runs[i]!.visits)
      const lines = (truth.sources[i] ?? '').split('\n')
      if (part.counts) {
        lines.forEach((text, n) => {
          if (text.trim() === '') return
          if ((answer.counts[n + 1] ?? -1) !== (counts.get(n + 1) ?? 0)) countsOk = false
        })
      }
      return {
        right: bodyOk && countsOk,
        expected:
          `Body: line ${body.join(', ')}` +
          (part.counts
            ? `. Runs: ${lines
                .map((t, n) => (t.trim() ? `line ${n + 1} ×${counts.get(n + 1) ?? 0}` : null))
                .filter(Boolean)
                .join(', ')}`
            : ''),
        ...(!bodyOk ? { why: 'The body is every line indented under the header, and nothing else.' } : !countsOk ? { why: 'The body is right; count the runs again.' } : {}),
      }
    }

    case 'diagram': {
      if (answer.kind !== 'diagram') return { right: false }
      const choice = truth.diagrams?.get(where.index)
      return { right: choice !== undefined && answer.picked === choice.answer }
    }

    case 'labels': {
      if (answer.kind !== 'labels') return { right: false }
      const ok = part.spans.every((s, i) => answer.roles[i] === s.role)
      return { right: ok, expected: part.spans.map((s) => `${s.text}: ${s.role}`).join('; ') }
    }

    case 'rule': {
      if (answer.kind !== 'rule') return { right: false }
      if (answer.mark === 'right') return { right: true }
      if (answer.mark === 'word') return { right: false, soft: true, err: 'vocabulary' }
      return { right: false }
    }

    case 'fix':
    case 'write': {
      if (!truth.program) return { right: false }
      const results = runChecks(part.checks, truth.program)
      const failed = results.filter((r) => !r.ok)
      const big = part.kind === 'fix' && changedLines(original, truth.program.source) > (part.small ?? 2)
      return {
        right: failed.length === 0,
        ...(failed.length ? { why: failed.map((f) => (f.why ? `${f.say} (${f.why})` : f.say)).join(' ') } : {}),
        ...(failed.length === 0 && big ? { note: 'It works. The key does it by changing less — see its fix.' } : {}),
      }
    }
  }
}
