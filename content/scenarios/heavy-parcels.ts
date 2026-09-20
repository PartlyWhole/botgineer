/**
 * "Heavy Parcels" — the MVP scenario.
 *
 * Chosen because it exercises the whole loop with nothing to spare:
 * structured data in, a list built by a loop (which is what makes the memory
 * panel worth looking at), a value out, and a reaction that is checkable.
 */
import { asNumber, type Decoded } from '../../src/runtime/decode'
import { parcelsLiteral, pyFloat, type Scenario, type World } from '../../src/game/scenario'

const world: World = {
  parcels: [
    { id: 'A7', weight: 3.2 },
    { id: 'B1', weight: 7.4 },
    { id: 'C2', weight: 1.1 },
    { id: 'D3', weight: 9.8 },
    // E5 weighs exactly the limit: `>` excludes it, `>=` includes it. That
    // one parcel is what turns a wrong answer into a diagnosable one.
    { id: 'E5', weight: 5.0 },
  ],
  limit: 5.0,
}

const preamble = `# --- the situation (you can read this, but not change it) ---
parcels = ${parcelsLiteral(world.parcels)}
LIMIT = ${pyFloat(world.limit)}


def report(answer):
    print("Robot says:", answer)
`

const starter = `def respond(parcels, limit):
    # Return a list of the ids of every parcel heavier than the limit.
    # Each parcel is a tuple: (id, weight)
    heavy = []
    for parcel in parcels:
        pass  # your code here
    return heavy
`

const harness = `# --- the robot runs your code ---
answer = respond(parcels, LIMIT)
report(answer)
`

const reference = `def respond(parcels, limit):
    heavy = []
    for parcel in parcels:
        if parcel[1] > limit:
            heavy.append(parcel[0])
    return heavy
`

const expected: Decoded = ['B1', 'D3']

const idsAtOrOver = (w: World) =>
  w.parcels.filter((p) => p.weight >= w.limit).map((p) => p.id)

const asStringList = (d: Decoded): string[] | null =>
  Array.isArray(d) && d.every((x) => typeof x === 'string') ? (d as string[]) : null

const sameMembers = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i])

export const heavyParcels: Scenario = {
  id: 'heavy-parcels',
  title: 'Heavy Parcels',
  npc: {
    name: 'Mira',
    line: "I need to know which of these parcels are too heavy for the belt — anything over 5 kilos.",
  },
  world,
  preamble,
  starter,
  harness,
  // The correct solution takes 28 steps, so this is ~70x headroom for any
  // legitimate attempt — and it is what actually bounds a runaway.
  //
  // `wall_clock_s` is a SECOND line of defence, not the first: it is a
  // main-thread timer, so a page busy rendering a fast record stream can
  // starve it. Measured worst case for a runaway here is a few seconds;
  // raising max_steps is what makes an endless loop feel like a hang,
  // because every step serializes the whole reachable heap and this
  // scenario has real data in scope.
  options: { max_steps: 2000, wall_clock_s: 20 },
  contract: {
    entry: 'respond',
    expected,
    reference,
    misconceptions: [
      {
        id: 'inclusive-comparison',
        when: (got, w) => {
          const ids = asStringList(got)
          return ids !== null && sameMembers(ids, idsAtOrOver(w))
        },
        say: "So close. E5 weighs exactly 5.0 kg, and Mira asked for parcels *over* 5 kilos — not 5 and over. Check whether you used `>=` where you wanted `>`.",
      },
      {
        id: 'returned-weights',
        when: (got) =>
          Array.isArray(got) && got.length > 0 && got.every((x) => asNumber(x) !== null),
        say: 'Those are the weights. Mira needs the parcel *ids* — that is `parcel[0]`, not `parcel[1]`.',
      },
      {
        id: 'returned-tuples',
        when: (got) =>
          Array.isArray(got) &&
          got.length > 0 &&
          got.every((x) => typeof x === 'object' && x !== null && '__tuple' in x),
        say: 'You returned the whole parcels. Mira only wants the ids — pull `parcel[0]` out before appending.',
      },
      {
        id: 'returned-none',
        when: (got) => got === null,
        say: 'The robot got `None`. That usually means `respond` ran to the end without hitting a `return` — check that `return heavy` is inside the function but outside the loop.',
      },
      {
        id: 'empty',
        when: (got) => Array.isArray(got) && got.length === 0,
        say: 'The robot found nothing. The loop ran, but nothing was ever appended — is the `if` comparing the weight, `parcel[1]`, against the limit?',
      },
      {
        id: 'everything',
        when: (got, w) => {
          const ids = asStringList(got)
          return ids !== null && ids.length === w.parcels.length
        },
        say: 'That is every parcel. The loop is appending without checking — the `if` needs to decide whether each one is over the limit.',
      },
    ],
  },
}
