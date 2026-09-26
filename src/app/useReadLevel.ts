/**
 * A reading level, played: which items, where to start, what the crow
 * says, and whether it is finished. An ideas level has no items: it is
 * the stage's reading, told in beats (`ideas`), and the workbench walks
 * them like a lesson's.
 *
 * The workbench owns the runs; the session (`collection/useReadSession`)
 * owns the answers; this decides what the level *is*. A set is its
 * exercises, resumed where it was left; a checkpoint is its questions and
 * a pass mark; a review is whatever a failed checkpoint pointed back to; a
 * practice is a fresh draw of missed items and variants. All of that is
 * read from mastery once, when the level opens, and then fixed — a
 * session's questions do not change under the player as they answer.
 */
import { useMemo, useState } from 'react'
import type { Activity } from '../../content/activities'
import { currentMastery } from '../mastery/mastery'
import { finishedLevels } from '../progress/progress'
import { itemById, specOf, STAGES, vocabularyOf } from '../collection'
import { passed, practiceItems, resumeAt, reviewItems } from '../collection/levels'
import { useReadSession, type ReadEnv } from '../collection/useReadSession'
import { actLine, CAPSTONE_OPENER, CHECKPOINT_LINE, doneLine, ideaBeats, reasonOf, RULE_LINE, taskLine, verdictLine, type IdeaBeat, type Task } from '../collection/voice'
import type { ReadLevel } from '../../content/activities/reading'

function idsFor(level: ReadLevel | undefined): string[] {
  if (!level || level.kind === 'ideas') return []
  const m = currentMastery()
  if (level.kind === 'review') return reviewItems(level.stage, m)
  if (level.kind === 'practice') return practiceItems(level.stage, m, Date.now(), Math.floor(Math.random() * 2 ** 31))
  return level.items
}

export function useReadLevel(activity: Activity, env: ReadEnv) {
  const level = activity.read
  const [ids] = useState(() => idsFor(level))
  const [start] = useState(() =>
    level && (level.kind === 'set' || level.kind === 'capstone') && !finishedLevels().has(activity.id) ? resumeAt(ids, currentMastery()) : 0,
  )
  const session = useReadSession(ids, env, start)
  const stage = level ? STAGES[level.stage - 1] : undefined
  const vocab = vocabularyOf(level?.stage ?? 1)

  const kind = level?.kind ?? 'set'
  const doneKind = kind === 'checkpoint' ? 'checkpoint' : kind === 'review' ? 'review' : kind === 'capstone' ? 'capstone' : kind === 'practice' ? 'practice' : 'set'
  const firstTime = session.results.filter((r) => r === true).length
  const didPass = kind === 'checkpoint' ? session.finished && passed(session.results) : undefined
  const complete = level?.kind !== 'ideas' && ids.length > 0 && session.finished && (kind !== 'checkpoint' || didPass === true)

  const guide = useMemo((): string | undefined => {
    if (!level || level.kind === 'ideas') return undefined
    if (ids.length === 0) return kind === 'review' ? 'Nothing to review — the checkpoint is open.' : 'Nothing to do here yet.'
    if (session.finished) return doneLine(firstTime, session.items.length, doneKind, didPass)
    const { current, state } = session
    if (!current || !state) return undefined
    const item = itemById(current.id)
    if (state.phase === 'answering') {
      if (kind === 'checkpoint' && session.at === start) return CHECKPOINT_LINE
      if (kind === 'capstone' && session.at === 0) return CAPSTONE_OPENER
      return taskLine(taskOf(current.id, item?.kind === 'exercise' ? item.exercise.kind : null, current.snippets.length > 0), vocab)
    }
    const acting = current.spec.parts.findIndex((p, i) => (p.kind === 'fix' || p.kind === 'write') && !state.acts[i]?.result?.right)
    const marking = current.spec.parts.findIndex((p, i) => p.kind === 'rule' && !state.graded[i])
    const graded = state.graded.filter((g) => g !== null)
    const predictionsRight = graded.every((g) => g!.right || g!.soft)
    if (marking >= 0) return RULE_LINE
    if (acting >= 0) {
      const lead = graded.length ? (predictionsRight ? 'right' : 'wrong') : null
      const p = current.spec.parts[acting]!
      return actLine(p.kind as 'fix' | 'write', lead, p.act)
    }
    if (state.outcome) {
      const reason = item?.kind === 'exercise' ? reasonOf(item.exercise.key.reasoning) : null
      return verdictLine(state.outcome.right, state.outcome.err, session.goBack, state.outcome.soft, vocab, reason)
    }
    return undefined
  }, [didPass, doneKind, firstTime, ids.length, kind, level, session, start, vocab])

  // A stage's ideas are told, not asked: the crow's beats, one paragraph
  // a beat, derived from the stage alone (`voice.ideaBeats`).
  const ideas = useMemo((): IdeaBeat[] => (level?.kind === 'ideas' && stage ? ideaBeats(stage) : []), [level?.kind, stage])

  return { level, session, stage, vocab, guide, complete, didPass, ids, ideas }
}

/**
 * What the crow asks for, from what the item asks. An exercise has its
 * form, except a "fix" with nothing to repair (9.C5 diagnoses and mends
 * nothing); a checkpoint question has only its parts, and a question of
 * counts, of choices alone, or with no code at all is none of the forms.
 */
export function taskOf(id: string, form: Task | null, code: boolean): Task {
  const parts = specOf(id)?.parts ?? []
  const has = (k: string) => parts.some((p) => p.kind === k)
  const only = (k: string) => parts.length > 0 && parts.every((p) => p.kind === k)
  if (form) return form === 'fix' && !has('fix') ? 'diagnose' : form
  if (has('order')) return 'order'
  if (has('diagram')) return 'draw'
  if (has('fix')) return 'fix'
  if (has('labels')) return 'label'
  if (has('rule')) return 'rule'
  if (has('block')) return 'block'
  if (!code) return has('write') ? 'nocode-write' : 'nocode'
  if (only('write')) return 'write'
  if (only('number')) return 'count'
  if (only('choice')) return 'choice'
  return 'predict'
}
