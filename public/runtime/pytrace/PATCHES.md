# Local patches to the vendored PyTrace engine

The engine is vendored, not forked. Each change here is small and marked in
the source with `BOTGINEER PATCH` or `PILOT-SITE PATCH`.

## `browser/worker.mjs` — Pyodide resolved relative to the worker (2 edits)

So the site works from a GitHub Pages project sub-path (`/botgineer/`).
Upstream resolved `/node_modules/pyodide/` against the origin root.

## Function defaults (`trace_engine/encoder.py`, schema `FunctionNode`)

`_function_node` emits `defaults: [EncodedValue]` when the function has
positional defaults (`__defaults__`). The schema's `FunctionNode` gains the
matching optional property, in both copies: the wheel's packaged
`trace_engine/trace-engine-1.schema.json` and `schema/trace-engine-1.schema.json`,
which the browser facade fetches.

Why: the collection's Stage 8 and capstone teach that `log=[]` is one list
built at `def` time and owned by the function object. Without this, the
trace cannot show that list at all until a call binds it.

To rebuild the wheel after editing: unzip it, apply the edit, regenerate
`RECORD` hashes (sha256, urlsafe base64, no padding) and zip it again.
`scripts/engine-harness.py` runs the unzipped engine on native CPython 3.14.
