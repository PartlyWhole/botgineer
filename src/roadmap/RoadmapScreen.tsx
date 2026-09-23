/**
 * The roadmap: every level on one winding path, grouped into units.
 *
 * Where the game starts. A level is a round button on the path; what state
 * it is in — done, the one to play next, or locked — comes from
 * `progress.levelStates`, never from anything this screen keeps. The only
 * state here is which card is open, which is a matter of the screen and
 * not of the game.
 *
 * The cast stands beside the path, one character per unit, idling exactly
 * as they do in a level: it is the same SVG and the same CSS, so the map
 * and the levels are visibly one world.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LEVEL_ORDER, ROADMAP, levelActivity, type Unit } from '../../content/roadmap'
import { levelStates, unitDone, useProgress, type LevelState } from '../progress/progress'
import { arrivedFrom, goTo } from '../app/router'
import { Robot, Courier } from '../ui/Characters'
import { Crow } from '../ui/Crow'
import { idleTiming } from '../panels/ScenePanel'
import { mascotAt, stops, stretchHeight, trail } from './layout'
import { LEVEL_NAMES, level, levelIndex, useMastery, type Mastery } from '../mastery/mastery'
import { conceptsOfUnit, skillsOfUnit } from '../../content/concepts'
import { reviewOwed } from '../collection/levels'
import { ProgressControls } from './ProgressControls'

/**
 * A unit's stops as the map draws them: its levels, and — while a failed
 * checkpoint is sending you back — the review, just before the checkpoint.
 * The review is not a level of the path; it is owed, and derived from
 * mastery, so it appears and goes away on its own (see `collection/levels`).
 */
export function stopsOf(unit: Unit, states: Map<string, LevelState>, done: ReadonlySet<string>, m: Mastery) {
  const checkpoint = unit.stage ? `s${unit.stage}-checkpoint` : null
  const owed = checkpoint !== null && unit.levels.includes(checkpoint) && reviewOwed(unit.stage!, m, done.has(checkpoint))
  if (!owed) return { levels: unit.levels, states }
  const at = unit.levels.indexOf(checkpoint!)
  const review = `s${unit.stage}-review`
  const levels = [...unit.levels.slice(0, at), review, ...unit.levels.slice(at)]
  const next = new Map(states)
  next.set(review, 'current')
  // The checkpoint waits for its review: the ladder assumes every rung holds.
  if (next.get(checkpoint!) === 'current') next.set(checkpoint!, 'locked')
  return { levels, states: next }
}

export function RoadmapScreen() {
  const done = useProgress()
  const mastery = useMastery()
  const linear = levelStates(LEVEL_ORDER, done)
  // Reviews owed, folded in: each one becomes current, and its checkpoint
  // waits for it.
  const states = new Map(linear)
  const stretches = ROADMAP.map((u) => {
    const s = stopsOf(u, linear, done, mastery)
    // Only this unit's own stops: another unit's view of the whole map
    // would put back what this one changed.
    for (const id of s.levels) states.set(id, s.states.get(id) ?? 'locked')
    return s.levels
  })
  const [open, setOpen] = useState<string | null>(null)
  const currentRef = useRef<HTMLButtonElement | null>(null)
  const finished = LEVEL_ORDER.filter((id) => done.has(id)).length
  // Arriving by finishing a level: that level pops, the one it unlocked
  // bounces, and a trophy it completed lifts. Only if it really is done —
  // an arrival never celebrates something progress does not agree with.
  const from = arrivedFrom()
  const arrived = from !== null && done.has(from) ? from : null
  // Where to open the map: the level to play next, or, with nothing left,
  // the one just finished.
  const order = stretches.flat()
  const focus = order.find((id) => states.get(id) === 'current') ?? arrived

  // Arrive looking at the level to play next, the way the path is always
  // opened at where you are rather than at the top. The map scrolls
  // itself, not the page: `scrollIntoView` scrolls every ancestor that can
  // scroll, the document included, and carried the top bar off the screen.
  const mapRef = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const map = mapRef.current
    const node = currentRef.current
    if (!map || !node) return
    const offset = node.getBoundingClientRect().top - map.getBoundingClientRect().top
    // Instant: arriving is not an animation, and a smooth scroll from the
    // top every time the map opened read as the page sliding away.
    map.scrollTo({
      top: Math.max(0, map.scrollTop + offset - map.clientHeight / 2 + node.offsetHeight / 2),
      behavior: 'instant',
    })
  }, [])

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (!t?.closest('.map-card, .map-node')) setOpen(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const nextId = order.find((id) => states.get(id) === 'current') ?? null
  const nextUnit = nextId ? ROADMAP.find((u) => u.levels.includes(nextId)) : undefined

  return (
    <main className="map" data-testid="map" ref={mapRef}>
      <div className="map-layout">
        <div className="map-column">
          <p className="map-tally" data-testid="map-tally">
            <span className="map-tally-count">{finished}</span> of {LEVEL_ORDER.length} levels done
          </p>

          {ROADMAP.map((unit, u) => (
            <UnitStretch
              key={unit.id}
              unit={unit}
              levels={stretches[u]!}
              index={u}
              states={states}
              complete={unitDone(unit.levels, done)}
              open={open}
              onOpen={setOpen}
              currentRef={currentRef}
              focus={focus}
              arrived={arrived}
            />
          ))}

          <div className="map-end" data-testid="map-end">
            <Signpost />
            <p className="map-end-title">More levels on the way</p>
            <p className="map-end-note">The robot is still learning. So are we.</p>
            <ProgressControls />
          </div>
        </div>

        <aside className="map-side" aria-label="Up next">
          <div className="map-next" data-theme={nextUnit?.theme ?? 'sun'}>
            {nextId ? (
              <>
                <p className="map-next-kicker">
                  {LEVEL_ORDER.includes(nextId) ? `Up next · Level ${LEVEL_ORDER.indexOf(nextId) + 1}` : 'Up next · Review'}
                </p>
                <h3>{levelActivity(nextId).title}</h3>
                <p className="map-next-brief">{levelActivity(nextId).brief}</p>
                <button
                  type="button"
                  className="map-next-go"
                  data-testid="map-continue"
                  onClick={() => goTo(nextId)}
                >
                  {finished === 0 ? 'Start' : 'Continue'}
                </button>
              </>
            ) : (
              <>
                <p className="map-next-kicker">All done</p>
                <h3>Every level, finished</h3>
                <p className="map-next-brief">Replay any of them from the path. More are on the way.</p>
              </>
            )}
            <div className="map-bar">
              <p className="map-bar-label">
                <span>Your progress</span>
                <span>
                  {finished}/{LEVEL_ORDER.length}
                </span>
              </p>
              <div
                className="map-bar-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={LEVEL_ORDER.length}
                aria-valuenow={finished}
                aria-label="Levels done"
              >
                <div
                  className="map-bar-fill"
                  style={{ width: `${(finished / LEVEL_ORDER.length) * 100}%` }}
                />
              </div>
            </div>
            <ProgressControls compact />
          </div>
        </aside>
      </div>
    </main>
  )
}

function UnitStretch({
  unit,
  levels,
  index,
  states,
  complete,
  open,
  onOpen,
  currentRef,
  focus,
  arrived,
}: {
  unit: Unit
  levels: string[]
  index: number
  states: Map<string, LevelState>
  complete: boolean
  open: string | null
  onOpen: (id: string | null) => void
  currentRef: React.MutableRefObject<HTMLButtonElement | null>
  focus: string | null
  arrived: string | null
}) {
  // The levels, then the trophy.
  const count = levels.length + 1
  const at = stops(count, index)
  const mascot = mascotAt(count, index)
  const height = stretchHeight(count)
  const here = unit.levels.some((id) => states.get(id) === 'current')
  const finished = unit.levels.filter((id) => states.get(id) === 'done').length

  return (
    <section className="map-unit" data-theme={unit.theme} data-testid={`unit-${unit.id}`}>
      <header className="map-banner">
        <div className="map-banner-text">
          <p className="map-banner-kicker">Unit {index + 1}</p>
          <h2>{unit.title}</h2>
          <p className="map-banner-blurb">{unit.blurb}</p>
        </div>
        <p className="map-banner-count" aria-label={`${finished} of ${unit.levels.length} levels done`}>
          {complete ? <TrophyIcon /> : null}
          {finished}/{unit.levels.length}
        </p>
      </header>

      <div className="map-stretch" style={{ height }}>
        <svg
          className="map-trail"
          aria-hidden="true"
          viewBox={`-200 0 400 ${height}`}
          preserveAspectRatio="xMidYMin meet"
          style={{ height }}
        >
          <path d={trail(at)} />
        </svg>

        <div
          className={`map-mascot mascot-${unit.mascot}`}
          style={{
            ['--x' as string]: `${mascot.x}px`,
            top: mascot.y,
            ...idleTiming(`map-${unit.id}`),
          }}
          aria-hidden="true"
        >
          {unit.mascot === 'crow' && <Crow mood={complete ? 'pleased' : here ? 'attentive' : 'idle'} />}
          {unit.mascot === 'robot' && <Robot mood={complete ? 'pleased' : here ? 'attentive' : 'idle'} />}
          {unit.mascot === 'courier' && <Courier mood={complete ? 'pleased' : here ? 'attentive' : 'idle'} />}
        </div>

        {levels.map((id, i) => {
          const state = states.get(id) ?? 'locked'
          const stop = at[i]!
          return (
            <LevelNode
              key={id}
              id={id}
              number={LEVEL_ORDER.indexOf(id) + 1}
              waiting={id === `s${unit.stage}-checkpoint` && levels.includes(`s${unit.stage}-review`)}
              state={state}
              x={stop.x}
              y={stop.y}
              order={i}
              open={open === id}
              onToggle={() => onOpen(open === id ? null : id)}
              nodeRef={id === focus ? currentRef : undefined}
              cheer={id === arrived ? 'done' : arrived !== null && state === 'current' ? 'unlocked' : null}
            />
          )
        })}

        <div
          className={`map-trophy ${complete ? 'earned' : ''} ${complete && arrived !== null && unit.levels.includes(arrived) ? 'just-earned' : ''}`}
          style={{
            ['--x' as string]: `${at[count - 1]!.x}px`,
            top: at[count - 1]!.y,
            ['--order' as string]: count - 1,
          }}
          data-testid={`trophy-${unit.id}`}
          role="img"
          aria-label={complete ? `${unit.title}: complete` : `${unit.title}: trophy not earned yet`}
        >
          <TrophyIcon />
        </div>
      </div>
    </section>
  )
}

function LevelNode({
  id,
  number,
  waiting,
  state,
  x,
  y,
  order,
  open,
  onToggle,
  nodeRef,
  cheer,
}: {
  id: string
  /** 0 for a stop that is not a level of the path: a review. */
  number: number
  /** A checkpoint whose review comes first. */
  waiting?: boolean
  state: LevelState
  x: number
  y: number
  order: number
  open: boolean
  onToggle: () => void
  nodeRef?: React.MutableRefObject<HTMLButtonElement | null> | undefined
  /** How you arrived: this is the level just finished, or the one that
   *  finishing it unlocked. */
  cheer: 'done' | 'unlocked' | null
}) {
  const activity = levelActivity(id)
  const read = activity.read?.kind
  const build = activity.mode === 'editor'
  const drill = activity.practice !== undefined || read === 'practice'
  const review = read === 'review'
  const kind = review
    ? 'Review'
    : read === 'ideas'
      ? 'Ideas'
      : read === 'set'
        ? 'Exercises'
        : read === 'checkpoint'
          ? 'Checkpoint'
          : read === 'capstone'
            ? 'Capstone'
            : drill
              ? 'Practice'
              : build
                ? 'Build'
                : 'Lesson'
  const label =
    state === 'done'
      ? 'done'
      : state === 'current'
        ? 'up next'
        : state === 'unlocked'
          ? 'open to play'
          : waiting
          ? 'waiting — do the review first'
          : 'locked — finish the levels before it first'
  const face =
    state === 'locked' ? (
      <LockIcon />
    ) : state === 'done' ? (
      <CheckIcon />
    ) : review ? (
      <ReviewIcon />
    ) : read === 'ideas' ? (
      <BookIcon />
    ) : read === 'set' ? (
      <PencilIcon />
    ) : read === 'checkpoint' ? (
      <FlagIcon />
    ) : read === 'capstone' ? (
      <StarIcon />
    ) : drill ? (
      <DumbbellIcon />
    ) : build ? (
      <CodeIcon />
    ) : (
      <StarIcon />
    )

  return (
    <div
      className={`map-stop ${state} ${review ? 'review' : ''} ${open ? 'open' : ''} ${cheer ? `just-${cheer}` : ''}`}
      data-cheer={cheer ?? undefined}
      style={{
        ['--x' as string]: `${x}px`,
        top: y,
        ['--order' as string]: order,
      }}
    >
      {state === 'current' && !open && (
        <span className="map-start" aria-hidden="true">
          Start
        </span>
      )}
      <button
        ref={nodeRef}
        type="button"
        className="map-node"
        data-testid={`level-${id}`}
        data-state={state}
        aria-expanded={open}
        aria-label={`${number > 0 ? `Level ${number}` : kind}: ${activity.title}, ${label}`}
        onClick={onToggle}
      >
        {state === 'current' && <span className="map-ring" aria-hidden="true" />}
        {cheer === 'done' && (
          <span className="map-burst" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={{ ['--a' as string]: `${i * 45}deg` }} />
            ))}
          </span>
        )}
        <span className="map-node-face">{face}</span>
      </button>

      {open && (
        <div className="map-card" role="dialog" aria-label={activity.title} data-testid="map-card">
          <p className="map-card-kicker">
            {number > 0 ? `Level ${number} · ` : ''}
            {kind}
          </p>
          <h3>{activity.title}</h3>
          <p className="map-card-brief">{activity.brief}</p>
          {drill && <SkillChips unit={activity.practice?.unit ?? `stage-${activity.read!.stage}`} />}
          {state === 'locked' ? (
            <p className="map-card-locked">
              {waiting ? 'The review comes first: the checkpoint opens again once it is done.' : 'Finish the levels before this one to unlock it.'}
            </p>
          ) : (
            <button type="button" className="map-card-go" data-testid="map-go" onClick={() => goTo(id)}>
              {state === 'done' ? 'Play again' : 'Start'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** The unit's skills and how well each is known, on a practice level's
 *  card: the reason to practise is on the card that offers it. */
function SkillChips({ unit }: { unit: string }) {
  const mastery = useMastery()
  const now = Date.now()
  return (
    <ul className="map-card-skills" data-testid="map-card-skills">
      {(skillsOfUnit(unit).length ? skillsOfUnit(unit) : conceptsOfUnit(unit)).map((s) => {
        const l = level(mastery[s.id], now)
        return (
          <li key={s.id} data-level={l} title={`${s.title}: ${LEVEL_NAMES[l]}`}>
            <span className="chip-dots" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <i key={n} className={levelIndex(l) >= n ? 'on' : ''} />
              ))}
            </span>
            {s.title}
            <span className="sr-only">: {LEVEL_NAMES[l]}</span>
          </li>
        )
      })}
    </ul>
  )
}

/* -------------------------------- icons -------------------------------- */

const BookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 4.5h6a2 2 0 0 1 2 2V20a1.5 1.5 0 0 0-1.5-1.5H4zM20 4.5h-6a2 2 0 0 0-2 2V20a1.5 1.5 0 0 1 1.5-1.5H20z" />
  </svg>
)

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15.2 4.3l4.5 4.5L9 19.5l-5.3.8.8-5.3z" />
  </svg>
)

const FlagIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 21V4M6 4.5h11l-2.5 4 2.5 4H6" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ReviewIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12a7 7 0 1 0 2.1-5M5 4v4.5h4.5" fill="none" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const DumbbellIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="1.5" y="8.5" width="3" height="7" rx="1.2" />
    <rect x="4.5" y="6" width="3.6" height="12" rx="1.4" />
    <rect x="15.9" y="6" width="3.6" height="12" rx="1.4" />
    <rect x="19.5" y="8.5" width="3" height="7" rx="1.2" />
    <rect x="8" y="10.6" width="8" height="2.8" rx="1" />
  </svg>
)

const StarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.9l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9z" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M5 12.5l4.5 4.5L19 7.5"
      fill="none"
      strokeWidth="3.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const LockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="10.5" width="14" height="10" rx="2.6" />
    <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
)

const CodeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5"
      fill="none"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const TrophyIcon = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path
      className="cup-handles"
      d="M13 12H7.5a1.5 1.5 0 0 0-1.5 1.7C6.8 20 10 23.5 15 24.5M35 12h5.5a1.5 1.5 0 0 1 1.5 1.7C41.2 20 38 23.5 33 24.5"
      fill="none"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    <path className="cup" d="M13 8h22v9c0 7.2-4.6 12.6-11 12.6S13 24.2 13 17z" />
    <rect className="cup-stem" x="21" y="29" width="6" height="6" rx="1" />
    <rect className="cup-base" x="14.5" y="35" width="19" height="6" rx="2.4" />
    <path
      className="cup-shine"
      d="M18 11.5v5.5c0 2.8 1 5.2 2.6 6.8"
      fill="none"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
  </svg>
)

const Signpost = () => (
  <svg viewBox="0 0 96 96" className="map-sign" aria-hidden="true">
    <ellipse cx="48" cy="90" rx="26" ry="4.5" className="ground" />
    <rect x="44" y="26" width="8" height="64" rx="3" className="post" />
    <path d="M16 18h52l12 10-12 10H16a3 3 0 0 1-3-3V21a3 3 0 0 1 3-3z" className="board" />
    <path d="M24 28h36" className="board-line" strokeWidth="4" strokeLinecap="round" strokeDasharray="7 6" />
    <path d="M80 50H30l-10 8 10 8h50a3 3 0 0 0 3-3V53a3 3 0 0 0-3-3z" className="board board-low" />
  </svg>
)
