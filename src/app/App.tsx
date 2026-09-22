/**
 * The shell: a thin bar, and the workbench.
 *
 * The runtime's state is exposed as a data attribute rather than a badge.
 * It matters when it *fails* — a working runtime announcing that it works
 * is noise — and the tests still need something to wait on.
 */
import { useRuntime } from '../runtime/shared'
import { ACTIVITIES } from '../../content/activities'
import { goTo, useActivity } from './router'
import { Workbench } from './Workbench'

export function App() {
  const [activity] = useActivity()
  const boot = useRuntime()

  return (
    <div
      className="app"
      data-boot={boot.state}
      data-isolated={boot.state === 'ready' && boot.isolated ? 'yes' : 'no'}
    >
      <header className="topbar">
        <h1>BotGineer</h1>
        <span className="spacer" />

        {/* The progression, as a row of steps rather than a row of tabs.
            Finishing a level offers the next one in the scene, but that
            is a one-way door: with only that, there is no way back to a
            level you want to redo and no way to see how many there are.
            Named only to a screen reader, so the chrome stays quiet. */}
        <nav className="steps" aria-label="Levels">
          {ACTIVITIES.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className={a.id === activity.id ? 'current' : ''}
              aria-current={a.id === activity.id ? 'step' : undefined}
              aria-label={`Level ${i + 1}: ${a.title}`}
              title={a.title}
              data-testid={`step-${a.id}`}
              onClick={() => goTo(a.id)}
            >
              <span className="sr-only">{a.title}</span>
            </button>
          ))}
        </nav>
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
