/**
 * `#/skills`: how well each concept is known, and what kind of mistakes.
 *
 * Four readings of one store (mastery), top to bottom:
 *
 *   **your mistakes**    the misses by kind — syntax-reading, flow,
 *                        object-model, vocabulary-only — and, for the kind
 *                        you make most, where the collection says to go
 *                        back to. The classification is the learning; the
 *                        right answer is a by-product.
 *   **misconceptions**   the conventions table, made live: each wrong model
 *                        you have fallen for, how often you caught it
 *                        instead, and the exercises that attack it.
 *   **to redo**          items whose last first try was a miss.
 *   **concepts**         every concept by unit, with its level and fading.
 *
 * All of it is derived: from mastery, from which levels are finished, and
 * from the clock. Nothing here is stored.
 */
import { ROADMAP } from '../../content/roadmap'
import { ACTIVITIES } from '../../content/activities'
import { LESSONS } from '../../content/lessons'
import { conceptsOfUnit } from '../../content/concepts'
import { KEY, LEVEL_NAMES, due, lastMissed, level, levelIndex, useMastery, type Mastery } from '../mastery/mastery'
import { useProgress } from '../progress/progress'
import { goTo } from '../app/router'
import { ITEMS, MISCONCEPTIONS } from '../collection'
import { ERROR_NAMES, type ErrorType } from '../collection/model'
import { richText } from '../ui/richText'

/** Skills that a finished lesson has introduced. */
export function introducedSkills(finished: ReadonlySet<string>): Set<string> {
  const out = new Set<string>()
  for (const a of ACTIVITIES) {
    if (!finished.has(a.id) || !a.lesson) continue
    for (const s of LESSONS[a.lesson]?.teaches ?? []) out.add(s)
  }
  return out
}

const DAY = 24 * 60 * 60 * 1000

const ago = (ms: number): string => {
  const days = Math.floor(ms / DAY)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return `${Math.floor(days / 7)} weeks ago`
}

/** README §6: where each kind of mistake sends you. */
export const REMEDY: Record<ErrorType, { say: string; to: string[] }> = {
  syntax: { say: 'Read the line aloud, one piece at a time: the “Label the code” and “Mark the block” exercises.', to: ['1.1', '5.1'] },
  flow: { say: 'Number the lines; do not estimate — Stage 5’s execution order and Stage 7’s nested counts.', to: ['5.2', '7.1'] },
  object: { say: 'Draw the names and objects — Stage 2 for change versus replace, Stage 4 for levels of sharing.', to: ['2.8', '4.1'] },
  vocabulary: { say: 'The glossary, and nothing else. This is the cheapest kind of mistake there is.', to: [] },
}

const ERRORS: ErrorType[] = ['object', 'flow', 'syntax', 'vocabulary']

/** Misses by kind, most first. */
export function errorBreakdown(m: Mastery): { err: ErrorType; misses: number }[] {
  return ERRORS.map((err) => ({ err, misses: m[KEY.error(err)]?.tries ?? 0 })).sort((a, b) => b.misses - a.misses)
}

export function SkillsScreen() {
  const mastery = useMastery()
  const finished = useProgress()
  const introduced = introducedSkills(finished)
  const now = Date.now()

  const all = ROADMAP.flatMap((u) => conceptsOfUnit(u.id))
  const mastered = all.filter((s) => level(mastery[s.id], now) === 'mastered').length
  const breakdown = errorBreakdown(mastery)
  const totalMisses = breakdown.reduce((t, b) => t + b.misses, 0)
  const top = breakdown[0]!
  const fellFor = MISCONCEPTIONS.map((mc) => ({ mc, r: mastery[KEY.misconception(mc.id)] }))
    .filter(({ r }) => r && r.tries > r.right)
    .sort((a, b) => b.r!.tries - b.r!.right - (a.r!.tries - a.r!.right))
  const redo = ITEMS.filter((i) => lastMissed(mastery[KEY.exercise(i.id)]))

  return (
    <main className="map skills" data-testid="skills">
      <div className="skills-column">
        <header className="skills-head">
          <h2>Your skills</h2>
          <p>
            <strong>{mastered}</strong> of {all.length} concepts mastered. Practice asks most about the ones you know least.
          </p>
        </header>

        <section className="skills-unit skills-mistakes" data-theme="sun" data-testid="error-breakdown">
          <div className="skills-unit-head">
            <div>
              <p className="map-banner-kicker">The kinds of mistake</p>
              <h3>Your misses, by kind</h3>
            </div>
          </div>
          {totalMisses === 0 ? (
            <p className="skills-note">No misses recorded yet. Every miss in the reading exercises is classified here.</p>
          ) : (
            <>
              <ul className="err-bars">
                {breakdown.map(({ err, misses }) => (
                  <li key={err} data-testid={`err-${err}`}>
                    <span className="err-name">{ERROR_NAMES[err]}</span>
                    <span className="err-track" aria-hidden="true">
                      <span className="err-fill" style={{ width: `${(misses / Math.max(1, top.misses)) * 100}%` }} />
                    </span>
                    <span className="err-count">{misses}</span>
                  </li>
                ))}
              </ul>
              <p className="skills-note" data-testid="err-advice">
                Most of your misses are <strong>{ERROR_NAMES[top.err].toLowerCase()}</strong>. {REMEDY[top.err].say}{' '}
                {REMEDY[top.err].to.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ' · '}
                    <a href={`#/x-${id}`}>{id}</a>
                  </span>
                ))}
                {top.err === 'vocabulary' && <a href="#/glossary">Open the glossary</a>}
              </p>
            </>
          )}
        </section>

        <section className="skills-unit" data-theme="berry" data-testid="misconceptions">
          <div className="skills-unit-head">
            <div>
              <p className="map-banner-kicker">Wrong models</p>
              <h3>Misconceptions you have fallen for</h3>
            </div>
          </div>
          {fellFor.length === 0 ? (
            <p className="skills-note">None yet. Every exercise was written backwards from one of twelve wrong models; the ones that catch you appear here.</p>
          ) : (
            <ul className="mis-list">
              {fellFor.map(({ mc, r }) => (
                <li key={mc.id} className="mis" data-testid={`mis-${mc.id}`}>
                  <p className="skill-title">{richText(mc.text)}</p>
                  <p className="skill-stats">
                    Fell for it {r!.tries - r!.right} {r!.tries - r!.right === 1 ? 'time' : 'times'}, caught it {r!.right}.
                  </p>
                  <p className="mis-links">
                    Exercises that attack it:{' '}
                    {mc.exercises.map((id, i) => (
                      <span key={id}>
                        {i > 0 && ', '}
                        <a href={`#/x-${id}`}>{id}</a>
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {redo.length > 0 && (
          <section className="skills-unit" data-theme="sun" data-testid="redo">
            <div className="skills-unit-head">
              <div>
                <p className="map-banner-kicker">Worth another look</p>
                <h3>Missed last time</h3>
              </div>
            </div>
            <p className="skills-note">
              {redo.map((i, k) => (
                <span key={i.id}>
                  {k > 0 && ' · '}
                  <a href={`#/x-${i.id}`}>{i.id}</a>
                </span>
              ))}
            </p>
          </section>
        )}

        <section className="skills-unit" data-theme="grass" data-testid="lenses">
          <div className="skills-unit-head">
            <div>
              <p className="map-banner-kicker">Three ways of reading</p>
              <h3>Lenses</h3>
            </div>
          </div>
          <ul className="skills-list">
            {(['syntax', 'flow', 'object'] as const).map((l) => {
              const r = mastery[KEY.lens(l)]
              const lv = level(r, now)
              return (
                <li key={l} className="skill" data-level={lv}>
                  <div className="skill-text">
                    <p className="skill-title">{l === 'syntax' ? 'Syntax' : l === 'flow' ? 'Flow' : 'Objects'}</p>
                    <p className="skill-can">
                      {l === 'syntax'
                        ? 'What kind of line this is, and which punctuation matters'
                        : l === 'flow'
                          ? 'When and how often each line runs'
                          : 'Which names point at which objects, and what is shared'}
                    </p>
                  </div>
                  <Meter level={lv} label={l} known={(r?.tries ?? 0) > 0} stats={r && r.tries > 0 ? `${r.right} of ${r.tries} first time` : null} />
                </li>
              )
            })}
          </ul>
        </section>

        {ROADMAP.map((unit, u) => {
          const skills = conceptsOfUnit(unit.id)
          if (skills.length === 0) return null
          const practiceId = unit.stage ? `s${unit.stage}-practice` : `practice-${unit.id}`
          const canPractise = ACTIVITIES.some((a) => a.id === practiceId)
          return (
            <section key={unit.id} className="skills-unit" data-theme={unit.theme} data-testid={`skills-${unit.id}`}>
              <div className="skills-unit-head">
                <div>
                  <p className="map-banner-kicker">Unit {u + 1}</p>
                  <h3>{unit.title}</h3>
                </div>
                {canPractise && (
                  <button type="button" className="skills-go" onClick={() => goTo(practiceId)}>
                    Practise
                  </button>
                )}
              </div>

              <ul className="skills-list">
                {skills.map((s) => {
                  const r = mastery[s.id]
                  const l = level(r, now)
                  const known = introduced.has(s.id) || (r?.tries ?? 0) > 0
                  const review = known && (r?.tries ?? 0) > 0 && due(r, now)
                  return (
                    <li key={s.id} className="skill" data-level={l} data-testid={`skill-${s.id}`}>
                      <div className="skill-text">
                        <p className="skill-title">
                          {s.title}
                          {review && <span className="skill-review">Needs review</span>}
                        </p>
                        <p className="skill-can">{s.can}</p>
                      </div>
                      <Meter
                        level={l}
                        label={s.title}
                        known={known}
                        stats={r && r.tries > 0 ? `${r.right} of ${r.tries} first time · ${ago(now - r.last)}` : null}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </main>
  )
}

function Meter({ level: l, label, known, stats }: { level: ReturnType<typeof level>; label: string; known: boolean; stats: string | null }) {
  return (
    <div className="skill-meter">
      <p className="skill-level">{known ? LEVEL_NAMES[l] : 'Not introduced yet'}</p>
      <div
        className="skill-bar"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={levelIndex(l)}
        aria-label={`${label}: ${known ? LEVEL_NAMES[l] : 'not introduced yet'}`}
      >
        {[1, 2, 3, 4].map((n) => (
          <i key={n} className={levelIndex(l) >= n ? 'on' : ''} />
        ))}
      </div>
      {stats && <p className="skill-stats">{stats}</p>}
    </div>
  )
}
