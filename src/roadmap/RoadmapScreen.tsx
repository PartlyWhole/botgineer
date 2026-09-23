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

export function RoadmapScreen() {
  const done = useProgress()
  const states = levelStates(LEVEL_ORDER, done)
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
  const focus = LEVEL_ORDER.find((id) => states.get(id) === 'current') ?? arrived

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

  const nextId = LEVEL_ORDER.find((id) => states.get(id) === 'current') ?? null
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

          <div className="map-end">
            <Signpost />
            <p className="map-end-title">More levels on the way</p>
            <p className="map-end-note">The robot is still learning. So are we.</p>
          </div>
        </div>

        <aside className="map-side" aria-label="Up next">
          <div className="map-next" data-theme={nextUnit?.theme ?? 'sun'}>
            {nextId ? (
              <>
                <p className="map-next-kicker">Up next · Level {LEVEL_ORDER.indexOf(nextId) + 1}</p>
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
          </div>
        </aside>
      </div>
    </main>
  )
}

function UnitStretch({
  unit,
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
  const count = unit.levels.length + 1
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

        {unit.levels.map((id, i) => {
          const state = states.get(id) ?? 'locked'
          const stop = at[i]!
          return (
            <LevelNode
              key={id}
              id={id}
              number={LEVEL_ORDER.indexOf(id) + 1}
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
  number: number
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
  const build = activity.mode === 'editor'
  const label =
    state === 'done' ? 'done' : state === 'current' ? 'up next' : 'locked — finish the levels before it first'

  return (
    <div
      className={`map-stop ${state} ${open ? 'open' : ''} ${cheer ? `just-${cheer}` : ''}`}
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
        aria-label={`Level ${number}: ${activity.title}, ${label}`}
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
        <span className="map-node-face">
          {state === 'locked' ? (
            <LockIcon />
          ) : state === 'done' ? (
            <CheckIcon />
          ) : build ? (
            <CodeIcon />
          ) : (
            <StarIcon />
          )}
        </span>
      </button>

      {open && (
        <div className="map-card" role="dialog" aria-label={activity.title} data-testid="map-card">
          <p className="map-card-kicker">
            Level {number} · {build ? 'Build' : 'Lesson'}
          </p>
          <h3>{activity.title}</h3>
          <p className="map-card-brief">{activity.brief}</p>
          {state === 'locked' ? (
            <p className="map-card-locked">Finish the levels before this one to unlock it.</p>
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

/* -------------------------------- icons -------------------------------- */

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
