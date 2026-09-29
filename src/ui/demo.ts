/**
 * A line typed into the robot's console *for* the player, as a
 * demonstration: the crow shows how an instruction becomes a thought
 * before anyone is asked to write one (docs/PEDAGOGY.md R1, show first).
 *
 * Narration, never evidence. It is not run, never joins the accepted
 * history, and is gone when the beat that carries it moves on. `echo` is
 * what the robot answers, as the console would show it after a real line
 * (`repr` of the value), or null for a line that answers nothing.
 *
 * `key` changes whenever the demonstration does (it is the beat's place in
 * the script), so the console can restart its typing for a new one and
 * leave a finished one finished when it re-renders.
 */
export type Demo = {
  key: string
  source: string
  echo: string | null
  /** The line stops the robot instead, as the console says it
   *  (`TypeError`): for showing a rule, like a word plus a number. */
  error?: string | null | undefined
}
