/**
 * The shell: a thin bar, and the workbench.
 *
 * The runtime's state is exposed as a data attribute rather than a badge.
 * It matters when it *fails* — a working runtime announcing that it works
 * is noise — and the tests still need something to wait on.
 */
import { useRuntime } from '../runtime/shared'
import { useActivity } from './router'
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
