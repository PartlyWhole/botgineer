/**
 * (B) The instrument for the ideas: the example being shown.
 *
 * The robot runs whichever example was picked in the text, and this shows
 * its code with the line the scrubber is on. Nothing to answer here — it
 * is the stage's reading, not its exercises.
 */
import { CodeView } from '../ui/CodeView'

export function IdeasPanel({ code, traceLine, note }: { code: string | null; traceLine: number | null; note?: string | null }) {
  return (
    <div className="read-panel ideas-panel" data-testid="ideas-panel">
      <div className="read-code">
        {code ? (
          <>
            {note && <p className="ideas-note" data-testid="ideas-note">{note}</p>}
            <CodeView code={code} traceLine={traceLine} label="The example" />
          </>
        ) : (
          <p className="read-nocode quiet">Pick “Run this” under any example in the text, and the robot runs it here — memory draws what it builds.</p>
        )}
      </div>
    </div>
  )
}
