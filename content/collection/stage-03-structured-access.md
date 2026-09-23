# Stage 3 — Reading Brackets and Keys Precisely

**The one new move:** read an access expression exactly — which container, which
position or key, and whether the line is *reading out of* it or *writing into* it.

---

## What this stage adds

Stage 2 ended on an unfinished thought: a line can have an `=` in it and still
not move any name, because the left-hand side is a *slot inside an object*. This
stage is about slots — positions in a list, keys in a dictionary — and about
reading nested access without guessing.

---

## The ideas, in plain language

### Indexing reads a slot

```python
items = ["a", "b", "c"]
items[1]            # "b"
```

`items[1]` means: *look at the object `items` points at, go to position 1, and
hand back whatever object is sitting there.* Positions count from 0. Negative
positions count from the end: `items[-1]` is the last item, `items[-2]` the one
before.

An index that does not exist is an error, not a blank: `items[3]` raises
`IndexError`. Python will not invent a slot for you.

### Indexing on the left of `=` writes a slot

```python
items[1] = "z"      # items is now ["a", "z", "c"]
```

Nothing rebinds `items`. The same list object is still there, wearing the same
name; one of its slots now points somewhere else. This is a **change**, in the
exact sense of Stage 2, and every other name pointing at that list will see it.

The one-line test from Stage 2, restated: *bare name left of `=` → a name moves;
anything with brackets or a dot left of `=` → an object changes.*

### Slicing reads several slots — and builds a new list

```python
items = ["a", "b", "c", "d"]
part = items[1:3]   # ["b", "c"]
```

`items[1:3]` takes from position 1 up to *but not including* position 3. The
result is a **new list object**. `items[:]` therefore means "a new list holding
everything" — which is why it was the fix in Exercise 2.11.

The new list is new, but the objects *inside* it are the same objects. Hold that
thought; Stage 4 is about exactly this sentence.

### Dictionaries: lookup by key, not by position

```python
ages = {"ann": 30, "bo": 25}
ages["ann"]         # 30
ages["cy"]          # KeyError
ages["cy"] = 41     # adds a new pair
ages["ann"] = 31    # replaces the value for an existing key
```

`mapping[key]` reads *"find the value paired with this key"*. There is one
bracket syntax for two different write behaviors, and which one you get depends
only on whether the key is already present: **absent key → add; present key →
replace**. There is no separate "add" syntax to forget.

`ages.get("cy")` hands back `None` instead of raising, and `ages.get("cy", 0)`
hands back `0`. Use them when a missing key is expected, not to paper over a
typo.

### `in` on a dictionary asks about keys

```python
"ann" in ages       # True
30 in ages          # False — 30 is a value, not a key
```

Iterating a dictionary (Stage 6) also gives you keys by default. Dictionaries are
key-shaped from the outside.

### What may be a key

A key must be **unchangeable** — a number, a text object, a tuple of
unchangeable things. Lists cannot be keys:

```python
d = {}
d[[1, 2]] = "x"     # TypeError: unhashable type: 'list'
d[(1, 2)] = "x"     # fine
```

The reason, in plain language: a dictionary files each key by what it looks like.
If a key could change after filing, the dictionary would no longer be able to
find it. The formal word for "may be used as a key" is **hashable**, and it
arrives properly in Stage 6. The same requirement applies to items of a set.

A tuple that contains a list is *not* acceptable, because that tuple can still
look different later — a direct consequence of Exercise 2.10.

### Order

A dictionary keeps its pairs in the order they were first inserted. Replacing an
existing key's value does **not** move it to the end. A set keeps no order you
may rely on. Stage 6 does the ordering rules properly; for now, just do not
assume a set will hand you anything in the order you typed it.

### Nested access reads left to right

```python
grid = [[1, 2], [3, 4]]
grid[1][0]          # 3
```

Read it in two steps, never as one symbol: `grid[1]` produces the inner list
`[3, 4]`; then `[0]` is applied *to that result*, producing `3`. The same
left-to-right rule handles `data["users"][0]["name"]`. If you can say aloud what
each step produced, you cannot get lost.

---

## Exercises

---

**3.1 — Label the code**

Say what each line does, and for each, name whether any name moves.

```python
row = [10, 20, 30]
first = row[0]
row[2] = 99
row = row[0:2]
```

---

**3.2 — Predict the result**

```python
letters = ["a", "b", "c", "d"]
print(letters[1])
print(letters[-1])
print(letters[1:3])
print(letters)
```

---

**3.3 — Compare near-matches**

Snippet **A**:

```python
xs = [1, 2, 3]
ys = xs
ys[0] = 99
print(xs)
```

Snippet **B**:

```python
xs = [1, 2, 3]
ys = xs[:]
ys[0] = 99
print(xs)
```

Predict both. Name the line that makes the difference, and say what it produces.

---

**3.4 — Predict the result**

```python
grid = [[1, 2], [3, 4]]
print(grid[0])
print(grid[0][1])
print(grid[-1][0])
print(len(grid))
print(len(grid[0]))
```

---

**3.5 — Label the code**

Read this expression aloud in steps, naming what each step produces.

```python
record = {"name": "ann", "scores": [7, 9, 8]}
value = record["scores"][1]
```

---

**3.6 — Predict the result**

```python
ages = {"ann": 30, "bo": 25}
ages["cy"] = 41
ages["ann"] = 31
print(ages)
print(len(ages))
```

Note the order of the printed pairs and say why it is that order.

---

**3.7 — Find and fix**

The intent is to print `25`. Say what happens instead and fix it.

```python
ages = {"ann": 30, "bo": 25}
print(ages[1])
```

---

**3.8 — Compare near-matches**

Snippet **A**:

```python
d = {"a": 1}
print("a" in d)
print(1 in d)
```

Snippet **B**:

```python
xs = ["a", 1]
print("a" in xs)
print(1 in xs)
```

Predict both, then state in one sentence what `in` asks about a dictionary versus
about a list.

---

**3.9 — Predict the result**

```python
d = {}
d[(1, 2)] = "pair"
print(d[(1, 2)])
print(d)
```

Then say what would happen if line 2 were `d[[1, 2]] = "pair"`, and why.

---

**3.10 — Draw names and objects**

Draw the picture after the last line, showing the inner list separately.

```python
inner = [1, 2]
outer = [inner, "x"]
inner.append(3)
```

What does `print(outer)` show?

---

**3.11 — Find and fix**

The intent is to set the second row's first item to 0, leaving everything else
alone. Say what actually happens and fix it.

```python
grid = [[1, 2], [3, 4]]
grid[1] = 0
print(grid)
```

---

**3.12 — Predict the result**

```python
stock = {"apple": 3}
print(stock.get("apple"))
print(stock.get("pear"))
print(stock.get("pear", 0))
print(stock)
```

Did any of these four lines change the dictionary?

---

**3.13 — What runs next?**

Number the lines in execution order and give the output.

```python
board = [["-", "-"], ["-", "-"]]
board[0][1] = "X"
row = board[1]
row[0] = "O"
print(board)
```

Which line changed which object?

---

**3.14 — Compare near-matches**

Snippet **A**:

```python
d = {1: "one", True: "yes"}
print(d)
```

Snippet **B**:

```python
d = {1: "one", "1": "yes"}
print(d)
```

Predict both. **A** is surprising; explain it using the idea that a dictionary
files a key by what it looks like.

---

**3.15 — Write a small program**

Write code that builds a dictionary mapping each of three names to a list of that
person's scores, then:

- adds a fourth score to the second person's list **without** rebuilding the
  dictionary or the list;
- replaces the third person's list entirely with a new one;
- prints the whole dictionary.

Then say, for each of your two modifying lines, whether it changed the dictionary
itself, changed a list inside it, or both.

---

**3.16 — Predict the result**

```python
xs = [1, 2, 3, 4, 5]
print(xs[1:4])
print(xs[:2])
print(xs[3:])
print(xs[:])
print(xs[2:2])
print(xs is xs[:])
```

---

**3.17 — State the rule**

Complete, in plain language:

> "When the left of the `=` has brackets on it, the line changes ..., and the
> name in front of the brackets ..."

Then give the one-sentence rule for how to read `a[b][c]`.

---

**3.18 — Find and fix**

The intent is a fresh copy of `settings` whose changes do not affect the
original. Say what actually happens and fix it with the smallest change.

```python
settings = {"volume": 5}
backup = settings
backup["volume"] = 0
print(settings)
```

---

## Checkpoint 3

**C3.1** — In `row[2] = 7`, which object is changed and which name, if any, is
rebound?

**C3.2** — Predict:

```python
data = {"xs": [1, 2]}
copy = data["xs"]
copy.append(3)
print(data)
```

**C3.3** — Why can a tuple be a dictionary key while a list cannot? Answer in one
sentence, without using the word *hashable*.

**C3.4** — Predict, and name the error if there is one:

```python
xs = [1, 2, 3]
print(xs[3])
```

**C3.5** — Read `menu["drinks"][0]["price"]` aloud in steps, saying what kind of
object each step must produce for the next step to work.

**C3.6** — Two lines both "add to a dictionary": `d["k"] = 1` when `"k"` is
absent, and `d["k"] = 1` when `"k"` is present. What is different about the
resulting dictionary in each case, including its order?

---

---

# Stage 3 — Answer Key

---

### 3.1 — Label the code

**Answer.**

| Line | Event | Name moved? |
|---|---|---|
| `row = [10, 20, 30]` | builds a list, points `row` at it | yes, `row` |
| `first = row[0]` | reads slot 0, points `first` at that object | yes, `first` |
| `row[2] = 99` | changes the list's slot 2 | no |
| `row = row[0:2]` | builds a **new** two-item list, points `row` at it | yes, `row` |

After line 4 the three-item list `[10, 20, 99]` has no name left.

**Reasoning.** Lines 3 and 4 both contain brackets and an `=`, but only line 4
has a bare name on the left. That is the entire difference.

**Targeted misconception.** That any line containing `row` and `=` "updates
`row`" in the same way.

**If you missed it.** Syntax-reading error.

*Authoring record — Target: classify read, write-slot, and rebind. Prereq: 2.16.
Syntax lens: what sits left of `=`. Flow lens: once each. Object lens: two lists;
one changed then abandoned.*

---

### 3.2 — Predict the result

**Answer.**

```text
b
d
['b', 'c']
['a', 'b', 'c', 'd']
```

**Reasoning.** Position 1 is the second item. `-1` is the last. `1:3` stops
before 3, so it yields positions 1 and 2. Slicing reads; it never changes the
original, which is why line 4 shows the list intact.

**Targeted misconception.** That `1:3` includes position 3, or that slicing
removes the sliced part from the original.

**If you missed it.** Syntax-reading error.

*Authoring record — Target: index, negative index, slice bounds. Prereq: 3.1.
Syntax lens: `[i]`, `[-i]`, `[a:b]`. Flow lens: once each. Object lens: one new
list produced by the slice; original untouched.*

---

### 3.3 — Compare near-matches

**Answer.** **A** prints `[99, 2, 3]`. **B** prints `[1, 2, 3]`.

**The difference is line 2.** In **A** it copies an arrow, so both names are on
one list and the slot-write on line 3 is visible through `xs`. In **B**, `xs[:]`
*produces a new list object*, so line 3 writes into a slot of a list that only
`ys` points at.

**Targeted misconception.** That `[:]` is decorative punctuation, or that writing
a slot is somehow more "local" than other changes.

**If you missed it.** Object-model error. Note this is exercise 2.11 again with
slot-writing instead of `.append` — same event, different syntax.

*Authoring record — Target: slice-copy versus alias, tested via slot write.
Prereq: 2.11, 3.1. Syntax lens: `xs` versus `xs[:]` on the right. Flow lens:
identical. Object lens: one list versus two.*

---

### 3.4 — Predict the result

**Answer.**

```text
[1, 2]
2
3
2
2
```

**Reasoning.** `grid[0]` produces the inner list itself, not a number. `grid[0][1]`
is two steps: inner list, then its position 1. `grid[-1]` is `[3, 4]`, so
`grid[-1][0]` is `3`. `len(grid)` counts the *rows* — two — not the six-ish
things you might feel are in there.

**Targeted misconception.** That `len` on a nested list counts everything, or
that `grid[0][1]` means "row 0 and row 1".

**If you missed it.** Syntax-reading error. Say each bracket step aloud.

*Authoring record — Target: nested indexing left to right; `len` counts one
level. Prereq: 3.2. Syntax lens: chained brackets. Flow lens: once each. Object
lens: inner lists are objects in their own right.*

---

### 3.5 — Label the code

**Answer.** Step 1: `record` points at a dictionary. Step 2: `record["scores"]`
looks up the key `"scores"` and produces the list object `[7, 9, 8]`. Step 3:
`[1]` is applied to *that list* and produces the number `9`. Step 4: `value` is
pointed at `9`.

**Reasoning.** The expression is read strictly left to right, and each step must
produce something the next step can be applied to. If `record["scores"]` had
produced a number, the `[1]` would have failed.

**Targeted misconception.** That `record["scores"][1]` is a single two-part key.

**If you missed it.** Syntax-reading error.

*Authoring record — Target: verbalize chained access. Prereq: 3.4. Syntax lens:
`[key][index]`. Flow lens: once. Object lens: lookup produces a shared inner
object.*

---

### 3.6 — Predict the result

**Answer.**

```text
{'ann': 31, 'bo': 25, 'cy': 41}
3
```

**Why that order.** A dictionary keeps keys in the order they were **first
inserted**. `"ann"` and `"bo"` were inserted first, in that order. `"cy"` was
added third and goes last. Line 3 replaced `"ann"`'s value but did not re-insert
the key, so `"ann"` stays first.

**Targeted misconception.** That updating a key moves it to the end, or that
dictionaries sort themselves.

**If you missed it.** Object-model error, with an ordering component.

*Authoring record — Target: insertion order; add versus replace. Prereq: 3.1.
Syntax lens: `d[key] = value` with new and existing keys. Flow lens: once each.
Object lens: one dictionary, changed twice.*

---

### 3.7 — Find and fix

**Answer.** It raises `KeyError: 1`.

**Why.** Dictionaries are not indexed by position. `ages[1]` is a lookup for the
key `1`, which is not in the dictionary — the fact that `25` is the "second"
value is irrelevant.

**Fix.** Ask for the key you mean:

```python
print(ages["bo"])
```

**Targeted misconception.** That a dictionary can be indexed like a list because
it also uses square brackets.

**If you missed it.** Syntax-reading error. The bracket punctuation is shared;
what goes inside it means something different for each container.

*Authoring record — Target: dictionary access is by key only. Prereq: 3.2, 3.6.
Syntax lens: `d[...]`. Flow lens: raises on line 2. Object lens: no change.*

---

### 3.8 — Compare near-matches

**Answer.** **A** prints `True` then `False`. **B** prints `True` then `True`.

**The rule.** For a dictionary, `in` asks *"is this one of the keys?"*. For a
list, `in` asks *"is this one of the items?"*.

**Reasoning.** `1` is a *value* in **A**'s dictionary, and `in` never looks at
values. (`1 in d.values()` would be the question that does.)

**Targeted misconception.** That `in` searches "everything in there".

**If you missed it.** Syntax-reading error, of the "same word, different
container" kind.

*Authoring record — Target: `in` semantics per container. Prereq: 3.6. Syntax
lens: `x in container`. Flow lens: once each. Object lens: no change.*

---

### 3.9 — Predict the result

**Answer.**

```text
pair
{(1, 2): 'pair'}
```

**With a list key**, line 2 would raise `TypeError: unhashable type: 'list'`.

**Why.** A dictionary files each key by what it looks like, so a key must be the
kind of object that cannot look different later. A tuple of numbers qualifies; a
list does not, because it could be changed after filing and the dictionary would
lose track of it.

**Targeted misconception.** That anything can be a key, or that the failure is
about tuples versus lists as *syntax* rather than about changeability.

**If you missed it.** Object-model error — it follows directly from Stage 2's
two kinds of object.

*Authoring record — Target: key requirement. Prereq: 2.9, 3.6. Syntax lens: tuple
literal as a subscript. Flow lens: once each. Object lens: unchangeable key
object.*

---

### 3.10 — Draw names and objects

**Answer.**

```text
inner ──┬───────────────▶ #1 [1, 2, 3]
        │                   ▲
outer ─────▶ #2 [ ●, "x" ] ─┘
```

`outer`'s first slot and the name `inner` point at the same list. `print(outer)`
shows `[[1, 2, 3], 'x']`.

**Reasoning.** `[inner, "x"]` builds a new list whose first slot points at
whatever `inner` points at. It does not copy that list in. So line 3's change is
visible through `outer` too.

**Targeted misconception.** That putting a list inside another list stores a
copy of it.

**If you missed it.** Object-model error. This is the entry point to Stage 4 —
if this one was a surprise, reread it before continuing.

*Authoring record — Target: containers hold arrows, not copies. Prereq: 3.4, 2.2.
Syntax lens: a name used inside a list literal. Flow lens: once each. Object
lens: two lists, one shared.*

---

### 3.11 — Find and fix

**Answer.** It prints `[[1, 2], 0]`. Line 2 replaced the *entire second row* with
the number `0`, because `grid[1]` names the whole row slot.

**Fix.** Reach one level further in:

```python
grid[1][0] = 0
print(grid)           # [[1, 2], [0, 4]]
```

**Reasoning.** Each pair of brackets descends one level. Counting brackets is the
whole diagnosis.

**Targeted misconception.** That `grid[1]` addresses "item 1 of the grid" in a
flattened sense.

**If you missed it.** Syntax-reading error.

*Authoring record — Target: bracket depth on the left of `=`. Prereq: 3.4, 3.1.
Syntax lens: one bracket versus two. Flow lens: once each. Object lens: outer
list slot replaced versus inner list slot replaced.*

---

### 3.12 — Predict the result

**Answer.**

```text
3
None
0
{'apple': 3}
```

No line changed the dictionary. `.get` only reads; it does not insert a default,
and the fourth line proves it.

**Targeted misconception.** That `.get(key, default)` stores the default, the way
some other languages' equivalents do.

**If you missed it.** Object-model error.

*Authoring record — Target: `.get` reads without inserting. Prereq: 3.7. Syntax
lens: method call with an optional second argument. Flow lens: once each. Object
lens: no change.*

---

### 3.13 — What runs next?

**Answer.**

```text
1  board = [["-", "-"], ["-", "-"]]
2  board[0][1] = "X"
3  row = board[1]
4  row[0] = "O"
5  print(board)   →  [['-', 'X'], ['O', '-']]
```

**Which line changed what.** Line 2 changed the first inner list. Line 3 changed
nothing — it only pointed a new name at the second inner list. Line 4 changed
that second inner list, and because `row` and `board[1]` are the same object, the
change shows up in `board`.

**Targeted misconception.** That line 3 extracted a copy of the row, so line 4
would be a private edit.

**If you missed it.** Object-model error. This is the practical form of the
Stage 4 idea: pulling something out of a container gives you the thing, not a
copy of it.

*Authoring record — Target: a name bound to an inner object is an alias. Prereq:
3.10, 3.11. Syntax lens: lookup on the right of `=`, slot write on the left.
Flow lens: five lines, once each. Object lens: three lists; two changed.*

---

### 3.14 — Compare near-matches

**Answer.** **A** prints `{1: 'yes'}`. **B** prints `{1: 'one', '1': 'yes'}`.

**Why A is surprising.** `True` and `1` look the same to a dictionary — `True`
*is* a number-like object equal to `1` — so the second pair is filed under the
key that is already there and simply replaces its value. The key itself stays as
the originally inserted `1`, which is why the printout shows `1` and not `True`.

**B** has no such collision: the text `"1"` and the number `1` do not look the
same, so they are two separate keys.

**Targeted misconception.** That keys are distinguished by their spelling or
their type name rather than by what they compare equal to.

**If you missed it.** Object-model error. This one is rarely load-bearing in real
code, but it is the sharpest demonstration that a dictionary files by *what a key
looks like*, and that is the idea 3.9 depends on.

*Authoring record — Target: key identity is equality-based. Prereq: 3.6, 3.9.
Syntax lens: dictionary literal with two pairs. Flow lens: literal built left to
right. Object lens: one key slot versus two.*

---

### 3.15 — Write a small program

**Answer.** A correct solution:

```python
scores = {"ann": [7, 9], "bo": [8], "cy": [6, 6]}
scores["bo"].append(10)          # changes the inner list only
scores["cy"] = [1, 2, 3]         # changes the dictionary only
print(scores)
# {'ann': [7, 9], 'bo': [8, 10], 'cy': [1, 2, 3]}
```

**Classification.** Line 2 changed a list inside the dictionary; the dictionary's
own pairs are untouched — `"bo"` still points at the same list object it always
did. Line 3 changed the dictionary itself: the key `"cy"` now points at a
different list, and the old `[6, 6]` is abandoned. Neither line changed both.

**Reasoning.** Notice that line 2 has brackets on the *right* of the dot-call and
no `=` at all — it is a change to the innermost object. Line 3 has the brackets
on the left of an `=` and changes the outer object.

**Targeted misconception.** That "modifying the dictionary" is one undifferentiated
act.

**If you missed it.** Object-model error.

*Authoring record — Target: distinguish outer change from inner change. Prereq:
3.10, 3.13. Syntax lens: `d[k].method()` versus `d[k] = ...`. Flow lens: once
each. Object lens: dictionary plus three inner lists.*

---

### 3.16 — Predict the result

**Answer.**

```text
[2, 3, 4]
[1, 2]
[4, 5]
[1, 2, 3, 4, 5]
[]
False
```

**Reasoning.** Omitted bounds mean "from the start" and "to the end". A slice
whose start equals its stop yields an empty list — not an error. The last line is
the important one: `xs[:]` has the same contents but is a **different object**,
which is exactly why it works as a copy.

**Targeted misconception.** That `xs[:]` is just a wordy way of writing `xs`.

**If you missed the last line.** Object-model error. Go back to 1.11.

*Authoring record — Target: slice bounds and slice-as-copy. Prereq: 3.2, 3.3.
Syntax lens: all slice forms. Flow lens: once each. Object lens: six new lists
produced, original untouched.*

---

### 3.17 — State the rule

**Answer.**

> "When the left of the `=` has brackets on it, the line changes **the object
> those brackets are reaching into**, and the name in front of the brackets
> **does not move — it still points at the same object it did before**."

Reading `a[b][c]`: *"work out `a[b]` first, producing some object, then apply
`[c]` to that object"* — strictly left to right, one level per bracket pair.

**Targeted misconception.** That chained brackets are a compound address
evaluated all at once.

**If you missed it.** Vocabulary-only if you had the idea; syntax-reading if the
left-to-right rule was not clear to you.

*Authoring record — Target: generalize slot-write and chained access. Prereq:
3.1–3.16. Syntax lens: left-hand side shape; chaining. Flow lens: n/a. Object
lens: change without rebinding.*

---

### 3.18 — Find and fix

**Answer.** It prints `{'volume': 0}` — the "backup" is the original.

**Why.** `backup = settings` copies an arrow. Line 3 writes a slot in the one
dictionary both names point at.

**Smallest fix.** Produce a new dictionary:

```python
backup = dict(settings)      # or settings.copy()
```

**A caution to carry forward.** This fix is complete *only because* every value
in `settings` is unchangeable. If a value were a list, the new dictionary's slots
would point at those same lists, and changing one through `backup` would still
show up in `settings`. That is Stage 4's entire subject.

**Targeted misconception.** That assignment makes a backup.

**If you missed it.** Object-model error. Same shape as 2.11 and 3.3.

*Authoring record — Target: dictionary aliasing and its repair, with the shallow
caveat flagged. Prereq: 3.3, 3.6. Syntax lens: bare name on the right. Flow lens:
once each. Object lens: one dictionary versus two.*

---

## Checkpoint 3 — Answers

**C3.1** — The list object that `row` points at is changed, at slot 2. No name is
rebound; `row` points where it always did. **Error type if missed:**
syntax-reading. Go back to 3.1.

**C3.2** — `{'xs': [1, 2, 3]}`. `copy` is a badly named alias for the very list
sitting in the dictionary; appending to it is appending to that list.
**Error type if missed:** object-model. Go back to 3.13.

**C3.3** — Because a tuple's contents can never change after it is built, so a
dictionary can always find it again; a list could be changed after being filed
and the dictionary would no longer recognize it. **Error type if missed:**
object-model. Go back to 3.9.

**C3.4** — `IndexError: list index out of range`. Positions run 0, 1, 2 for a
three-item list. **Error type if missed:** syntax-reading, of the off-by-one kind.

**C3.5** — `menu` must be a dictionary with a `"drinks"` key; `menu["drinks"]`
must produce something indexable by position, i.e. a list or tuple;
`menu["drinks"][0]` must produce a dictionary with a `"price"` key; the whole
expression produces that price. **Error type if missed:** syntax-reading. Go back
to 3.5.

**C3.6** — Absent key: the dictionary gains a pair, and the new key goes **last**
in order. Present key: the number of pairs is unchanged, the key keeps its
original position, and only the value it points at is replaced.
**Error type if missed:** object-model. Go back to 3.6.

---

## Before moving on

You can now read any access expression precisely and say whether a line reads a
slot, writes a slot, or rebinds a name. Exercises 3.10 and 3.13 planted the
question Stage 4 answers: when a container holds another container, what exactly
does copying the outer one give you?
