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
 *
 * ## How it talks
 *
 * The same way a lesson does (docs/PEDAGOGY.md §4): a script of short
 * beats the player advances with Next, ending on the question, which wears
 * a pill saying who does the work. The workbench tells it and holds the
 * index into it, keyed on `meter.at`, so a new exercise starts at its
 * first line. Exercise `at`'s script is
 *
 *   [praise of the one before] + [who works, if that changed] + lead + ask
 *
 * which is a lesson step's shape. A right answer moves `at` on at once, so
 * the praise is the first beat of the next exercise's script: it is read
 * for as long as the player likes, and Next is what moves on — nothing is
 * timed. A miss replaces the ask with the reason, in the same place, and
 * the second miss adds a line that works.
 *
 * The answered picture stays on stage as the *leaving* one, with its tick,
 * while the next question's picture waits its turn — the right answer's
 * effect plays on the element that asked, as in a lesson. Once the session
 * is done the shelf from the first level stands there, every right answer
 * filed by its data type.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { recordTry, currentMastery } from '../mastery/mastery'
import type { Attempt, Exercise, Worker } from './exercises'
import { planSession } from './session'
import type { Thought } from '../memory/extract'
import { NO_STAGING, SLOTS, type PropView, type Staging } from '../scene/props'
import type { ScriptItem } from '../../content/lessons'

export type PracticeGuide = { text: string; script: ScriptItem[] }

export type PracticeMeter = { at: number; of: number; results: (boolean | null)[]; task: string | null }

export type PracticeState = {
  /** What the guide says: the question (or the closing line), and the
   *  whole script that leads to it. */
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
  /**
   * The exercise's picture, with the last answer drawn into it, and the
   * one just answered leaving with its tick. Once the session is done,
   * the shelf, with every right answer on it.
   */
  staging: Staging
  /**
   * The picture at a given line of the script, the way a lesson's
   * `staging(lesson, e, beat)` is: while the praise is read, the picture
   * just answered stays on the stage with its tick and no question under
   * it; from the next line on, it leaves and this exercise's arrives.
   */
  stagingAt: (beat: number) => Staging
}

const PRAISE = ['Right!', 'Spot on.', 'That’s it.', 'Nicely done.', 'Exactly.', 'Yes!']

/** The session's first line: what it is, and where to look to know whose
 *  turn it is. */
export const OPENING = 'Fresh questions, and each one says who does the work.'

/** Said before a question whose worker is not the last one's (R4). */
export const WHO_WORKS: Record<Worker, string> = {
  you: 'This one is yours: work the answer out in your head, and type it.',
  robot: 'This one is the robot’s: don’t type the answer, give it the working.',
}

/** What the crow says when a right answer is in: a word, then the reason. */
export const praiseOf = (ex: Exercise, at: number) => `${PRAISE[at % PRAISE.length]} ${ex.praise}`

/** The line for a miss: the reason, and after two, a line that works. */
export const replyOf = (ex: Exercise, why: string | undefined, misses: number) =>
  `${why ?? 'Not quite. Try again.'}${misses >= 2 ? ` One way: \`${ex.answer}\`` : ''}`

/** The closing line, which the session comes to rest on. */
export const closingOf = (right: number, of: number) =>
  `That’s practice: ${right} of ${of} right first time, and every first try counts towards your skills.`

/** Said once the session is over, when the shelf is on the stage. */
export const SHELVED = 'Every right answer is on the shelf, beside its data type.'

/**
 * The script for exercise `at` (or the close, once `at` is past the end).
 * Pure, so a unit test can read what a session says without React.
 */
export function scriptOf(
  exercises: Exercise[],
  at: number,
  reply: string | null,
  close?: { right: number; shelf: boolean },
): ScriptItem[] {
  const items: ScriptItem[] = []
  const prev = exercises[at - 1]
  if (prev) items.push({ kind: 'praise', asking: false, text: praiseOf(prev, at - 1) })
  const ex = exercises[at]
  if (!ex) {
    if (close?.shelf) items.push({ kind: 'outro', asking: false, text: SHELVED })
    items.push({ kind: 'outro', asking: false, text: closingOf(close?.right ?? 0, exercises.length) })
    return items
  }
  if (at === 0) items.push({ kind: 'beat', asking: false, text: OPENING })
  if (!prev || prev.tag !== ex.tag) items.push({ kind: 'beat', asking: false, text: ex.who ?? WHO_WORKS[ex.tag] })
  for (const text of ex.lead ?? []) items.push({ kind: 'beat', asking: false, text })
  items.push({ kind: reply === null ? 'ask' : 'reply', asking: true, text: reply ?? ex.say, tag: ex.tag })
  return items
}

type Answered = PropView & { key: string }

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
  /** The answer to the last miss, which stands in for the question. */
  const [reply, setReply] = useState<string | null>(null)
  /** What the robot made of the last line judged for this exercise. */
  const [said, setSaid] = useState<Thought | null>(null)
  /** Every right answer this session, for the shelf at the end. */
  const [rights, setRights] = useState<Thought[]>([])
  /** The picture just answered, with its answer and its tick: on its way
   *  out while the praise is read. */
  const [answered, setAnswered] = useState<Answered | null>(null)
  const started = useRef(-1)

  const current = exercises[at] ?? null

  // Each exercise starts on a clean memory, with its setup already run.
  useEffect(() => {
    if (!pool || !ready || !current || started.current === at) return
    started.current = at
    void restart(current.setup)
  }, [pool, ready, current, at, restart])

  const onAttempt = useCallback(
    (a: Attempt) => {
      if (!current) return
      const { verdict, why } = current.judge(a)
      if (verdict === 'ignore') return
      const thought = a.ok ? a.thought : null

      const first = results[at] === null && misses === 0
      if (first) {
        recordTry(current.skill, verdict === 'correct')
        setResults((rs) => rs.map((r, i) => (i === at ? verdict === 'correct' : r)))
      }

      if (verdict === 'correct') {
        if (thought) setRights((rs) => [...rs, thought])
        setAnswered(
          current.show
            ? { key: `practice:${at}`, prop: current.show, ask: current.ask, answer: thought, verdict: 'right', heard: [...rights, ...(thought ? [thought] : [])] }
            : null,
        )
        setSaid(null)
        setReply(null)
        setMisses(0)
        setAt(at + 1)
        return
      }

      const n = misses + 1
      setMisses(n)
      setSaid(thought)
      setReply(replyOf(current, why, n))
    },
    [at, current, misses, results, rights],
  )

  if (!pool) return null

  const done = at >= exercises.length
  const firstTime = results.filter((r) => r === true).length
  // The shelf closes a session that asked about pictures; one about
  // memory has the memory graph instead, and a scene with no props.
  const shelf = done && rights.length > 0 && exercises.some((e) => e.show)
  const script = scriptOf(exercises, at, reply, { right: firstTime, shelf })

  // The answered picture leaves only until the next one is tried: after
  // that it has long gone, and a miss is drawn into the one asking.
  const leaving = said === null && reply === null ? answered : null
  const staging: Staging = done
    ? shelf
      ? {
          current: { key: 'practice:done', prop: { kind: 'shelf', filled: [...SLOTS], cheer: true }, answer: null, verdict: null, heard: rights },
          leaving,
        }
      : { current: null, leaving }
    : current!.show
      ? {
          current: {
            key: `practice:${at}`,
            prop: current!.show,
            ask: current!.ask,
            answer: said,
            verdict: reply !== null ? 'miss' : null,
            heard: rights,
          },
          leaving,
        }
      : leaving
        ? { current: null, leaving }
        : NO_STAGING

  return {
    guide: { text: script[script.length - 1]!.text, script },
    done,
    // The question stays in the meter only when there is no picture to
    // carry it; with one, it sits under the picture instead.
    meter: {
      at: Math.min(at, exercises.length),
      of: exercises.length,
      results,
      task: done || current!.show ? null : current!.say,
    },
    current: done ? null : current,
    onAttempt,
    staging,
    stagingAt: (beat: number) =>
      beat === 0 && at > 0 && leaving ? { current: { ...leaving, ask: undefined }, leaving: null } : staging,
  }
}
