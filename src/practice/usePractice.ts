/**
 * Running a practice session inside the workbench.
 *
 * The workbench owns the console and the runs; this owns the session: which
 * exercise is up, how many misses it has had, and what the guide says. Each
 * line the player types arrives as an `Attempt`, is judged, and — if it is
 * the exercise's first judged try — recorded against the skill's mastery.
 *
 * Unlike a lesson, a session *is* state: the questions were drawn at random
 * and the order is the session's own. None of it is stored. Leave and come
 * back and it is a new session with new questions; what persists is only
 * mastery, which is the point of having practised.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { recordTry, currentMastery } from '../mastery/mastery'
import type { Attempt, Exercise } from './exercises'
import { planSession } from './session'

export type PracticeGuide = { text: string }

export type PracticeMeter = { at: number; of: number; results: (boolean | null)[]; task: string | null }

export type PracticeState = {
  /** What the guide says now. */
  guide: PracticeGuide
  /** Every exercise answered. */
  done: boolean
  /** For the meter: how far through, which were right first time, and the
   *  question being asked — kept on screen while the guide talks about the
   *  answer, so a hint never costs the player the question. */
  meter: PracticeMeter
  /** The exercise being asked, or null once done. */
  current: Exercise | null
  /** Judges a line the player typed. */
  onAttempt: (a: Attempt) => void
}

const PRAISE = ['Right!', 'Spot on.', 'That is it.', 'Nicely done.', 'Exactly.', 'Yes!']

/** Long enough to read what was said, and not so long it drags. */
const readingTime = (text: string) => Math.min(3600, 900 + text.length * 38)

export function usePractice(
  pool: string[] | null,
  restart: (setup: string[]) => Promise<void>,
  ready: boolean,
): PracticeState | null {
  const [exercises] = useState<Exercise[]>(() =>
    pool ? planSession(pool, currentMastery(), Date.now(), Math.floor(Math.random() * 2 ** 31)) : [],
  )
  const [at, setAt] = useState(0)
  const [misses, setMisses] = useState(0)
  const [results, setResults] = useState<(boolean | null)[]>(() => exercises.map(() => null))
  const [feedback, setFeedback] = useState<{ kind: 'wrong' | 'right'; text: string } | null>(null)
  const started = useRef(-1)
  const timer = useRef<number | null>(null)

  const current = exercises[at] ?? null

  // Each exercise starts on a clean memory, with its setup already run.
  useEffect(() => {
    if (!pool || !ready || !current || started.current === at) return
    started.current = at
    void restart(current.setup)
  }, [pool, ready, current, at, restart])

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  const onAttempt = useCallback(
    (a: Attempt) => {
      if (!current || feedback?.kind === 'right') return
      const { verdict, why } = current.judge(a)
      if (verdict === 'ignore') return

      const first = results[at] === null && misses === 0
      if (first) {
        recordTry(current.skill, verdict === 'correct')
        setResults((rs) => rs.map((r, i) => (i === at ? verdict === 'correct' : r)))
      }

      if (verdict === 'correct') {
        const praise = `${PRAISE[at % PRAISE.length]}${current.praise ? ` ${current.praise}` : ''}`
        setFeedback({ kind: 'right', text: praise })
        timer.current = window.setTimeout(() => {
          timer.current = null
          setFeedback(null)
          setMisses(0)
          setAt((i) => i + 1)
        }, readingTime(praise))
        return
      }

      const n = misses + 1
      setMisses(n)
      const reveal = n >= 2 ? ` One way: \`${current.answer}\`` : ' Try again.'
      setFeedback({ kind: 'wrong', text: `Not quite. ${why ?? ''}${reveal}`.replace(/\s+/g, ' ').trim() })
    },
    [at, current, feedback, misses, results],
  )

  if (!pool) return null

  const done = at >= exercises.length
  const firstTime = results.filter((r) => r === true).length
  const text = done
    ? `Practice done — ${firstTime} of ${exercises.length} right first time. Each one counts towards your skills.`
    : feedback
      ? feedback.text
      : current!.say

  return {
    guide: { text },
    done,
    meter: { at: Math.min(at, exercises.length), of: exercises.length, results, task: done ? null : current!.say },
    current: done ? null : current,
    onAttempt,
  }
}
