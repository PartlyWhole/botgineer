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
        │  run(source, options)        │       └ Code | Memory ◄────────┘  │
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

**One live field, and no second view.** Names and objects are nodes;
bindings and pointers are edges. Names are pulled gently left, objects
gently right, so the two collections read as two clouds without being two
containers — the pieces are all in one space and they move in response to
each other. Drag one and its neighbours follow; drop it and it stays,
while the field arranges around it (`loosen` hands everything back).

Picking a node does not open a panel. The **camera** flies to frame that
node *together with everything it is connected to*, the node grows in
place, its edges light up and are labelled with the index or key, and
everything else steps back without moving. Zooming in *is* the detail
view, which is the whole point: the previous design replaced the clouds
with a separate stage, so you lost sight of where the thing you picked sat
in them at exactly the moment you wanted to see it.

Clicking a neighbour re-picks it, so the structure is walked. Escape or a
press on the background zooms back out. One line of text under the field
summarises the selection — *how many* things point at it, which a picture
of a hub is bad at — and that is the only prose.

Two layers share one camera transform: SVG for the edges, DOM for the
pills. Text stays real text, so it is selectable and reachable by a screen
reader, while the arrows get to be SVG. The animation loop writes
`transform` straight to the elements; React renders the graph's *shape*
and is never asked to render its motion.

#### Why this one settles

A force layout's rules genuinely disagree — springs pull together,
repulsion pushes apart, lanes pull sideways. An earlier relaxation in this
repo oscillated forever for exactly that reason, so convergence here is
**structural rather than negotiated**: everything that can inject energy
is scaled by `alpha`, and `alpha` decays to nothing. Whatever the forces
want, the system stops. Collision is the exception — positional, never
scaled — so pile-ups still resolve at rest without adding energy.

What it promises: it settles, it never produces NaN, names end left of
objects, connected nodes end nearer each other **on average**, and the
same graph lays out the same way twice regardless of enumeration order.

What it does not promise: pairwise proximity. A hub with several name
edges sits in among the names, so an unrelated name can legitimately end
up nearer it than its own object does — asserting otherwise was asserting
a property a force layout has never had.

Two numbers were measured rather than guessed. Spring strength: with
weaker springs the lanes won and connectivity stopped showing at all
(mean edge length 0.88 of mean non-edge length, barely a signal); the
current values give 0.82 while leaving the clouds ~165px apart. And the
spring's rest length is a clearance between node *edges*, not centres — a
fixed centre distance put a wide node's neighbours inside it, hiding the
very connection picking it was meant to reveal.

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
