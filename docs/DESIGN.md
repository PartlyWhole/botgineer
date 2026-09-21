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
        ▲                              │   (C) memory ◄─────────────────┘  │
        │  run(source, options)        │   (B) robot ── causes it ─────────┤
        └──────────────────────────────┴───────────────────────────────────┘
```

Only **(B)** causes anything. **(A)** and **(C)** render what it produced,
from the same data, so they cannot disagree — and the step slider moves all
three together, so scrubbing rewinds the picture as well as the diagram.

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

### 2.1 The judgement call: identity for primitives

The engine gives heap objects a uid and gives scalars none — deliberately,
because CPython interns small ints and short strings, and inventing a
per-occurrence identity would teach a lie about `is`.

But a model with no entry for `10` cannot show *"these two names point at
the same value"*, which is the first thing a memory diagram is for. So
every value gets an entry, in two visibly different flavours:

| | keyed by | identity badge | shown as |
|---|---|---|---|
| **value** — int, float, str, bool, None | type + value | **no** | green chip |
| **reference** — list, dict, set, instance, … | the engine's uid | **yes**, `#1` | amber chip |

Two `10`s are one entry, because for an immutable that is all Python lets
you observe. Two equal lists are two entries, because they really are two.
**The UI must never invite an `is` comparison on a value object**, and the
absence of a badge is how it says so.

Badges are within-session nicknames. The engine's uids mean nothing across
runs and must never be shown as addresses.

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

### (C) Memory — `src/panels/MemoryPanel.tsx`

Two clouds — names and objects — and an inspector.

Selecting a chip **lifts it out** of its cloud (it dims in place; it is not
duplicated) and opens it below. A name shows what it points at. An object
shows its type, its value, its pointers, and everything currently holding
it — both the names and the collections. Clicking a pointer moves the
selection, so the graph is *walked* rather than dumped.

An object nothing points at is drawn dashed and dimmed, because "held by
nothing" is a fact worth seeing.

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
