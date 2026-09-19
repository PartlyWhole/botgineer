/**
 * Draggable gutters.
 *
 * Three panes competing for one column always squeezes something. Rather
 * than pick a compromise nobody likes, the split is the player's: drag it,
 * and it is remembered.
 *
 * Keyboard-operable (arrow keys) and announced as a separator, because a
 * layout you can only change with a mouse is a layout some people cannot
 * change at all.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

type Orientation = 'horizontal' | 'vertical'

type Props = {
  /** Which axis the gutter moves along: 'vertical' sits between columns and
   *  drags left/right; 'horizontal' sits between rows and drags up/down. */
  orientation: Orientation
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  /** Dragging away from the origin usually grows the pane before the
   *  gutter; set false when the controlled pane is after it. */
  invert?: boolean
  label: string
}

export function Gutter({ orientation, value, onChange, min, max, invert, label }: Props) {
  const dragging = useRef<{ start: number; from: number } | null>(null)
  const clamp = useCallback((n: number) => Math.min(max, Math.max(min, n)), [min, max])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragging.current
      if (!d) return
      const pos = orientation === 'vertical' ? e.clientX : e.clientY
      const delta = (pos - d.start) * (invert ? -1 : 1)
      onChange(clamp(d.from + delta))
    }
    const up = () => {
      dragging.current = null
      document.body.classList.remove('dragging')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [clamp, invert, onChange, orientation])

  return (
    <div
      className={`gutter ${orientation}`}
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(e) => {
        dragging.current = {
          start: orientation === 'vertical' ? e.clientX : e.clientY,
          from: value,
        }
        document.body.classList.add('dragging')
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 48 : 16
        const back = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp'
        const fwd = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown'
        if (e.key !== back && e.key !== fwd) return
        e.preventDefault()
        const dir = (e.key === fwd ? 1 : -1) * (invert ? -1 : 1)
        onChange(clamp(value + dir * step))
      }}
    />
  )
}

/** A number remembered across visits. Layout is a preference, not state the
 *  app depends on, so a blocked or empty storage is not an error. */
export function useRemembered(key: string, fallback: number): [number, (n: number) => void] {
  const [value, setValue] = useState<number>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      const n = raw === null ? NaN : Number(raw)
      return Number.isFinite(n) ? n : fallback
    } catch {
      return fallback
    }
  })
  const set = useCallback(
    (n: number) => {
      setValue(n)
      try {
        window.localStorage.setItem(key, String(n))
      } catch {
        // Private mode, blocked storage: the layout just will not persist.
      }
    },
    [key],
  )
  return [value, set]
}
