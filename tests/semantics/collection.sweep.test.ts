/**
 * The collection, against the real interpreter.
 *
 * Two proofs, both run in the same CPython and engine the site ships:
 *
 *   **the audit**  every snippet in every stage runs to an honest end —
 *                  finishes, or stops with the error the key expects —
 *                  and never hits the step budget or breaks the engine.
 *   **the sweep**  every item's *model* answers — the key's output typed as
 *                  a prediction, its fix as the repair, its numbering as
 *                  the order — pass that item's own graders. A key that
 *                  disagrees with Python 3.14, or a spec that disagrees
 *                  with its key, fails here and names the item.
 */
import { describe, expect, it } from 'vitest'
import { ITEMS, STAGES, playable, specOf } from '../../src/collection'
import { divergence, gradePart, normalise } from '../../src/collection/grade'
import { modelAnswer, originalOf, prepare, runProgram } from '../../src/collection/runner'
import { evaluate } from './engine'

const specd = ITEMS.filter((i) => specOf(i.id))

describe('the audit', () => {
  it('runs every snippet in the collection to an honest end', async () => {
    const bad: string[] = []
    for (const item of ITEMS) {
      const snippets = item.kind === 'exercise' ? item.exercise.snippets : item.question.snippets
      for (const s of snippets) {
        const ev = await evaluate(s.code, specOf(item.id)?.options)
        if (ev.reason !== 'completed' && ev.reason !== 'uncaught_exception') bad.push(`${item.id}: ${ev.reason}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('runs every code example in the ideas sections', async () => {
    const bad: string[] = []
    for (const s of STAGES) {
      for (const idea of s.ideas) {
        for (const b of idea.blocks) {
          if (b.kind !== 'code' || b.lang !== 'python') continue
          const ev = await evaluate(b.text + '\n')
          if (ev.reason !== 'completed' && ev.reason !== 'uncaught_exception') bad.push(`stage ${s.stage} "${idea.title}": ${ev.reason}`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})

describe('the sweep: every model answer passes its own grader', () => {
  for (const item of specd) {
    it(item.id, async () => {
      const p = playable(item.id)
      const truth = await prepare(p, evaluate)
      const problems: string[] = []

      for (const [index, part] of p.spec.parts.entries()) {
        const where = `${item.id} part ${index + 1} (${part.kind})`

        if (part.kind === 'fix' || part.kind === 'write') {
          const program = await runProgram(part, part.model, evaluate, p.spec.options)
          const g = gradePart(part, { kind: part.kind, source: part.model }, { ...truth, program }, {
            index,
            ...(part.kind === 'fix' ? { original: originalOf(p, part) } : {}),
          })
          if (!g.right) problems.push(`${where}: the key's program fails — ${g.why ?? ''}`)
          // And the snippet as given must *not* already pass: a fix that
          // checks nothing the bug breaks is not a check.
          if (part.kind === 'fix') {
            const before = await runProgram(part, originalOf(p, part), evaluate, p.spec.options)
            const g0 = gradePart(part, { kind: 'fix', source: originalOf(p, part) }, { ...truth, program: before }, { index })
            if (g0.right) problems.push(`${where}: the unfixed snippet already passes the checks`)
          }
          continue
        }

        if (part.kind === 'diagram') {
          const d = truth.diagrams?.get(index)
          if (!d) problems.push(`${where}: the moment never happens`)
          else if (d.options.length < 3) problems.push(`${where}: only ${d.options.length} distinct pictures`)
          continue
        }

        if (part.kind === 'line' && part.answer === 'divergence') {
          const d = divergence(truth.runs[0]!, truth.runs[1]!, truth.sources[0]!, truth.sources[1]!)
          if (d !== part.model) problems.push(`${where}: traces diverge at line ${d}, the key says ${part.model}`)
          continue
        }

        const answer = modelAnswer(part, truth, index)
        if (!answer) continue
        const g = gradePart(part, answer, truth, { index })
        if (!g.right && part.kind !== 'rule') {
          problems.push(`${where}: the key's answer is marked wrong. Expected: ${JSON.stringify(g.expected)}; ${g.why ?? ''}`)
        }
      }

      // The key's printed output, where the spec restates it, must be
      // what the key says — a copying slip in a spec is caught here.
      if (item.kind === 'exercise') {
        const key = JSON.stringify(item.exercise.key.sections).replace(/\\n/g, '\n')
        for (const part of p.spec.parts) {
          if (part.kind !== 'output' || part.model.text === '') continue
          for (const line of normalise(part.model.text).split('\n')) {
            if (!key.includes(line.trim())) problems.push(`${item.id}: "${line}" is not in the key`)
          }
        }
      }

      expect(problems).toEqual([])
    })
  }
})
