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
  /** Horizontal centre, in percent of the scene's width. */
  x: number
  /**
   * Vertical centre, in percent of the scene's height. Ignored by a
   * standing actor, which is placed by its feet instead.
   */
  y: number
  /** Width in percent; sensible defaults per kind. */
  w?: number
  /**
   * Stand this actor's feet on the scene's floor.
   *
   * Why this exists: an actor's width is a percentage of the scene's
   * *width* while `y` is a percentage of its *height*, and its drawn
   * height follows from its width. Place it by its centre and the gap
   * between its feet and anything below is a function of the panel's
   * aspect ratio — measured across ten panel shapes, every character
   * floated, by between 65 and 359 pixels, and the gap swung by 2.4x as
   * the panel was dragged. Nobody stood on anything anywhere.
   *
   * Standing is anchored to the bottom edge instead, which makes the
   * contact exact rather than tuned: no measurement, no state, and it
   * holds at every shape because the drawn height is no longer part of
   * the sum.
   */
  stand?: boolean
  label?: string
  /** Lets one watch address several actors at once. */
  group?: string
}

/** Where the ground is, and what it looks like. */
export type Floor = {
  /** Percent of the scene's height. Standing actors' feet rest here. */
  at: number
  /** `belt` draws a conveyor; `ground` is a plain floor. */
  look?: 'ground' | 'belt'
}

/**
 * Where to put an actor, as CSS.
 *
 * A standing actor is positioned by `bottom`, so its feet land on the
 * floor whatever its drawn height turns out to be. Everything else keeps
 * its centre at `y` — a lamp on a wall and a board above a robot are not
 * standing on anything, and should not pretend to.
 */
export function placement(
  actor: Actor,
  floor: Floor | undefined,
): { left: string; width: string; top?: string; bottom?: string } {
  const left = `${actor.x}%`
  const width = `${actor.w ?? 16}%`
  // A scene with no floor cannot stand anyone on it; falling back to the
  // centre keeps such a scene renderable rather than piling actors at 0.
  if (actor.stand && floor) return { left, width, bottom: `${100 - floor.at}%` }
  return { left, width, top: `${actor.y}%` }
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
  /** Omit for a scene with nothing to stand on. */
  floor?: Floor
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
  /**
   * Every watch is not just bound, but *doing something*.
   *
   * Bound is not enough, and this is the distinction the robot used to
   * get wrong: `power = 0` binds `power`, so nothing is waiting any more
   * and the program completed without error — yet the lamp is dark. The
   * robot celebrated that. Celebration has to come from the picture
   * being right, not from the interpreter reaching the end.
   *
   * False for a scene with no watches. There is nothing to satisfy, so
   * there is nothing to be pleased about; those activities decide their
   * own triumph elsewhere.
   */
  solved: boolean
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
  let satisfied = 0

  for (const watch of spec.watches) {
    const object = globalObject(snapshot, watch.name)
    if (!object) {
      waitingFor.push({ name: watch.name, hint: watch.hint })
      continue
    }

    const e = watch.effect
    if (e.kind === 'pick') {
      const wanted = new Set(stringsIn(object, snapshot))
      let picked = 0
      for (const v of views.values()) {
        if (v.actor.group === e.group && v.actor.label) {
          v.picked = wanted.has(v.actor.label)
          if (v.picked) picked += 1
        }
      }
      // An empty list, or one naming nothing in the scene, moves no
      // parcel. The robot is not owed applause for that.
      if (picked > 0) satisfied += 1
      continue
    }

    const view = views.get(e.actor)
    if (!view) continue
    if (e.kind === 'lit') {
      view.lit = truthy(object)
      if (view.lit) satisfied += 1
    }
    if (e.kind === 'caption') {
      view.caption = displayText(object)
      // A blank sign is not a named robot.
      if (view.caption.trim() !== '') satisfied += 1
    }
    if (e.kind === 'level') {
      const n = numberOf(object)
      view.level = n === null ? null : Math.max(0, Math.min(1, n / e.max))
      // Bound to something that is not a number leaves the gauge empty.
      if (view.level !== null) satisfied += 1
    }
  }

  return {
    actors: [...views.values()],
    waitingFor,
    solved: spec.watches.length > 0 && satisfied === spec.watches.length,
  }
}
