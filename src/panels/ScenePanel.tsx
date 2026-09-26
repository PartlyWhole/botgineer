/**
 * (A) The scene panel: the situation, drawn from memory.
 *
 * Every actor's appearance is derived from the current snapshot through
 * the scene's declared watches. The scene holds no state of its own and
 * takes no commands, so it cannot show something the program did not do —
 * and scrubbing the trace rewinds the picture for free.
 *
 * ## Telling
 *
 * A lesson now talks in beats (docs/PEDAGOGY.md §4): short lines the
 * player advances with Next, ending on a question that opens the console.
 * The scene draws that — the bubble, Next and Back, the bar of steps
 * along the top, the takeaway at the end — from what the workbench hands
 * it (`telling`). Which beat is showing is the workbench's one piece of
 * view state; the buttons here only *ask* it to move, the way Continue
 * asks the router, and neither can start a run or change what memory
 * says (invariant 12).
 *
 * The line types itself on, and that is drawing too: every character is
 * its own span with a CSS delay, so the text is laid out whole from the
 * first frame (nothing measured here ever changes size), a screen reader
 * gets all of it at once, and reduced motion — which drops every
 * animation — simply shows it whole. No timer decides when the typing
 * ends; Next asks the element's own animations whether they have.
 */
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  placement,
  readScene,
  widthOf,
  type Actor,
  type ActorKind,
  type ActorView,
  type Floor,
  type SceneSpec,
} from '../scene/spec'
import type { MemorySnapshot } from '../memory/model'
import { Robot, Courier } from '../ui/Characters'
import { Crow } from '../ui/Crow'
import { richText } from '../ui/richText'
import type { Cast, Mood } from '../game/director'
import type { PracticeMeter } from '../practice/usePractice'
import type { Staging } from '../scene/props'
import { PropLayer } from '../ui/Props'
import { speakerOf } from '../../content/cast'
import type { CastView, ScriptItem } from '../../content/lessons'

/** What the guide is saying, and what kind of line it is. */
export type GuideLine = {
  text: string
  /** An actor id, or the crow when it is not given. */
  speaker?: string | undefined
  /** Narration (`beat`, `praise`, `outro`), a question (`ask`), or the
   *  answer to a miss (`reply`). A bare line is drawn as an ask. */
  kind?: ScriptItem['kind'] | undefined
  /** Who does the work, on an ask (R4). */
  tag?: 'you' | 'robot' | undefined
  /** Identity of this line in the script, so the same words said again
   *  as a new beat still type on again. */
  key?: string | undefined
}

/**
 * The beat controls, while a lesson is telling its script. Handed down,
 * like the guide's text; the buttons call back and hold nothing.
 */
export type Telling = {
  /** Narration is showing: Next is offered and the console is closed. */
  listening: boolean
  /** There is a beat before this one to go back to. */
  back: boolean
  /** The lesson's steps, for the bar along the top: how many, which one
   *  is current (`steps` once finished), and how far through the current
   *  one's script, 0..1. */
  steps: number
  step: number
  through: number
  /** Where the answer goes, said by the pointer at the ask (its arrow is
   *  drawn here, pointing wherever the console is); empty for no pointer. */
  prompt: string
  /** Shown once the lesson is finished and its last line said. */
  takeaway?: string | undefined
  /** Finished and resting: the takeaway bar, and Replay. */
  resting: boolean
  onNext: () => void
  onBack: () => void
  onReplay: () => void
}

export function ScenePanel({
  spec,
  snapshot,
  moods,
  guide,
  onAdvance,
  triumph,
  thought,
  thinking,
  meter,
  staging,
  compact,
  telling,
  cast,
  children,
}: {
  spec: SceneSpec
  snapshot: MemorySnapshot
  /** The robot's mood about its own run, and everyone else's. Two, so the
   *  crow does not look confused because the robot raised. */
  moods: Cast
  /** What is being said, and by whom — an actor id, or the crow when it
   *  is not given. Derived by the workbench and handed down as text: the
   *  scene still causes nothing and decides nothing, it just draws the
   *  sentence it was given, next to whoever is saying it. */
  guide?: GuideLine | undefined
  /** Offered once the lesson is finished. Navigation only: it starts no
   *  run and holds no state, so the scene still causes nothing that could
   *  change what memory says. */
  onAdvance?: (() => void) | undefined
  /**
   * Whether the activity's *lesson* is complete, or `undefined` when it
   * has no lesson and the scene should judge itself instead.
   *
   * The distinction matters: an activity with both a lesson and a watch
   * must be judged by the lesson, because a watch can be satisfied long
   * before the lesson is finished.
   */
  triumph?: boolean | undefined
  /**
   * What the robot last worked out, and whether it is working now.
   *
   * Not memory — that is the point of it. A bare expression's value is
   * gone the moment the line ends, so the only place it is ever visible
   * is here, above the robot's head, for as long as it is the last thing
   * it thought.
   */
  thought?: string | null | undefined
  thinking?: boolean | undefined
  /** A practice session's progress, drawn across the top of the stage. */
  meter?: PracticeMeter | undefined
  /**
   * The lesson's picture for the question being asked, and the last one
   * on its way out with the answer that finished it. Derived by the
   * lesson from the same evidence as the guide; drawn in the scene's
   * `props` slot, and nowhere if the scene has none.
   */
  staging?: Staging | undefined
  /**
   * Reading: a short stage — the crow and the robot, and what the crow
   * says — over a sheet that carries the question and, later, the key.
   * The sheet is drawn from what it is handed, like everything else here.
   */
  compact?: boolean
  /** The beat controls, when a lesson is telling a script. */
  telling?: Telling | undefined
  /** Who is off stage, asleep or waving at this beat. Cosmetic: derived
   *  from the lesson's beats, never from memory, and changes nothing. */
  cast?: CastView | undefined
  children?: ReactNode
}) {
  const view = readScene(spec, snapshot)
  // Finished, by whichever measure this activity has — and only one of
  // them applies. A guided lesson is done when its last step is done; a
  // scene with no lesson is done when its watches are satisfied.
  //
  // Not an OR of the two. `order` has both a lesson and a watch, and the
  // watch is satisfied by its *first* step — so an OR would have declared
  // the lesson complete a third of the way through it.
  const done = triumph ?? view.solved
  const robot = view.actors.find((a) => a.actor.kind === 'robot')
  // One band for the whole cast, so no bubble can cover a face.
  const lift = speechLift(spec)
  const speaker =
    (guide?.speaker ? view.actors.find((a) => a.actor.id === guide.speaker) : undefined) ??
    view.actors.find((a) => a.actor.kind === 'crow') ??
    view.actors[0]
  const guideShown = guide !== undefined && speaker !== undefined
  const thoughtShown = (thinking === true || Boolean(thought)) && robot !== undefined
  // The rail hangs from whoever is speaking, or from the robot when only
  // the robot has something in mind.
  const anchor = guideShown ? speaker : thoughtShown ? robot : undefined
  const railRef = useRef<HTMLDivElement | null>(null)
  useBeside(railRef, [guide?.text, speaker?.actor.id, thought, thinking])
  // A new line pops the bubble in again, and a new value pops the cloud.
  // Played straight on the element, never through a `key`: remounting
  // either would replace a live region, and a screen reader does not
  // reliably announce one that has only just appeared. A new *speaker*
  // does not pop: the bubble slides across to them instead (its `left`
  // is transitioned), which reads as the same conversation moving on.
  const speechRef = useRef<HTMLDivElement | null>(null)
  const tailRef = useRef<HTMLSpanElement | null>(null)
  const thoughtRef = useRef<HTMLDivElement | null>(null)
  const nextRef = useRef<HTMLButtonElement | null>(null)
  const line = guideShown ? `${guide.key ?? ''}\u0000${guide.text}` : null
  const who = guideShown ? speaker.actor.id : null
  useSpeechPop(speechRef, tailRef, line, who)
  usePop(thoughtRef, thoughtShown ? (thinking ? '\u2026' : (thought ?? '')) : null, THOUGHT_POP)

  // The line, typed on: one span per character, each with its delay, and
  // how long the whole takes — which is also how long the speaker's mouth
  // moves and when the continue cue appears.
  const typed = guideShown ? typeOn(richText(guide.text)) : null
  const voice = speakerOf(guideShown ? speaker.actor.id : undefined)
  const kind = guide?.kind ?? 'ask'
  const asking = kind === 'ask' || kind === 'reply'
  const listening = telling?.listening === true
  // Next stays dim while the line types, then comes up: drawn on the
  // element, keyed on the line, like the pops.
  usePop(nextRef, listening ? line : null, {
    frames: [{ opacity: 0.55 }, { opacity: 0.55, offset: 0.92 }, { opacity: 1 }],
    calm: [{ opacity: 1 }, { opacity: 1 }],
    options: { duration: (typed?.ms ?? 0) + 120, easing: 'linear' },
  })

  /**
   * Next: the first press finishes the line if it is still typing, the
   * second moves on. Whether it is typing is asked of the bubble's own
   * animations, so nothing here keeps count.
   */
  const next = () => {
    const bubble = speechRef.current
    const stage = bubble?.closest('.stage')
    const typing =
      bubble && typeof bubble.getAnimations === 'function'
        ? bubble.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && isTyping(a))
        : []
    if (typing.length > 0) {
      for (const a of typing) a.finish()
      // The mouth stops with the words.
      for (const el of stage?.querySelectorAll('.talking') ?? []) for (const a of el.getAnimations()) a.finish()
      for (const a of nextRef.current?.getAnimations() ?? []) a.finish()
      return
    }
    telling?.onNext()
  }
  // Enter or Space anywhere moves narration on — anywhere that is not
  // itself something those keys work (a button presses itself; the
  // console is closed while this listens).
  const nextKey = useRef(next)
  nextKey.current = next
  useEffect(() => {
    if (!listening) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key !== 'Enter' && e.key !== ' ') return
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return
      e.preventDefault()
      nextKey.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [listening])

  const hidden = new Set(cast?.hidden ?? [])
  const asleep = new Set(cast?.asleep ?? [])
  const acting = new Map((cast?.acting ?? []).map((a) => [a.actor, a.do]))

  const panelRef = useRef<HTMLDivElement | null>(null)
  useFootRoom(panelRef, view.waitingFor.length)

  return (
    <div ref={panelRef} className={`scene-panel ${compact ? 'compact' : ''}`} data-testid="scene">
      <div className="stage" data-scene={spec.id}>
        {/* Drawn before the cast, so everyone stands in front of it. */}
        {spec.floor && (
          <div
            className="floor"
            data-look={spec.floor.look ?? 'ground'}
            data-testid="floor"
            style={{ top: `${spec.floor.at}%` }}
          />
        )}

        {meter && (
          <div className="practice-meter" data-testid="practice-meter">
            <div
              className="practice-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={meter.of}
              aria-valuenow={meter.at}
              aria-label="Practice progress"
            >
              {meter.results.map((r, i) => (
                <span
                  key={i}
                  className={`practice-seg ${i < meter.at ? (r ? 'right' : 'recovered') : i === meter.at ? 'now' : ''}`}
                />
              ))}
            </div>
            <span className="practice-count">
              {Math.min(meter.at + 1, meter.of)} / {meter.of}
            </span>
            {/* The question stays on screen while the crow talks about the
                answer, so a hint never costs the player the question. */}
            {meter.task && guide && guide.text !== meter.task && (
              <p className="practice-task" data-testid="practice-task">
                {richText(meter.task)}
              </p>
            )}
          </div>
        )}

        {telling && telling.steps > 0 && (
          // Thin, along the top: one segment per step, the current one
          // filling as its beats are told. Where the lesson is, at a
          // glance, without a number to read.
          <div
            className="beat-bar"
            data-testid="beat-bar"
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuemin={0}
            aria-valuemax={telling.steps}
            aria-valuenow={Math.min(telling.step, telling.steps)}
          >
            {Array.from({ length: telling.steps }, (_, i) => (
              <span
                key={i}
                className={`beat-seg ${i < telling.step ? 'done' : i === telling.step ? 'now' : ''}`}
                style={{ ['--fill' as string]: String(i < telling.step ? 1 : i === telling.step ? telling.through : 0) }}
              />
            ))}
          </div>
        )}

        {telling?.listening && (
          // Bottom-centre, where the eye goes after the line: Next, and a
          // small Back beside it. Only while narration shows — at the ask
          // the keyboard belongs to the console, and this gives way to the
          // pointer at it.
          <div className="beat-controls" data-testid="beat-controls">
            {telling.back && (
              <button type="button" className="beat-back" onClick={telling.onBack} data-testid="beat-back" aria-label="Back">
                ◂
              </button>
            )}
            <button ref={nextRef} type="button" className="beat-next" onClick={next} data-testid="beat-next">
              Next
            </button>
          </div>
        )}

        {/* No "Type your answer" pointer on the stage: two cues pointing off
            the stage's edge at the console, from nowhere near it, read as
            noise. The console's own prompt says it, where the typing is. */}

        {telling?.resting && telling.takeaway && (
          // The lesson in a sentence or two (R11), kept on screen once
          // everything has been said. Replay tells the closing lines again.
          <div className="takeaway" data-testid="takeaway">
            <p>{richText(telling.takeaway)}</p>
            <button type="button" className="takeaway-replay" onClick={telling.onReplay} data-testid="replay">
              Replay
            </button>
          </div>
        )}

        {/* The way on: back to the map, to see what finishing unlocked. It
            used to live inside the guide's bubble, which meant the two
            activities with no guide — the editor ones — had no way to
            offer it at all. It belongs to the level.
            Not while there is still something to say: finished lessons end
            on closing lines, and Next and Continue side by side left the
            player to guess which one. Continue arrives with the last line. */}
        {onAdvance && done && !listening && (
          <button type="button" className="advance" onClick={onAdvance} data-testid="advance">
            Continue
          </button>
        )}

        {spec.props && staging && (staging.current || staging.leaving) && (
          // Stands on the floor between the cast, drawn before them so a
          // character's shadow is never under a picture's edge.
          <div
            className="props-slot"
            data-testid="props"
            style={{
              left: `${spec.props.x}%`,
              width: `${spec.props.w}%`,
              bottom: `${100 - (spec.floor?.at ?? 80)}%`,
            }}
          >
            {/* One keyed list, so the picture the player just answered is
                the *same element* when it becomes the leaving one: its
                demonstration is not replayed, and the answer's effect —
                the lamp coming on — plays as a transition on it. */}
            {[staging.leaving, staging.current].map((v) =>
              v === null ? null : (
                <PropLayer
                  key={v.key}
                  view={v}
                  role={v === staging.leaving ? 'leaving' : 'current'}
                  beat={v === staging.current && staging.leaving !== null}
                />
              ),
            )}
            {staging.current?.ask && (
              // The question stays put while the crow answers a miss —
              // under the picture, on the floor, where nothing else goes.
              <p key={staging.current.key} className="prop-ask" data-testid="prop-ask" style={{ ['--beat' as string]: staging.leaving ? '1.7s' : '0s' }}>
                {staging.current.ask}
              </p>
            )}
          </div>
        )}

        {view.actors.map((a, i) => (
          <ActorNode
            key={a.actor.id}
            view={a}
            order={i}
            // Each to their own: the robot feels its run, everyone else
            // feels the robot. A finished scene pleases the whole cast.
            mood={a.actor.kind === 'robot' ? moods.robot : done ? 'pleased' : moods.npc}
            floor={spec.floor}
            pleased={done}
            talk={guideShown && speaker.actor.id === a.actor.id ? line ?? undefined : undefined}
            talkFor={typed?.ms ?? 0}
            // Everyone else looks at whoever is talking.
            look={
              guideShown && speaker.actor.id !== a.actor.id
                ? speaker.actor.x < a.actor.x
                  ? 'left'
                  : 'right'
                : undefined
            }
            offstage={hidden.has(a.actor.id)}
            asleep={asleep.has(a.actor.id)}
            acting={acting.get(a.actor.id)}
          />
        ))}

        {(guideShown || thoughtShown) && anchor && (
          // One rail for everything said or thought, in one column: the
          // thought on top, the speech under it. Stacking them in flow is
          // what keeps them apart — the speech can wrap to any number of
          // lines and the thought is simply pushed up by it, where a fixed
          // gap tuned to one line length overlapped the next longer one.
          // When they are side by side anyway, `useBeside` lets the
          // thought come back down to the robot's head.
          //
          // The rail's bottom edge is the scene's speech band, the top of
          // the tallest standing actor: `bottom` in percent of the stage's
          // height, then a percentage `margin-bottom`, which CSS resolves
          // against the containing block's *width*, to add the actor's
          // drawn height. That mixes the two axes without measuring
          // anything, and it is what keeps a bubble off every face.
          //
          // The rail spans the stage, so a bubble's width is its
          // `max-width` rather than whatever room happened to be left
          // between the speaker and the right-hand edge.
          <div
            ref={railRef}
            className={`bubble-rail ${guideShown ? 'with-speech' : ''}`}
            data-kind={guideShown ? kind : undefined}
            style={railAnchor(anchor.actor, spec.floor, lift)}
          >
            {thoughtShown && (
              // A cloud, not a speech bubble: the robot is thinking of
              // this, not saying it. Centred over the robot, with a trail
              // of shrinking puffs falling towards its head.
              <div
                ref={thoughtRef}
                className={`thought ${thinking ? 'working' : ''}`}
                style={{ left: `${bubbleX(robot.actor.x) - 50}%` }}
                data-testid="thought"
                aria-live="polite"
              >
                <span className="thought-value">
                  {thinking ? <span className="dots" aria-label="thinking" /> : thought}
                </span>
                <span className="thought-trail" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}
            {guideShown && (
              <div
                ref={speechRef}
                className={`bubble ${asking ? 'asking' : 'telling'} ${kind === 'reply' ? 'reply' : ''}`}
                data-testid="guide"
                data-speaker={speaker.actor.id}
                data-kind={kind}
                // Kept inside the stage: a character near an edge would
                // otherwise push half the sentence out of the panel, and
                // the guide is the one thing that has to be readable. The
                // body moves; the tail does not, so the clamp cannot make
                // the bubble point at the wrong character.
                //
                // The shift is handed to CSS as a number rather than as the
                // `left` itself, so a narrow stage — where the body is wider
                // and has less room to slide — can clamp it further.
                style={{
                  ['--shift' as string]: String(bubbleX(speaker.actor.x) - 50),
                  ['--speaker' as string]: `var(${voice.colour})`,
                  ['--type-ms' as string]: `${typed?.ms ?? 0}ms`,
                }}
                aria-live="polite"
              >
                {/* Who is talking, in their colour, on the top edge. Part
                    of the live region on purpose: "Mira: …" is how a
                    screen reader should hear a change of speaker. */}
                <span className="bubble-name" data-testid="speaker-name">
                  {voice.name}
                  <span className="sr-only">:</span>
                </span>
                {asking && guide.tag && (
                  <span className="bubble-who" data-testid="ask-tag" data-tag={guide.tag}>
                    {guide.tag === 'robot' ? 'Robot works it out' : 'You answer'}
                  </span>
                )}
                {/* Keyed on the line, so a new line's characters are new
                    elements and type on afresh. The live region itself is
                    the same element throughout. */}
                <span key={line ?? ''} className="bubble-text">
                  {typed?.nodes}
                </span>
                {listening && (
                  <span className="bubble-cue" aria-hidden="true">
                    ▸
                  </span>
                )}
              </div>
            )}
            {guideShown && (
              // The band sits at the tallest actor's head, so a shorter
              // speaker is some way below it. The tail reaches down that
              // far (`--drop`, in the same width units as the band), or
              // the bubble would point at the air above the crow.
              //
              // Short and curved, and it leans: its root is pulled towards
              // the bubble's body, so when the clamp has slid the body away
              // from a speaker near the edge the tail still grows out of
              // the bubble rather than beside it. Its `left` is
              // transitioned, so a change of speaker swings it across.
              <span
                ref={tailRef}
                className="bubble-tail"
                aria-hidden="true"
                data-lean={lean(speaker.actor.x)}
                style={{
                  left: `${speaker.actor.x}%`,
                  ['--drop' as string]: `${speechDrop(speaker.actor, spec.floor, lift)}%`,
                }}
              >
                <svg viewBox="0 0 32 10" preserveAspectRatio="none">
                  <path className="tail-fill" d={TAIL[lean(speaker.actor.x)].fill} />
                  <path className="tail-edge" d={TAIL[lean(speaker.actor.x)].edge} />
                </svg>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Only when the scene is actually waiting for something. With the
          description gone there is otherwise nothing to put here, and an
          empty bar is worse than no bar. */}
      {children !== undefined && <div className="sheet-scroll">{children}</div>}

      {view.waitingFor.length > 0 && (
        <div className="stage-foot">
          <ul className="waiting" data-testid="waiting">
            {view.waitingFor.map((w) => (
              <li key={w.name}>{richText(w.hint)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Lets the thought come down beside the speech when there is room.
 *
 * The rail stacks the thought above the speech, which can never overlap
 * — but when the two are side by side anyway (the crow at one end of the
 * stage, the robot at the other) it leaves the thought floating a whole
 * speech bubble above the robot's head. Whether they clash sideways
 * depends on how wide the text came out, which only layout knows, so it
 * is measured.
 *
 * Written straight to the rail as `--beside`, never through React: this
 * is drawing, and the scene still holds no state. Stacked is the default
 * and the fallback, so a measurement that has not happened yet can only
 * cost height, never an overlap. Only the thought moves, and only
 * vertically, so the measurement cannot change its own answer.
 */
function useBeside(ref: { current: HTMLDivElement | null }, deps: unknown[]) {
  useLayoutEffect(() => {
    const rail = ref.current
    if (!rail) return
    const place = () => {
      const thought = rail.querySelector('.thought')
      const speech = rail.querySelector('.bubble')
      if (!thought || !speech) {
        rail.style.removeProperty('--beside')
        return
      }
      // Layout boxes, not client rects: both are popping in when this
      // runs, and a box measured part-way through a scale is smaller than
      // the one it settles into — which could call two bubbles apart that
      // are about to overlap. Offsets ignore transforms; both are
      // positioned children of the rail, so they share one origin.
      const t = box(thought as HTMLElement)
      const b = box(speech as HTMLElement)
      // The puffs reach about 11px past the cloud's box; the rest is air.
      const room = 20
      const apart = t.right + room <= b.left || b.right + room <= t.left
      // Everything from the top of the speech to the foot of the rail is
      // what the thought can come down by.
      const drop = rail.offsetHeight - b.top
      rail.style.setProperty('--beside', apart ? `${Math.round(drop)}px` : '0px')
    }
    place()
    // A dragged gutter changes the stage's width, and with it both widths.
    const watch = new ResizeObserver(place)
    watch.observe(rail)
    return () => watch.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/**
 * Keeps what stands on the stage's bottom edge — Next and Back, the
 * pointer at the console, the takeaway, Continue — clear of the hint
 * strip, which floats over the bottom of the stage (see `.stage-foot` in
 * `styles.css` for why it floats rather than taking room).
 *
 * It used to sit over them: the order and wake scenes wait on a name from
 * their first beat, so their narration opened with Next under "the ticket
 * is waiting for `customer`", and the one control a beat needs could not
 * be seen or pressed. How tall the strip is depends on how its hints wrap,
 * which only layout knows, so it is measured and written straight to the
 * panel as `--foot`, never through React — drawing, like `useBeside`.
 */
function useFootRoom(ref: { current: HTMLDivElement | null }, hints: number) {
  useLayoutEffect(() => {
    const panel = ref.current
    const foot = panel?.querySelector<HTMLElement>(':scope > .stage-foot')
    if (!panel || !foot) {
      panel?.style.removeProperty('--foot')
      return
    }
    const place = () => panel.style.setProperty('--foot', `${Math.ceil(foot.offsetHeight)}px`)
    place()
    const watch = new ResizeObserver(place)
    watch.observe(foot)
    return () => {
      watch.disconnect()
      panel.style.removeProperty('--foot')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hints])
}

const box = (el: HTMLElement) => ({
  left: el.offsetLeft,
  right: el.offsetLeft + el.offsetWidth,
  top: el.offsetTop,
})

type Pop = { frames: Keyframe[]; calm: Keyframe[]; options: KeyframeAnimationOptions }

/** Ease-out on the way in, scaled from where the tail meets it, so the
 *  box only ever grows into the one it settles at — it never covers what
 *  the settled bubble would not. Small (.96) and quick (~180ms): a line
 *  arriving, not a window opening. */
const BUBBLE_POP: Pop = {
  frames: [
    { opacity: 0, transform: 'scale(0.96)' },
    { opacity: 1, transform: 'none' },
  ],
  calm: [{ opacity: 0 }, { opacity: 1 }],
  options: { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
}

const TAIL_FADE: Pop = {
  frames: [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }],
  calm: [{ opacity: 0 }, { opacity: 1 }],
  options: { duration: 180, easing: 'ease-out' },
}

/**
 * The bubble's pop, played for a new line from the same speaker. A new
 * speaker gets no pop — the bubble's `left` and the tail's are
 * transitioned in CSS, so it slides across to them instead of blinking
 * out and back.
 *
 * The previous speaker is kept in a ref: drawing memory, like an
 * animation's own progress, never read by anything that decides what is
 * shown.
 */
function useSpeechPop(
  bubble: { current: HTMLElement | null },
  tail: { current: HTMLElement | null },
  line: string | null,
  who: string | null,
) {
  const said = useRef<string | null>(null)
  useLayoutEffect(() => {
    const was = said.current
    said.current = who
    const el = bubble.current
    if (line === null || !el || typeof el.animate !== 'function') return
    if (was !== null && who !== was) return
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    // From the tail: where it meets the bubble, as an origin in the
    // bubble's own box. Layout offsets, which ignore the transform about
    // to be played.
    const t = tail.current
    if (t && t.offsetParent === el.offsetParent) {
      const x = t.offsetLeft + t.offsetWidth / 2 - el.offsetLeft
      el.style.transformOrigin = `${Math.max(0, Math.min(el.offsetWidth, x))}px 100%`
    }
    const runs = [el.animate(calm ? BUBBLE_POP.calm : BUBBLE_POP.frames, BUBBLE_POP.options)]
    if (t && typeof t.animate === 'function') runs.push(t.animate(calm ? TAIL_FADE.calm : TAIL_FADE.frames, TAIL_FADE.options))
    return () => runs.forEach((r) => r.cancel())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line])
}

/* ------------------------------ typing on ------------------------------ */

/** About 45 characters a second, with a breath at a comma and a longer
 *  one at the end of a sentence. */
const CHAR_MS = 22
const PAUSE_MS: Record<string, number> = { ',': 160, ';': 160, ':': 160, '.': 300, '!': 300, '?': 300, '…': 300 }
/** A code chip is one thing, and arrives whole. */
const CHIP_MS = 90

/** The keyframe name the characters type on with (`console.css`). */
const TYPE_IN = 'type-in'

const isTyping = (a: Animation): boolean =>
  a instanceof CSSAnimation ? a.animationName === TYPE_IN || a.animationName === 'cue-in' : false

/**
 * Types a line on: the output of `richText`, with every character of its
 * prose in a span that appears at its own moment, and every code chip in
 * one span that appears whole. `ms` is when the last one does.
 *
 * Emphasis and strong words are walked into, so they type on with the
 * rest; only `code` is kept whole, because a half-typed `True` is a
 * different token, and chips are what the lesson asks the player to type.
 */
export function typeOn(nodes: ReactNode): { nodes: ReactNode; ms: number } {
  let t = 0
  const at = (d: number): CSSProperties => ({ ['--d' as string]: `${d}ms` })
  const walk = (n: ReactNode): ReactNode =>
    Children.map(n, (child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return [...String(child)].map((ch, i) => {
          const d = t
          t += PAUSE_MS[ch] ?? CHAR_MS
          return (
            <span key={i} className="tw" style={at(d)}>
              {ch}
            </span>
          )
        })
      }
      if (!isValidElement(child)) return child
      const el = child as ReactElement<{ children?: ReactNode }>
      if (el.type === 'code') {
        const d = t
        t += CHIP_MS
        return (
          <span className="tw chip" style={at(d)}>
            {el}
          </span>
        )
      }
      return el.props.children === undefined ? el : cloneElement(el, undefined, walk(el.props.children))
    })
  const out = walk(nodes)
  return { nodes: out, ms: t }
}

/** Keys the player uses on these elements, so Enter and Space there are
 *  theirs and not Next's. */
const INTERACTIVE = 'button, a[href], input, textarea, select, [contenteditable], [role="slider"], .graph, .cm-editor'

/**
 * Which way the tail leans: towards the bubble's body, when the clamp has
 * slid it away from the speaker; straight down when it has not.
 */
const lean = (x: number): 'left' | 'none' | 'right' => {
  const off = bubbleX(x) - x
  return off > 6 ? 'right' : off < -6 ? 'left' : 'none'
}

/**
 * The tail, in a 32 × 10 box whose centre bottom is the speaker's head:
 * its root is 16 wide, under the body, and it curves down to a rounded
 * tip. `edge` is the two sides only — the top is inside the bubble.
 */
const TAIL: Record<'left' | 'none' | 'right', { fill: string; edge: string }> = {
  none: {
    fill: 'M 8 0 Q 13 5 15 9.2 Q 16 10.4 17 9.2 Q 19 5 24 0 Z',
    edge: 'M 8 0 Q 13 5 15 9.2 Q 16 10.4 17 9.2 Q 19 5 24 0',
  },
  right: {
    fill: 'M 16 0 Q 17 5 15.4 9 Q 15.8 10.6 17.2 9.4 Q 25 5 32 0 Z',
    edge: 'M 16 0 Q 17 5 15.4 9 Q 15.8 10.6 17.2 9.4 Q 25 5 32 0',
  },
  left: {
    fill: 'M 0 0 Q 7 5 14.8 9.4 Q 16.2 10.6 16.6 9 Q 15 5 16 0 Z',
    edge: 'M 0 0 Q 7 5 14.8 9.4 Q 16.2 10.6 16.6 9 Q 15 5 16 0',
  },
}

/** A cloud puffs rather than slides: a small scale from its trail. */
const THOUGHT_POP: Pop = {
  frames: [
    { opacity: 0.2, transform: 'scale(0.8)' },
    { opacity: 1, transform: 'none' },
  ],
  calm: [{ opacity: 0.2 }, { opacity: 1 }],
  options: { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
}

/**
 * Plays a pop on an element whenever `key` changes to something shown.
 *
 * Drawing, not state: nothing is stored, and the element is the same one
 * throughout. Under reduced motion only the fade plays.
 */
function usePop(ref: { current: HTMLElement | null }, key: string | null, pop: Pop) {
  useLayoutEffect(() => {
    const el = ref.current
    if (key === null || !el || typeof el.animate !== 'function') return
    const calm =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const run = el.animate(calm ? pop.calm : pop.frames, pop.options)
    return () => run.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

/**
 * Horizontal anchor for a speech bubble's *body*, clamped clear of both
 * edges. The clamp is 31–69 rather than the whole stage because the body
 * is at most 62% wide, so anywhere in this range keeps all of it on
 * screen — at a 320px panel as much as a 900px one. The tail is not
 * clamped, so anchoring to the speaker is not what the clamp costs.
 */
export const bubbleX = (x: number): number => Math.min(Math.max(x, 31), 69)

/**
 * Half an actor's rendered height, in percent of the stage *width* —
 * the unit a percentage margin resolves in.
 *
 * A character's height is its width times its own viewBox ratio, so the
 * cast's ratios are the numbers that matter. Everything else on the stage
 * is a prop of fixed or near-square height, and 1 is a safe over-estimate
 * there: a bubble that clears too much is merely high, one that clears
 * too little sits on a face.
 */
const ACTOR_RATIO: Partial<Record<ActorKind, number>> = {
  robot: 170 / 140,
  crow: 160 / 140,
  courier: 180 / 140,
}

export const halfHeightPct = (actor: Actor): number =>
  (widthOf(actor) * (ACTOR_RATIO[actor.kind] ?? 1)) / 2

/**
 * How far above the floor every bubble in a scene starts, in percent of
 * the stage *width* — the unit a percentage margin resolves in.
 *
 * The tallest actor's height, not the speaker's. Bubbles used to hang
 * from each speaker's own head, and with the cast standing on one floor
 * that put a short character's bubble across a tall one's face: in the
 * counter scene the crow is at x=13, its bubble clamps to 31% to stay on
 * stage, and 31% is directly above the robot.
 *
 * One band for the whole cast reads like a comic strip and cannot cover
 * anybody, whoever is speaking. The tail still points at the speaker, so
 * nothing is lost by lifting the box.
 */
export function speechLift(spec: SceneSpec): number {
  const lifts = spec.actors
    .filter((a) => a.stand === true)
    .map((a) => halfHeightPct(a) * 2)
  // The lesson's picture stands on the same floor, so the band clears it
  // too. Its slot is `w` wide at the picture's own aspect, which is a
  // height in the band's unit (percent of the stage width) with nothing
  // measured; `PROP_CLEAR` is for the answer tag and the demonstrations,
  // which draw a little over the slot's top edge. Every picture today is
  // shorter than the tallest actor, so this changes nothing yet — it is
  // the rule that keeps it so when a picture grows.
  if (spec.props && spec.floor && lifts.length > 0) lifts.push(propHeightPct(spec.props.w) + PROP_CLEAR)
  return lifts.length > 0 ? Math.max(...lifts) : 0
}

/** A picture's slot is drawn at 200 × 130 (`src/ui/Props.tsx`). */
const PROP_ASPECT = 130 / 200
/** How far a picture's ink may reach above its slot, in percent of width. */
const PROP_CLEAR = 1.5

/** The height of a props slot `w` percent wide, in percent of the width. */
export const propHeightPct = (w: number): number => w * PROP_ASPECT

/**
 * Where a bubble's rail sits, so its bottom edge is the top of the
 * scene's speech band.
 *
 * A scene with no floor has nobody standing, so it falls back to the
 * speaker's own centre — which is what the fixtures-only scenes want.
 */
export function railAnchor(
  actor: Actor,
  floor: Floor | undefined,
  lift = 0,
): { bottom: string; marginBottom: string } {
  if (actor.stand && floor) {
    return {
      bottom: `${100 - floor.at}%`,
      marginBottom: `${Math.max(lift, halfHeightPct(actor) * 2)}%`,
    }
  }
  return { bottom: `${100 - actor.y}%`, marginBottom: `${halfHeightPct(actor)}%` }
}

/**
 * How far below the speech band this speaker's head is, in percent of the
 * stage width — the length the bubble's tail has to reach down.
 *
 * Zero for the tallest actor, whose head *is* the band, and for anyone
 * not standing, whose rail hangs from them directly.
 */
export function speechDrop(actor: Actor, floor: Floor | undefined, lift = 0): number {
  if (!(actor.stand && floor)) return 0
  return Math.max(0, lift - halfHeightPct(actor) * 2)
}

/**
 * Idle timing for one actor, derived from its id so it is the same on
 * every render and every visit, and different from its neighbours — two
 * characters blinking in unison read as one machine.
 */
export function idleTiming(id: string): Record<string, string> {
  // FNV-1a: small, and enough to scatter a handful of ids.
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  const pick = (shift: number, lo: number, hi: number) =>
    lo + (((h >>> shift) & 0xff) / 0xff) * (hi - lo)
  const s = (n: number) => `${n.toFixed(2)}s`
  return {
    // Negative delays start each loop part-way through, so nobody begins
    // in step with anybody else.
    '--blink-dur': s(pick(0, 8, 11)),
    '--blink-delay': s(-pick(8, 0, 8)),
    '--breathe-dur': s(pick(16, 3.2, 4.4)),
    '--breathe-delay': s(-pick(24, 0, 3)),
    '--glance-delay': s(-pick(4, 0, 10)),
  }
}

function ActorNode({
  view,
  order,
  mood,
  floor,
  pleased,
  talk,
  talkFor = 0,
  look,
  offstage = false,
  asleep = false,
  acting,
}: {
  view: ActorView
  /** Where it comes in the cast, for the step-in on arrival. */
  order: number
  mood: Mood
  /** What it is saying, while it is its turn. */
  talk?: string | undefined
  /** How long the line takes to type on, so the mouth moves for as long
   *  as the words arrive — a finite flap, counted, not timed. */
  talkFor?: number
  /** Which way to look: at whoever is talking. */
  look?: 'left' | 'right' | undefined
  floor: Floor | undefined
  /** The scene as a whole is satisfied — the only thing that earns a
   *  celebration. Per-actor `lit` is not enough: one lamp on out of
   *  three watches is a third of the way there. */
  pleased: boolean
  /** Not on stage yet (or any more): a lesson beat brings them on. */
  offstage?: boolean
  /** The robot's screen is dark. */
  asleep?: boolean
  /** A one-shot a beat asked for. */
  acting?: 'wave' | 'hop' | undefined
}) {
  const { actor } = view
  const standing = actor.stand === true && floor !== undefined
  // Only the cast has a face to celebrate with.
  const cast = actor.kind === 'robot' || actor.kind === 'crow' || actor.kind === 'courier'
  // An even number of alternating runs ends with the mouth shut.
  const flaps = (period: number) => String(Math.max(2, 2 * Math.ceil(talkFor / period / 2)))

  return (
    <div
      className={`actor ${actor.kind} ${standing ? 'standing' : ''} ${view.lit ? 'lit' : ''} ${view.picked ? 'picked' : ''} ${cast && pleased ? 'cheer' : ''} ${offstage ? 'offstage' : ''} ${asleep ? 'asleep' : ''} ${acting ? `act-${acting}` : ''}`}
      style={{
        ...placement(actor, floor),
        ...(cast ? idleTiming(actor.id) : {}),
        ['--order' as string]: String(order),
        ...(talk !== undefined && talkFor > 0 ? { ['--talk-jaw' as string]: flaps(170), ['--talk-peck' as string]: flaps(150) } : {}),
      }}
      data-stand={standing ? 'yes' : 'no'}
      data-testid={`actor-${actor.id}`}
      data-lit={view.lit ? 'yes' : 'no'}
      data-picked={view.picked ? 'yes' : 'no'}
      data-look={look}
      data-offstage={offstage ? 'yes' : 'no'}
      data-asleep={asleep ? 'yes' : 'no'}
      aria-hidden={offstage ? true : undefined}
    >
      {actor.kind === 'robot' && <Robot mood={pleased ? 'celebrate' : mood} talk={talk} />}
      {actor.kind === 'crow' && <Crow mood={mood} talk={talk} />}
      {actor.kind === 'courier' && <Courier mood={mood} talk={talk} />}

      {actor.kind === 'plinth' && <div className="plinth-top" />}

      {actor.kind === 'lamp' && (
        <div className="bulb" role="img" aria-label={`The lamp is ${view.lit ? 'lit' : 'dark'}`}>
          <span className="glow" />
        </div>
      )}

      {actor.kind === 'gauge' && (
        // A cap and a scale, so the silhouette reads as a battery whether
        // or not it has a reading. Empty, this was a plain rounded box as
        // tall as the robot with an 11px dash in the corner — it looked
        // like a panel that had failed to load rather than an instrument
        // waiting to be told something.
        <div
          className="battery"
          role="img"
          aria-label={
            view.level === null
              ? 'The battery has no reading'
              : `The battery is at ${Math.round(view.level * 100)} percent`
          }
        >
          <span className="gauge-cap" />
          <div className="gauge-body" data-level={view.level === null ? 'none' : 'set'}>
            <span className="gauge-scale" />
            <span className="fill" style={{ height: `${(view.level ?? 0) * 100}%` }} />
            <span className="gauge-text">
              {view.level === null ? '—' : `${Math.round(view.level * 100)}%`}
            </span>
          </div>
        </div>
      )}

      {actor.kind === 'crate' && (
        <div className="crate-body">
          <span className="crate-label">{actor.label}</span>
          <span className="sr-only">{view.picked ? ', lifted' : ', not lifted'}</span>
        </div>
      )}

      {actor.kind === 'sign' && <div className="sign-body">{view.caption ?? '—'}</div>}
    </div>
  )
}
