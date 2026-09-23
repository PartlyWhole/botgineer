# Stage 2 — Changing a Thing vs. Replacing a Name

**The one new move:** decide, for each line, whether it *changed an object* or
*moved a name*. These look alike on the page and are completely different events.

---

## What this stage adds

Stage 1 used objects that cannot be changed, so the only thing a line could ever
do was move a label. Now lists enter, and a second possibility appears: the line
may leave every label exactly where it is and alter the object underneath.

Everything in this collection that ever surprises anybody comes from failing to
tell these two apart. Slow down here.

---

## The ideas, in plain language

### Two kinds of object

| Kind | Examples | Can a line change it while the names stay put? |
|---|---|---|
| Changeable | list, dictionary, set | yes |
| Unchangeable | number, text (string), tuple, `True`/`False`, `None` | no |

We will call these **changeable** and **unchangeable** for now. Their formal
names, *mutable* and *immutable*, arrive in Stage 6.

Unchangeable does not mean "cannot be replaced". A name pointing at `7` can be
pointed at `8` any time you like. It means: no operation can turn the object `7`
itself into something else while you watch.

### The two events, side by side

```python
nums = [1, 2]
nums.append(3)        # CHANGE: same object, now [1, 2, 3]
```

```python
nums = [1, 2]
nums = nums + [3]     # REPLACE: a new list object; nums points at it
```

The printed result is identical: `[1, 2, 3]`. The event is not. And whenever a
second name is involved, the difference becomes visible:

```python
nums = [1, 2]
other = nums
nums.append(3)
print(other)          # [1, 2, 3]  — other sees the change
```

```python
nums = [1, 2]
other = nums
nums = nums + [3]
print(other)          # [1, 2]     — other still points at the old object
```

### How to tell which one a line is, by looking

Ask: **is there an `=` sign at the top level of the line?**

- `nums = ...` — an `=` at the left margin of the statement. A name moves.
  Whatever the right side is, `nums` ends up pointing at its result.
- `nums.append(3)` — no `=`. No name moves. Something was asked of the object
  itself.
- `nums[0] = 9` — there *is* an `=`, but the left side is not a bare name; it is
  a slot *inside* an object. Nothing rebinds `nums`; the list is changed. This
  third case is Stage 3's territory, and it is the one that catches people.

So the real question is: **what is immediately to the left of the `=`?** A bare
name means rebinding. Anything with brackets or a dot in it means changing an
object.

### Methods that change return nothing

```python
nums = [3, 1, 2]
nums.sort()           # changes nums; hands back None
print(nums)           # [1, 2, 3]
```

```python
nums = [3, 1, 2]
nums = nums.sort()    # changes nums, then points nums at None
print(nums)           # None
```

`.append()`, `.sort()`, `.reverse()`, `.extend()`, `.insert()`, `.clear()` all
change the list and hand back `None`. Writing `x = x.append(...)` is one of the
most common ways to destroy your own data. The rule: **a method that changes an
object usually gives you nothing back, because it has already done its job.**

Their non-changing counterparts hand back a new object and leave the original
alone: `sorted(nums)`, `reversed(nums)`, `nums + [4]`, `nums[:]`.

### `+=` is not simply shorthand

```python
n = 1
n += 1                # numbers cannot change: n is rebound to a new object 2
```

```python
nums = [1, 2]
nums += [3]           # lists can change: the SAME list is extended
```

For unchangeable objects, `+=` must build a new object and rebind. For lists,
`+=` changes the existing list — it behaves like `.extend()`, not like
`nums = nums + [3]`. Two lines that look like paraphrases of each other are, for
lists, different events. Exercise 2.7 makes this visible.

### Tuples: unchangeable, but not necessarily "frozen"

A tuple cannot gain, lose, or swap items. But if a tuple holds a list, that list
is still a changeable object:

```python
pair = (1, [2, 3])
pair[1].append(4)     # allowed — the tuple's items are untouched
print(pair)           # (1, [2, 3, 4])
```

The tuple still points at the same two objects it always did. One of them
changed. This is the seed of Stage 4.

---

## Exercises

---

**2.1 — Label the code**

For each line, say in five words or fewer whether it moves a name or changes an
object, and name the object involved.

```python
scores = [10, 20]
scores.append(30)
scores = [0]
total = 0
```

---

**2.2 — Predict the result**

```python
a = [1, 2]
b = a
a.append(3)
print(a)
print(b)
```

---

**2.3 — Predict the result**

```python
a = [1, 2]
b = a
a = a + [3]
print(a)
print(b)
```

---

**2.4 — Compare near-matches**

Exercises 2.2 and 2.3 print different things on their last line. In one sentence
each, say what line 3 did in **2.2** and what line 3 did in **2.3**. Do not use
the word "value".

---

**2.5 — Find and fix**

The intent is to end with `words` pointing at a sorted list. Say what is printed,
and make the smallest fix.

```python
words = ["pear", "fig", "apple"]
words = words.sort()
print(words)
```

---

**2.6 — Predict the result**

```python
n = 5
m = n
n += 1
print(n, m)
```

---

**2.7 — Compare near-matches**

Snippet **A**:

```python
xs = [1, 2]
ys = xs
xs += [3]
print(ys)
```

Snippet **B**:

```python
xs = [1, 2]
ys = xs
xs = xs + [3]
print(ys)
```

Predict both. Then say, in one sentence, why `+=` and `= ... +` are not the same
instruction for lists.

---

**2.8 — Draw names and objects**

Draw the picture after each line.

```python
p = [1]
q = p
p.append(2)
p = [9]
q.append(3)
```

What does `print(p, q)` show at the end?

---

**2.9 — Predict the result**

```python
t = (1, 2)
u = t
t += (3,)
print(t)
print(u)
```

Then say why this outcome is *forced* — that is, why Python had no other choice.

---

**2.10 — Predict the result**

```python
pair = (1, [2, 3])
inner = pair[1]
inner.append(4)
print(pair)
```

Is the tuple changed? Answer carefully.

---

**2.11 — Find and fix**

The intent is to leave `original` untouched while `extended` gains an item. Say
what actually happens and fix it with the smallest change.

```python
original = [1, 2, 3]
extended = original
extended.append(4)
print(original)
print(extended)
```

---

**2.12 — Predict the result**

```python
data = [3, 1, 2]
copy_of_data = sorted(data)
print(data)
print(copy_of_data)
```

Which line, if any, changed a list?

---

**2.13 — Write a small program**

Write four lines such that:

- `a` and `b` point at the same list;
- after your third line, `a` points at a **different** list than `b`;
- and `b`'s list has never been changed.

Then write four lines that reach the same printed output but by *changing* `b`'s
list instead. Say which of your two programs would be dangerous if some other
part of a program also pointed at that list.

---

**2.14 — What runs next?**

Number the lines in execution order and state what is printed.

```python
items = []
items.append("a")
print(len(items))
items = []
items.append("b")
items.append("c")
print(len(items))
```

---

**2.15 — Compare near-matches**

Snippet **A**:

```python
s = "abc"
s = s + "d"
print(s)
```

Snippet **B**:

```python
s = "abc"
s[3] = "d"
print(s)
```

Predict both. One of them fails — say what kind of failure and why it is
*guaranteed*, not accidental.

---

**2.16 — State the rule**

Complete both sentences in plain language:

> "If the thing immediately to the left of the `=` is a bare name, then the line ..."
>
> "If a line has no `=` at all but ends in `.something(...)`, then the line ..."

---

**2.17 — Find and fix**

This is meant to print `[1, 2, 3]` and then `[1, 2, 3, 4]`. It prints something
else. Diagnose and fix.

```python
base = [1, 2, 3]
bigger = base
bigger += [4]
print(base)
print(bigger)
```

---

## Checkpoint 2

**C2.1** — Which of these change an object rather than move a name?
`x = x + 1` · `x.append(1)` · `x = []` · `x.sort()` · `x += [1]` (with `x` a list)

**C2.2** — Predict:

```python
a = [1]
b = a
b = b + [2]
b.append(3)
print(a, b)
```

**C2.3** — A learner writes `text = text.upper()` and it works, then writes
`items = items.sort()` and their data vanishes. Explain the difference in two
sentences.

**C2.4** — Can a tuple's contents ever appear to change? Give a two-line example
or explain why not.

**C2.5** — Draw the picture after the last line:

```python
one = [0]
two = one
one = one + [1]
two.append(2)
```

**C2.6** — In one sentence: why does `n += 1` rebind `n` when `nums += [1]` does
not rebind `nums`?

---

---

# Stage 2 — Answer Key

---

### 2.1 — Label the code

**Answer.**

| Line | Event |
|---|---|
| `scores = [10, 20]` | moves a name (a new list) |
| `scores.append(30)` | changes that list object |
| `scores = [0]` | moves the name (a second, new list) |
| `total = 0` | moves a name (a number) |

Note that after line 3 the list `[10, 20, 30]` has no name left and is gone.

**Reasoning.** Look left of the `=`. Bare name → the name moves. No `=` → an
object was asked to change itself.

**Targeted misconception.** That `.append` and `=` are both "updating the
variable".

**If you missed it.** Syntax-reading error. The test is mechanical: what is
immediately left of the `=`?

*Authoring record — Target: classify each line as bind or change. Prereq: 1.1.
Syntax lens: presence and left-hand side of `=`. Flow lens: once each. Object
lens: two list objects, one abandoned.*

---

### 2.2 — Predict the result

**Answer.**

```text
[1, 2, 3]
[1, 2, 3]
```

**Reasoning.** `b = a` gave one list two names. `a.append(3)` changed that one
list. There is nothing for `b` to be out of date about — it was never holding a
separate copy, it was pointing at the object that changed.

**Targeted misconception.** That `b` captured a snapshot of `a` on line 2.

**If you missed it.** Object-model error. Redraw the diagram from 1.3.

*Authoring record — Target: change is visible through every name. Prereq: 1.3,
2.1. Syntax lens: `.append` with no `=`. Flow lens: once each. Object lens: one
list, two names, changed in place.*

---

### 2.3 — Predict the result

**Answer.**

```text
[1, 2, 3]
[1, 2]
```

**Reasoning.** `a + [3]` builds a **new** list from the two operands. The
original list is not touched. Line 3 then points `a` at the new one. `b` is still
on the original.

**Targeted misconception.** That `+` extends the left-hand list.

**If you missed it.** Object-model error.

*Authoring record — Target: `+` on lists creates. Prereq: 2.2. Syntax lens: `=`
with a bare name left, `+` right. Flow lens: once each. Object lens: two lists,
the names split.*

---

### 2.4 — Compare near-matches

**Answer.** In 2.2, line 3 **changed the one list that both names point at**. In
2.3, line 3 **built a second list and pointed `a` at it, leaving `b` on the
first**.

**Reasoning.** Both sentences must name *which object* and *which names*. If your
sentence could be said about either snippet, it was not specific enough.

**Targeted misconception.** That identical printed contents imply identical
events.

**If you missed it.** Object-model error, or vocabulary-only if you had the right
picture but reached for "value" and could not get past it.

*Authoring record — Target: articulate the two events. Prereq: 2.2, 2.3. Syntax
lens: `.append` versus `= ... +`. Flow lens: identical. Object lens: one object
versus two.*

---

### 2.5 — Find and fix

**Answer.** It prints `None`.

**Why.** `.sort()` sorts the list in place and hands back `None`. Line 2 then
points `words` at that `None`, and the sorted list — which was sitting right
there, correct — loses its only name.

**Smallest fix.** Drop the assignment:

```python
words = ["pear", "fig", "apple"]
words.sort()
print(words)          # ['apple', 'fig', 'pear']
```

Or, if you wanted a new list and the original preserved, use `sorted`:

```python
words = ["pear", "fig", "apple"]
ordered = sorted(words)
```

**Targeted misconception.** That every method hands back the updated object, so
reassigning is harmless or required.

**If you missed it.** Object-model error. The general habit: before writing
`x = x.method()`, ask whether the method changes or produces.

*Authoring record — Target: changing methods return `None`. Prereq: 1.9, 2.1.
Syntax lens: method call on the right of `=`. Flow lens: once each. Object lens:
list changed, then abandoned; name bound to `None`.*

---

### 2.6 — Predict the result

**Answer.** `6 5`

**Reasoning.** Numbers cannot be changed, so `n += 1` has no choice: it computes
`6` as a new object and rebinds `n`. `m` never moves.

**Targeted misconception.** That `+=` always modifies "in place", whatever the
type.

**If you missed it.** Object-model error.

*Authoring record — Target: `+=` on an unchangeable object. Prereq: 1.2. Syntax
lens: `+=`. Flow lens: once each. Object lens: rebinding only.*

---

### 2.7 — Compare near-matches

**Answer.** **A** prints `[1, 2, 3]`. **B** prints `[1, 2]`.

**Why they differ.** For a list, `xs += [3]` asks the existing list to extend
itself — the same object, changed, and `ys` sees it. `xs = xs + [3]` builds a new
list and points only `xs` at it.

**Reasoning.** `+=` is not defined as "do the `+` then assign". Changeable
objects get to define what `+=` means to them, and lists define it as *extend
myself*. Unchangeable objects have no such option, which is why 2.6 came out the
way it did.

**Targeted misconception.** That `x += y` is always exactly `x = x + y`.

**If you missed it.** Object-model error. This is the single most useful item in
Stage 2 — reread it.

*Authoring record — Target: `+=` differs by changeability. Prereq: 2.3, 2.6.
Syntax lens: `+=` versus `= ... +`. Flow lens: identical. Object lens: one object
changed versus two objects and a rebinding.*

---

### 2.8 — Draw names and objects

**Answer.**

```text
after line 1:   p ─────▶ #1 [1]
after line 2:   p ──┬──▶ #1 [1]
                q ──┘
after line 3:   p ──┬──▶ #1 [1, 2]
                q ──┘
after line 4:   p ─────▶ #2 [9]
                q ─────▶ #1 [1, 2]
after line 5:   p ─────▶ #2 [9]
                q ─────▶ #1 [1, 2, 3]
```

`print(p, q)` shows `[9] [1, 2, 3]`.

**Reasoning.** Line 4 is the split: from then on the two names are on different
objects and their changes no longer meet. Line 5 changes `#1`, which `p` left.

**Targeted misconception.** That once two names were "the same", they stay
linked; or conversely, that `q` was already independent before line 4.

**If you missed it.** Object-model error. Note precisely *which line* separated
them — that is the skill.

*Authoring record — Target: aliasing begins and ends at specific lines. Prereq:
2.2, 2.3. Syntax lens: mixed rebinds and method calls. Flow lens: five lines,
once each. Object lens: two lists; sharing for lines 2–3 only.*

---

### 2.9 — Predict the result

**Answer.**

```text
(1, 2, 3)
(1, 2)
```

**Why it is forced.** A tuple cannot be extended, so `+=` on a tuple has no way
to change the existing object. Its only option is to build a new tuple and rebind
`t`. `u` therefore keeps the original. Compare 2.7: identical syntax, opposite
event, purely because of what kind of object it is applied to.

**Targeted misconception.** That `+=` failing to modify a tuple would be an
error, or that `u` would follow along.

**If you missed it.** Object-model error.

*Authoring record — Target: `+=` on an unchangeable container. Prereq: 2.6, 2.7.
Syntax lens: `(3,)` one-item tuple; `+=`. Flow lens: once each. Object lens: two
tuples, names split.*

---

### 2.10 — Predict the result

**Answer.** `(1, [2, 3, 4])`

**Is the tuple changed?** No — and yes, depending on what you mean, which is why
the question says *carefully*. The tuple still points at exactly the two objects
it pointed at when it was built: the number `1` and one particular list. Nothing
about the tuple's own contents moved. What changed is one of the objects it
points at.

**Reasoning.** "Unchangeable" is a claim about the container's own slots, not a
promise about everything reachable from it.

**Targeted misconception.** That a tuple deep-freezes whatever is inside it, so
`inner.append(4)` would fail.

**If you missed it.** Object-model error. Hold onto this: Stage 4 is built on it.

*Authoring record — Target: unchangeable container holding a changeable object.
Prereq: 2.2, 2.9. Syntax lens: `pair[1]` lookup binding a name to an inner
object. Flow lens: once each. Object lens: tuple slots fixed, inner list changed.*

---

### 2.11 — Find and fix

**Answer.** It prints `[1, 2, 3, 4]` twice. Line 2 did not copy anything, so
line 3 changed the one and only list.

**Smallest fix.** Make line 2 produce a new list:

```python
extended = original[:]        # or list(original), or original.copy()
```

**Reasoning.** The requirement "leave `original` untouched" can only be met by
creating a second object. There is no way to have one object and two independent
histories.

**Targeted misconception.** That naming something `extended` makes it a separate
thing; that assignment copies.

**If you missed it.** Object-model error. Go back to 1.16.

*Authoring record — Target: aliasing bug and its minimal repair. Prereq: 2.2.
Syntax lens: bare name on the right versus a slice. Flow lens: once each. Object
lens: one object versus two.*

---

### 2.12 — Predict the result

**Answer.**

```text
[3, 1, 2]
[1, 2, 3]
```

No line changed a list. `sorted(...)` reads its input and produces a brand-new
list; the original is untouched.

**Reasoning.** The pairing to memorize: `list.sort()` changes and returns
nothing; `sorted(list)` changes nothing and returns a new list. The same pattern
holds for `list.reverse()` versus `reversed(list)`.

**Targeted misconception.** That `sorted` sorts the original as a side effect.

**If you missed it.** Object-model error.

*Authoring record — Target: producing function versus changing method. Prereq:
2.5. Syntax lens: `sorted(x)` versus `x.sort()`. Flow lens: once each. Object
lens: two lists, no change.*

---

### 2.13 — Write a small program

**Answer.** Splitting by rebinding (safe):

```python
a = [1, 2]
b = a
a = a + [3]
print(a, b)           # [1, 2, 3] [1, 2]
```

Reaching a similar-looking end by changing (dangerous):

```python
a = [1, 2]
b = a
b.append(3)
print(a, b)           # [1, 2, 3] [1, 2, 3]  — note: NOT the same output
```

The honest answer to the last part: the second program cannot actually reproduce
the first program's output, and that is the point. Changing `b`'s list is visible
to every other name pointing at it — including names in code you did not write.
The rebinding version affects nobody but `a`.

**Reasoning.** If you tried to make the second version match and could not, you
have discovered the rule yourself: a change to a shared object cannot be kept
private.

**Targeted misconception.** That in-place changing and rebinding are
interchangeable techniques with the same reach.

**If you missed it.** Object-model error.

*Authoring record — Target: construct both events deliberately. Prereq: 2.2–2.4.
Syntax lens: choosing the left-hand side. Flow lens: once each. Object lens:
sharing versus splitting.*

---

### 2.14 — What runs next?

**Answer.**

```text
1  items = []
2  items.append("a")
3  print(len(items))     →  1
4  items = []
5  items.append("b")
6  items.append("c")
7  print(len(items))     →  2
```

Output:

```text
1
2
```

**Reasoning.** Line 4 does not empty the existing list — it builds a *second*
empty list and moves the name. The first list, holding `"a"`, is abandoned
unchanged. (Contrast `items.clear()`, which would empty the existing one.)

**Targeted misconception.** That `items = []` "resets the list".

**If you missed it.** Object-model error, though the output is the same either
way here — which is why the diagram question matters more than the output.

*Authoring record — Target: re-literal versus clear. Prereq: 2.1. Syntax lens:
empty list literal. Flow lens: seven lines, once each. Object lens: two list
objects.*

---

### 2.15 — Compare near-matches

**Answer.** **A** prints `abcd`. **B** raises
`TypeError: 'str' object does not support item assignment`.

**Why it is guaranteed.** Text objects have no changeable slots at all, so
assigning into one is not a thing Python can attempt and fail at — it is refused
outright, every time, regardless of the index. **A** works because it does not
try to change anything: it builds a new text object and rebinds `s`.

**Targeted misconception.** That indexing on the left of `=` works on anything
you can index. Reading works on strings; writing does not.

**If you missed it.** Syntax-reading error if you thought both lines were
assignments of the same kind; object-model error if you expected **B** to work.

*Authoring record — Target: item assignment requires a changeable object.
Prereq: 2.1, 2.3. Syntax lens: `s[3] = ...` left-hand side. Flow lens: **B**
stops at line 2; line 3 never runs. Object lens: no object changed in either.*

---

### 2.16 — State the rule

**Answer.**

> "If the thing immediately to the left of the `=` is a bare name, then the line
> **points that name at whatever the right side produced, and changes no object**."
>
> "If a line has no `=` at all but ends in `.something(...)`, then the line
> **may change the object it was called on, and moves no name**."

**Reasoning.** Both halves need the negative clause — what the line does *not* do
is the part learners omit, and it is the part that predicts the other names'
behavior.

**Targeted misconception.** That the two forms are stylistic variants.

**If you missed it.** Vocabulary-only if your sentences meant the right thing;
object-model if either negative clause was wrong.

*Authoring record — Target: generalize the left-of-`=` test. Prereq: 2.1–2.15.
Syntax lens: statement shape. Flow lens: n/a. Object lens: bind versus change.*

---

### 2.17 — Find and fix

**Answer.** It prints `[1, 2, 3, 4]` twice.

**Diagnosis.** Two separate mistakes stack here, and you should name both: line 2
did not copy (so `base` and `bigger` are one list), and line 3 uses `+=`, which
for a list changes that shared object rather than making a new one. Either
mistake alone would have been survivable; `bigger = base` followed by
`bigger = bigger + [4]` would have printed the intended result by accident.

**Smallest fix.** Copy on line 2:

```python
bigger = base[:]
bigger += [4]
```

**Reasoning.** The fix belongs at the line that failed to create a second object,
not at the line that changed it. Changing line 3 to `bigger = bigger + [4]` also
produces the wanted output, but leaves the aliasing in place for the next person
to trip over.

**Targeted misconception.** That the visible symptom marks the buggy line.

**If you missed it.** Object-model error. Combines 2.7 and 2.11.

*Authoring record — Target: diagnose a two-cause aliasing bug. Prereq: 2.7, 2.11.
Syntax lens: `+=` on a shared name. Flow lens: once each. Object lens: one list,
two names, changed once.*

---

## Checkpoint 2 — Answers

**C2.1** — Change an object: `x.append(1)`, `x.sort()`, and `x += [1]` when `x`
is a list. Move a name: `x = x + 1`, `x = []`.
**Error type if missed:** syntax-reading, unless you missed `+=`, which is
object-model. Go back to 2.1 and 2.7.

**C2.2** — `[1] [1, 2, 3]`. Line 3 built a new list and moved `b` onto it, so
line 4's `.append` changes the *new* list and never touches `a`'s.
**Error type if missed:** object-model. Go back to 2.8.

**C2.3** — `.upper()` does not change the text object (it cannot); it produces a
new one, so the assignment is the only way to keep the result. `.sort()` does
change the list and hands back `None`, so the assignment throws away the sorted
list and stores nothing. **Error type if missed:** object-model. Go back to 2.5
and 2.12.

**C2.4** — Yes, if it holds a changeable object:

```python
t = ([1], 2)
t[0].append(9)        # t is now ([1, 9], 2)
```

The tuple's own two slots never changed. **Error type if missed:** object-model.
Go back to 2.10.

**C2.5** —

```text
one ─────▶ #2 [0, 1]
two ─────▶ #1 [0, 2]
```

Line 3 split them; line 4 changed the list `one` had left behind.
**Error type if missed:** object-model. Go back to 2.8.

**C2.6** — Because a number object cannot be changed, so `+=` has no option but
to build a new one and rebind; a list can change itself, so `+=` asks it to, and
no name needs to move. **Error type if missed:** object-model. Go back to 2.7
and 2.9.

---

## Before moving on

You can now say, for any line, whether it moved a name or changed an object, and
you can predict what every other name sees afterward. Stage 3 turns to the third
case flagged earlier — lines where the `=` has brackets or a key on its left —
and to reading nested access accurately.
