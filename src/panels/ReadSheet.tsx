/**
 * (A) The scene's sheet, for reading: the question, and then the key.
 *
 * The prompt is the collection's own prose. Its code is not repeated here
 * — the code is in the robot panel, where its lines can be clicked — so
 * the sheet says what is asked and the panel is where it is answered.
 *
 * The key stays shut until the commit, and then all of it opens: the
 * answer, the reasoning (which the collection calls the actual content),
 * the misconception the exercise was built against, which kind of mistake
 * a miss is, and where to go back to. "Go back to 4.6" is a link that
 * opens 4.6. The authoring record is there too, folded away: it is written
 * for instructors, and sometimes it is what makes an exercise click.
 *
 * Like the rest of the scene, this decides nothing. It draws what the
 * session has.
 */
import { useEffect, useRef } from 'react'
import { Blocks } from '../ui/Blocks'
import { richText } from '../ui/richText'
import { itemById, STAGES } from '../collection'
import { ERROR_NAMES, type Block, type ErrorType } from '../collection/model'
import type { ReadSession } from '../collection/useReadSession'

/** The prompt without its code, which the robot panel shows instead. */
function promptOnly(blocks: Block[]): Block[] {
  return blocks.filter((b) => !(b.kind === 'code' && b.lang === 'python') && !(b.kind === 'p' && /^Snippet \*\*[A-Z]\*\*:?$/.test(b.text)))
}

export function ReadSheet({ session, title }: { session: ReadSession; title: string }) {
  const { current, state } = session
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const keyRef = useRef<HTMLElement | null>(null)
  const revealedNow = state?.phase === 'revealed'
  // A new item starts at the top; a commit brings the key into view. The
  // sheet scrolls itself, not the page (the map learned that the hard way).
  useEffect(() => {
    const box = sheetRef.current?.closest('.sheet-scroll')
    if (!box) return
    if (revealedNow && keyRef.current) box.scrollTo({ top: Math.max(0, keyRef.current.offsetTop - 12), behavior: 'smooth' })
    else box.scrollTo({ top: 0 })
  }, [current?.id, revealedNow])
  if (!current || !state) return null
  const item = itemById(current.id)
  if (!item) return null
  const revealed = state.phase === 'revealed'
  const kicker = item.kind === 'exercise' ? `${item.exercise.id} · ${item.exercise.form}` : `Checkpoint question ${item.question.id}`
  const prompt = item.kind === 'exercise' ? item.exercise.prompt : item.question.prompt
  const outcome = state.outcome
  // Every capstone item is about the same program; each says what it is for.
  const capstone = /\.C\d/.test(current.id) ? (STAGES[item.stage - 1]?.capstone ?? null) : null
  // While a repair or a program is still owed, the key's own code stays
  // folded: "Smallest correction" followed by the correction would be the
  // answer handed over before the question was tried. It opens when the
  // learner's version works, or when they ask to see the key's.
  const owed = current.spec.parts.some((p, i) => (p.kind === 'fix' || p.kind === 'write') && !state.acts[i]?.result?.right)
  const hasCode = (bs: Block[]) => bs.some((b) => b.kind === 'code' && b.lang === 'python')

  return (
    <div className="read-sheet" data-testid="read-sheet" ref={sheetRef}>
      <div className="sheet-head">
        <p className="sheet-kicker">{title}</p>
        <ol className="sheet-meter" aria-label="Progress">
          {session.items.map((it, i) => {
            const r = session.results[i]
            return (
              <li
                key={it.id}
                className={`${i === session.at ? 'now' : ''} ${r === true ? 'right' : r === false ? 'wrong' : ''}`}
                aria-label={`${it.id}${r === true ? ', right first time' : r === false ? ', missed first time' : ''}`}
              />
            )
          })}
        </ol>
      </div>

      {capstone && (
        <article className="card capstone-card" data-testid="capstone-brief">
          <p className="card-kicker">The capstone program</p>
          <Blocks blocks={capstone.brief} />
          {/* All eight steps, on every step: one program, read in order —
              mark, trace, draw, predict, diagnose, find the hidden one,
              repair, extend. */}
          <ol className="capstone-steps" data-testid="capstone-steps">
            {session.items.map((it, i) => {
              const step = itemById(it.id)
              const r = session.results[i]
              return (
                <li
                  key={it.id}
                  className={`${i === session.at ? 'now' : ''} ${r === true ? 'right' : r === false ? 'wrong' : ''}`}
                  aria-current={i === session.at ? 'step' : undefined}
                >
                  <span className="capstone-id">{it.id.replace(/^9\./, '')}</span>
                  {step?.kind === 'exercise' ? step.exercise.form : it.id}
                  {r === true && <span className="sr-only">, right first time</span>}
                  {r === false && <span className="sr-only">, missed first time</span>}
                </li>
              )
            })}
          </ol>
        </article>
      )}

      <article className="card prompt-card" data-testid="prompt-card">
        <p className="card-kicker">{kicker}</p>
        <Blocks blocks={promptOnly(prompt)} />
        {current.snippets.length > 0 && (
          <p className="card-aside quiet">
            {revealed ? 'The robot has run it: memory and the scrubber show what happened.' : 'The code is in the robot panel. Nothing has run yet.'}
          </p>
        )}
      </article>

      {revealed && (
        <article className="card key-card" data-testid="key-card" ref={keyRef}>
          <p className="card-kicker">The key</p>
          {outcome && !outcome.right && outcome.err && <ErrorChip err={outcome.err} />}
          {outcome?.soft && <ErrorChip err="vocabulary" />}
          {item.kind === 'exercise' ? (
            item.exercise.key.sections.map((s, i) =>
              owed && hasCode(s.blocks) ? (
                <section key={i} className="key-section key-held" data-testid="key-held">
                  <h4>{s.label || 'The key’s code'}</h4>
                  <p className="quiet">Held back until your version works — or until you ask to see the key’s.</p>
                </section>
              ) : s.label ? (
                <section key={i} className={`key-section key-${slug(s.label)}`}>
                  <h4>{s.label}</h4>
                  <Blocks blocks={s.blocks} />
                </section>
              ) : (
                <Blocks key={i} blocks={s.blocks} />
              ),
            )
          ) : owed && hasCode(item.question.answer) ? (
            <p className="quiet" data-testid="key-held">The answer’s code is held back until your version works.</p>
          ) : (
            <Blocks blocks={item.question.answer} />
          )}

          {session.goBack.length > 0 && (
            <p className="go-back" data-testid="go-back">
              Go back to{' '}
              {session.goBack.map((id, i) => (
                <span key={id}>
                  {i > 0 && ' and '}
                  <a href={`#/x-${id}`} data-testid={`go-back-${id}`}>
                    {id}
                  </a>
                </span>
              ))}
            </p>
          )}

          {item.kind === 'exercise' && item.exercise.key.authoring && (
            <details className="authoring">
              <summary>Authoring record</summary>
              <p>{richText(item.exercise.key.authoring.text)}</p>
            </details>
          )}
        </article>
      )}
    </div>
  )
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-')

export function ErrorChip({ err }: { err: ErrorType }) {
  return (
    <p className={`error-chip err-${err}`} data-testid="error-type" data-err={err}>
      {ERROR_NAMES[err]} {err === 'vocabulary' ? 'miss — the cheapest kind' : 'error'}
    </p>
  )
}
