# Stage 9 — Integration and Capstone

**The one new move:** none. Every construct is now on the table. This stage asks
you to use them together on programs long enough that you cannot hold them in your
head — which is the situation reading real code always is.

---

## How to work this stage

For each program, in this order:

1. **Mark the blocks.** Draw the vertical lines. Note every level change.
2. **Trace the flow.** Which lines run, how often, in what order — including into
   and out of calls.
3. **Draw the objects.** Names, arrows, and which containers share which inner
   objects.
4. **Predict.** Write the output down before running anything.
5. **Diagnose.** For each wrong result, name the *event* that caused it and the
   *line* it happened on. These are often different lines.
6. **Repair, minimally.** Then justify the repair in terms of names and objects.

Do not skip step 3 on any program in this stage. Every one of them turns on
something the diagram shows and the code does not.

---

## Part A — Integration exercises

---

**9.1 — Predict, then diagnose**

```python
def register(name, roster):
    roster.append(name)
    return roster

team_a = []
team_b = register("ann", team_a)
register("bo", team_b)
print(team_a, team_b, team_a is team_b)
```

---

**9.2 — Predict the result**

```python
data = {"a": [1, 2], "b": [3]}
backup = dict(data)
for key in data:
    data[key].append(0)
print(data)
print(backup)
```

Which level was copied, and which change crossed?

---

**9.3 — Find and fix**

The intent is to give each student an independent list and record one grade each.

```python
def make_records(names, blank=[]):
    records = {}
    for n in names:
        records[n] = blank
    return records

r = make_records(["ann", "bo"])
r["ann"].append(90)
print(r)
```

Name **both** faults, and say which one alone would have been enough to cause the
output you see.

---

**9.4 — What runs next?**

Number the execution order completely, including descents into calls, and give
the output.

```python
def half(n):
    return n // 2

values = [8, 5]
out = []
for v in values:
    if v % 2 == 1:
        continue
    out.append(half(v))
print(out)
```

---

**9.5 — Predict the result**

```python
def grow(xs):
    xs = xs + [0]
    xs.append(1)
    return xs

original = [7]
returned = grow(original)
print(original, returned)
```

Say what happened to each of the three lists involved.

---

**9.6 — Find and fix**

The intent is to remove all empty rows from the grid.

```python
grid = [[1], [], [], [2]]
for row in grid:
    if len(row) == 0:
        grid.remove(row)
print(grid)
```

---

**9.7 — Predict the result**

```python
def counts(text):
    result = {}
    for c in text:
        result[c] = result.get(c, 0) + 1
    return result

a = counts("aab")
b = counts("aab")
a["z"] = 1
print(a, b, a == b, a is b)
```

---

**9.8 — Compare near-matches**

Snippet **A**:

```python
def widen(grid):
    for row in grid:
        row.append(0)
    return grid

g = [[1], [2]]
h = widen(g)
print(g, h, g is h)
```

Snippet **B**:

```python
def widen(grid):
    return [row + [0] for row in grid]

g = [[1], [2]]
h = widen(g)
print(g, h, g is h)
```

Predict both. For each, say which objects the caller ends up sharing with the
result.

---

**9.9 — Find and fix**

The intent is a leaderboard that records each round's standings.

```python
standings = ["ann", "bo"]
rounds = []
rounds.append(standings)
standings.reverse()
rounds.append(standings)
print(rounds)
```

---

**9.10 — Write a small program**

Write a function `transpose(grid)` that takes a rectangular grid (a list of
equal-length lists) and returns a new grid with rows and columns swapped. It must
not change the input, and the returned grid's rows must be independent objects.
Demonstrate all three properties with printed evidence.

---

---

## Part B — The Capstone

Read the whole program before touching anything.

```python
 1  def new_board(rows, cols):
 2      return [[0] * cols] * rows
 3
 4  def record(board, row, col, points, log=[]):
 5      board[row][col] = board[row][col] + points
 6      log.append((row, col, points))
 7      return log
 8
 9  def row_totals(board):
10      totals = []
11      for row in board:
12          total = 0
13          for cell in row:
14              total = total + cell
15          totals.append(total)
16      return totals
17
18  def best_row(totals):
19      best = 0
20      for i, t in enumerate(totals):
21          if t > totals[best]:
22              best = i
23              break
24      return best
25
26  board = new_board(3, 3)
27  record(board, 0, 0, 5)
28  record(board, 1, 1, 7)
29  history = record(board, 2, 2, 12)
30  print(board)
31  print(row_totals(board))
32  print(best_row(row_totals(board)))
33  print(history)
```

The program is meant to keep a 3×3 scoreboard, add points to individual cells,
report each row's total, report which row is leading, and return a log of every
recorded score.

---

**9.C1 — Mark the blocks**

For each of lines 10–16, state which block it belongs to and how many times it
runs during **one** call of `row_totals` on a 3×3 board.

---

**9.C2 — Trace the flow**

Number the execution order for lines 26–30 only, descending into each call. You do
not need to number inside `row_totals`.

---

**9.C3 — Draw the names and objects**

Draw the picture immediately after line 26 runs, and again immediately after line
27 runs. Use one box per list object.

---

**9.C4 — Predict**

Write down, before running anything, the four lines this program prints.

---

**9.C5 — Diagnose**

The program has **three** distinct defects. For each, give:

- the line where the wrong *event* happens (not where the symptom appears);
- what the event is, in terms of names and objects or of flow;
- the misconception it comes from;
- and whether it is a syntax-reading, flow, or object-model defect.

---

**9.C6 — The hidden one**

One defect is completely invisible in this program's output and only appears when
the program does something it does not currently do. Identify it, and write the
two extra lines that would expose it.

---

**9.C7 — Repair**

Fix all three defects with the smallest changes you can. Then predict the four
printed lines again.

Note carefully: one of your three fixes will make a *previously invisible* defect
start producing wrong output. Say which fix reveals which defect, and why it was
masked before.

---

**9.C8 — Extend, and justify**

Add a function `snapshot(board)` that returns a record of the board that will not
change when the board is later scored. Show it working. Then justify, in two
sentences, why you chose the copying method you did — including why the cheaper
alternative would not have been enough.

---

---

# Stage 9 — Answer Key

---

### 9.1 — Predict, then diagnose

**Answer.** `['ann', 'bo'] ['ann', 'bo'] True`

**Diagnosis.** `register` changes the list it is given and then returns that same
object. So `team_b` is not a second team — it is a second name for `team_a`. The
second call appends to the one list through the other name. The `True` is the
proof.

The defect is a design one, on the `return roster` line combined with the
`.append`: the function both changes its input and returns it (Exercise 8.20). A
caller reasonably reads `team_b = register(...)` as producing something new.

**Error type.** Object-model.

*Authoring record — Target: change-and-return conflation across a boundary.
Prereq: 8.5, 8.20. Syntax lens: `.append` then `return` of the same name. Flow
lens: two calls. Object lens: one list, three names.*

---

### 9.2 — Predict the result

**Answer.**

```text
{'a': [1, 2, 0], 'b': [3, 0]}
{'a': [1, 2, 0], 'b': [3, 0]}
```

**Which level.** `dict(data)` copied the outer level — the set of pairs. Both
dictionaries have their own pairs, so adding or deleting a *key* would affect only
one. But both sets of pairs point at the same two lists, so the append crossed.

**Error type if missed.** Object-model. Go back to 4.11.

*Authoring record — Target: shallow dictionary copy under iteration. Prereq: 4.11,
6.2. Syntax lens: `dict(d)`, `d[key].append`. Flow lens: two passes. Object lens:
two dictionaries, two shared lists.*

---

### 9.3 — Find and fix

**Answer.** It prints `{'ann': [90], 'bo': [90]}`.

**Two faults.**

1. **The default argument** (`blank=[]`, line 1): one list is built when the `def`
   line runs and reused by every call that omits the argument. A second call to
   `make_records` would find the grade already there.
2. **The shared name in the loop** (`records[n] = blank`, line 4): every key is
   pointed at that one list. Even with a fresh default per call, all students in a
   single call would share one list.

**Which alone suffices.** Fault 2 alone fully explains the printed output — within
a single call, both keys point at one list regardless of where that list came
from. Fault 1 produces no visible symptom here at all; it needs a second call.

**Fix.**

```python
def make_records(names):
    records = {}
    for n in names:
        records[n] = []
    return records
```

The parameter disappears entirely, and `[]` inside the loop body runs once per
pass, producing one list per student.

**Error type.** Object-model, twice.

*Authoring record — Target: two stacked sharing faults; attribute the symptom
correctly. Prereq: 4.18, 8.16. Syntax lens: default value; a name used as a value.
Flow lens: default evaluated once at definition; body per pass. Object lens: one
list, two keys.*

---

### 9.4 — What runs next?

**Answer.**

```text
1   def half(n):            (defines; body not run)
2   values = [8, 5]
3   out = []
4   for v in values:        (v = 8)
5       if v % 2 == 1:       → False
6       out.append(half(v))
7           return n // 2    (inside the call; produces 4)
8       out.append(4)        (the call has returned; the append happens)
9   for v in values:        (v = 5)
10      if v % 2 == 1:       → True
11          continue         → back to the for line
12  for v in values:        (nothing left)
13  print(out)               → [4]
```

Output: `[4]`.

**Reasoning.** Two things are worth noticing. The argument `v` is worked out and
the call runs *before* `.append` receives anything — the inner call completes
first. And `continue` returns control to the `for` line, not to the line after the
`if`.

**Error type if missed.** Flow.

*Authoring record — Target: trace a call nested inside a loop with a guard.
Prereq: 5.11, 8.1. Syntax lens: call as an argument. Flow lens: descent and
return; `continue`. Object lens: one list changed once.*

---

### 9.5 — Predict the result

**Answer.** `[7] [7, 0, 1]`

**The three lists.**

- `#1 [7]` — built by the caller, bound to `original`, and briefly to the
  parameter `xs`. Never changed. It ends the program still bound to `original`.
- `#2 [7, 0]` — built by `xs + [0]` on line 2. The local name `xs` is rebound to
  it. The caller cannot see this.
- `#2 again` — line 3's `.append` changes that same new list to `[7, 0, 1]`. It is
  not a third list: `+` created one object and `.append` changed it.

So there are only **two** list objects, and the returned one is the new one.
`original` is untouched because the rebinding on line 2 happened *before* any
change.

**Error type if missed.** Object-model. Compare 8.7, where the change came first
and did cross the boundary.

*Authoring record — Target: rebind-then-change inside a call. Prereq: 8.6, 8.7.
Syntax lens: `= ... +` then `.append`. Flow lens: one call. Object lens: two lists;
order of the two events decides visibility.*

---

### 9.6 — Find and fix

**Answer.** It prints `[[1], [], [2]]` — one empty row survives.

**Trace.**

| loop is at position | `grid` at that moment | `row` | action |
|---|---|---|---|
| 0 | `[[1], [], [], [2]]` | `[1]` | not empty, nothing |
| 1 | `[[1], [], [], [2]]` | `[]` | remove → `[[1], [], [2]]` |
| 2 | `[[1], [], [2]]` | `[2]` | not empty, nothing |
| 3 | `[[1], [], [2]]` | — | past the end; loop ends |

The removal shifted everything left, so the second empty row slid into position 1 —
a position the walk had already passed. It is never examined.

**Two things are wrong at once**, and both are worth naming. The loop is changing
the list it is walking (Stage 5.13). And `.remove(row)` removes the **first item
equal to** its argument, not the item the loop is currently at — with duplicate
rows, "remove this one" is not what that line says. Since all empty lists are
equal, the two faults happen to cancel out on some inputs and not on others, which
is why a version of this bug can pass a test and fail in production.

**Fix.** Build a new list instead:

```python
grid = [row for row in grid if len(row) > 0]
```

or, if other names must see the change to the existing list:

```python
grid[:] = [row for row in grid if len(row) > 0]
```

Both give `[[1], [2]]`. Note the difference between them is exactly Stage 2's:
the first rebinds the name, the second writes every slot of the original object.

**Error type.** Flow, with an object-model component (equality-based removal).

*Authoring record — Target: removal during iteration compounded by equality
matching. Prereq: 5.13, 5.14. Syntax lens: `.remove` in a body. Flow lens: shifting
positions skip an item. Object lens: `.remove` matches by equality, not identity.*

---

### 9.7 — Predict the result

**Answer.** `{'a': 2, 'b': 1, 'z': 1} {'a': 2, 'b': 1} False False`

**Reasoning.** `result = {}` is inside the body, so each call builds its own
dictionary — the two results are separate objects and start out equal. Adding
`"z"` to one makes them unequal, so both `==` and `is` are `False`. Had `result`
been a default argument, all four answers would have been different.

**Error type if missed.** Object-model. Go back to 8.11 and 8.19.

*Authoring record — Target: fresh result per call; `==` versus `is`. Prereq: 8.19,
1.11. Syntax lens: local accumulator. Flow lens: two independent calls. Object
lens: two dictionaries.*

---

### 9.8 — Compare near-matches

**Answer.** **A** prints `[[1, 0], [2, 0]] [[1, 0], [2, 0]] True`.
**B** prints `[[1], [2]] [[1, 0], [2, 0]] False`.

**What the caller shares.**

- **A:** everything. `h` *is* `g` — one outer list — and the inner lists were
  changed in place. The function's "result" adds nothing the caller did not
  already have.
- **B:** nothing. The comprehension built a new outer list, and `row + [0]` built
  a new inner list per row. `g` is untouched at both levels. (Note that if the
  inner lists themselves contained lists, `row + [0]` would still share *those* —
  **B** is independent to two levels, not to all levels.)

**Reasoning.** **B** is the safer interface for the same reason **A** in Exercise
8.20 was: it does one thing, and the caller decides what to keep.

**Error type if missed.** Object-model.

*Authoring record — Target: in-place versus constructing function, at two levels.
Prereq: 8.20, 7.8. Syntax lens: `.append` loop versus comprehension. Flow lens:
two passes each. Object lens: full sharing versus none.*

---

### 9.9 — Find and fix

**Answer.** It prints `[['bo', 'ann'], ['bo', 'ann']]`.

**Diagnosis.** Both entries in `rounds` are the same list — the one `standings`
points at. `.reverse()` changed that list in place, so the "round 1 record" was
rewritten retroactively, and the second append merely added a second arrow to it.

**Fix.** Record a copy at each round:

```python
rounds.append(standings[:])
standings.reverse()
rounds.append(standings[:])
print(rounds)             # [['ann', 'bo'], ['bo', 'ann']]
```

**Justification.** A log entry must be a *snapshot*, and a changeable object
stored by name is a *live view*. `[:]` is enough here because the items are
strings; if each standing were itself a list, `copy.deepcopy` would be required.

**Error type.** Object-model. This is 4.15 in a different costume — and it will be
in the capstone too.

*Authoring record — Target: snapshot versus live view in a log. Prereq: 4.15.
Syntax lens: `.append(name)` versus `.append(name[:])`. Flow lens: change between
two appends. Object lens: one list, two arrows.*

---

### 9.10 — Write a small program

**Answer.**

```python
def transpose(grid):
    result = []
    for c in range(len(grid[0])):
        new_row = []
        for r in range(len(grid)):
            new_row.append(grid[r][c])
        result.append(new_row)
    return result

g = [[1, 2, 3], [4, 5, 6]]
t = transpose(g)
print(t)                              # [[1, 4], [2, 5], [3, 6]]
print(g)                              # [[1, 2, 3], [4, 5, 6]] — unchanged
print(t[0] is t[1])                   # False — rows are distinct objects
t[0].append(99)
print(t, g)                           # only t changed
```

Or as a comprehension:

```python
def transpose(grid):
    return [[grid[r][c] for r in range(len(grid))] for c in range(len(grid[0]))]
```

**Reasoning.** Three properties, three causes. The input is unchanged because the
body only *reads* `grid[r][c]`. The rows are independent because `new_row = []` sits
in the outer body and runs once per column (7.13). The cells are numbers, so
nothing below the row level can be shared in a way that matters — with changeable
cells, this transpose would share them, and whether that is acceptable would need
stating.

**Error type if missed.** Object-model if your rows came out shared; syntax-reading
if the index order was swapped.

*Authoring record — Target: construct an independent derived structure. Prereq:
7.12, 8.19. Syntax lens: nested position loops with swapped indices. Flow lens:
`len(grid[0])` outer, `len(grid)` inner. Object lens: fresh rows; input read-only.*

---

---

## Capstone — Answer Key

---

### 9.C1 — Mark the blocks

**Answer.** For one call on a 3×3 board:

| Line | Block | Runs |
|---|---|---|
| 10 `totals = []` | function body, top level | 1 |
| 11 `for row in board:` | function body | 4 visits (3 passes + the ending check) |
| 12 `total = 0` | outer loop body | 3 |
| 13 `for cell in row:` | outer loop body | 3 times, 4 visits each |
| 14 `total = total + cell` | inner loop body | **9** |
| 15 `totals.append(total)` | outer loop body | 3 |
| 16 `return totals` | function body | 1 |

**The line to check yourself on is 15.** It is indented to the outer body, so it
runs once per row — after that row's inner loop has finished. Indented one step
further, it would run nine times and produce nine totals.

**Error type if missed.** Syntax-reading.

*Authoring record — Target: three-level block identification inside a function.
Prereq: 7.1, 8.3. Syntax lens: three indentation levels. Flow lens: 3 × 3 passes.
Object lens: one accumulator list changed three times.*

---

### 9.C2 — Trace the flow

**Answer.**

```text
1   board = new_board(3, 3)
2       return [[0] * cols] * rows        (builds and returns; call ends)
3   record(board, 0, 0, 5)
4       board[row][col] = board[row][col] + points
5       log.append((row, col, points))
6       return log                        (returned value discarded)
7   record(board, 1, 1, 7)
8       board[row][col] = ...
9       log.append(...)
10      return log                        (discarded)
11  history = record(board, 2, 2, 12)
12      board[row][col] = ...
13      log.append(...)
14      return log                        (bound to history)
15  print(board)
```

**Worth noticing.** Lines 27 and 28 call a function that returns something and
throw it away. That is legal, and here it hides the fact that the log is shared —
the caller never sees a log until line 29, by which point all three entries are in
it.

**Error type if missed.** Flow.

*Authoring record — Target: execution order across repeated calls. Prereq: 8.1.
Syntax lens: call statements with discarded results. Flow lens: three calls into
one body. Object lens: one log object across all three.*

---

### 9.C3 — Draw the names and objects

**Answer.** After line 26:

```text
board ─▶ #1 [ ●, ●, ● ]
              │  │  │
              └──┴──┴──▶ #2 [0, 0, 0]
```

**One** inner list, pointed at from all three slots of the outer list.

After line 27 (`record(board, 0, 0, 5)` — which does
`board[0][0] = board[0][0] + 5`):

```text
board ─▶ #1 [ ●, ●, ● ]
              │  │  │
              └──┴──┴──▶ #2 [5, 0, 0]
```

The write went into `#2`, which every slot points at. There is also, off to the
side, the default log:

```text
record's default log ─▶ #3 [(0, 0, 5)]
```

which belongs to the function object, not to this call.

**Error type if missed.** Object-model. Go back to 4.6.

*Authoring record — Target: diagram the repetition pitfall in situ. Prereq: 4.6,
8.16. Syntax lens: `[[0] * cols] * rows`. Flow lens: one write. Object lens: two
lists plus the definition-time default.*

---

### 9.C4 — Predict

**Answer.**

```text
[[5, 7, 12], [5, 7, 12], [5, 7, 12]]
[24, 24, 24]
0
[(0, 0, 5), (1, 1, 7), (2, 2, 12)]
```

**Reasoning.** All three writes landed in the one shared row, giving `[5, 7, 12]`
displayed three times. Every row total is therefore 5+7+12 = 24. `best_row` finds
no total strictly greater than `totals[0]`, so it never rebinds `best` and returns
0. The log looks entirely correct — which is the point of 9.C6.

**Error type if missed.** Object-model on lines 1–2; flow on line 3.

*Authoring record — Target: full-program prediction. Prereq: 9.C1–9.C3. Syntax
lens: whole program. Flow lens: three calls, two loops. Object lens: shared row.*

---

### 9.C5 — Diagnose

**Answer.**

**Defect 1 — line 2, `[[0] * cols] * rows`.**
*Event:* `[0] * cols` is evaluated **once**, producing one list; the outer `* rows`
then builds an outer list whose slots all point at that one object. Writing any
cell writes every row's cell.
*Misconception:* that `*` on a list of lists produces independent inner lists.
*Type:* object-model.

**Defect 2 — line 4, `log=[]`.**
*Event:* the default list is built once, when the `def` line runs, and is shared by
every call that omits the argument. The log accumulates across every board, for
the life of the program.
*Misconception:* that a default value is created fresh on each call.
*Type:* object-model. (Invisible here — see 9.C6.)

**Defect 3 — line 23, `break`.**
*Event:* the loop stops at the **first** total greater than `totals[best]`, rather
than continuing to look for a larger one. It reports the first improvement, not the
maximum.
*Misconception:* that a loop which has found a better candidate is finished — a
confusion of "found something" with "found the best".
*Type:* flow.

**Note on where symptoms appear.** Defect 1's symptom shows on line 30 and again
on 31; its cause is line 2. Defect 3's symptom would show on line 32; its cause is
line 23. Reporting the print line as the bug is the mistake this exercise exists to
prevent.

*Authoring record — Target: attribute three defects to their causing lines.
Prereq: 4.6, 8.16, 7.6. Syntax lens: all three. Flow lens: premature exit. Object
lens: two sharing faults.*

---

### 9.C6 — The hidden one

**Answer.** Defect 2, the mutable default `log=[]`.

It is invisible because the program creates only one board and reads the log only
once. Every entry that lands in the shared list belongs there, so the output looks
right.

**Two lines that expose it:**

```python
board2 = new_board(3, 3)
print(record(board2, 0, 0, 1))
```

This prints:

```text
[(0, 0, 5), (1, 1, 7), (2, 2, 12), (0, 0, 1)]
```

A brand-new board's very first score arrives with three entries of another board's
history attached.

**Reasoning.** A defect that produces correct output on the current inputs is not
a smaller defect — it is a larger one, because nothing will alert you to it. The
general shape: *sharing that has not yet been observed*.

**Error type if missed.** Object-model.

*Authoring record — Target: recognize a latent defect and construct its witness.
Prereq: 8.16, 9.C5. Syntax lens: default argument. Flow lens: second call omitting
the argument. Object lens: one list across the program's lifetime.*

---

### 9.C7 — Repair

**Answer.**

```python
def new_board(rows, cols):
    return [[0] * cols for _ in range(rows)]          # fix 1

def record(board, row, col, points, log=None):        # fix 2
    if log is None:
        log = []
    board[row][col] = board[row][col] + points
    log.append((row, col, points))
    return log

def best_row(totals):
    best = 0
    for i, t in enumerate(totals):
        if t > totals[best]:
            best = i                                   # fix 3: break removed
    return best
```

Fix 2 changes the calling code too, since the log must now be threaded through:

```python
board = new_board(3, 3)
history = record(board, 0, 0, 5)
record(board, 1, 1, 7, history)
record(board, 2, 2, 12, history)
```

**New output:**

```text
[[5, 0, 0], [0, 7, 0], [0, 0, 12]]
[5, 7, 12]
2
[(0, 0, 5), (1, 1, 7), (2, 2, 12)]
```

**Which fix reveals which defect.** **Fix 1 reveals defect 3.** Before the fix,
every row totalled 24; `best_row`'s `break` could never fire, because no total was
strictly greater than `totals[0]`, so the function returned 0 — which happened to
be as good an answer as any among three equal rows. Once the rows are independent,
the totals become `[5, 7, 12]`, and the unfixed `best_row` would stop at `i = 1`
(7 > 5) and report row 1 — confidently wrong, with row 2 clearly ahead.

**The lesson.** The sharing bug was *masking* the flow bug by flattening the data
into a case the flow bug handles correctly. Fixing one defect can make another
start producing wrong answers, and that is not a regression — it is the second
defect becoming visible. Re-predict the output after every fix.

*Authoring record — Target: minimal repair plus interaction between defects.
Prereq: 9.C5, 9.C6. Syntax lens: comprehension, sentinel, removed `break`. Flow
lens: full scan. Object lens: three rows, per-call log.*

---

### 9.C8 — Extend, and justify

**Answer.**

```python
import copy

def snapshot(board):
    return copy.deepcopy(board)

board = new_board(3, 3)
history = record(board, 0, 0, 5)
before = snapshot(board)
record(board, 1, 1, 7, history)
print(before)        # [[5, 0, 0], [0, 0, 0], [0, 0, 0]]
print(board)         # [[5, 0, 0], [0, 7, 0], [0, 0, 0]]
```

**Justification.** A board is a list of lists, and scoring writes into the *inner*
lists — `board[row][col] = ...` — so the snapshot must duplicate that level to be
independent. `board[:]`, `list(board)`, or `copy.copy(board)` would each produce a
new outer list whose three slots still point at the live rows, and every later
score would appear in the "snapshot" exactly as it does in Exercise 4.12.

**A further note worth making.** `deepcopy` is right here specifically because the
structure is nested and changeable. If the board were rebuilt rather than written
into — if scoring returned a new board each time — no copying would be needed at
all, because nothing would ever change under the snapshot. The copy is the price of
the in-place design, not a universal safety measure.

*Authoring record — Target: choose and justify copy depth from the write pattern.
Prereq: 4.12, 4.17, 9.C7. Syntax lens: `copy.deepcopy`. Flow lens: snapshot taken
between two writes. Object lens: independence at every level below the name.*

---

## What you should now be able to do

Look at a short program you have never seen and answer, without running it:

- which lines belong to which block, and how many times each runs;
- what every name points at, at any moment, on both sides of a call boundary;
- whether a given line binds, rebinds, changes, looks up, copies, or returns;
- which changes will be visible through which other names;
- what each collection will hand you when iterated, in what order, and how often
  it can be walked;
- and, when the output is wrong, which *event* on which *line* caused it — which
  is rarely the line the symptom appeared on.

If a defect ever surprises you again, the recovery procedure is the one from
Stage 4, generalized: draw the names and objects, mark the blocks, and count how
many times each line ran. Every answer in this collection came from those three
questions.

---

## Appendix — the capstone program, ready to run

The listing in Part B carries line numbers so the questions can refer to them.
Here is the same program without them, for pasting into a file **after** you have
written your predictions down.

```python
def new_board(rows, cols):
    return [[0] * cols] * rows

def record(board, row, col, points, log=[]):
    board[row][col] = board[row][col] + points
    log.append((row, col, points))
    return log

def row_totals(board):
    totals = []
    for row in board:
        total = 0
        for cell in row:
            total = total + cell
        totals.append(total)
    return totals

def best_row(totals):
    best = 0
    for i, t in enumerate(totals):
        if t > totals[best]:
            best = i
            break
    return best

board = new_board(3, 3)
record(board, 0, 0, 5)
record(board, 1, 1, 7)
history = record(board, 2, 2, 12)
print(board)
print(row_totals(board))
print(best_row(row_totals(board)))
print(history)
```

And the fully repaired version from 9.C7 and 9.C8:

```python
import copy

def new_board(rows, cols):
    return [[0] * cols for _ in range(rows)]

def record(board, row, col, points, log=None):
    if log is None:
        log = []
    board[row][col] = board[row][col] + points
    log.append((row, col, points))
    return log

def row_totals(board):
    totals = []
    for row in board:
        total = 0
        for cell in row:
            total = total + cell
        totals.append(total)
    return totals

def best_row(totals):
    best = 0
    for i, t in enumerate(totals):
        if t > totals[best]:
            best = i
    return best

def snapshot(board):
    return copy.deepcopy(board)

board = new_board(3, 3)
history = record(board, 0, 0, 5)
record(board, 1, 1, 7, history)
before_last = snapshot(board)
record(board, 2, 2, 12, history)

print(board)                        # [[5, 0, 0], [0, 7, 0], [0, 0, 12]]
print(row_totals(board))            # [5, 7, 12]
print(best_row(row_totals(board)))  # 2
print(history)                      # [(0, 0, 5), (1, 1, 7), (2, 2, 12)]
print(before_last)                  # [[5, 0, 0], [0, 7, 0], [0, 0, 0]]

board2 = new_board(3, 3)
print(record(board2, 0, 0, 1))      # [(0, 0, 1)]  — no leakage from the first board
```
