/**
 * PLACEHOLDER — Level 7, Wake the robot (`wake`). The content workstream
 * adds the four beats of docs/PEDAGOGY.md §6 before the task.
 *
 * The editor's level, and the first lesson judged on a *run* rather than
 * on lines: the robot reads `power`, `name` and `charge` from its memory,
 * and the bay's lamp, nameplate and battery watch them. Finishing is the
 * lesson's last step (invariant 9), so that step must agree with the
 * scene's watches exactly — the robot celebrates on one and the level is
 * recorded on the other, and `power = 0` must earn neither. The check
 * below is the watches' own rule (`readScene` in `src/scene/spec.ts`),
 * restated on the snapshot.
 */
import type { MemorySnapshot, PyObject } from '../../src/memory/model'
import type { Lesson } from './core'

const global = (s: MemorySnapshot, name: string): PyObject | null => {
  const b = s.bindings.find((x) => x.scope === 'global' && x.name === name)
  return b ? (s.objects[b.target] ?? null) : null
}

/** Python's truthiness, as the lamp reads it. */
const truthy = (o: PyObject): boolean => {
  if (o.type === 'NoneType') return false
  if (o.type === 'bool') return o.repr === 'True'
  if (o.elements !== null) return o.elements.length > 0
  if (o.type === 'int' || o.type === 'float') return Number(o.repr) !== 0
  if (o.type === 'str') return o.repr !== "''" && o.repr !== '""'
  return true
}

/** Lamp lit, nameplate not blank, battery reading a number. */
export const awake = (s: MemorySnapshot): boolean => {
  const power = global(s, 'power')
  const name = global(s, 'name')
  const charge = global(s, 'charge')
  const shown = name ? (name.type === 'str' ? name.repr.replace(/^['"]|['"]$/g, '') : name.repr) : ''
  const reads = charge !== null && (charge.type === 'int' || charge.type === 'float') && Number.isFinite(Number(charge.repr))
  return power !== null && truthy(power) && shown.trim() !== '' && reads
}

export const wake: Lesson = {
  id: 'wake',
  teaches: [],
  steps: [
    {
      say: 'Give the robot `power`, a `name` and a `charge`, then send it the whole program.',
      tag: 'you',
      done: ({ snapshot }) => awake(snapshot),
    },
  ],
  outro: 'Awake! A whole program, run in one go.',
}
