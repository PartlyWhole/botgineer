/**
 * (A) The scene panel: the situation, drawn from memory.
 *
 * Every actor's appearance is derived from the current snapshot through
 * the scene's declared watches. The scene holds no state of its own and
 * takes no commands, so it cannot show something the program did not do —
 * and scrubbing the trace rewinds the picture for free.
 */
import {
  placement,
  readScene,
  type Actor,
  type ActorKind,
  type ActorView,
  type Floor,
  type SceneSpec,
} from '../scene/spec'
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
        {/* Drawn before the cast, so everyone stands in front of it. */}
        {spec.floor && (
          <div
            className="floor"
            data-look={spec.floor.look ?? 'ground'}
            data-testid="floor"
            style={{ top: `${spec.floor.at}%` }}
          />
        )}

        {view.actors.map((a) => (
          <ActorNode key={a.actor.id} view={a} mood={mood} floor={spec.floor} />
        ))}

        {guide && speaker && (
          // A rail, not a free-floating box. Its bottom edge is the
          // speaker's *top* edge — `bottom` in percent of the stage's
          // height, then a percentage `margin-bottom`, which CSS resolves
          // against the containing block's *width*, to add back half the
          // speaker's own height. That is the only way to mix the two
          // axes without measuring anything, and it is what keeps a
          // bubble off the face of whoever is talking.
          //
          // The rail spans the stage, so the bubble's width is its
          // `max-width` rather than whatever room happened to be left
          // between the speaker and the right-hand edge.
          <div
            className="bubble-rail"
            style={railAnchor(speaker.actor, spec.floor)}
          >
            <div
              className="bubble"
              data-testid="guide"
              data-speaker={speaker.actor.id}
              // Kept inside the stage: a character near an edge would
              // otherwise push half the sentence out of the panel, and
              // the guide is the one thing that has to be readable. The
              // body moves; the tail does not, so the clamp cannot make
              // the bubble point at the wrong character.
              style={{ left: `${bubbleX(speaker.actor.x) - 50}%` }}
              aria-live="polite"
            >
              {richText(guide.text)}
              {onAdvance && (
                <button type="button" className="advance" onClick={onAdvance} data-testid="advance">
                  Next
                </button>
              )}
            </div>
            <span className="bubble-tail" style={{ left: `${speaker.actor.x}%` }} />
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

/**
 * Horizontal anchor for a speech bubble's *body*, clamped clear of both
 * edges. The clamp is 31–69 rather than the whole stage because the body
 * is at most 62% wide, so anywhere in this range keeps all of it on
 * screen — at a 320px panel as much as a 900px one. The tail is not
 * clamped, so anchoring to the speaker is not what the clamp costs.
 */
export const bubbleX = (x: number): number => Math.min(Math.max(x, 31), 69)

/**
 * Half an actor's rendered height, in percent of the stage *width* —
 * the unit a percentage margin resolves in.
 *
 * A character's height is its width times its own viewBox ratio, so the
 * cast's ratios are the numbers that matter. Everything else on the stage
 * is a prop of fixed or near-square height, and 1 is a safe over-estimate
 * there: a bubble that clears too much is merely high, one that clears
 * too little sits on a face.
 */
const ACTOR_RATIO: Partial<Record<ActorKind, number>> = {
  robot: 170 / 140,
  crow: 160 / 140,
  courier: 180 / 140,
}

export const halfHeightPct = (actor: Actor): number =>
  ((actor.w ?? 16) * (ACTOR_RATIO[actor.kind] ?? 1)) / 2

/**
 * Where the bubble's rail sits, so its bottom edge is the speaker's top
 * edge.
 *
 * A standing actor's top edge is the floor *minus its whole height*,
 * where an actor placed by its centre is only half a height above it.
 * Getting this wrong is not subtle — it puts the bubble through the
 * speaker's face, which is the bug the rail was built to fix.
 */
export function railAnchor(
  actor: Actor,
  floor: Floor | undefined,
): { bottom: string; marginBottom: string } {
  const half = halfHeightPct(actor)
  if (actor.stand && floor) {
    return { bottom: `${100 - floor.at}%`, marginBottom: `${half * 2}%` }
  }
  return { bottom: `${100 - actor.y}%`, marginBottom: `${half}%` }
}

function ActorNode({
  view,
  mood,
  floor,
}: {
  view: ActorView
  mood: Mood
  floor: Floor | undefined
}) {
  const { actor } = view
  const standing = actor.stand === true && floor !== undefined

  return (
    <div
      className={`actor ${actor.kind} ${standing ? 'standing' : ''} ${view.lit ? 'lit' : ''} ${view.picked ? 'picked' : ''}`}
      style={placement(actor, floor)}
      data-stand={standing ? 'yes' : 'no'}
      data-testid={`actor-${actor.id}`}
      data-lit={view.lit ? 'yes' : 'no'}
      data-picked={view.picked ? 'yes' : 'no'}
    >
      {actor.kind === 'robot' && <Robot mood={view.lit ? 'celebrate' : mood} />}
      {actor.kind === 'crow' && <Crow mood={mood} />}
      {actor.kind === 'courier' && <Courier mood={mood} />}

      {actor.kind === 'plinth' && <div className="plinth-top" />}

      {actor.kind === 'lamp' && (
        <div className="bulb" role="img" aria-label={`The lamp is ${view.lit ? 'lit' : 'dark'}`}>
          <span className="glow" />
        </div>
      )}

      {actor.kind === 'gauge' && (
        <div className="gauge-body" data-level={view.level === null ? 'none' : 'set'}>
          <span className="fill" style={{ height: `${(view.level ?? 0) * 100}%` }} />
          <span className="gauge-text">
            {view.level === null ? (
              <>
                {'—'}
                <span className="sr-only">nothing set</span>
              </>
            ) : (
              `${Math.round(view.level * 100)}%`
            )}
          </span>
        </div>
      )}

      {actor.kind === 'crate' && (
        <div className="crate-body">
          <span className="crate-label">{actor.label}</span>
          <span className="sr-only">{view.picked ? ', lifted' : ', not lifted'}</span>
        </div>
      )}

      {actor.kind === 'sign' && <div className="sign-body">{view.caption ?? '—'}</div>}
    </div>
  )
}
