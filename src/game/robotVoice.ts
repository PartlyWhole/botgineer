/**
 * What the robot says back.
 *
 * The division of labour matters pedagogically: **the robot reports, the
 * crow teaches.** The robot is a machine — it says factually what it did
 * or could not do, and never explains why or what to try instead. The crow
 * is the mentor and owns every word of interpretation. Blurring the two
 * would make the robot an oracle, and the whole game is about the player
 * learning to drive it.
 *
 * Nothing here invents facts. Every line is built from what the trace
 * actually reported.
 */
import type { MemoryObject } from './repl'

/** Types whose values Python treats as plain values, with no identity of
 *  their own worth showing (see `ObjectTiles`). */
const SCALARS = new Set(['int', 'float', 'str', 'bool', 'NoneType'])

const ARTICLE = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a')

/** The robot's line after it successfully built something. */
export function robotMade(made: MemoryObject, idLabel: string | null): string {
  const type = made.typeName

  if (SCALARS.has(type)) {
    return `Done. That's ${ARTICLE(type)} ${type}. It's in my memory now.`
  }

  const count = made.items?.length ?? null
  const size =
    count === null ? '' : ` with ${count} thing${count === 1 ? '' : 's'} inside`
  const id = idLabel === null ? '' : `, and it has a spot of its own — ${idLabel}`
  return `Done. That's ${ARTICLE(type)} ${type}${size}${id}.`
}

/** The robot's line when the run did not produce an object. Factual, and
 *  short: it names what Python said and stops there. */
export function robotRefused(errorType: string | null): string {
  if (errorType === null) return "I couldn't finish that one."
  return `I couldn't make anything from that. Python stopped me with ${ARTICLE(errorType)} ${errorType}.`
}

/** The crow's explanation of a failure. This is the teaching half. */
export function crowOnError(errorType: string | null): string {
  switch (errorType) {
    case 'SyntaxError':
      return "That was an instruction, not a value. Right now we are only making things — type something that *is* something, like `10` or `\"John\"`."
    case 'NameError':
      return 'Nothing here has a name yet, so a bare word has nothing to point at. Type a value instead.'
    case 'TypeError':
      return "Python understood the words but not the combination. Try one plain value on its own."
    case 'ZeroDivisionError':
      return 'Dividing by zero has no answer, so Python refuses rather than guessing. Pick a different number.'
    default:
      return 'Whatever that was, Python would not build it. Try one plain value on its own.'
  }
}

/** What the robot says when it first wakes up. */
export const GREETING =
  "Powered up. My memory is completely empty — tell me something to make and I'll hold on to it."
