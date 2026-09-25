/**
 * A stage's ideas, told one paragraph a beat, with every example runnable.
 *
 * The collection's "The ideas" section, as it is written (invariant 21),
 * in the scene's sheet. The crow tells it in beats (`voice.ideaBeats`):
 * each beat puts one more block of the text on the sheet, so the page
 * grows under the player's own Next rather than arriving as a wall
 * (docs/PEDAGOGY.md §6). Back takes the last block away again. The block
 * being read is marked and kept in view — by scrolling the sheet's own
 * box, never the page: on a phone the page scrolls, and scrolling it to a
 * block took the stage, the crow's words and Next off the top of the
 * screen by the third beat.
 *
 * Each Python example has a button that hands it to the robot: the
 * example runs, memory draws what it built, the scrubber walks through it
 * and the crow points at what changed — so "two names can point at one
 * object" is something you watch happen rather than something you are
 * told.
 *
 * Stage 6's table of formal words is told a row a beat, and each word the
 * crow has named stays on the sheet as a label ("vocabulary is earned"),
 * and a heading that uses a word not named yet waits for it (Stage 8's
 * "Calling: arguments are objects, parameters are local names").
 *
 * The sheet holds no state: what shows is a function of the beat, which is
 * the workbench's, and the level is finished when the last beat is.
 */
import { useEffect, useMemo, useRef } from 'react'
import { Blocks } from '../ui/Blocks'
import { richText } from '../ui/richText'
import type { Block, Stage } from '../collection/model'
import { heldTitle, ideaBeats, type Reach } from '../collection/voice'

export function IdeasSheet({
  stage,
  running,
  onTry,
  reach,
  now,
  terms,
  end,
}: {
  stage: Stage
  /** The example the robot is showing, to mark its button. */
  running: string | null
  /** Runs an example; `context` is the section's earlier examples, which a
   *  fragment may lean on. */
  onTry: (code: string, context: string[]) => void
  /** How far the telling has got: everything up to here is on the sheet. */
  reach: Reach | null
  /** The block the current beat is about, marked and scrolled to. */
  now: Reach | null
  /** The formal words named so far, as labels. */
  terms: string[]
  /** The last beat has been told. */
  end: boolean
}) {
  const nowRef = useRef<HTMLDivElement | null>(null)
  const nowKey = now ? `${now.section}:${now.block}:${now.row ?? ''}` : end ? 'end' : ''
  useEffect(() => {
    const el = end ? document.querySelector('[data-testid="ideas-end"]') : nowRef.current
    const box = el?.closest('.sheet-scroll')
    if (!el || !box) return
    // "nearest", by hand, in the sheet's box alone: `scrollIntoView` would
    // scroll every scrolling ancestor, the page included.
    const at = el.getBoundingClientRect()
    const frame = box.getBoundingClientRect()
    const pad = 12
    let by = 0
    if (at.bottom > frame.bottom - pad) by = at.bottom - frame.bottom + pad
    if (at.top - by < frame.top + pad) by = at.top - frame.top - pad
    if (by === 0) return
    // A beat moves one block, and glides there; a jump to the end, or a
    // player who asked for less motion, goes straight.
    const still = end || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
    box.scrollBy({ top: by, behavior: still ? 'auto' : 'smooth' })
  }, [nowKey, end])

  const beats = useMemo(() => ideaBeats(stage), [stage])

  /**
   * What an example may lean on: the section's earlier examples, and any
   * assignment the text writes inline — "Given `original = [[1, 2], [3,
   * 4]]`:" sets up the three examples after it in words.
   */
  const setup = (blocks: Block[]): Map<number, string[]> => {
    const out = new Map<number, string[]>()
    const before: string[] = []
    blocks.forEach((b, i) => {
      if (b.kind === 'p') {
        for (const m of b.text.matchAll(/`([A-Za-z_]\w*\s*=[^=`][^`]*)`/g)) before.push(m[1]!)
      }
      if (b.kind === 'code' && b.lang === 'python') {
        out.set(i, [...before])
        before.push(b.text)
      }
    })
    return out
  }

  const shows = (section: number, block: number) =>
    reach !== null && (section < reach.section || (section === reach.section && block <= reach.block))

  /** A section's blocks, as far as the telling has got, one element each
   *  so the one being read can be marked. */
  const told = (section: number, blocks: Block[]) => {
    const context = setup(blocks)
    return blocks.map((b, i) => {
      if (!shows(section, i)) return null
      // A table told a row a beat shows the rows said so far.
      const partial =
        b.kind === 'table' && reach?.section === section && reach.block === i && reach.row !== undefined
          ? { ...b, rows: b.rows.slice(0, reach.row + 1) }
          : b
      const here = now?.section === section && now.block === i
      return (
        <div key={i} ref={here ? nowRef : undefined} className={`idea-block ${here ? 'now' : ''}`} data-testid={here ? 'idea-now' : undefined}>
          <Blocks
            blocks={[partial]}
            code={(code) => (
              <button
                type="button"
                className={`try-it ${running === code ? 'on' : ''}`}
                onClick={() => onTry(code + '\n', context.get(i) ?? [])}
                data-testid="try-it"
              >
                {running === code ? 'Showing in memory' : 'Run this'}
              </button>
            )}
          />
        </div>
      )
    })
  }

  const capstone = stage.ideas.length + 1
  return (
    <div className="read-sheet ideas-sheet" data-testid="ideas-sheet" data-end={end ? 'true' : 'false'}>
      <article className="card prompt-card">
        <p className="card-kicker">Stage {stage.stage} · The one new move</p>
        <h3 className="ideas-title">{stage.title}</h3>
        {stage.move && <p className="ideas-move">{richText(stage.move)}</p>}
        {terms.length > 0 && (
          <p className="idea-terms" data-testid="idea-terms" aria-label="Formal words so far">
            {terms.map((t) => (
              <span key={t} className="idea-term" data-term={t}>
                {t}
              </span>
            ))}
          </p>
        )}
        {told(0, stage.adds)}
      </article>
      {stage.ideas.map((idea, k) =>
        shows(k + 1, 0) ? (
          <article key={k} className="card idea-card">
            {idea.title && !heldTitle(idea.title, beats, terms) && <h4 className="idea-title">{richText(idea.title)}</h4>}
            {told(k + 1, idea.blocks)}
          </article>
        ) : null,
      )}
      {stage.capstone && shows(capstone, 0) && (
        <article className="card idea-card">
          <h4 className="idea-title">The capstone program</h4>
          {told(capstone, stage.capstone.intro)}
          <p className="quiet">You will meet the program itself at the end of this stage, and predict it before it runs.</p>
        </article>
      )}
      {end && (
        <div className="ideas-end" data-testid="ideas-end">
          <p>That is the stage’s idea. The exercises are next.</p>
        </div>
      )}
    </div>
  )
}
