# BotGineer (repo guide)

Static GitHub Pages site: a Python learning game. Real CPython 3.14 runs in
a Web Worker via PyTrace + Pyodide. Deploys as a **project site**
(`https://partlywhole.github.io/botgineer/`) — the sub-path is load-bearing.

Design of record: [docs/DESIGN.md](docs/DESIGN.md).

**The one idea: one snapshot, several views.** The worker produces records;
`memory/extract.ts` turns the current one into a `MemorySnapshot`; the
scene and the memory graph are both views of it; the robot panel is the
only thing that causes anything.

Two panels on screen: **Scene** and **Robot**. Memory is a view *of* the
robot panel (`Talk | Memory`, or `Code | Memory` once the editor is
unlocked), not a panel of its own. Keep the chrome thin — no tabs, no
readiness badge (the shell carries `data-boot`), no panel notes or briefs.

**The beginner gets a console, not an editor.** An activity declares
`mode: 'console' | 'editor'`. The console is one line at a time, and it is
where the game starts; the editor is what a later activity unlocks. They
are not two engines — see invariant 7.

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
| `src/repl/program.ts` | the console's program builder: expression-or-statement, continuation, and the replay that makes a line-at-a-time session possible. Pure and unit-tested |
| `src/ui/RobotConsole.tsx` | the console. Owns the caret and the input history and nothing else; it cannot run anything |
| `content/lessons.ts` | guided lessons. A step's progress is **derived from the snapshot**, never stored |
| `src/app/console.css` | console and speech-bubble styling, deliberately separate from `styles.css` |
| `src/scene/spec.ts` | a scene is data, and a view of memory: watches map global names to visual effects |
| `src/panels/ScenePanel.tsx` | (A) the situation, drawn from the snapshot |
| `src/panels/RobotPanel.tsx` | (B) the Code/Memory views + Run/Stop + step slider + transcript. Both views stay mounted; the hidden one reports zero size, which every measurement has to guard against |
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
7. **Whoever holds the text owns the program.** In the editor that is
   `editorRef.read()`, never React state — state may lag a tick behind
   what is on screen, and a run of the previous program is a silent wrong
   answer. In the console it is the accepted history.

   **The console is replay.** The engine has one entry point, `run({
   source })`, and no way to exec into a namespace that persists, so every
   submission re-runs the whole accepted history plus the new line. Three
   consequences, all load-bearing:
   - A line that does not complete is **not** appended. The history only
     holds lines that worked, which is what makes replaying it safe.
   - Output cannot be attributed by line number: a step carries the output
     produced *before* it, so the pending line's first step arrives holding
     the previous line's text. Attribute by **prefix** instead — this run's
     output begins with the last one's, and the remainder is the new line's.
     A nondeterministic line breaks the prefix, and showing everything is
     the honest fallback.
   - The history *is* a program, so unlocking the editor hands the player
     what they have been writing. Do not build a second artifact for it.

14. **A bare expression is kept alive on purpose.** `>>> 10` evaluates an
   object that CPython collects immediately, so it would never reach a
   trace. The console compiles it to an append into a hidden list
   (`KEEPER`, in `repl/program`); the extractor hides the list and shows
   its contents as objects with no name and no holder. The stated cost:
   real Python would have thrown these away. The lesson it buys is that an
   object needs no *name*, not that it needs no reference. `None` is
   skipped at both ends, so `print(...)` keeps nothing and echoes nothing.

15. **A lesson's progress is derived, never stored.** It is the first step
   whose test the snapshot fails. That is why the guide cannot disagree
   with the robot, why replay makes progress monotonic for free, and why
   scrubbing walks the guide backwards. A step whose test cannot be
   answered from memory alone is a paragraph, not a step.
8. **The scene causes nothing.** It declares watches and renders the
   snapshot. No scene code may call into a run or hold state of its own.
9. **Decode partially, fail cleanly.** Unsupported kinds and
   budget-elided values are marked `partial` and said so, never shown as
   complete.
10. **`window.botgineer` is the test surface.** Browser tests drive
   `setProgram`/`getProgram`/`run`/`say`/`snapshot`/`state` rather than
   typing into a contenteditable. Keep the shape stable. Readiness is
   `.app[data-boot="ready"]`, not a visible badge. The editor journeys run
   against an activity that still has an editor (`EDITOR` in the spec),
   because the starting activity is a console.
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
