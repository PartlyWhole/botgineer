/**
 * "First Objects" — the opening tutorial.
 *
 * No customer, no request. Just the BotGineer, a crow, and an empty robot
 * memory. The arc: every value you write is an object with a type, and
 * containers have an identity in a way that plain numbers and strings do
 * not.
 */
import type { MemoryObject } from '../../src/game/repl'

export type Beat = {
  id: string
  /** What the crow says when this beat opens. */
  say: string
  /** Something the player could type. Shown as a chip they can click. */
  suggestion: string
  /** Satisfied by the object that just appeared. */
  accepts: (made: MemoryObject, all: MemoryObject[]) => boolean
  /** Said when they get it. */
  praise: string
  /** Said when they typed something valid but not what this beat wants. */
  nudge: string
}

const isType = (name: string) => (made: MemoryObject) => made.typeName === name

export const firstObjects: Beat[] = [
  {
    id: 'int',
    say: "Right. This robot's memory is empty, and that is no use to anybody. Type a number — just the number, nothing else — and press Enter.",
    suggestion: '10',
    accepts: isType('int'),
    praise:
      'There it is. You did not *store* anything. You wrote a value, and Python built an object to hold it: type `int`, value 10.',
    nudge: 'Close, but I wanted a whole number. Try `10`.',
  },
  {
    id: 'str',
    say: 'Now some text. Put it in quotes, or Python will think you are naming something.',
    suggestion: '"John"',
    accepts: isType('str'),
    praise: 'A `str` object. Same idea, different type. The quotes are what make it text.',
    nudge: 'Text needs quotes around it. Try `"John"`.',
  },
  {
    id: 'float',
    say: 'A number with a decimal point is a different type again. Give me one.',
    suggestion: '3.5',
    accepts: isType('float'),
    praise:
      '`float`, not `int`. Python decided that from how you wrote it — the dot was the whole difference.',
    nudge: 'I meant one with a decimal point, like `3.5`.',
  },
  {
    id: 'bool',
    say: 'There are only two objects of the next type. Either will do.',
    suggestion: 'True',
    accepts: isType('bool'),
    praise: '`bool`. Capital letter — `true` in lower case would be Python looking for a name.',
    nudge: 'I am after `True` or `False`, with the capital letter.',
  },
  {
    id: 'list',
    say: 'Everything so far has been one value. Now make something that holds several: square brackets, commas between.',
    suggestion: '[1, 2, 3]',
    accepts: isType('list'),
    praise:
      'A `list`. Notice it got an id, and the numbers did not. That is not decoration — it is the difference that matters next.',
    nudge: 'Square brackets, with commas between the values: `[1, 2, 3]`.',
  },
  {
    id: 'twin',
    say: 'Last one. Make a second list with exactly the same contents as the first.',
    suggestion: '[1, 2, 3]',
    accepts: (made, all) => {
      if (made.typeName !== 'list') return false
      const otherLists = all.filter((o) => o.typeName === 'list' && o.slot !== made.slot)
      return otherLists.some((o) => o.text === made.text)
    },
    praise:
      'Two objects. They *look* identical and they have different ids, because they are not the same object — equal is not the same as identical. That is the thing most people get wrong for years.',
    nudge: 'Another list, with the same contents as the one you already made.',
  },
]

export const closing =
  "That is the whole idea. Every value you write becomes an object with a type. Nothing here has a name yet — I have been holding them all for you, and a real program would have thrown every one away the moment you made it. Giving them names is the next lesson."
