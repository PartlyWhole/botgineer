/**
 * (B) The instrument for the ideas: the example being shown.
 *
 * The robot runs whichever example was picked in the text, and this shows
 * its code with the line the scrubber is on. Nothing to answer here — it
 * is the stage's reading, not its exercises.
 *
 * `said` is what the crow says about the run. On a wide screen the stage
 * is beside memory and the bubble is enough; stacked, the stage is a
 * screen above, so the line is repeated here, over the memory it points
 * at (read.css shows it only there, and it is hidden from screen readers,
 * which have already heard the bubble).
 */
import { CodeView } from '../ui/CodeView'
import { CROW_NAME } from '../../content/cast'
import { richText } from '../ui/richText'
import { NO_EXAMPLES } from '../collection/voice'

export function IdeasPanel({
  code,
  traceLine,
  note,
  said,
  runnable = true,
}: {
  code: string | null
  /** False when the stage's ideas have no example to run (Stage 9), so
   *  the panel does not point at a "Run this" that is not there. */
  runnable?: boolean
  traceLine: number | null
  note?: string | null
  said?: string | null
}) {
  return (
    <div className="read-panel ideas-panel" data-testid="ideas-panel">
      <div className="read-code">
        {code ? (
          <>
            {note && <p className="ideas-note" data-testid="ideas-note">{note}</p>}
            {said && (
              <p className="ideas-said" data-testid="ideas-said" aria-hidden="true">
                <b>{CROW_NAME}</b> {richText(said)}
              </p>
            )}
            <CodeView code={code} traceLine={traceLine} label="The example" />
          </>
        ) : (
          <p className="read-nocode quiet">
            {runnable ? 'Pick “Run this” under any example in the text, and the robot runs it here — memory draws what it builds.' : NO_EXAMPLES}
          </p>
        )}
      </div>
    </div>
  )
}
