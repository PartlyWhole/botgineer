/**
 * A stage's ideas, in plain language, with every example runnable.
 *
 * The collection's "The ideas" section, as it is written, in the scene's
 * sheet. Each Python example has a button that hands it to the robot: the
 * example runs, memory draws what it built, and the scrubber walks through
 * it — so "two names can point at one object" is something you watch
 * happen rather than something you are told.
 *
 * The level is finished when the end of the text has been reached. That is
 * the evidence there is — the sheet cannot know what was understood, only
 * what was read — and it is derived from what is on screen, not stored.
 */
import { useEffect, useRef } from 'react'
import { Blocks } from '../ui/Blocks'
import { richText } from '../ui/richText'
import type { Stage } from '../collection/model'

export function IdeasSheet({
  stage,
  running,
  onTry,
  onEnd,
  lead,
}: {
  stage: Stage
  /** The example the robot is showing, to mark its button. */
  running: string | null
  /** Runs an example; `context` is the section's earlier examples, which a
   *  fragment may lean on. */
  onTry: (code: string, context: string[]) => void
  onEnd: () => void
  /** Said first — Stage 1's, that the console lessons came before. */
  lead?: string
}) {
  const endRef = useRef<HTMLDivElement | null>(null)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  useEffect(() => {
    const el = endRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      onEndRef.current()
      return
    }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) onEndRef.current()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  /**
   * What an example may lean on: the section's earlier examples, and any
   * assignment the text writes inline — "Given `original = [[1, 2], [3,
   * 4]]`:" sets up the three examples after it in words.
   */
  const setup = (blocks: Stage['adds']): Map<number, string[]> => {
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

  const tryButton = (blocks: Stage['adds']) => {
    const context = setup(blocks)
    return (code: string, i: number) => (
      <button
        type="button"
        className={`try-it ${running === code ? 'on' : ''}`}
        onClick={() => onTry(code + '\n', context.get(i) ?? [])}
        data-testid="try-it"
      >
        {running === code ? 'Showing in memory' : 'Run this'}
      </button>
    )
  }

  return (
    <div className="read-sheet ideas-sheet" data-testid="ideas-sheet">
      <article className="card prompt-card">
        <p className="card-kicker">Stage {stage.stage} · The one new move</p>
        <h3 className="ideas-title">{stage.title}</h3>
        {stage.move && <p className="ideas-move">{richText(stage.move)}</p>}
        {lead && <p className="quiet">{lead}</p>}
        <Blocks blocks={stage.adds} code={tryButton(stage.adds)} />
      </article>
      {stage.ideas.map((idea, i) => (
        <article key={i} className="card idea-card">
          {idea.title && <h4 className="idea-title">{richText(idea.title)}</h4>}
          <Blocks blocks={idea.blocks} code={tryButton(idea.blocks)} />
        </article>
      ))}
      {stage.capstone && (
        <article className="card idea-card">
          <h4 className="idea-title">The capstone program</h4>
          <Blocks blocks={stage.capstone.intro} />
          <p className="quiet">You will meet it at the end of this stage. Read it now if you like; run it only after you have predicted it.</p>
        </article>
      )}
      <div ref={endRef} className="ideas-end" data-testid="ideas-end">
        <p>That is the stage’s idea. The exercises are next.</p>
      </div>
    </div>
  )
}
