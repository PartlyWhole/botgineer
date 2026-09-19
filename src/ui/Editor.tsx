/**
 * The three-region editor.
 *
 * Preamble and harness are visible and locked. Hiding them would teach that
 * data comes from nowhere and that functions call themselves; showing them
 * costs two grey boxes.
 */
type Props = {
  preamble: string
  harness: string
  solution: string
  onSolution: (next: string) => void
  disabled: boolean
}

export function Editor({ preamble, harness, solution, onSolution, disabled }: Props) {
  return (
    <div className="editor">
      <pre className="region locked" aria-label="The situation (read only)">
        {preamble.trimEnd()}
      </pre>
      <textarea
        className="region solution"
        value={solution}
        spellCheck={false}
        disabled={disabled}
        onChange={(e) => onSolution(e.target.value)}
        aria-label="Your Python code"
        data-testid="solution"
        rows={Math.max(8, solution.split('\n').length + 1)}
      />
      <pre className="region locked" aria-label="How the robot runs your code (read only)">
        {harness.trimEnd()}
      </pre>
    </div>
  )
}
