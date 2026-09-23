/**
 * The shell: a thin bar, and either the roadmap or one level.
 *
 * The runtime's state is exposed as a data attribute rather than a badge.
 * It matters when it *fails* — a working runtime announcing that it works
 * is noise — and the tests still need something to wait on. It boots on
 * the map too, so by the time a level is opened Python is usually ready.
 */
import { useRuntime } from '../runtime/shared'
import { LEVEL_ORDER } from '../../content/roadmap'
import { goToMap, useRoute } from './router'
import { Workbench } from './Workbench'
import { RoadmapScreen } from '../roadmap/RoadmapScreen'
import { SkillsScreen } from '../roadmap/SkillsScreen'
import { GlossaryScreen } from '../roadmap/GlossaryScreen'

export function App() {
  const route = useRoute()
  const boot = useRuntime()
  const level = route.kind === 'level' ? route.activity : null
  const number = level ? LEVEL_ORDER.indexOf(level.id) + 1 : 0

  return (
    <div
      className="app"
      data-boot={boot.state}
      data-isolated={boot.state === 'ready' && boot.isolated ? 'yes' : 'no'}
      data-route={route.kind}
    >
      <header className="topbar">
        <h1>
          <a href="#/map" className="brand">
            BotGineer
          </a>
        </h1>
        <span className="spacer" />

        {!level && (
          <nav className="whereabouts" aria-label="Screens">
            <a
              href="#/map"
              className={`to-map ${route.kind === 'map' ? 'here' : ''}`}
              aria-current={route.kind === 'map' ? 'page' : undefined}
              data-testid="nav-map"
              aria-label="Map"
            >
              <MapIcon />
              <span className="nav-word">Map</span>
            </a>
            <a
              href="#/skills"
              className={`to-map ${route.kind === 'skills' ? 'here' : ''}`}
              aria-current={route.kind === 'skills' ? 'page' : undefined}
              data-testid="nav-skills"
              aria-label="Skills"
            >
              <SkillsIcon />
              <span className="nav-word">Skills</span>
            </a>
            <a
              href="#/glossary"
              className={`to-map ${route.kind === 'glossary' ? 'here' : ''}`}
              aria-current={route.kind === 'glossary' ? 'page' : undefined}
              data-testid="nav-glossary"
              aria-label="Glossary"
            >
              <BookIcon />
              <span className="nav-word">Glossary</span>
            </a>
          </nav>
        )}

        {/* The way back to the path from inside a level, and where you are
            on it. The map is the progression now; the row of dots it
            replaced said how many levels there were and nothing else. */}
        {level && (
          <nav className="whereabouts" aria-label="Levels">
            <span className="whereabouts-level" data-testid="level-label">
              {number > 0 ? `Level ${number} · ` : ''}
              {level.title}
            </span>
            <button type="button" className="to-map" data-testid="to-map" onClick={() => goToMap()}>
              <MapIcon />
              Map
            </button>
          </nav>
        )}
      </header>

      {boot.state === 'failed' && (
        <p className="alert" role="alert">
          The Python runtime did not start: {boot.message}
        </p>
      )}

      {/* Remounting per activity keeps each one's run state its own. */}
      {level ? (
        <Workbench key={level.id} activity={level} />
      ) : route.kind === 'skills' ? (
        <SkillsScreen />
      ) : route.kind === 'glossary' ? (
        <GlossaryScreen term={route.term} />
      ) : (
        <RoadmapScreen />
      )}
    </div>
  )
}

const SkillsIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
    <path d="M5 19V13M12 19V8M19 19V4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
)

const BookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
    <path
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
)

const MapIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
    <path
      d="M9 4.5l-5 2v13l5-2 6 2 5-2v-13l-5 2-6-2zM9 4.5v13M15 6.5v13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
)
