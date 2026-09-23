/**
 * The collection, joined up: generated content plus hand-written specs.
 *
 * Everything else asks here — for a stage, an item, the snippets an item
 * is about, which misconceptions it attacks and which lenses it uses —
 * so the joining is done once and the rules for it are written once.
 */
import stage1 from '../../content/collection/generated/stage-01.json'
import stage2 from '../../content/collection/generated/stage-02.json'
import stage3 from '../../content/collection/generated/stage-03.json'
import stage4 from '../../content/collection/generated/stage-04.json'
import stage5 from '../../content/collection/generated/stage-05.json'
import stage6 from '../../content/collection/generated/stage-06.json'
import stage7 from '../../content/collection/generated/stage-07.json'
import stage8 from '../../content/collection/generated/stage-08.json'
import stage9 from '../../content/collection/generated/stage-09.json'
import glossaryJson from '../../content/collection/generated/glossary.json'
import misconceptionsJson from '../../content/collection/generated/misconceptions.json'
import { SPECS } from '../../content/collection/specs'
import type { CheckpointItem, ErrorType, Exercise, Glossary, Lens, Misconception, Snippet, Spec, Stage } from './model'
import type { Playable } from './runner'
import { variant } from './variants'

export const STAGES: Stage[] = [stage1, stage2, stage3, stage4, stage5, stage6, stage7, stage8, stage9] as unknown as Stage[]
export const GLOSSARY = glossaryJson as unknown as Glossary
export const MISCONCEPTIONS = misconceptionsJson as unknown as Misconception[]

export const stageOf = (n: number): Stage => STAGES[n - 1]!

/** An exercise or a checkpoint question — both are played the same way. */
export type Item =
  | { kind: 'exercise'; id: string; stage: number; exercise: Exercise }
  | { kind: 'checkpoint'; id: string; stage: number; question: CheckpointItem }

export const ITEMS: Item[] = STAGES.flatMap((s) => [
  ...s.exercises.map((exercise): Item => ({ kind: 'exercise', id: exercise.id, stage: s.stage, exercise })),
  ...(s.checkpoint?.items ?? []).map((question): Item => ({ kind: 'checkpoint', id: question.id, stage: s.stage, question })),
])

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]))

/** An item by id. A variant (`v:<family>:<seed>`) is made from its id,
 *  so it needs no registry and a session can name one. */
export function itemById(id: string): Item | undefined {
  const hit = BY_ID.get(id)
  if (hit) return hit
  const v = variant(id)
  return v ? { kind: 'exercise', id, stage: v.exercise.stage, exercise: v.exercise } : undefined
}

export const specOf = (id: string): Spec | undefined => SPECS[id] ?? variant(id)?.spec

/** The item's own snippets, or what its spec borrows or supplies. A
 *  snippet borrowed from another exercise is labelled with that exercise's
 *  id when there are several, so "line 3 in 2.2" has a tab to point at. */
export function snippetsOf(id: string): Snippet[] {
  const item = itemById(id)
  const spec = specOf(id)
  if (spec?.code) return spec.code.map((code, i) => ({ label: spec.code!.length > 1 ? String.fromCharCode(65 + i) : null, code }))
  if (spec?.from) {
    const borrowed = spec.from.flatMap((src) => snippetsOf(src).map((s) => ({ ...s, source: src })))
    return borrowed.map(({ source, ...s }) => ({
      ...s,
      label: spec.from!.length > 1 ? (s.label ? `${source} ${s.label}` : source) : s.label,
    }))
  }
  if (!item) return []
  return item.kind === 'exercise' ? item.exercise.snippets : item.question.snippets
}

/** What the page plays. Throws for an item with no spec, which the
 *  coverage test turns into a failure long before a player sees it. */
export function playable(id: string): Playable {
  const spec = specOf(id)
  if (!spec) throw new Error(`no grading spec for ${id}`)
  return { id, spec, snippets: snippetsOf(id) }
}

/** The error types the key names, in its order. */
export const errorTypesOf = (item: Item): ErrorType[] =>
  item.kind === 'exercise' ? item.exercise.key.errorTypes : item.question.errorTypes

/** Where the key sends you if you missed it. */
export const goBackOf = (item: Item): string[] =>
  (item.kind === 'exercise' ? item.exercise.key.goBack : item.question.goBack).filter((id) => BY_ID.has(id))

export const isVariant = (id: string): boolean => id.startsWith('v:')

/** Misconceptions an item attacks: the conventions table's, and any its
 *  spec adds. */
export function misconceptionsOf(id: string): string[] {
  const table = MISCONCEPTIONS.filter((m) => m.exercises.includes(id)).map((m) => m.id)
  return [...new Set([...table, ...(SPECS[id]?.mis ?? [])])]
}

/** A lens is exercised unless the authoring record says there is nothing
 *  to see through it ("n/a", "identical", "once each"). */
const INERT = /^(n\/a|none|identical|same|once each|once, each|one pass)\b/i

export function lensesOf(id: string): Lens[] {
  const spec = specOf(id)
  if (spec?.lenses) return spec.lenses
  const item = itemById(id)
  const record = item?.kind === 'exercise' ? item.exercise.key.authoring : null
  if (!record) return ['object']
  return (['syntax', 'flow', 'object'] as const).filter((l) => record[l] && !INERT.test(record[l]))
}

/**
 * A stage's exercises, grouped in file order into sets of about five —
 * three or four per stage, so a sitting is a set rather than a stage.
 * The capstone's items are their own node, not a set.
 */
export function setsOf(stage: Stage): Exercise[][] {
  const ex = stage.exercises.filter((e) => !e.id.includes('C'))
  const count = Math.max(2, Math.min(4, Math.round(ex.length / 5.5)))
  const out: Exercise[][] = []
  let at = 0
  for (let i = 0; i < count; i++) {
    const size = Math.ceil((ex.length - at) / (count - i))
    out.push(ex.slice(at, at + size))
    at += size
  }
  return out
}

/** The capstone's items, in order. */
export const capstoneOf = (stage: Stage): Exercise[] => stage.exercises.filter((e) => e.id.includes('C'))

/** Formal words from Stage 6 on; plain phrases before (README §7). */
export const vocabularyOf = (stage: number): 'plain' | 'formal' => (stage >= 6 ? 'formal' : 'plain')
