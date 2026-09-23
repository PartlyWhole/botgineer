/**
 * Skills: how well each one is known, and what to practise next.
 *
 * Every skill, grouped by unit, with its mastery level, a bar for it, how
 * many exercises were right first time and when it was last practised. A
 * skill that has faded since is marked for review; one no finished lesson
 * has introduced yet says so rather than showing an empty bar as if it
 * had been tried and failed.
 *
 * All of it is derived: from mastery, from which levels are finished, and
 * from the clock. Nothing here is stored.
 */
import { ROADMAP } from '../../content/roadmap'
import { ACTIVITIES } from '../../content/activities'
import { LESSONS } from '../../content/lessons'
import { skillsOfUnit } from '../../content/skills'
import { LEVEL_NAMES, due, level, levelIndex, useMastery } from '../mastery/mastery'
import { useProgress } from '../progress/progress'
import { goTo } from '../app/router'

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

export function SkillsScreen() {
  const mastery = useMastery()
  const finished = useProgress()
  const introduced = introducedSkills(finished)
  const now = Date.now()

  const all = ROADMAP.flatMap((u) => skillsOfUnit(u.id))
  const mastered = all.filter((s) => level(mastery[s.id], now) === 'mastered').length

  return (
    <main className="map skills" data-testid="skills">
      <div className="skills-column">
        <header className="skills-head">
          <h2>Your skills</h2>
          <p>
            <strong>{mastered}</strong> of {all.length} mastered. Practice asks most about the ones you know least.
          </p>
        </header>

        {ROADMAP.map((unit, u) => {
          const skills = skillsOfUnit(unit.id)
          if (skills.length === 0) return null
          const practiceId = `practice-${unit.id}`
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
                      <div className="skill-meter">
                        <p className="skill-level">{known ? LEVEL_NAMES[l] : 'Not introduced yet'}</p>
                        <div
                          className="skill-bar"
                          role="meter"
                          aria-valuemin={0}
                          aria-valuemax={4}
                          aria-valuenow={levelIndex(l)}
                          aria-label={`${s.title}: ${known ? LEVEL_NAMES[l] : 'not introduced yet'}`}
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <i key={n} className={levelIndex(l) >= n ? 'on' : ''} />
                          ))}
                        </div>
                        {r && r.tries > 0 && (
                          <p className="skill-stats">
                            {r.right} of {r.tries} first time · {ago(now - r.last)}
                          </p>
                        )}
                      </div>
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
