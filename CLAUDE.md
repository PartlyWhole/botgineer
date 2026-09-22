# BotGineer (repo guide)

Static GitHub Pages site: a Python learning game. Real CPython 3.14 runs in
a Web Worker via PyTrace + Pyodide. Deploys as a **project site**
(`https://partlywhole.github.io/botgineer/`) — the sub-path is load-bearing.

Design of record: [docs/DESIGN.md](docs/DESIGN.md).

**The one idea: one snapshot, several views.** The worker produces records;
`memory/extract.ts` turns the current one into a `MemorySnapshot`; the
scene and the memory graph are both views of it; the robot panel is the
only thing that causes anything.

Two panels on screen: **Scene** and **Robot**. The robot panel is split:
the instrument on top (console, or editor once unlocked) and **memory
below it, always on screen**, with a draggable gutter between them. It
was a `Talk | Memory` switch once, which put the effect of an instruction
on the tab you were not looking at — and the moment a beginner most needs
to see an object appear is the moment they made it. Keep the chrome thin
— no tabs, no readiness badge (the shell carries `data-boot`), no panel
notes or briefs.

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
| `content/lessons.ts` | guided lessons. A step's progress is **derived from evidence**, never stored: the snapshot, what the robot thought, and memory after each accepted line |
| `src/app/console.css` | console and speech-bubble styling, deliberately separate from `styles.css` |
| `src/scene/spec.ts` | a scene is data, and a view of memory: watches map global names to visual effects |
| `src/panels/ScenePanel.tsx` | (A) the situation, drawn from the snapshot |
| `src/panels/RobotPanel.tsx` | (B) the instrument and memory, split by a gutter, + Run/Stop + step slider + transcript |
| `src/panels/MemoryPanel.tsx` | (C) thin: owns the selection; the graph does the rest |
| `src/memory/handles.ts` | `obj1`, `obj2`, … Owned by the workbench, so every view that shows a handle shows the same one |
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
2. **One snapshot, every view.** The scene and the memory graph read the
   same `MemorySnapshot`. Several *renderings* are fine; a second idea of
   what memory **is** is not, and removing one was the point of this
   revamp. A handle means the same object in every view, which is why
   `useHandles` lives above the panels.
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

8. **A bare expression is thought of and let go.** `>>> 10` evaluates an
   object nothing refers to, so it is collected when the line ends and it
   never reaches memory. That is the teaching, not a limitation: the robot
   thinks of a value, and asking for it again means working it out again.
   Memory is for things with names.

   What survives is a *description* — `type(v).__name__` and `repr(v)`,
   under a hidden name (`THOUGHT` in `repl/program`, read by `thought()`
   in `extract.ts`). The object is already gone by the time anything reads
   it. The description is what the robot's thought bubble shows and what
   the first two lessons are judged on, since they bind nothing and so
   leave no memory to judge.

   Only the **pending** line is asked to describe itself. A replayed
   history expression is emitted exactly as typed — `10` alone is a legal
   statement that evaluates and discards — so a description can only have
   come from the line just submitted.

   (An earlier version kept these values alive in a hidden list so they
   would appear in memory. It taught "an object needs no name" at the cost
   of implying an object needs no reference either, which is false and is
   not what Python does.)

9. **Finishing is one thing or the other, never their disjunction.**
   An activity with a lesson is finished when the lesson's last step is;
   an activity without one is finished when its scene's watches are
   satisfied (`SceneView.solved`). `triumph ?? view.solved`, not an OR:
   `order` has both a lesson and a watch, and the watch is satisfied by
   the lesson's *first* step, so an OR declared it complete a third of the
   way through. Finishing drives both the celebration and the way on.

10. **The way on belongs to the level, not to the guide.** The `Next`
   button is the scene's own, in the same corner everywhere. It lived
   inside the guide's speech bubble once, which meant the two activities
   with no guide could not offer it at all and the last console lesson
   simply dead-ended. Every activity except the last names its `next`.

11. **A lesson's progress is derived, never stored.** It is the first step
   whose test the snapshot fails. That is why the guide cannot disagree
   with the robot, why replay makes progress monotonic for free, and why
   scrubbing walks the guide backwards. A step whose test cannot be
   answered from memory alone is a paragraph, not a step.
12. **The scene causes nothing.** It declares watches and renders the
   snapshot. No scene code may call into a run or hold state of its own.
13. **Decode partially, fail cleanly.** Unsupported kinds and
   budget-elided values are marked `partial` and said so, never shown as
   complete.
14. **`window.botgineer` is the test surface.** Browser tests drive
   `setProgram`/`getProgram`/`run`/`say`/`snapshot`/`state` rather than
   typing into a contenteditable. Keep the shape stable. Readiness is
   `.app[data-boot="ready"]`, not a visible badge. The editor journeys run
   against an activity that still has an editor (`EDITOR` in the spec),
   because the starting activity is a console.
15. **The graph settles because `alpha` decays, not because the forces
   agree.** Anything that can inject energy is scaled by `alpha`;
   collision is positional and unscaled so it still works at rest. Do not
   add an unscaled force. A dropped node keeps `fixed` and the field packs
   around it. Spring rest length is a clearance between node *edges*, so
   a wide node never swallows its own neighbours. Sizes are re-measured
   when the selection changes, because the picked pill grows.
16. **An object card has three tiers.** The value is what the object *is*,
   so it is centred and largest; the type qualifies it and sits in the
   corner, the way a trading card wears its element; the handle is
   bookkeeping and only appears on hover, focus or picking. The handle is
   positioned **absolutely**, not toggled in flow — the force layout
   measures these pills, and a size that changed on hover would shove the
   field around under the cursor. Its text still reaches a screen reader
   through the card's `aria-label`.

17. **Picking moves the camera, not the layout.** There is no second view:
   nodes stay where they are, the camera frames the picked node plus its
   neighbours, and unrelated nodes dim in place. Never replace the field
   with a detail panel — losing sight of the clouds is the thing this
   replaced.
18. **Tests run like production.** Playwright serves the built site at the
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
