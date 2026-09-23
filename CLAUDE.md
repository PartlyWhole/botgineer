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
`mode: 'console' | 'editor' | 'read'`. The console is one line at a time,
and it is where the game starts; the editor is what a later activity
unlocks. They are not two engines — see invariant 7.

**Then the map is the Reading Python collection.** After the warm-up, the
nine stages of `content/collection/` are the game: read a program, commit
a prediction, *then* watch the robot run it, and read the key. `read` mode
is the same two panels and the same one snapshot (invariants 21–25).

## Commands

```sh
npm run dev           # vite, base '/'
npm run typecheck
npm run test          # unit tests, and tests/semantics: the real engine in Node
npm run test:browser  # playwright against the PRODUCTION build at /botgineer/
npm run collection    # regenerate content/collection/generated/ from the markdown
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
| `content/lessons.ts` | guided lessons. A step's progress is **derived from evidence**, never stored: the snapshot, what the robot thought, and memory after each accepted line. A step may also `show` a picture, `nudge` a miss, and an `ordered` lesson counts a thought only for the step that asked (invariant 26) |
| `src/scene/props.ts` | the pictures a lesson step stands on the stage, and how an answer is read into them (`numberOf`, `boolOf`, `textOf`). Pure |
| `src/ui/Props.tsx` | draws them: one small SVG per picture, the answer drawn in, a CSS demonstration on arrival, pressed to replay |
| `src/app/props.css` | the pictures' look, and one colour per kind (`--k-bool` …), deliberately separate |
| `src/app/console.css` | console and speech-bubble styling, deliberately separate from `styles.css` |
| `src/scene/spec.ts` | a scene is data, and a view of memory: watches map global names to visual effects |
| `src/panels/ScenePanel.tsx` | (A) the situation, drawn from the snapshot |
| `src/panels/RobotPanel.tsx` | (B) the instrument and memory, split by a gutter, + Run/Stop + step slider + transcript |
| `src/panels/MemoryPanel.tsx` | (C) thin: owns the selection; the graph does the rest |
| `src/memory/handles.ts` | `obj1`, `obj2`, … Owned by the workbench, so every view that shows a handle shows the same one |
| `src/panels/MemoryGraph.tsx` | the memory grid. SVG arrows + DOM cards sharing one camera; tweens positions by writing transforms straight to the elements, never through React |
| `src/panels/graphLayout.ts` | the grid placement, the arrows, the tween and the camera. Pure and unit-tested. Read its header before changing it: a force layout lived here first, and why it was retired is measured, not remembered |
| `src/ui/CodeEditor.tsx` | CodeMirror; `head`/`tail` optionally lock regions (unused by the workbench) |
| `src/ui/Split.tsx` | draggable, keyboard-operable gutters; sizes remembered in localStorage |
| `src/app/Workbench.tsx` | the wiring: owns the run, the steps, the index, the snapshot |
| `content/roadmap.ts` | the levels, grouped into units, in play order. The only place the order lives |
| `src/progress/progress.ts` | which levels are finished (localStorage) and what that unlocks. One of the **two stored things** — see invariant 19 |
| `src/roadmap/RoadmapScreen.tsx` | the home screen: a Duolingo-style winding path of levels, one unit per coloured stretch, the cast beside it |
| `content/concepts.ts` | the concepts: the warm-up's 14 skills (a lesson's `teaches` introduces them, practice exercises them) and the collection's ~45, tagged by its specs. Mastery tracks each |
| `src/practice/python.ts` | just enough Python (literals, names, `+ - * / // % <` …) to know an exercise's answer before asking it. Pure; checked against CPython by the browser suite |
| `src/practice/exercises.ts` | one seeded generator per skill: the question, setup lines, a working answer, and a judge that names the mistake |
| `src/practice/session.ts` | which exercises a session asks, weighted towards weak and faded skills. Pure and seeded |
| `src/practice/usePractice.ts` | runs a session inside the workbench: judges each line, records first tries, says what the crow says |
| `src/mastery/mastery.ts` | per-skill mastery: score, streak, fading with time, levels. Pure update + the stored record |
| `src/progress/storage.ts` | the one localStorage helper both stored things use |
| `src/roadmap/SkillsScreen.tsx` | `#/skills`: every skill's level, first-try tally, and what needs review |
| `src/roadmap/layout.ts` | where stops, trail and mascots go on the path. Pure and unit-tested |
| `src/app/roadmap.css` | the map's look, deliberately separate from `styles.css`. Nunito, bundled from npm |
| `content/activities/` | the activities: brief, scene, starter |
| `public/runtime/pytrace/` | vendored engine. `browser/worker.mjs` is **patched** to resolve Pyodide relative to itself (`../../pyodide/`) so it works under a sub-path, and the wheel's encoder is **patched** to emit a function's `defaults` (schema too). `PATCHES.md` says how |
| `content/collection/*.md` | the Reading Python collection: nine stages, glossary, conventions. **The source of truth**, edited as markdown. `ERRATA.md` lists corrections the audit forced |
| `scripts/collection.mjs` | markdown → `content/collection/generated/*.json` (committed; a unit test fails if stale) |
| `content/collection/specs/` | how each item is graded, hand-written, keyed by id: its `Part`s, concepts and the key's own `model` answers. One per item (there is a test) |
| `src/collection/model.ts` | the collection's types: content (blocks, keys, authoring records) and specs (`Part`, `Check`, `Answer`, `Graded`) |
| `src/collection/index.ts` | generated content joined to specs: items, snippets, misconceptions, lenses, sets. Variant ids (`v:…`) resolve here too |
| `src/collection/grade.ts` | the graders, one per interaction; pure; truth is `RunEvidence`, never a stored answer |
| `src/collection/runner.ts` | plays an item: prepare (run snippets, `ast` bodies, pictures), run a program with its checker, model answers. Shared by the page and the Node sweep |
| `src/collection/traceOrder.ts` | trace → the collection's execution-order numbering. The one place they are reconciled |
| `src/collection/distractors.ts` | `canonical` memory (identity-aware), and wrong pictures made by named misconceptions |
| `src/collection/checker.ts`, `facts.ts` | programs about programs (the hidden checker; Python's `ast` for block bodies), and facts derived from memory for answers |
| `src/collection/levels.ts` | what a reading level plays; the checkpoint gate and the review, **derived from mastery** |
| `src/collection/variants.ts` | seeded templates of the templatable families; answered by running them |
| `src/collection/useReadSession.ts` | answer → commit → act, first tries recorded once |
| `src/collection/voice.ts` | what the crow says, plain before Stage 6 and formal from it |
| `content/activities/reading.ts` | the collection's levels, generated from it: ideas, sets, practice, checkpoint, capstone; `sN-review` and `x-<id>` made on demand |
| `src/app/useReadLevel.ts` | a reading level, played: its items, resume point, guide line, finished |
| `src/panels/ReadPanel.tsx`, `ReadSheet.tsx` | (B) the code and the answers; (A) the question and, after the commit, the key |
| `src/panels/IdeasSheet.tsx`, `IdeasPanel.tsx` | a stage's ideas with every example runnable in place |
| `src/ui/CodeView.tsx`, `forms/`, `Blocks.tsx` | clickable read-only code; one widget per interaction; the collection's prose |
| `src/roadmap/GlossaryScreen.tsx` | `#/glossary` and `#/glossary/<term>` |
| `src/app/read.css` | reading's styling, deliberately separate |
| `tests/semantics/` | the shipped wheel in the shipped Pyodide, in Node: the collection audit and sweep, graders on crafted misses, variants |
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

10. **The way on belongs to the level, not to the guide.** The
   `Continue` button is the scene's own, in the same corner everywhere,
   and it goes **back to the map**, where the level just finished pops and
   the one it unlocked bounces (`goToMap(id)`; the router remembers the
   arrival in memory only). It lived inside the guide's speech bubble
   once, which meant the activities with no guide could not offer it at
   all. Every level has it, the last included. `next` on an activity is
   now only the play order, and must agree with `content/roadmap`.
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
   `setProgram`/`getProgram`/`run`/`say`/`snapshot`/`state` — and, for
   reading, `read.state`/`answer`/`commit`/`submit`/`mark`/`next`/`models`
   — rather than typing into a contenteditable. Keep the shape stable. Readiness is
   `.app[data-boot="ready"]`, not a visible badge. The editor journeys run
   against an activity that still has an editor (`EDITOR` in the spec),
   because the starting activity is a console.
15. **Memory is placed, not simulated.** `graphLayout.place` is a pure
   function of what memory holds and the order names were first seen:
   names in one column in that order, each name's object starting its
   row, a collection's elements in the next column in index order, and an
   object already drawn never drawn again, so aliasing is arrows
   converging on one card. The component only *tweens* to those
   positions. Two consequences are load-bearing. First, nothing already
   drawn moves when a line adds something: the overview is anchored top
   left and its zoom depends on the pane, **never on memory**. Centring,
   or fitting the content, moved every card on every Enter. Second, the
   graph stays mounted when memory is empty, and the console shows the
   last accepted memory while it replays (`Workbench`), because
   rebuilding from nothing on every submission was the whole of the
   jitter. A memory bigger than the pane scrolls; it does not shrink past
   `OVERVIEW_MIN_K`. There is no dragging: a card's place is a property
   of the program. (It was a force layout until the rewrite; the header
   of `graphLayout.ts` has the measurements that retired it.)
16. **An object card has three tiers.** The value is what the object *is*,
   so it is centred and largest; the type qualifies it and sits in the
   corner, the way a trading card wears its element; the handle is
   bookkeeping and only appears on hover, focus or picking. The handle
   sits in a strip whose height and width are **reserved in flow**, so
   showing it never resizes the card — the grid measures these cards, and
   a size that changed on hover would move a column under the cursor. Its
   text still reaches a screen reader through the card's `aria-label`.

17. **Picking moves the camera, not the layout.** There is no second view:
   cards stay where they are, the camera frames the picked node plus its
   neighbours, and unrelated cards dim in place. The placement measures
   cards *unpicked*, so the picked one grows without widening its column.
   Never replace the grid with a detail panel — losing sight of the rest
   of memory is the thing this replaced.
18. **Tests run like production.** Playwright serves the built site at the
   sub-path with **no** isolation headers, so the `coi-serviceworker` path
   is what gets exercised. Do not add COOP/COEP to the test server.
19. **Two things are stored, and only two.** Finished level ids
   (`progress.ts`) and mastery (`mastery.ts`), both in this
   browser's localStorage through `storage.ts`. Mastery is keyed: a
   concept by its bare id, `ex:<item>`, `mis:<misconception>`,
   `lens:<lens>`, and `err:<kind>` (misses only). The progress set can also hold
   `*unlock-all`, the player's choice to open every level
   (`ProgressControls` on the map): it opens levels without finishing
   them, so no trophy is earned by it. "Start over" clears both stores. Everything the map and the
   skills screen show is derived from those, the roadmap's order and the
   clock — including a skill's fading, which is computed when read and
   never written. Finished levels are written by the Workbench on
   invariant 9's rule and never un-written. The map is home (`#/`,
   `#/map`); a level's own hash always goes straight in, locked or not,
   because locks are an invitation to play in order and deep links are how
   tests and shared links work. The roadmap's order must agree with each
   activity's `next` (there is a test).
20. **Introduce, then practise; only first tries count.** A lesson
   *introduces* skills (`teaches`); a practice level after each unit's
   lessons *exercises* them with generated questions. An exercise's
   answer is computed from its expression tree by `practice/python.ts`,
   and the browser suite plays whole sessions against real CPython, so the
   interpreter is still the answer key. A judge reads the same evidence a
   lesson step does, and says *which* mistake when it knows. Only an
   exercise's first judged try is recorded against mastery — the player
   still has to get it right to move on, but a third attempt is learning,
   not evidence. A session is React state and is never stored; mastery is
   what persists. Each exercise gets a clean console (`Workbench.restart`)
   with its setup lines run and shown as given.

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
21. **Content is markdown; grading is code; the interpreter is the key.**
   The collection's prose is never edited in JSON, and how to grade is
   never guessed from prose: a spec per item says what to compare, and
   the truth comes from running the snippet. Each spec carries the key's
   own answers (`model`), and the sweep (`tests/semantics`) grades every
   one against real CPython 3.14. A key that disagrees with the
   interpreter is fixed in the markdown and logged in `ERRATA.md`; the
   interpreter wins.
22. **Commit before run.** An item's snippets run *quietly* when it opens
   (a picture choice needs the truth to draw its options), and nothing of
   that run is shown: memory empty, no scrubber, no output, key shut. The
   commit locks every prediction, grades it, and only then shows the run
   and opens the key. While a repair or program is owed, the key's code
   stays folded. Only first tries are recorded against mastery.
23. **Reading's runs are queued.** An item runs several programs (each
   snippet, the `ast` block finder, a checker after a repair), some shown
   and some not. They go through one queue in the workbench, so two are
   never in flight at once. `RunEvidence` (`extract.runEvidence`) is what
   graders see — `extract.ts` is still the only translation.
24. **Execution order is mapped in one place.** The trace counts one `line`
   event per visit, which is the collection's convention, except that the
   collection sometimes numbers a calling line again after the call
   returns. That revisit is optional on both sides (`traceOrder`). Never
   change the content to fit the trace.
25. **The checkpoint gate is derived.** All but one right first time
   passes (a vocabulary-only miss counts as right). A failed checkpoint is
   not finished; its missed questions' "go back to" exercises are an
   amber review before it, owed until each has been done since. All of it
   is read from `ex:` records — nothing about a checkpoint is stored.
26. **A lesson's picture is the same evidence, drawn.** A step's `show`
   stands in the scene's `props` slot, and what it shows is a function of
   the step, the last line and what the robot thought of it — the same
   evidence the crow reads (`staging` in `content/lessons.ts`). A right
   answer's picture leaves *as the same element* (one keyed list), so its
   effect plays as a transition and its demonstration is not replayed; a
   miss is drawn into the picture that asked. Demonstrations are CSS
   `backwards` keyframes, so the resting picture is the plain style and
   reduced motion simply skips to it. Nothing here is stored or timed.
   A reply to a miss (`nudge`) is only ever asked about a line that did
   not move the lesson, so it never mistakes a right answer for a wrong
   one to the next question. An **ordered** lesson walks the thoughts in
   order and counts each for at most one step, and only for the step that
   was asking — still derived, still monotonic. The first two levels are
   ordered because a type-only step answered early skipped the line that
   named it.
