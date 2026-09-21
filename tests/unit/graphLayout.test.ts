/**
 * The graph layout. Its promises are listed in the module header, and
 * these tests are exactly those promises — in particular that it *stops*,
 * which an earlier relaxation in this repo did not.
 */
import { describe, expect, it } from 'vitest'
import {
  ALPHA_REST,
  approach,
  cameraDistance,
  distance,
  disturb,
  frame,
  isFinitePosition,
  laneX,
  makeNode,
  MAX_K,
  MIN_K,
  neighboursOf,
  seed,
  settle,
  tick,
  toWorld,
  transformOf,
  type Graph,
  type GraphEdge,
} from '../../src/panels/graphLayout'

const V = { w: 900, h: 420 }

/** `a, b → xs` plus a couple of loose objects, which is the shape of a
 *  real snapshot: a few names, a few objects, some sharing. */
function sample(): Graph {
  const nodes = [
    makeNode('n:a', 'name', 46, 26),
    makeNode('n:b', 'name', 46, 26),
    makeNode('n:xs', 'name', 52, 26),
    makeNode('o:1', 'object', 104, 26),
    makeNode('o:2', 'object', 96, 26),
    makeNode('v:int:10', 'object', 78, 26),
  ]
  const edges: GraphEdge[] = [
    { from: 'n:a', to: 'v:int:10', label: null },
    { from: 'n:b', to: 'v:int:10', label: null },
    { from: 'n:xs', to: 'o:1', label: null },
    { from: 'o:1', to: 'o:2', label: '0' },
    { from: 'o:2', to: 'v:int:10', label: '0' },
  ]
  const graph: Graph = { nodes, edges, alpha: 1 }
  seed(graph, V)
  return graph
}

const byId = (g: Graph, id: string) => g.nodes.find((n) => n.id === id)!

describe('it stops', () => {
  it('runs alpha down to nothing', () => {
    const g = sample()
    const ticks = settle(g, V)
    expect(g.alpha).toBe(0)
    expect(ticks).toBeLessThan(600)
  })

  it('stops moving once it has stopped', () => {
    const g = sample()
    settle(g, V)
    const before = g.nodes.map((n) => [n.x, n.y])
    for (let i = 0; i < 50; i++) tick(g, V)
    const after = g.nodes.map((n) => [n.x, n.y])
    // Collision is still live at rest, so allow a hair of movement — but
    // nothing that reads as drift or jitter.
    after.forEach((p, i) => {
      expect(Math.abs(p[0]! - before[i]![0]!)).toBeLessThan(0.5)
      expect(Math.abs(p[1]! - before[i]![1]!)).toBeLessThan(0.5)
    })
  })

  it('can be woken up and settles again', () => {
    const g = sample()
    settle(g, V)
    disturb(g)
    expect(g.alpha).toBeGreaterThan(ALPHA_REST)
    settle(g, V)
    expect(g.alpha).toBe(0)
  })
})

describe('it never produces nonsense', () => {
  it('survives every node starting on the same spot', () => {
    const g = sample()
    for (const n of g.nodes) {
      n.x = 100
      n.y = 100
    }
    settle(g, V)
    expect(g.nodes.every(isFinitePosition)).toBe(true)
  })

  it('survives a zero-size viewport', () => {
    const g = sample()
    seed(g, { w: 0, h: 0 })
    settle(g, { w: 0, h: 0 })
    expect(g.nodes.every(isFinitePosition)).toBe(true)
  })

  it('survives an edge pointing at a node that is not there', () => {
    const g = sample()
    g.edges.push({ from: 'n:a', to: 'missing', label: null })
    settle(g, V)
    expect(g.nodes.every(isFinitePosition)).toBe(true)
  })

  it('survives a self-referential collection', () => {
    const g = sample()
    g.edges.push({ from: 'o:1', to: 'o:1', label: '0' })
    settle(g, V)
    expect(g.nodes.every(isFinitePosition)).toBe(true)
  })

  it('survives a graph with one node and no edges', () => {
    const g: Graph = { nodes: [makeNode('only', 'name')], edges: [], alpha: 1 }
    seed(g, V)
    settle(g, V)
    expect(isFinitePosition(g.nodes[0]!)).toBe(true)
  })
})

describe('the arrangement means something', () => {
  it('puts names left of objects', () => {
    const g = sample()
    settle(g, V)
    const names = g.nodes.filter((n) => n.kind === 'name')
    const objects = g.nodes.filter((n) => n.kind === 'object')
    const avg = (ns: typeof names) => ns.reduce((t, n) => t + n.x, 0) / ns.length
    expect(avg(names)).toBeLessThan(avg(objects))
  })

  it('draws connected nodes closer than unconnected ones, on average', () => {
    // On average, and not pairwise: a hub with several name edges sits in
    // among the names, so an unrelated name can legitimately end up
    // nearer to it than its own object does. A force layout does not
    // promise otherwise, and asserting it pairwise was asserting a
    // property this has never had.
    const g = sample()
    settle(g, V)
    const adjacent = new Set(g.edges.flatMap((e) => [`${e.from}|${e.to}`, `${e.to}|${e.from}`]))
    const linked: number[] = []
    const unlinked: number[] = []
    for (let i = 0; i < g.nodes.length; i++) {
      for (let j = i + 1; j < g.nodes.length; j++) {
        const a = g.nodes[i]!
        const b = g.nodes[j]!
        ;(adjacent.has(`${a.id}|${b.id}`) ? linked : unlinked).push(distance(a, b))
      }
    }
    const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length
    expect(mean(linked) / mean(unlinked)).toBeLessThan(0.9)
  })

  it('puts two names that share an object on the same side of it', () => {
    const g = sample()
    settle(g, V)
    const shared = byId(g, 'v:int:10')
    const a = distance(byId(g, 'n:a'), shared)
    const b = distance(byId(g, 'n:b'), shared)
    // Neither name is parked much further from the object than the other.
    expect(Math.abs(a - b)).toBeLessThan(220)
  })

  it('lays the same graph out the same way twice', () => {
    const one = sample()
    const two = sample()
    settle(one, V)
    settle(two, V)
    expect(one.nodes.map((n) => [Math.round(n.x), Math.round(n.y)])).toEqual(
      two.nodes.map((n) => [Math.round(n.x), Math.round(n.y)]),
    )
  })

  it('does not depend on the order the nodes arrive in', () => {
    const one = sample()
    const two = sample()
    two.nodes.reverse()
    seed(two, V)
    settle(one, V)
    settle(two, V)
    const place = (g: Graph) =>
      [...g.nodes]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((n) => `${n.id}@${Math.round(n.x / 20)},${Math.round(n.y / 20)}`)
    expect(place(two)).toEqual(place(one))
  })
})

describe('dragging', () => {
  it('leaves a held node exactly where the pointer put it', () => {
    const g = sample()
    settle(g, V)
    const held = byId(g, 'n:xs')
    held.fixed = true
    held.x = 700
    held.y = 60
    disturb(g)
    settle(g, V)
    expect([held.x, held.y]).toEqual([700, 60])
  })

  it('drags its neighbours along with it', () => {
    const g = sample()
    settle(g, V)
    const held = byId(g, 'n:xs')
    const neighbour = byId(g, 'o:1')
    const wasAt = { x: neighbour.x, y: neighbour.y }

    // Somewhere that is definitely far from where it was, rather than a
    // direction that happens to move it *towards* its neighbour.
    held.fixed = true
    held.x = V.w - 30
    held.y = V.h - 30
    const stretched = distance(held, neighbour)
    disturb(g)
    settle(g, V)

    // The neighbour followed, and ended nearer than the stretch left it.
    expect(distance(held, neighbour)).toBeLessThan(stretched)
    expect(Math.hypot(neighbour.x - wasAt.x, neighbour.y - wasAt.y)).toBeGreaterThan(30)
  })

  it('moves an unconnected node less than a connected one', () => {
    const g = sample()
    settle(g, V)
    const unconnected = byId(g, 'n:a')
    const connected = byId(g, 'o:1')
    const wasU = { x: unconnected.x, y: unconnected.y }
    const wasC = { x: connected.x, y: connected.y }

    const held = byId(g, 'n:xs')
    held.fixed = true
    held.x = V.w - 30
    held.y = V.h - 30
    disturb(g)
    settle(g, V)

    const moved = (n: { x: number; y: number }, was: { x: number; y: number }) =>
      Math.hypot(n.x - was.x, n.y - was.y)
    expect(moved(connected, wasC)).toBeGreaterThan(moved(unconnected, wasU))
  })
})

describe('the camera', () => {
  it('frames a node and its neighbours, not the node alone', () => {
    const g = sample()
    settle(g, V)
    const node = byId(g, 'n:xs')
    const alone = frame([node], V)
    const withNeighbours = frame([node, ...neighboursOf(g, 'n:xs')], V)
    // Framing more must not zoom in further than framing less.
    expect(withNeighbours.k).toBeLessThanOrEqual(alone.k)
  })

  it('keeps zoom inside its limits', () => {
    const g = sample()
    settle(g, V)
    const tight = frame([byId(g, 'n:a')], V)
    const everything = frame(g.nodes, V, 400)
    expect(tight.k).toBeLessThanOrEqual(MAX_K)
    expect(everything.k).toBeGreaterThanOrEqual(MIN_K)
  })

  it('handles being asked to frame nothing', () => {
    const c = frame([], V)
    expect(Number.isFinite(c.x)).toBe(true)
    expect(Number.isFinite(c.k)).toBe(true)
  })

  it('eases to its target and arrives', () => {
    let c = { x: 0, y: 0, k: 1 }
    const target = { x: 400, y: 200, k: 1.8 }
    for (let i = 0; i < 200; i++) c = approach(c, target)
    expect(cameraDistance(c, target, V)).toBeLessThan(0.5)
  })

  it('round-trips a viewport point through the world', () => {
    const c = { x: 300, y: 150, k: 1.4 }
    // The viewport centre is, by definition, the camera's world point.
    expect(toWorld(V.w / 2, V.h / 2, c, V)).toEqual({ x: 300, y: 150 })
    const p = toWorld(100, 50, c, V)
    expect(p.x).toBeCloseTo(300 + (100 - V.w / 2) / 1.4, 6)
  })

  it('writes a transform both layers can share', () => {
    const t = transformOf({ x: 100, y: 50, k: 2 }, V)
    expect(t).toContain('scale(2)')
    expect(t).toContain(`translate(${V.w / 2}px, ${V.h / 2}px)`)
  })
})

describe('lanes', () => {
  it('puts the two clouds in different places', () => {
    expect(laneX('name', V)).toBeLessThan(laneX('object', V))
  })

  it('scales with the viewport rather than using fixed pixels', () => {
    const wide = { w: 1800, h: 420 }
    expect(laneX('object', wide)).toBeGreaterThan(laneX('object', V))
  })
})
