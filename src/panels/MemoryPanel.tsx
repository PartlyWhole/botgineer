/**
 * (C) The memory panel: two collections, and what connects them.
 *
 * Names on one side, objects on the other. A name is a label that points
 * at an object; an object has a type and a value, and a collection holds
 * *pointers* to other objects rather than copies of them. That is the
 * whole model, and the panel shows nothing that is not in it.
 *
 * Selecting a chip lifts it out of its cloud and opens it below: a name
 * shows what it points at, an object shows its structure and everything
 * currently holding it. Following a pointer moves the selection, so the
 * graph is walked rather than dumped.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  holdersOf,
  identityBadges,
  namesFor,
  unreferenced,
  type MemorySnapshot,
  type ObjectId,
  type PyObject,
} from '../memory/model'

type Focus = { on: 'name'; name: string; scope: string } | { on: 'object'; id: ObjectId } | null

export function MemoryPanel({ snapshot }: { snapshot: MemorySnapshot }) {
  const [focus, setFocus] = useState<Focus>(null)
  const badges = useMemo(() => identityBadges(snapshot), [snapshot])
  const orphans = useMemo(() => new Set(unreferenced(snapshot)), [snapshot])

  const objects = useMemo(
    () =>
      Object.values(snapshot.objects).sort(
        (a, b) => a.kind.localeCompare(b.kind) || a.type.localeCompare(b.type) || a.repr.localeCompare(b.repr),
      ),
    [snapshot],
  )

  // A selection that no longer exists would silently show nothing, so it
  // is dropped rather than left dangling.
  useEffect(() => {
    if (!focus) return
    const alive =
      focus.on === 'object'
        ? !!snapshot.objects[focus.id]
        : snapshot.bindings.some((b) => b.name === focus.name && b.scope === focus.scope)
    if (!alive) setFocus(null)
  }, [focus, snapshot])

  const focusedObjectId =
    focus?.on === 'object'
      ? focus.id
      : focus?.on === 'name'
        ? (snapshot.bindings.find((b) => b.name === focus.name && b.scope === focus.scope)?.target ??
          null)
        : null

  if (snapshot.bindings.length === 0 && objects.length === 0) {
    return (
      <div className="memory empty" data-testid="memory">
        <p>Memory is empty. Send the robot some code and whatever it builds turns up here.</p>
      </div>
    )
  }

  return (
    <div className="memory" data-testid="memory">
      <div className="clouds">
        <section className="cloud names" aria-label="Names">
          <h3>
            Names <span className="count">{snapshot.bindings.length}</span>
          </h3>
          <div className="chips">
            {snapshot.bindings.length === 0 && <p className="none">no names yet</p>}
            {snapshot.bindings.map((b) => {
              const lifted = focus?.on === 'name' && focus.name === b.name && focus.scope === b.scope
              const points = focusedObjectId !== null && b.target === focusedObjectId
              return (
                <button
                  key={`${b.scope}:${b.name}`}
                  type="button"
                  className={`chip name ${lifted ? 'lifted' : ''} ${points && !lifted ? 'related' : ''}`}
                  data-testid={`name-${b.name}`}
                  aria-pressed={lifted}
                  onClick={() => setFocus(lifted ? null : { on: 'name', name: b.name, scope: b.scope })}
                >
                  {b.scope !== 'global' && <span className="scope">{b.scope}</span>}
                  {b.name}
                </button>
              )
            })}
          </div>
        </section>

        <section className="cloud objects" aria-label="Objects">
          <h3>
            Objects <span className="count">{objects.length}</span>
          </h3>
          <div className="chips">
            {objects.length === 0 && <p className="none">no objects yet</p>}
            {objects.map((o) => (
              <ObjectChip
                key={o.id}
                object={o}
                badge={badges[o.id]}
                lifted={focusedObjectId === o.id}
                orphan={orphans.has(o.id)}
                onClick={() =>
                  setFocus(focus?.on === 'object' && focus.id === o.id ? null : { on: 'object', id: o.id })
                }
              />
            ))}
          </div>
        </section>
      </div>

      <div className="inspector" data-testid="inspector">
        {focus === null ? (
          <p className="none">Pick a name or an object to pull it out and see what it points at.</p>
        ) : (
          <Inspector
            focus={focus}
            focusedObjectId={focusedObjectId}
            snapshot={snapshot}
            badges={badges}
            onFocus={setFocus}
          />
        )}
      </div>
    </div>
  )
}

function ObjectChip({
  object,
  badge,
  lifted,
  orphan,
  onClick,
}: {
  object: PyObject
  badge?: string | undefined
  lifted: boolean
  orphan: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`chip object ${object.kind} ${lifted ? 'lifted' : ''} ${orphan ? 'orphan' : ''}`}
      data-testid={`object-${object.id}`}
      data-type={object.type}
      aria-pressed={lifted}
      onClick={onClick}
      title={orphan ? 'Nothing points at this any more' : undefined}
    >
      <span className="type">{object.type}</span>
      <span className="repr">{object.repr}</span>
      {/* Only reference objects get an identity. Values are equal-or-not,
          never same-or-not, and a badge would invite the wrong question. */}
      {badge && <span className="badge">{badge}</span>}
    </button>
  )
}

function Inspector({
  focus,
  focusedObjectId,
  snapshot,
  badges,
  onFocus,
}: {
  focus: NonNullable<Focus>
  focusedObjectId: ObjectId | null
  snapshot: MemorySnapshot
  badges: Record<ObjectId, string>
  onFocus: (f: Focus) => void
}) {
  const object = focusedObjectId === null ? null : (snapshot.objects[focusedObjectId] ?? null)

  return (
    <div className="pulled">
      {focus.on === 'name' && (
        <div className="pulled-name">
          <span className="chip name lifted big">{focus.name}</span>
          <span className="arrow" aria-label="points at">
            →
          </span>
        </div>
      )}

      {object === null ? (
        <p className="none">This name points at nothing the robot can show.</p>
      ) : (
        <ObjectCard object={object} snapshot={snapshot} badges={badges} onFocus={onFocus} />
      )}
    </div>
  )
}

function ObjectCard({
  object,
  snapshot,
  badges,
  onFocus,
}: {
  object: PyObject
  snapshot: MemorySnapshot
  badges: Record<ObjectId, string>
  onFocus: (f: Focus) => void
}) {
  const names = namesFor(snapshot, object.id)
  const holders = holdersOf(snapshot, object.id)

  return (
    <div className={`card ${object.kind}`} data-testid="object-card">
      <header>
        <span className="type">{object.type}</span>
        {badges[object.id] && <span className="badge">{badges[object.id]}</span>}
        <span className="kind-note">
          {object.kind === 'value'
            ? 'a value — equal values are the same entry'
            : 'an object with its own identity'}
        </span>
      </header>

      <div className="value">{object.repr}</div>

      {object.elements !== null && (
        <div className="elements">
          <h4>
            {object.elements.length === 0
              ? 'holds nothing'
              : `holds ${object.elements.length} pointer${object.elements.length === 1 ? '' : 's'}`}
          </h4>
          <div className="chips">
            {object.elements.map((e, i) => {
              const target = snapshot.objects[e.target]
              return (
                <button
                  key={i}
                  type="button"
                  className="chip element"
                  data-testid={`element-${i}`}
                  onClick={() => onFocus({ on: 'object', id: e.target })}
                >
                  {e.label !== null && <span className="slot">{e.label}</span>}
                  <span className="repr">{target ? target.repr : '?'}</span>
                  {badges[e.target] && <span className="badge">{badges[e.target]}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {object.partial && (
        <p className="warn">
          The robot could not show all of this — it hit a limit, or it refuses to inspect it.
        </p>
      )}

      <footer>
        <span className="quiet">pointed at by</span>
        {names.length === 0 && holders.length === 0 && <span className="none">nothing</span>}
        {names.map((b) => (
          <button
            key={`${b.scope}:${b.name}`}
            type="button"
            className="chip name small"
            onClick={() => onFocus({ on: 'name', name: b.name, scope: b.scope })}
          >
            {b.name}
          </button>
        ))}
        {holders.map((h) => (
          <button
            key={h.id}
            type="button"
            className="chip object small"
            onClick={() => onFocus({ on: 'object', id: h.id })}
          >
            <span className="type">{h.type}</span>
            {badges[h.id] && <span className="badge">{badges[h.id]}</span>}
          </button>
        ))}
      </footer>
    </div>
  )
}
