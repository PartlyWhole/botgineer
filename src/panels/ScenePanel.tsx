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
  /** A multiple-choice question: the options, drawn on the stage, and the
   *  ones already tried. */
  choices?: ScriptItem['choices']
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
  onChoose,
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
  /** A multiple-choice option was picked. Handed straight back to the
   *  workbench, which keeps the picks; the scene still decides nothing. */
  onChoose?: ((choice: string) => void) | undefined
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
  // The cloud may lean a quarter of the robot's width to clear the speech,
  // and its middle is still over the robot's head.
  const cloudLean = robot ? widthOf(robot.actor) / 4 / 100 : 0
  useBeside(railRef, cloudLean, [guide?.text, speaker?.actor.id, thought, thinking])
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
  useTail(railRef, speechRef, tailRef, [line, who, speaker?.actor.x])
  useCloud(thoughtRef, [thought, thinking, robot?.actor.x, guide?.text])
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
  const stageRef = useRef<HTMLDivElement | null>(null)
  usePropsTop(stageRef, [spec, meter !== undefined, telling !== undefined && telling.steps > 0])
  // A goal memory is read row by row, so it stands up top, where it can be
  // large, rather than on the floor between the cast (`useRaised`).
  const raise = staging?.current?.prop.kind === 'goal'
  useRaised(stageRef, raise, spec.props?.w ?? 0, [guide?.text, thought])

  return (
    <div ref={panelRef} className={`scene-panel ${compact ? 'compact' : ''}`} data-testid="scene">
      <div
        ref={stageRef}
        className="stage"
        data-scene={spec.id}
        data-props={spec.props ? 'yes' : undefined}
        data-backdrop={spec.backdrop}
        style={spec.floor ? { ['--floor-at' as string]: `${spec.floor.at}%` } : undefined}
      >
        {/* Rearmost of all: scenery, behind the floor, the pictures and
            the cast. It reads nothing and decides nothing (invariant 12). */}
        {spec.backdrop && <Backdrop kind={spec.backdrop} />}

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

        {guide?.choices && onChoose && (
          // A multiple-choice question is the player answering the crow,
          // not instructing the robot, so its answers stand here, where
          // Next stands during narration, and the console stays closed.
          // An option already tried stays marked, and cannot be picked
          // again.
          <Options key={guide.choices.id} choices={guide.choices} onChoose={onChoose} />
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
            className={raise ? 'props-slot raised' : 'props-slot'}
            data-testid="props"
            // As custom properties, not `left`/`width`/`bottom`: a narrow
            // stage stands the picture elsewhere (`styles.css`, "the
            // picture on a narrow stage"), and an inline position would
            // win over any stylesheet.
            style={{
              ['--prop-x' as string]: `${spec.props.x}%`,
              ['--prop-w' as string]: `${spec.props.w}%`,
              ['--prop-b' as string]: `${100 - (spec.floor?.at ?? 80)}%`,
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
                {/* The cloud and its trail, drawn around the value's box
                    (`useCloud`): even puffs all the way round, one outline,
                    and three shrinking puffs that fall towards the
                    robot's head. */}
                <svg className="thought-shape" aria-hidden="true">
                  <path className="cloud" />
                  <circle />
                  <circle />
                  <circle />
                </svg>
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
              // far (`data-drop`, in percent of the stage's width), or the
              // bubble would point at the air above the crow.
              //
              // Drawn from where the bubble really is (`useTail`): its root
              // always on the flat of the bubble's bottom edge, clear of the
              // rounded corners, and its tip on the speaker's head, however
              // far the clamp has slid the body away from them.
              <span
                ref={tailRef}
                className="bubble-tail"
                aria-hidden="true"
                data-x={speaker.actor.x}
                data-drop={speechDrop(speaker.actor, spec.floor, lift)}
              >
                <svg>
                  <path className="tail-fill" />
                  <path className="tail-edge" />
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

/** The data types, drawn in their own colours as the shelf draws them. */
const KIND_OPTION = new Set(['bool', 'int', 'float', 'str'])

/**
 * The options in an order of the question's own: lessons write the right
 * answer first, and a learner soon learns that it is always A. Sorted by a
 * hash of the question and the option, so the order is the same on every
 * visit and after a wrong pick — drawing, never state. The four data types
 * keep their own order, bool · int · float · str, the shelf's.
 */
function shuffled<T extends { id: string }>(question: string, options: T[]): T[] {
  if (options.length === 4 && options.every((o) => KIND_OPTION.has(o.id))) return options
  const hash = (text: string) => {
    let h = 0x811c9dc5
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h
  }
  return [...options].sort((a, b) => hash(`${question}:${a.id}`) - hash(`${question}:${b.id}`))
}

/**
 * A multiple-choice question's options: one button each, lettered A, B, C…
 * Letters, not numbers: a question about a list's slots (`hotbar[2]`) put
 * a number beside every option, and "2" read as an answer about slot 2.
 * Answered by clicking only. Nothing is focused when the question arrives:
 * the first option focused wore a ring that read as a hint, and Enter,
 * pressed to move on as it does through narration, answered with it.
 */
function Options({
  choices,
  onChoose,
}: {
  choices: NonNullable<ScriptItem['choices']>
  onChoose: (choice: string) => void
}) {
  const tried = choices.tried
  const options = shuffled(choices.id, choices.options)
  return (
    <div className="choices" role="group" aria-label="Choose an answer" data-testid="choices">
      {options.map((o, i) => {
        const no = tried.includes(o.id)
        return (
          <button
            key={o.id}
            type="button"
            className={`choice ${KIND_OPTION.has(o.id) ? `kind-${o.id}` : ''} ${no ? 'tried' : ''}`}
            data-testid={`choice-${o.id}`}
            data-tried={no ? 'yes' : 'no'}
            disabled={no}
            aria-label={no ? `${o.label}, already tried` : o.label}
            // A click, and only a click. Enter or Space on a focused option
            // is a click with no pointer behind it (`detail` 0), and was
            // how a learner answered A by pressing Enter to move on.
            onClick={(e) => {
              if (e.detail === 0) return
              onChoose(o.id)
            }}
          >
            <span className="choice-key" aria-hidden="true">
              {String.fromCharCode(65 + i)}
            </span>
            <span className="choice-label">{richText(o.label)}</span>
          </button>
        )
      })}
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
 * A wide line can end a few pixels short of the cloud's room: the crow's
 * three-line praise in the workshop reached to 13px of it, and the cloud
 * then sat a whole bubble (173px) above the robot. So the cloud may also
 * lean away from the speech by up to `lean` (a fraction of the rail's
 * width), which keeps its middle over the robot; a clash that needs more
 * than that stays stacked.
 *
 * Written straight to the rail as `--beside` and `--aside`, never through
 * React: this is drawing, and the scene still holds no state. Stacked is
 * the default and the fallback, so a measurement that has not happened
 * yet can only cost height, never an overlap. The lean is the individual
 * `translate` property, which offsets ignore, and the drop is vertical,
 * so the measurement cannot change its own answer.
 */
function useBeside(ref: { current: HTMLDivElement | null }, lean: number, deps: unknown[]) {
  useLayoutEffect(() => {
    const rail = ref.current
    if (!rail) return
    const place = () => {
      const thought = rail.querySelector('.thought')
      const speech = rail.querySelector('.bubble')
      if (!thought || !speech) {
        rail.style.removeProperty('--beside')
        rail.style.removeProperty('--aside')
        rail.style.removeProperty('--push')
        return
      }
      // Layout boxes, not client rects: both are popping in when this
      // runs, and a box measured part-way through a scale is smaller than
      // the one it settles into — which could call two bubbles apart that
      // are about to overlap. Offsets ignore transforms; both are
      // positioned children of the rail, so they share one origin.
      const t = box(thought as HTMLElement)
      // Where the speech would be without the step aside this wrote last
      // time, so the measurement cannot chase its own answer.
      const pushed = parseFloat(rail.style.getPropertyValue('--push')) || 0
      const s = settled(speech as HTMLElement)
      const b = { left: s.left - pushed, right: s.right - pushed, top: s.top }
      // The puffs reach about 11px past the cloud's box; the rest is air.
      const room = 20
      // How far the cloud must lean to clear the speech: away from it, on
      // whichever side of it the cloud already stands. Nothing when clear.
      const clear = t.right + room <= b.left || b.right + room <= t.left
      const right = t.left + t.right >= b.left + b.right
      const need = clear ? 0 : right ? b.right + room - t.left : b.left - room - t.right
      // The cloud leans as far as keeps it over the robot, and the speech
      // steps the rest of the way aside, away from it — its tail is drawn
      // to wherever it ends up, so it still points at its speaker. Only
      // while both stay on the stage; otherwise they stack.
      const W = rail.clientWidth
      const most = W * lean
      const aside = Math.max(-most, Math.min(most, need))
      const push = -(need - aside)
      const edge = 8
      const fits =
        t.left + aside >= 0 &&
        t.right + aside <= W &&
        b.left + push >= edge &&
        b.right + push <= W - edge &&
        Math.abs(push) <= W * 0.2
      // Everything from the top of the speech to the foot of the rail is
      // what the thought can come down by.
      const drop = rail.offsetHeight - b.top
      rail.style.setProperty('--beside', fits ? `${Math.round(drop)}px` : '0px')
      rail.style.setProperty('--aside', fits ? `${Math.round(aside)}px` : '0px')
      rail.style.setProperty('--push', fits ? `${Math.round(push)}px` : '0px')
    }
    place()
    // A dragged gutter changes the stage's width, and with it both widths;
    // a new value or a rewrapped line changes one of them without the
    // rail's size changing at all. And once a slide has ended, measure the
    // settled box itself rather than trust the prediction.
    const watch = new ResizeObserver(place)
    watch.observe(rail)
    for (const el of rail.querySelectorAll(':scope > .thought, :scope > .bubble')) watch.observe(el)
    rail.addEventListener('transitionend', place)
    return () => {
      watch.disconnect()
      rail.removeEventListener('transitionend', place)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/**
 * Draws the tail from the bubble to the speaker's head.
 *
 * It used to be one of three fixed shapes, centred on the speaker and
 * stretched to fit. When the clamp had slid the bubble away from a speaker
 * near the edge, the stretched root landed in the bubble's rounded corner
 * or beside it, and the tail read as a separate sliver floating under the
 * bubble. Now its root is always on the flat of the bottom edge (inset by
 * the corner's radius) and its tip is on the speaker, so the tail can
 * only ever grow out of the bubble.
 *
 * Measured from the bubble's live layout box, not a prediction: while the
 * bubble slides to a new speaker (its `left` transition), the tail is
 * redrawn every frame, so the two move as one. The element's box is the
 * tail's own, centred on the tip, which is what a test measuring "does it
 * reach the speaker" wants. Written straight to the elements: drawing,
 * never state.
 */
function useTail(
  rail: { current: HTMLDivElement | null },
  speech: { current: HTMLDivElement | null },
  tail: { current: HTMLSpanElement | null },
  deps: unknown[],
) {
  useLayoutEffect(() => {
    const r = rail.current
    const b = speech.current
    const t = tail.current
    if (!r || !b || !t) return
    const fill = t.querySelector<SVGPathElement>('.tail-fill')
    const edge = t.querySelector<SVGPathElement>('.tail-edge')
    const place = () => {
      const x = Number(t.dataset.x)
      const drop = Number(t.dataset.drop ?? 0)
      if (!Number.isFinite(x)) return
      const shape = tailShape({
        at: (r.clientWidth * x) / 100,
        tip: r.offsetHeight - 4 + (drop * r.clientWidth) / 100,
        left: b.offsetLeft,
        right: b.offsetLeft + b.offsetWidth,
        bottom: b.offsetTop + b.offsetHeight,
        radius: parseFloat(getComputedStyle(b).borderBottomLeftRadius) || 20,
      })
      Object.assign(t.style, {
        left: `${shape.box.left}px`,
        top: `${shape.box.top}px`,
        width: `${shape.box.width}px`,
        height: `${shape.box.height}px`,
      })
      fill?.setAttribute('d', shape.fill)
      edge?.setAttribute('d', shape.edge)
    }
    place()
    // Follow a slide frame by frame, and settle on where it ends.
    let frame = 0
    const follow = () => {
      place()
      frame = requestAnimationFrame(follow)
    }
    const start = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(follow)
    }
    const stop = () => {
      cancelAnimationFrame(frame)
      place()
    }
    b.addEventListener('transitionrun', start)
    b.addEventListener('transitionend', stop)
    b.addEventListener('transitioncancel', stop)
    const watch = new ResizeObserver(place)
    watch.observe(r)
    watch.observe(b)
    return () => {
      cancelAnimationFrame(frame)
      b.removeEventListener('transitionrun', start)
      b.removeEventListener('transitionend', stop)
      b.removeEventListener('transitioncancel', stop)
      watch.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/**
 * Draws the thought's cloud around its value: a stadium just outside the
 * value's box, cut into even puffs, so a short value is a round little
 * cloud and a long one a long cloud with the same size of puff. It was a
 * ring of radial gradients at fixed percentages, which came out lumpy —
 * big and small puffs side by side, and uneven gaps — and the trail pointed
 * straight down whether or not the robot was there. Now the trail steps
 * towards the robot's head. Written straight to the SVG: drawing, never
 * state.
 */
function useCloud(ref: { current: HTMLDivElement | null }, deps: unknown[]) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const svg = el.querySelector('svg.thought-shape')
    if (!svg) return
    const place = () => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      svg.querySelector('path.cloud')?.setAttribute('d', cloudPath(w, h))
      // Towards the robot: its centre, relative to the cloud's. Centres,
      // so the pop's scale (from the cloud's foot) does not move them.
      const robot = el.closest('.stage')?.querySelector('[data-testid="actor-robot"]')
      const me = el.getBoundingClientRect()
      const them = robot?.getBoundingClientRect()
      const dx = them ? them.left + them.width / 2 - (me.left + me.width / 2) : 0
      const toward = Math.max(-w / 2, Math.min(w / 2, dx))
      const puffs = svg.querySelectorAll('circle')
      const trail = [
        { t: 0.18, r: 5.5 },
        { t: 0.55, r: 4 },
        { t: 0.88, r: 2.5 },
      ]
      trail.forEach(({ t, r }, i) => {
        const c = puffs[i]
        if (!c) return
        c.setAttribute('cx', (w / 2 + toward * (0.25 + t * 0.6)).toFixed(1))
        c.setAttribute('cy', (h + 6 + t * 26).toFixed(1))
        c.setAttribute('r', String(r))
      })
    }
    place()
    const watch = new ResizeObserver(place)
    watch.observe(el)
    const rail = el.parentElement
    if (rail) watch.observe(rail)
    return () => watch.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** How far apart the puffs are, around the cloud's edge. */
const PUFF_STEP = 19

/**
 * A cloud around a `w` × `h` box: points spaced evenly round a stadium a
 * little outside it, joined by outward arcs. Pure.
 */
export function cloudPath(w: number, h: number): string {
  const e = 3
  const W = w + 2 * e
  const H = h + 2 * e
  const rr = H / 2
  const flat = Math.max(0, W - H)
  const perimeter = 2 * flat + 2 * Math.PI * rr
  const k = Math.max(7, Math.round(perimeter / PUFF_STEP))
  const step = perimeter / k
  const x0 = -e
  const y0 = -e
  // Clockwise from the top-left end of the top edge.
  const at = (s: number): [number, number] => {
    s = ((s % perimeter) + perimeter) % perimeter
    if (s < flat) return [x0 + rr + s, y0]
    s -= flat
    const arc = Math.PI * rr
    if (s < arc) {
      const a = -Math.PI / 2 + s / rr
      return [x0 + rr + flat + rr * Math.cos(a), y0 + rr + rr * Math.sin(a)]
    }
    s -= arc
    if (s < flat) return [x0 + rr + flat - s, y0 + H]
    s -= flat
    const a = Math.PI / 2 + s / rr
    return [x0 + rr + rr * Math.cos(a), y0 + rr + rr * Math.sin(a)]
  }
  // A puff centred on the middle of the top edge, so the cloud is symmetric.
  const start = flat / 2 + step / 2
  const f = (n: number) => n.toFixed(1)
  const pts = Array.from({ length: k }, (_, i) => at(start + i * step))
  const bulge = step * 0.62
  let d = `M ${f(pts[0]![0])} ${f(pts[0]![1])}`
  for (let i = 1; i <= k; i++) {
    const [x, y] = pts[i % k]!
    d += ` A ${f(bulge)} ${f(bulge)} 0 0 1 ${f(x)} ${f(y)}`
  }
  return `${d} Z`
}

/** Half the width of the tail where it leaves the bubble. */
const TAIL_ROOT = 13

/**
 * The tail's outline, in pixels of the rail: from a root on the flat of
 * the bubble's bottom edge to a rounded tip at `at, tip`. `fill` is closed;
 * `edge` is the two sides only, since the root is inside the bubble's
 * border. The root sits 3px above the bottom so its fill covers the
 * border and the lip under it. Pure.
 */
export function tailShape(g: { at: number; tip: number; left: number; right: number; bottom: number; radius: number }) {
  const h = TAIL_ROOT
  const inset = g.radius + h + 2
  const cx = g.right - g.left < 2 * inset ? (g.left + g.right) / 2 : Math.max(g.left + inset, Math.min(g.right - inset, g.at))
  const top = g.bottom - 3
  const len = Math.max(8, g.tip - top)
  const half = Math.max(Math.abs(cx - h - g.at), Math.abs(cx + h - g.at)) + 2
  const ox = g.at - half
  // Local coordinates: the box's top left is (ox, top).
  const L = cx - h - ox
  const R = cx + h - ox
  const T = half
  const f = (n: number) => n.toFixed(1)
  // Gently pinched sides, meeting in a small round tip.
  const sides =
    `M ${f(L)} 0 Q ${f(L + (T - L) * 0.5)} ${f(len * 0.45)} ${f(T - 1.4)} ${f(len - 1.2)} ` +
    `Q ${f(T)} ${f(len + 0.8)} ${f(T + 1.4)} ${f(len - 1.2)} ` +
    `Q ${f(R + (T - R) * 0.5)} ${f(len * 0.45)} ${f(R)} 0`
  return { fill: `${sides} Z`, edge: sides, box: { left: ox, top, width: 2 * half, height: len } }
}

/**
 * The speech's layout box where it is going, not where it is.
 *
 * This was the clash `useBeside` kept finding that the settled layout
 * does not have. A change of speaker slides the bubble across (its `left`
 * is a 250ms transition), and the offsets are read in the same frame the
 * slide starts — so after Mira's ask and the crow's praise of `7 * 6`,
 * the box measured was still over by Mira and the robot, the cloud was
 * called in the way, and it stayed stacked a whole bubble (173px) above
 * the robot. Widening the lean could not help: the numbers were from the
 * wrong place. The transition knows where it ends, so the box is moved
 * there; `transitionend` re-measures in case it was cut short.
 */
function settled(el: HTMLElement) {
  const b = box(el)
  const slide =
    typeof el.getAnimations === 'function'
      ? el
          .getAnimations()
          .find((a): a is CSSTransition => a instanceof CSSTransition && a.transitionProperty === 'left')
      : undefined
  const frames = slide?.effect instanceof KeyframeEffect ? slide.effect.getKeyframes() : []
  const now = parseFloat(getComputedStyle(el).left)
  // A keyframe holds the computed value, which for a percentage `left`
  // is still a percentage — of the rail's width, the bubble being
  // relatively positioned in it.
  const to = String(frames[frames.length - 1]?.['left'] ?? '').trim()
  // A percentage, pixels, or `calc(a% ± bpx)` once the speech has been
  // stepped aside (`--push`).
  const width = el.parentElement?.clientWidth ?? 0
  const mixed = /^calc\((-?[\d.]+)%\s*([+-])\s*([\d.]+)px\)$/.exec(to)
  const end = /^-?[\d.]+%$/.test(to)
    ? (parseFloat(to) / 100) * width
    : /^-?[\d.]+px$/.test(to)
      ? parseFloat(to)
      : mixed
        ? (parseFloat(mixed[1]!) / 100) * width + (mixed[2] === '-' ? -1 : 1) * parseFloat(mixed[3]!)
        : NaN
  if (!Number.isFinite(now) || !Number.isFinite(end)) return b
  const dx = end - now
  return { left: b.left + dx, right: b.right + dx, top: b.top }
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

/**
 * Where a narrow stage's picture may start: under whatever hangs along the
 * top of the stage — the beat bar or the practice meter, and scenery that
 * does not stand on the floor, like the order counter's ticket board.
 *
 * On a narrow stage the picture cannot stand on the floor between the
 * cast (32% of a phone's stage is a 116px thumbnail), so it stands at the
 * top, as wide as the stage allows, over the room where the speech is
 * (`styles.css`, "the picture on a narrow stage"). What it must clear up
 * there depends on the scene and on how a board's words laid out, which
 * only layout knows, so it is measured and written to the stage as
 * `--props-top` — drawing, like `useBeside`, and the scene still holds no
 * state. Unmeasured, the stylesheet's default applies.
 */
function usePropsTop(ref: { current: HTMLDivElement | null }, deps: unknown[]) {
  useLayoutEffect(() => {
    const stage = ref.current
    if (!stage) return
    const place = () => {
      const h = stage.clientHeight
      let top = 0
      for (const el of stage.querySelectorAll<HTMLElement>(
        ':scope > .beat-bar, :scope > .practice-meter, :scope > .actor:not(.standing)',
      )) {
        const r = el.getBoundingClientRect()
        const s = stage.getBoundingClientRect()
        // Only what hangs in the top third: a board lower down is beside
        // the cast, not over the picture's room.
        if (r.height === 0 || r.top - s.top > h / 3) continue
        top = Math.max(top, r.bottom - s.top)
      }
      stage.style.setProperty('--props-top', `${Math.ceil(top) + 10}px`)
    }
    place()
    const watch = new ResizeObserver(place)
    watch.observe(stage)
    return () => watch.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/**
 * Stands a picture that is read row by row (a goal memory) at the top of
 * a wide stage, as large as the room above the speech allows.
 *
 * On the floor between the cast it is the scene's props slot, a third of
 * the stage: a goal of a list and two names came out in 7-pixel type. The
 * top of a wide stage is empty above the bubbles, so the picture goes
 * there — as a narrow stage already puts every picture — at up to 90% of
 * the width, and only as tall as leaves the speech and the thought their
 * room above the cast. Measured, since
 * how tall the speech came out only layout knows, and written to the
 * stage as `--raised-w` and `data-raised`: drawing, never state. Too little
 * room to be much larger, and it stays on the floor.
 */
function useRaised(ref: { current: HTMLDivElement | null }, raise: boolean, slotPct: number, deps: unknown[]) {
  useLayoutEffect(() => {
    const stage = ref.current
    if (!stage) return
    const clear = () => {
      delete stage.dataset.raised
      stage.style.removeProperty('--raised-w')
    }
    if (!raise) {
      clear()
      return
    }
    const place = () => {
      const W = stage.clientWidth
      const H = stage.clientHeight
      // A narrow stage already stands every picture at the top.
      if (W <= 480) return clear()
      const top = parseFloat(getComputedStyle(stage).getPropertyValue('--props-top')) || 30
      const rail = stage.querySelector<HTMLElement>(':scope > .bubble-rail')
      // The speech band: where the rail stands, or near the floor.
      const band = rail ? rail.offsetTop + rail.offsetHeight - 14 : H * 0.6
      const speech = rail?.querySelector<HTMLElement>(':scope > .bubble')?.offsetHeight ?? 110
      const cloud = rail?.querySelector<HTMLElement>(':scope > .thought')
      const thinking = cloud ? cloud.offsetHeight + 42 : 0
      // A goal draws no answer under itself, so it needs only its own
      // 200 × 130 and not the answer's band; its question is the crow's
      // (the caption under it is dropped, `console.css`). What is left for
      // it is the room over the speech, less a little air.
      const room = band - top - 16 - (speech + 30) - thinking
      const w = Math.min(W * 0.9, 720, (room * 200) / 130)
      if (w < (W * slotPct) / 100 * 1.15) return clear()
      stage.dataset.raised = 'yes'
      stage.style.setProperty('--raised-w', `${Math.floor(w)}px`)
    }
    place()
    // Again once this frame's layout has settled, and whenever what the
    // rail holds changes: the robot's cloud going away on the ask gives
    // the picture room without resizing anything a size observer watches.
    const frame = requestAnimationFrame(place)
    const watch = new ResizeObserver(place)
    watch.observe(stage)
    const rail = stage.querySelector(':scope > .bubble-rail')
    if (rail) for (const el of rail.children) watch.observe(el)
    const changes = new MutationObserver(place)
    changes.observe(stage, { childList: true })
    if (rail) changes.observe(rail, { childList: true })
    return () => {
      cancelAnimationFrame(frame)
      watch.disconnect()
      changes.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raise, slotPct, ...deps])
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
        const chars = [...String(child)]
        return chars.map((ch, i) => {
          const d = t
          // No breath inside a number: `2.8` is one thing, and a pause at
          // its dot had the verdict read "sends you back to 2." a moment.
          const inNumber = /\d/.test(chars[i + 1] ?? '') && /\d/.test(chars[i - 1] ?? '')
          t += (inNumber ? undefined : PAUSE_MS[ch]) ?? CHAR_MS
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

/**
 * A scene's landscape, rearmost on the stage. Each layer stands on the
 * floor line (`--floor-at`) and is sized by the stage's width (`cqw`),
 * so the horizon stays where the cast stands at any stage shape; the sky
 * is the layer's own background and simply fills whatever is above.
 *
 * Kept pale and low in contrast where the speech, the robot's cloud and a
 * raised goal stand (the top half), and a little richer near the ground,
 * so nothing in front of it is ever harder to read. The clouds drift very
 * slowly, and not at all under reduced motion (`styles.css`).
 *
 * The trail meets the cave at a point fixed in stage width: the rock face
 * is `ROCK_W` wide at the right edge and its mouth sits `MOUTH` of the way
 * across it, so the ground, drawn in percent of the width, can aim there.
 * That puts the mouth about 77% across, in the gap a scene leaves between
 * the robot and a third character at the far end, rather than behind one.
 */
const ROCK_W = 26
const MOUTH = 0.12

export function Backdrop({ kind }: { kind: 'trailhead' | 'cave' }) {
  const meet = 100 - ROCK_W * (1 - MOUTH)
  return (
    <div className="backdrop" data-backdrop={kind} data-testid="backdrop" aria-hidden="true">
      <svg className="bd-clouds" viewBox="0 0 1000 200" preserveAspectRatio="xMidYMin slice">
        <g className="bd-cloud" style={{ ['--d' as string]: '0s' }}>
          <ellipse cx="170" cy="62" rx="70" ry="16" />
          <ellipse cx="210" cy="52" rx="44" ry="16" />
        </g>
        <g className="bd-cloud" style={{ ['--d' as string]: '-40s' }}>
          <ellipse cx="640" cy="40" rx="86" ry="15" />
          <ellipse cx="600" cy="32" rx="46" ry="14" />
        </g>
        <g className="bd-cloud" style={{ ['--d' as string]: '-90s' }}>
          <ellipse cx="880" cy="96" rx="58" ry="12" />
        </g>
      </svg>
      <svg className="bd-far" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice">
        <path
          className="bd-far-1"
          d="M0 300 L0 190 L90 120 L150 160 L250 60 L330 140 L400 110 L500 30 L590 130 L660 90 L760 170 L840 80 L930 150 L1000 120 L1000 300 Z"
        />
        <path className="bd-snow" d="M250 60 L272 82 L258 80 L246 90 L232 78 Z M500 30 L526 58 L510 54 L498 66 L482 52 Z M840 80 L860 100 L846 98 L834 108 L822 96 Z" />
        <path
          className="bd-far-2"
          d="M0 300 L0 230 L120 180 L210 215 L330 160 L450 210 L560 170 L690 220 L800 175 L910 215 L1000 190 L1000 300 Z"
        />
      </svg>
      <svg className="bd-near" viewBox="0 0 1000 120" preserveAspectRatio="xMidYMax slice">
        <path className="bd-hill" d="M0 120 L0 70 C120 40 220 60 330 74 C460 92 560 40 700 52 C820 62 900 86 1000 70 L1000 120 Z" />
      </svg>
      <svg className="bd-pines" viewBox="0 0 120 110" preserveAspectRatio="xMinYMax meet">
        <Pine x={22} h={78} />
        <Pine x={52} h={100} />
        <Pine x={84} h={66} />
      </svg>
      <svg className="bd-rock" viewBox="0 0 300 230" preserveAspectRatio="xMaxYMax meet">
        <path className="bd-rock-face" d="M0 230 L2 176 L20 128 L58 100 L96 104 L132 66 L188 52 L232 26 L300 34 L300 230 Z" />
        <path className="bd-rock-shade" d="M232 26 L300 34 L300 230 L246 230 L238 120 Z" />
        <path className="bd-rock-ledge" d="M120 112 L170 98 L214 106" />
        {/* The mouth, centred at MOUTH across the face. */}
        <path className="bd-cave" d="M11 230 L12 186 C15 152 26 132 36 132 C46 132 57 152 60 186 L61 230 Z" />
        <path className="bd-cave-rim" d="M12 186 C15 152 26 132 36 132 C46 132 57 152 60 186" />
        <Pine x={118} h={62} y={230} />
        <Pine x={278} h={54} y={230} />
      </svg>
      <svg className="bd-ground" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="0" y="0" width="100" height="100" className="bd-ground-fill" />
        <path className="bd-trail" d={`M22 100 C34 70 ${meet - 22} 30 ${meet - 1.6} 0 L${meet + 1.6} 0 C${meet - 12} 34 48 72 46 100 Z`} />
        <path className="bd-grass" d="M4 34 h7 M14 60 h9 M70 52 h8 M82 80 h10 M60 22 h6" />
      </svg>
    </div>
  )
}

function Pine({ x, h, y = 110 }: { x: number; h: number; y?: number }) {
  const w = h * 0.42
  return (
    <g className="bd-pine">
      <rect x={x - 2} y={y - h * 0.16} width="4" height={h * 0.16} className="bd-trunk" />
      <path d={`M${x} ${y - h} L${x + w * 0.62} ${y - h * 0.52} L${x + w * 0.36} ${y - h * 0.52} L${x + w} ${y - h * 0.14} L${x - w} ${y - h * 0.14} L${x - w * 0.36} ${y - h * 0.52} L${x - w * 0.62} ${y - h * 0.52} Z`} />
    </g>
  )
}
