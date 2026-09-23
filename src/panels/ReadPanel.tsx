/**
 * (B) The instrument for reading: the code, and the answers about it.
 *
 * On top, the snippet — or one tab per snippet when there are two — as
 * read-only code whose lines can be clicked. Under it, one widget per
 * thing the exercise asks, and the commit. Memory sits below this panel,
 * as always, and stays empty until the commit: the robot has not run
 * anything yet, and the whole point is to say what it will do first.
 *
 * After the commit the run is revealed — memory, the scrubber, the output
 * — and anything left to *do* appears: a repair to make, a program to
 * write, a rule to mark. A repair is written in the real editor, which
 * owns its text (invariant 7): what is sent is what `read()` says is on
 * screen, never a copy in React state.
 *
 * This panel causes nothing on its own. It hands answers to the session,
 * and the session runs things through the workbench.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { CodeEditor, type EditorApi } from '../ui/CodeEditor'
import { CodeView, type LineMark } from '../ui/CodeView'
import { PartForm, PICKS_LINES } from '../ui/forms'
import { richText } from '../ui/richText'
import type { ReadSession } from '../collection/useReadSession'
import { isPrediction } from '../collection/runner'
import { snippetIndex } from '../collection/grade'
import type { Answer, Part } from '../collection/model'

type Props = {
  session: ReadSession
  traceLine: number | null
  /** Shows a snippet's run in memory, for switching tabs after the commit. */
  onShow: (source: string) => void
  busy: boolean
  /** Said on the last item, when there is no next one: the level's own
   *  way on is in the scene. */
  finishedLabel?: string
}

export function ReadPanel({ session, traceLine, onShow, busy }: Props) {
  const { current, state } = session
  const [tab, setTab] = useState(0)
  const [picker, setPicker] = useState<number | null>(null)
  const editorRef = useRef<EditorApi | null>(null)

  const item = current
  const parts = item?.spec.parts ?? []
  const revealed = state?.phase === 'revealed'

  // A fresh item starts on its first snippet, with the obvious picker.
  const itemId = item?.id
  const panelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 })
    setTab(0)
    const pickers = parts.map((p, i) => ({ p, i })).filter(({ p }) => PICKS_LINES.has(p.kind))
    setPicker(pickers.length === 1 ? pickers[0]!.i : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  // The act that is up: the first repair or program not yet passed.
  const acting = revealed ? parts.findIndex((p, i) => (p.kind === 'fix' || p.kind === 'write') && !state!.acts[i]?.result?.right) : -1
  const act = acting >= 0 ? state!.acts[acting]! : null
  const actPart = acting >= 0 ? (parts[acting] as Part & { kind: 'fix' | 'write' }) : null

  const labels = item?.snippets.map((s) => s.label) ?? []
  const pickerPart = picker !== null ? parts[picker] : undefined
  // A part about snippet B brings its tab forward while it is picking.
  useEffect(() => {
    if (pickerPart && 'snippet' in pickerPart && pickerPart.snippet !== undefined) setTab(snippetIndex(pickerPart.snippet, labels))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker])

  const marks = useMemo(() => {
    const m = new Map<number, LineMark>()
    if (!state || picker === null || !pickerPart) return m
    const a = state.answers[picker]
    if (pickerPart.kind === 'line' && a?.kind === 'line' && a.line) {
      const g = state.graded[picker]
      m.set(a.line, { tone: g ? (g.right ? 'right' : 'wrong') : 'pick' })
    }
    if (pickerPart.kind === 'order' && a?.kind === 'order') {
      const at = new Map<number, number[]>()
      a.lines.forEach((l, i) => at.set(l, [...(at.get(l) ?? []), i + 1]))
      for (const [l, ns] of at) m.set(l, { tone: 'pick', badge: <span className="order-badge">{ns.join(' · ')}</span> })
    }
    if (pickerPart.kind === 'block' && a?.kind === 'block') {
      for (const l of a.body) m.set(l, { tone: 'body' })
      m.set(pickerPart.header, { ...m.get(pickerPart.header), badge: <span className="order-badge">header</span> })
    }
    return m
  }, [picker, pickerPart, state])

  if (!item || !state) return null

  const answer = (i: number) => state.answers[i] ?? null
  const setAnswer = (i: number, a: Answer) => session.setAnswer(i, a)

  const onLine = (n: number) => {
    if (picker === null || !pickerPart || revealed) return
    const a = answer(picker)
    if (pickerPart.kind === 'line') setAnswer(picker, { kind: 'line', line: n })
    if (pickerPart.kind === 'order') setAnswer(picker, { kind: 'order', lines: [...(a?.kind === 'order' ? a.lines : []), n] })
    if (pickerPart.kind === 'block') {
      const body = a?.kind === 'block' ? a.body : []
      const counts = a?.kind === 'block' ? a.counts : {}
      setAnswer(picker, { kind: 'block', body: body.includes(n) ? body.filter((x) => x !== n) : [...body, n], counts })
    }
  }

  const snippet = item.snippets[tab]
  const pickable = !revealed && picker !== null

  return (
    <div className="read-panel" data-testid="read-panel" data-phase={state.phase} data-item={item.id} ref={panelRef}>
      <div className="read-code">
        {item.snippets.length > 1 && !actPart && (
          <div className="snippet-tabs" role="tablist" aria-label="Snippets">
            {item.snippets.map((s, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={tab === i}
                className={tab === i ? 'on' : ''}
                onClick={() => {
                  setTab(i)
                  if (revealed) onShow(s.code)
                }}
                data-testid={`tab-${s.label ?? i}`}
              >
                {s.label ? (s.label.length === 1 ? `Snippet ${s.label}` : s.label) : `Snippet ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        {actPart && act ? (
          <div className="read-editor">
            <CodeEditor
              key={`${item.id}:${acting}`}
              solution={act.source}
              onSolution={() => {}}
              onReady={(api) => {
                editorRef.current = api
              }}
              traceLine={traceLine}
              disabled={busy || act.busy}
            />
          </div>
        ) : snippet ? (
          <CodeView
            code={snippet.code}
            traceLine={revealed ? traceLine : null}
            marks={marks}
            marker={snippet.marker}
            onLine={pickable ? onLine : undefined}
            pickLabel={pickerPart?.kind === 'order' ? 'Number line' : pickerPart?.kind === 'block' ? 'Mark line' : 'Pick line'}
            label={snippet.label ? `Snippet ${snippet.label}` : 'The code'}
          />
        ) : (
          <p className="read-nocode quiet">This one has no code to read — it is about the idea.</p>
        )}
      </div>

      <div className="read-parts" data-testid="read-parts">
        {parts.map((p, i) =>
          isPrediction(p) ? (
            <section key={i} className={`read-part ${picker === i ? 'picking' : ''}`} data-kind={p.kind} data-testid={`part-${i}`}>
              <PartForm
                part={p}
                answer={answer(i)}
                onAnswer={(a) => setAnswer(i, a)}
                locked={revealed}
                graded={state.graded[i] ?? null}
                truth={state.truth}
                index={i}
                picking={picker === i}
                onPicking={(on) => setPicker(on ? i : null)}
                onMark={(m) => session.mark(i, m)}
              />
            </section>
          ) : null,
        )}

        {!revealed && (
          <div className="commit-row">
            <button
              type="button"
              className="primary commit"
              disabled={!session.canCommit || busy}
              onClick={() => void session.commit()}
              data-testid="commit"
            >
              {state.truth ? 'Commit — then let the robot run it' : 'Getting the robot ready…'}
            </button>
            <p className="commit-note quiet">Your answers lock when you commit. Only the first commit counts.</p>
          </div>
        )}

        {actPart && act && (
          <section className="read-part act" data-kind={actPart.kind} data-testid={`act-${acting}`}>
            <p className="form-label">
              {richText(actPart.prompt ?? (actPart.kind === 'fix' ? 'Now repair it, above — the smallest change that works.' : 'Write it above, then send it.'))}
            </p>
            <div className="form-row">
              <button
                type="button"
                className="primary"
                disabled={busy || act.busy}
                onClick={() => void session.submit(acting, editorRef.current?.read() ?? act.source)}
                data-testid="send-fix"
              >
                {act.busy ? 'Checking…' : 'Send to robot'}
              </button>
              {act.tries >= 2 && (
                <button type="button" onClick={() => session.reveal(acting)} data-testid="show-key-fix">
                  Show the key’s version
                </button>
              )}
            </div>
            {act.result && !act.result.right && (
              <div className="verdict wrong" data-testid="act-verdict">
                <p className="verdict-head">Not yet</p>
                {act.result.why && <p className="verdict-why">{richText(act.result.why)}</p>}
              </div>
            )}
          </section>
        )}

        {revealed &&
          parts.map((p, i) => {
            if (p.kind !== 'fix' && p.kind !== 'write') return null
            const done = state.acts[i]?.result
            if (!done?.right) return null
            return (
              <div key={i} className="verdict right" data-testid={`act-done-${i}`}>
                <p className="verdict-head">{state.acts[i]!.first ? 'Works — first time.' : 'Works.'}</p>
                {done.note && <p className="verdict-note">{richText(done.note)}</p>}
              </div>
            )
          })}

        {session.resolved && (
          <div className="commit-row">
            <button type="button" className="primary" onClick={session.next} data-testid="next-item">
              {session.at + 1 < session.items.length ? 'Next' : 'Finish'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
