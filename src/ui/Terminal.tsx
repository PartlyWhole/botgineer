/**
 * A real terminal emulator, not a text pane.
 *
 * The chunk store is the source of truth and the xterm screen is a replay
 * view of it, so a re-mount or a resize cannot lose output. Console records
 * are written straight through; nothing is line-buffered, because progress
 * output using \r has to work.
 */
import { useCallback, useEffect, useRef } from 'react'
import { Terminal as Xterm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export type TerminalHandle = {
  write: (text: string, stream?: 'stdout' | 'stderr') => void
  clear: () => void
}

export function useTerminal(): {
  containerRef: (el: HTMLDivElement | null) => void
  handle: TerminalHandle
} {
  const term = useRef<Xterm | null>(null)
  const fit = useRef<FitAddon | null>(null)
  const chunks = useRef<{ text: string; stream: 'stdout' | 'stderr' }[]>([])

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) {
      term.current?.dispose()
      term.current = null
      return
    }
    if (term.current) return
    const t = new Xterm({
      convertEol: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      theme: { background: '#131a2a', foreground: '#dfe6f5', cursor: '#131a2a' },
      cursorBlink: false,
      disableStdin: true,
    })
    const f = new FitAddon()
    t.loadAddon(f)
    t.open(el)
    f.fit()
    term.current = t
    fit.current = f
    // Replay anything written before the pane existed.
    for (const c of chunks.current) t.write(paint(c.text, c.stream))
  }, [])

  useEffect(() => {
    const onResize = () => fit.current?.fit()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handle: TerminalHandle = {
    write(text, stream = 'stdout') {
      chunks.current.push({ text, stream })
      term.current?.write(paint(text, stream))
    },
    clear() {
      chunks.current = []
      term.current?.clear()
      term.current?.write('\x1b[2J\x1b[H')
    },
  }

  return { containerRef, handle }
}

/** stderr is styled distinctly; stdout passes through untouched so the
 *  program's own ANSI still works. */
function paint(text: string, stream: 'stdout' | 'stderr'): string {
  return stream === 'stderr' ? `\x1b[38;5;210m${text}\x1b[0m` : text
}

export function TerminalPane({
  containerRef,
}: {
  containerRef: (el: HTMLDivElement | null) => void
}) {
  return <div className="terminal-host" ref={containerRef} />
}
