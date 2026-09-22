/**
 * Memory, alongside the thing that changes it.
 *
 * The Memory view shows the whole field, but you have to leave the
 * console to look at it — so while you are actually instructing the robot,
 * the effect of what you typed is on the other tab. That is the wrong way
 * round: the moment a beginner most needs to see an object appear is the
 * moment they made it.
 *
 * So this is a strip of what the robot is holding, under the place you
 * type, updating as you type. It is the same snapshot the graph and the
 * scene read — a third rendering, not a third idea (invariant 2).
 *
 * It answers two questions and deliberately not a third: *what exists*,
 * and *what is named*. Pointer structure — which collection holds what —
 * is the graph's job, because showing it here would need edges, and edges
 * need room this strip does not have.
 *
 * For the same reason a collection is collapsed to one chip: `[1, 2, 3]`
 * is four objects, and four chips for one typed line buries what the
 * player made. The chip still says `3 items` rather than the contents —
 * hiding the elements is not the same as drawing them inside their
 * container, which is the thing invariant 4 forbids.
 */
import { useEffect, useRef } from 'react'
import { namesFor, topLevel, type MemorySnapshot, type ObjectId } from '../memory/model'

export function MemoryRail({
  snapshot,
  handles,
}: {
  snapshot: MemorySnapshot
  handles: Map<ObjectId, string>
}) {
  const scroller = useRef<HTMLDivElement | null>(null)
  // Collapsed: a collection's own elements do not each take a chip. See
  // `topLevel` for what that leaves out and why it is not inlining.
  const ids = topLevel(snapshot)

  // Keep the newest object in view. It is the one that just appeared, and
  // it is the reason anyone is looking at this strip.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [ids.length])

  if (ids.length === 0) {
    return (
      <div className="rail empty" data-testid="rail">
        <p>Nothing in memory yet.</p>
      </div>
    )
  }

  return (
    <div className="rail" data-testid="rail" ref={scroller}>
      {ids.map((id) => {
        const object = snapshot.objects[id]
        if (!object) return null
        const names = namesFor(snapshot, id)
        return (
          <div
            key={id}
            className={`rail-cell ${names.length === 0 ? 'nameless' : ''}`}
            data-testid={`rail-${handles.get(id) ?? id}`}
            data-names={names.length}
          >
            {/* Names sit above the object they point at, all of them:
                two names on one object is the point of the second lesson,
                and a strip that showed only the first would hide it. */}
            <div className="rail-names">
              {names.length === 0 ? (
                <span className="rail-unnamed" title="No name points at this object">
                  —
                </span>
              ) : (
                names.map((b) => (
                  <span key={`${b.scope}:${b.name}`} className="rail-name">
                    {b.name}
                  </span>
                ))
              )}
            </div>
            <div className={`rail-object ${object.kind}`}>
              <span className="rail-handle">{handles.get(id) ?? '?'}</span>
              <span className="rail-type">{object.type}</span>
              <span className="rail-repr">{object.repr}</span>
              {object.partial && <span className="rail-partial">…</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
