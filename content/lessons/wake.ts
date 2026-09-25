/**
 * Level 7, Wake the robot (`wake`): the editor arrives.
 *
 * R12: one line at a time is slow, and waking the robot takes several. So
 * the lesson opens with the robot asleep (its screen dark, `sleep`) and
 * four beats before the task, one thing each: the editor, which holds a
 * whole list of instructions (focus on the instrument); Run, which is
 * what makes anything happen now — typing no longer does (focus `run`);
 * and the three fixtures in the bay, each named with the name it watches.
 * Then the task, and the outro wakes it.
 *
 * The first lesson judged on a *run* rather than on lines: the robot reads
 * `power`, `name` and `charge` from its memory, and the bay's lamp,
 * nameplate and battery watch them. Finishing is the lesson's last step
 * (invariant 9), so that step must agree with the scene's watches
 * exactly — the robot celebrates on one and the level is recorded on the
 * other, and `power = 0` must earn neither. So the bay is defined here and
 * `awake` *is* the watches' own verdict (`readScene(...).solved`), not a
 * restatement of it that could drift; the activity stands on this scene.
 *
 * No praise and no nudge: the editor reports no line to reply to, and the
 * stage already says what it is still waiting for, one fixture at a time.
 * The robot wakes on the first outro beat, which says why it could.
 */
import type { MemorySnapshot } from '../../src/memory/model'
import { readScene, type SceneSpec } from '../../src/scene/spec'
import type { Lesson } from './core'

/** The charging bay: the robot, the crow, and three fixtures that watch
 *  the names the robot needs. */
export const BAY: SceneSpec = {
  id: 'bay',
  title: 'Charging bay',
  floor: { at: 80 },
  actors: [
    { id: 'robot', kind: 'robot', x: 50, y: 0, w: 27, stand: true },
    // The crow, so the lesson's lines have someone to say them: on the
    // floor at the far side from the battery, under the lamp, which is
    // mounted high enough on the wall to clear its head.
    { id: 'crow', kind: 'crow', x: 86, y: 0, w: 12, stand: true },
    // Fixtures, not cast: a lamp and a gauge are mounted on the wall
    // and a nameplate hangs above the bay. None of them stands.
    { id: 'lamp', kind: 'lamp', x: 78, y: 20, w: 9 },
    { id: 'battery', kind: 'gauge', x: 20, y: 26, w: 17 },
    { id: 'nameplate', kind: 'sign', x: 50, y: 14, w: 38, label: 'unnamed' },
  ],
  watches: [
    {
      name: 'power',
      effect: { kind: 'lit', actor: 'lamp' },
      hint: 'the lamp is waiting for `power`',
    },
    {
      name: 'name',
      effect: { kind: 'caption', actor: 'nameplate' },
      hint: 'the nameplate is waiting for `name`',
    },
    {
      name: 'charge',
      effect: { kind: 'level', actor: 'battery', max: 100 },
      hint: 'the battery is waiting for `charge` (0 to 100)',
    },
  ],
}

/** Lamp lit, nameplate not blank, battery reading a number: exactly what
 *  the bay's watches say, because it is what they say. */
export const awake = (s: MemorySnapshot): boolean => readScene(BAY, s).solved

export const wake: Lesson = {
  id: 'wake',
  teaches: [],
  steps: [
    {
      beats: [
        { say: 'The robot has nodded off, and it takes more than one line to wake it.', act: [{ actor: 'robot', do: 'sleep' }] },
        { say: 'So here\'s an editor. Now you can give it a whole list of instructions.', focus: 'console' },
        { say: 'Typing does nothing yet. Press Run, and it follows the list from top to bottom.', focus: 'run' },
        { say: 'It looks for three names: the lamp shows `power`, the sign `name`, the battery `charge`.' },
      ],
      say: 'Give `power`, `name` and `charge` values, then press Run.',
      tag: 'you',
      done: ({ snapshot }) => awake(snapshot),
    },
  ],
  outro: [
    { say: 'Awake! It ran every line, top to bottom, and found all three names.', act: [{ actor: 'robot', do: 'wake' }] },
    { say: 'A list of instructions like that is called a program.' },
    { say: 'Next, you\'ll read programs other people wrote, and say what they do first.' },
  ],
  takeaway: 'A program is a list of instructions. Run sends the robot through all of them, from top to bottom.',
}
