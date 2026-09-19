# BotGineer

**<https://partlywhole.github.io/botgineer/>**

Learn Python by programming a robot. People come to the depot desk with
requests; you write the code the robot answers with.

Every answer is produced by **real CPython 3.14**, running in a Web Worker in
your browser. The memory panel is a rendering of what that interpreter
actually did — not a drawing of what it would have done. No accounts, no
backend, nothing leaves the page.

This is a prototype: **one** scenario, end to end, to prove the seams.
[`docs/DESIGN.md`](docs/DESIGN.md) is the design of record.

## Run it

```bash
npm install
npm run dev
```

The first load downloads about 13 MB of Python runtime and starts it in a
worker; after that it is cached.

## Check it

```bash
npm run typecheck
npm run test          # semantic tests: real CPython via Pyodide
npm run test:browser  # 14 journeys against the production build
```

`npm run test` is the important one. Every scenario ships an `expected`
answer as data, and these tests run the scenario's *reference solution* in
real Python and assert the shipped expectation matches. **The interpreter is
the answer key**: a contract that drifts from what Python does fails CI,
rather than quietly grading students against a stale answer. The
misconception diagnoses are verified the same way — the wrong code is really
executed, and the diagnosis it should trigger is asserted against the real
result.

`npm run test:browser` builds the site, serves it at a repository sub-path
with **no** isolation headers — exactly how GitHub Pages serves it — and
drives it in Chromium: the correct answer, a specific wrong answer, a crash,
an endless loop, trace scrubbing, cross-origin isolation via the service
worker, and the degraded posture.

## Publish it

Nothing assumes a particular GitHub owner or repository; both come from
wherever the workflow runs.

1. In **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Push to `main`. `.github/workflows/deploy.yml` type-checks, tests, builds
   with the base path set from the repository name, runs the browser journeys
   against that build, publishes, and then smoke-tests the published URL.

For a user or organisation site (`https://OWNER.github.io/`), set a
repository variable `BASE_PATH` to `/`.

## How it fits together

```
┌── Worker ────────────────┐         ┌── Main thread ───────────────────────┐
│  PyTrace + CPython 3.14  │ records │  terminal (xterm.js)                 │
│  (Pyodide 314.0.2)       │────────>│  memory panel   } same step snapshot │
└──────────────────────────┘         │  scene + characters                  │
                                     └──────────────────────────────────────┘
```

```
src/runtime/      session wrapper, wire-format types, value decoder
src/game/         scenario shape, grader, event bus, director
src/ui/           code editor, terminal, memory panel, scene, characters, gutters
content/scenarios/ the encounters
public/runtime/   vendored PyTrace; Pyodide copied in at build time
```

Four rules carry most of the weight:

- **Python owns the answer.** The host never computes what the robot should
  say. It lifts `answer` out of the trace's own snapshots and decodes it.
- **The runtime initiates; the scene responds.** The scene may answer an
  `input` request the engine raised. It may never call into a live run
  unprompted, and every run must reach a terminal state on every path — a run
  that never ends wedges every control on the page.
- **One record, three consumers.** Terminal, memory panel and scene all read
  the same step snapshot, so they cannot disagree.
- **The director is cosmetic.** Character expressions subscribe to the event
  bus and drive nothing. Deleting the director leaves a working app, and no
  verdict is ever carried by a face or a colour alone.

## What this release is not

- **One scenario.** "Heavy Parcels". The rest is scaffolding for content that
  does not exist yet, and that is the honest risk.
- **No block editor.** Text, in a real editor (CodeMirror, Python syntax,
  indent/dedent, comment toggling). Visual code that emits Python is a later
  milestone with its own program-tree and emitter work.
- **No beginner tracebacks.** PyTrace reports an exception's type and origin
  line; it never calls a user `__repr__`, so there is no message to quote.
  Wiring in `friendly-traceback` and friends is the highest-value next step.
- **No accounts, no saving, no teacher dashboard.** Work lives in this tab.
- **Not tamper-proof assessment.** A static site ships its answer key. Every
  contract is in the bundle, and hiding it in the UI would not make it secret.
- **Not a security boundary.** The worker keeps the page responsive. It does
  not sandbox deliberately hostile code.
- **Not yet piloted with a learner.** Every claim here is a product check.
  Whether anyone learns from it is an open question, and the intended age and
  reading level are unresolved.

## Known limits

- A run is bounded: 5,000 trace steps and 20 seconds. Exceeding either stops
  the run, keeps what was recorded, and says so.
- The value decoder is deliberately partial. Anything outside
  `None`/`bool`/`int`/`float`/`str`/`list`/`tuple`/`dict`/`set` fails grading
  cleanly instead of growing the decoder.
- Live `input()` needs cross-origin isolation, which the service-worker shim
  supplies. `?nonisolated` opts out into the engine's degraded mode; the
  current scenario works in both.
- Browser journeys run in Chromium only.

## Credits

Built on **PyTrace** (`trace-engine/1`) and **Pyodide** 314.0.2, with
**xterm.js** for the console. The integration rules this repo follows are
distilled from the Engine Pilot frontend integration guide.
