/**
 * (A) The scene panel: the situation, drawn from memory.
 *
 * Every actor's appearance is derived from the current snapshot through
 * the scene's declared watches. The scene holds no state of its own and
 * takes no commands, so it cannot show something the program did not do —
 * and scrubbing the trace rewinds the picture for free.
 */
import { readScene, type ActorView, type SceneSpec } from '../scene/spec'
import type { MemorySnapshot } from '../memory/model'
import { Robot, Courier } from '../ui/Characters'
import { Crow } from '../ui/Crow'
import { richText } from '../ui/richText'
import type { Mood } from '../game/director'

export function ScenePanel({
  spec,
  snapshot,
  mood,
  guide,
  onAdvance,
}: {
  spec: SceneSpec
  snapshot: MemorySnapshot
  mood: Mood
  /** What is being said, and by whom — an actor id, or the crow when it
   *  is not given. Derived by the workbench and handed down as text: the
   *  scene still causes nothing and decides nothing, it just draws the
   *  sentence it was given, next to whoever is saying it. */
  guide?: { text: string; speaker?: string | undefined } | undefined
  /** Offered once the lesson is finished. Navigation only: it starts no
   *  run and holds no state, so the scene still causes nothing that could
   *  change what memory says. */
  onAdvance?: (() => void) | undefined
}) {
  const view = readScene(spec, snapshot)
  const speaker =
    (guide?.speaker ? view.actors.find((a) => a.actor.id === guide.speaker) : undefined) ??
    view.actors.find((a) => a.actor.kind === 'crow') ??
    view.actors[0]

  return (
    <div className="scene-panel" data-testid="scene">
      <div className="stage" data-scene={spec.id}>
        {view.actors.map((a) => (
          <ActorNode key={a.actor.id} view={a} mood={mood} />
        ))}

        {guide && speaker && (
          <div
            className="bubble"
            data-testid="guide"
            data-speaker={speaker.actor.id}
            // Anchored to the speaker, but kept inside the stage: a
            // character near an edge would otherwise push half the
            // sentence out of the panel, and the guide is the one thing
            // in the scene that has to be readable.
            style={{ left: `${bubbleX(speaker.actor.x)}%`, top: `${speaker.actor.y}%` }}
            aria-live="polite"
          >
            {richText(guide.text)}
            {onAdvance && (
              <button type="button" className="advance" onClick={onAdvance} data-testid="advance">
                Next
              </button>
            )}
          </div>
        )}
      </div>

      {/* Only when the scene is actually waiting for something. With the
          description gone there is otherwise nothing to put here, and an
          empty bar is worse than no bar. */}
      {view.waitingFor.length > 0 && (
        <div className="stage-foot">
          <ul className="waiting" data-testid="waiting">
            {view.waitingFor.map((w) => (
              <li key={w.name}>{richText(w.hint)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Horizontal anchor for a speech bubble, clamped clear of both edges. */
export const bubbleX = (x: number): number => Math.min(Math.max(x, 27), 73)

function ActorNode({ view, mood }: { view: ActorView; mood: Mood }) {
  const { actor } = view
  const style = {
    left: `${actor.x}%`,
    top: `${actor.y}%`,
    width: `${actor.w ?? 16}%`,
  }

  return (
    <div
      className={`actor ${actor.kind} ${view.lit ? 'lit' : ''} ${view.picked ? 'picked' : ''}`}
      style={style}
      data-testid={`actor-${actor.id}`}
      data-lit={view.lit ? 'yes' : 'no'}
      data-picked={view.picked ? 'yes' : 'no'}
    >
      {actor.kind === 'robot' && <Robot mood={view.lit ? 'celebrate' : mood} />}
      {actor.kind === 'crow' && <Crow mood={mood} />}
      {actor.kind === 'courier' && <Courier mood={mood} />}

      {actor.kind === 'plinth' && <div className="plinth-top" />}

      {actor.kind === 'lamp' && (
        <div className="bulb">
          <span className="glow" />
        </div>
      )}

      {actor.kind === 'gauge' && (
        <div className="gauge-body" data-level={view.level === null ? 'none' : 'set'}>
          <span className="fill" style={{ height: `${(view.level ?? 0) * 100}%` }} />
          <span className="gauge-text">
            {view.level === null ? '—' : `${Math.round(view.level * 100)}%`}
          </span>
        </div>
      )}

      {actor.kind === 'crate' && (
        <div className="crate-body">
          <span className="crate-label">{actor.label}</span>
        </div>
      )}

      {actor.kind === 'sign' && <div className="sign-body">{view.caption ?? '—'}</div>}
    </div>
  )
}
