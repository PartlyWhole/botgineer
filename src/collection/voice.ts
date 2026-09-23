/**
 * What the crow says during a reading exercise. Pure, so it can be read
 * and tested as text.
 *
 * The language policy lives here (README §7): Stages 1–5 say "a name
 * pointing at an object", "change the list", "the lines inside the loop";
 * from Stage 6 the formal words — binding, iterable, loop variable,
 * parameter — are labels for ideas the player already has.
 */
import { ERROR_NAMES, type ErrorType, type Form } from './model'

export type Vocabulary = 'plain' | 'formal'

const TASK: Record<Form, [plain: string, formal: string]> = {
  predict: ['Read it, and write down what it prints — before anything runs.', 'Predict the output. Commit before the interpreter runs.'],
  compare: ['Two nearly identical programs. Say what each prints, and where they part ways.', 'Two near-matches: predict both, and find the first line where the control flow or the bindings diverge.'],
  fix: ['Something here is not doing what was meant. Say what it does first.', 'Find the defect. Say what it actually does, then repair it minimally.'],
  order: ['Number the lines in the order Python reaches them. Repeats count.', 'Number the control flow: every visit, in order.'],
  table: ['Fill in the table, one row per pass.', 'Build the trace table, one row per iteration.'],
  block: ['Which lines are inside the block? And how many times does each run?', 'Mark the block by indentation, and count each line’s runs.'],
  draw: ['Which picture shows the names and the objects they point at?', 'Which diagram shows the bindings and the objects?'],
  write: ['Write it. The robot will check it does what was asked.', 'Write the program. It is checked for the behaviour asked for.'],
  label: ['Say what each piece of the line does.', 'Label each piece of the line with its role.'],
  rule: ['Put the rule into your own words, then check it against the key.', 'State the rule, then mark yourself against the key.'],
}

export const taskLine = (form: Form, v: Vocabulary): string => TASK[form][v === 'plain' ? 0 : 1]

export const CHECKPOINT_LINE = 'Checkpoint. No new ideas — just the ones you have. First answers count.'

/** After committing: right, or which kind of mistake, and where to look. */
export function verdictLine(right: boolean, err: ErrorType | null, goBack: string[], soft = false): string {
  if (right) return 'Right. Read the key anyway — the reasoning is the point.'
  if (soft) return 'The idea is right; the word is not. That is the cheapest mistake there is.'
  const kind = err ? `${article(ERROR_NAMES[err])} ${ERROR_NAMES[err].toLowerCase()} mistake` : 'a miss'
  const back = goBack.length ? ` The key sends you back to ${goBack.join(' and ')}.` : ''
  return `Not quite — ${kind}.${back}`
}

const article = (w: string) => (/^[AEIOU]/i.test(w) ? 'an' : 'a')

export const ACT_LINE: Record<'fix' | 'write', string> = {
  fix: 'Now repair it — the smallest change that works — and send it to the robot.',
  write: 'Your turn to write it. Send it to the robot when it is ready.',
}

export const RULE_LINE = 'Now read the key’s rule and mark yours honestly.'

export function doneLine(right: number, of: number, kind: 'set' | 'checkpoint' | 'review' | 'capstone' | 'practice', passed?: boolean): string {
  if (kind === 'checkpoint') {
    return passed
      ? `Checkpoint passed — ${right} of ${of} right first time. The stage is yours.`
      : `${right} of ${of} first time. The ladder assumes every rung holds: there is a short review on the map, then try again.`
  }
  if (kind === 'review') return 'Review done. The checkpoint is open again.'
  if (kind === 'capstone') return `Capstone done — ${right} of ${of} right first time. That is the whole collection.`
  return `Done — ${right} of ${of} right first time. Each one counts towards your concepts.`
}
