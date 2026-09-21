/**
 * The shell: the bar that is always there, and the workbench for whichever
 * activity the hash selects.
 */
import { useRuntime } from '../runtime/shared'
import { ACTIVITIES } from '../../content/activities'
import { useActivity } from './router'
import { Workbench } from './Workbench'

export function App() {
  const [activity, go] = useActivity()
  const boot = useRuntime()

  return (
    <div className="app">
      <header className="topbar">
        <h1>BotGineer</h1>
        <nav className="routes" aria-label="Activities">
          {ACTIVITIES.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`route ${a.id === activity.id ? 'current' : ''}`}
              aria-current={a.id === activity.id ? 'page' : undefined}
              data-testid={`route-${a.id}`}
              onClick={() => go(a)}
            >
              {a.title}
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

      {/* Remounting per activity keeps each one's run state its own. */}
      <Workbench key={activity.id} activity={activity} />
    </div>
  )
}
