/**
 * The player's own controls over what is stored: open every level, or
 * start over.
 *
 * Unlocking opens the path without pretending anything was done: levels
 * are open to play, trophies still need their levels finished, and
 * mastery is untouched. Starting over forgets both stored things —
 * finished levels and mastery — which is why it asks first, in place,
 * rather than in a browser dialog that looks like the page crashed.
 */
import { useState } from 'react'
import { allUnlocked, resetProgress, setUnlockAll, useProgress } from '../progress/progress'
import { resetMastery } from '../mastery/mastery'

export function ProgressControls({ compact = false }: { compact?: boolean }) {
  const done = useProgress()
  const unlocked = allUnlocked(done)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className={`progress-controls ${compact ? 'compact' : ''}`} data-testid="progress-controls">
      <button
        type="button"
        className="progress-button"
        aria-pressed={unlocked}
        onClick={() => setUnlockAll(!unlocked)}
        data-testid="unlock-all"
      >
        {unlocked ? 'Lock levels again' : 'Unlock every level'}
      </button>

      {confirming ? (
        <div className="progress-confirm" role="group" aria-label="Start over?">
          <p>This forgets every finished level and everything your skills screen knows. It cannot be undone.</p>
          <div className="progress-confirm-row">
            <button
              type="button"
              className="progress-button danger"
              onClick={() => {
                resetProgress()
                resetMastery()
                setConfirming(false)
              }}
              data-testid="reset-confirm"
            >
              Forget everything
            </button>
            <button type="button" className="progress-button" onClick={() => setConfirming(false)} data-testid="reset-cancel">
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="progress-button quiet-button" onClick={() => setConfirming(true)} data-testid="reset">
          Start over…
        </button>
      )}
    </div>
  )
}
