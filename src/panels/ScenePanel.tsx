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
}: {
  spec: SceneSpec
  snapshot: MemorySnapshot
  mood: Mood
}) {
  const view = readScene(spec, snapshot)

  return (
    <div className="scene-panel" data-testid="scene">
      <div className="stage" data-scene={spec.id}>
        {view.actors.map((a) => (
          <ActorNode key={a.actor.id} view={a} mood={mood} />
        ))}
      </div>

      <div className="stage-foot">
        <p className="caption">{spec.caption}</p>
        {view.waitingFor.length > 0 && (
          <ul className="waiting" data-testid="waiting">
            {view.waitingFor.map((w) => (
              <li key={w.name}>{richText(w.hint)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

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
