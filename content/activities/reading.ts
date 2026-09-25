/**
 * The Reading Python collection's levels, made from the collection itself.
 *
 * Each stage becomes a stretch of the map: its **Ideas**, three or four
 * **sets** of exercises in file order, a **practice** of fresh variants
 * and missed items, and the **checkpoint** that holds the gate. Stage 9
 * ends on the **capstone** instead. Nothing here is written per exercise —
 * the markdown says what the exercises are, the specs say how to grade
 * them, and this only says where they go.
 *
 * Two kinds of level are made on demand and are not on the path: a stage's
 * **review** (`s2-review`), which exists while a failed checkpoint is
 * sending you back, and a **single item** (`x-4.6`), which is where a "go
 * back to 4.6" link lands.
 */
import type { SceneSpec } from '../../src/scene/spec'
import { STAGES, capstoneOf, itemById, setsOf } from '../../src/collection'
import type { Activity } from './index'

export type ReadLevel =
  | { kind: 'ideas'; stage: number }
  | { kind: 'set'; stage: number; items: string[] }
  | { kind: 'practice'; stage: number }
  | { kind: 'checkpoint'; stage: number; items: string[] }
  | { kind: 'review'; stage: number }
  | { kind: 'capstone'; stage: number; items: string[] }
  | { kind: 'single'; stage: number; items: string[] }

/** The reading room: the crow and the robot, and room for the sheet. The
 *  floor stands a little high, so the strip under the cast is free for the
 *  beat bar and the way on (`read.css`): at 90, Continue stood on the
 *  robot's feet. */
export const readingScene = (id: string): SceneSpec => ({
  id,
  title: 'Reading room',
  floor: { at: 84 },
  actors: [
    { id: 'crow', kind: 'crow', x: 30, y: 0, w: 16, stand: true },
    { id: 'robot', kind: 'robot', x: 80, y: 0, w: 14, stand: true },
  ],
  watches: [],
})

const OPTIONS = { max_steps: 5000, wall_clock_s: 20 }

const range = (ids: string[]) => (ids.length > 1 ? `${ids[0]}–${ids[ids.length - 1]}` : (ids[0] ?? ''))

const FORM_WORD: Record<string, string> = {
  label: 'labelling',
  block: 'blocks',
  order: 'execution order',
  table: 'a trace table',
  draw: 'drawing memory',
  predict: 'predicting',
  compare: 'near-matches',
  fix: 'fixing',
  write: 'writing',
  rule: 'rules',
}

function read(id: string, title: string, brief: string, level: ReadLevel): Activity {
  return { id, title, brief, mode: 'read', read: level, starter: '', options: OPTIONS, scene: readingScene(id) }
}

/** The ids of a stage's levels, in play order. The warm-up's console
 *  lessons open Stage 1, which is where they have always belonged. */
export function stageLevelIds(n: number): string[] {
  const stage = STAGES[n - 1]!
  const sets = setsOf(stage).map((_, k) => `s${n}-set-${k + 1}`)
  if (n === 1) return ['names', 'order', 'practice-remembering', 's1-ideas', 'wake', ...sets, 's1-practice', 's1-checkpoint']
  if (stage.capstone) return [`s${n}-ideas`, ...sets, `s${n}-capstone`]
  return [`s${n}-ideas`, ...sets, `s${n}-practice`, `s${n}-checkpoint`]
}

function stageActivities(n: number): Activity[] {
  const stage = STAGES[n - 1]!
  const out: Activity[] = []
  // Stage 1's ideas are a console lesson (content/lessons/s1ideas.ts),
  // defined with the other console activities; the rest still read.
  if (n !== 1) out.push(
    read(
      `s${n}-ideas`,
      stage.capstone ? 'How to read a long program' : 'The ideas',
      stage.move ? stage.move.replace(/\.$/, '.') : 'The ideas, in plain language.',
      { kind: 'ideas', stage: n },
    ),
  )
  setsOf(stage).forEach((set, k) => {
    const ids = set.map((e) => e.id)
    const forms = [...new Set(set.map((e) => FORM_WORD[e.kind] ?? e.kind))]
    out.push(
      read(`s${n}-set-${k + 1}`, `Exercises ${range(ids)}`, `${set.length} exercises: ${forms.slice(0, 4).join(', ')}.`, {
        kind: 'set',
        stage: n,
        items: ids,
      }),
    )
  })
  if (stage.checkpoint) {
    out.push(
      read(`s${n}-practice`, 'Practice', 'Fresh versions of this stage’s exercises, and any you missed, weighted towards what you know least.', {
        kind: 'practice',
        stage: n,
      }),
    )
    out.push(
      read(
        `s${n}-checkpoint`,
        `Checkpoint ${n}`,
        `${stage.checkpoint.items.length} questions, nothing new. Get ${stage.checkpoint.items.length - 1} right first time to earn the stage.`,
        { kind: 'checkpoint', stage: n, items: stage.checkpoint.items.map((q) => q.id) },
      ),
    )
  }
  if (stage.capstone) {
    out.push(
      read(`s${n}-capstone`, 'The Capstone', 'One realistic program with three defects: mark it, trace it, draw it, predict it, diagnose it, repair it.', {
        kind: 'capstone',
        stage: n,
        items: capstoneOf(stage).map((e) => e.id),
      }),
    )
  }
  return out
}

/** Every reading level on the path, with `next` linking them in order.
 *  Stage 1's first levels are the warm-up activities, linked there. */
export function readingActivities(): Activity[] {
  const all = STAGES.flatMap((s) => stageActivities(s.stage))
  const byId = new Map(all.map((a) => [a.id, a]))
  const order = STAGES.flatMap((s) => stageLevelIds(s.stage))
  order.forEach((id, i) => {
    const a = byId.get(id)
    const next = order[i + 1]
    if (a && next) a.next = next
  })
  return all
}

/** A stage's review, made while one is owed. */
export const reviewActivity = (n: number): Activity =>
  read(`s${n}-review`, `Review for Checkpoint ${n}`, 'The exercises the checkpoint pointed you back to. Then the checkpoint opens again.', {
    kind: 'review',
    stage: n,
  })

/** One item on its own, where a "go back to" link lands. */
export function singleActivity(id: string): Activity | null {
  const item = itemById(id)
  if (!item) return null
  return read(`x-${id}`, `Exercise ${id}`, 'One exercise, on its own.', { kind: 'single', stage: item.stage, items: [id] })
}
