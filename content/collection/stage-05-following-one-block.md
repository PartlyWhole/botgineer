# Stage 5 — Following One Block

**The one new move:** decide which lines run repeatedly, which run once
afterward, and what each name points at on every pass.

---

## What this stage adds

Until now every line ran exactly once, in written order. A `for` line breaks
that, and it breaks it in a way that is entirely visible on the page: the colon
and the indentation tell you which lines repeat. Nothing about the object model
changes. Names are bound and objects are changed exactly as before — just more
than once.

---

## The ideas, in plain language

### Reading a `for` line

```python
for item in [10, 20, 30]:
    print(item)
```

Read it aloud as: *"For each value that comes out of this collection, point the
name `item` at it, then run the indented lines."*

Three things are worth noticing immediately:

- `item` is an ordinary name. The `for` line **rebinds** it before each pass —
  the same event as any assignment.
- The colon at the end says *a block starts here*.
- The indented lines are the **body**. They run once per pass.

### Indentation is the block, and nothing else is

```python
for n in [1, 2, 3]:
    print("inside", n)
print("after")
```

`print("inside", n)` is indented, so it belongs to the loop and runs three times.
`print("after")` is back at the left margin, so the loop is over by the time it
runs, and it runs once. Move that last line four spaces right and the program
prints "after" three times. Indentation is not decoration; it *is* the structure.

Python is strict about it: a block's lines must be indented consistently, and
mixing tabs and spaces is an error rather than a style complaint.

### Execution-order numbering

The way to make a loop concrete before you have any vocabulary for it is to
number the lines in the order Python actually reaches them:

```python
total = 0                    # 1
for n in [5, 7]:             # 2, 4, 6
    total = total + n        # 3, 5
print(total)                 # 7
```

Reading that: line 2 runs to fetch 5; line 3 runs; line 2 runs again to fetch 7;
line 3 runs again; line 2 runs a *third* time, finds nothing left, and the loop
ends; line 4 runs once. The `for` line runs one more time than the body does —
that final pass is the one that discovers there is nothing left.

### Trace tables

For anything longer than two lines, write a table with one row per pass:

| pass | `n` | `total` before | `total` after |
|---|---|---|---|
| 1 | 5 | 0 | 5 |
| 2 | 7 | 5 | 12 |
| — | 7 | 12 | 12 (loop ends) |

The last row matters: **the loop name still exists after the loop**, still
pointing at the final value. `for` does not clean up after itself.

### `range`

`range(n)` produces the numbers from 0 up to but not including `n`.
`range(a, b)` goes from `a` up to but not including `b`. `range(a, b, step)`
counts by `step`. `range(3)` gives 0, 1, 2 — three numbers, starting at zero.

A `range` is not a list. `print(range(3))` shows `range(0, 3)`, not `[0, 1, 2]`,
because a range does not build its numbers in advance — it produces each one as
the loop asks for it. This is why `range(10000000)` costs nothing to create. Use
`list(range(3))` when you genuinely want the list.

### The accumulator pattern

```python
total = 0
for n in [1, 2, 3]:
    total = total + n
print(total)          # 6
```

The name `total` must be bound **before** the loop, because the first pass reads
it. Each pass rebinds it. The post-loop line reads the last binding. Almost every
loop you write is a variation on this shape, with `total = 0` replaced by
`results = []` and the body doing `results.append(...)`.

### Rebinding the loop name does not touch the collection

```python
xs = [1, 2, 3]
for x in xs:
    x = x * 2
print(xs)             # [1, 2, 3]
```

Each pass points `x` at an item, then points `x` somewhere else. The list's slots
were never involved — nothing wrote into `xs`. Compare:

```python
grid = [[1], [2]]
for row in grid:
    row.append(0)
print(grid)           # [[1, 0], [2, 0]]
```

Here the body *changes* the object `row` points at, and that object is the same
one sitting in the list's slot. Stage 2's distinction, now with a loop wrapped
around it.

To actually replace items, write the slots by position:

```python
xs = [1, 2, 3]
for i in range(len(xs)):
    xs[i] = xs[i] * 2
print(xs)             # [2, 4, 6]
```

### `break` and `continue`

- `break` stops the loop immediately. The loop's remaining passes never happen,
  and Python continues at the first unindented line after the loop.
- `continue` abandons the *rest of the body* for this pass only and goes back to
  the `for` line for the next value.

Both affect **the one loop they are directly inside**. That qualifier does
nothing yet, because there is only one loop; it becomes the whole point in
Stage 7.

### Changing a list while looping over it

```python
xs = [1, 2, 3, 4]
for x in xs:
    if x % 2 == 0:
        xs.remove(x)
print(xs)             # [1, 3]
```

The loop walks by position while the list is shrinking underneath it, so
positions shift and some items are never examined. The result is not random — it
is perfectly predictable if you trace it — but it is almost never what the author
meant. The habit: **build a new list instead of editing the one you are looping
over.**

---

## Exercises

---

**5.1 — Mark the block**

Which lines belong to the loop body? How many times does each line in this
snippet run?

```python
count = 0
for c in "abc":
    count = count + 1
    print(c)
print(count)
```

---

**5.2 — What runs next?**

Number every line in execution order, repeating numbers for repeated lines, and
give the output.

```python
total = 0
for n in [4, 6]:
    total = total + n
print(total)
```

---

**5.3 — Predict the result**

```python
for i in range(3):
    print(i)
print("done", i)
```

Why does the last line work at all?

---

**5.4 — Compare near-matches**

Snippet **A**:

```python
for n in [1, 2]:
    print(n)
    print("end")
```

Snippet **B**:

```python
for n in [1, 2]:
    print(n)
print("end")
```

Predict both outputs. The only difference is indentation — say what it changes.

---

**5.5 — Predict the result**

```python
print(range(3))
print(list(range(3)))
print(list(range(2, 5)))
print(list(range(0, 10, 3)))
print(len(range(3)))
```

---

**5.6 — Build a trace table**

Fill in a table with one row per pass, showing `n` and `total`, then give the
output.

```python
total = 1
for n in [2, 3, 4]:
    total = total * n
print(total)
```

---

**5.7 — Predict the result**

```python
xs = [1, 2, 3]
for x in xs:
    x = x * 10
print(xs)
print(x)
```

---

**5.8 — Compare near-matches**

Snippet **A**:

```python
grid = [[1], [2]]
for row in grid:
    row = row + [0]
print(grid)
```

Snippet **B**:

```python
grid = [[1], [2]]
for row in grid:
    row.append(0)
print(grid)
```

Predict both and say which Stage 2 distinction is doing the work.

---

**5.9 — Find and fix**

The intent is to double every item in the list itself. Say what happens and fix
it.

```python
nums = [1, 2, 3]
for n in nums:
    n = n * 2
print(nums)
```

---

**5.10 — Predict the result**

```python
for n in [1, 2, 3, 4, 5]:
    if n == 3:
        break
    print(n)
print("stopped at", n)
```

---

**5.11 — Compare near-matches**

Snippet **A**:

```python
for n in [1, 2, 3, 4]:
    if n == 2:
        continue
    print(n)
```

Snippet **B**:

```python
for n in [1, 2, 3, 4]:
    if n == 2:
        break
    print(n)
```

Predict both and state the difference in one sentence each.

---

**5.12 — Find and fix**

The intent is to collect the even numbers into a new list. Say what actually
prints and fix it with the smallest change.

```python
nums = [1, 2, 3, 4]
evens = []
for n in nums:
    if n % 2 == 0:
        evens = [n]
print(evens)
```

---

**5.13 — Predict the result**

```python
xs = [1, 2, 3, 4]
for x in xs:
    if x % 2 == 0:
        xs.remove(x)
print(xs)
```

Trace it pass by pass, showing the position the loop is at and the current
contents of `xs`.

---

**5.14 — Find and fix**

Rewrite 5.13 so that it reliably ends with only the odd numbers, without editing
a list while looping over it.

---

**5.15 — What runs next?**

Number the execution order and give the output. Pay attention to which lines are
inside the loop.

```python
results = []
for n in range(3):
    doubled = n * 2
    results.append(doubled)
    print("pass", n, results)
print("final", results)
print("last doubled", doubled)
```

---

**5.16 — Find and fix**

The intent is to sum the list. It raises an error. Name the error, explain it,
and fix it.

```python
for n in [1, 2, 3]:
    total = total + n
print(total)
```

---

**5.17 — Write a small program**

Write a loop that builds a list `squares` holding the squares of 1 through 5,
then prints the list and its length. Requirements: bind the accumulator before
the loop, use `range`, and put exactly one line inside the loop body.

---

**5.18 — Predict the result**

```python
xs = [[0], [0]]
for row in xs:
    row[0] = row[0] + 1
print(xs)
```

Now say what would print if line 1 were `xs = [[0]] * 2`.

---

**5.19 — State the rule**

Answer each in one plain sentence:

1. How do you tell which lines belong to a loop body?
2. How many times does the `for` line itself run, compared with the body?
3. What happens to the loop name after the loop finishes?
4. When does changing the loop name change the collection?

---

## Checkpoint 5

**C5.1** — How many lines of output does this produce, and what are they?

```python
for n in range(2):
    print("a")
print("b")
```

**C5.2** — Predict:

```python
total = 0
for n in range(4):
    total += n
print(total, n)
```

**C5.3** — A learner says `for x in xs: x = 0` should zero out the list. Explain
in two sentences why it does not, and give the smallest working alternative.

**C5.4** — In this snippet, which lines run three times, which run once, and
which run zero times?

```python
found = False
for c in "xyz":
    if c == "q":
        found = True
        break
print(found)
```

**C5.5** — Predict:

```python
words = []
for w in ["a", "b"]:
    words.append(w)
    words.append(w)
print(words, len(words))
```

**C5.6** — Why does `print(range(5))` not show a list, and what would you write
to see one?

---

---

# Stage 5 — Answer Key

---

### 5.1 — Mark the block

**Answer.** Lines 3 and 4 (`count = count + 1` and `print(c)`) are the body. They
are indented under the colon.

| Line | Times it runs |
|---|---|
| `count = 0` | 1 |
| `for c in "abc":` | 4 (three passes plus the final "nothing left" check) |
| `count = count + 1` | 3 |
| `print(c)` | 3 |
| `print(count)` | 1 |

Output: `a`, `b`, `c`, `3`.

**Reasoning.** Membership in the body is determined by indentation alone. Looping
over a text object yields one character per pass — a preview of Stage 6.

**Targeted misconception.** That the last line is "part of the loop because it
comes after the for".

**If you missed it.** Syntax-reading error. Draw a vertical line down the left
edge of the indented lines.

*Authoring record — Target: identify block membership and run counts. Prereq: 2.1.
Syntax lens: colon and indentation. Flow lens: 3 passes, 1 post-loop line. Object
lens: `count` rebound three times.*

---

### 5.2 — What runs next?

**Answer.**

```text
1  total = 0
2  for n in [4, 6]:        (fetches 4)
3      total = total + n    →  total is 4
4  for n in [4, 6]:        (fetches 6)
5      total = total + n    →  total is 10
6  for n in [4, 6]:        (nothing left; loop ends)
7  print(total)             →  10
```

Output: `10`.

**Reasoning.** The `for` line appears three times in the numbering for two passes.
Writing that third visit explicitly is what makes "when does the loop stop"
concrete rather than magical.

**Targeted misconception.** That the `for` line runs once and somehow "sets up"
the repetition of the body.

**If you missed it.** Flow error.

*Authoring record — Target: execution-order notation with a loop. Prereq: 5.1.
Syntax lens: two-line loop. Flow lens: n+1 visits to the `for` line. Object lens:
accumulator rebound per pass.*

---

### 5.3 — Predict the result

**Answer.**

```text
0
1
2
done 2
```

**Why the last line works.** `i` is an ordinary name bound by the `for` line. When
the loop ends, nothing unbinds it, so it still points at the last value it was
given, `2`.

**Targeted misconception.** That the loop name is private to the loop and
disappears afterward (true in some other languages, not in Python).

**If you missed it.** Flow error, or object-model if you expected `3` — the loop
never binds `i` to 3; `range(3)` never produces it.

*Authoring record — Target: loop name persists; range upper bound excluded.
Prereq: 5.1. Syntax lens: `range(3)`. Flow lens: three passes. Object lens: `i`
still bound after the loop.*

---

### 5.4 — Compare near-matches

**Answer.** **A**:

```text
1
end
2
end
```

**B**:

```text
1
2
end
```

**What indentation changes.** In **A**, `print("end")` is in the body and runs
once per pass. In **B** it is outside the loop and runs once, after every pass has
finished.

**Targeted misconception.** That indentation is a readability convention.

**If you missed it.** Syntax-reading error with a flow consequence — the most
common pairing in this stage.

*Authoring record — Target: indentation determines run count. Prereq: 5.1.
Syntax lens: indentation level of the final line. Flow lens: 2 versus 1
executions. Object lens: none.*

---

### 5.5 — Predict the result

**Answer.**

```text
range(0, 3)
[0, 1, 2]
[2, 3, 4]
[0, 3, 6, 9]
3
```

**Reasoning.** A range does not build its numbers up front, so printing it shows a
description of the recipe rather than the numbers. It still knows its own length,
and `list(...)` forces it to produce everything.

**Targeted misconception.** That `range` is a list, or that `range(2, 5)` includes
5.

**If you missed it.** Syntax-reading error on the bounds; object-model error on
the first line.

*Authoring record — Target: range bounds, step, and lazy nature. Prereq: 5.3.
Syntax lens: `range` with one, two, and three arguments. Flow lens: numbers
produced on demand. Object lens: a range object is not a list.*

---

### 5.6 — Build a trace table

**Answer.**

| pass | `n` | `total` before | `total` after |
|---|---|---|---|
| 1 | 2 | 1 | 2 |
| 2 | 3 | 2 | 6 |
| 3 | 4 | 6 | 24 |
| — | 4 | 24 | 24 (loop ends) |

Output: `24`.

**Reasoning.** `total = 1` is essential: starting from 0 would make every product
0. The accumulator's starting value is part of the algorithm, not boilerplate.

**Targeted misconception.** That the accumulator can be initialized anywhere,
including inside the loop.

**If you missed it.** Flow error if you lost track of passes; object-model if you
used the original `total` on every pass.

*Authoring record — Target: multiplicative accumulator, trace table form. Prereq:
5.2. Syntax lens: body of one line. Flow lens: three passes. Object lens: `total`
rebound three times.*

---

### 5.7 — Predict the result

**Answer.**

```text
[1, 2, 3]
30
```

**Reasoning.** Each pass binds `x` to an item, and the body immediately rebinds
`x` to a different number. The list's slots were never on the left of any `=`, so
the list is untouched. After the loop, `x` holds the last computed value, `30`.

**Targeted misconception.** That the loop name is a live window into the slot it
came from — a kind of two-way connection. It is an ordinary name pointing at
whatever was handed to it.

**If you missed it.** Object-model error. Go back to 2.16's left-of-`=` test.

*Authoring record — Target: rebinding the loop name is inert. Prereq: 2.1, 5.1.
Syntax lens: bare name left of `=` in a body. Flow lens: three passes. Object
lens: no slot written.*

---

### 5.8 — Compare near-matches

**Answer.** **A** prints `[[1], [2]]`. **B** prints `[[1, 0], [2, 0]]`.

**The distinction at work:** replacing versus changing. In **A**, `row + [0]`
builds a new list and rebinds the loop name — inert, exactly as in 5.7. In **B**,
`.append` changes the object `row` points at, and that object is the one sitting
in the grid's slot.

**Targeted misconception.** That a loop can only read, so neither should affect
the grid; or that both should, since both mention `row`.

**If you missed it.** Object-model error. This is Stage 2 with a loop around it —
no new rule was introduced.

*Authoring record — Target: change versus rebind inside a body. Prereq: 2.3, 5.7.
Syntax lens: `row = row + [0]` versus `row.append(0)`. Flow lens: two passes each.
Object lens: shared inner lists changed in **B** only.*

---

### 5.9 — Find and fix

**Answer.** It prints `[1, 2, 3]` — unchanged, for the reason in 5.7.

**Fix.** Write the slots by position:

```python
nums = [1, 2, 3]
for i in range(len(nums)):
    nums[i] = nums[i] * 2
print(nums)               # [2, 4, 6]
```

Or, if a new list is acceptable, build one:

```python
nums = [n * 2 for n in nums]
```

(That second form is Stage 6's comprehension; note that it *rebinds* `nums`
rather than changing the original list, which matters if another name points at
it.)

**Reasoning.** To change a list you must put something with brackets on the left
of the `=`. Nothing else will do it.

**Targeted misconception.** That assigning to the loop name edits the collection.

**If you missed it.** Object-model error.

*Authoring record — Target: index-based in-place update. Prereq: 5.7, 3.1. Syntax
lens: `nums[i] = ...`. Flow lens: `range(len(...))` gives valid positions. Object
lens: slots written.*

---

### 5.10 — Predict the result

**Answer.**

```text
1
2
stopped at 3
```

**Reasoning.** On the third pass `n` is bound to 3, the `if` is true, and `break`
leaves the loop before `print(n)` runs. Control jumps to the first unindented line
after the loop. `n` is still bound to 3 there.

**Targeted misconception.** That `break` also skips the code after the loop, or
that it unbinds the loop name.

**If you missed it.** Flow error.

*Authoring record — Target: `break` exits to the post-loop line. Prereq: 5.3, 5.4.
Syntax lens: nested `if` inside a body. Flow lens: partial third pass. Object
lens: `n` bound to 3 at exit.*

---

### 5.11 — Compare near-matches

**Answer.** **A** prints `1`, `3`, `4`. **B** prints `1`.

**A:** `continue` abandons the rest of the body for that one pass and goes back
for the next value, so 2 is skipped and the loop still finishes.
**B:** `break` ends the loop entirely at 2, so nothing after 1 is printed.

**Targeted misconception.** That `continue` skips the next item, or that `break`
skips one iteration.

**If you missed it.** Flow error.

*Authoring record — Target: `continue` versus `break`. Prereq: 5.10. Syntax lens:
identical except one word. Flow lens: 4 passes versus 2. Object lens: none.*

---

### 5.12 — Find and fix

**Answer.** It prints `[4]`. Line 5 **rebinds** `evens` to a brand-new one-item
list on every matching pass, so only the last match survives.

**Smallest fix.**

```python
evens.append(n)
```

**Reasoning.** The accumulator pattern requires *adding to* the existing list, not
pointing the name at a new one. The bug is the exact Stage 2 confusion, now
costing data rather than clarity.

**Targeted misconception.** That `evens = [n]` "adds `n` to `evens`".

**If you missed it.** Object-model error.

*Authoring record — Target: accumulate by changing, not rebinding. Prereq: 2.1,
5.6. Syntax lens: bare name left of `=` inside a body. Flow lens: two matching
passes. Object lens: two one-item lists created, one abandoned.*

---

### 5.13 — Predict the result

**Answer.** `[1, 3]`.

**Trace.**

| loop is at position | `xs` at that moment | `x` | action |
|---|---|---|---|
| 0 | `[1, 2, 3, 4]` | 1 | odd, nothing |
| 1 | `[1, 2, 3, 4]` | 2 | remove 2 → `[1, 3, 4]` |
| 2 | `[1, 3, 4]` | 4 | remove 4 → `[1, 3]` |
| 3 | `[1, 3]` | — | position 3 is past the end; loop ends |

Note what happened at position 2: because the list shrank, position 2 now holds
`4`, and `3` — which had moved from position 2 to position 1 — was **never
examined**. It survives by accident, not by the rule the author intended.

**Targeted misconception.** That the loop holds a snapshot of the list, or that
removal is "safe if you only remove the current item".

**If you missed it.** Flow error, with an object-model component: the loop walks
by position over a list that is changing beneath it.

*Authoring record — Target: mutation during iteration. Prereq: 5.1, 3.1. Syntax
lens: `.remove` in a body. Flow lens: position-based iteration over a shrinking
list. Object lens: one list, changed twice.*

---

### 5.14 — Find and fix

**Answer.** Build a new list and leave the original alone during the walk:

```python
nums = [1, 2, 3, 4]
odds = []
for n in nums:
    if n % 2 == 1:
        odds.append(n)
print(odds)               # [1, 3]
```

If the original name must end up holding only the odds, rebind it *after* the
loop: `nums = odds`. If some other name must also see the change, replace the
contents in one step after the loop: `nums[:] = odds`, which writes every slot of
the existing list rather than rebinding the name.

**Reasoning.** The general repair for "changing what I am looping over" is always
the same: separate the reading pass from the writing.

**Targeted misconception.** That there is a clever ordering (iterating backwards,
say) that makes in-place removal safe. Backwards iteration does happen to work
here, but it is a trick that depends on the removal being of the current item —
building a new list needs no such reasoning.

**If you missed it.** Flow error.

*Authoring record — Target: the standard repair. Prereq: 5.12, 5.13. Syntax lens:
accumulator plus condition. Flow lens: one clean pass. Object lens: two lists;
`nums[:] = odds` writes slots rather than rebinding.*

---

### 5.15 — What runs next?

**Answer.**

```text
1   results = []
2   for n in range(3):        (n = 0)
3       doubled = n * 2
4       results.append(doubled)
5       print("pass", n, results)   → pass 0 [0]
6   for n in range(3):        (n = 1)
7       doubled = n * 2
8       results.append(doubled)
9       print("pass", n, results)   → pass 1 [0, 2]
10  for n in range(3):        (n = 2)
11      doubled = n * 2
12      results.append(doubled)
13      print("pass", n, results)   → pass 2 [0, 2, 4]
14  for n in range(3):        (nothing left)
15  print("final", results)         → final [0, 2, 4]
16  print("last doubled", doubled)  → last doubled 4
```

**Reasoning.** `results` is bound once and *changed* three times — the same list
object throughout, which is why each printed line shows it growing. `doubled` is
rebound each pass and, like the loop name, survives afterward.

**Targeted misconception.** That names created inside a body are local to it.
Nothing about a loop body makes a name private — only a function does that, which
is Stage 8.

**If you missed it.** Flow error on the numbering; object-model if you expected
`results` to be replaced each pass.

*Authoring record — Target: full trace with accumulator and body-local names.
Prereq: 5.2, 5.6. Syntax lens: three-line body. Flow lens: 3 passes, 2 post-loop
lines. Object lens: one list changed three times; two names rebound.*

---

### 5.16 — Find and fix

**Answer.** `NameError: name 'total' is not defined`.

**Why.** On the first pass, Python must work out `total + n` before it can bind
`total`. There is nothing for `total` to point at yet. The loop does not
"start it at zero" — nothing does.

**Fix.** Bind it before the loop:

```python
total = 0
for n in [1, 2, 3]:
    total = total + n
print(total)          # 6
```

**Targeted misconception.** That a name used as an accumulator is implicitly
initialized, or that `total = total + n` binds it on the way past.

**If you missed it.** Object-model error, of the Stage 1 kind: the right side is
worked out first (1.7).

*Authoring record — Target: accumulator must be pre-bound. Prereq: 1.7, 5.6.
Syntax lens: name used on the right before ever being bound. Flow lens: fails on
the first pass. Object lens: no binding exists.*

---

### 5.17 — Write a small program

**Answer.**

```python
squares = []
for n in range(1, 6):
    squares.append(n * n)
print(squares)        # [1, 4, 9, 16, 25]
print(len(squares))   # 5
```

**Reasoning.** `range(1, 6)` is the honest way to say "1 through 5". Writing
`range(5)` and then using `n + 1` inside works but forces the reader to do
arithmetic that the range line could have expressed. The single body line must be
`.append(...)` — an `=` with a bare name on the left would rebind and lose the
accumulation, per 5.12.

**Targeted misconception.** That `range(5)` means "1 to 5".

**If you missed it.** Syntax-reading error on the range bounds; object-model if
you rebound `squares`.

*Authoring record — Target: construct the accumulator pattern. Prereq: 5.5, 5.12.
Syntax lens: two-argument `range`. Flow lens: five passes. Object lens: one list
changed five times.*

---

### 5.18 — Predict the result

**Answer.** `[[1], [1]]`.

**With `xs = [[0]] * 2`:** `[[2]]` repeated — the printed result is `[[2], [2]]`.

**Reasoning.** With two distinct inner lists, each pass writes slot 0 of a
different list, and each goes from 0 to 1. With one shared inner list, the body
runs twice on *the same object*: first pass makes it `[1]`, second pass reads that
`1` and makes it `[2]`. Both slots then show `[2]`.

This is the Stage 4 pitfall with a loop over it, and it is the version that
actually appears in real code — the doubling is what makes it obvious that the
body ran twice on one object.

**Targeted misconception.** That sharing merely duplicates a display, rather than
compounding repeated changes.

**If you missed the second part.** Object-model error. Go back to 4.6.

*Authoring record — Target: repeated change through a shared object. Prereq: 4.6,
5.8. Syntax lens: `row[0] = row[0] + 1`. Flow lens: two passes. Object lens: one
versus two inner lists.*

---

### 5.19 — State the rule

**Answer.**

1. By indentation: the body is exactly the lines indented under the `for` line's
   colon, up to the first line that returns to the previous level.
2. The `for` line runs one more time than the body — the extra visit is the one
   that finds nothing left and ends the loop.
3. Nothing happens to it: it stays bound to the last value it was given, and can
   be read after the loop.
4. Never by assigning to the loop name — only by changing the object the loop
   name points at, or by writing into the collection's slots by position.

**If you missed any.** (1) syntax-reading; (2) and (3) flow; (4) object-model.

*Authoring record — Target: generalize the stage. Prereq: 5.1–5.18. Syntax lens:
block structure. Flow lens: run counts and name lifetime. Object lens: change
versus rebind.*

---

## Checkpoint 5 — Answers

**C5.1** — Three lines: `a`, `a`, `b`. **Error type if missed:** syntax-reading
(block membership) or flow (run counts). Go back to 5.4.

**C5.2** — `6 3`. The sum of 0+1+2+3, and `n` still bound to its last value.
**Error type if missed:** flow, if you expected `n` to be gone or to be 4. Go back
to 5.3.

**C5.3** — `x = 0` rebinds the loop name to the number 0 and never touches the
list's slots, so the list is unchanged; the smallest working alternative is
`for i in range(len(xs)): xs[i] = 0`. **Error type if missed:** object-model. Go
back to 5.7 and 5.9.

**C5.4** — `found = False` and `print(found)` run once. The `for` line runs four
times (three passes plus the ending check) and `if c == "q":` runs three times.
`found = True` and `break` run **zero** times, because no character equals `"q"`.
**Error type if missed:** flow. Go back to 5.10.

**C5.5** — `['a', 'a', 'b', 'b'] 4`. Two passes, two appends each, all to the one
list. **Error type if missed:** flow. Go back to 5.15.

**C5.6** — Because a range produces its numbers only as they are asked for, so it
has no list to show; `print(list(range(5)))` builds and shows one.
**Error type if missed:** object-model. Go back to 5.5.

---

## Before moving on

You can now read a single loop precisely: which lines repeat, how many times,
what each name points at on each pass, and what survives afterward. Stage 6 keeps
the loop and varies the thing being looped over.
