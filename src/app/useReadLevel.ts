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
import { ACT_LEAD, ACT_LINE, CHECKPOINT_LINE, doneLine, ideaBeats, RULE_LINE, taskLine, verdictLine, type IdeaBeat } from '../collection/voice'
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
      const form = item?.kind === 'exercise' ? item.exercise.kind : formOfParts(current.id)
      return taskLine(form, vocab)
    }
    const acting = current.spec.parts.findIndex((p, i) => (p.kind === 'fix' || p.kind === 'write') && !state.acts[i]?.result?.right)
    const marking = current.spec.parts.findIndex((p, i) => p.kind === 'rule' && !state.graded[i])
    const graded = state.graded.filter((g) => g !== null)
    const predictionsRight = graded.every((g) => g!.right || g!.soft)
    if (marking >= 0) return RULE_LINE
    if (acting >= 0) {
      const lead = graded.length ? (predictionsRight ? ACT_LEAD.right : ACT_LEAD.wrong) : ''
      const p = current.spec.parts[acting]!
      return lead + ACT_LINE[p.kind as 'fix' | 'write']
    }
    if (state.outcome) return verdictLine(state.outcome.right, state.outcome.err, session.goBack, state.outcome.soft)
    return undefined
  }, [didPass, doneKind, firstTime, ids.length, kind, level, session, start, vocab])

  // A stage's ideas are told, not asked: the crow's beats, one paragraph
  // a beat, derived from the stage alone (`voice.ideaBeats`).
  const ideas = useMemo((): IdeaBeat[] => (level?.kind === 'ideas' && stage ? ideaBeats(stage) : []), [level?.kind, stage])

  return { level, session, stage, vocab, guide, complete, didPass, ids, ideas }
}

/** A checkpoint question's form, from what it asks. */
function formOfParts(id: string) {
  const parts = specOf(id)?.parts ?? []
  if (parts.some((p) => p.kind === 'order')) return 'order' as const
  if (parts.some((p) => p.kind === 'diagram')) return 'draw' as const
  if (parts.some((p) => p.kind === 'fix')) return 'fix' as const
  if (parts.some((p) => p.kind === 'rule')) return 'rule' as const
  if (parts.some((p) => p.kind === 'block')) return 'block' as const
  return 'predict' as const
}
