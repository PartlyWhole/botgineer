# BotGineer — MVP design

**Status:** design of record for the first prototype.
**Scope:** one scenario, end to end, deployed to GitHub Pages.

---

## 1. What BotGineer is

A browser-based game for learning Python. The player is a *robot engineer*.
People walk up to the robot with requests; the player programs the robot to
answer them correctly. Real CPython runs the player's code, and the memory
model shown on screen is a rendering of what that interpreter actually did —
never a drawing of what it would have done.

Presentation is Duolingo-shaped: characters, reactions, short encounters. The
substance underneath is a real Python runtime with a real terminal and a real
execution trace.

## 2. What the MVP proves

One vertical slice through every layer, deployed and publicly reachable:

> A character approaches with a request. The situation becomes Python data the
> player can see. The player writes a function. Real Python runs it. The
> terminal shows the output, the memory panel shows the execution, a contract
> grades the answer, and the scene reacts.

If that loop works, everything else is content and polish. The MVP exists to
de-risk the *seams*, not to be a game.

## 3. Non-goals

Explicitly out of scope for this prototype, and not to be smuggled in:

- **No block/graphical code editor.** Text only. The visual-program path is a
  later milestone (§15).
- **No pygame-host.** The engine cannot trace pygame code, and tracing is the
  point. The scene is rendered by the host, not by Python.
- **No accounts, backend, or teacher dashboard.** Static site, nothing behind it.
- **No collaboration.** No Automerge, no WebRTC.
- **No i18n.** English strings inline, but see §14 for the extraction risk.
- **No Rive.** SVG characters with discrete expressions (§10).
- **One scenario.** Not two. Not a chapter.

## 4. The slice: "Heavy Parcels"

A courier, **Mira**, arrives at the depot desk.

> *"I need to know which of these parcels are too heavy for the belt —
> anything over 5 kilos."*

Five parcels are drawn as crates, each labelled with an id and a weight. The
same parcels appear in the editor as Python data. The player writes:

```python
def respond(parcels, limit):
    ...
```

returning the list of ids over the limit. The robot then says the answer aloud,
the matching crates highlight, and Mira reacts.

Chosen because it exercises the whole loop with nothing to spare: structured
data in, a list built by a loop (which makes the memory panel *worth looking
at*), a value out, and a scene reaction that is checkable.

## 5. Architecture

```
┌── Worker ────────────────┐         ┌── Main thread ───────────────────────┐
│  PyTrace + CPython 3.14  │ records │  terminal (xterm)                    │
│  (Pyodide 314.0.2)       │────────>│  memory panel   } same step snapshot │
└──────────────────────────┘         │  scene + characters                  │
         ▲                           │                                      │
         │ run(source, stdinLines)   │  editor (3 regions)                  │
         └───────────────────────────│  grader  ──> event bus ──> director  │
                                     └──────────────────────────────────────┘
```

Layer rules:

1. **Python owns the answer.** The host never computes what the robot should
   say; it reads what Python produced.
2. **The runtime initiates; the scene responds.** The scene may answer an
   `input` request the engine raised. It may never call into a live run
   unprompted — `provideInput` throws when nothing is waiting, and a run that
   never reaches a terminal state wedges every control in the UI.
3. **One record, three consumers.** Terminal, memory panel and scene all read
   the same step snapshot, so they cannot disagree.
4. **The director is cosmetic.** Character reactions subscribe to the event
   bus and drive nothing. Removing the director must leave a working app.

## 6. The four seams

### 6.1 Situation → Python

The scenario carries a **preamble**: Python source containing the world as
literals, plus a `report()` helper.

```python
# --- the situation (you can read this, but not change it) ---
parcels = [("A7", 3.2), ("B1", 7.4), ("C2", 1.1), ("D3", 9.8), ("E5", 4.9)]
LIMIT = 5.0

def report(answer):
    print("Robot says:", answer)
```

The preamble is **visible and locked**, never hidden. A teaching tool that
conjures `parcels` from nowhere teaches that data comes from nowhere. The same
list is rendered as crates, from the same scenario definition, so the picture
and the data cannot drift.

NPC *speech* that the program must read would arrive via `stdinLines` (or live
`provideInput`); the MVP scenario uses neither, and §14 records why.

### 6.2 The player's program — three regions

The editor presents one document in three regions:

| Region | Editable | Content |
|---|---|---|
| Preamble | no | the situation (above) |
| **Solution** | **yes** | the player's `def respond(...)` |
| Harness | no | `answer = respond(parcels, LIMIT)` then `report(answer)` |

Assembled top-to-bottom into a single source string; exactly one PyTrace run
per attempt. Line offsets are tracked so that trace `location.line` maps back
to the right region for editor highlighting.

The trailing `report(answer)` line is load-bearing: `line` events fire *before*
the line executes, so a final statement guarantees at least one snapshot in
which `answer` is bound. The grader also scans backwards for robustness (§6.3).

### 6.3 Result → host

After the run, the grader takes the **last step record whose `__main__`
bindings contain `answer`**, and decodes that value (§7).

- `answer` — the graded value. Structured, compared against the contract.
- **stdout** — what the robot says out loud, straight into the terminal.
- `terminal.reason` — `completed` means the robot ran; `uncaught_exception`
  means it malfunctioned, and the traceback is the failure feedback.

### 6.4 Grading

```ts
type Contract = {
  entry: 'respond'
  expected: JsonValue          // shipped in the scenario
  reference: string            // Python reference solution
  misconceptions: { id: string; when: (got: JsonValue) => boolean; say: string }[]
}
```

`expected` is shipped as data, and a **semantic test runs `reference` in real
Pyodide and asserts the shipped value matches**. The interpreter is the answer
key; if a scenario's expectation drifts from what Python actually produces, CI
fails. This is the pyviz rule, enforced rather than hoped for.

Misconceptions are checked before the generic failure, so a wrong answer gets a
specific diagnosis (`>=` instead of `>`, returning weights instead of ids,
returning `None` from a function that only prints) rather than a shrug.

> A static site ships its answer key. Every contract is in the bundle. The MVP
> is not, and must never be described as, tamper-proof assessment.

## 7. Value decoding

Trace values are tagged objects; heap objects appear as `{kind:'ref', uid}`
resolved against that step's flat heap list. The MVP decoder supports:

`none` · `bool` · `int` · `float` · `str` · `ref` → `list` · `tuple` · `dict` · `set`

Everything else — `instance`, `function`, `generator`, `opaque`, `bytes`,
`complex` — decodes to a sentinel that can never compare equal to an expected
value, so an exotic return is a clean failure, not a crash. `elided` values
(a budget victim) decode to their own sentinel and are reported distinctly:
"the answer was too big to check" is a different message from "wrong".

Cross-run invariants to respect: uids are not stable across runs, and set
ordering is only canonical for scalar-only sets. The grader therefore compares
sets as sets, never as sequences.

## 8. Run protocol

```ts
const session = createTraceWorker({ wheelUrl })   // once per page

async function attempt(scenario, solution): Promise<Attempt> {
  const source = [scenario.preamble, solution, scenario.harness].join('\n')
  let latest: StepRecord | null = null
  const steps: StepRecord[] = []

  const summary = await session.run({
    source,
    stdinLines: scenario.stdinLines ?? [],
    options: { max_steps: 5000, wall_clock_s: 20 },
    onRecord(r) {
      if (r.kind === 'console') term.write(r.text)      // straight through
      if (r.kind === 'step')    { steps.push(r); latest = r }   // no render here
      if (r.kind === 'terminal') terminal = r
    },
  })
  return grade(scenario, steps, summary)
}
```

Rules that are not optional:

- **Never render inside `onRecord`.** Records arrive at thousands per second.
  Snapshot renders are throttled to **one per animation frame**, showing the
  latest step. This is a documented lockup, not a theoretical one.
- **Cap the live DOM.** Full arrays in memory; capped node counts on screen.
- **Reject a concurrent run before resetting per-run state**, or the rejection
  path clobbers the live run's record array.
- **Every run reaches a terminal state on every path.** Success, throw and
  interrupt all end the attempt and re-enable the controls.

Budgets are raised deliberately from the defaults (`max_steps` 1000,
`wall_clock_s` 10) because a loop over five parcels plus function-call overhead
sits comfortably under 5000 steps, and a runaway loop should still stop fast.

## 9. Isolation and hosting

| Concern | Decision |
|---|---|
| Base path | `VITE_BASE=/botgineer/`, derived from the repo name in CI |
| URLs | relative or `import.meta.url`-derived; never root-absolute |
| Routing | hash-based — Pages has no rewrite rules |
| Isolation | `coi-serviceworker` shim; `?nonisolated` opts out to degraded mode |
| Capability UI | driven by `header.host.capabilities`, never by our own guess |
| Runtime | self-hosted, no CDN (COEP `require-corp` forbids it anyway) |
| `.nojekyll` | present |

The MVP scenario needs no live `input()`, so it works in degraded mode too. The
shim is still installed, because the first scenario that wants a conversation
will need it and the posture must be tested from day one.

## 10. Scene and characters

SVG, six expressions per character, driven entirely by the event bus:

`idle` · `attentive` · `thinking` · `pleased` · `confused` · `celebrate`

Scene phases: `arriving → asking → working → running → answering → reacting`.

- Every character reaction is **redundant**. Pass/fail is always carried by
  text as well, never by expression or colour alone.
- `prefers-reduced-motion` is honoured: transitions become instant state
  swaps, and nothing loops.
- The director is ~100 lines and has no dependency on the runtime module.

Rive is the upgrade path (it is what Duolingo uses) and the event-bus seam is
what makes it a swap rather than a rewrite. It is not in the MVP because
authoring state machines is a design job, not an engineering one.

## 11. Event vocabulary

Extends the PLP bus. Runtime events are emitted by the runner; scene events by
the game layer. The director subscribes to both and owns no state of its own.

```
run-started      { runId }
run-ended        { reason, trace_complete }
scenario-loaded  { scenarioId }
npc-spoke        { text }
attempt-started  { scenarioId, attempt }
attempt-graded   { scenarioId, passed, misconception? }
robot-spoke      { text }
```

## 12. Repo layout

```
docs/DESIGN.md              this document
public/runtime/             pyodide 314.0.2 + pytrace wheel/schema/browser (vendored)
public/coi-serviceworker.js isolation shim
src/runtime/                session wrapper, record types, value decoder
src/game/                   scenario types, grader, event bus, director
src/ui/                     editor (3 regions), terminal, memory panel, scene
content/scenarios/          heavy-parcels.ts
tests/semantics/            reference solutions run in real Pyodide (the answer key)
tests/browser/              one end-to-end journey, run against the built site
.github/workflows/deploy.yml
```

## 13. Acceptance criteria

The MVP is done when, on the deployed Pages URL:

1. The page loads, boots the runtime, and reports its isolation posture.
2. Mira arrives and asks; the crates match the Python literals exactly.
3. A **correct** solution runs: terminal shows the robot's line, the memory
   panel steps through the loop, the contract passes, the scene celebrates.
4. A **wrong** solution (`>=` instead of `>`) fails with the *specific*
   misconception message, not a generic one.
5. A **crashing** solution ends at `uncaught_exception`, shows the traceback,
   and leaves the controls usable.
6. An **infinite loop** hits `step_limit` or `wall_clock_s`, ends, and leaves
   the controls usable.
7. Reloading a deep link works (hash routing).
8. A semantic test proves `expected` equals what the reference solution really
   produces in Pyodide.
9. CI type-checks, tests, builds at the project sub-path, runs the browser
   journey against that build, deploys, and smoke-tests the live URL.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Step budget too tight for real scenarios | raised to 5000 in the MVP; every scenario declares its own budget |
| Rendering lockup from record volume | rAF throttling and DOM caps are in the design, not a later fix |
| `coi-serviceworker` fails in some browser | `?nonisolated` degraded path exists and is tested; MVP scenario needs no live input |
| Value decoder is a rabbit hole | deliberately partial; unsupported kinds fail cleanly rather than growing the decoder |
| Strings hardcoded now, i18n later is painful | accepted for the MVP; all player-visible strings live in the scenario or a single `strings.ts` so extraction is mechanical |
| A fifth runtime with no curriculum | the honest risk. The MVP is scaffolding for content, and the next work after it is scenarios, not features |

## 15. Deferred, with the path named

- **Graphical code** — brain-lab's program tree and Python emitter. One tree,
  edited visually, emitted as Python, run by the same worker; the visual form
  and the code cannot disagree.
- **Beginner tracebacks** — `executing`, `pure_eval`, `stack_data`,
  `friendly-traceback`. Highest value per hour of any deferred item.
- **Rive characters** — swap behind the director.
- **Live conversation** — `input()`-driven NPC dialogue; requires the isolated
  posture, already installed.

## 16. Build order

1. Scaffold: Vite + React + TS, base path, Pages workflow.
2. Vendor the runtime; prove it boots at a sub-path.
3. Session wrapper + terminal. Run arbitrary Python, see output.
4. Value decoder + memory panel, rAF-throttled.
5. Scenario type, the three-region editor, the harness.
6. Contract, grader, misconceptions; the semantic test that validates them.
7. Event bus, director, SVG scene.
8. Browser journey; deploy; smoke-test the live URL.

## 17. Open questions

- **Age and reading level.** Unresolved, as it is in brain-lab. It drives
  vocabulary, NPC dialogue length, and how much Python is pre-written.
- **Does the player ever see the trace by default, or only on request?** The
  memory panel is the differentiator, but it may be noise during a first
  encounter.
- **Does a wrong answer cost anything?** No lives, no streaks in the MVP. Both
  are content decisions that shape the scene layer later.
