# Errata

Corrections made to this copy of the collection, each one found by the
snippet audit (`tests/semantics/collection.sweep.test.ts`) running the key's
stated answers against CPython 3.14 in the engine the site ships. The
original collection's text is otherwise unchanged; a correction is listed
here with what the key said, what Python does, and why the fix is the
key's intent rather than a new claim.

| Where | The key said | Python 3.14 | Correction |
|---|---|---|---|
| 4.3, Answer | `[[1, 99], [3, 4]]` (twice) | `[[1, 2, 99], [3, 4]]` (twice) | `.append(99)` adds to `[1, 2]`; it does not replace the `2`. The reasoning paragraph already describes an append. |
| 4.11, Authoring record | "two dictionaries, three lists, one shared" | the program builds two lists, `[1, 2]` and `[9]` | "two lists, one shared" |
