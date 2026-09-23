# Stage 4 — Sharing, Shallow Copies, and Deep Copies

**The one new move:** track the outer object and the inner objects as *separate*
things, and say for any copy exactly which level was duplicated.

---

## What this stage adds

Stages 2 and 3 established that a container holds arrows, not copies. This stage
takes that one sentence seriously and follows it to its consequences, which are
the ones that produce the most baffling bugs in real programs.

This is the hardest stage in the collection. Draw every diagram.

---

## The ideas, in plain language

### A container holds arrows

```python
inner = [1, 2]
outer = [inner, inner]
```

```text
outer ─▶ #2 [ ●, ● ]
              │  │
              ▼  ▼
             #1 [1, 2]
```

One inner list, pointed at from two slots. `outer[0].append(3)` changes what both
slots point at, so `outer` prints as `[[1, 2, 3], [1, 2, 3]]`. Nothing was
duplicated at any point.

### The three levels of "copy"

Given `original = [[1, 2], [3, 4]]`:

**No copy (aliasing).**

```python
same = original
```

One list. Two names. Any change anywhere is visible everywhere.

**One-level copy ("shallow").**

```python
shallow = original[:]        # also list(original), original.copy(), copy.copy(original)
```

A **new outer list**, whose slots point at *the same two inner lists*:

```text
original ─▶ #1 [ ●, ● ]
                 │  │
shallow  ─▶ #3 [ ●, ● ]
                 │  │
                 ▼  ▼
                #2 [1,2]   #4 [3,4]
```

So:

```python
shallow.append([5, 6])   # affects original?  NO  — outer lists are separate
shallow[0].append(99)    # affects original?  YES — inner list is shared
```

Both of those sentences must be sayable on sight. A shallow copy protects the
outer level and nothing below it.

**All-levels copy ("deep").**

```python
import copy
deep = copy.deepcopy(original)
```

New outer list *and* new inner lists, all the way down. Now nothing is shared and
no change through one name can be seen through the other.

Deep copying is not the default answer. It costs time and memory, it duplicates
things you may have wanted shared, and reaching for it reflexively usually means
the sharing was not understood. Use it when you genuinely need an independent
snapshot of a nested structure.

### `+` and `*` on lists both build a new outer list

```python
a = [[0], [1]]
b = a + [[2]]        # new outer list; b's first two slots point at a's inner lists
c = a * 2            # new outer list of four slots, pointing at a's TWO inner lists
```

Both are one-level operations, exactly like `[:]`. `*` is the dangerous one,
because it is usually written to *construct* something rather than to copy it:

```python
grid = [[0] * 3] * 3
```

Read it in two steps.

1. `[0] * 3` builds one list, `[0, 0, 0]`.
2. `[ ... ] * 3` builds an outer list with **three slots all pointing at that one
   list**.

```text
grid ─▶ [ ●, ●, ● ]
          │  │  │
          └──┴──┴──▶ [0, 0, 0]
```

So `grid[0][0] = 1` sets what looks like every row's first cell:

```text
[[1, 0, 0], [1, 0, 0], [1, 0, 0]]
```

The printed grid looks right when you build it and wrong the moment you write
into it. It is not a bug in `*`; `*` did exactly what it says — repeat the arrow
three times.

`[0] * 3` is perfectly safe, because the repeated object is a number, which
cannot be changed. The pitfall requires a **changeable** thing being repeated.

**The fix, for a fixed size**, is to write the inner lists separately so each
`[0] * 3` runs on its own:

```python
grid = [[0] * 3, [0] * 3, [0] * 3]
```

Now three inner lists exist. For an arbitrary size you need a loop, which is
Stage 5, or a list comprehension, which is Stage 6. Both work for the same
reason: the inner literal is *re-run* each time.

### Dictionaries copy the same way

`dict(d)` and `d.copy()` are one-level copies. The new dictionary has its own set
of pairs — adding or removing a key affects only one of them — but each key still
points at the very same value object:

```python
d = {"xs": [1, 2]}
e = dict(d)
e["ys"] = [9]         # d is unaffected
e["xs"].append(3)     # d["xs"] is now [1, 2, 3]
```

### The diagnostic question

Whenever a change shows up somewhere you did not expect, ask in this order:

1. Did I copy at all, or only rebind a name?
2. If I copied, which **level** did I copy?
3. Is the object I changed above that level, or below it?

---

## Exercises

---

**4.1 — Draw names and objects**

```python
inner = [1, 2]
outer = [inner, inner]
inner.append(3)
```

Draw the picture, then predict `print(outer)`. How many list objects exist?

---

**4.2 — Predict the result**

```python
original = [[1, 2], [3, 4]]
shallow = original[:]
shallow.append([5, 6])
print(original)
print(shallow)
```

---

**4.3 — Predict the result**

```python
original = [[1, 2], [3, 4]]
shallow = original[:]
shallow[0].append(99)
print(original)
print(shallow)
```

---

**4.4 — Compare near-matches**

Exercises 4.2 and 4.3 differ by one character's worth of intent. State the
general rule they demonstrate, in the form: "A one-level copy protects ... and
does not protect ...".

---

**4.5 — Predict the result**

```python
import copy
original = [[1, 2], [3, 4]]
deep = copy.deepcopy(original)
deep[0].append(99)
print(original)
print(deep)
```

---

**4.6 — Predict the result**

```python
grid = [[0] * 3] * 3
print(grid)
grid[0][0] = 1
print(grid)
```

Explain the second output by counting how many inner list objects exist.

---

**4.7 — Compare near-matches**

Snippet **A**:

```python
grid = [[0] * 3] * 3
grid[0][0] = 1
print(grid)
```

Snippet **B**:

```python
grid = [[0] * 3, [0] * 3, [0] * 3]
grid[0][0] = 1
print(grid)
```

Predict both. Say precisely what `[0] * 3` does in each snippet and how many
times it runs.

---

**4.8 — Predict the result**

```python
row = [0] * 3
row[0] = 1
print(row)
```

Why is there no pitfall here?

---

**4.9 — Find and fix**

The intent is a 2×2 board where each cell can be set independently. Show what
goes wrong with a single write, and fix it with the smallest change.

```python
board = [["-"] * 2] * 2
board[0][0] = "X"
print(board)
```

---

**4.10 — Predict the result**

```python
a = [[1], [2]]
b = a + [[3]]
b[0].append(99)
print(a)
print(b)
print(len(a), len(b))
```

---

**4.11 — Draw names and objects**

Draw the picture after every line, keeping the inner lists as separate boxes.

```python
d = {"xs": [1, 2]}
e = dict(d)
e["ys"] = [9]
e["xs"].append(3)
```

Then predict `print(d)` and `print(e)`.

---

**4.12 — Find and fix**

The intent is a snapshot of `state` that is unaffected by any later change. Say
what happens and give the smallest correct fix.

```python
state = {"players": ["ann", "bo"], "round": 1}
snapshot = state.copy()
state["players"].append("cy")
state["round"] = 2
print(snapshot)
```

---

**4.13 — Compare near-matches**

Snippet **A**:

```python
xs = [[1], [2]]
ys = xs
print(xs is ys, xs[0] is ys[0])
```

Snippet **B**:

```python
xs = [[1], [2]]
ys = xs[:]
print(xs is ys, xs[0] is ys[0])
```

Snippet **C**:

```python
import copy
xs = [[1], [2]]
ys = copy.deepcopy(xs)
print(xs is ys, xs[0] is ys[0])
```

Predict all three lines of output and say what the pair of answers tells you in
each case.

---

**4.14 — Write a small program**

Using no loops and no `import`, write code producing a list `rows` such that:

- `rows` has three items, each a list `[0, 0]`;
- `rows[0][0] = 5` changes only the first row;
- and a printed line proves the three inner lists are distinct objects.

Then, in one sentence, say what you would have to change to make all three rows
share one list on purpose.

---

**4.15 — Find and fix**

The intent is to keep `history` as a record of past states. Diagnose the bug and
give the smallest fix.

```python
current = [1, 2]
history = []
history.append(current)
current.append(3)
history.append(current)
print(history)
```

---

**4.16 — Predict the result**

```python
import copy
data = {"a": [1, 2]}
shallow = copy.copy(data)
deep = copy.deepcopy(data)
data["a"].append(3)
print(shallow)
print(deep)
```

---

**4.17 — State the rule**

Complete each sentence in plain language:

> "`b = a[:]` gives me a new ... whose slots point at ..."
>
> "`[x] * n` repeats ... , not ..."
>
> "I should reach for a deep copy only when ..."

---

**4.18 — Find and fix**

This function-free snippet is meant to give each of three students their own
empty score list. Diagnose and fix, and say which single word in the code was the
whole problem.

```python
blank = []
scores = {"ann": blank, "bo": blank, "cy": blank}
scores["ann"].append(10)
print(scores)
```

---

## Checkpoint 4

**C4.1** — After `b = a[:]` where `a = [[1], [2]]`, which of these affect `a`?
`b.append([3])` · `b[0].append(3)` · `b[0] = [3]` · `b = [3]`

**C4.2** — Predict:

```python
xs = [[]] * 2
xs[0].append("a")
print(xs)
```

**C4.3** — In one sentence, why is `[0] * 5` safe when `[[]] * 5` is a trap?

**C4.4** — A learner fixes an aliasing bug by calling `copy.deepcopy` on
everything, everywhere. Give two reasons this is a poor default.

**C4.5** — Draw the picture and predict the output:

```python
a = [1, 2]
container = [a, a[:]]
a.append(3)
print(container)
```

**C4.6** — A change made through name `x` shows up when you print `y`. List the
three questions from "The diagnostic question" and answer them for this snippet:

```python
y = {"k": [1]}
x = y["k"]
x.append(2)
```

---

---

# Stage 4 — Answer Key

---

### 4.1 — Draw names and objects

**Answer.**

```text
inner ─────────────▶ #1 [1, 2, 3]
                        ▲   ▲
outer ─▶ #2 [ ●, ● ] ───┘   │
              └─────────────┘
```

`print(outer)` shows `[[1, 2, 3], [1, 2, 3]]`. Two list objects exist: the outer
one and the single inner one.

**Reasoning.** `[inner, inner]` evaluates the name `inner` twice, but a name
evaluates to *the object it points at* — the same object both times. No
duplication happens anywhere in this snippet.

**Targeted misconception.** That listing a name twice produces two of it, or that
`outer` printing two lists means two lists exist.

**If you missed it.** Object-model error. Note that printing cannot distinguish
one shared list from two equal lists — only a diagram or `is` can.

*Authoring record — Target: containers hold arrows; repeated name is one object.
Prereq: 3.10. Syntax lens: a name appearing twice in a literal. Flow lens: once
each. Object lens: two objects, three arrows into one of them.*

---

### 4.2 — Predict the result

**Answer.**

```text
[[1, 2], [3, 4]]
[[1, 2], [3, 4], [5, 6]]
```

**Reasoning.** `original[:]` built a new outer list. `.append` changes the *outer*
level — the level that was duplicated — so `original` is untouched.

**Targeted misconception.** That a shallow copy is "not a real copy" and so
protects nothing.

**If you missed it.** Object-model error.

*Authoring record — Target: shallow copy protects the outer level. Prereq: 3.16.
Syntax lens: `[:]` then `.append`. Flow lens: once each. Object lens: two outer
lists, two shared inner lists.*

---

### 4.3 — Predict the result

**Answer.**

```text
[[1, 2, 99], [3, 4]]
[[1, 2, 99], [3, 4]]
```

**Reasoning.** `shallow[0]` is not a copy of the first inner list — it *is* the
first inner list, the same object `original[0]` points at. Appending changes it,
and both outer lists have a slot pointing at it.

**Targeted misconception.** That copying a list copies what is inside it.

**If you missed it.** Object-model error. This is the single most important
prediction in the collection; if you got 4.2 right and 4.3 wrong, you have the
level distinction to build on. Redraw both diagrams side by side.

*Authoring record — Target: shallow copy does not protect inner levels. Prereq:
4.2. Syntax lens: `shallow[0].append(...)` — two levels down, no `=`. Flow lens:
once each. Object lens: one inner list shared by two outer lists.*

---

### 4.4 — Compare near-matches

**Answer.** "A one-level copy protects **the outer container — its length, the
order of its slots, and which objects those slots point at** — and does not
protect **the objects those slots point at, which remain shared**."

**Reasoning.** The rule must name both halves. Saying only "it's a shallow copy"
restates the label without saying what the label buys you.

**Targeted misconception.** That copies are all-or-nothing.

**If you missed it.** Vocabulary-only if you had the picture; object-model
otherwise.

*Authoring record — Target: articulate the level rule. Prereq: 4.2, 4.3. Syntax
lens: n/a. Flow lens: n/a. Object lens: level boundary.*

---

### 4.5 — Predict the result

**Answer.**

```text
[[1, 2], [3, 4]]
[[1, 2, 99], [3, 4]]
```

**Reasoning.** `deepcopy` rebuilt every level, so `deep[0]` is a different object
from `original[0]`. Nothing is shared, and the change is confined.

**Targeted misconception.** That `deepcopy` and `[:]` differ only in speed.

**If you missed it.** Object-model error. Compare directly with 4.3 — same third
line, opposite outcome, and the only difference is which copy was used.

*Authoring record — Target: deep copy duplicates every level. Prereq: 4.3. Syntax
lens: `copy.deepcopy(...)`. Flow lens: once each. Object lens: four lists, no
sharing.*

---

### 4.6 — Predict the result

**Answer.**

```text
[[0, 0, 0], [0, 0, 0], [0, 0, 0]]
[[1, 0, 0], [1, 0, 0], [1, 0, 0]]
```

**Explanation.** Exactly **one** inner list object exists. `[0] * 3` ran once,
producing it; `[...] * 3` then built an outer list with three slots all pointing
at that one object. Writing `grid[0][0] = 1` writes into it, and all three slots
show the result.

**Targeted misconception.** That `*` on a list of lists produces independent
copies of the inner list.

**If you missed it.** Object-model error. The give-away is that the *first* print
looks perfect — construction is not where the bug shows.

*Authoring record — Target: the nested repetition pitfall. Prereq: 4.1. Syntax
lens: two applications of `*`, read innermost first. Flow lens: inner literal runs
once. Object lens: two objects, three arrows to one.*

---

### 4.7 — Compare near-matches

**Answer.** **A** prints `[[1, 0, 0], [1, 0, 0], [1, 0, 0]]`. **B** prints
`[[1, 0, 0], [0, 0, 0], [0, 0, 0]]`.

**What `[0] * 3` does, and how often.** In **A** it runs **once**, producing one
list, which `* 3` then points at three times. In **B** it is written three
separate times and therefore runs **three times**, producing three distinct
lists; the outer literal's slots point at three different objects.

**Reasoning.** The number of times a literal or an expression *runs* is the number
of objects it produces. `*` does not re-run anything — it copies arrows.

**Targeted misconception.** That the two spellings are equivalent shorthand.

**If you missed it.** Flow error as much as object-model: you did not ask how many
times the inner expression ran.

*Authoring record — Target: repetition versus re-evaluation. Prereq: 4.6. Syntax
lens: `[x] * n` versus an explicit literal. Flow lens: evaluation count. Object
lens: one inner object versus three.*

---

### 4.8 — Predict the result

**Answer.** `[1, 0, 0]`. No pitfall.

**Why.** The repeated object is the number `0`, which cannot be changed. The list
does contain the same `0` object three times, but there is no operation that
could make one of those slots' object "become" something else — the only way to
alter the list is to write a slot, and writing a slot repoints exactly one slot.
The trap needs a *changeable* repeated object.

**Targeted misconception.** That `*` is inherently unsafe, so `[0] * 3` must be
avoided too. Over-correcting is its own error.

**If you missed it.** Object-model error.

*Authoring record — Target: the pitfall's precondition. Prereq: 4.6, 2.1. Syntax
lens: `[0] * 3`. Flow lens: once. Object lens: repeated unchangeable object.*

---

### 4.9 — Find and fix

**Answer.** It prints `[['X', '-'], ['X', '-']]` — one write appeared to change
both rows, because there is one row.

**Smallest fix.**

```python
board = [["-"] * 2, ["-"] * 2]
board[0][0] = "X"
print(board)          # [['X', '-'], ['-', '-']]
```

**Reasoning.** The fix must make the inner literal run twice. `board[:]`,
`list(board)`, or `copy.copy(board)` would **not** help — they duplicate the outer
level, which was never the problem. `copy.deepcopy(board)` would produce two rows
but only *after* the damage of having built one, and it is a heavier tool than
the situation needs.

**Targeted misconception.** That any copying operation fixes any sharing problem.

**If you missed it.** Object-model error, specifically about which level to
intervene at.

*Authoring record — Target: repair at the correct level. Prereq: 4.6, 4.7. Syntax
lens: `["-"] * 2` inside `* 2`. Flow lens: inner expression evaluation count.
Object lens: one inner list versus two.*

---

### 4.10 — Predict the result

**Answer.**

```text
[[1, 99], [2]]
[[1, 99], [2], [3]]
2 3
```

**Reasoning.** `a + [[3]]` builds a new outer list of length 3 whose first two
slots point at `a`'s existing inner lists. So `b[0]` *is* `a[0]`, and appending
99 shows through both. The differing lengths confirm the outer lists are separate
objects.

**Targeted misconception.** That `+` produces an independent structure because it
"makes a new list" — true of the outer level only.

**If you missed it.** Object-model error. `+` is a one-level operation, exactly
like `[:]`.

*Authoring record — Target: `+` is a shallow operation. Prereq: 2.3, 4.3. Syntax
lens: `a + [[3]]`. Flow lens: once each. Object lens: two outer lists sharing two
inner ones.*

---

### 4.11 — Draw names and objects

**Answer.**

```text
after line 1:  d ─▶ #1 {"xs": ●}
                             └──▶ #2 [1, 2]

after line 2:  d ─▶ #1 {"xs": ●} ──┐
               e ─▶ #3 {"xs": ●} ──┴──▶ #2 [1, 2]

after line 3:  d ─▶ #1 {"xs": ●} ──┐
               e ─▶ #3 {"xs": ●, "ys": ●} ─┴──▶ #2 [1, 2]
                                       └──▶ #4 [9]

after line 4:  same shape; #2 is now [1, 2, 3]
```

`print(d)` shows `{'xs': [1, 2, 3]}`. `print(e)` shows
`{'xs': [1, 2, 3], 'ys': [9]}`.

**Reasoning.** `dict(d)` duplicated the *set of pairs*, so adding `"ys"` touched
only `e`. It did not duplicate the value objects, so `e["xs"]` and `d["xs"]` are
one list.

**Targeted misconception.** That dictionaries copy differently from lists. They
do not — the level rule is identical.

**If you missed it.** Object-model error.

*Authoring record — Target: shallow copy of a dictionary. Prereq: 4.2, 4.3, 3.18.
Syntax lens: `dict(d)`, key write, value-method call. Flow lens: once each. Object
lens: two dictionaries, two lists, one shared.*

---

### 4.12 — Find and fix

**Answer.** It prints `{'players': ['ann', 'bo', 'cy'], 'round': 1}`. The
snapshot caught the `round` change (it did not follow it) but not the `players`
change (it did follow that one), which is the worst of both worlds — a snapshot
that is half stale is harder to notice than one that is wholly wrong.

**Smallest correct fix.**

```python
import copy
snapshot = copy.deepcopy(state)
```

**Reasoning.** This is the situation deep copying is *for*: the requirement is
explicitly an independent snapshot of a nested structure. Contrast 4.9, where the
requirement was to build independent rows and deep copying would have been a
heavy fix for a construction mistake. The question that separates them: *do I
need a frozen record of something nested (deep copy), or did I fail to create
distinct objects in the first place (build them separately)?*

**Targeted misconception.** That `.copy()` means "make an independent copy".

**If you missed it.** Object-model error.

*Authoring record — Target: when deep copying is the right tool. Prereq: 4.5,
4.11. Syntax lens: `.copy()` versus `copy.deepcopy`. Flow lens: once each. Object
lens: shared inner list defeats the snapshot.*

---

### 4.13 — Compare near-matches

**Answer.**

- **A** prints `True True` — one outer list, so of course one set of inner lists.
- **B** prints `False True` — different outer objects, *same* inner object. This
  pair of answers is the signature of a one-level copy.
- **C** prints `False False` — nothing shared at any level.

**What the pair tells you.** Reading the two booleans as a pair identifies the
copy depth without any diagram: `True True` = no copy, `False True` = one level,
`False False` = deep.

**Targeted misconception.** That `is` on the outer object settles the question.
It settles one level only.

**If you missed it.** Object-model error.

*Authoring record — Target: diagnose copy depth with `is`. Prereq: 4.2, 4.3, 4.5.
Syntax lens: `is` at two levels. Flow lens: once each. Object lens: identity per
level.*

---

### 4.14 — Write a small program

**Answer.**

```python
rows = [[0, 0], [0, 0], [0, 0]]
rows[0][0] = 5
print(rows)                              # [[5, 0], [0, 0], [0, 0]]
print(rows[0] is rows[1], rows[1] is rows[2])   # False False
```

**To share on purpose**, bind the inner list to a name and use that name three
times — `shared = [0, 0]` then `rows = [shared, shared, shared]` — or write
`[[0, 0]] * 3`. Sharing is a legitimate thing to want; it just has to be
deliberate.

**Reasoning.** Three separately written literals run three times and produce three
objects. The `is` line is the proof; printing alone would look identical in both
designs.

**Targeted misconception.** That equal-looking rows must be distinct objects.

**If you missed it.** Object-model error.

*Authoring record — Target: construct independence deliberately. Prereq: 4.7,
4.13. Syntax lens: repeated literals. Flow lens: three evaluations. Object lens:
three distinct inner objects.*

---

### 4.15 — Find and fix

**Answer.** It prints `[[1, 2, 3], [1, 2, 3]]`. Both entries in `history` are the
same list — the one `current` points at — so the "past state" was overwritten by
the later change, and appending it a second time just added a second arrow to it.

**Smallest fix.** Store a copy at the moment of recording:

```python
history.append(current[:])
...
history.append(current[:])
```

**Reasoning.** Recording a changeable object stores a *live view*, not a
historical fact. Any log, undo stack, or audit trail that appends a changeable
object without copying has this bug. If `current` contained nested lists, `[:]`
would not be enough and `copy.deepcopy` would be right.

**Targeted misconception.** That appending to a list "saves" what the object
looked like at that moment.

**If you missed it.** Object-model error — and the most consequential one in this
stage, because the symptom appears far from the cause.

*Authoring record — Target: snapshot-versus-live-view in accumulation. Prereq:
4.12. Syntax lens: `.append(name)` versus `.append(name[:])`. Flow lens: two
appends around one change. Object lens: two arrows to one list.*

---

### 4.16 — Predict the result

**Answer.**

```text
{'a': [1, 2, 3]}
{'a': [1, 2]}
```

**Reasoning.** `copy.copy` is precisely a one-level copy — the same depth as
`dict(d)` or `[:]` — so `shallow["a"]` is the same list that was changed. `deep`
has its own list and shows the state as of the moment of copying.

**Targeted misconception.** That `copy.copy` is deeper than `.copy()` because it
comes from a module.

**If you missed it.** Object-model error.

*Authoring record — Target: `copy.copy` is shallow. Prereq: 4.5, 4.11. Syntax
lens: two functions from `copy`. Flow lens: once each. Object lens: one shared
list, one duplicated.*

---

### 4.17 — State the rule

**Answer.**

> "`b = a[:]` gives me a new **outer list** whose slots point at **the very same
> objects `a`'s slots point at**."
>
> "`[x] * n` repeats **the arrow to one object**, not **the object itself**."
>
> "I should reach for a deep copy only when **I need an independent snapshot of a
> nested structure that will keep changing** — not as a routine fix for sharing I
> have not understood."

**Targeted misconception.** Each sentence targets a different one: that copying is
total; that repetition duplicates; that deep copying is a general safety measure.

**If you missed it.** Vocabulary-only if the ideas were right.

*Authoring record — Target: generalize the whole stage. Prereq: 4.1–4.16. Syntax
lens: n/a. Flow lens: n/a. Object lens: levels.*

---

### 4.18 — Find and fix

**Answer.** It prints `{'ann': [10], 'bo': [10], 'cy': [10]}`.

**The problem word: `blank`.** Using a name puts *that one object* into all three
slots. Nothing about the word "blank" makes Python produce a fresh list per use.

**Fix.**

```python
scores = {"ann": [], "bo": [], "cy": []}
```

Now the empty-list literal runs three times and produces three lists.

**Reasoning.** Same shape as 4.6 and 4.14, in dictionary clothing: a name
evaluates to an existing object, a literal creates a new one. Naming something to
signal "a fresh empty one" does not make it so — this is how the bug survives
code review.

**Targeted misconception.** That an empty list is a kind of value, so all empty
lists are interchangeable.

**If you missed it.** Object-model error.

*Authoring record — Target: name reuse versus repeated literal, in a dictionary.
Prereq: 4.1, 4.14. Syntax lens: a name used three times as a value. Flow lens: one
evaluation of `[]`. Object lens: one list, three arrows.*

---

## Checkpoint 4 — Answers

**C4.1** — Only `b[0].append(3)` affects `a`. `b.append([3])` and `b[0] = [3]`
change `b`'s own outer list; `b = [3]` does not change any object at all, it just
moves the name `b`. **Error type if missed:** object-model. Go back to 4.2, 4.3.

**C4.2** — `[['a'], ['a']]`. One inner list, two slots.
**Error type if missed:** object-model. Go back to 4.6.

**C4.3** — Because `0` cannot be changed, so having the same `0` in five slots is
indistinguishable from having five, whereas the same empty list in five slots can
be changed once and appear to change five times.
**Error type if missed:** object-model. Go back to 4.8.

**C4.4** — Any two of: it duplicates objects that were meant to be shared, so the
program silently stops working as designed; it costs time and memory proportional
to the whole structure; it hides the real question of which level needed
protecting, so the next bug of this kind is just as mysterious; and it can fail or
behave oddly on objects that are not meant to be duplicated.
**Error type if missed:** object-model. Go back to 4.12.

**C4.5** —

```text
a         ─────▶ #1 [1, 2, 3]
                    ▲
container ─▶ #3 [ ●, ● ]
                 │   └──▶ #2 [1, 2]
                 └────────┘  (to #1)
```

Output: `[[1, 2, 3], [1, 2]]`. The first slot points at `a`'s list; the second
points at a one-level copy made *before* the append.
**Error type if missed:** object-model. Go back to 4.1 and 4.15.

**C4.6** — (1) *Did I copy at all?* No — `x = y["k"]` is a lookup, which produces
the existing object, not a copy. (2) *Which level did I copy?* None. (3) *Is the
object I changed above or below the copy level?* There is no copy level; `x` and
`y["k"]` are one list, so the change is shared. Output would be `{'k': [1, 2]}`.
**Error type if missed:** object-model. Go back to 3.13 and 4.3.

---

## Before moving on

You can now say, for any copy, which level was duplicated, and predict exactly
which changes cross between two structures. Stage 5 changes subject entirely: the
same object model, but lines that run more than once.
