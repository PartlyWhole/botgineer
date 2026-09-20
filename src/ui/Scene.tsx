/**
 * The encounter: who is here, what they said, and what is on the belt.
 *
 * The crates are generated from the same `world` object as the Python
 * preamble, so the picture and the data cannot drift apart.
 */
import { memo } from 'react'
import { Courier, Robot } from './Characters'
import type { Cast } from '../game/director'
import type { World } from '../game/scenario'

type Props = {
  cast: Cast
  npcName: string
  npcLine: string
  robotLine: string | null
  world: World
  highlighted: string[]
}

/** Memoised: the frame pump re-renders the screen once per animation frame
 *  while a trace streams, and re-diffing two full SVG characters and the
 *  belt 60 times a second is pure waste — none of this changes during a
 *  run. Callers must keep `highlighted` referentially stable. */
export const Scene = memo(function Scene({
  cast,
  npcName,
  npcLine,
  robotLine,
  world,
  highlighted,
}: Props) {
  const picked = new Set(highlighted)
  return (
    <section className="scene" aria-label="The depot desk">
      <div className="actors">
        <figure className="actor">
          <Courier mood={cast.npc} />
          <figcaption>{npcName}</figcaption>
        </figure>

        <div className="bubbles">
          <p className="bubble npc">{npcLine}</p>
          {robotLine !== null && (
            <p className="bubble robot" data-testid="robot-line">
              {robotLine}
            </p>
          )}
        </div>

        <figure className="actor">
          <Robot mood={cast.robot} />
          <figcaption>Your robot</figcaption>
        </figure>
      </div>

      <div className="belt" aria-label="Parcels on the belt">
        {world.parcels.map((p) => {
          const over = picked.has(p.id)
          return (
            <div
              key={p.id}
              className={`crate ${over ? 'picked' : ''}`}
              data-testid={`crate-${p.id}`}
              data-picked={over ? 'yes' : 'no'}
            >
              <span className="crate-id">{p.id}</span>
              <span className="crate-weight">{p.weight.toFixed(1)} kg</span>
            </div>
          )
        })}
      </div>
    </section>
  )
})
