/**
 * A line typed into the robot's console *for* the player, as a
 * demonstration: the crow shows how an instruction becomes a thought
 * before anyone is asked to write one (docs/PEDAGOGY.md R1, show first).
 *
 * Narration, never evidence. It is not run, never joins the accepted
 * history, and is gone at the question. `echo` is what the robot answers,
 * as the console would show it after a real line (`repr` of the value),
 * or null for a line that answers nothing.
 *
 * A step's demonstrations accumulate: `before` is the ones earlier beats
 * of the same step typed, oldest first, shown already typed above this
 * one, so "Now another" still has the first line in sight.
 *
 * `key` changes whenever the newest demonstration does (it is the beat's
 * place in the script), so the console can restart its typing for a new
 * one and leave a finished one finished when it re-renders.
 */
export type DemoLine = {
  source: string
  echo: string | null
  /** The line stops the robot instead, as the console says it
   *  (`TypeError`): for showing a rule, like a word plus a number. */
  error?: string | null | undefined
}

export type Demo = DemoLine & {
  key: string
  /** The step's earlier demonstrations, oldest first, already typed. */
  before?: DemoLine[] | undefined
}
