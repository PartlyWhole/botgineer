# Stage 7 — Following Nested Structure

**The one new move:** at any line, say which indentation level is active — which
loop that line belongs to, and therefore how many times it runs.

---

## What this stage adds

One loop is a rhythm you can hold in your head. Two loops are not, and guessing
starts here. Everything you need is still visible on the page: the colons say
where blocks open, the indentation says which block each line is in, and the
count of passes is the product of the levels.

---

## The ideas, in plain language

### Reading a nested loop

```python
for row in range(2):
    for col in range(3):
        print(row, col)
    print("end of row", row)
print("done")
```

Read it as three distinct levels:

| Level | Lines | Runs |
|---|---|---|
| outer body | `for col ...:` and `print("end of row", row)` | 2 times (once per outer pass) |
| inner body | `print(row, col)` | 6 times (3 per outer pass) |
| after everything | `print("done")` | 1 time |

The inner loop **starts over from the beginning on every outer pass**. That is
the sentence to internalize: `range(3)` is walked afresh each time the outer loop
comes round, so `col` goes 0, 1, 2 and then 0, 1, 2 again.

Total passes through the innermost body: outer count × inner count. Two loops of
`range(1000)` is a million passes; this is where accidental slowness lives.

### The vertical-line test

To find which loop a line belongs to, draw a vertical line down from each colon
and read the indentation:

```text
for row in range(2):          ← level 0
    for col in range(3):      ← level 1  (inside the outer body)
        print(row, col)       ← level 2  (inside the inner body)
    print("end of row", row)  ← level 1  (back in the outer body)
print("done")                 ← level 0  (after both loops)
```

Unindenting one step means *that block just ended*. A line's meaning is decided
entirely by how far right it sits.

### `break` and `continue` affect the loop they are directly inside

```python
for row in grid:
    for cell in row:
        if cell == target:
            break        # leaves the INNER loop only
    # execution continues here — the outer loop keeps going
```

`break` never leaves more than one loop. This is the most common nested-loop
error and it is silent: the search appears to work on small inputs and quietly
scans everything on larger ones.

Three ways to leave both loops:

1. A flag: set `found = True` before the inner `break`, then `if found: break`
   in the outer body.
2. Put the search in a function and `return` — one word, leaves everything.
   (Stage 8.)
3. Restructure so there is only one loop, e.g. by iterating over pairs.

Option 2 is the usual answer in real code, and it is the reason Stage 8 comes
next.

### Nested loops and nested data

The shape of the loop usually mirrors the shape of the data:

```python
grid = [[1, 2, 3], [4, 5, 6]]

for row in grid:            # row is an inner LIST
    for cell in row:        # cell is a NUMBER
        print(cell)
```

Notice that `row` is bound to the inner list *object itself* — not a copy — so
`row.append(...)` inside the outer body changes the grid (Stage 5.8), and
`row = something` does not.

To reach cells by position, nest the ranges:

```python
for r in range(len(grid)):
    for c in range(len(grid[r])):
        grid[r][c] = grid[r][c] * 2
```

`len(grid)` is the number of rows; `len(grid[r])` is the length of *that* row,
which is the correct way to write it even when you believe every row is the same
length.

### Unpacking in nested walks

```python
points = [(0, "a"), (1, "b")]
for i, label in points:
    ...

for r, row in enumerate(grid):
    for c, cell in enumerate(row):
        print(r, c, cell)
```

`enumerate` at both levels gives you row and column positions along with the
value — the standard way to walk a grid when you need coordinates.

---

## Exercises

---

**7.1 — Mark the block**

For each line, say which loop it belongs to and how many times it runs.

```python
for a in range(2):
    for b in range(3):
        print(a, b)
    print("outer", a)
print("done")
```

---

**7.2 — What runs next?**

Number the execution order for the first **five** visits to any line, then give
the complete output.

```python
for x in "ab":
    for y in [1, 2]:
        print(x, y)
```

---

**7.3 — Compare near-matches**

Snippet **A**:

```python
for a in range(2):
    for b in range(2):
        print(a, b)
```

Snippet **B**:

```python
for a in range(2):
    for b in range(2):
        pass
    print(a, b)
```

Predict both outputs. In **B**, what is `b` bound to when the print runs, and why?

---

**7.4 — Predict the result**

```python
total = 0
for row in [[1, 2], [3, 4]]:
    for cell in row:
        total = total + cell
    print("after row", total)
print("total", total)
```

---

**7.5 — Build a trace table**

Make a table with one row per pass of the **inner** loop, showing `i`, `j`, and
`count` after the body runs. Then give the output.

```python
count = 0
for i in range(3):
    for j in range(2):
        count = count + 1
print(count, i, j)
```

---

**7.6 — Find and fix**

The intent is to stop searching entirely once the target is found. Say what
actually happens and fix it using a flag.

```python
grid = [[1, 2], [3, 4]]
target = 2
for row in grid:
    for cell in row:
        if cell == target:
            print("found")
            break
print("search over")
```

---

**7.7 — Predict the result**

```python
for i in range(3):
    for j in range(3):
        if j == 1:
            continue
        if i == 2:
            break
        print(i, j)
```

---

**7.8 — Predict the result**

```python
grid = [[1, 2], [3, 4]]
for row in grid:
    row.append(0)
print(grid)

grid2 = [[1, 2], [3, 4]]
for row in grid2:
    row = row + [0]
print(grid2)
```

---

**7.9 — Find and fix**

The intent is to double every cell in place. Say what happens and fix it.

```python
grid = [[1, 2], [3, 4]]
for row in grid:
    for cell in row:
        cell = cell * 2
print(grid)
```

---

**7.10 — Predict the result**

```python
grid = [[1, 2, 3], [4, 5]]
for r in range(len(grid)):
    for c in range(len(grid[r])):
        grid[r][c] = grid[r][c] * 10
print(grid)
```

Why would `range(3)` for the inner loop have been wrong?

---

**7.11 — Predict the result**

```python
grid = [["a", "b"], ["c", "d"]]
for r, row in enumerate(grid):
    for c, cell in enumerate(row):
        print(r, c, cell)
```

---

**7.12 — Write a small program**

Build a 3×3 multiplication grid: `table[r][c]` should be `(r + 1) * (c + 1)`.
Print it row by row. Requirements: the rows must be independent objects, and you
must build them with a loop or comprehension, not by writing three literals.

---

**7.13 — Compare near-matches**

Snippet **A**:

```python
rows = []
for r in range(2):
    row = []
    for c in range(2):
        row.append(c)
    rows.append(row)
print(rows, rows[0] is rows[1])
```

Snippet **B**:

```python
rows = []
row = []
for r in range(2):
    for c in range(2):
        row.append(c)
    rows.append(row)
print(rows, rows[0] is rows[1])
```

Predict both. Identify the single line whose *position* causes the difference.

---

**7.14 — Find and fix**

The intent is to collect every pair of different names. Diagnose the two things
wrong with the output and fix them.

```python
names = ["ann", "bo", "cy"]
pairs = []
for a in names:
    for b in names:
        pairs.append((a, b))
print(pairs)
print(len(pairs))
```

---

**7.15 — Predict the result**

```python
counts = 0
for a in range(3):
    for b in range(3):
        if a == b:
            continue
        counts += 1
print(counts)
```

---

**7.16 — What runs next?**

Number the execution order completely and give the output. Note carefully where
control goes after the `break`.

```python
found = None
for row in [[1, 2], [3, 4]]:
    for cell in row:
        if cell > 2:
            found = cell
            break
    if found is not None:
        break
print(found)
```

---

**7.17 — Predict the result**

```python
matrix = [[1, 2], [3, 4]]
flat = []
for row in matrix:
    for cell in row:
        flat.append(cell)
print(flat)
print([cell for row in matrix for cell in row])
```

Read the comprehension aloud and say which loop is the outer one.

---

**7.18 — Find and fix**

The intent is a list of three independent counters, each a two-item list. Say why
this fails and give two different fixes.

```python
counters = [[0, 0]] * 3
for i in range(3):
    counters[i][0] = i
print(counters)
```

---

**7.19 — State the rule**

Answer each in one sentence:

1. How do you work out how many times the innermost line runs?
2. Which loop does a `break` leave?
3. What is the inner loop's iterable walked from — the start, or where it left
   off — on each outer pass?
4. How do you decide which loop a given line belongs to?

---

## Checkpoint 7

**C7.1** — How many lines does this print, and what is the last one?

```python
for a in range(4):
    for b in range(5):
        print(a, b)
```

**C7.2** — Predict:

```python
for i in range(2):
    for j in range(2):
        print(i, j)
    print("-")
```

**C7.3** — A learner's nested search prints "found" and then keeps searching.
Name the cause in one sentence and give two different repairs.

**C7.4** — Predict and explain the identity check:

```python
rows = [[0] * 2 for _ in range(2)]
rows[0][0] = 9
print(rows, rows[0] is rows[1])
```

**C7.5** — In this snippet, which lines are at which level, and how many times
does each run?

```python
total = 0
for a in [1, 2]:
    total += a
    for b in [10]:
        total += b
print(total)
```

**C7.6** — Rewrite as a single nested-loop comprehension:

```python
out = []
for row in [[1, 2], [3]]:
    for cell in row:
        out.append(cell * 2)
```

---

---

# Stage 7 — Answer Key

---

### 7.1 — Mark the block

**Answer.**

| Line | Belongs to | Runs |
|---|---|---|
| `for a in range(2):` | top level | 3 visits (2 passes + the ending check) |
| `for b in range(3):` | outer body | 2 times (started afresh each outer pass), 4 visits each |
| `print(a, b)` | inner body | **6** times |
| `print("outer", a)` | outer body | 2 times |
| `print("done")` | after both | 1 time |

**Reasoning.** Indentation alone decides membership. The inner body's count is the
product, 2 × 3.

**Targeted misconception.** That `print("outer", a)`, being below the inner loop,
runs after everything — or that it runs six times because it is "inside a loop".

**If you missed it.** Syntax-reading error. Draw the vertical lines.

*Authoring record — Target: level identification and run counts. Prereq: 5.1.
Syntax lens: three indentation levels. Flow lens: multiplicative counts. Object
lens: none.*

---

### 7.2 — What runs next?

**Answer.** First five visits:

```text
1  for x in "ab":        (x = "a")
2      for y in [1, 2]:  (y = 1)
3          print(x, y)    → a 1
4      for y in [1, 2]:  (y = 2)
5          print(x, y)    → a 2
```

Complete output:

```text
a 1
a 2
b 1
b 2
```

**Reasoning.** The inner loop runs to completion — including its final "nothing
left" visit — before the outer loop advances. Then `[1, 2]` is walked from the
start again.

**Targeted misconception.** That the two loops advance in lockstep, giving
`a 1` then `b 2`.

**If you missed it.** Flow error.

*Authoring record — Target: inner loop completes per outer pass. Prereq: 7.1, 5.2.
Syntax lens: two headers. Flow lens: 2 × 2 passes. Object lens: two bindings per
inner pass.*

---

### 7.3 — Compare near-matches

**Answer.** **A**:

```text
0 0
0 1
1 0
1 1
```

**B**:

```text
0 1
1 1
```

**Why `b` is 1.** The `print` in **B** sits in the *outer* body, so it runs after
the inner loop has finished. The loop variable survives (5.3), still bound to the
last value the inner loop gave it — `1`. On the second outer pass the inner loop
runs again and leaves `b` at 1 once more.

**Targeted misconception.** That a line below an inner loop is unreachable, or
that `b` is unbound outside its loop.

**If you missed it.** Flow error, with a name-lifetime component.

*Authoring record — Target: outer-body line after an inner loop; loop-variable
persistence. Prereq: 5.3, 7.1. Syntax lens: indentation of the print. Flow lens:
runs once per outer pass. Object lens: `b` retains its last binding.*

---

### 7.4 — Predict the result

**Answer.**

```text
after row 3
after row 10
total 10
```

**Reasoning.** `print("after row", total)` is in the outer body, so it runs once
per row — after that row's cells have been added. 1+2 = 3; then 3+4 brings the
running total to 10.

**Targeted misconception.** That the accumulator resets per row. Nothing resets
it; it is bound once, before both loops.

**If you missed it.** Flow error. Compare: moving `total = 0` into the outer body
would give per-row sums instead.

*Authoring record — Target: accumulator across nested loops. Prereq: 5.6, 7.1.
Syntax lens: initialization outside both loops. Flow lens: 4 inner passes, 2 outer
prints. Object lens: `total` rebound four times.*

---

### 7.5 — Build a trace table

**Answer.**

| inner pass | `i` | `j` | `count` after |
|---|---|---|---|
| 1 | 0 | 0 | 1 |
| 2 | 0 | 1 | 2 |
| 3 | 1 | 0 | 3 |
| 4 | 1 | 1 | 4 |
| 5 | 2 | 0 | 5 |
| 6 | 2 | 1 | 6 |

Output: `6 2 1`.

**Reasoning.** 3 × 2 = 6 passes. Both loop variables survive, holding their last
values: `i` reached 2, and `j` reached 1 on its final walk.

**Targeted misconception.** That `j` ends at 2 (the range bound) or is unbound.

**If you missed it.** Flow error.

*Authoring record — Target: full nested trace, terminal bindings. Prereq: 7.2, 5.3.
Syntax lens: two ranges. Flow lens: product of counts. Object lens: two surviving
bindings.*

---

### 7.6 — Find and fix

**Answer.** It prints:

```text
found
search over
```

which *looks* correct — and that is the problem. The `break` left only the inner
loop; the outer loop then continued and scanned `[3, 4]` in full. With a target in
the first of a thousand rows, the program still reads all thousand. Change
`target` to 3 and you would see `found` printed while the first row was scanned
pointlessly first.

**Fix with a flag.**

```python
found = False
for row in grid:
    for cell in row:
        if cell == target:
            print("found")
            found = True
            break
    if found:
        break
print("search over")
```

**Reasoning.** The outer loop needs its own `break`, and it needs a way to know
that the inner one succeeded. That is all a flag is.

**Targeted misconception.** That `break` exits all enclosing loops.

**If you missed it.** Flow error — and note that no output difference gave it
away, which is why this bug survives testing.

*Authoring record — Target: `break` leaves one loop. Prereq: 5.10, 7.1. Syntax
lens: `break` depth versus loop depth. Flow lens: outer loop continues. Object
lens: flag binding carries information across levels.*

---

### 7.7 — Predict the result

**Answer.**

```text
0 0
0 2
1 0
1 2
```

**Reasoning.** Trace by outer pass:

- `i = 0`: `j = 0` prints; `j = 1` hits `continue` and skips the rest of that
  pass; `j = 2` prints.
- `i = 1`: identical.
- `i = 2`: `j = 0` — `continue` does not fire, then `if i == 2` fires and
  `break` ends the inner loop. Nothing prints. The outer loop then advances,
  finds nothing left, and the program ends.

Note the ordering trap: at `i = 2, j = 1`, the `continue` would have fired first —
but the loop already broke at `j = 0`, so that never arises.

**Targeted misconception.** That `continue` and `break` can be read in isolation
from the order of the `if`s above them.

**If you missed it.** Flow error.

*Authoring record — Target: `continue` and `break` interacting in a nested body.
Prereq: 5.11, 7.6. Syntax lens: two guards in one body. Flow lens: order of the
guards decides. Object lens: none.*

---

### 7.8 — Predict the result

**Answer.**

```text
[[1, 2, 0], [3, 4, 0]]
[[1, 2], [3, 4]]
```

**Reasoning.** `row` is bound to the inner list object itself. `.append` changes
that object, and the grid's slot points at it. `row = row + [0]` builds a new list
and rebinds the loop variable — inert, exactly as in 5.7 and 5.8.

**Targeted misconception.** That a loop over a nested structure hands you copies
of the rows.

**If you missed it.** Object-model error. Go back to 3.13 and 5.8.

*Authoring record — Target: loop variable aliases the inner object. Prereq: 5.8.
Syntax lens: `.append` versus `= ... +`. Flow lens: two passes each. Object lens:
inner lists changed versus untouched.*

---

### 7.9 — Find and fix

**Answer.** It prints `[[1, 2], [3, 4]]` — unchanged. `cell = cell * 2` rebinds
the inner loop variable and never writes into any list.

**Fix.** Write the slots by position:

```python
grid = [[1, 2], [3, 4]]
for r in range(len(grid)):
    for c in range(len(grid[r])):
        grid[r][c] = grid[r][c] * 2
print(grid)                       # [[2, 4], [6, 8]]
```

Or replace each row's contents in place, which also works through any other name
pointing at that row:

```python
for row in grid:
    row[:] = [cell * 2 for cell in row]
```

Or, if rebinding `grid` is acceptable, build a new structure:

```python
grid = [[cell * 2 for cell in row] for row in grid]
```

**Reasoning.** Three fixes, three different object-level effects: the first two
change the existing inner lists; the third leaves them alone and points `grid` at
entirely new lists. Which is correct depends on whether anything else points at
the old rows.

**Targeted misconception.** That assigning to the innermost loop variable edits
the grid.

**If you missed it.** Object-model error. Go back to 5.9.

*Authoring record — Target: in-place cell update at two levels. Prereq: 5.9, 7.8.
Syntax lens: `grid[r][c] = ...` versus `cell = ...`. Flow lens: 4 inner passes.
Object lens: slot writes versus rebinding.*

---

### 7.10 — Predict the result

**Answer.** `[[10, 20, 30], [40, 50]]`

**Why `range(3)` would be wrong.** The second row has only two slots, so `c = 2`
would raise `IndexError` on `grid[1][2]`. Writing `range(len(grid[r]))` asks each
row for its own length, which is correct whatever the shape — and it costs nothing
when the rows happen to be equal.

**Targeted misconception.** That a "grid" is necessarily rectangular, so one
length can be measured once and reused.

**If you missed it.** Syntax-reading error, of the assumed-shape kind.

*Authoring record — Target: per-row length in nested position loops. Prereq: 7.9,
3.4. Syntax lens: `len(grid[r])`. Flow lens: 3 + 2 inner passes. Object lens: slot
writes.*

---

### 7.11 — Predict the result

**Answer.**

```text
0 0 a
0 1 b
1 0 c
1 1 d
```

**Reasoning.** `enumerate` at both levels gives row index with row, then column
index with cell. Four inner passes, each binding four names in total across the
two levels.

**Targeted misconception.** That nesting `enumerate` restarts the outer counter,
or that `c` continues counting across rows. Each inner `enumerate` is a fresh one,
starting at 0 on every outer pass.

**If you missed it.** Flow error.

*Authoring record — Target: coordinates via nested `enumerate`. Prereq: 6.11, 7.2.
Syntax lens: unpacking at two levels. Flow lens: inner enumerate restarts. Object
lens: fresh tuples per pass.*

---

### 7.12 — Write a small program

**Answer.**

```python
table = []
for r in range(3):
    row = []
    for c in range(3):
        row.append((r + 1) * (c + 1))
    table.append(row)

for row in table:
    print(row)
```

Output:

```text
[1, 2, 3]
[2, 4, 6]
[3, 6, 9]
```

Or as a comprehension:

```python
table = [[(r + 1) * (c + 1) for c in range(3)] for r in range(3)]
```

**Reasoning.** In the loop version, `row = []` must sit **inside the outer body**
so it runs three times and produces three distinct lists — see 7.13. In the
comprehension version, the inner comprehension is re-evaluated per outer pass for
the same reason (6.15).

**Targeted misconception.** That the accumulator for the row can be bound once
before the outer loop, as the total was in 7.4. A number accumulator and a
per-row container are opposite cases.

**If you missed it.** Object-model error if your rows came out shared;
syntax-reading if the nesting was off.

*Authoring record — Target: build independent rows in a nested loop. Prereq: 6.15,
7.4. Syntax lens: placement of `row = []`. Flow lens: 3 outer, 9 inner passes.
Object lens: three distinct inner lists.*

---

### 7.13 — Compare near-matches

**Answer.** **A** prints `[[0, 1], [0, 1]] False`. **B** prints
`[[0, 1, 0, 1], [0, 1, 0, 1]] True`.

**The deciding line is `row = []`, and specifically its position.** In **A** it is
inside the outer body, so it runs twice and produces two lists. In **B** it runs
once, before everything, so there is one list — appended to four times and then
appended into `rows` twice. Both slots of `rows` point at that one list, which is
why the identity check is `True` and why both "rows" show all four values.

**Reasoning.** The number of times a line runs is the number of objects it
produces. Same rule as 4.7 and 6.15, now expressed as an indentation choice.

**Targeted misconception.** That where a line sits is a matter of tidiness.

**If you missed it.** Object-model error, caused by a flow misreading — the pair
that this stage exists to train.

*Authoring record — Target: accumulator placement decides object count. Prereq:
4.7, 7.12. Syntax lens: indentation level of a binding. Flow lens: once versus
per-outer-pass. Object lens: one inner list versus two.*

---

### 7.14 — Find and fix

**Answer.** It prints all nine pairs, `len` 9. Two things are wrong: it includes
pairs of a name with itself (`("ann", "ann")`), and it includes both orders of
each pair (`("ann", "bo")` and `("bo", "ann")`), which the phrase "every pair of
different names" does not want.

**Fix.**

```python
names = ["ann", "bo", "cy"]
pairs = []
for i in range(len(names)):
    for j in range(i + 1, len(names)):
        pairs.append((names[i], names[j]))
print(pairs)      # [('ann', 'bo'), ('ann', 'cy'), ('bo', 'cy')]
print(len(pairs)) # 3
```

**Reasoning.** Starting the inner loop at `i + 1` does both jobs at once: it skips
the self-pair and it never revisits an earlier name. This "inner range depends on
the outer variable" shape is worth recognizing — it is how every
pairs/combinations loop is written.

**Targeted misconception.** That the inner iterable must be independent of the
outer loop variable.

**If you missed it.** Flow error.

*Authoring record — Target: dependent inner range. Prereq: 7.10. Syntax lens:
`range(i + 1, len(names))`. Flow lens: 3 + 2 + 1 passes, not 9. Object lens:
tuples accumulated.*

---

### 7.15 — Predict the result

**Answer.** `6`

**Reasoning.** 3 × 3 = 9 inner passes; the three where `a == b` hit `continue`
before reaching the counter. 9 − 3 = 6.

**Targeted misconception.** That `continue` in a nested body skips the rest of the
outer pass too. It abandons only the current inner pass.

**If you missed it.** Flow error.

*Authoring record — Target: `continue` at the inner level. Prereq: 5.11, 7.7.
Syntax lens: guard before the accumulator. Flow lens: 9 passes, 6 completions.
Object lens: `counts` rebound six times.*

---

### 7.16 — What runs next?

**Answer.**

```text
1   found = None
2   for row in [[1, 2], [3, 4]]:      (row = [1, 2])
3       for cell in row:              (cell = 1)
4           if cell > 2:               → False
5       for cell in row:              (cell = 2)
6           if cell > 2:               → False
7       for cell in row:              (nothing left; inner loop ends)
8       if found is not None:          → False
9   for row in [[1, 2], [3, 4]]:      (row = [3, 4])
10      for cell in row:              (cell = 3)
11          if cell > 2:               → True
12              found = cell
13              break                  → leaves the inner loop
14      if found is not None:          → True
15          break                      → leaves the outer loop
16  print(found)                       → 3
```

Output: `3`.

**Where control goes after the `break` on line 13:** to the first line of the
**outer body** that follows the inner loop — line 14 — *not* out of both loops and
not back to the inner `for`.

**Reasoning.** This is 7.6's flag pattern written correctly, and the numbering is
the proof that it stops early: the cell `4` is never examined.

**Targeted misconception.** That `break` jumps to after the outer loop.

**If you missed it.** Flow error.

*Authoring record — Target: exact destination of `break`; flag pattern. Prereq:
7.6. Syntax lens: two `break`s at two levels. Flow lens: early exit verified by
numbering. Object lens: `found` carries the value out.*

---

### 7.17 — Predict the result

**Answer.** Both lines print `[1, 2, 3, 4]`.

**Reading the comprehension.** `[cell for row in matrix for cell in row]` reads
left to right in the *same order as the nested loops*: `for row in matrix` is the
outer loop, `for cell in row` is the inner one, and `cell` — written first — is
what gets collected. The rule: the `for` clauses appear in outer-to-inner order,
just as they would if written out.

**Targeted misconception.** That the clauses read right-to-left, or that the
leading expression belongs to the first `for`.

**If you missed it.** Syntax-reading error.

*Authoring record — Target: nested comprehension clause order. Prereq: 6.14, 7.2.
Syntax lens: two `for` clauses in one comprehension. Flow lens: 2 × 2 passes.
Object lens: one new flat list.*

---

### 7.18 — Find and fix

**Answer.** It prints `[[2, 0], [2, 0], [2, 0]]`. There is one inner list; the
loop wrote its slot 0 three times, ending at 2, and all three outer slots point at
it.

**Fix one — build with re-evaluation:**

```python
counters = [[0, 0] for _ in range(3)]
```

**Fix two — write the literals separately** (fine for a fixed, small size):

```python
counters = [[0, 0], [0, 0], [0, 0]]
```

**Reasoning.** Both fixes do the same thing: make the inner literal run three
times. What does *not* work is any copy of `counters` after the fact —
`counters[:]` or `list(counters)` duplicate the outer level, which was never the
problem (4.9).

**Targeted misconception.** That the loop is at fault. The loop is correct; the
construction on line 1 is the bug.

**If you missed it.** Object-model error. Go back to 4.6 and 6.15.

*Authoring record — Target: the repetition pitfall exposed by a loop. Prereq: 4.6,
6.15, 5.18. Syntax lens: `[[0, 0]] * 3`. Flow lens: three writes to one object.
Object lens: one inner list, three arrows.*

---

### 7.19 — State the rule

**Answer.**

1. Multiply the pass counts of every loop it is inside — outer × inner (× any
   further levels).
2. Only the loop it is directly inside; control resumes at the next line of the
   enclosing body.
3. From the start — the inner loop's iterable is walked afresh on every outer
   pass.
4. By its indentation: it belongs to the nearest colon-block above it that is
   indented less than it is.

**If you missed any.** (1) and (3) flow; (2) flow; (4) syntax-reading.

*Authoring record — Target: generalize the stage. Prereq: 7.1–7.18. Syntax lens:
indentation. Flow lens: counts and `break` scope. Object lens: none.*

---

## Checkpoint 7 — Answers

**C7.1** — 20 lines; the last is `3 4`. **Error type if missed:** flow. Go back to
7.1.

**C7.2** —

```text
0 0
0 1
-
1 0
1 1
-
```

**Error type if missed:** syntax-reading (the `-` is in the outer body). Go back to
7.3.

**C7.3** — The `break` leaves only the inner loop, so the outer loop keeps going.
Repairs: set a flag and `break` again in the outer body; or move the search into a
function and `return` (Stage 8). **Error type if missed:** flow. Go back to 7.6.

**C7.4** — `[[9, 0], [0, 0]] False`. The comprehension re-evaluated `[0] * 2` on
each pass, so the two rows are distinct objects and writing one does not touch the
other. **Error type if missed:** object-model. Go back to 6.15 and 7.18.

**C7.5** — `total = 0` and `print(total)` are at the top level, once each.
`total += a` and the `for b` line are in the outer body: twice each. `total += b`
is in the inner body: twice (once per outer pass, since `[10]` has one item).
Output: `23`. **Error type if missed:** syntax-reading. Go back to 7.1 and 7.4.

**C7.6** — `out = [cell * 2 for row in [[1, 2], [3]] for cell in row]`, giving
`[2, 4, 6]`. **Error type if missed:** syntax-reading. Go back to 7.17.

---

## Before moving on

You can now say, for any line at any depth, which loop owns it and how many times
it runs — and you have seen that the clean way to leave a nested search is a
`return`. Stage 8 introduces the boundary that makes that possible.
