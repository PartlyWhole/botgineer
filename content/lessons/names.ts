import { ever, points, sameObject, worked, type Lesson } from './core'

/**
 * Keeping one, and what a name actually is.
 *
 * This follows the operations lesson deliberately: that one ends with an
 * answer nobody kept and the observation that getting it back means
 * working it out again. A name is the fix for that, so the player meets
 * binding as the answer to a problem they have just had rather than as a
 * new piece of syntax.
 *
 * The second half prevents the misconception that `x = 10` puts a 10
 * *inside* `x`. If that were true, `y = x` would copy it and rebinding
 * `x` would leave `y` alone by luck rather than by rule — so the lesson
 * ends by moving `x` and looking at `y`.
 *
 * Every object here is a small int, which CPython interns, so two
 * separately typed `10`s really are one object and the memory view says
 * so. That is why the aliasing step is `y = x` and never `y = 10`: the
 * second looks identical on screen while teaching something untrue of
 * objects in general.
 */
export const namesPoint: Lesson = {
  id: 'names-point',
  teaches: ['bind', 'alias', 'rebind'],
  steps: [
    {
      say: 'Tired of it forgetting? Give a thing a name and the robot keeps it: `x = 10`',
      // `ever`, not `snapshot`: the last step of this lesson moves `x`,
      // which would otherwise un-answer the first two.
      done: (e) => ever(e, (s) => points(s, 'x', '10')),
    },
    {
      say: 'There — `x` in memory, pointing at `10`. Now ask for it back: just `x`.',
      done: (e) => worked(e, '10'),
    },
    {
      say: 'No working out — it just looked. Now point a second name at the same thing: `y = x`',
      done: (e) => ever(e, (s) => sameObject(s, 'x', 'y')),
    },
    {
      say: 'Two names, one `10`. Now point `x` somewhere else with `x = 99`, and keep an eye on `y`.',
      done: ({ snapshot }) => points(snapshot, 'x', '99') && points(snapshot, 'y', '10'),
    },
  ],
  outro:
    '`x` moved; `y` stayed put. A name points at a thing — it never held it.',
}
