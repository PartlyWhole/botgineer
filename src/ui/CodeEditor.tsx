/**
 * The code editor: one CodeMirror document holding the whole program.
 *
 * The preamble and the harness are part of the same document as the
 * player's code, not separate boxes. That buys three things a split editor
 * cannot: the line numbers on screen are the line numbers Python reports,
 * the trace can highlight the executing line in place, and the program the
 * player reads is literally the program that runs.
 *
 * Those two regions are protected by a change filter rather than hidden.
 * A tool that conjures `parcels` from nowhere teaches that data comes from
 * nowhere.
 */
import { useEffect, useRef } from 'react'
import {
  Compartment,
  EditorState,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  keymap,
  lineNumbers,
  type DecorationSet,
} from '@codemirror/view'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
  toggleComment,
} from '@codemirror/commands'
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
  bracketMatching,
} from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import { tags as t } from '@lezer/highlight'

type Props = {
  /** Exact text before the editable region, including its trailing
   *  newline. Empty when the whole document is the player's. */
  head?: string
  /** Exact text after the editable region, including its leading newline. */
  tail?: string
  solution: string
  onSolution: (next: string) => void
  /** 1-based line in the whole program currently shown by the trace. */
  traceLine: number | null
  disabled: boolean
  /** Handed an imperative handle once the editor exists. The debug API the
   *  browser tests drive uses this instead of typing into a contenteditable. */
  onReady?: (api: EditorApi) => void
}

export type EditorApi = {
  /** Replaces the editable region, leaving the locked regions alone. */
  replace: (next: string) => void
  /** The editable region as it is RIGHT NOW. The editor owns the text, so
   *  anything that needs the current program asks here rather than waiting
   *  for React to re-render with it. */
  read: () => string
  focus: () => void
}

/* -------------------------------------------------------------------- */

const setTraceLine = StateEffect.define<number | null>()

const traceLineField = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setTraceLine)) return e.value
    return value
  },
})

const lockedLine = Decoration.line({ class: 'cm-locked' })
const tracedLine = Decoration.line({ class: 'cm-traced' })

/** Dims the two protected regions and marks the line the trace is showing.
 *  Recomputed from the document, so it stays correct as the player types. */
function regionDecorations(headLen: number, tailLen: number): Extension {
  return EditorView.decorations.compute(['doc', traceLineField], (state) => {
    const builder: { from: number; value: Decoration }[] = []
    const tailStart = state.doc.length - tailLen
    const traced = state.field(traceLineField)

    for (let n = 1; n <= state.doc.lines; n++) {
      const line = state.doc.line(n)
      const locked = line.to <= headLen || line.from > tailStart
      if (locked) builder.push({ from: line.from, value: lockedLine })
      if (traced === n) builder.push({ from: line.from, value: tracedLine })
    }
    builder.sort((a, b) => a.from - b.from)
    return Decoration.set(
      builder.map((b) => b.value.range(b.from)),
      true,
    ) as DecorationSet
  })
}

/** Python-flavoured highlighting, tuned for a light background. */
const highlight = HighlightStyle.define([
  { tag: t.keyword, color: '#8250df', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#0a7d4c' },
  { tag: t.number, color: '#b3541e' },
  { tag: t.comment, color: '#6b7794', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#1a5fd0' },
  { tag: t.definition(t.variableName), color: '#16203a' },
  { tag: t.operator, color: '#5b6784' },
  { tag: t.bool, color: '#8250df' },
])

const theme = EditorView.theme({
  '&': { fontSize: '13px', backgroundColor: '#ffffff' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    lineHeight: '1.6',
  },
  '.cm-content': { padding: '8px 0' },
  '.cm-gutters': {
    backgroundColor: '#f6f8fe',
    border: 'none',
    borderRight: '1px solid #dde3f2',
    color: '#9aa6c2',
  },
  '.cm-locked': { backgroundColor: '#f6f8fe', color: '#5b6784' },
  '.cm-traced': { backgroundColor: '#fff4cc', boxShadow: 'inset 3px 0 0 #e0a500' },
})

/** Editability is swapped while a run is in flight, which needs a
 *  compartment: a facet cannot be reconfigured on its own. */
const editable = new Compartment()

/* -------------------------------------------------------------------- */

export function CodeEditor({
  head = '',
  tail = '',
  solution,
  onSolution,
  traceLine,
  disabled,
  onReady,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Read through refs so the editor is built once: rebuilding it on every
  // keystroke would lose the cursor, the selection and the undo history.
  const onSolutionRef = useRef(onSolution)
  onSolutionRef.current = onSolution
  const boundsRef = useRef({ head, tail })
  boundsRef.current = { head, tail }
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const headLen = head.length
    const tailLen = tail.length

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: head + solution + tail,
        extensions: [
          lineNumbers(),
          history(),
          bracketMatching(),
          python(),
          syntaxHighlighting(highlight),
          indentUnit.of('    '),
          traceLineField,
          regionDecorations(headLen, tailLen),
          theme,
          EditorView.lineWrapping,
          editable.of(EditorView.editable.of(true)),

          // The preamble and the harness are readable and selectable, but
          // not editable. `changeFilter` returning ranges protects them
          // without having to police every command.
          EditorState.changeFilter.of((tr) => {
            const len = tr.startState.doc.length
            return [0, headLen, len - tailLen, len]
          }),

          keymap.of([
            // Tab indents, Shift-Tab dedents — and both act on whole lines
            // across a multi-line selection, which is the thing a textarea
            // could not do.
            { key: 'Tab', run: indentMore, shift: indentLess },
            // Mod-/ is already in defaultKeymap, but binding it here keeps
            // it working even if that changes upstream.
            { key: 'Mod-/', run: toggleComment },
            // Tab is captured above, which would trap keyboard users. Escape
            // hands focus back to the page so the editor stays escapable.
            {
              key: 'Escape',
              run: (v) => {
                v.contentDOM.blur()
                return true
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),

          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            const { head: h, tail: tl } = boundsRef.current
            const doc = update.state.doc.toString()
            onSolutionRef.current(doc.slice(h.length, doc.length - tl.length))
          }),
        ],
      }),
    })

    viewRef.current = view
    onReadyRef.current?.({
      replace: (next) => replaceSolution(view, boundsRef.current.head, boundsRef.current.tail, next),
      read: () => {
        const { head: h, tail: tl } = boundsRef.current
        const doc = view.state.doc.toString()
        return doc.slice(h.length, doc.length - tl.length)
      },
      focus: () => view.focus(),
    })
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Built once per scenario. `solution` is intentionally excluded: the
    // editor owns the text after mount and reports changes outward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, tail])

  // The trace drives the highlight; the editor never drives the trace.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const effects: StateEffect<unknown>[] = [setTraceLine.of(traceLine)]
    // Scrubbing should reveal the line it is talking about — but not while
    // the player is typing in it, which would yank the view from under them.
    if (traceLine !== null && traceLine <= view.state.doc.lines && !view.hasFocus) {
      effects.push(
        EditorView.scrollIntoView(view.state.doc.line(traceLine).from, { y: 'center' }),
      )
    }
    view.dispatch({ effects })
  }, [traceLine])

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: editable.reconfigure(EditorView.editable.of(!disabled)),
    })
  }, [disabled])

  return (
    <div className="editor">
      <div className="cm-host" ref={hostRef} data-testid="editor" />
    </div>
  )
}

/** Replaces the editable region. Used by the debug API the browser tests
 *  drive, so they never have to type into a contenteditable. */
function replaceSolution(view: EditorView, head: string, tail: string, next: string): void {
  view.dispatch({
    changes: { from: head.length, to: view.state.doc.length - tail.length, insert: next },
  })
}
