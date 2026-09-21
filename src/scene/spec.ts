/**
 * A scene is data, and it is a *view of memory*.
 *
 * The scene does not receive commands and does not hold state of its own.
 * It declares which names it watches, and renders whatever those names are
 * bound to in the current snapshot. So the picture and the memory panel
 * cannot disagree: they are two renderings of one thing, and the way the
 * player changes the picture is by changing memory.
 *
 * Scenes are disjoint by design — an activity brings its own, and nothing
 * assumes a continuous world.
 */
import type { MemorySnapshot, PyObject } from '../memory/model'

export type ActorKind =
  | 'robot'
  | 'crow'
  | 'courier'
  | 'crate'
  | 'lamp'
  | 'gauge'
  | 'sign'
  | 'plinth'

export type Actor = {
  id: string
  kind: ActorKind
  /** Percentage of the scene box, so a scene scales with its panel. */
  x: number
  y: number
  /** Width in percent; sensible defaults per kind. */
  w?: number
  label?: string
  /** Lets one watch address several actors at once. */
  group?: string
}

export type Effect =
  /** Truthiness of the bound object lights the actor. */
  | { kind: 'lit'; actor: string }
  /** The bound object becomes the actor's caption. A string shows its
   *  text, not its repr: a nameplate in the world reads `Bolt`, while the
   *  memory panel still shows `'Bolt'`. The scene shows the world; the
   *  memory panel shows the representation. Anything that is not a string
   *  shows its repr, so binding the wrong type is visible rather than
   *  silently coerced. */
  | { kind: 'caption'; actor: string }
  /** A number fills the actor, 0..max. */
  | { kind: 'level'; actor: string; max: number }
  /** A collection of strings picks out actors in a group by label. */
  | { kind: 'pick'; group: string }

export type Watch = {
  /** A global name in the player's program. */
  name: string
  effect: Effect
  /** Shown while the name is still unbound. */
  hint: string
}

export type SceneSpec = {
  id: string
  title: string
  actors: Actor[]
  watches: Watch[]
}

/* ------------------------------------------------------------------ */

export type ActorView = {
  actor: Actor
  lit: boolean
  caption: string | null
  /** 0..1, or null when nothing drives it. */
  level: number | null
  picked: boolean
}

export type SceneView = {
  actors: ActorView[]
  /** Watched names that are not bound yet. The scene says what it is
   *  waiting for rather than sitting inert and unexplained. */
  waitingFor: { name: string; hint: string }[]
}

function globalObject(snapshot: MemorySnapshot, name: string): PyObject | null {
  const binding = snapshot.bindings.find((b) => b.scope === 'global' && b.name === name)
  if (!binding) return null
  return snapshot.objects[binding.target] ?? null
}

/** Python's truthiness, from the model rather than from a guess. */
function truthy(o: PyObject): boolean {
  if (o.type === 'NoneType') return false
  if (o.type === 'bool') return o.repr === 'True'
  if (o.elements !== null) return o.elements.length > 0
  if (o.type === 'int' || o.type === 'float') return Number(o.repr) !== 0
  if (o.type === 'str') return o.repr !== "''" && o.repr !== '""'
  return true
}

/** What a sign in the world shows. See the `caption` effect. */
function displayText(o: PyObject): string {
  return o.type === 'str' ? o.repr.replace(/^['"]|['"]$/g, '') : o.repr
}

function numberOf(o: PyObject): number | null {
  if (o.type !== 'int' && o.type !== 'float') return null
  const n = Number(o.repr)
  return Number.isFinite(n) ? n : null
}

/** Strings inside a collection, used by `pick`. Unquoted, because the
 *  labels they match are unquoted. */
function stringsIn(o: PyObject, snapshot: MemorySnapshot): string[] {
  return (o.elements ?? [])
    .map((e) => snapshot.objects[e.target])
    .filter((x): x is PyObject => !!x && x.type === 'str')
    .map((x) => x.repr.replace(/^['"]|['"]$/g, ''))
}

export function readScene(spec: SceneSpec, snapshot: MemorySnapshot): SceneView {
  const views = new Map<string, ActorView>(
    spec.actors.map((actor) => [
      actor.id,
      { actor, lit: false, caption: actor.label ?? null, level: null, picked: false },
    ]),
  )
  const waitingFor: { name: string; hint: string }[] = []

  for (const watch of spec.watches) {
    const object = globalObject(snapshot, watch.name)
    if (!object) {
      waitingFor.push({ name: watch.name, hint: watch.hint })
      continue
    }

    const e = watch.effect
    if (e.kind === 'pick') {
      const wanted = new Set(stringsIn(object, snapshot))
      for (const v of views.values()) {
        if (v.actor.group === e.group && v.actor.label) v.picked = wanted.has(v.actor.label)
      }
      continue
    }

    const view = views.get(e.actor)
    if (!view) continue
    if (e.kind === 'lit') view.lit = truthy(object)
    if (e.kind === 'caption') view.caption = displayText(object)
    if (e.kind === 'level') {
      const n = numberOf(object)
      view.level = n === null ? null : Math.max(0, Math.min(1, n / e.max))
    }
  }

  return { actors: [...views.values()], waitingFor }
}
