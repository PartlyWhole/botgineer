# BotGineer (repo guide)

Static GitHub Pages site: a Python learning game. Real CPython 3.14 runs in
a Web Worker via PyTrace + Pyodide. Deploys as a **project site**
(`https://partlywhole.github.io/botgineer/`) — the sub-path is load-bearing.

Design of record: [docs/DESIGN.md](docs/DESIGN.md).

**The one idea: one snapshot, three panels.** The worker produces records;
`memory/extract.ts` turns the current one into a `MemorySnapshot`; the
scene and the memory panel are both views of it; the robot panel is the
only thing that causes anything.

## Commands

```sh
npm run dev           # vite, base '/'
npm run typecheck
npm run test          # unit tests (node)
npm run test:browser  # playwright against the PRODUCTION build at /botgineer/
```

## Layout

| Path | What |
|---|---|
| `src/runtime/types.ts` | `trace-engine/1` wire format. Four record kinds: header, step, diagnostic, terminal. **No console record** — output arrives as `stdout_delta`/`stderr_delta` on each step |
| `src/runtime/session.ts` | typed wrapper over the vendored facade; owns the one-run-at-a-time guard |
| `src/runtime/shared.ts` | the one session for the page; boot is a module-level promise so React's dev double-invoke cannot start two |
| `src/runtime/decode.ts` | tagged values → comparable JS; deliberately partial |
| `src/memory/model.ts` | **the canonical model**: names bind to objects; objects have id/type/value; collections hold pointers |
| `src/memory/extract.ts` | the ONLY module that knows both the wire format and the model |
| `src/scene/spec.ts` | a scene is data, and a view of memory: watches map global names to visual effects |
| `src/panels/ScenePanel.tsx` | (A) the situation, drawn from the snapshot |
| `src/panels/RobotPanel.tsx` | (B) editor + Run/Stop + step slider + transcript |
| `src/panels/MemoryPanel.tsx` | (C) thin: owns the handles, the selection, and one caption line |
| `src/panels/MemoryGraph.tsx` | the live field. SVG edges + DOM pills sharing one camera; writes transforms straight to the elements in the animation loop, never through React |
| `src/panels/graphLayout.ts` | the force simulation and the camera. Pure and unit-tested. Read its header before changing it: relaxation, spiral packing and row packing were all tried here and the reasons each was dropped are measured, not remembered |
| `src/ui/CodeEditor.tsx` | CodeMirror; `head`/`tail` optionally lock regions (unused by the workbench) |
| `src/ui/Split.tsx` | draggable, keyboard-operable gutters; sizes remembered in localStorage |
| `src/app/Workbench.tsx` | the wiring: owns the run, the steps, the index, the snapshot |
| `content/activities/` | the activities: brief, scene, starter |
| `public/runtime/pytrace/` | vendored engine. `browser/worker.mjs` is **patched** to resolve Pyodide relative to itself (`../../pyodide/`) so it works under a sub-path |
| `public/runtime/pyodide/` | copied from the pinned npm package at build time; gitignored |

## Load-bearing invariants

1. **Serving.** Every URL relative or `import.meta.env.BASE_URL`-derived,
   never root-absolute — root-absolute breaks under `/botgineer/`. No CDN
   fetches (COEP `require-corp`). `public/.nojekyll` must exist.
2. **One snapshot, three panels.** The scene and the memory panel read the
   same `MemorySnapshot`. Never give a panel its own parallel idea of what
   memory is — that is exactly what this revamp removed.
3. **`extract.ts` is the only translation.** No panel may import
   `runtime/types` to read a `StepRecord` directly.
4. **Everything is an object; every slot is a pointer.** Each object gets
   a handle (`obj1`, `obj2`, …), primitives included, and a collection's
   elements are pointers to handles: `['x', 'y']` shows as
   `[obj3, obj4]`. Never inline a literal into its container — that draws
   a model Python does not have, and it was the first thing to get
   corrected here.
   Handles are assigned on first sight and kept for the whole run
   (`useHandles`), because a handle that renumbers as you scrub is worse
   than no handle. `value` objects are keyed by type+value, so two `10`s
   are one object; `reference` objects are keyed by the engine's uid. The
   two still *look* different, because the difference is real. The stated
   cost: two equal values CPython did not intern show as one object, so
   do not build an `is`-on-scalars lesson on this without changing the
   keying.
5. **Runs.** Reject a concurrent run **before** resetting per-run state.
   **Every run reaches a terminal state on every path** — success, throw,
   interrupt. A run that never ends wedges every control.
6. **Never render inside `onRecord`.** Steps push to a ref; the rAF pump
   renders the latest and flushes queued output at most once per frame.
7. **The editor owns the program.** A run reads `editorRef.read()`, never
   React state — state may lag a tick behind what is on screen, and a run
   of the previous program is a silent wrong answer.
8. **The scene causes nothing.** It declares watches and renders the
   snapshot. No scene code may call into a run or hold state of its own.
9. **Decode partially, fail cleanly.** Unsupported kinds and
   budget-elided values are marked `partial` and said so, never shown as
   complete.
10. **`window.botgineer` is the test surface.** Browser tests drive
   `setProgram`/`getProgram`/`run`/`snapshot`/`state` rather than typing
   into a contenteditable. Keep the shape stable.
11. **The graph settles because `alpha` decays, not because the forces
   agree.** Anything that can inject energy is scaled by `alpha`;
   collision is positional and unscaled so it still works at rest. Do not
   add an unscaled force. A dropped node keeps `fixed` and the field packs
   around it. Spring rest length is a clearance between node *edges*, so
   a wide node never swallows its own neighbours. Sizes are re-measured
   when the selection changes, because the picked pill grows.
12. **Picking moves the camera, not the layout.** There is no second view:
   nodes stay where they are, the camera frames the picked node plus its
   neighbours, and unrelated nodes dim in place. Never replace the field
   with a detail panel — losing sight of the clouds is the thing this
   replaced.
13. **Tests run like production.** Playwright serves the built site at the
   sub-path with **no** isolation headers, so the `coi-serviceworker` path
   is what gets exercised. Do not add COOP/COEP to the test server.

## Engine facts that shape the UI

- An uncaught exception yields only a **type name**: the encoder never
  calls a user `__repr__`, so the exception object comes back `opaque`.
- `max_steps` (default 1000) and `wall_clock_s` (default 10) are set per
  activity. **`max_steps` is what actually bounds a runaway**:
  `wall_clock_s` is a main-thread timer and a page busy rendering records
  can starve it. Per-step cost scales with the reachable heap, so raising
  `max_steps` makes an endless loop feel like a hang.
- Live `input()` and cooperative interrupt need `crossOriginIsolated`.
  Drive capability UI from `header.host.capabilities`, never from a guess.
