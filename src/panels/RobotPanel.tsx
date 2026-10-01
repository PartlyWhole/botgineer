/**
 * (B) The robot interface: where the player writes the robot's
 * instructions, runs them, and reads what came back.
 *
 * This is the only panel that *causes* anything. It is also the transport:
 * Run, Stop, and the step slider that moves the scene and the memory view
 * through the trace together.
 *
 * Memory is a **view of this panel**, not a panel of its own — the code
 * and the memory it produced are the same subject, and giving memory its
 * own box meant the two competed for height and both lost. Both views are
 * kept mounted, so switching back does not throw away where the graph's
 * nodes had settled; the hidden one is simply not displayed.
 *
 * The transport and the transcript stay put across both views, so a run
 * can be started and scrubbed while looking at either.
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { CodeEditor, type CodeDemo, type EditorApi, type LineMarks } from '../ui/CodeEditor'
import { runKeyHint } from '../ui/editorLines'
import type { Demo } from '../ui/demo'
import { RobotConsole, type Exchange } from '../ui/RobotConsole'
import { Gutter, STACKED, useRemembered } from '../ui/Split'

export type Transcript =
  | { kind: 'out'; text: string }
  | { kind: 'err'; text: string }
  | { kind: 'note'; text: string }

/** Which instrument the player has. The console is the beginner's; the
 *  editor is unlocked later, once a whole program is worth writing. */
export type RobotMode = 'console' | 'editor' | 'read'

type Props = {
  mode: RobotMode
  /** Console: the conversation so far, and how to add to it. */
  exchanges: Exchange[]
  onSay: (line: string) => void
  greeting?: string | undefined
  program: string
  onProgram: (next: string) => void
  onReady: (api: EditorApi) => void
  onRun: () => void
  onStop: () => void
  busy: boolean
  disabled: boolean
  transcript: Transcript[]
  /** Trace transport. `total` of 0 means there is nothing to step. */
  index: number
  total: number
  onIndex: (i: number) => void
  /** Line the trace is on, highlighted in the editor. */
  traceLine: number | null
  memory: ReactNode
  /** Read mode: the reading instrument, in place of the console or editor. */
  instrument?: ReactNode
  /** A lesson's narration is showing: the console is closed until the
   *  question. The v1 editor stays open; the v2 editor closes like the
   *  console (read only, Run off), so a beat is heard before it is acted on. */
  listening?: boolean | undefined
  /** A question is waiting for a typed answer: the instrument glows. */
  asked?: boolean | undefined
  /** A beat points at part of this panel, which pulses while it shows. */
  focus?: 'console' | 'memory' | 'run' | undefined
  /** Which design the panel wears: `v2` is the robot's terminal and
   *  storage bank (`robot-v2.css`), scoped under `data-look`. */
  look?: 'v1' | 'v2' | undefined
  /** A line the crow types into the console, never run (`ui/demo`). */
  demo?: Demo | null | undefined
  onDemoTyped?: (() => void) | undefined
  /** Console: wipe the robot's memory and start again. Given, a small
   *  control sits in memory's corner; no confirm, since retyping the
   *  lines undoes it. */
  onReset?: (() => void) | undefined
  /** Take the last line back (`Workbench.undo`), and whether there is one. */
  onUndo?: (() => void) | undefined
  canUndo?: boolean | undefined
  /** v2 editor: the crow's program, shown in place of the player's. */
  codeDemo?: CodeDemo | null | undefined
  onCodeDemoTyped?: (() => void) | undefined
  /** v2 editor: the run drawn onto the code's lines. */
  lineMarks?: LineMarks | null | undefined
}

export function RobotPanel({
  mode,
  exchanges,
  onSay,
  greeting,
  program,
  onProgram,
  onReady,
  onRun,
  onStop,
  busy,
  disabled,
  transcript,
  index,
  total,
  onIndex,
  traceLine,
  memory,
  instrument,
  listening = false,
  asked = false,
  focus,
  look = 'v1',
  demo = null,
  onDemoTyped,
  onReset,
  onUndo,
  canUndo = false,
  codeDemo = null,
  onCodeDemoTyped,
  lineMarks = null,
}: Props) {
  const talking = mode === 'console'
  const reading = mode === 'read'
  // Remembered, because how much room memory deserves depends on what the
  // player is doing with it, and each mode keeps its own.
  // Reading: the questions need the room above memory, and memory stays
  // empty until the commit. The editor: a program wants the lines.
  // The console wants little — a line or two and what came back — while
  // memory is the picture a console lesson is about, and its names pile up
  // a line at a time: at a fixed 280px the stage-ideas lessons scrolled
  // their first names away by the fifth line. So until the player drags
  // it, the console's memory is a share of the column (`--memory-h` left
  // unset, `styles.css`) rather than a number of pixels.
  const [memoryH, setMemoryH] = useRemembered(
    reading ? 'botgineer.rp.memory.read' : talking ? 'botgineer.rp.memory.console' : 'botgineer.rp.memory',
    reading ? 220 : talking ? NaN : 280,
  )
  const memoryRef = useRef<HTMLDivElement | null>(null)
  useMemoryInView(focus === 'memory', memoryRef)

  return (
    <div
      className="robot-panel"
      data-testid="robot-panel"
      data-mode={mode}
      data-busy={busy ? 'yes' : 'no'}
      data-look={look}
    >
      {/* Both at once, not one or the other.
      
          A `Talk | Memory` switch meant the effect of an instruction was
          always on the tab you were not looking at — and the moment a
          beginner most needs to see an object appear is the moment they
          made it. A strip of memory under the console was the first
          attempt; the real view, resizable, is better than an abridgement
          of it, and it is the same snapshot either way. */}
      <div
        className="views"
        style={Number.isFinite(memoryH) ? { ['--memory-h' as string]: `${memoryH}px` } : undefined}
      >
        <div
          className={`view instrument ${focus === 'console' ? 'pulse' : ''} ${asked ? 'glow' : ''}`}
          data-testid="instrument"
          data-focus={focus === 'console' ? 'yes' : 'no'}
        >
          {reading ? (
            instrument
          ) : talking ? (
            <RobotConsole
              exchanges={exchanges}
              onSubmit={onSay}
              busy={busy}
              disabled={disabled}
              greeting={greeting}
              listening={listening}
              asked={asked}
              look={look}
              demo={demo}
              onDemoTyped={onDemoTyped}
            />
          ) : (
            <CodeEditor
              solution={program}
              onSolution={onProgram}
              onReady={onReady}
              traceLine={traceLine}
              disabled={busy}
              look={look}
              {...(look === 'v2' && {
                marks: lineMarks,
                demo: codeDemo,
                onDemoTyped: onCodeDemoTyped,
                // While someone talks the editor is closed, like the console.
                readOnly: listening,
                onRun: busy || disabled || listening || codeDemo !== null ? undefined : onRun,
              })}
            />
          )}
        </div>

        <Gutter
          orientation="horizontal"
          value={memoryH}
          measure={() => memoryRef.current?.offsetHeight ?? 280}
          onChange={setMemoryH}
          min={120}
          max={talking ? 900 : 620}
          invert
          label="Resize memory"
        />

        <div
          ref={memoryRef}
          className={`view memory-view ${focus === 'memory' ? 'pulse' : ''}`}
          data-testid="memory-view"
          data-focus={focus === 'memory' ? 'yes' : 'no'}>
          {memory}
          {talking && onReset && (
            <MemoryTools onReset={onReset} onUndo={onUndo} canUndo={canUndo} disabled={busy || listening} />
          )}
        </div>
      </div>

      {/* The console answers inline, so it needs no Run button and no step
          slider — pressing Enter is the transport. All it can still want is
          a way out of a line that will not finish. */}
      {reading ? (
        // Reading has no Run: the robot runs the snippet when the answers
        // are committed, and the scrubber appears once there is a run.
        (total > 0 || busy) && (
          <div className="transport">
            <button type="button" onClick={onStop} disabled={!busy} data-testid="stop">
              Stop
            </button>
            <label className="scrub">
              <span className="sr-only">Step through the run</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, total - 1)}
                value={Math.min(index, Math.max(0, total - 1))}
                disabled={total === 0}
                onChange={(e) => onIndex(Number(e.target.value))}
                data-testid="scrubber"
                aria-label="Step through the run"
              />
            </label>
            <span className="step-label quiet" data-testid="step-label">
              {total === 0 ? '—' : `${Math.min(index + 1, total)} / ${total}`}
            </span>
          </div>
        )
      ) : talking ? (
        // Only while there is something to stop. `hidden` is not enough:
        // `.transport` sets `display: flex`, which wins against it.
        busy && (
          <div className="transport">
            <button type="button" onClick={onStop} data-testid="stop">
              Stop
            </button>
          </div>
        )
      ) : look === 'v2' ? (
        <EditorTransport
          onRun={onRun}
          onStop={onStop}
          busy={busy}
          canRun={!busy && !disabled && !listening && codeDemo === null}
          index={index}
          total={total}
          onIndex={onIndex}
          pulse={focus === 'run'}
        />
      ) : (
      <div className="transport">
        <button
          type="button"
          className={`primary ${focus === 'run' ? 'pulse' : ''}`}
          onClick={onRun}
          disabled={busy || disabled}
          data-testid="run"
        >
          {busy ? 'Running…' : 'Send to robot'}
        </button>
        <button type="button" onClick={onStop} disabled={!busy} data-testid="stop">
          Stop
        </button>

        <label className="scrub">
          <span className="sr-only">Step through the run</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={Math.min(index, Math.max(0, total - 1))}
            disabled={total === 0}
            onChange={(e) => onIndex(Number(e.target.value))}
            data-testid="scrubber"
            aria-label="Step through the run"
          />
        </label>
        <span className="step-label quiet" data-testid="step-label">
          {total === 0 ? '—' : `${Math.min(index + 1, total)} / ${total}`}
        </span>
      </div>
      )}

      {!talking && !reading && look === 'v2' ? (
        <OutputLog transcript={transcript} />
      ) : !talking && (!reading || total > 0) && (
        <div className="transcript" data-testid="transcript" aria-live="polite">
          {transcript.map((t, i) => (
            <p key={i} className={`t-line ${t.kind}`}>
              {t.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The v2 editor's transport: Run, Stop while there is something to stop,
 * and a step-through for walking a finished run a line at a time.
 *
 * Run is the one loud control, and wears its key (⌘↵ or Ctrl↵) quietly
 * beside its word for whoever already reaches for keys. The step buttons
 * are the four a media player has, so nobody is told what they do; they
 * sit dark until there is a run to walk. The slider is the same native
 * range as ever, so its arrow keys, Home and End work for free.
 */
function EditorTransport({
  onRun,
  onStop,
  busy,
  canRun,
  index,
  total,
  onIndex,
  pulse,
}: {
  onRun: () => void
  onStop: () => void
  busy: boolean
  canRun: boolean
  index: number
  total: number
  onIndex: (i: number) => void
  pulse: boolean
}) {
  const hint = useMemo(() => runKeyHint(platformName()), [])
  const last = Math.max(0, total - 1)
  const at = Math.min(index, last)
  const none = total === 0 || busy
  const go = (i: number) => onIndex(Math.max(0, Math.min(last, i)))
  const pct = total > 1 ? (at / last) * 100 : total === 1 ? 100 : 0
  return (
    <div className="transport editor-transport" data-has-run={total > 0 ? 'yes' : 'no'}>
      <button
        type="button"
        className={`run-key ${pulse ? 'pulse' : ''}`}
        onClick={onRun}
        disabled={!canRun}
        data-testid="run"
        aria-keyshortcuts="Control+Enter Meta+Enter Shift+Enter"
        title={`Run (${hint})`}
      >
        {busy ? (
          <span className="working" aria-hidden="true">
            <span className="cell" />
            <span className="cell" />
            <span className="cell" />
          </span>
        ) : (
          <svg className="run-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.5 2.8v10.4L13 8z" />
          </svg>
        )}
        <span className="run-word">Run</span>
        <kbd className="key-hint" aria-hidden="true">
          {hint}
        </kbd>
      </button>
      {busy && (
        <button type="button" className="stop-key" onClick={onStop} data-testid="stop">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
          </svg>
          <span>Stop</span>
        </button>
      )}

      <div className="stepper" role="group" aria-label="Step through the run">
        <StepButton label="First step" disabled={none || at === 0} onClick={() => go(0)} testid="step-first">
          <path d="M4 3v10" />
          <path d="M12.5 3.5 6.5 8l6 4.5z" className="fill" />
        </StepButton>
        <StepButton label="Step back" disabled={none || at === 0} onClick={() => go(at - 1)} testid="step-back">
          <path d="M11 3.5 5 8l6 4.5z" className="fill" />
        </StepButton>
        <label className="scrub" style={{ ['--pct' as string]: `${pct}%` }}>
          <span className="sr-only">Step through the run</span>
          <input
            type="range"
            min={0}
            max={last}
            value={at}
            disabled={total === 0}
            onChange={(e) => onIndex(Number(e.target.value))}
            data-testid="scrubber"
            aria-label="Step through the run"
            aria-valuetext={total === 0 ? 'No run yet' : `Step ${at + 1} of ${total}`}
          />
        </label>
        <StepButton label="Step forward" disabled={none || at >= last} onClick={() => go(at + 1)} testid="step-forward">
          <path d="M5 3.5 11 8l-6 4.5z" className="fill" />
        </StepButton>
        <StepButton label="Last step" disabled={none || at >= last} onClick={() => go(last)} testid="step-last">
          <path d="M12 3v10" />
          <path d="M3.5 3.5 9.5 8l-6 4.5z" className="fill" />
        </StepButton>
        <span className="step-label" data-testid="step-label">
          {total === 0 ? '—' : `${at + 1} / ${total}`}
        </span>
      </div>
    </div>
  )
}

function StepButton({
  label,
  disabled,
  onClick,
  testid,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  testid: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="step-key"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-testid={testid}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {children}
      </svg>
    </button>
  )
}

function platformName(): string {
  if (typeof navigator === 'undefined') return ''
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  return data?.platform || navigator.platform || navigator.userAgent
}

/**
 * The robot's output log, under the editor: what the program printed, in
 * the screen's grey, errors in its coral, and the run's end line as a
 * quiet stamp. Before any run it is an empty strip with a dim prompt
 * mark: the place output will land, shown rather than labelled.
 */
function OutputLog({ transcript }: { transcript: Transcript[] }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [transcript])
  return (
    <div className="transcript output-log" data-testid="transcript" aria-live="polite" ref={ref}>
      {transcript.length === 0 ? (
        <span className="log-idle" aria-hidden="true">
          ›
        </span>
      ) : (
        transcript.map((t, i) => (
          <p key={i} className={`t-line ${t.kind}`}>
            {t.text}
          </p>
        ))
      )}
    </div>
  )
}

/**
 * Undo and Wipe, in memory's corner: take the last line back, or start
 * the memory over. Words beside the icons, because a learner stuck on a
 * wrong append has to find the way back without being told. One press, no
 * confirm — the lines are the player's to type again. Closed while a line
 * runs or someone is talking, like the console itself.
 */
function MemoryTools({
  onReset,
  onUndo,
  canUndo,
  disabled,
}: {
  onReset: () => void
  onUndo?: (() => void) | undefined
  canUndo: boolean
  disabled: boolean
}) {
  const wipe = "Wipe the robot's memory"
  const back = 'Undo the last line'
  return (
    <div className="memory-tools" role="group" aria-label="Memory">
      {onUndo && (
        <button
          type="button"
          className="memory-reset memory-undo"
          onClick={onUndo}
          disabled={disabled || !canUndo}
          aria-label={back}
          title={back}
          data-testid="memory-undo"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 2.5 7 6 10.5" />
            <path d="M3 7h6.5a4 4 0 0 1 0 8H7" />
          </svg>
          <span>Undo</span>
        </button>
      )}
      <button
        type="button"
        className="memory-reset"
        onClick={onReset}
        disabled={disabled}
        aria-label={wipe}
        title={wipe}
        data-testid="memory-reset"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M13 8a5 5 0 1 1-1.6-3.7" />
          <path d="M11.9 1.6v3.1H8.8" />
        </svg>
        <span>Wipe</span>
      </button>
    </div>
  )
}

/** How much of memory a beat about it needs on screen: its first rows,
 *  where the names start. */
const MEMORY_SHOWN = 300

/**
 * A beat that points at memory ("Look below: there's `x`…") has to have
 * memory on screen, and on a phone it starts below the fold. So on a
 * stacked layout the page scrolls down just far enough to show memory's
 * first rows, and scrolls back up to where it was when the beat moves on
 * — the stage is where the crow talks and where Next is, and a beat about
 * memory must not take the player away from it for good. The scroll is
 * the least that shows those rows, which on a phone keeps the bubble's
 * lower edge, the cast and Next in view too.
 *
 * If the player has scrolled the page meanwhile, it is theirs, and
 * nothing is put back.
 */
function useMemoryInView(on: boolean, ref: { current: HTMLElement | null }) {
  useEffect(() => {
    const el = ref.current
    if (!on || !el || typeof window.matchMedia !== 'function' || !window.matchMedia(STACKED).matches) return
    const box = el.getBoundingClientRect()
    const want = Math.min(box.height, MEMORY_SHOWN)
    const by = box.top + want - window.innerHeight
    if (by <= 0) return
    const from = window.scrollY
    const to = from + by
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: to, behavior: smooth ? 'smooth' : 'auto' })
    return () => {
      // Put back only a scroll we made (perhaps still under way) and
      // nobody has moved since.
      const y = window.scrollY
      if (y >= from - 24 && y <= to + 24) window.scrollTo({ top: from, behavior: smooth ? 'smooth' : 'auto' })
    }
  }, [on, ref])
}
