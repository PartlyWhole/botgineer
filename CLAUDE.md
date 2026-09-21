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
| `src/panels/MemoryPanel.tsx` | (C) two clouds and the pull-out stage; owns the FLIP |
| `src/panels/Cloud.tsx` | a draggable cloud of pills; writes transforms straight to the DOM in the animation loop, never through React |
| `src/panels/cloudLayout.ts` | row packing. Pure and unit-tested. Read its header before changing it: relaxation and spiral packing were both tried and both measurably failed |
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
4. **Identity is the engine's to give.** `reference` objects get a badge;
   `value` objects never do. Values are keyed by type+value so two `10`s
   are one entry, and the UI must never invite an `is` comparison on them.
   This runs all the way through the wording: a collection *holds values*
   and *points at objects*, and a value object is "used by" its holders
   rather than "pointed at by" them. A pointer points at an identity, and
   value objects deliberately have none.
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
11. **Cloud layout is decided by `pack`, not by the animation.**
   `pack` sets targets and `advance` eases toward them, so correctness
   never depends on a frame rate. A dropped pill is `pinned` and keeps its
   place; a row's capacity is its widest free run, because a pinned pill
   splits the row.
12. **Tests run like production.** Playwright serves the built site at the
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
