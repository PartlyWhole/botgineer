/**
 * The robot's memory, drawn as objects rather than as names.
 *
 * Every tile is something Python really built, read out of the trace. The
 * identity chip appears only on objects the engine gave a heap identity —
 * containers, where sharing is real — and never on a plain number or
 * string, where CPython's interning would teach something false.
 */
import { sharesIdentity, type MemoryObject } from '../game/repl'

const SCALARS = new Set(['int', 'float', 'str', 'bool', 'NoneType'])

/** Short, stable label for a heap identity. The engine's uids are not
 *  meaningful across runs, so this is a within-session nickname, not an
 *  address the player should read anything into. */
function idLabel(uid: string, order: string[]): string {
  const n = order.indexOf(uid)
  return `#${n < 0 ? '?' : n + 1}`
}

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
        <p>Nothing here yet. Whatever you type at the prompt turns up in this space.</p>
      </div>
    )
  }

  const order = [...new Set(objects.map((o) => o.uid).filter((u): u is string => u !== null))]

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
              {o.uid !== null && (
                <span className="tile-id" title="This object has its own identity">
                  {idLabel(o.uid, order)}
                </span>
              )}
            </figcaption>
            <div className="tile-value">{o.text}</div>
            {twin && <p className="tile-note">same object as {idLabel(twin.uid ?? '', order)}</p>}
          </figure>
        )
      })}
    </div>
  )
}
