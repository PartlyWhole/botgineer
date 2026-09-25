/**
 * Reading's pure parts: trace order, canonical memory and the wrong
 * pictures, the checkpoint gate, and the variants. The graders against
 * real Python are in `tests/semantics/grade.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import type { Visit } from '../../src/memory/extract'
import type { MemorySnapshot } from '../../src/memory/model'
import { collectionOrder, compareOrder, withoutReturns } from '../../src/collection/traceOrder'
import { applyTransform, canonical, diagramOptions } from '../../src/collection/distractors'
import { passed, passMark, practiceItems, resumeAt, reviewItems, reviewOwed } from '../../src/collection/levels'
import { FAMILIES, variant, variantId } from '../../src/collection/variants'
import { KEY, record, type Mastery } from '../../src/mastery/mastery'
import { changedLines, normalise } from '../../src/collection/grade'
import {
  ACT_LEAD,
  ACT_LINE,
  actLine,
  CHECKPOINT_LINE,
  doneLine,
  heldTitle,
  ideaBeats,
  IDEAS_CLOSE,
  memoryNote,
  NOTHING_NAMED,
  noteAt,
  raisedNote,
  readTo,
  RULE_LINE,
  sectionsOf,
  TASK_LINES,
  taskLine,
  verdictLine,
} from '../../src/collection/voice'
import { BRIDGE, STAGE_1_LEAD, STAGE_OPENERS } from '../../content/collection/story'
import { EMPTY } from '../../src/memory/model'
import { STAGES, itemById, lensesOf, playable, setsOf } from '../../src/collection'

const visits = (lines: [line: number, depth?: number][]): Visit[] =>
  lines.map(([line, depth = 1], step) => ({ line, depth, fn: depth > 1 ? 'f' : '<module>', step }))

describe('execution order, in the collection’s numbering', () => {
  // 9.4, as the trace reports it: `half` is called from line 9 and the
  // trace goes straight back to the `for` on line 6.
  const trace94 = visits([[1], [4], [5], [6], [7], [9], [2, 2], [6], [7], [8], [6], [10]])

  it('accepts the key’s numbering, which revisits the calling line after the call', () => {
    const key = [1, 4, 5, 6, 7, 9, 2, 9, 6, 7, 8, 6, 10]
    expect(compareOrder(key, trace94)).toBeNull()
  })

  it('accepts the trace’s own numbering, which does not', () => {
    expect(compareOrder([1, 4, 5, 6, 7, 9, 2, 6, 7, 8, 6, 10], trace94)).toBeNull()
  })

  it('still catches a real mistake, and says where', () => {
    // `continue` sends the loop back to the `for`, not on to line 9.
    expect(compareOrder([1, 4, 5, 6, 7, 9, 2, 6, 7, 8, 9, 6, 10], trace94)).toEqual({ at: 10, expected: 6, got: 9 })
  })

  it('does not drop a genuine repeat that follows no call', () => {
    const d = new Map([[2, 1]])
    expect(withoutReturns([2, 2, 2], d)).toEqual([2, 2, 2])
  })

  it('counts a for header once per pass and once to find nothing left', () => {
    // 5.2: total = 0 / for n in [4, 6] / total = total + n / print(total)
    const t = visits([[1], [2], [3], [2], [3], [2], [4]])
    expect(collectionOrder(t)).toEqual([1, 2, 3, 2, 3, 2, 4])
    expect(collectionOrder(t, { first: 3 })).toEqual([1, 2, 3])
  })

  it('windows by top-level lines, keeping the calls made inside the window', () => {
    // 9.C2's shape: lines 26–27 call into line 2 and lines 5–7.
    const t = visits([[1], [4], [26], [2, 2], [27], [5, 2], [6, 2], [7, 2], [28], [5, 2]])
    expect(collectionOrder(t, { lines: [26, 27] })).toEqual([26, 2, 27, 5, 6, 7])
  })
})

/* ------------------------------ memory ------------------------------ */

const list = (id: string, items: string[]) => ({
  id,
  type: 'list',
  kind: 'reference' as const,
  repr: `${items.length} items`,
  elements: items.map((t, i) => ({ label: String(i), target: t })),
  partial: false,
})
const int = (n: number) => ({ id: `v:int:${n}`, type: 'int', kind: 'value' as const, repr: String(n), elements: null, partial: false })
const snap = (bindings: [string, string][], objects: ReturnType<typeof list | typeof int>[]): MemorySnapshot => ({
  bindings: bindings.map(([name, target]) => ({ name, scope: 'global', target })),
  objects: Object.fromEntries(objects.map((o) => [o.id, o])),
  line: null,
})

describe('canonical memory', () => {
  it('ignores ids, and sees sharing', () => {
    const a = snap([['p', 'o:1'], ['q', 'o:1']], [list('o:1', ['v:int:1']), int(1)])
    const b = snap([['p', 'o:9'], ['q', 'o:9']], [list('o:9', ['v:int:1']), int(1)])
    const c = snap([['p', 'o:1'], ['q', 'o:2']], [list('o:1', ['v:int:1']), list('o:2', ['v:int:1']), int(1)])
    expect(canonical(a)).toBe(canonical(b))
    expect(canonical(a)).not.toBe(canonical(c))
  })
})

describe('the wrong pictures', () => {
  // 1.3: p and q share a list; r has its own equal-looking one.
  const truth = snap(
    [['p', 'o:1'], ['q', 'o:1'], ['r', 'o:2']],
    [list('o:1', ['v:int:1', 'v:int:2']), list('o:2', ['v:int:1', 'v:int:2']), int(1), int(2)],
  )

  it('draws "assignment copies" as three lists', () => {
    const wrong = applyTransform('alias-to-copy', truth)!
    expect(Object.values(wrong.objects).filter((o) => o.type === 'list')).toHaveLength(3)
  })

  it('draws "equal-looking lists are one list" as one list', () => {
    const wrong = applyTransform('copy-to-alias', truth)!
    expect(Object.values(wrong.objects).filter((o) => o.type === 'list')).toHaveLength(1)
  })

  it('draws "* makes independent lists" with one inner list per slot', () => {
    // grid = [[0] * 2] * 2: two slots, one inner list.
    const grid = snap([['grid', 'o:1']], [list('o:1', ['o:2', 'o:2']), list('o:2', ['v:int:0', 'v:int:0']), int(0)])
    const wrong = applyTransform('shared-inner-to-separate', grid)!
    const outer = wrong.objects[wrong.bindings[0]!.target]!
    expect(new Set(outer.elements!.map((e) => e.target)).size).toBe(2)
  })

  it('offers only pictures that differ, and puts the truth where the seed says', () => {
    const same = { snapshot: truth, transform: 'earlier' as const }
    const other = { snapshot: applyTransform('alias-to-copy', truth), transform: 'alias-to-copy' as const }
    const d = diagramOptions(truth, [same, other, other], 7)
    expect(d.options).toHaveLength(2)
    expect(d.options[d.answer]!.transform).toBeNull()
    expect(diagramOptions(truth, [other], 7).answer).toBe(diagramOptions(truth, [other], 7).answer)
  })
})

/* ------------------------------- grading ------------------------------- */

describe('grading, the pure parts', () => {
  it('normalises trailing space and the final newline, and nothing else', () => {
    expect(normalise('9 4  \n\n')).toBe('9 4')
    expect(normalise(' 9 4')).toBe(' 9 4')
  })

  it('counts changed lines as a multiset, so a moved line is one change', () => {
    expect(changedLines('a = 1\nb = 2\n', 'b = 2\na = 1\n')).toBe(0)
    expect(changedLines('a = 1\nb = a\n', 'a = 1\nb = a[:]\n')).toBe(1)
  })
})

/* ------------------------------ the gate ------------------------------ */

const miss = (m: Mastery, id: string, at: number) => record(m, KEY.exercise(id), false, at)
const hit = (m: Mastery, id: string, at: number) => record(m, KEY.exercise(id), true, at)

describe('the checkpoint gate', () => {
  it('passes with all but one right first time', () => {
    expect(passMark(6)).toBe(5)
    expect(passed([true, true, true, true, true, false])).toBe(true)
    expect(passed([true, true, true, true, false, false])).toBe(false)
    expect(passed([true, true, true, true, true, null])).toBe(false)
  })

  it('owes a review of the missed questions’ go-back exercises, until each is done since', () => {
    let m: Mastery = {}
    m = miss(m, 'C1.3', 1000)
    expect(reviewItems(1, m)).toEqual(['1.3', '1.13'])
    expect(reviewOwed(1, m, false)).toBe(true)
    m = hit(m, '1.3', 2000)
    expect(reviewOwed(1, m, false)).toBe(true)
    m = hit(m, '1.13', 3000)
    expect(reviewOwed(1, m, false)).toBe(false)
  })

  it('owes nothing once the checkpoint is passed', () => {
    const m = miss({}, 'C1.3', 1000)
    expect(reviewOwed(1, m, true)).toBe(false)
  })

  it('resumes a set at its first unanswered item, or the start on a replay', () => {
    const ids = ['1.1', '1.2', '1.3']
    expect(resumeAt(ids, {})).toBe(0)
    expect(resumeAt(ids, hit({}, '1.1', 1))).toBe(1)
    expect(resumeAt(ids, hit(hit(hit({}, '1.1', 1), '1.2', 1), '1.3', 1))).toBe(0)
  })
})

/* ------------------------------ practice ------------------------------ */

describe('practice and variants', () => {
  it('makes the same program from the same seed, and a valid item from its id', () => {
    for (const f of FAMILIES) {
      const id = variantId(f.id, 12345)
      expect(variant(id)!.exercise.snippets[0]!.code).toBe(variant(id)!.exercise.snippets[0]!.code)
      expect(itemById(id)?.stage).toBe(f.stage)
      expect(playable(id).snippets).toHaveLength(1)
      expect(itemById(f.from), f.id).toBeDefined()
    }
  })

  it('fills a stage’s practice with variants, and puts a missed exercise first', () => {
    const fresh = practiceItems(2, {}, 0, 1)
    expect(fresh).toHaveLength(5)
    expect(fresh.every((id) => id.startsWith('v:'))).toBe(true)
    const withMiss = practiceItems(2, miss({}, '2.2', 1), 2, 1)
    expect(withMiss[0]).toBe('2.2')
  })

  it('has a family for every stage with a practice node', () => {
    for (const s of STAGES) if (s.checkpoint) expect(FAMILIES.some((f) => f.stage === s.stage), `stage ${s.stage}`).toBe(true)
  })
})

describe('the rest', () => {
  it('names a lens for every exercise', () => {
    for (const s of STAGES) for (const e of s.exercises) expect(lensesOf(e.id).length).toBeGreaterThan(0)
  })

  it('speaks plainly before Stage 6 and formally from it', () => {
    expect(taskLine('draw', 'plain')).toMatch(/names/)
    expect(taskLine('draw', 'formal')).toMatch(/bindings/)
    expect(verdictLine(false, 'object', ['1.3'])).toBe('Not quite: that’s an object-model mistake, and the key sends you back to 1.3.')
  })

  it('groups Stage 1 into three sets of five or six', () => {
    expect(setsOf(STAGES[0]!).map((s) => s.length)).toEqual([6, 5, 5])
  })
})

/* ------------------------------ the crow ------------------------------ */

/** Words as a reader hears them: markdown marks and code ticks are not words. */
const words = (line: string) => line.replace(/[*`]/g, '').split(/\s+/).filter((w) => /\w/.test(w)).length

/** Sentences as a reader hears them: code is not punctuation. */
const sentences = (line: string) => line.replace(/`[^`]*`/g, 'x').split(/[.!?]["”’]?(?=\s|$)/).filter((t) => /\w/.test(t)).length

/** Stage 6's "You've been saying *…*. The formal word is **…**." is the
 *  one two-sentence line (docs/PEDAGOGY.md §6 gives it in those words). */
const youveBeenSaying = (line: string) => /^You’ve been saying \*.+\*\. The (formal word is|words are) \*\*/.test(line)

/** Each formal word, as the crow would say it. `block` is not here: the
 *  collection names it at Stage 5.1, and the crow says it from then on. */
const FORMAL = [/\bbindings?\b/i, /\biterables?\b/i, /\bloop variables?\b/i, /\bcontrol flow\b/i, /\bmutable\b/i, /\bimmutable\b/i, /\bhashable\b/i, /\barguments?\b/i, /\bparameters?\b/i]

describe('what the crow says (R2)', () => {
  const fixed = [
    ...TASK_LINES,
    CHECKPOINT_LINE,
    RULE_LINE,
    actLine('fix', null),
    actLine('write', null),
    actLine('fix', 'right'),
    actLine('write', 'wrong'),
    BRIDGE,
    STAGE_1_LEAD,
    ...STAGE_OPENERS,
    IDEAS_CLOSE,
    NOTHING_NAMED,
    raisedNote('NameError'),
  ]
  const done = [doneLine(4, 5, 'set'), doneLine(5, 6, 'checkpoint', true), doneLine(3, 6, 'checkpoint', false), doneLine(1, 1, 'review'), doneLine(6, 8, 'capstone'), doneLine(2, 5, 'practice')]

  it('keeps every fixed line to 20 words and 110 characters', () => {
    for (const l of [...fixed, ...done, verdictLine(true, null, []), verdictLine(false, null, [], true), verdictLine(false, 'object', ['1.3', '2.2'])]) {
      expect(words(l), l).toBeLessThanOrEqual(20)
      expect(l.length, l).toBeLessThanOrEqual(110)
      expect(sentences(l), l).toBe(1)
    }
    expect(actLine('fix', null)).toMatch(/^Now /)
    expect(ACT_LEAD.right + ACT_LINE.fix).toBe(actLine('fix', 'right'))
  })

  it('says one sentence a beat, the formal-word lines apart', () => {
    for (const s of STAGES)
      for (const b of ideaBeats(s)) {
        if (youveBeenSaying(b.say)) expect(sentences(b.say), b.say).toBe(2)
        else expect(sentences(b.say), `stage ${s.stage}: ${b.say}`).toBe(1)
      }
  })

  it('keeps every formal word out of the plain voice, and out of each beat before its own', () => {
    // Stages 1–5, the plain task lines, and what the crow says of memory.
    const plain = [...STAGES.slice(0, 5).flatMap((s) => ideaBeats(s).map((b) => b.say)), ...(['predict', 'compare', 'fix', 'order', 'table', 'block', 'draw', 'write', 'label', 'rule'] as const).map((f) => taskLine(f, 'plain'))]
    for (const l of plain) for (const w of FORMAL) expect(l, String(w)).not.toMatch(w)
    // At Stage 6 and 8, no beat before a word's own beat says it.
    for (const s of [STAGES[5]!, STAGES[7]!]) {
      const beats = ideaBeats(s)
      beats.forEach((b, i) => {
        if (!b.term) return
        const said = b.term.split(' · ').map((t) => new RegExp(`\\b${t.replace(/s$/, '')}s?\\b`, 'i'))
        for (const early of beats.slice(0, i)) for (const w of said) expect(early.say, `stage ${s.stage}, before ${b.term}`).not.toMatch(w)
      })
    }
  })

  it('holds Stage 8’s calling heading until both its words are named', () => {
    const s = STAGES[7]!
    const beats = ideaBeats(s)
    const title = s.ideas.find((i) => /argument/i.test(i.title))!.title
    const at = (term: string) => beats.findIndex((b) => b.term === term)
    expect(heldTitle(title, beats, readTo(beats, at('arguments') - 1).terms)).toBe(true)
    expect(heldTitle(title, beats, readTo(beats, at('arguments')).terms)).toBe(true)
    expect(heldTitle(title, beats, readTo(beats, at('parameters')).terms)).toBe(false)
    // The example is on the sheet before the words: shown, then named.
    const example = beats.findIndex((b) => b.at?.section === s.ideas.findIndex((i) => i.title === title) + 1)
    expect(example).toBeLessThan(at('arguments'))
    // A heading with no word still to come never waits.
    for (const i of s.ideas) if (i.title !== title) expect(heldTitle(i.title, beats, readTo(beats, beats.length - 1).terms), i.title).toBe(false)
  })

  it('bridges the console’s arrow to the text’s label at Stage 1', () => {
    expect(STAGE_1_LEAD).toMatch(/arrow/)
    expect(STAGE_1_LEAD).toMatch(/label/)
    const one = ideaBeats(STAGES[0]!).map((b) => b.say)
    expect(one.indexOf(STAGE_1_LEAD)).toBeLessThan(one.findIndex((l) => /label, not a box/.test(l)))
  })

  it('has one story line per stage, and the bridge said once, at Stage 1', () => {
    expect(STAGE_OPENERS).toHaveLength(STAGES.length)
    const said = STAGES.map((s) => ideaBeats(s).map((b) => b.say))
    expect(said[0]!.slice(0, 2)).toEqual([STAGE_OPENERS[0], BRIDGE])
    said.forEach((lines, k) => expect(lines[0], `stage ${k + 1}`).toBe(STAGE_OPENERS[k]))
    expect(said.flat().filter((l) => l === BRIDGE)).toHaveLength(1)
  })

  it('tells every stage’s ideas a block a beat, in order, and ends on the close', () => {
    for (const s of STAGES) {
      const beats = ideaBeats(s)
      for (const b of beats) {
        expect(b.say.length, b.say).toBeLessThanOrEqual(110)
        expect(words(b.say), b.say).toBeLessThanOrEqual(20)
      }
      // Every block of every section is reached, and the reach only grows.
      const reached = new Set(beats.filter((b) => b.at && b.at.row === undefined).map((b) => `${b.at!.section}:${b.at!.block}`))
      const blocks = [s.adds, ...s.ideas.map((i) => i.blocks), ...(s.capstone ? [s.capstone.intro] : [])]
      expect(blocks).toHaveLength(sectionsOf(s))
      blocks.forEach((bs, section) =>
        bs.forEach((b, block) => {
          if (b.kind === 'table' && s.stage === 6 && section === 1) return
          expect(reached.has(`${section}:${block}`), `stage ${s.stage} ${section}:${block}`).toBe(true)
        }),
      )
      const at = beats.filter((b) => b.at).map((b) => b.at!.section * 1000 + b.at!.block)
      expect([...at].sort((x, y) => x - y)).toEqual(at)
      expect(beats[beats.length - 1]!.end).toBe(true)
      expect(readTo(beats, beats.length - 1).end).toBe(true)
    }
  })

  it('earns the formal words at Stage 6, one labelled beat each, and the call’s two at Stage 8', () => {
    const six = ideaBeats(STAGES[5]!)
    const named = six.filter((b) => b.term)
    for (const t of ['binding', 'iterable', 'loop variable', 'control flow']) {
      const b = named.find((x) => x.term === t)
      expect(b, t).toBeDefined()
      expect(b!.say).toMatch(/^You’ve been saying \*[^*]+\*\./)
      expect(b!.say).toContain(`**${t}**`)
    }
    expect(six.find((b) => b.term === 'binding')!.say).toBe('You’ve been saying *a name pointing at an object*. The formal word is **binding**.')
    // `block` is on the table too, and is not new: the crow says so.
    const block = named.find((x) => x.term === 'block')!
    expect(block.say).not.toMatch(/You’ve been saying/)
    expect(block.say).toMatch(/Stage 5/)
    // A word is a label from its beat on, and not before.
    const i = six.findIndex((b) => b.term === 'iterable')
    expect(readTo(six, i - 1).terms).not.toContain('iterable')
    expect(readTo(six, i).terms).toContain('iterable')
    expect(readTo(six, six.length - 1).terms).toContain('binding')
    // No formal word is named before Stage 6.
    for (const s of STAGES.slice(0, 5)) expect(ideaBeats(s).some((b) => b.term), `stage ${s.stage}`).toBe(false)
    const eight = ideaBeats(STAGES[7]!).filter((b) => b.term).map((b) => b.term)
    expect(eight).toEqual(['arguments', 'parameters'])
  })
})

describe('what changed in memory, as the crow points at it', () => {
  it('names a new name, and a moved one', () => {
    const one = snap([['x', 'v:int:7']], [int(7)])
    expect(memoryNote(EMPTY, one, 'plain')).toBe('Look at memory: `x` points at `7`.')
    expect(memoryNote(EMPTY, one, 'formal')).toBe('Look at memory: `x` is bound to `7`.')
    const moved = snap([['x', 'v:int:8']], [int(8)])
    expect(memoryNote(one, moved, 'plain')).toBe('Look at memory: `x` has moved to `8`.')
  })

  it('points at a list changed in place before anything else', () => {
    const before = snap([['a', 'o:1'], ['b', 'o:1']], [list('o:1', ['v:int:1']), int(1)])
    const after = snap([['a', 'o:1'], ['b', 'o:1']], [list('o:1', ['v:int:1', 'v:int:2']), int(1), int(2)])
    expect(memoryNote(before, after, 'plain')).toMatch(/list `a` points at has changed, and no name moved/)
  })

  it('says two names share a list, and never says so of a value (R8, invariant 4)', () => {
    const one = snap([['a', 'o:1']], [list('o:1', [])])
    const two = snap([['a', 'o:1'], ['b', 'o:1']], [list('o:1', [])])
    expect(memoryNote(one, two, 'plain')).toBe('Look at memory: `a` and `b` point at one list, not two.')
    const x = snap([['x', 'v:int:7']], [int(7)])
    const xy = snap([['x', 'v:int:7'], ['y', 'v:int:7']], [int(7)])
    expect(memoryNote(x, xy, 'plain')).toBe('Look at memory: `y` points at `7`.')
  })

  it('walks back to the last difference, and says when nothing was named', () => {
    const s = [EMPTY, snap([['x', 'v:int:7']], [int(7)]), snap([['x', 'v:int:7']], [int(7)])]
    expect(noteAt((i) => s[i]!, 2, 'plain')).toBe('Look at memory: `x` points at `7`.')
    expect(noteAt(() => EMPTY, 3, 'plain')).toMatch(/names nothing/)
  })
})
