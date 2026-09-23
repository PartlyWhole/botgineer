# Stage 8 — Crossing a Function Boundary

**The one new move:** follow execution into a call and back out, tracking which
names are local, which objects are shared with the caller, and what the return
hands back.

---

## What this stage adds

A function introduces two genuinely new things. First, a block of code that is
written now and run later, possibly many times, possibly never. Second — and this
is the only place in the collection where it happens — **a separate set of names**.
The object model is unchanged; the name-space is not.

---

## The ideas, in plain language

### `def` creates a function object; it does not run the body

```python
def greet(name):
    print("hello", name)

print("this prints first")
greet("ann")
```

The `def` line runs when Python reaches it, and what it does is: build a function
object holding the body, and bind the name `greet` to it. The body does not run.
`print("this prints first")` runs next. Only `greet("ann")` runs the body.

A syntax error inside the body is caught when the `def` line runs, because Python
must read the whole block to build the object. A *name* error inside the body is
not — the body's names are looked up when it runs, so a function that mentions an
undefined name is perfectly happy until you call it.

### `greet` and `greet()` are different things

```python
greet          # the function object itself
greet()        # run it, and produce whatever it returns
```

Forgetting the parentheses does not error; it just hands you the function object,
which will then be printed, stored, or compared, usually with baffling results.

### Calling: arguments are objects, parameters are local names

```python
def double(n):
    return n * 2

x = 5
print(double(x))
```

What happens on the call, in order:

1. The argument expression `x` is worked out, producing an object — the number 5.
2. A **fresh set of names** is created for this call.
3. The parameter name `n` is bound, *in that fresh set*, to that same object.
4. The body runs.
5. `return` produces an object and the call ends; the fresh names disappear.

So `n` is a new name pointing at the caller's object. Not a copy of the object,
and not another name for `x`. **The object is shared; the name is not.** That
single sentence answers every question in this stage.

### Rebinding a parameter is invisible to the caller

```python
def bump(n):
    n = n + 1        # rebinds the LOCAL name
    return n

value = 5
bump(value)
print(value)         # 5 — unchanged
```

`n = n + 1` moves the local name. Nothing the caller can see changed.

### Changing the argument's object is fully visible

```python
def add_item(items):
    items.append("new")   # changes the OBJECT

things = ["a"]
add_item(things)
print(things)             # ['a', 'new']
```

Same call mechanism, opposite outcome — because the body changed the object
rather than moving a name. This is the Stage 2 distinction again, and it is the
whole content of the phrase people reach for and should not: *"pass by
reference"*. Python does not need that vocabulary. Arguments are bound to
parameter names; whether the caller sees a change depends only on whether the
body changed an object or moved a name.

Compare directly:

```python
def replace(items):
    items = items + ["new"]   # new list; local name moves; caller sees nothing

def change(items):
    items.append("new")       # same list; caller sees it
```

### Local names do not leak, and do not clash

```python
def f():
    hidden = 1
    return hidden

f()
print(hidden)        # NameError
```

Names bound inside a call live only for that call. A name in the body that
happens to match one outside is a *different name* — assigning to it inside does
not touch the outer one:

```python
count = 0
def f():
    count = 99       # a local name, unrelated to the outer count
f()
print(count)         # 0
```

Reading an outer name from inside works fine; assigning to one anywhere in the
body makes that name local **for the whole body**, which produces the surprising
error in Exercise 8.13.

### `return` hands back an object — it does not copy it

```python
def build():
    inner = [1, 2]
    return inner

result = build()
result.append(3)      # the very list the function built
```

The returned object is the same object. If it is a list the function is also
holding onto — say, an item of a structure passed in — the caller can change it
from outside. If you want the caller to get an independent thing, return a copy
explicitly.

A function with no `return`, or a bare `return`, hands back `None`. Calling
`print(f())` on a function that only prints will show the printed line, then
`None` (Exercise 1.9's rule, now for your own functions).

### Returning several things is returning one tuple

```python
def divide(a, b):
    return a // b, a % b

q, r = divide(7, 2)      # 3, 1
```

`return a // b, a % b` builds a two-item tuple and returns that one object. The
caller's `q, r = ...` unpacks it — the same unpacking as Stage 6. `divide(7, 2)`
on its own is a tuple.

### `return` leaves everything

```python
def find(grid, target):
    for row in grid:
        for cell in row:
            if cell == target:
                return cell
    return None
```

`return` exits the function immediately, from any depth — no flags, no second
`break`. This is the clean answer to Stage 7's nested-search problem.

### Default arguments are built once, at `def` time

```python
def collect(item, acc=[]):
    acc.append(item)
    return acc

print(collect("a"))    # ['a']
print(collect("b"))    # ['a', 'b']   ← the same list, still there
```

The default's expression runs **once**, when the `def` line runs — not on each
call. So all calls that omit the argument share one list. This is the Stage 4
repetition pitfall wearing its most famous costume. The fix:

```python
def collect(item, acc=None):
    if acc is None:
        acc = []
    acc.append(item)
    return acc
```

Now a fresh list is built per call, because `acc = []` is inside the body.

---

## Exercises

---

**8.1 — What runs next?**

Number the execution order and give the output.

```python
def show(x):
    print("in", x)

print("before")
show(1)
print("after")
show(2)
```

---

**8.2 — Predict the result**

```python
def f():
    print("running")

print("A")
f
print("B")
f()
```

Explain what line 5 does.

---

**8.3 — Mark the block**

Which lines are the function body? How many times does each line run?

```python
def total(xs):
    t = 0
    for x in xs:
        t = t + x
    return t

print(total([1, 2, 3]))
print(total([]))
```

---

**8.4 — Predict the result**

```python
def bump(n):
    n = n + 1
    return n

value = 5
result = bump(value)
print(value, result)
```

---

**8.5 — Predict the result**

```python
def add_item(items):
    items.append("new")

things = ["a"]
add_item(things)
print(things)
```

---

**8.6 — Compare near-matches**

Snippet **A**:

```python
def extend(items):
    items = items + ["new"]

xs = ["a"]
extend(xs)
print(xs)
```

Snippet **B**:

```python
def extend(items):
    items.append("new")

xs = ["a"]
extend(xs)
print(xs)
```

Predict both. State the rule in one sentence, without using the phrase "pass by
reference".

---

**8.7 — Draw names and objects**

Draw the picture at the moment the marked line is about to run — showing both the
caller's names and the call's names.

```python
def f(items):
    items.append(3)
    items = [9]          # ← draw just before this line runs
    items.append(8)

xs = [1, 2]
f(xs)
print(xs)
```

Then predict the output.

---

**8.8 — Predict the result**

```python
def f():
    hidden = 1
    return hidden

print(f())
print(hidden)
```

---

**8.9 — Predict the result**

```python
count = 0

def f():
    count = 99
    print("inside", count)

f()
print("outside", count)
```

---

**8.10 — Predict the result**

```python
def announce(msg):
    print(msg)

result = announce("hi")
print(result)
```

---

**8.11 — Predict the result**

```python
def build():
    inner = [1, 2]
    return inner

a = build()
b = build()
a.append(3)
print(a, b, a is b)
```

---

**8.12 — Find and fix**

The intent is that `snapshot` be unaffected by later changes to the box's
contents. Say what happens and fix it inside the function.

```python
def contents(box):
    return box["items"]

box = {"items": [1, 2]}
snapshot = contents(box)
box["items"].append(3)
print(snapshot)
```

---

**8.13 — Find and fix**

Name the error, explain precisely why it happens, and give two different fixes.

```python
count = 0

def bump():
    count = count + 1
    return count

print(bump())
```

---

**8.14 — Predict the result**

```python
def divide(a, b):
    return a // b, a % b

print(divide(7, 2))
q, r = divide(7, 2)
print(q, r)
print(type(divide(7, 2)).__name__)
```

---

**8.15 — Find and fix**

Rewrite Stage 7's nested search as a function, so that finding the target leaves
both loops at once with no flag.

```python
grid = [[1, 2], [3, 4]]
found = False
for row in grid:
    for cell in row:
        if cell > 2:
            found = cell
            break
    if found:
        break
print(found)
```

---

**8.16 — Predict the result**

```python
def collect(item, acc=[]):
    acc.append(item)
    return acc

print(collect("a"))
print(collect("b"))
print(collect("c", []))
print(collect("d"))
```

Explain the fourth line's output specifically.

---

**8.17 — Find and fix**

Fix 8.16 so that each call without an explicit list starts empty, and say which
line of your fix does the work.

---

**8.18 — Predict the result**

```python
def outer():
    print("outer start")
    inner_result = inner()
    print("outer got", inner_result)
    return "outer done"

def inner():
    print("inner running")
    return 42

print(outer())
```

Note that `inner` is defined *after* `outer`. Why is that not a problem?

---

**8.19 — Write a small program**

Write a function `tally(words)` that takes a list of words and returns a
dictionary mapping each word to how many times it appears. Requirements: the
function must not change the list it is given, must work correctly when called
twice in a row, and must return a dictionary that the caller can safely modify
without affecting anything inside the function.

Then call it twice on the same list and prove both requirements hold.

---

**8.20 — Compare near-matches**

Snippet **A**:

```python
def f(xs):
    xs = sorted(xs)
    return xs

data = [3, 1, 2]
out = f(data)
print(data, out)
```

Snippet **B**:

```python
def f(xs):
    xs.sort()
    return xs

data = [3, 1, 2]
out = f(data)
print(data, out, data is out)
```

Predict both. Which one would you rather be handed by a colleague, and why?

---

**8.21 — State the rule**

Answer each in one sentence, using the formal vocabulary:

1. What does the `def` line actually do when Python reaches it?
2. What is bound to a parameter when a function is called?
3. When can a caller see a change made inside a function?
4. What does `return` hand back, and what does it *not* do?
5. When is a default argument's value created?

---

## Checkpoint 8

**C8.1** — Predict:

```python
def f(a, b):
    a = a + 1
    b.append(1)

x = 0
y = []
f(x, y)
print(x, y)
```

**C8.2** — What does this print, and why is the second line surprising to some
people?

```python
def f():
    return

print(f())
print(f)
```

**C8.3** — A learner says "Python copies lists into functions, so my function
can't break the caller's data." Correct them in two sentences and give a
one-line counterexample.

**C8.4** — Predict:

```python
def wrap(x, into=[]):
    into.append(x)
    return len(into)

print(wrap(1), wrap(2), wrap(3))
```

**C8.5** — In this snippet, how many times does each line run?

```python
def f(n):
    for i in range(n):
        return i
    return "never"

print(f(3))
print(f(0))
```

**C8.6** — Explain, in terms of names and objects, why a function that does
`items = []` at its top cannot possibly clear the caller's list.

---

---

# Stage 8 — Answer Key

---

### 8.1 — What runs next?

**Answer.**

```text
1  def show(x):            (builds the function object, binds the name)
2  print("before")          → before
3  show(1)                 (call begins; x bound to 1)
4      print("in", x)       → in 1
5  print("after")           → after
6  show(2)                 (call begins; x bound to 2)
7      print("in", x)       → in 2
```

Output:

```text
before
in 1
after
in 2
```

**Reasoning.** The `def` line runs once and does not execute the body. The body's
line runs once per call. Note that line 4's number comes between 3 and 5 —
execution *descends into* the call and comes back.

**Targeted misconception.** That `def` runs the body, so `in 1` would appear
first.

**If you missed it.** Flow error.

*Authoring record — Target: definition versus call in an execution trace. Prereq:
5.2. Syntax lens: `def` header and call sites. Flow lens: body runs twice, header
once. Object lens: function object bound to `show`.*

---

### 8.2 — Predict the result

**Answer.**

```text
A
B
running
```

**What line 5 does.** `f` on its own is an expression that produces the function
object. Nothing is done with it — no call, no printing, no error. It is a
complete, legal, useless line.

**Targeted misconception.** That mentioning a function's name runs it. The
parentheses are the call, and nothing else is.

**If you missed it.** Syntax-reading error. This is the source of the classic bug
`if user.is_valid:` — always true, because a function object is truthy.

*Authoring record — Target: name versus call. Prereq: 8.1. Syntax lens: presence
of `()`. Flow lens: body runs once, at line 7. Object lens: function object
produced and discarded.*

---

### 8.3 — Mark the block

**Answer.** The body is lines 2–5 (`t = 0` through `return t`).

| Line | Runs |
|---|---|
| `def total(xs):` | 1 |
| `t = 0` | 2 (once per call) |
| `for x in xs:` | 4 visits on the first call, 1 on the second |
| `t = t + x` | 3 on the first call, **0** on the second |
| `return t` | 2 |
| the two `print` lines | 1 each |

Output: `6` then `0`.

**Reasoning.** Each call runs the body afresh, including `t = 0`. The empty list
means the loop body never runs — the `for` line still runs once, discovers
nothing, and moves on.

**Targeted misconception.** That `t` persists between calls, so the second call
would report 6.

**If you missed it.** Flow error, or object-model if you expected `t` to survive.

*Authoring record — Target: body re-runs per call; zero-pass loop. Prereq: 5.1,
8.1. Syntax lens: nested block inside a body. Flow lens: per-call reset. Object
lens: fresh local names per call.*

---

### 8.4 — Predict the result

**Answer.** `5 6`

**Reasoning.** `n` is bound, in this call's own set of names, to the object `5`.
`n = n + 1` moves that local name to `6`. `value` was never touched — it is not
the same name, and moving one name never moves another.

**Targeted misconception.** That a parameter is a two-way link to the caller's
name.

**If you missed it.** Object-model error. Go back to 1.2 — this is the same
picture with a call boundary drawn across it.

*Authoring record — Target: rebinding a parameter is local. Prereq: 1.2. Syntax
lens: bare name left of `=` in a body. Flow lens: one call. Object lens: local
binding moved; caller's binding untouched.*

---

### 8.5 — Predict the result

**Answer.** `['a', 'new']`

**Reasoning.** `items` and `things` are two names pointing at **one list**. The
body changed that list. There is nothing to insulate the caller — no copy was
made at any point.

**Targeted misconception.** That functions receive copies of their arguments.

**If you missed it.** Object-model error.

*Authoring record — Target: changing an argument's object is visible. Prereq: 2.2,
8.4. Syntax lens: `.append` in a body. Flow lens: one call. Object lens: one list,
two names across the boundary.*

---

### 8.6 — Compare near-matches

**Answer.** **A** prints `['a']`. **B** prints `['a', 'new']`.

**The rule.** A caller sees a change only when the function **changed the object**
the caller's name points at; a function that **rebinds its parameter** has moved a
name the caller cannot see.

**Reasoning.** The two bodies differ exactly as `nums = nums + [3]` differs from
`nums.append(3)` in Stage 2. Nothing about functions was added — the call boundary
just makes the consequence more dramatic.

**Targeted misconception.** That whether a function can affect its caller is a
property of the *type* of argument. It is a property of what the body does.

**If you missed it.** Object-model error.

*Authoring record — Target: the central function/object rule. Prereq: 2.3, 8.5.
Syntax lens: rebinding versus method call. Flow lens: identical. Object lens: one
list versus two.*

---

### 8.7 — Draw names and objects

**Answer.** Just before `items = [9]` runs:

```text
caller:   xs ────┐
                 ├──▶ #1 [1, 2, 3]
call:     items ─┘
```

After the whole call, and back in the caller:

```text
xs ─────▶ #1 [1, 2, 3]        (#2 [9, 8] was built and discarded when the call ended)
```

Output: `[1, 2, 3]`.

**Reasoning.** Line 2 changed `#1`, which the caller shares — that change is
permanent. Line 3 rebound the local name to a new list `#2`. Line 4 appended to
`#2`, which nobody outside can reach; when the call ended, the local names
vanished and `#2` was left unnamed.

**Targeted misconception.** That the rebinding on line 3 undoes or overrides the
change on line 2, or that line 4's append somehow reaches the caller.

**If you missed it.** Object-model error. Note the ordering: everything before the
rebinding is visible outside; everything after it is not.

*Authoring record — Target: change-then-rebind inside a call. Prereq: 2.8, 8.6.
Syntax lens: three body lines of different kinds. Flow lens: one call. Object lens:
two lists; one shared, one unreachable.*

---

### 8.8 — Predict the result

**Answer.** `1`, then `NameError: name 'hidden' is not defined`.

**Reasoning.** The call's names are created when the call starts and gone when it
ends. `return hidden` produced the *object* `1` before that happened, which is why
the first line works. The name did not come back with it.

**Targeted misconception.** That names bound inside a function persist afterward —
imported from loops, where they do (5.3). A loop body is not a new set of names; a
call is. This is the only construct in the collection that creates one.

**If you missed it.** Object-model error.

*Authoring record — Target: local names do not survive the call. Prereq: 5.3, 8.3.
Syntax lens: name used after a call. Flow lens: names created and destroyed per
call. Object lens: returned object outlives the name.*

---

### 8.9 — Predict the result

**Answer.**

```text
inside 99
outside 0
```

**Reasoning.** `count = 99` binds a **local** name that happens to be spelled the
same as an outer one. The outer `count` is a different name and is untouched.

**Targeted misconception.** That same spelling means same name.

**If you missed it.** Object-model error.

*Authoring record — Target: shadowing. Prereq: 8.8. Syntax lens: assignment inside
a body. Flow lens: one call. Object lens: two distinct bindings.*

---

### 8.10 — Predict the result

**Answer.**

```text
hi
None
```

**Reasoning.** `announce` prints and has no `return`, so the call produces `None`.
Exactly Exercise 1.9's lesson, now for a function you wrote: what a function
*does* and what it *hands back* are separate questions.

**Targeted misconception.** That printing and returning are the same act.

**If you missed it.** Object-model error. In practice this shows up as a function
that "works" when called directly and produces `None` when its result is used.

*Authoring record — Target: implicit `None` return. Prereq: 1.9. Syntax lens: no
`return` statement. Flow lens: one call. Object lens: `None` bound to `result`.*

---

### 8.11 — Predict the result

**Answer.** `[1, 2, 3] [1, 2] False`

**Reasoning.** Each call runs `inner = [1, 2]` afresh, producing a new list, so
the two calls return two different objects. Appending through `a` cannot affect
`b`.

**Targeted misconception.** That a function returning "the same" literal returns
the same object each time — the mirror image of the default-argument trap in 8.16.
The distinction: an expression **inside the body** runs on every call; an
expression **in the `def` line's defaults** runs once.

**If you missed it.** Object-model error.

*Authoring record — Target: body literals re-run per call. Prereq: 4.14, 8.3.
Syntax lens: literal inside a body. Flow lens: two calls. Object lens: two distinct
lists.*

---

### 8.12 — Find and fix

**Answer.** It prints `[1, 2, 3]`. `return box["items"]` handed back the very list
stored in the dictionary, so `snapshot` is an alias for it and sees the append.

**Fix, inside the function.**

```python
def contents(box):
    return box["items"][:]
```

(Use `copy.deepcopy(box["items"])` if the items are themselves changeable.)

**Reasoning.** `return` hands back an object, not a copy — so a function that
returns a piece of a structure it was given is handing out live access to that
structure's internals. If independence is part of what the function promises, the
function must copy.

**Targeted misconception.** That returning breaks the connection to the original,
the way it feels like it should.

**If you missed it.** Object-model error. This is Exercise 4.15's logging bug seen
from the other side of a function boundary.

*Authoring record — Target: `return` does not copy. Prereq: 3.13, 4.15. Syntax
lens: returning a looked-up value. Flow lens: one call, then a later change. Object
lens: one inner list, two names.*

---

### 8.13 — Find and fix

**Answer.** `UnboundLocalError: cannot access local variable 'count' where it is
not associated with a value`.

**Why.** Python decides, when it builds the function object, which names in the
body are local — and the rule is: **a name assigned anywhere in the body is local
for the whole body**, including lines before the assignment. `count = count + 1`
assigns to `count`, so `count` is local throughout; the right-hand side then tries
to read a local name that has not been bound yet. The outer `count` is never
consulted.

**Fix one — do not assign; take a parameter and return:**

```python
def bump(count):
    return count + 1

count = bump(count)
```

**Fix two — declare the intent to assign to the outer name:**

```python
def bump():
    global count
    count = count + 1
    return count
```

**Reasoning.** The first fix is almost always the better one: a function whose
result depends only on its arguments is easier to trace, test, and reuse. `global`
is available and occasionally right, but it makes the function's effect invisible
at the call site.

**Targeted misconception.** That reading works until the moment of assignment, so
the right-hand side would see the outer value. Locality is decided for the whole
body at once, before any of it runs.

**If you missed it.** Object-model error. Note the contrast with 8.9, where the
same local-assignment rule caused *no* error because nothing read the name first.

*Authoring record — Target: local determination is body-wide. Prereq: 8.9. Syntax
lens: name read and assigned in one line. Flow lens: fails on the first body line.
Object lens: unbound local name.*

---

### 8.14 — Predict the result

**Answer.**

```text
(3, 1)
3 1
tuple
```

**Reasoning.** `return a // b, a % b` builds one tuple and returns it. "Returning
two things" is not a thing Python does — it returns one object that happens to
hold two. The caller's `q, r = ...` is ordinary unpacking (6.5).

**Targeted misconception.** That multiple return values are a special mechanism.

**If you missed it.** Syntax-reading error.

*Authoring record — Target: tuple return and unpacking. Prereq: 6.5. Syntax lens:
comma in a `return`. Flow lens: two calls. Object lens: one tuple per call.*

---

### 8.15 — Find and fix

**Answer.**

```python
def find_above(grid, limit):
    for row in grid:
        for cell in row:
            if cell > limit:
                return cell
    return None

print(find_above([[1, 2], [3, 4]], 2))    # 3
```

**Reasoning.** `return` leaves the function from any depth, so both loops end at
once — no flag, no second `break`, and no risk of forgetting the outer one. The
trailing `return None` handles "not found"; without it the function would still
return `None`, but writing it makes the contract explicit and stops the reader
wondering whether a case was forgotten.

**Targeted misconception.** That `return` behaves like `break` and only leaves the
innermost loop.

**If you missed it.** Flow error. Go back to 7.6 and 7.16 and compare the line
counts.

*Authoring record — Target: `return` as the nested-search exit. Prereq: 7.6, 7.16.
Syntax lens: `return` inside two blocks. Flow lens: immediate exit from any depth.
Object lens: found object handed back.*

---

### 8.16 — Predict the result

**Answer.**

```text
['a']
['a', 'b']
['c']
['a', 'b', 'd']
```

**The fourth line specifically.** The third call passed its own list, so it used
that one and left the default alone. The fourth call omitted the argument again
and therefore got the default list — still holding `'a'` and `'b'` from the first
two calls — and appended `'d'` to it. The default list was built once, when the
`def` line ran, and has been accumulating ever since.

**Targeted misconception.** That `acc=[]` means "start with an empty list each
time". It means "if no argument is given, use *this particular list*, made once".

**If you missed it.** Object-model error. Compare 8.11: a literal in the body runs
per call; a literal in the `def` header runs once.

*Authoring record — Target: mutable default argument. Prereq: 4.6, 8.11. Syntax
lens: default value in a `def` header. Flow lens: default expression evaluated at
definition. Object lens: one list shared across calls.*

---

### 8.17 — Find and fix

**Answer.**

```python
def collect(item, acc=None):
    if acc is None:
        acc = []
    acc.append(item)
    return acc

print(collect("a"))     # ['a']
print(collect("b"))     # ['b']
```

**The line that does the work: `acc = []`,** because it is *inside the body* and
therefore runs on every call that reaches it, producing a fresh list each time.
The `acc=None` in the header is only a signal; `None` is immune to the trap
because nothing can change it.

**Reasoning.** `if acc is None` is the right test rather than `if not acc`, which
would also fire on an empty list the caller deliberately passed in.

**Targeted misconception.** That the fix lives in the header. The header only
stops the sharing; the body creates the object.

**If you missed it.** Object-model error.

*Authoring record — Target: the `None` sentinel repair. Prereq: 8.16. Syntax lens:
`is None` test. Flow lens: body literal per call. Object lens: fresh list per call.*

---

### 8.18 — Predict the result

**Answer.**

```text
outer start
inner running
outer got 42
outer done
```

**Why the definition order is fine.** The body of `outer` is not run when `def
outer` executes — it is only stored. By the time `outer()` is actually called, on
the last line, both `def` lines have run and the name `inner` is bound. Names in a
body are looked up **when the body runs**, not when it is defined.

**Targeted misconception.** That a function must be defined before any function
that mentions it, as in some compiled languages.

**If you missed it.** Flow error. Note the corollary: a body can mention a name
that never gets defined, and you will not find out until the line runs.

*Authoring record — Target: names resolved at call time. Prereq: 8.1. Syntax lens:
call inside a body. Flow lens: nested calls; execution descends and returns. Object
lens: both function objects bound before either is called.*

---

### 8.19 — Write a small program

**Answer.**

```python
def tally(words):
    counts = {}
    for w in words:
        counts[w] = counts.get(w, 0) + 1
    return counts

data = ["a", "b", "a"]
first = tally(data)
second = tally(data)
print(first)                    # {'a': 2, 'b': 1}
print(data)                     # ['a', 'b', 'a']  — unchanged
print(first is second)          # False — a fresh dictionary per call
first["z"] = 99
print(second)                   # {'a': 2, 'b': 1}  — unaffected
```

**Reasoning.** All three requirements come from one decision: build the result
inside the body. `counts = {}` runs per call, so the returned dictionary is fresh
each time and belongs entirely to the caller. The function only *reads* `words`,
so the caller's list is untouched. Had `counts` been a default argument, all three
requirements would have failed at once.

**Targeted misconception.** That a function needs to defensively copy its input to
avoid changing it. It only needs to not change it.

**If you missed it.** Object-model error.

*Authoring record — Target: a well-behaved function, positively stated. Prereq:
6.18, 8.16, 8.17. Syntax lens: local accumulator and `return`. Flow lens: two
independent calls. Object lens: fresh dictionary per call; input read-only.*

---

### 8.20 — Compare near-matches

**Answer.** **A** prints `[3, 1, 2] [1, 2, 3]`. **B** prints
`[1, 2, 3] [1, 2, 3] True`.

**Which to prefer.** **A**. It leaves the caller's data exactly as it found it and
hands back a new sorted list, so the caller decides what to keep. **B** does two
things at once — it changes the caller's list *and* returns it — and the `True`
shows that the "result" is not a separate thing at all. A caller who writes
`out = f(data)` expecting to compare before and after will find both names showing
the sorted version.

The wider principle: a function should either change what it is given **or**
return a new thing, and its name should say which. Python's own library is
consistent about this — `sorted` returns, `list.sort` changes and returns `None`
(2.12). A function that does both is the one that surprises people.

**Targeted misconception.** That returning the object it changed makes a function
more convenient. It makes the change harder to notice.

**If you missed it.** Object-model error.

*Authoring record — Target: interface design as an object-model consequence.
Prereq: 2.12, 8.6. Syntax lens: `sorted(xs)` versus `xs.sort()` in a body. Flow
lens: one call each. Object lens: new list versus shared list.*

---

### 8.21 — State the rule

**Answer.**

1. It builds a function object holding the body and binds the function's name to
   it — it does not run the body.
2. The object produced by the argument expression, bound to the parameter name in
   a fresh set of local names for that call.
3. Only when the body **changes an object** the caller can also reach; rebinding a
   parameter is invisible outside.
4. `return` hands back an object and ends the call; it does **not** copy the
   object, and it does not preserve any local names.
5. Once, when the `def` line runs — not on each call.

**If you missed any.** (1) and (5) flow; (2), (3), (4) object-model; right idea
with the wrong term is vocabulary-only.

*Authoring record — Target: generalize the stage. Prereq: 8.1–8.20. Syntax lens:
`def`, call, `return`. Flow lens: definition versus call time. Object lens: sharing
across the boundary.*

---

## Checkpoint 8 — Answers

**C8.1** — `0 [1]`. `a = a + 1` moved a local name; `b.append(1)` changed the
caller's list. Both parameters were bound the same way — the bodies differ.
**Error type if missed:** object-model. Go back to 8.6.

**C8.2** — It prints `None` and then something like
`<function f at 0x7f...>`. The second line is surprising because naming a
function does not call it — you get the object itself, address and all.
**Error type if missed:** syntax-reading. Go back to 8.2.

**C8.3** — Python does not copy arguments; the parameter is a new *name* bound to
the *same object* the caller passed. A function can therefore change the caller's
list freely — `def f(xs): xs.clear()` — while rebinding the parameter cannot affect
the caller at all. **Error type if missed:** object-model. Go back to 8.5 and 8.6.

**C8.4** — `1 2 3`. One default list, appended to by all three calls, so its length
grows. (Python works out all three calls before printing.)
**Error type if missed:** object-model. Go back to 8.16.

**C8.5** — `def` runs once. For `f(3)`: the `for` line runs once, `return i` runs
once, and `return "never"` runs zero times — the first pass returns immediately, so
the loop never reaches a second pass. For `f(0)`: the `for` line runs once and
finds nothing, `return i` runs zero times, `return "never"` runs once. Output: `0`
then `never`. **Error type if missed:** flow. Go back to 8.15 and 8.3.

**C8.6** — Because `items = []` binds the local parameter name to a brand-new
list; it does not touch the object that name previously pointed at, and the
caller's name still points at that original object. To clear the caller's list the
body would have to change the object itself — `items.clear()` or `items[:] = []`.
**Error type if missed:** object-model. Go back to 8.7.

---

## Before moving on

Every construct in the collection is now on the table: names and objects, changing
versus replacing, access, sharing and copies, blocks, iteration, nesting, and the
call boundary. Stage 9 puts them in one program at once.
