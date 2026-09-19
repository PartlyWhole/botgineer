/**
 * The shell: the bar that is always there, and whichever screen the hash
 * selects. Each screen owns its own layout.
 */
import { useRuntime } from '../runtime/shared'
import { Scenario } from './Scenario'
import { Tutorial } from './Tutorial'
import { ROUTES, useRoute, type Route } from './router'

export function App() {
  const [route, go] = useRoute()
  const boot = useRuntime()

  return (
    <div className="app">
      <header className="topbar">
        <h1>BotGineer</h1>
        <nav className="routes" aria-label="Lessons">
          {(Object.keys(ROUTES) as Route[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`route ${id === route ? 'current' : ''}`}
              aria-current={id === route ? 'page' : undefined}
              data-testid={`route-${id}`}
              onClick={() => go(id)}
            >
              {ROUTES[id]}
            </button>
          ))}
        </nav>
        <span className="spacer" />
        <span className="badge" data-testid="boot-badge">
          {boot.state === 'booting' && 'starting Python…'}
          {boot.state === 'ready' && `Python ready · ${boot.isolated ? 'isolated' : 'degraded'}`}
          {boot.state === 'failed' && 'runtime failed'}
        </span>
      </header>

      {boot.state === 'failed' && (
        <p className="alert" role="alert">
          The Python runtime did not start: {boot.message}
        </p>
      )}

      {route === 'tutorial' ? <Tutorial /> : <Scenario />}
    </div>
  )
}
