/**
 * (C) The memory panel: two clouds, and what connects them.
 *
 * Names in one cloud, objects in the other. Both are draggable and
 * re-settle; neither is a list, because neither is ordered and pretending
 * otherwise teaches a sequence that is not there.
 *
 * Picking a pill *pulls it out*: the clouds shrink back and blur, the pill
 * flies from exactly where it sat into the middle at full size, and the
 * object it points at is pulled out of the other cloud the same way, with
 * an arrow drawn between them. The animation is a FLIP — the pill is
 * measured in the cloud, rendered at its destination, and animated from
 * the difference — so it is the same element arriving, not a copy fading
 * in somewhere else.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  holdersOf,
  identityBadges,
  namesFor,
  unreferenced,
  type Binding,
  type MemorySnapshot,
  type ObjectId,
  type PyObject,
} from '../memory/model'
import { Cloud, type CloudItem } from './Cloud'

type Focus = {
  /** The name that was picked, when a name was picked. */
  name: { name: string; scope: string } | null
  objectId: ObjectId
}

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

const nameKey = (b: { scope: string; name: string }) => `${b.scope}:${b.name}`

export function MemoryPanel({ snapshot }: { snapshot: MemorySnapshot }) {
  const [focus, setFocus] = useState<Focus | null>(null)
  const badges = useMemo(() => identityBadges(snapshot), [snapshot])
  const orphans = useMemo(() => new Set(unreferenced(snapshot)), [snapshot])

  const objects = useMemo(
    () =>
      Object.values(snapshot.objects).sort(
        (a, b) =>
          a.kind.localeCompare(b.kind) ||
          a.type.localeCompare(b.type) ||
          a.repr.localeCompare(b.repr),
      ),
    [snapshot],
  )

  // Where the pills sat before the pull-out, for the FLIP.
  const flight = useRef<{ name: DOMRect | null; object: DOMRect | null }>({
    name: null,
    object: null,
  })
  const namePillRef = useRef<HTMLDivElement | null>(null)
  const objectPillRef = useRef<HTMLDivElement | null>(null)

  const rectOf = (testId: string): DOMRect | null =>
    document.querySelector(`[data-testid="${CSS.escape(testId)}"]`)?.getBoundingClientRect() ?? null

  const pickName = useCallback(
    (key: string, from: DOMRect) => {
      const binding = snapshot.bindings.find((b) => nameKey(b) === key)
      if (!binding) return
      flight.current = { name: from, object: rectOf(`object-${binding.target}`) }
      setFocus({ name: { name: binding.name, scope: binding.scope }, objectId: binding.target })
    },
    [snapshot],
  )

  const pickObject = useCallback((id: ObjectId, from: DOMRect) => {
    flight.current = { name: null, object: from }
    setFocus({ name: null, objectId: id })
  }, [])

  /** Moving inside the stage: re-fly from wherever that object sits now. */
  const goToObject = useCallback((id: ObjectId) => {
    flight.current = { name: null, object: rectOf(`object-${id}`) ?? objectPillRef.current?.getBoundingClientRect() ?? null }
    setFocus({ name: null, objectId: id })
  }, [])

  const goToName = useCallback(
    (b: Binding) => {
      flight.current = { name: rectOf(`name-${b.name}`), object: rectOf(`object-${b.target}`) }
      setFocus({ name: { name: b.name, scope: b.scope }, objectId: b.target })
    },
    [],
  )

  // The FLIP itself: measure the destination, animate in from the
  // difference. Nothing is duplicated — the pill in the cloud is a gap.
  useLayoutEffect(() => {
    const pending = flight.current
    flight.current = { name: null, object: null }
    if (!focus || reduced()) return

    const pairs: [HTMLElement | null, DOMRect | null][] = [
      [namePillRef.current, pending.name],
      [objectPillRef.current, pending.object],
    ]
    for (const [el, from] of pairs) {
      if (!el || !from) continue
      const to = el.getBoundingClientRect()
      if (to.width === 0) continue
      const dx = from.left + from.width / 2 - (to.left + to.width / 2)
      const dy = from.top + from.height / 2 - (to.top + to.height / 2)
      const s = Math.max(0.25, Math.min(1, from.width / to.width))
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.75 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 440, easing: 'cubic-bezier(.2,.85,.25,1.1)' },
      )
    }
  }, [focus])

  // A selection the program no longer has would silently show nothing.
  useEffect(() => {
    if (!focus) return
    const gone =
      !snapshot.objects[focus.objectId] ||
      (focus.name !== null &&
        !snapshot.bindings.some(
          (b) => b.name === focus.name?.name && b.scope === focus.name.scope,
        ))
    if (gone) setFocus(null)
  }, [focus, snapshot])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocus(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const focused = focus !== null
  const object = focus ? (snapshot.objects[focus.objectId] ?? null) : null

  const nameItems: CloudItem[] = snapshot.bindings.map((b) => ({
    id: nameKey(b),
    className: 'name',
    testId: `name-${b.name}`,
    content: (
      <>
        {b.scope !== 'global' && <span className="scope">{b.scope}</span>}
        {b.name}
      </>
    ),
  }))

  const objectItems: CloudItem[] = objects.map((o) => ({
    id: o.id,
    className: `object ${o.kind} ${orphans.has(o.id) ? 'orphan' : ''}`,
    testId: `object-${o.id}`,
    dataType: o.type,
    content: (
      <>
        <span className="type">{o.type}</span>
        <span className="repr">{o.repr}</span>
        {badges[o.id] && <span className="badge">{badges[o.id]}</span>}
      </>
    ),
  }))

  if (snapshot.bindings.length === 0 && objects.length === 0) {
    return (
      <div className="memory empty" data-testid="memory">
        <p>Memory is empty. Send the robot some code and whatever it builds turns up here.</p>
      </div>
    )
  }

  return (
    <div className={`memory ${focused ? 'focused' : ''}`} data-testid="memory" data-focused={focused ? 'yes' : 'no'}>
      <div className="clouds">
        <Cloud
          title="Names"
          items={nameItems}
          onPick={pickName}
          liftedId={focus?.name ? nameKey(focus.name) : null}
          dimmed={focused}
        />
        <Cloud
          title="Objects"
          items={objectItems}
          onPick={pickObject}
          liftedId={focus?.objectId ?? null}
          dimmed={focused}
        />
      </div>

      {focus && (
        <div className="stage-focus" data-testid="stage">
          <div className="focus-row">
            {focus.name && (
              <>
                <div className="focus-pill name" ref={namePillRef} data-testid="focus-name">
                  {focus.name.name}
                </div>
                <PointsAt />
              </>
            )}

            {object === null ? (
              <p className="none">This name points at nothing the robot can show.</p>
            ) : (
              <div
                className={`focus-pill object ${object.kind}`}
                ref={objectPillRef}
                data-testid="focus-object"
              >
                <span className="type">{object.type}</span>
                <span className="repr">{object.repr}</span>
                {badges[object.id] && <span className="badge">{badges[object.id]}</span>}
              </div>
            )}

            <button type="button" className="dismiss" onClick={() => setFocus(null)} data-testid="dismiss">
              Back to the cloud
            </button>
          </div>

          {object && (
            <ObjectDetail
              object={object}
              snapshot={snapshot}
              badges={badges}
              onObject={goToObject}
              onName={goToName}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** The arrow. It draws itself in, which is what makes the pair read as
 *  one relationship rather than two things that happen to be adjacent. */
function PointsAt() {
  return (
    <svg className="points-at" viewBox="0 0 80 24" role="img" aria-label="points at">
      <defs>
        <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" />
        </marker>
      </defs>
      <line x1="4" y1="12" x2="66" y2="12" markerEnd="url(#arrowhead)" />
    </svg>
  )
}

function ObjectDetail({
  object,
  snapshot,
  badges,
  onObject,
  onName,
}: {
  object: PyObject
  snapshot: MemorySnapshot
  badges: Record<ObjectId, string>
  onObject: (id: ObjectId) => void
  onName: (b: Binding) => void
}) {
  const names = namesFor(snapshot, object.id)
  const holders = holdersOf(snapshot, object.id)

  return (
    <div className="detail" data-testid="object-card">
      <p className="kind-note">
        {object.kind === 'value'
          ? 'A value. Equal values are the same entry, and it has no identity of its own.'
          : 'An object with its own identity — two of these can look the same and still be different.'}
      </p>

      {object.elements !== null && (
        <div className="elements">
          <h4>
            {object.elements.length === 0
              ? 'holds nothing'
              : `holds ${object.elements.length} pointer${object.elements.length === 1 ? '' : 's'}`}
          </h4>
          <div className="row">
            {object.elements.map((e, i) => {
              const target = snapshot.objects[e.target]
              return (
                <button
                  key={i}
                  type="button"
                  className="chip element"
                  data-testid={`element-${i}`}
                  onClick={() => onObject(e.target)}
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

      <div className="held-by">
        <span className="quiet">pointed at by</span>
        {names.length === 0 && holders.length === 0 && <span className="none">nothing</span>}
        {names.map((b) => (
          <button
            key={nameKey(b)}
            type="button"
            className="chip name small"
            onClick={() => onName(b)}
          >
            {b.name}
          </button>
        ))}
        {holders.map((h) => (
          <button
            key={h.id}
            type="button"
            className="chip object small"
            onClick={() => onObject(h.id)}
          >
            <span className="type">{h.type}</span>
            {badges[h.id] && <span className="badge">{badges[h.id]}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
