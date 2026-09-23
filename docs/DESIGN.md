# BotGineer — design

**Status:** design of record.
**Shape:** a Python runtime in a worker, and three panels over one snapshot.

---

## 1. The one idea

> **One snapshot, three panels.**

A worker runs real CPython and reports a complete snapshot at every line.
Exactly one module turns that into the app's memory model. Everything else
is a *view* of that model:

```
┌─ Web Worker ──────────────┐          ┌─ Main thread ─────────────────────┐
│  PyTrace + CPython 3.14   │ records  │  memory/extract  ── snapshot ──┐  │
│  Pyodide 314, self-hosted │ ───────► │                                │  │
└───────────────────────────┘          │   (A) scene ◄──────────────────┤  │
        ▲                              │   (B) robot ── causes it ──────┤  │
        │  run(source, options)        │       └ memory, below ◄────────┘  │
        └──────────────────────────────┴───────────────────────────────────┘
```

Only **(B)** causes anything. The scene and the memory view render what it
produced, from the same data, so they cannot disagree — and the step slider
moves all of them together, so scrubbing rewinds the picture as well as the
diagram.

**Two panels, not three.** Memory is a *view* of the robot panel, switched
with Code. As a third panel it competed with the editor for height until
both were strips, and the code and the memory it produced are the same
subject anyway. Both views stay mounted, so switching back does not throw
away where the graph's nodes had settled.

**The chrome is deliberately thin.** No tabs (the sandbox is the starting
point; the other activities are reachable by hash and advertised nowhere),
no readiness badge — the runtime's state is a data attribute, because a
working runtime announcing that it works is noise, and failure still gets
an alert — and no panel descriptions, briefs or editor hints.

## 2. The memory model

Two collections, and that is the whole structure.

```ts
Binding  = { name, scope, target: ObjectId }
PyObject = { id, type, kind, repr, elements: Element[] | null, partial }
Element  = { label: string | null, target: ObjectId }   // a POINTER
```

- **Names** bind to objects.
- **Objects** have an id, a type and a value.
- **Collections** hold pointers to other objects, never copies. A list's
  elements are labelled by index, a dict's by key, a set's not at all
  because position means nothing there.
- `elements: null` means *not a collection*, which is different from
  `elements: []`, an empty one.

`extract.ts` is the only module that knows both this and the wire format.
Change the engine and one file moves.

### 2.1 Everything is an object; every slot is a pointer

`['x', 'y']` is not a box with two letters in it. It is a list holding two
pointers, each leading to a `str` object whose value happens to be one
character. The panel shows `[obj7, obj8]`, because that is the model
Python has — and a diagram that inlines literals into their container
draws a different, wrong one.

So every object gets a **handle** (`obj1`, `obj2`, …), primitives
included. Handles are assigned on first sight and kept for the whole run:
numbering each snapshot afresh renumbers objects as you scrub, and a
handle that moves is worse than no handle.

| | keyed by | shown as |
|---|---|---|
| **value** — int, float, str, bool, None | type + value | green pill |
| **reference** — list, dict, set, instance, … | the engine's uid | amber pill |

Two `10`s are one object with one handle, which is what CPython does for
an interned value and what makes *"these two names point at the same
thing"* visible. Two equal lists are two objects, because they are.

**The cost, stated plainly:** two equal values CPython did *not* intern are
shown as one object when they are really two. The engine does not say
which, so the model cannot tell. Do not build an `is`-on-scalars lesson on
top of this without changing the keying first.

## 3. The panels

### (A) Scene — `src/panels/ScenePanel.tsx`, `src/scene/spec.ts`

A scene is **data**, and it is a *view of memory*. It holds no state and
receives no commands. It declares which global names it watches and what
each one drives:

| effect | reads | does |
|---|---|---|
| `lit` | truthiness | lights a lamp |
| `caption` | the value | writes a sign |
| `level` | a number, 0..max | fills a gauge |
| `pick` | a collection of strings | lifts the actors it names |

A watched name that is not bound yet is **said out loud** ("the lamp is
waiting for `power`") rather than leaving the scene inert and unexplained.

Scenes are disjoint by design: an activity brings its own, and nothing
assumes a continuous world.

One deliberate asymmetry: a sign shows a string's *text*, while the memory
panel shows its *repr*. The scene shows the world; the memory panel shows
the representation. Binding a non-string to a sign shows its repr, so a
type mistake stays visible instead of being coerced away.

### (B) Robot — `src/panels/RobotPanel.tsx`

The only panel that causes anything: a CodeMirror editor (Python syntax,
Tab/Shift-Tab indent, `Mod-/` comment, Escape to leave), Run and Stop, the
step slider that moves all three panels, and a transcript of what the
program printed.

**What runs is read from the editor's live document**, never from React
state — the editor owns the text, and asking React for it runs whatever was
last rendered.

### (C) Memory — `src/panels/MemoryGraph.tsx`, `src/panels/graphLayout.ts`

**One grid, and no second view.** Memory is drawn the way Python Tutor
draws frames and heap:

- **Names** form one column on the left, in the order they were first
  made. A function's locals follow the globals, after a gap.
- Each name's **object** starts a row beside it. A collection's
  **elements** follow in the next column, in index order, one row each,
  and their own elements after them: a tree read left to right.
- An object already drawn is **not drawn again**. A second name or slot
  that points at it gets an arrow to where it already is, so aliasing reads
  as two arrows converging on one card. An arrow into something to its
  left loops round into that card's right edge, which is how "this was
  already here" looks different from "this is new".

Placement is a pure function of memory and first-seen order, so the same
memory always draws the same way and a new line only ever *adds* rows. The
component tweens cards to their places, about a quarter of a second, and
fades newcomers in where they belong.

Picking a node does not open a panel. The **camera** flies to frame that
node *together with everything it is connected to*, the node grows in
place, its arrows light up and are labelled with the index or key, and
everything else dims without moving. Clicking a neighbour re-picks it,
so the structure is walked. Escape or a press on the background returns
to the overview.

The overview is anchored top left, like a page, at a zoom that depends
only on the pane's width. A memory taller than the pane scrolls rather
than shrinking to fit.

Two layers share one camera transform: SVG for the arrows, DOM for the
cards. Text stays real text, so it is selectable and reachable by a screen
reader, while the arrows get to be SVG. The animation loop writes
`transform` straight to the elements; React renders the graph's *shape*
and is never asked to render its motion.

#### Why it is not a force layout any more

It was one, and it was the most complained-about thing on screen. Every
console line replays the whole program, so memory arrived from nothing one
step at a time and each step re-energised the field. Over an eight-line
session, nodes landed up to 378px from where they had been; one added line
moved existing nodes by up to 160px and took five seconds to settle. It
knew nothing about order, so crossings grew with memory, twelve on the
test fixture. Three things fixed it, and all three are needed:

1. **The grid keeps its mounted state.** It stays mounted when memory is
   empty.
2. **The console holds the picture during a replay.** It shows the last
   accepted memory until the replay finishes.
3. **The camera never moves on its own.** It neither centres nor zooms to
   fit, either of which moves every card whenever memory grows.

What was given up: dragging, and the organic look.

### The roadmap — `src/roadmap/`, `content/roadmap.ts`, `src/progress/`

The game opens on a **map**, not in a level: one winding path of round
buttons, in the visual language Duolingo made familiar. Levels are grouped
into **units**, each a coloured stretch of path under a sticky banner, with
a trophy at its end and one of the cast idling beside it — the same SVG
and CSS as in the levels, so the map and the levels are one world.

- **What a level's state is** (done, the one to play next, locked) is
  derived from a set of finished level ids and the roadmap's order. That
  set is the only thing the app stores, in localStorage, because it is a
  fact about the player that must outlive the page and there are no
  accounts.
- **The current level** wears a ring and a bobbing "Start"; the map opens
  scrolled to it. Clicking any level opens a card with its title, brief
  and a Start (or Play again) button; a locked one says what unlocks it.
- **On a wide screen** an "Up next" card sits beside the path with a
  Continue button and a progress bar across every level.
- **Locks do not block deep links.** A level's hash always opens it.

Inside a level, the top bar names it and offers the way back to the map.
Finishing a level offers `Continue`, which returns to the map: the level
just finished pops with a burst of stars, the one it unlocked turns from
grey to its colour and its "Start" arrives, and a trophy just earned
lifts — in that order, so the eye follows the path down.

## 4. Execution

One session per page, booted once from a module-level promise. Run
executes the whole editor document fresh: memory belongs to a run, which is
what Python actually does.

Rules that are not negotiable:

- **Never render inside `onRecord`.** Steps push to a ref; a
  `requestAnimationFrame` pump renders the latest and flushes queued output
  at most once per frame.
- **Every run reaches a terminal state on every path** — success, throw,
  interrupt. A run that never ends wedges every control.
- **Reject a concurrent run before resetting per-run state**, or the
  rejection clobbers the live run's records.
- **`max_steps` bounds a runaway, not `wall_clock_s`.** The wall clock is a
  main-thread timer and a page busy rendering records can starve it.
  Per-step cost scales with the reachable heap, so a bigger budget makes an
  endless loop feel like a hang.

## 5. Hosting

| Concern | Decision |
|---|---|
| Base path | `VITE_BASE=/botgineer/`, from the repo name in CI |
| URLs | relative or `import.meta.env.BASE_URL`-derived, never root-absolute |
| Routing | hash — Pages has no rewrite rules |
| Isolation | `coi-serviceworker`; `?nonisolated` opts into degraded mode |
| Capability UI | driven by `header.host.capabilities`, never a guess |
| Runtime | self-hosted; COEP `require-corp` forbids CDN fetches anyway |

## 6. What was retired in this revamp

The scenario/grader/contract machinery, the two separate screens, and the
two ad-hoc memory renderings (a names table on one screen, object tiles on
the other). They did not build on the new base: both screens had their own
idea of what memory was, and neither was the model above.

It is all in git history. **Grading should return as a layer over this
model, not as a parallel structure** — a contract asserting things about a
snapshot, checked by the same "the interpreter is the answer key" rule that
the old semantic tests used.

## 7. Testing

- `tests/unit/extract.test.ts` — the one translation, against synthetic
  wire data: aliasing, value identity, cycles, frames, elision, opacity.
- `tests/unit/scene.test.ts` — given what is bound, what does the picture
  show.
- `tests/browser/workbench.spec.ts` — the three panels against **real
  Python** in the production build, served at the sub-path with no
  isolation headers, exactly as Pages serves it.

The browser suite is where "the interpreter is the answer key" now lives:
it asserts that `a = 10; b = a` really share a target and that `[1]` and
`[1]` really do not, by running them.

## 8. Known gaps

- **Three activities, no grading.** Nothing checks whether the player did
  the thing; the scene simply reflects memory. That is honest for a
  prototype and is the next decision.
- **A runaway loop takes ~a minute to stop.** Bounded, not instant. The
  real fix is a worker-side budget.
- **No accounts, no saving, no i18n.** Work lives in the tab.
- **Not tamper-proof.** A static site ships everything it knows.
- **Not piloted with a learner.** Every claim here is a product check.
