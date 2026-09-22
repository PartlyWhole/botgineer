/**
 * (A) The scene panel: the situation, drawn from memory.
 *
 * Every actor's appearance is derived from the current snapshot through
 * the scene's declared watches. The scene holds no state of its own and
 * takes no commands, so it cannot show something the program did not do —
 * and scrubbing the trace rewinds the picture for free.
 */
import { useLayoutEffect, useRef } from 'react'
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

export function ScenePanel({
  spec,
  snapshot,
  moods,
  guide,
  onAdvance,
  triumph,
  thought,
  thinking,
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
  guide?: { text: string; speaker?: string | undefined } | undefined
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
  // reliably announce one that has only just appeared.
  const speechRef = useRef<HTMLDivElement | null>(null)
  const tailRef = useRef<HTMLSpanElement | null>(null)
  const thoughtRef = useRef<HTMLDivElement | null>(null)
  usePop(speechRef, guideShown ? guide.text : null, BUBBLE_POP)
  usePop(tailRef, guideShown ? guide.text : null, TAIL_FADE)
  usePop(thoughtRef, thoughtShown ? (thinking ? '\u2026' : (thought ?? '')) : null, THOUGHT_POP)

  return (
    <div className="scene-panel" data-testid="scene">
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

        {/* The way on. It used to live inside the guide's bubble, which
            meant the two activities with no guide — the editor ones — had
            no way to offer it at all. It belongs to the level. */}
        {onAdvance && done && (
          <button type="button" className="advance" onClick={onAdvance} data-testid="advance">
            Next
          </button>
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
            talk={guideShown && speaker.actor.id === a.actor.id ? guide.text : undefined}
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
                className="bubble"
                data-testid="guide"
                data-speaker={speaker.actor.id}
                // Kept inside the stage: a character near an edge would
                // otherwise push half the sentence out of the panel, and
                // the guide is the one thing that has to be readable. The
                // body moves; the tail does not, so the clamp cannot make
                // the bubble point at the wrong character.
                style={{ left: `${bubbleX(speaker.actor.x) - 50}%` }}
                aria-live="polite"
              >
                {richText(guide.text)}
              </div>
            )}
            {guideShown && (
              // The band sits at the tallest actor's head, so a shorter
              // speaker is some way below it. The tail reaches down that
              // far (`--drop`, in the same width units as the band), or
              // the bubble would point at the air above the crow.
              <span
                ref={tailRef}
                className="bubble-tail"
                aria-hidden="true"
                style={{
                  left: `${speaker.actor.x}%`,
                  ['--drop' as string]: `${speechDrop(speaker.actor, spec.floor, lift)}%`,
                }}
              >
                <svg viewBox="0 0 16 10" preserveAspectRatio="none">
                  <polygon points="0,0 16,0 8,10" />
                  <polyline points="0,0 8,10 16,0" />
                </svg>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Only when the scene is actually waiting for something. With the
          description gone there is otherwise nothing to put here, and an
          empty bar is worse than no bar. */}
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

const box = (el: HTMLElement) => ({
  left: el.offsetLeft,
  right: el.offsetLeft + el.offsetWidth,
  top: el.offsetTop,
})

type Pop = { frames: Keyframe[]; calm: Keyframe[]; options: KeyframeAnimationOptions }

/** Ease-out on the way in, scaled from the foot so the box only ever
 *  grows into the one it settles at — it never covers what the settled
 *  bubble would not. */
const BUBBLE_POP: Pop = {
  frames: [
    { opacity: 0, transform: 'scale(0.86)' },
    { opacity: 1, transform: 'none' },
  ],
  calm: [{ opacity: 0 }, { opacity: 1 }],
  options: { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
}

const TAIL_FADE: Pop = {
  frames: [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }],
  calm: [{ opacity: 0 }, { opacity: 1 }],
  options: { duration: 220, easing: 'ease-out' },
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
  return lifts.length > 0 ? Math.max(...lifts) : 0
}

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
}: {
  view: ActorView
  /** Where it comes in the cast, for the step-in on arrival. */
  order: number
  mood: Mood
  /** What it is saying, while it is its turn. */
  talk?: string | undefined
  floor: Floor | undefined
  /** The scene as a whole is satisfied — the only thing that earns a
   *  celebration. Per-actor `lit` is not enough: one lamp on out of
   *  three watches is a third of the way there. */
  pleased: boolean
}) {
  const { actor } = view
  const standing = actor.stand === true && floor !== undefined
  // Only the cast has a face to celebrate with.
  const cast = actor.kind === 'robot' || actor.kind === 'crow' || actor.kind === 'courier'

  return (
    <div
      className={`actor ${actor.kind} ${standing ? 'standing' : ''} ${view.lit ? 'lit' : ''} ${view.picked ? 'picked' : ''} ${cast && pleased ? 'cheer' : ''}`}
      style={{
        ...placement(actor, floor),
        ...(cast ? idleTiming(actor.id) : {}),
        ['--order' as string]: String(order),
      }}
      data-stand={standing ? 'yes' : 'no'}
      data-testid={`actor-${actor.id}`}
      data-lit={view.lit ? 'yes' : 'no'}
      data-picked={view.picked ? 'yes' : 'no'}
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
