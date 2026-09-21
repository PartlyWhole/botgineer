# BotGineer

**<https://partlywhole.github.io/botgineer/>**

Learn Python by programming a robot. You write code; the robot runs it; the
scene and the memory diagram are two views of what actually happened.

Every value is built by **real CPython 3.14** running in a Web Worker in
your browser. Nothing is a drawing of what Python would do — it is a
rendering of what it did. No accounts, no backend, nothing leaves the page.

## The one idea

**One snapshot, three panels.**

```
┌─ Web Worker ──────────────┐          ┌─ Main thread ─────────────────────┐
│  PyTrace + CPython 3.14   │ records  │  memory/extract  ── snapshot ──┐  │
│  Pyodide 314, self-hosted │ ───────► │                                │  │
└───────────────────────────┘          │   (A) scene ◄──────────────────┤  │
        ▲                              │   (C) memory ◄─────────────────┘  │
        │  run(source, options)        │   (B) robot ── causes it ─────────┤
        └──────────────────────────────┴───────────────────────────────────┘
```

- **(A) Scene** — the situation. A scene is *data*: it declares which names
  it watches, and renders whatever they are bound to. It holds no state and
  takes no commands, so it cannot show something the program did not do.
- **(B) Robot** — where you write the robot's instructions. The only panel
  that causes anything. Also the transport: Run, Stop, and a step slider.
- **Memory** — a *view* of the robot panel, not a panel of its own. One
  live field: names and objects are nodes, bindings and pointers are
  edges; names drift left and objects right, so the two collections read
  as two clouds in one space. Drag a node and its neighbours follow. Pick
  one and the *camera* flies to frame it with everything it touches, its
  edges light up and get labelled, and the rest steps back — zooming in is
  the detail view, so you never lose sight of where the thing sits. Click
  a neighbour to walk the structure; Escape zooms back out.

Because both views read the same snapshot, the step slider rewinds the
scene as well as the diagram.

## The memory model

```
names    bind to objects
objects  have an id, a type and a value
         collections hold POINTERS to other objects, not copies
```

Objects come in two flavours, and they look different because they are:

| | keyed by | identity badge |
|---|---|---|
| **value** — int, float, str, bool, None | type + value | no |
| **reference** — list, dict, set, … | the engine's own id | yes, `#1` |

Two `10`s are one entry, because for an immutable that is all Python lets
you observe. Two equal lists are two entries, because they really are two.
Values carry no badge, and that absence is deliberate: CPython interns
small ints, so a badge there would teach a lie about `is`.

## Run it

```bash
npm install
npm run dev
```

First load downloads about 13 MB of Python runtime; after that it is cached.

## Check it

```bash
npm run typecheck
npm run test          # 74 unit tests
npm run test:browser  # 18 journeys against the production build
```

`npm run test:browser` builds the site, serves it at a repository sub-path
with **no** isolation headers — exactly how GitHub Pages serves it — and
drives it in Chromium against real Python: the scene reacting to bound
names, aliasing versus equal-but-distinct objects, walking pointers,
self-referential collections, scrubbing rewinding all three panels, and
errors leaving the page usable.

## Publish it

Nothing assumes a particular owner or repository; both come from wherever
the workflow runs. Set **Settings → Pages → Source** to **GitHub Actions**
and push to `main`. The workflow type-checks, tests, builds at the repo
sub-path, runs the browser journeys against that build, publishes, and
smoke-tests the published URL.

## What this release is not

- **Three activities, and no grading.** Nothing checks whether you did the
  thing; the scene simply reflects memory. Grading should return as a layer
  over the memory model, not as a parallel structure.
- **No accounts, no saving, no teacher dashboard.** Work lives in this tab.
- **Not tamper-proof.** A static site ships everything it knows.
- **Not a security boundary.** The worker keeps the page responsive; it
  does not sandbox hostile code.
- **Not yet piloted with a learner.** Every claim here is a product check.

## Known limits

- A run is bounded by its step budget (2,000–3,000 per activity).
  **A runaway loop is slow to stop, not instant** — every step serializes
  the whole reachable heap. Stop is available throughout.
- The value decoder is deliberately partial; anything it cannot model is
  marked as such rather than shown as complete.
- Live `input()` needs cross-origin isolation, supplied by the
  service-worker shim. `?nonisolated` opts into the engine's degraded mode.
- Browser journeys run in Chromium only.

## Credits

Built on **PyTrace** (`trace-engine/1`) and **Pyodide** 314.0.2. The
integration rules this repo follows are distilled from the Engine Pilot
frontend integration guide. The memory model's two-collection shape follows
PLP and Python Tutor.
