/**
 * A draggable cloud of pills.
 *
 * Positions live in a ref and are written straight to `style.transform` in
 * the animation loop — React is not asked to re-render sixty times a
 * second, and the same discipline that keeps the trace stream from locking
 * the page applies here.
 *
 * Positions persist by id across snapshots. Scrubbing a trace changes the
 * contents constantly, and a cloud that reshuffles on every step is
 * unreadable; only genuinely new pills are placed, and they are placed
 * deterministically.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { advance, makeNode, pack, type Bounds, type CloudNode } from './cloudLayout'

export type CloudItem = {
  id: string
  className?: string
  testId?: string
  /** Surfaced as `data-type`, so the type is assertable without reading
   *  the rendered text. */
  dataType?: string
  content: ReactNode
}

type Props = {
  title: string
  items: CloudItem[]
  /** Clicking a pill. The rect is where it was on screen, so the caller
   *  can animate the pull-out from exactly there. */
  onPick: (id: string, from: DOMRect) => void
  /** The pill currently pulled out: it stays in place as a gap so the
   *  cloud does not reflow underneath the animation. */
  liftedId: string | null
  dimmed: boolean
}

/** Below this, a pointer gesture was a click rather than a drag. */
const DRAG_SLOP = 4

export function Cloud({ title, items, onPick, liftedId, dimmed }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const chipRefs = useRef(new Map<string, HTMLButtonElement>())
  const nodes = useRef(new Map<string, CloudNode>())
  const bounds = useRef<Bounds>({ w: 320, h: 160 })
  const raf = useRef<number | null>(null)

  const paint = useCallback(() => {
    for (const [id, el] of chipRefs.current) {
      const n = nodes.current.get(id)
      if (n) el.style.transform = `translate(${n.x}px, ${n.y}px) translate(-50%, -50%)`
    }
  }, [])

  /** Eases pills toward wherever packing put them, then stops. Layout is
   *  decided by `pack`; this only moves things there. */
  const glide = useCallback(() => {
    if (raf.current !== null) return
    const tick = () => {
      const left = advance([...nodes.current.values()])
      paint()
      if (left === 0) {
        raf.current = null
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [paint])

  const relayout = useCallback(() => {
    pack([...nodes.current.values()], bounds.current)
    glide()
  }, [glide])

  // Measure, add and remove pills, then let the cloud settle again.
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    bounds.current = { w: box.clientWidth, h: box.clientHeight }

    const live = new Set(items.map((i) => i.id))
    for (const id of [...nodes.current.keys()]) if (!live.has(id)) nodes.current.delete(id)

    for (const item of items) {
      const el = chipRefs.current.get(item.id)
      let n = nodes.current.get(item.id)
      if (!n) {
        n = makeNode(item.id)
        nodes.current.set(item.id, n)
      }
      if (el) {
        n.w = el.offsetWidth
        n.h = el.offsetHeight
      }
    }

    relayout()
    paint()
  }, [items, paint, relayout])

  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      bounds.current = { w: box.clientWidth, h: box.clientHeight }
      relayout()
    })
    ro.observe(box)
    return () => ro.disconnect()
  }, [relayout])

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    },
    [],
  )

  const onPointerDown = (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const node = nodes.current.get(id)
    const box = boxRef.current
    if (!node || !box) return

    const start = { x: e.clientX, y: e.clientY }
    const origin = { x: node.x, y: node.y }
    let dragged = false
    node.held = true
    e.currentTarget.setPointerCapture(e.pointerId)

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      if (!dragged && Math.hypot(dx, dy) < DRAG_SLOP) return
      dragged = true
      box.classList.add('dragging-chip')
      node.x = origin.x + dx
      node.y = origin.y + dy
      paint()
      // The cloud parts while the pill is still moving.
      relayout()
    }

    const up = (ev: PointerEvent) => {
      node.held = false
      // Dropped pills stay where they were put; the rest of the cloud
      // reorganises around them. Letting go without pinning sent the pill
      // straight back where it came from, because packing is
      // deterministic — so dragging did nothing at all.
      if (dragged) node.pinned = true
      box.classList.remove('dragging-chip')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      relayout()
      if (!dragged) onPick(id, (ev.target as HTMLElement).getBoundingClientRect())
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <section className={`cloud ${dimmed ? 'dimmed' : ''}`} aria-label={title}>
      <h3>
        {title} <span className="count">{items.length}</span>
        <button
          type="button"
          className="tidy"
          data-testid={`tidy-${title.toLowerCase()}`}
          title="Put every pill back in the cloud"
          onClick={() => {
            for (const n of nodes.current.values()) n.pinned = false
            relayout()
          }}
        >
          tidy
        </button>
      </h3>
      <div className="cloud-box" ref={boxRef}>
        {items.length === 0 && <p className="none cloud-empty">nothing yet</p>}
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            ref={(el) => {
              if (el) chipRefs.current.set(item.id, el)
              else chipRefs.current.delete(item.id)
            }}
            className={`chip ${item.className ?? ''} ${liftedId === item.id ? 'lifted' : ''}`}
            data-testid={item.testId}
            data-type={item.dataType}
            aria-pressed={liftedId === item.id}
            onPointerDown={onPointerDown(item.id)}
            onKeyDown={(e) => {
              // Keyboard users get the same thing without a pointer.
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onPick(item.id, e.currentTarget.getBoundingClientRect())
              }
            }}
          >
            {item.content}
          </button>
        ))}
      </div>
    </section>
  )
}
