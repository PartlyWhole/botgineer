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
 *
 * **Two looks.** `v1` is the light editor as it always was. `v2` is the
 * robot's own screen, the console's dark terminal grown into a program
 * (`robot-v2.css`), and it is where the run is drawn onto the code:
 *
 * - **Line marks** (`marks`): a lit dot in the gutter for every line the
 *   run reached (a number when a loop reached it more than once), a
 *   glowing bar and a ▶ on the line running now, the lines a finished run
 *   never reached faded — the branch that was not taken — and the line a
 *   run stopped on underlined, its error named in a chip at the line's
 *   end. What counts as "reached" is `editorLines.lineStates`, pure and
 *   tested. Marks describe the program they were made from, so the first
 *   edit after them hides them, until the next run.
 * - **The crow's program** (`demo`): shown in place of the player's, read
 *   only, typing itself in, framed and tagged with the crow's name the way
 *   the console's demonstration line is. The player's own document — text,
 *   cursor, undo history — is the EditorState put aside while it shows, and
 *   is put back exactly when it goes.
 * - **Closed** (`readOnly`): while someone is talking, as the console is.
 *   The text stays readable; the caret goes, the lamp turns amber and a
 *   padlock sits by it.
 * - Indent guides, one per four columns, carried across blank lines, for a
 *   reader learning which lines belong to an `if`.
 */
import { useEffect, useRef } from 'react'
import {
  Annotation,
  Compartment,
  EditorState,
  Prec,
  RangeSet,
  StateEffect,
  StateField,
  type Extension,
  type Range,
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  GutterMarker,
  WidgetType,
  drawSelection,
  gutter,
  highlightActiveLine,
  highlightActiveLineGutter,
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
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
  bracketMatching,
} from '@codemirror/language'
// A dependency of @codemirror/lang-python, so already installed.
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { python } from '@codemirror/lang-python'
import { tags as t } from '@lezer/highlight'
import { DemoTag } from './CrowTag'
import { guideDepths, lineStates, sameMarks, type LineMarks, type LineState } from './editorLines'

export type { LineMarks } from './editorLines'

/** The crow's program, shown in place of the player's while set. */
export type CodeDemo = {
  /** Changes whenever the demonstration does; a new key types afresh. */
  key: string
  text: string
  /** `text` up to here is on screen at once; the rest types itself in. */
  typeFrom: number
}

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
  /** A run is in flight: nothing may change the program under it. */
  disabled: boolean
  /** Handed an imperative handle once the editor exists. The debug API the
   *  browser tests drive uses this instead of typing into a contenteditable. */
  onReady?: (api: EditorApi) => void
  look?: 'v1' | 'v2' | undefined
  /** v2: the run drawn onto the lines. Given, its `current` is the lit
   *  line instead of `traceLine`. */
  marks?: LineMarks | null | undefined
  /** v2: the crow's program, shown read only in place of the player's. */
  demo?: CodeDemo | null | undefined
  /** Once per demo key, when its text has finished typing. */
  onDemoTyped?: (() => void) | undefined
  /** v2: narration is showing; the editor can be read, not typed in. */
  readOnly?: boolean | undefined
  /** v2: Mod-Enter and Shift-Enter. The caller decides whether a run is
   *  allowed; the editor only asks. */
  onRun?: (() => void) | undefined
  /** A shared room (`collab/editor`): the room's text, adopted when the
   *  room is entered, and the extensions that keep the editor in step with
   *  it. Read and attached in one go, so no remote change falls between. */
  shared?: { text: () => string; extension: Extension } | null | undefined
}

export type EditorApi = {
  /** Replaces the editable region, leaving the locked regions alone. */
  replace: (next: string) => void
  /** The editable region as it is RIGHT NOW. The editor owns the text, so
   *  anything that needs the current program asks here rather than waiting
   *  for React to re-render with it. */
  read: () => string
  focus: () => void
  /** Dispatches state effects: a shared room's carets (`collab/editor`). */
  effects: (effects: StateEffect<unknown>[]) => void
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
function regionDecorations(headLen: number, tailLen: number, trace: boolean): Extension {
  return EditorView.decorations.compute(['doc', traceLineField], (state) => {
    if (headLen === 0 && tailLen === 0 && !trace) return Decoration.none
    const builder: { from: number; value: Decoration }[] = []
    const tailStart = state.doc.length - tailLen
    const traced = state.field(traceLineField)

    for (let n = 1; n <= state.doc.lines; n++) {
      const line = state.doc.line(n)
      const locked = (headLen > 0 && line.to <= headLen) || (tailLen > 0 && line.from > tailStart)
      if (locked) builder.push({ from: line.from, value: lockedLine })
      if (trace && traced === n) builder.push({ from: line.from, value: tracedLine })
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

/* ------------------------------- v2 --------------------------------- */

/**
 * The robot screen's syntax colours. Values wear the colour of their kind
 * in memory and in the pictures (`props.css`: bool violet, int blue, str
 * orange), lifted for a dark ground; keywords are the one loud colour,
 * because `if`, `elif`, `else`, `for` and `while` are what these lessons
 * are about. Every colour clears 7:1 on the screen's #0c1a2c except
 * comments (#7d93ad, 5.6:1), which are meant to recede.
 */
const highlightV2 = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: '#ff8fd0', fontWeight: '700' },
  { tag: [t.operatorKeyword], color: '#ff8fd0', fontWeight: '700' },
  { tag: [t.string, t.special(t.string)], color: '#ffbf80' },
  { tag: t.escape, color: '#ffd9a8' },
  { tag: [t.number, t.integer, t.float], color: '#9cb8ff' },
  { tag: [t.bool, t.null], color: '#c9b0ff', fontWeight: '700' },
  { tag: t.comment, color: '#7d93ad', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#7fe3ff' },
  { tag: t.definition(t.function(t.variableName)), color: '#7fe3ff', fontWeight: '700' },
  { tag: t.definition(t.variableName), color: '#f2fbf6' },
  { tag: t.variableName, color: '#e8f4ee' },
  { tag: t.propertyName, color: '#d6e4f5' },
  { tag: [t.operator, t.compareOperator, t.arithmeticOperator, t.logicOperator], color: '#b5c8dd' },
  { tag: [t.paren, t.squareBracket, t.brace, t.punctuation, t.separator], color: '#a9bdd3' },
  { tag: t.invalid, color: '#ff9d8e' },
])

const themeV2 = EditorView.theme(
  {
    // Font size is in robot-v2.css, which steps it down on a phone.
    '&': { backgroundColor: 'transparent', color: '#e8f4ee', height: '100%' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: 'var(--mono)',
      lineHeight: '1.65',
      scrollbarColor: '#2a3a55 transparent',
    },
    '.cm-content': { padding: '10px 0 24px', caretColor: '#5dffa8' },
    '.cm-line': { padding: '0 36px 0 10px' },
    '.cm-cursor, .cm-dropCursor': { borderLeft: '2px solid #5dffa8' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgb(93 255 168 / 0.22) !important',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#5f7491',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 2px', minWidth: '2.6ch' },
    '.cm-activeLine': { backgroundColor: 'rgb(255 255 255 / 0.035)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#c9d6ea' },
    '&.cm-focused .cm-matchingBracket': {
      backgroundColor: 'rgb(93 255 168 / 0.16)',
      outline: '1px solid rgb(93 255 168 / 0.55)',
      color: 'inherit',
    },
    '.cm-matchingBracket': { backgroundColor: 'transparent', color: 'inherit' },
    '&.cm-focused .cm-nonmatchingBracket': { backgroundColor: 'rgb(255 157 142 / 0.25)', color: 'inherit' },
    '.cm-locked': { backgroundColor: 'rgb(255 255 255 / 0.03)', color: '#7c90a8' },
  },
  { dark: true },
)

/** Marks travel as an effect; the field says whether they still apply. */
const setMarks = StateEffect.define<{ marks: LineMarks | null; fresh: boolean }>()

/** A change made by the crow's typing, which must not stale the marks
 *  the crow is pointing at. */
const crowTyping = Annotation.define<boolean>()

type MarksValue = {
  marks: LineMarks | null
  /** The player has edited since these marks were made. */
  stale: boolean
  states: LineState[] | null
}

const marksField = StateField.define<MarksValue>({
  create: () => ({ marks: null, stale: false, states: null }),
  update(value, tr) {
    let { marks, stale } = value
    let touched = false
    for (const e of tr.effects) {
      if (!e.is(setMarks)) continue
      marks = e.value.marks
      if (e.value.fresh || !marks) stale = false
      touched = true
    }
    if (tr.docChanged && !touched && !tr.annotation(crowTyping) && marks) {
      stale = true
      touched = true
    }
    if (!touched && !tr.docChanged) return value
    const states = marks && !stale ? lineStates(tr.state.doc.toString(), marks) : null
    return { marks, stale, states }
  },
})

const statesOf = (state: EditorState): LineState[] | null => state.field(marksField, false)?.states ?? null

/** The error's name at the end of the line that raised it. */
class ErrorChip extends WidgetType {
  constructor(readonly text: string) {
    super()
  }
  eq(other: ErrorChip) {
    return other.text === this.text
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'cm-err-chip'
    el.setAttribute('data-testid', 'editor-error')
    el.textContent = this.text
    return el
  }
  ignoreEvent() {
    return true
  }
}

/** The crow's cursor, riding the end of the text while it types. */
class TypingCursor extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const el = document.createElement('span')
    el.className = 'cm-crow-cursor'
    el.setAttribute('aria-hidden', 'true')
    return el
  }
}

const setTyping = StateEffect.define<boolean>()
const typingField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setTyping)) return e.value
    return value
  },
})

const lineDeco = {
  ran: Decoration.line({ class: 'cm-ran' }),
  now: Decoration.line({ class: 'cm-now' }),
  skipped: Decoration.line({ class: 'cm-skipped' }),
  error: Decoration.line({ class: 'cm-errline' }),
}
const errorUnderline = Decoration.mark({ class: 'cm-err-text' })

/** Guides and line marks, one decoration set, from the doc and the field. */
const v2Decorations = EditorView.decorations.compute(['doc', marksField, typingField], (state) => {
  const doc = state.doc
  const text = doc.toString()
  const depths = guideDepths(text)
  const states = statesOf(state)
  const ranges: Range<Decoration>[] = []
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    const depth = depths[n - 1] ?? 0
    if (depth > 0) {
      ranges.push(
        Decoration.line({ attributes: { style: `--guides: ${depth}` }, class: 'cm-guided' }).range(line.from),
      )
    }
    const s = states?.[n - 1]
    if (!s) continue
    if (s.error) ranges.push(lineDeco.error.range(line.from))
    else if (s.now) ranges.push(lineDeco.now.range(line.from))
    else if (s.skipped) ranges.push(lineDeco.skipped.range(line.from))
    else if (s.visits > 0) ranges.push(lineDeco.ran.range(line.from))
    if (s.error) {
      const lead = line.text.length - line.text.trimStart().length
      if (line.to > line.from + lead) ranges.push(errorUnderline.range(line.from + lead, line.to))
      // Only on the statement's first line: one chip per error.
      const prev = n > 1 ? states?.[n - 2] : undefined
      if (!prev?.error) {
        ranges.push(Decoration.widget({ widget: new ErrorChip(s.error), side: 1 }).range(line.to))
      }
    }
  }
  if (state.field(typingField, false)) {
    ranges.push(Decoration.widget({ widget: new TypingCursor(), side: 1 }).range(doc.length))
  }
  return Decoration.set(ranges, true)
})

class RunMarker extends GutterMarker {
  constructor(readonly kind: 'now' | 'ran' | 'error' | 'skipped', readonly visits: number) {
    super()
  }
  eq(other: RunMarker) {
    return other.kind === this.kind && other.visits === this.visits
  }
  toDOM() {
    // A box one text line tall, so on a wrapped line the mark sits by the
    // first row, beside the line number, not halfway down the block.
    const box = document.createElement('span')
    box.className = 'run-mark-box'
    const el = document.createElement('span')
    el.className = `run-mark ${this.kind}`
    if (this.kind === 'now') el.textContent = '▶'
    else if (this.kind === 'error') el.textContent = '✕'
    else if (this.kind === 'ran' && this.visits > 1) {
      el.classList.add('count')
      el.textContent = this.visits > 99 ? '99+' : String(this.visits)
    }
    box.appendChild(el)
    return box
  }
}

/** The run's own gutter: ▶ now, a lit dot per line reached (a number
 *  for a line reached again), ✕ where it stopped. */
const runGutter = gutter({
  class: 'cm-run-gutter',
  markers(view) {
    const states = statesOf(view.state)
    if (!states) return RangeSet.empty
    const marks: Range<GutterMarker>[] = []
    states.forEach((s, i) => {
      if (i >= view.state.doc.lines) return
      const from = view.state.doc.line(i + 1).from
      const kind = s.error ? 'error' : s.now ? 'now' : s.visits > 0 ? 'ran' : null
      if (kind) marks.push(new RunMarker(kind, s.visits).range(from))
    })
    return RangeSet.of(marks, true)
  },
  initialSpacer: () => new RunMarker('ran', 1),
})

/** Editability is swapped while a run is in flight, which needs a
 *  compartment: a facet cannot be reconfigured on its own. */
const editable = new Compartment()
/** v2: a run in flight freezes the text but keeps the caret and focus, so
 *  Mod-Enter, a look at memory and typing on carry straight on. */
const frozen = new Compartment()
/** A shared room's extensions, attached when a room is entered. */
const sharedSlot = new Compartment()

/** The extensions both the player's document and the crow's wear. */
function v2Shared(): Extension[] {
  return [
    runGutter,
    lineNumbers(),
    python(),
    syntaxHighlighting(highlightV2),
    indentUnit.of('    '),
    EditorState.tabSize.of(4),
    marksField,
    typingField,
    v2Decorations,
    themeV2,
  ]
}

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** How long after the last chunk the crow types the next: brisk, and a
 *  touch slower after a space or a line, so it reads as typing. */
function chunkDelay(chunk: string, i: number): number {
  const jitter = ((i * 37 + 11) % 17) - 8
  return 30 + jitter + (chunk.startsWith('\n') ? 90 : chunk === ' ' ? 12 : 0)
}

/** The next piece the crow types: one character, or a newline with the
 *  next line's indentation, which nobody types a space at a time. */
function nextChunk(text: string, at: number): string {
  if (text[at] !== '\n') return text[at] ?? ''
  let end = at + 1
  while (text[end] === ' ') end++
  return text.slice(at, end)
}

/* -------------------------------------------------------------------- */

export function CodeEditor({
  head = '',
  tail = '',
  solution,
  onSolution,
  traceLine,
  disabled,
  onReady,
  look = 'v1',
  marks = null,
  demo = null,
  onDemoTyped,
  readOnly = false,
  onRun,
  shared = null,
}: Props) {
  const v2 = look === 'v2'
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
  const onRunRef = useRef(onRun)
  onRunRef.current = onRun
  const onDemoTypedRef = useRef(onDemoTyped)
  onDemoTypedRef.current = onDemoTyped
  /** The player's own document while the crow's is on screen. */
  const playerRef = useRef<EditorState | null>(null)

  // v2 marks: the given ones, or the trace's line on its own.
  const effective: LineMarks | null = v2
    ? (marks ?? (traceLine !== null ? { ran: [], current: traceLine, finished: false, error: null } : null))
    : null
  const effectiveRef = useRef(effective)
  effectiveRef.current = effective

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const headLen = head.length
    const tailLen = tail.length

    const runKeys = Prec.highest(
      keymap.of([
        { key: 'Mod-Enter', run: () => (onRunRef.current ? (onRunRef.current(), true) : false) },
        { key: 'Shift-Enter', run: () => (onRunRef.current ? (onRunRef.current(), true) : false) },
      ]),
    )

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: head + solution + tail,
        extensions: [
          ...(v2
            ? [
                runKeys,
                ...v2Shared(),
                highlightActiveLine(),
                highlightActiveLineGutter(),
                drawSelection(),
                indentOnInput(),
                closeBrackets(),
                regionDecorations(headLen, tailLen, false),
              ]
            : [
                lineNumbers(),
                python(),
                syntaxHighlighting(highlight),
                indentUnit.of('    '),
                traceLineField,
                regionDecorations(headLen, tailLen, true),
                theme,
              ]),
          history(),
          bracketMatching(),
          EditorView.lineWrapping,
          editable.of(EditorView.editable.of(true)),
          frozen.of(EditorState.readOnly.of(false)),
          sharedSlot.of([]),

          // The preamble and the harness are readable and selectable, but
          // not editable. `changeFilter` returning ranges protects them
          // without having to police every command.
          EditorState.changeFilter.of((tr) => {
            const len = tr.startState.doc.length
            return [0, headLen, len - tailLen, len]
          }),

          keymap.of([
            ...(v2 ? closeBracketsKeymap : []),
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
    if (v2 && effectiveRef.current) {
      view.dispatch({ effects: setMarks.of({ marks: effectiveRef.current, fresh: true }) })
    }
    const playerDoc = () => (playerRef.current ?? view.state).doc.toString()
    onReadyRef.current?.({
      replace: (next) => {
        const { head: h, tail: tl } = boundsRef.current
        const saved = playerRef.current
        if (saved) {
          // The crow's program is on screen: change the player's, put aside.
          playerRef.current = saved.update({
            changes: { from: h.length, to: saved.doc.length - tl.length, insert: next },
          }).state
          onSolutionRef.current(next)
          return
        }
        replaceSolution(view, h, tl, next)
      },
      read: () => {
        const { head: h, tail: tl } = boundsRef.current
        const doc = playerDoc()
        return doc.slice(h.length, doc.length - tl.length)
      },
      focus: () => {
        if (!playerRef.current) view.focus()
      },
      effects: (effects) => view.dispatch({ effects }),
    })
    return () => {
      view.destroy()
      viewRef.current = null
      playerRef.current = null
    }
    // Built once per scenario. `solution` is intentionally excluded: the
    // editor owns the text after mount and reports changes outward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, tail, look])

  // A shared room: take its text, then attach what keeps the two in step.
  // The sync plugin starts from the room's text, so the editor must hold
  // exactly that text the moment it is attached.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (shared) {
      const text = shared.text()
      const { head: h, tail: tl } = boundsRef.current
      if (view.state.doc.toString() !== h + text + tl) replaceSolution(view, h, tl, text)
    }
    view.dispatch({ effects: sharedSlot.reconfigure(shared ? shared.extension : []) })
  }, [shared])

  // v1: the trace drives the highlight; the editor never drives the trace.
  useEffect(() => {
    const view = viewRef.current
    if (!view || v2) return
    const effects: StateEffect<unknown>[] = [setTraceLine.of(traceLine)]
    // Scrubbing should reveal the line it is talking about — but not while
    // the player is typing in it, which would yank the view from under them.
    if (traceLine !== null && traceLine <= view.state.doc.lines && !view.hasFocus) {
      effects.push(
        EditorView.scrollIntoView(view.state.doc.line(traceLine).from, { y: 'center' }),
      )
    }
    view.dispatch({ effects })
  }, [traceLine, v2])

  // v2: marks, applied when they change by value. A parent that rebuilds
  // the object every render must not revive marks an edit made stale.
  useEffect(() => {
    const view = viewRef.current
    if (!view || !v2) return
    const now = view.state.field(marksField, false)
    if (!now || sameMarks(now.marks, effective)) return
    const effects: StateEffect<unknown>[] = [setMarks.of({ marks: effective, fresh: now.marks === null })]
    const line = effective?.error?.line ?? effective?.current ?? null
    if (line !== null && line >= 1 && line <= view.state.doc.lines && !view.hasFocus) {
      effects.push(EditorView.scrollIntoView(view.state.doc.line(line).from, { y: 'nearest', yMargin: 48 }))
    }
    view.dispatch({ effects })
  })

  // A run starting clears the old marks, so whatever it marks next is
  // fresh: it is about the program now in the editor.
  const wasDisabled = useRef(disabled)
  useEffect(() => {
    const view = viewRef.current
    if (view && v2 && disabled && !wasDisabled.current && !playerRef.current) {
      view.dispatch({ effects: setMarks.of({ marks: null, fresh: true }) })
    }
    wasDisabled.current = disabled
  }, [disabled, v2])

  // v1 closes the editor for a run; v2 only freezes it (above) and closes
  // it while someone talks or the crow's program shows.
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled
  const closed = v2 ? readOnly || demo !== null : disabled
  const closedRef = useRef(closed)
  closedRef.current = closed
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: editable.reconfigure(EditorView.editable.of(!closed)),
    })
  }, [closed])
  useEffect(() => {
    if (!v2 || playerRef.current) return
    viewRef.current?.dispatch({ effects: frozen.reconfigure(EditorState.readOnly.of(disabled)) })
  }, [disabled, v2])

  // The crow's program: put the player's state aside, show the crow's,
  // type the rest of it in, and put the player's back when it goes.
  const demoKey = v2 && demo ? demo.key : null
  const demoRef = useRef(demo)
  demoRef.current = demo
  const reportedRef = useRef<string | null>(null)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (demoKey === null) {
      reportedRef.current = null
      const saved = playerRef.current
      if (saved) {
        playerRef.current = null
        view.setState(saved)
        view.dispatch({
          effects: [
            editable.reconfigure(EditorView.editable.of(!closedRef.current)),
            frozen.reconfigure(EditorState.readOnly.of(disabledRef.current)),
          ],
        })
        const m = effectiveRef.current
        if (!sameMarks(view.state.field(marksField, false)?.marks, m)) {
          view.dispatch({ effects: setMarks.of({ marks: m, fresh: false }) })
        }
      }
      return
    }
    const d = demoRef.current!
    if (!playerRef.current) playerRef.current = view.state
    const from = Math.max(0, Math.min(d.typeFrom, d.text.length))
    const finish = () => {
      if (reportedRef.current === demoKey) return
      reportedRef.current = demoKey
      onDemoTypedRef.current?.()
    }
    const instant = reducedMotion() || reportedRef.current === demoKey || from >= d.text.length
    view.setState(
      EditorState.create({
        doc: instant ? d.text : d.text.slice(0, from),
        extensions: [...v2Shared(), EditorState.readOnly.of(true), editable.of(EditorView.editable.of(false))],
      }),
    )
    view.dispatch({
      effects: [
        setMarks.of({ marks: effectiveRef.current, fresh: true }),
        setTyping.of(!instant),
        EditorView.scrollIntoView(instant ? 0 : view.state.doc.length, { y: 'nearest' }),
      ],
    })
    if (instant) {
      finish()
      return
    }
    let at = from
    let n = 0
    let timer: ReturnType<typeof setTimeout>
    const step = () => {
      const chunk = nextChunk(d.text, at)
      const pos = view.state.doc.length
      at += chunk.length
      const done = at >= d.text.length
      view.dispatch({
        changes: { from: pos, insert: chunk },
        annotations: crowTyping.of(true),
        effects: [
          ...(done ? [setTyping.of(false)] : []),
          EditorView.scrollIntoView(pos + chunk.length, { y: 'nearest', yMargin: 24 }),
        ],
      })
      if (done) finish()
      else timer = setTimeout(step, chunkDelay(nextChunk(d.text, at), n++))
    }
    timer = setTimeout(step, 320)
    return () => clearTimeout(timer)
  }, [demoKey])

  if (!v2) {
    return (
      <div className="editor">
        <div className="cm-host" ref={hostRef} data-testid="editor" />
      </div>
    )
  }

  const state = demoKey !== null ? 'demo' : disabled ? 'busy' : readOnly ? 'locked' : 'open'
  return (
    <div className="editor v2" data-state={state} data-testid="editor-v2">
      <div
        className="cm-host"
        ref={hostRef}
        data-testid="editor"
        aria-label={demoKey !== null ? 'The crow’s example program' : undefined}
      />
      <span className="lamp" aria-hidden="true" />
      {state === 'locked' && <LockMark />}
      {demoKey !== null && <DemoTag />}
    </div>
  )
}

function LockMark() {
  return (
    <svg className="mark lock-mark" viewBox="0 0 16 16" aria-hidden="true" data-testid="editor-lock">
      <rect x="3" y="7" width="10" height="7.5" rx="1.6" />
      <path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" />
    </svg>
  )
}

/** Replaces the editable region. Used by the debug API the browser tests
 *  drive, so they never have to type into a contenteditable. */
function replaceSolution(view: EditorView, head: string, tail: string, next: string): void {
  view.dispatch({
    changes: { from: head.length, to: view.state.doc.length - tail.length, insert: next },
  })
}
