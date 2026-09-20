/**
 * The robot's memory, drawn as objects rather than as names.
 *
 * Every tile is something Python really built, read out of the trace. The
 * identity chip appears only on objects the engine gave a heap identity —
 * containers, where sharing is real — and never on a plain number or
 * string, where CPython's interning would teach something false.
 */
import { identityLabels, sharesIdentity, type MemoryObject } from '../game/repl'

const SCALARS = new Set(['int', 'float', 'str', 'bool', 'NoneType'])

export function ObjectTiles({
  objects,
  newestSlot,
}: {
  objects: MemoryObject[]
  newestSlot: number | null
}) {
  if (objects.length === 0) {
    return (
      <div className="tiles empty">
        <p>Nothing here yet. Whatever you ask the robot to make turns up in this space.</p>
      </div>
    )
  }

  const labels = identityLabels(objects)

  return (
    <div className="tiles" data-testid="tiles">
      {objects.map((o) => {
        const twin = objects.find((other) => other.slot !== o.slot && sharesIdentity(other, o))
        return (
          <figure
            key={o.slot}
            className={`tile ${SCALARS.has(o.typeName) ? 'scalar' : 'heap'} ${
              o.slot === newestSlot ? 'newest' : ''
            }`}
            data-testid={`tile-${o.slot}`}
            data-type={o.typeName}
          >
            <figcaption className="tile-type">
              {o.typeName}
              {labels.has(o.slot) && (
                <span className="tile-id" title="This object has its own identity">
                  {labels.get(o.slot)}
                </span>
              )}
            </figcaption>
            <div className="tile-value">{o.text}</div>
            {twin && <p className="tile-note">same object as {labels.get(twin.slot)}</p>}
          </figure>
        )
      })}
    </div>
  )
}
