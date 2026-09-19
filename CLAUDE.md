# BotGineer (repo guide)

Static GitHub Pages site: a Python learning game. Real CPython 3.14 runs in a
Web Worker via PyTrace + Pyodide; the memory panel renders the trace that
interpreter produced. Deploys as a **project site**
(`https://partlywhole.github.io/botgineer/`) — the sub-path is load-bearing.

Design of record: [docs/DESIGN.md](docs/DESIGN.md).

## Commands

```sh
npm run dev           # vite, base '/'
npm run typecheck
npm run test          # semantic tests: real CPython via Pyodide (node)
npm run test:browser  # playwright against the PRODUCTION build at /botgineer/
```

## Layout

| Path | What |
|---|---|
| `src/runtime/types.ts` | `trace-engine/1` wire format. Four record kinds: header, step, diagnostic, terminal. **There is no console record** — output arrives as `stdout_delta`/`stderr_delta` on each step |
| `src/runtime/session.ts` | typed wrapper over the vendored facade; owns the one-run-at-a-time guard |
| `src/runtime/decode.ts` | tagged values → comparable JS; deliberately partial |
| `src/game/scenario.ts` | scenario shape; assembles preamble + solution + harness |
| `src/game/grader.ts` | lifts `answer` from the trace, decodes, compares, diagnoses |
| `src/game/events.ts` | semantic event bus — the seam between runtime and scene |
| `src/game/director.ts` | events → character moods. Cosmetic; drives nothing |
| `src/ui/` | editor, terminal, memory panel, scene, characters |
| `content/scenarios/` | the encounters |
| `public/runtime/pytrace/` | vendored engine. `browser/worker.mjs` is **patched** to resolve Pyodide relative to itself (`../../pyodide/`) so it works under a sub-path |
| `public/runtime/pyodide/` | copied from the pinned npm package at build time; gitignored |

## Load-bearing invariants

1. **Serving.** Every URL relative or `import.meta.env.BASE_URL`-derived,
   never root-absolute — root-absolute breaks under `/botgineer/`. No CDN
   fetches (COEP `require-corp`). `public/.nojekyll` must exist.
2. **Runs.** Reject a concurrent run **before** resetting per-run state, or
   the rejection clobbers the live run's records. **Every run reaches a
   terminal state on every path** — success, throw, interrupt. A run that
   never ends leaves `running` true and wedges every control.
3. **Never render inside `onRecord`.** Records arrive at thousands per
   second. Steps are pushed to a ref; the rAF pump renders the latest and
   flushes queued output at most once per frame.
4. **Python owns the answer.** The host never computes what the robot should
   say. `answer` is lifted out of the trace's snapshots and decoded.
5. **The runtime initiates; the scene responds.** `provideInput` throws when
   nothing is waiting. Nothing subscribed to the event bus may call into a
   live run.
6. **The director is cosmetic.** Deleting it must leave a working app. No
   verdict is ever carried by a face or a colour alone; every verdict is also
   text. `prefers-reduced-motion` is honoured.
7. **The interpreter is the answer key.** A scenario's `expected` is data,
   and `tests/semantics` runs the reference solution in real Python to prove
   it. Misconceptions are asserted against really-executed wrong code. Do not
   hand-write an expectation and do not "fix" a semantic test by editing the
   expectation — that is a design change.
8. **Decode partially, fail cleanly.** Unsupported value kinds and
   budget-elided values return sentinels that can never compare equal.
   "Too big to check" is reported differently from "wrong".
9. **Tests run like production.** Playwright serves the built site at the
   sub-path with **no** isolation headers, so the `coi-serviceworker` path is
   what gets exercised. Do not add COOP/COEP to the test server.

## Engine facts that shape the UI

- An uncaught exception yields only a **type name**: the encoder never calls
  a user `__repr__`, so the exception object comes back `opaque` and there is
  no message. The origin line comes from the first `exception` **step**, and
  is reported relative to the player's own code.
- `max_steps` (default 1000) and `wall_clock_s` (default 10) are raised per
  scenario. A budget terminal keeps the truncated trace.
- Live `input()` and cooperative interrupt need `crossOriginIsolated`.
  Drive capability UI from `header.host.capabilities`, never from a guess.
