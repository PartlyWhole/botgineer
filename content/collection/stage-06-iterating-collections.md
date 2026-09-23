# Stage 6 — Iterating Different Collections

**The one new move:** for any collection, say what a `for` loop hands you on each
pass, in what order, and how many times it can be walked.

**Vocabulary note.** From here on, the formal terms arrive — as labels for ideas
you have already practiced, never as new material. Each is introduced beside the
plain phrase it replaces, and `glossary.md` holds the full list.

---

## What this stage adds

Stage 5 always looped over a list or a range. The loop machinery does not care
what it is walking, but *what it hands you* differs, and so does the order, and
so does whether you can walk it twice.

---

## The ideas, in plain language

### The formal words, at last

| Plain phrase you have been using | Formal term |
|---|---|
| a name pointing at an object | a **binding** |
| the thing being looped over | an **iterable** |
| the name the `for` line rebinds | the **loop variable** |
| indented lines belonging together | a **block** |
| the order in which lines run | **control flow** |
| changeable / unchangeable | **mutable** / **immutable** |
| may be used as a dictionary key or set item | **hashable** |

Nothing changed. You may now say "the loop variable is rebound on each pass"
instead of "the `for` line points the name at the next value", and mean exactly
the same thing.

An **iterable** is simply *anything a `for` loop can walk*. Lists, tuples,
strings, ranges, dictionaries, sets, files, and generators are all iterables.

### What each iterable hands you

| Iterable | Each pass gives you | Order |
|---|---|---|
| list, tuple | the item at the next position | as stored |
| string | one character, as a one-character string | left to right |
| `range` | the next number | as counted |
| dictionary | the next **key** | insertion order |
| set | the next item | **not guaranteed** |
| generator | the next produced value | as produced, **once only** |

The dictionary row is the one people are surprised by:

```python
ages = {"ann": 30, "bo": 25}
for x in ages:
    print(x)          # ann, bo — the keys
```

To get values or pairs, ask for them:

```python
for v in ages.values():       # 30, 25
for k, v in ages.items():     # ("ann", 30) then ("bo", 25), unpacked into two names
```

`ages.items()` hands you a two-item tuple per pass, and `for k, v in ...`
**unpacks** it: two bindings per pass instead of one. Unpacking is not special to
loops — `k, v = ("ann", 30)` does the same thing on its own line.

### Set order is not yours to rely on

A set has no positions and keeps no order you may depend on. A given Python run
may hand you `{3, 1, 2}` as 1, 2, 3, and that stability for small integers is an
artifact of how sets are built, not a promise. For text, the order can differ
between runs of the same program.

If you need an order, ask for one:

```python
for x in sorted(scores):
    ...
```

Sets also require their items to be **hashable**, for exactly the reason
dictionary keys are (Stage 3): a set files each item by what it looks like, so an
item that could change afterward cannot be filed. `{[1, 2]}` is a `TypeError`;
`{(1, 2)}` is fine.

### Generators produce values one at a time — and only once

```python
squares = (n * n for n in range(4))
print(list(squares))      # [0, 1, 4, 9]
print(list(squares))      # []   ← nothing left
```

A generator is a *recipe in progress*, not a container. It holds no items; it
produces the next one when asked. Once it has produced its last value it is
**exhausted**, and every later request finds nothing. Anything that walks a
generator — `list()`, `sum()`, `max()`, a `for` loop, even `in` — consumes it.

This is the same design as `range`, with one crucial difference: a `range` can be
walked again from the start, because it recomputes; a generator cannot, because
it has moved on.

Note the punctuation: `(n * n for n in range(4))` in round brackets is a
generator; `[n * n for n in range(4)]` in square brackets is a **list
comprehension**, which builds an actual list right now and can be walked as often
as you like. One character decides.

### Comprehensions, briefly

```python
[n * n for n in range(4)]           # [0, 1, 4, 9]
[n for n in range(10) if n % 3 == 0] # [0, 3, 6, 9]
{k: len(v) for k, v in data.items()} # a dictionary comprehension
```

Read one left to right as: *"build a list of «this expression», for each «loop
variable» from «this iterable», keeping only those where «condition»."* It is the
Stage 5 accumulator pattern compressed into an expression, and it produces a
**new** object — it never changes the iterable it walks.

Because the expression is re-evaluated on every pass, a comprehension is the
general fix for the Stage 4 repetition pitfall:

```python
grid = [[0] * 3 for _ in range(3)]   # three distinct inner lists
```

`_` is an ordinary name, used by convention when the value is not needed.

### `enumerate` and `zip`

```python
for i, c in enumerate("abc"):        # (0, 'a'), (1, 'b'), (2, 'c')
for a, b in zip([1, 2], "xy"):       # (1, 'x'), (2, 'y')
```

`enumerate` hands you position-and-item pairs, which is what people are reaching
for when they write `for i in range(len(xs))` and then immediately do `xs[i]`.
`zip` walks two iterables in step and stops at the shorter one.

### Changing a dictionary or set while looping over it

```python
d = {"a": 1, "b": 2}
for k in d:
    d["c"] = 3        # RuntimeError: dictionary changed size during iteration
```

Unlike a list, which quietly gives wrong answers (Stage 5), a dictionary or set
detects the change and refuses. Loop over a snapshot — `for k in list(d):` — if
you must add or remove keys.

---

## Exercises

---

**6.1 — Predict the result**

```python
for c in "hi":
    print(c, len(c))
```

---

**6.2 — Predict the result**

```python
ages = {"ann": 30, "bo": 25}
for x in ages:
    print(x)
print("---")
for x in ages.values():
    print(x)
```

---

**6.3 — Compare near-matches**

Snippet **A**:

```python
d = {"a": 1, "b": 2}
for k in d:
    print(k, d[k])
```

Snippet **B**:

```python
d = {"a": 1, "b": 2}
for k, v in d.items():
    print(k, v)
```

Predict both. State one advantage of each form.

---

**6.4 — Label the code**

Using the formal vocabulary from this stage, describe what each part of this line
does: `for k, v in scores.items():`

---

**6.5 — Predict the result**

```python
pairs = [(1, "a"), (2, "b")]
for n, letter in pairs:
    print(n, letter)
for item in pairs:
    print(item, len(item))
```

---

**6.6 — Predict the result**

```python
squares = (n * n for n in range(4))
print(list(squares))
print(list(squares))
print(sum(n * n for n in range(4)))
```

Explain the second line's output in terms of the recipe idea.

---

**6.7 — Compare near-matches**

Snippet **A**:

```python
g = (n for n in range(3))
print(len(list(g)))
print(len(list(g)))
```

Snippet **B**:

```python
r = range(3)
print(len(list(r)))
print(len(list(r)))
```

Predict both and say precisely why they differ.

---

**6.8 — Find and fix**

The intent is to print the total twice. Diagnose and give the smallest fix.

```python
values = (n for n in [1, 2, 3])
print(sum(values))
print(sum(values))
```

---

**6.9 — Predict the result**

```python
nums = {3, 1, 2}
print(len(nums))
print(sorted(nums))
nums.add(1)
print(len(nums))
```

Then say what you *cannot* safely predict about this snippet.

---

**6.10 — Find and fix**

The intent is to print the words in a stable, repeatable order. Explain why this
is unreliable and fix it.

```python
words = {"pear", "fig", "apple"}
for w in words:
    print(w)
```

---

**6.11 — Predict the result**

```python
for i, c in enumerate("abc"):
    print(i, c)
print("---")
for i, c in enumerate("abc", start=1):
    print(i, c)
```

---

**6.12 — Compare near-matches**

Snippet **A**:

```python
xs = ["a", "b", "c"]
for i in range(len(xs)):
    print(i, xs[i])
```

Snippet **B**:

```python
xs = ["a", "b", "c"]
for i, x in enumerate(xs):
    print(i, x)
```

Predict both. Then name one situation where **A** is still the right choice.

---

**6.13 — Predict the result**

```python
print(list(zip([1, 2, 3], "xy")))
for a, b in zip([1, 2, 3], "xy"):
    print(a, b)
```

---

**6.14 — Compare near-matches**

Snippet **A**:

```python
xs = [n * 2 for n in range(4)]
print(xs, type(xs).__name__)
```

Snippet **B**:

```python
xs = (n * 2 for n in range(4))
print(xs is not None, type(xs).__name__)
print(list(xs))
```

Predict what each `type(...)` line reports and say which punctuation mark decides
it.

---

**6.15 — Find and fix**

The intent is a 3×3 grid of independent rows, built for any size. Say why this
fails and fix it using a comprehension.

```python
size = 3
grid = [[0] * size] * size
grid[0][0] = 1
print(grid)
```

---

**6.16 — Predict the result**

```python
data = {"a": [1, 2], "b": [3]}
lengths = {k: len(v) for k, v in data.items()}
print(lengths)
print(data)
```

Did the comprehension change `data`?

---

**6.17 — Find and fix**

The intent is to remove every key whose value is 0. Say what happens and fix it.

```python
counts = {"a": 1, "b": 0, "c": 0}
for k in counts:
    if counts[k] == 0:
        del counts[k]
print(counts)
```

---

**6.18 — Write a small program**

Given `text = "hello world"`, write a loop that builds a dictionary counting how
many times each character appears, skipping spaces. Then print the counts in
alphabetical order of the character. Requirements: no comprehension, use
`.get(...)` or an `if`, and produce a stable printed order.

---

**6.19 — Predict the result**

```python
xs = [1, 2, 3]
it = iter(xs)
print(next(it))
print(next(it))
for x in it:
    print("loop", x)
print(list(it))
```

---

**6.20 — State the rule**

Answer each in one plain sentence, then again using the formal term:

1. What does a `for` loop hand you when you loop over a dictionary?
2. What is the difference between `[...]` and `(...)` around a comprehension?
3. Why can you loop over a `range` twice but not a generator?
4. What must be true of an object for it to be a set item?

---

## Checkpoint 6

**C6.1** — Predict:

```python
d = {"x": 1}
for k in d:
    print(k + "!")
```

**C6.2** — Which of these can be walked more than once?
`[1, 2, 3]` · `range(3)` · `(n for n in range(3))` · `"abc"` · `{1, 2}` ·
`{"a": 1}.items()`

**C6.3** — Predict and explain:

```python
g = (n for n in range(5))
print(2 in g)
print(list(g))
```

**C6.4** — A learner writes `for i, x in xs:` where `xs = [1, 2, 3]` and gets an
error. Explain what unpacking expects and what would fix it.

**C6.5** — Rewrite using a comprehension:

```python
out = []
for w in ["ann", "bo", "cy"]:
    if len(w) > 2:
        out.append(w.upper())
```

**C6.6** — In one sentence each, using the formal terms: what is an *iterable*,
what is a *loop variable*, and what does *hashable* mean?

---

---

# Stage 6 — Answer Key

---

### 6.1 — Predict the result

**Answer.**

```text
h 1
i 1
```

**Reasoning.** Iterating a string hands you one-character *strings*, not some
separate character type. That is why `len(c)` is 1 rather than an error.

**Targeted misconception.** That a string yields something other than strings, or
that `for c in "hi"` needs an index.

**If you missed it.** Syntax-reading error.

*Authoring record — Target: strings as iterables. Prereq: 5.1. Syntax lens: string
as the iterable. Flow lens: two passes. Object lens: two new one-character
strings.*

---

### 6.2 — Predict the result

**Answer.**

```text
ann
bo
---
30
25
```

**Reasoning.** A dictionary iterates its **keys** by default; `.values()` asks for
the other half. Both come out in insertion order (Stage 3).

**Targeted misconception.** That looping a dictionary yields values, or pairs.

**If you missed it.** Syntax-reading error.

*Authoring record — Target: default dictionary iteration. Prereq: 3.6, 5.1.
Syntax lens: bare `d` versus `d.values()`. Flow lens: two passes each. Object
lens: no change.*

---

### 6.3 — Compare near-matches

**Answer.** Both print:

```text
a 1
b 2
```

**Advantages.** **A** is the right shape when you mostly want keys and only
occasionally need a value — and it keeps working if you want to look up something
*other* than `d[k]`. **B** avoids repeating the lookup, which is both faster and
harder to get wrong (in **A** you can accidentally look up the wrong dictionary,
or a stale key).

**Targeted misconception.** That `.items()` changes the loop's behavior rather
than just what it hands you.

**If you missed it.** Syntax-reading error.

*Authoring record — Target: two idioms for the same walk. Prereq: 6.2. Syntax
lens: single loop variable versus unpacking. Flow lens: identical. Object lens:
`.items()` yields tuples.*

---

### 6.4 — Label the code

**Answer.** `for` opens a loop and a **block**, ended by the colon.
`scores.items()` produces an **iterable** of two-item tuples, one per key–value
pair. `k, v` are two **loop variables**: each pass takes the tuple handed over and
**unpacks** it, **binding** `k` to the first item and `v` to the second. The
indented block then runs once per pass.

**Reasoning.** The sentence must contain the unpacking step. `k, v` is not a
compound name; it is two names being bound from one tuple.

**Targeted misconception.** That `k, v` is special `for`-loop syntax rather than
ordinary unpacking.

**If you missed it.** Vocabulary-only if you described it correctly in plain
words.

*Authoring record — Target: name the parts formally. Prereq: 6.3. Syntax lens:
`for a, b in ...:`. Flow lens: one pass per pair. Object lens: two bindings per
pass.*

---

### 6.5 — Predict the result

**Answer.**

```text
1 a
2 b
(1, 'a') 2
(2, 'b') 2
```

**Reasoning.** The same iterable hands over the same tuples both times. The only
difference is whether the `for` line unpacks them into two names or binds one
name to the whole tuple. `len(item)` is 2 because each item is a two-item tuple.

**Targeted misconception.** That unpacking is a property of the data rather than
of how the `for` line is written.

**If you missed it.** Syntax-reading error.

*Authoring record — Target: unpacking is optional. Prereq: 6.4. Syntax lens: two
loop variables versus one. Flow lens: two passes each. Object lens: same tuple
objects.*

---

### 6.6 — Predict the result

**Answer.**

```text
[0, 1, 4, 9]
[]
14
```

**Explanation.** The generator is a recipe *in progress*. The first `list(...)`
asked it for everything, which ran the recipe to completion. The second call
asked an exhausted recipe, which has nothing further to produce — so it hands
back an empty list rather than an error. The third line builds a brand-new
generator and consumes that one, giving 0+1+4+9 = 14.

**Targeted misconception.** That a generator stores its values, so re-listing it
replays them; or that exhaustion raises an error.

**If you missed it.** Object-model error. The silent empty result is what makes
this bug hard.

*Authoring record — Target: one-pass consumption. Prereq: 5.5. Syntax lens: round
brackets. Flow lens: recipe advances and cannot rewind. Object lens: generator
holds no items.*

---

### 6.7 — Compare near-matches

**Answer.** **A** prints `3` then `0`. **B** prints `3` then `3`.

**Why.** A `range` is a *description* — "the numbers 0, 1, 2" — and walking it
recomputes from the start each time. A generator is a *position in a
computation*; once it has advanced past the end, that particular generator is
finished forever. Both avoid storing their values; only one can be replayed.

**Targeted misconception.** That "does not store its values" implies "cannot be
reused". Those are separate properties.

**If you missed it.** Object-model error.

*Authoring record — Target: lazy but restartable versus lazy and one-pass.
Prereq: 5.5, 6.6. Syntax lens: `range(3)` versus `(n for n in range(3))`. Flow
lens: two walks. Object lens: exhaustion.*

---

### 6.8 — Find and fix

**Answer.** It prints `6` then `0`.

**Diagnosis.** `sum` walks the generator to its end; the second `sum` finds it
exhausted and totals nothing.

**Smallest fix.** Build a real container once:

```python
values = [n for n in [1, 2, 3]]      # or simply values = [1, 2, 3]
```

**Reasoning.** If you need to walk something twice, it must be a container, not a
recipe. The alternative fix — building a second generator — works but is worth
resisting when the data is small enough to keep.

**Targeted misconception.** That the second `sum` would fail loudly. It fails
silently with a plausible-looking number.

**If you missed it.** Object-model error.

*Authoring record — Target: generator exhaustion in real code. Prereq: 6.6.
Syntax lens: generator expression bound to a name. Flow lens: consumed on first
use. Object lens: no stored items.*

---

### 6.9 — Predict the result

**Answer.**

```text
3
[1, 2, 3]
3
```

**What you cannot safely predict:** the *order* in which the set would hand out
its items if you looped over it directly. The `sorted(...)` line is predictable
precisely because it does not depend on set order. Also note `nums.add(1)`
changed nothing — 1 was already there, and a set holds at most one of each item,
so `len` stays 3.

**Targeted misconception.** That a set preserves the order you typed, or that
adding a duplicate grows it.

**If you missed the last part.** Object-model error.

*Authoring record — Target: set uniqueness and unreliable order. Prereq: 3.9.
Syntax lens: set literal, `.add`. Flow lens: once each. Object lens: one set
object, unchanged by the duplicate add.*

---

### 6.10 — Find and fix

**Answer.** The loop prints the three words in an order determined by how the set
happens to file them. For strings, that filing depends on a value Python
randomizes at start-up, so **the order can differ between runs of the same
program on the same machine**. Code that appeared to work yesterday can print
differently today.

**Fix.**

```python
for w in sorted(words):
    print(w)              # apple, fig, pear
```

**Reasoning.** `sorted` produces a new list in a defined order and leaves the set
alone. If insertion order is what you want, a set was the wrong container — use a
list, or a dictionary with `None` values.

**Targeted misconception.** That observed stability in one run is a guarantee.

**If you missed it.** Object-model error, of the "I tested it once" variety.

*Authoring record — Target: set order must not be relied on. Prereq: 6.9. Syntax
lens: `sorted(iterable)`. Flow lens: three passes. Object lens: new list produced;
set untouched.*

---

### 6.11 — Predict the result

**Answer.**

```text
0 a
1 b
2 c
---
1 a
2 b
3 c
```

**Reasoning.** `enumerate` hands over `(position, item)` tuples, unpacked into two
names. `start=` changes only the first number handed over — it does not skip the
first item.

**Targeted misconception.** That `start=1` begins at the second character.

**If you missed it.** Syntax-reading error.

*Authoring record — Target: `enumerate` and its `start`. Prereq: 6.5. Syntax lens:
keyword argument. Flow lens: three passes each. Object lens: tuples produced per
pass.*

---

### 6.12 — Compare near-matches

**Answer.** Both print:

```text
0 a
1 b
2 c
```

**When A is still right.** When you need the *position* for something other than
fetching the item — writing back into the list (`xs[i] = ...`, Exercise 5.9),
indexing a second list at the same position, or looking ahead at `xs[i + 1]`.
`enumerate` is for when you want the item and its position; `range(len(...))` is
for when you want to *address* positions.

**Targeted misconception.** That `range(len(xs))` is always a beginner's mistake.
It has a real use; using it *only* to then write `xs[i]` is the mistake.

**If you missed it.** Syntax-reading error.

*Authoring record — Target: choose between position and item iteration. Prereq:
5.9, 6.11. Syntax lens: two loop headers. Flow lens: identical. Object lens: no
change.*

---

### 6.13 — Predict the result

**Answer.**

```text
[(1, 'x'), (2, 'y')]
1 x
2 y
```

**Reasoning.** `zip` stops at the shorter iterable, so the `3` is never reached
and is silently dropped. That silence is worth knowing about: a length mismatch
does not announce itself.

**Targeted misconception.** That `zip` pads the shorter one or raises an error.

**If you missed it.** Flow error.

*Authoring record — Target: `zip` truncates. Prereq: 6.11. Syntax lens: `zip(a, b)`
with unpacking. Flow lens: two passes, not three. Object lens: tuples produced.*

---

### 6.14 — Compare near-matches

**Answer.** **A** prints `[0, 2, 4, 6] list`. **B** prints `True generator`, then
`[0, 2, 4, 6]`.

**The deciding punctuation:** square brackets versus round brackets. Square
brackets build the whole list immediately; round brackets build a recipe that
produces values on demand and can be walked once.

**Targeted misconception.** That the brackets are interchangeable styling.

**If you missed it.** Syntax-reading error with an object-model consequence.

*Authoring record — Target: comprehension versus generator expression. Prereq:
6.6. Syntax lens: bracket type. Flow lens: eager versus lazy. Object lens: list
object versus generator object.*

---

### 6.15 — Find and fix

**Answer.** It prints `[[1, 0, 0], [1, 0, 0], [1, 0, 0]]` — one inner list,
pointed at three times, exactly as in 4.6.

**Fix.**

```python
size = 3
grid = [[0] * size for _ in range(size)]
grid[0][0] = 1
print(grid)           # [[1, 0, 0], [0, 0, 0], [0, 0, 0]]
```

**Reasoning.** The comprehension **re-evaluates** `[0] * size` on every pass, so
three separate lists are produced. This is the same repair as writing the three
literals out by hand (4.9), generalized to any size — and it is why comprehensions
are the standard idiom for building grids.

**Targeted misconception.** That the comprehension is merely shorter. Its
re-evaluation is the substance.

**If you missed it.** Object-model error. Go back to 4.6 and 4.7.

*Authoring record — Target: comprehension as the general repetition repair.
Prereq: 4.6, 4.9, 6.14. Syntax lens: comprehension with an unused loop variable.
Flow lens: inner expression evaluated once per pass. Object lens: three distinct
inner lists.*

---

### 6.16 — Predict the result

**Answer.**

```text
{'a': 2, 'b': 1}
{'a': [1, 2], 'b': [3]}
```

No — the comprehension did not change `data`. It read it and produced a new
dictionary.

**Reasoning.** Comprehensions always produce a new object. They are expressions,
and expressions do not write into what they walk.

**Targeted misconception.** That a dictionary comprehension updates the
dictionary it iterates.

**If you missed it.** Object-model error.

*Authoring record — Target: dictionary comprehension produces a new object.
Prereq: 6.3, 6.14. Syntax lens: `{k: expr for k, v in ...}`. Flow lens: two
passes. Object lens: two dictionaries; the inner lists are shared but unchanged.*

---

### 6.17 — Find and fix

**Answer.** It raises `RuntimeError: dictionary changed size during iteration`.

**Why.** Deleting a key while the loop is walking the dictionary invalidates the
walk. Unlike a list — which shrinks silently and skips items (5.13) — a dictionary
detects the change and stops you.

**Fix.** Walk a snapshot of the keys:

```python
for k in list(counts):
    if counts[k] == 0:
        del counts[k]
print(counts)         # {'a': 1}
```

`list(counts)` builds a separate list of the keys first, so deleting from the
dictionary cannot disturb it. A comprehension is the other idiomatic fix:
`counts = {k: v for k, v in counts.items() if v != 0}` — though note this
*rebinds* `counts` rather than changing the original dictionary, which matters if
another name points at it.

**Targeted misconception.** That deleting the current key is safe.

**If you missed it.** Flow error. Compare 5.13: the same mistake, one container
loud and one silent.

*Authoring record — Target: mutation during dictionary iteration. Prereq: 5.13,
6.2. Syntax lens: `del d[k]` inside a body. Flow lens: raises on the first
deletion. Object lens: snapshot list versus live dictionary.*

---

### 6.18 — Write a small program

**Answer.**

```python
text = "hello world"
counts = {}
for c in text:
    if c == " ":
        continue
    counts[c] = counts.get(c, 0) + 1
for c in sorted(counts):
    print(c, counts[c])
```

Output:

```text
d 1
e 1
h 1
l 3
o 2
r 1
w 1
```

**Reasoning.** Three ideas combine. `counts.get(c, 0)` supplies a starting value
for a key that is not there yet, avoiding a `KeyError` without a separate `if`
(3.12 — and note it does *not* insert; the `counts[c] = ...` on the same line
does). `continue` skips the space without nesting the rest of the body in an
`if`. `sorted(counts)` walks the keys in a defined order, which is the only way
to get a stable printout — a dictionary's own order here would be
first-appearance order (`h e l o w r d`), which is stable but not alphabetical.

**Targeted misconception.** That `counts[c] += 1` works on a missing key. It does
not — it must read the key first, and reading a missing key raises.

**If you missed it.** Object-model error if you tried to read a missing key;
syntax-reading if the ordering step was skipped.

*Authoring record — Target: build a dictionary in a loop with a default. Prereq:
3.12, 5.12, 6.10. Syntax lens: `.get` with default, `continue`, `sorted`. Flow
lens: eleven passes, one skipped body. Object lens: one dictionary changed
repeatedly.*

---

### 6.19 — Predict the result

**Answer.**

```text
1
2
loop 3
[]
```

**Reasoning.** `iter(xs)` produces an **iterator** — a one-pass position marker
over the list, the same kind of object a `for` loop makes for you invisibly.
`next` advances it. The `for` loop then picks up *where the iterator already is*,
so it sees only what remains. By the last line it is exhausted.

This is what a `for` loop has been doing all along: it calls `iter` on whatever
you give it and then repeatedly calls `next` until there is nothing left. A
generator is simply an iterator you can write yourself — which is why 6.6 and 6.7
came out as they did.

**Targeted misconception.** That the `for` loop restarts from the beginning of
`xs`, since `xs` still has three items.

**If you missed it.** Object-model error. Note that `xs` is untouched throughout —
the iterator's position is not part of the list.

*Authoring record — Target: the iterator underneath every `for`. Prereq: 6.6, 6.7.
Syntax lens: `iter`/`next`. Flow lens: shared position across two constructs.
Object lens: iterator object distinct from the list.*

---

### 6.20 — State the rule

**Answer.**

1. The keys. *Formally:* iterating a dictionary yields its keys; `.values()` and
   `.items()` yield the other views.
2. Square brackets build the whole list now; round brackets build a recipe that
   produces values on demand. *Formally:* a list comprehension versus a generator
   expression — eager versus lazy, multi-pass versus one-pass.
3. Because a range recomputes its numbers from the start each time it is walked,
   while a generator holds a position in a computation that only moves forward.
   *Formally:* a range is a restartable iterable; a generator is its own iterator
   and is exhausted after one pass.
4. It must be the kind of object that cannot change after it is filed. *Formally:*
   it must be hashable — which immutable built-ins are, and lists, sets, and
   dictionaries are not.

**If you missed any.** (1) and (2) syntax-reading; (3) and (4) object-model;
getting the plain sentence right and the term wrong is vocabulary-only.

*Authoring record — Target: generalize the stage in both registers. Prereq:
6.1–6.19. Syntax lens: n/a. Flow lens: eager versus lazy. Object lens: hashability,
exhaustion.*

---

## Checkpoint 6 — Answers

**C6.1** — `x!`. The loop variable is bound to the key, a string, so `+ "!"`
works. **Error type if missed:** syntax-reading. Go back to 6.2.

**C6.2** — Walkable more than once: `[1, 2, 3]`, `range(3)`, `"abc"`, `{1, 2}`,
and `{"a": 1}.items()` (a view, which re-walks the live dictionary). Only
`(n for n in range(3))` is one-pass. **Error type if missed:** object-model. Go
back to 6.7.

**C6.3** — `True` then `[3, 4]`. The `in` test consumed the generator up to and
including the value 2, so only what came after it remains. This is the sharpest
form of the trap: a mere membership test silently ate part of the data.
**Error type if missed:** object-model. Go back to 6.6.

**C6.4** — Unpacking `i, x` requires each item handed over to be a container of
exactly two things; the items here are plain numbers, so Python reports
`TypeError: cannot unpack non-iterable int object`. The fix is `for i, x in
enumerate(xs):`, or `for x in xs:` if the position is not needed.
**Error type if missed:** syntax-reading. Go back to 6.5 and 6.11.

**C6.5** — `out = [w.upper() for w in ["ann", "bo", "cy"] if len(w) > 2]`, which
gives `['ANN']`. **Error type if missed:** syntax-reading. Go back to 6.14.

**C6.6** — An **iterable** is anything a `for` loop can walk. A **loop variable**
is the name the `for` line rebinds on each pass. **Hashable** means the object can
be filed by what it looks like and will not change afterward, so it may be used as
a dictionary key or a set item. **Error type if missed:** vocabulary-only, if you
could say each in plain words. Go back to the table at the top of this stage.

---

## Before moving on

You can now predict what any collection hands you, in what order, and how many
times it can be walked — and you have the formal vocabulary for it. Stage 7 puts
one loop inside another.
