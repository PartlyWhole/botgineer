/**
 * Playing a sequence of reading items: a set, a checkpoint, a review.
 *
 * For each item, three moves, in this order and no other:
 *
 *   1. **answer**   fill in every prediction — the output, the order, the
 *                   picture. Nothing has run; memory is empty.
 *   2. **commit**   the predictions lock, *then* the snippets run, and
 *                   every prediction is graded against the run. The key
 *                   opens. ("Write the prediction down before checking.")
 *   3. **act**      repairs and programs are written and sent to the
 *                   robot until they pass; rules are marked against the
 *                   key.
 *
 * Only first tries count: the commit, each repair's first submission, each
 * rule's mark. When all of an item's first tries are in, they are recorded
 * against mastery once — the item, its concepts, the misconceptions it
 * attacks, its lenses and, for a miss, the kind of mistake. The session
 * itself is React state and is never stored (invariant 19): what persists
 * is mastery, and which levels are finished.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KEY, recordAll } from '../mastery/mastery'
import { errorTypesOf, goBackOf, itemById, lensesOf, misconceptionsOf, playable } from './index'
import { gradePart, type Truth } from './grade'
import type { Answer, ErrorType, Graded, Part } from './model'
import { isPrediction, originalOf, prepare, runProgram, type Evaluate, type Playable } from './runner'

export type Phase = 'answering' | 'revealed'

export type ActState = { source: string; tries: number; result: Graded | null; busy: boolean; first: boolean | null }

export type ItemState = {
  answers: (Answer | null)[]
  graded: (Graded | null)[]
  truth: Truth | null
  phase: Phase
  /** Per part: repairs and programs. */
  acts: (ActState | null)[]
  /** The first-try outcome, once every part has one. */
  outcome: { right: boolean; soft: boolean; err: ErrorType | null } | null
}

export type ReadEnv = {
  evaluate: Evaluate
  /** Shows a run in the workbench — memory, the scrubber, the output. */
  show: (source: string) => Promise<void>
  ready: boolean
}

const blank = (p: Playable): ItemState => ({
  answers: p.spec.parts.map(() => null),
  graded: p.spec.parts.map(() => null),
  truth: null,
  phase: 'answering',
  acts: p.spec.parts.map((part) =>
    part.kind === 'fix' || part.kind === 'write'
      ? { source: part.kind === 'fix' ? originalOf(p, part) : (part.starter ?? ''), tries: 0, result: null, busy: false, first: null }
      : null,
  ),
  outcome: null,
})

/** Whether a prediction has been given: what "Commit" waits for. */
export function answered(part: Part, a: Answer | null): boolean {
  if (!a) return false
  switch (a.kind) {
    case 'output':
      return a.text.trim() !== '' || a.raises !== null
    case 'choice':
      return a.picked.length > 0
    case 'number':
      return a.value !== null
    case 'line':
      return a.line !== null
    case 'order':
      return a.lines.length > 0
    case 'table':
      return a.cells.some((r) => r.some((c) => c.trim() !== ''))
    case 'block':
      return a.body.length > 0
    case 'diagram':
      return a.picked !== null
    case 'labels':
      return part.kind === 'labels' && a.roles.length === part.spans.length && a.roles.every((r) => r !== null)
    case 'rule':
      return a.text.trim() !== ''
    default:
      return true
  }
}

export function useReadSession(ids: string[], env: ReadEnv, start = 0) {
  const items = useMemo(() => ids.map((id) => playable(id)), [ids])
  const [at, setAt] = useState(() => Math.min(start, Math.max(0, ids.length - 1)))
  const [states, setStates] = useState<ItemState[]>(() => items.map(blank))
  const recorded = useRef(new Set<number>())
  const envRef = useRef(env)
  envRef.current = env

  const current = items[at]
  const state = states[at]

  const patch = useCallback(
    (i: number, fn: (s: ItemState) => ItemState) => setStates((ss) => ss.map((s, k) => (k === i ? fn(s) : s))),
    [],
  )

  const setAnswer = useCallback(
    (part: number, answer: Answer) =>
      patch(at, (s) => {
        // A committed prediction is locked. Rules stay editable only in
        // their mark, which is set through `mark`.
        if (s.phase !== 'answering') return s
        const answers = [...s.answers]
        answers[part] = answer
        return { ...s, answers }
      }),
    [at, patch],
  )

  const predictions = current ? current.spec.parts.map((p, i) => ({ p, i })).filter(({ p }) => isPrediction(p)) : []
  const canCommit =
    !!state && state.phase === 'answering' && env.ready && state.truth !== null && predictions.every(({ p, i }) => answered(p, state.answers[i] ?? null))

  // Each item is run quietly as soon as it is up, so the pictures of a
  // "draw" part can be offered before anything is committed. Nothing of
  // the run is *shown* until the commit: memory stays empty, the scrubber
  // has nothing on it, and the output is not printed — which is what
  // "commit before running" means to the player.
  const preparing = useRef(new Set<number>())
  useEffect(() => {
    if (!current || !state || state.truth || !env.ready || preparing.current.has(at)) return
    preparing.current.add(at)
    const i = at
    void prepare(current, envRef.current.evaluate).then((truth) => patch(i, (s) => ({ ...s, truth })))
  }, [at, current, env.ready, patch, state])

  /** Locks the predictions and grades them against the run. */
  const commit = useCallback(async () => {
    if (!current || !state || state.phase !== 'answering' || !canCommit || !state.truth) return
    const i = at
    const truth = state.truth
    const graded = current.spec.parts.map((p, index) => {
      if (!isPrediction(p) || p.kind === 'rule') return null
      const a = state.answers[index]
      return a ? gradePart(p, a, truth, { index }) : { right: false }
    })
    patch(i, (s) => ({ ...s, graded, phase: 'revealed' }))
    if (current.snippets[0]) await envRef.current.show(current.snippets[0].code)
  }, [at, canCommit, current, patch, state])

  /** Sends a repair or a program to the robot, and checks it. */
  const submit = useCallback(
    async (part: number, source: string) => {
      const p = current?.spec.parts[part]
      if (!current || !state || state.phase !== 'revealed' || !p || (p.kind !== 'fix' && p.kind !== 'write')) return
      const i = at
      patch(i, (s) => ({ ...s, acts: s.acts.map((a, k) => (k === part && a ? { ...a, source, busy: true } : a)) }))
      await envRef.current.show(source)
      const program = await runProgram(p, source, envRef.current.evaluate, current.spec.options)
      const result = gradePart(p, { kind: p.kind, source }, { ...state.truth!, program }, {
        index: part,
        ...(p.kind === 'fix' ? { original: originalOf(current, p) } : {}),
      })
      patch(i, (s) => ({
        ...s,
        acts: s.acts.map((a, k) =>
          k === part && a ? { ...a, source, busy: false, tries: a.tries + 1, result, first: a.first ?? result.right } : a,
        ),
      }))
    },
    [at, current, patch, state],
  )

  /** Gives up on a repair: shows the key's, which counts as not first time. */
  const reveal = useCallback(
    (part: number) => {
      const p = current?.spec.parts[part]
      if (!p || (p.kind !== 'fix' && p.kind !== 'write')) return
      patch(at, (s) => ({
        ...s,
        acts: s.acts.map((a, k) =>
          k === part && a ? { ...a, source: p.model, result: { right: true, note: 'This is the key’s version.' }, first: a.first ?? false } : a,
        ),
      }))
    },
    [at, current, patch],
  )

  /** The self-mark for a rule, against the key. Once. */
  const mark = useCallback(
    (part: number, value: 'right' | 'word' | 'missed') => {
      const p = current?.spec.parts[part]
      if (!p || p.kind !== 'rule') return
      patch(at, (s) => {
        if (s.phase !== 'revealed' || s.graded[part]) return s
        const prev = s.answers[part]
        const answer: Answer = { kind: 'rule', text: prev?.kind === 'rule' ? prev.text : '', mark: value }
        const graded = [...s.graded]
        graded[part] = gradePart(p, answer, s.truth!, { index: part })
        const answers = [...s.answers]
        answers[part] = answer
        return { ...s, answers, graded }
      })
    },
    [at, current, patch],
  )

  // Once every part has a first try, the item's outcome is known: record
  // it, once.
  useEffect(() => {
    if (!current || !state || state.phase !== 'revealed' || state.outcome) return
    const parts = current.spec.parts
    const firsts: { right: boolean; soft: boolean; err: ErrorType }[] = []
    const item = itemById(current.id)
    const keyErrs = item ? errorTypesOf(item) : []
    for (const [k, p] of parts.entries()) {
      const g = state.graded[k]
      const act = state.acts[k]
      const err = g?.err ?? p.err ?? keyErrs[0] ?? 'object'
      if (p.kind === 'fix' || p.kind === 'write') {
        if (act?.first === null || act?.first === undefined) return
        firsts.push({ right: act.first, soft: false, err })
      } else {
        if (!g) return
        firsts.push({ right: g.right, soft: g.soft === true, err })
      }
    }
    const right = firsts.every((f) => f.right || f.soft)
    const soft = right && firsts.some((f) => f.soft)
    const miss = firsts.find((f) => !f.right)
    const outcome = { right, soft, err: miss ? miss.err : null }
    patch(at, (s) => ({ ...s, outcome }))

    if (recorded.current.has(at)) return
    recorded.current.add(at)
    const entries: [string, boolean][] = [[KEY.exercise(current.id), right]]
    for (const c of current.spec.concepts) entries.push([c, right])
    for (const m of misconceptionsOf(current.id)) entries.push([KEY.misconception(m), right])
    for (const l of lensesOf(current.id)) entries.push([KEY.lens(l), right])
    for (const e of new Set(firsts.filter((f) => !f.right).map((f) => f.err))) entries.push([KEY.error(e), false])
    recordAll(entries)
  }, [at, current, patch, state])

  const resolved =
    !!state &&
    state.phase === 'revealed' &&
    current!.spec.parts.every((p, k) =>
      p.kind === 'fix' || p.kind === 'write' ? state.acts[k]?.result?.right === true : p.kind === 'rule' ? state.graded[k] !== null : true,
    )

  const next = useCallback(() => setAt((i) => Math.min(i + 1, items.length)), [items.length])

  const results = states.map((s) => (s.outcome ? s.outcome.right : null))
  const finished = at >= items.length

  return {
    items,
    at,
    current: finished ? null : current!,
    state: finished ? null : state!,
    results,
    finished,
    canCommit,
    resolved,
    goBack: current ? goBackOf(itemById(current.id)!) : [],
    setAnswer,
    commit,
    submit,
    reveal,
    mark,
    next,
  }
}

export type ReadSession = ReturnType<typeof useReadSession>
