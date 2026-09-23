# Stage 1 — Reading Straight-Line Code

**The one new move:** follow a program one line at a time, and say for each line
which names exist afterward and what they point at.

---

## What this stage adds

Nothing here loops, branches, or calls a function you wrote. Every line runs
once, top to bottom. That is exactly why it is the right place to build the
habit you will use for the rest of the collection: *before* asking what a
program means, ask what each single line does to the set of names and objects.

---

## The ideas, in plain language

### The three literal forms you will see in this stage

| Written form | What Python makes | Can it be changed after it exists? |
|---|---|---|
| `7`, `-3`, `2.5` | a number object | no |
| `"cat"`, `'cat'` | a text object (a string) | no |
| `[10, 20, 30]` | a list object holding three things | yes — Stage 2 |

You need only recognize them for now.

### A name is a label, not a box

When you write:

```python
count = 7
```

Python does three things, in this order:

1. Works out the right-hand side. Here that produces a number object, `7`.
2. Creates the name `count` if it does not exist yet.
3. Points `count` at that object.

The name is a **label stuck onto an object**. It is not a container that the
number was poured into. This distinction looks like hair-splitting now. By
Stage 4 it is the whole game.

### Rebinding moves the label

```python
count = 7
count = 8
```

The second line does **not** change the object `7` into `8`. Numbers cannot be
changed. It peels the label `count` off `7` and sticks it onto a different
object, `8`. The `7` is simply no longer labeled.

We will say the second line **rebinds** `count`. In plain words: *gives the name
a new object*.

### The right-hand side is worked out first — always

```python
total = total + 1
```

reads as: *"work out `total + 1` using whatever `total` points at right now, then
point `total` at the result."* The old value is used before the label moves.
Read every assignment right-to-left in this way and a large family of confusions
never happens.

### Two names can point at one object

```python
a = [10, 20]
b = a
```

There is **one** list here, wearing two labels. The line `b = a` does not build
a second list; it copies the *arrow*, not the object. We draw it like this:

```text
a ──┐
    ├──▶ #1 [10, 20]
b ──┘
```

With numbers and strings this never causes trouble, because those objects cannot
be changed. With lists it causes a great deal of trouble, which is Stage 2.

### `print` shows an object; it does not produce one

`print(x)` writes a readable form of the object to the screen and hands back
nothing useful (an object called `None`). Printing is not the same as having a
value. A line that prints has done its job by the time the next line starts.

### `id()`, used sparingly

`id(x)` gives a number that identifies *which object* `x` points at right now.
Two names give the same `id` exactly when they point at the same object. We use
it only when a diagram is in dispute, and only on lists — Python is allowed to
reuse small number and short string objects behind the scenes, so `id` on those
tells you about Python's bookkeeping, not about your program.

---

## Exercises

Cover the answer key. Write your answers down.

---

**1.1 — Label the code**

For each piece of this line, say its plain-language role: `days`, `=`, `30 + 1`.

```python
days = 30 + 1
```

---

**1.2 — Predict the result**

```python
x = 4
y = x
x = 9
print(x, y)
```

---

**1.3 — Draw names and objects**

Draw the names and objects that exist immediately after the last line runs.

```python
p = [1, 2]
q = p
r = [1, 2]
```

Then answer: how many list objects exist? How many names?

---

**1.4 — What runs next?**

Number every line in the order Python reaches it, and write what is printed
beside the line that prints it.

```python
a = 2
print(a)
a = a + 5
b = a
print(b)
```

---

**1.5 — Compare near-matches**

Snippet **A**:

```python
n = 3
n = n + 1
print(n)
```

Snippet **B**:

```python
n = 3
m = n + 1
print(n)
```

Both start the same. Name the first line where their effect differs, and say
what each prints.

---

**1.6 — Predict the result**

```python
s = "cat"
t = s
s = s + "s"
print(s)
print(t)
```

---

**1.7 — State the rule**

In one sentence, and without using the words *variable* or *memory*, say what
Python does when it meets a line of the form `name = expression`. Your sentence
must make clear which side is worked out first.

---

**1.8 — Find and fix**

This is meant to swap the two names so that `a` points at 2 and `b` points at 1.
It does not. Say what it actually prints, explain in one sentence why, and make
the smallest correction.

```python
a = 1
b = 2
a = b
b = a
print(a, b)
```

---

**1.9 — Predict the result**

```python
z = print("hello")
print(z)
```

---

**1.10 — Draw names and objects**

Draw the picture after line 3, then after line 4.

```python
first = "ann"
second = first
second = "bo"
first = second
```

How many text objects were created by this program? How many are still labeled
at the end?

---

**1.11 — Compare near-matches**

Snippet **A**:

```python
v = [1, 2]
w = v
print(id(v) == id(w))
```

Snippet **B**:

```python
v = [1, 2]
w = [1, 2]
print(id(v) == id(w))
```

Predict both outputs and explain the difference in one sentence using the words
*same object*.

---

**1.12 — Label the code**

Say the plain-language role of every piece of this line, including what the
parentheses do and in what order the two pieces of work happen.

```python
size = len("hello")
```

---

**1.13 — Write a small program**

Write four lines, using only assignment and `print`, that end with:

- exactly two names, `m` and `n`;
- both pointing at the **same** list object;
- and a printed line proving they point at the same object.

---

**1.14 — Predict the result**

```python
a = 5
b = a
a = a + 1
b = b + 1
print(a, b, a == b)
```

---

**1.15 — Find and fix**

The intent was to print the number of characters in the word, then the word
itself. Say what actually happens, and fix it with the smallest possible change.

```python
word = "banana"
word = len(word)
print(word)
print(word)
```

---

**1.16 — State the rule**

Complete this sentence in plain language, then give a two-line example that
demonstrates it:

> "Writing `b = a` does not make a second ..."

---

## Checkpoint 1

No new syntax. Four to six minutes.

**C1.1** — What does `x = x` do? Is it an error?

**C1.2** — Predict:

```python
k = "7"
j = 7
print(k == j)
```

**C1.3** — After these lines, how many list objects exist, and how many arrows
point at each?

```python
one = [0]
two = one
three = two
four = [0]
```

**C1.4** — In `total = total * 2`, which happens first: Python looking up what
`total` points at, or `total` being pointed somewhere new?

**C1.5** — A learner says: "`y = x` puts the value of `x` into `y`." Rewrite that
sentence so it is accurate for a list, using the word *object*.

**C1.6** — Number the execution order and give the printed output:

```python
p = 1
q = p + 1
p = q + 1
print(p, q)
```

---

---

# Stage 1 — Answer Key

Read every entry, including for exercises you got right.

---

### 1.1 — Label the code

**Answer.** `days` is a name being created and pointed at something. `=` says
"work out the right side, then point the left-side name at the result" — it is
not a claim of equality. `30 + 1` is an expression that produces one number
object, `31`.

**Reasoning.** The line has exactly three parts and only one of them produces an
object. The `=` is an instruction, not a comparison.

**Targeted misconception.** That `=` means "is equal to", imported from
mathematics.

**If you missed it.** Syntax-reading error. Reread "A name is a label, not a box".

*Authoring record — Target: assignment structure. Prereq: none. Syntax lens: the
three-part shape `name = expression`. Flow lens: runs once, now. Object lens:
one number object created, one name bound.*

---

### 1.2 — Predict the result

**Answer.** `9 4`

**Reasoning.** `y = x` points `y` at the object `x` currently points at — the
number `4`. `x = 9` then moves only the label `x`. Nothing reaches over and
changes `y`, because `y` was never attached to `x`; it was attached to `4`.

**Targeted misconception.** That `y = x` creates a live link between the two
names, so that later changes to `x` show up in `y`.

**If you missed it.** Object-model error. The arrow was copied, not the name.

*Authoring record — Target: rebinding does not disturb other names. Prereq: 1.1.
Syntax lens: three assignments, one call. Flow lens: four lines, once each.
Object lens: two number objects; `y` stays on the first.*

---

### 1.3 — Draw names and objects

**Answer.**

```text
p ──┐
    ├──▶ #1 [1, 2]
q ──┘
r ─────▶ #2 [1, 2]
```

Two list objects. Three names.

**Reasoning.** `q = p` copies an arrow. `r = [1, 2]` contains a **literal**, and
every time Python runs a list literal it builds a fresh list — even if an
identical-looking one already exists.

**Targeted misconception.** That equal-looking lists are the same list.

**If you missed it.** Object-model error. Look for the bracket literal: brackets
in an expression mean *a new list is being made right now*.

*Authoring record — Target: literal creates, assignment copies an arrow. Prereq:
1.2. Syntax lens: `[...]` literal versus a bare name on the right. Flow lens:
three lines, once each. Object lens: two list objects, three bindings.*

---

### 1.4 — What runs next?

**Answer.**

```text
1  a = 2
2  print(a)        →  2
3  a = a + 5
4  b = a
5  print(b)        →  7
```

Output:

```text
2
7
```

**Reasoning.** Straight-line code: each line runs exactly once, in written order.
Line 3 uses the old `a` (2) to compute 7, then rebinds `a`. Line 4 points `b` at
whatever `a` points at *at that moment*, which is 7.

**Targeted misconception.** That `b = a` on line 4 would somehow reflect `a`'s
earlier value, or that it tracks `a` afterward.

**If you missed the output.** Object-model error. **If you missed the
numbering.** Flow error — but a mild one; straight-line numbering is just the
written order.

*Authoring record — Target: execution-order notation on the easy case. Prereq:
1.2. Syntax lens: statement per line. Flow lens: one pass, no repetition. Object
lens: rebinding then binding.*

---

### 1.5 — Compare near-matches

**Answer.** The first line where the effect differs is line 2. **A** prints `4`;
**B** prints `3`.

**Reasoning.** Both line 2s compute the same thing, `4`. They differ in *which
name they point at the result*. **A** rebinds `n` itself, so line 3 sees the new
object. **B** binds a brand-new name `m` and leaves `n` where it was.

**Targeted misconception.** That the *computation* is what matters. It is not;
the left-hand name is what matters.

**If you missed it.** Syntax-reading error — you read the right-hand sides and
skipped the left-hand names.

*Authoring record — Target: the left side selects which arrow moves. Prereq: 1.1.
Syntax lens: left-hand name of an assignment. Flow lens: identical. Object lens:
same object produced, different binding.*

---

### 1.6 — Predict the result

**Answer.**

```text
cats
cat
```

**Reasoning.** Strings cannot be changed. `s + "s"` does not lengthen the
existing text object; it builds a **new** text object `"cats"` and line 3 points
`s` at it. `t` was pointed at the original `"cat"` on line 2 and is still there.

**Targeted misconception.** That `+` on a string modifies it in place, and
therefore that `t` would come along for the ride.

**If you missed it.** Object-model error. Note that this is the *safe* version of
the trap: because strings cannot be changed, you can never be surprised. Stage 2
runs the same shape with lists, where you can.

*Authoring record — Target: immutable value plus operator creates a new object.
Prereq: 1.2. Syntax lens: `+` in an expression on the right. Flow lens: once
each. Object lens: two text objects, two names, no sharing at the end.*

---

### 1.7 — State the rule

**Answer.** Any sentence equivalent to: *"Python works out the expression on the
right, producing one object, and then makes the name on the left point at that
object."*

**Reasoning.** The rule must contain the ordering (right side first) and the
result (the name points at an object). Sentences like "it stores the value in
the variable" are the ones to avoid — they smuggle in the box picture.

**Targeted misconception.** The box-and-contents picture of names.

**If you missed it.** Vocabulary-only error if your idea was right but your
wording used "stores"; object-model error if you had the ordering backwards.

*Authoring record — Target: generalizing the assignment rule. Prereq: 1.1–1.6.
Syntax lens: the general form. Flow lens: n/a. Object lens: bind or rebind.*

---

### 1.8 — Find and fix

**Answer.** It prints `2 2`.

**Why.** Line 3 rebinds `a` to point at 2. The original 1 is now unlabeled and
unreachable. Line 4 then points `b` at whatever `a` points at — which is already
2. The first value was destroyed before it was needed.

**Smallest correction.** Either keep the old value with a third name:

```python
a = 1
b = 2
temp = a
a = b
b = temp
```

or use a single simultaneous assignment, which works out **both** right-hand
values before pointing either name:

```python
a = 1
b = 2
a, b = b, a
```

**Targeted misconception.** That the two assignment lines happen "together", or
that `a` retains a memory of its former value.

**If you missed it.** Flow error — you did not carry the state forward from line
3 into line 4.

*Authoring record — Target: sequential rebinding destroys reachability. Prereq:
1.2, 1.4. Syntax lens: two assignments in sequence versus one tuple assignment.
Flow lens: strictly ordered. Object lens: an object with no remaining name.*

---

### 1.9 — Predict the result

**Answer.**

```text
hello
None
```

**Reasoning.** Line 1 does two separate things: it prints `hello` as a side
effect, and it produces the object `None`, which `z` is then pointed at. `None`
is Python's "nothing useful here" object. Line 2 prints that object.

**Targeted misconception.** That `print` hands back the thing it printed, so `z`
would be `"hello"`.

**If you missed it.** Object-model error. Ask of every call: *what does it do*
versus *what does it hand back*. They are different questions.

*Authoring record — Target: side effect versus produced object. Prereq: 1.1.
Syntax lens: a call used on the right of an assignment. Flow lens: once each.
Object lens: `z` bound to `None`.*

---

### 1.10 — Draw names and objects

**Answer.** After line 3:

```text
first  ─────▶ #1 "ann"
second ─────▶ #2 "bo"
```

After line 4:

```text
first  ──┐
         ├──▶ #2 "bo"
second ──┘
```

Two text objects were created. One is still labeled at the end; `"ann"` has lost
its last name.

**Reasoning.** Line 2 made `second` share `#1`. Line 3 rebound `second` alone.
Line 4 rebound `first` to whatever `second` points at, which abandons `#1`.

**Targeted misconception.** That rebinding `second` on line 3 would also affect
`first`, since they had been "the same".

**If you missed it.** Object-model error — sharing is a fact about a moment, not
a permanent relationship.

*Authoring record — Target: sharing is not a lasting link. Prereq: 1.2, 1.3.
Syntax lens: four assignments. Flow lens: once each. Object lens: two objects,
one abandoned.*

---

### 1.11 — Compare near-matches

**Answer.** **A** prints `True`. **B** prints `False`.

**Explanation.** In **A**, `w = v` points `w` at the *same object* `v` points at,
so the two ids match; in **B** each `[1, 2]` literal builds a separate object, so
the ids differ even though the contents look identical.

**Targeted misconception.** That "looks the same" and "is the same object" are
one question. They are two questions: `==` asks the first, `id` (and `is`) asks
the second.

**If you missed it.** Object-model error. Note that this exercise deliberately
uses lists: on small numbers and short strings, Python may reuse objects behind
the scenes, so the same comparison can come out `True` for reasons that have
nothing to do with your program.

*Authoring record — Target: identity versus equal appearance. Prereq: 1.3.
Syntax lens: `[...]` literal versus bare name. Flow lens: once each. Object lens:
one object versus two.*

---

### 1.12 — Label the code

**Answer.** `"hello"` is a text literal, which produces a text object. `len` is a
name already pointing at a built-in function object. The parentheses mean *use
that function now, on what is inside*. `len("hello")` produces the number object
`5`. `size` is then pointed at that `5`. Order: the literal is made first, the
call runs second, the name is pointed last.

**Reasoning.** Calls are just another way of producing an object for the right
side of an assignment. The order rule from 1.7 is unchanged.

**Targeted misconception.** That `size` is somehow linked to `"hello"`, so that
changing the word would change `size`.

**If you missed it.** Syntax-reading error if you could not name the parentheses'
job; object-model error if you thought a link persisted.

*Authoring record — Target: a call as a right-hand expression. Prereq: 1.1, 1.9.
Syntax lens: `name(argument)`. Flow lens: inner first, then the call, then the
binding. Object lens: number object bound to `size`.*

---

### 1.13 — Write a small program

**Answer.** Any program of this shape:

```python
m = [1, 2, 3]
n = m
print(id(m) == id(n))
print(m is n)
```

(The last two lines both prove it; either alone plus a fourth line of your choice
satisfies the four-line requirement.)

**Reasoning.** The only way to get two names onto one list without copying is to
put a bare name on the right-hand side. Writing `n = [1, 2, 3]` a second time
fails the requirement, however identical it looks.

**Targeted misconception.** That retyping the same literal gives you the same
object.

**If you missed it.** Object-model error.

*Authoring record — Target: deliberately constructing sharing. Prereq: 1.3, 1.11.
Syntax lens: bare name on the right. Flow lens: once each. Object lens: one
object, two names.*

---

### 1.14 — Predict the result

**Answer.** `6 6 True`

**Reasoning.** `b = a` points `b` at `5`. Lines 3 and 4 each compute a new number
and rebind their own name. Both end at `6` — but they are *not* connected. They
arrived at the same value independently. `a == b` asks whether the two objects
look the same, and they do.

**Targeted misconception.** Two opposite ones, and this exercise catches both:
that `b` would still be `5` because it "was set before", and that `b` would be
`7` because it "follows `a`".

**If you missed it.** Object-model error. Notice that a correct output here is
weak evidence — the follow-up question is what matters: *are `a` and `b`
connected?* No. They independently arrived at equal-looking numbers.

*Authoring record — Target: equal values without any relationship. Prereq: 1.2,
1.11. Syntax lens: two independent rebindings. Flow lens: once each. Object lens:
no sharing; `==` compares appearance.*

---

### 1.15 — Find and fix

**Answer.** It prints `6` twice. Line 2 rebinds `word` to the number 6, so the
text object `"banana"` loses its only name and the second `print` has no way back
to it.

**Smallest correction.** Use a different name for the length:

```python
word = "banana"
size = len(word)
print(size)
print(word)
```

**Reasoning.** The bug is not in `len`. It is in reusing a name that was still
needed. This is the same failure as 1.8, wearing different clothes.

**Targeted misconception.** That a name can hold both "the word" and "the length
of the word", or that the original value survives somewhere.

**If you missed it.** Object-model error, with a flow component: you must carry
the effect of line 2 into line 4.

*Authoring record — Target: rebinding discards what you still need. Prereq: 1.8,
1.12. Syntax lens: same name on both sides. Flow lens: strictly ordered. Object
lens: text object abandoned.*

---

### 1.16 — State the rule

**Answer.** "Writing `b = a` does not make a second **object** — it makes a
second **name for the same object**."

Example:

```python
a = [1]
b = a
print(a is b)     # True — one object, two names
```

**Reasoning.** The sentence must contrast *object* with *name*. Saying "does not
make a second copy" is acceptable but weaker, because it does not say what it
*does* make.

**Targeted misconception.** That assignment duplicates.

**If you missed it.** Vocabulary-only if you had the idea but said "copy of the
variable"; object-model otherwise.

*Authoring record — Target: generalizing aliasing. Prereq: 1.3, 1.11, 1.13.
Syntax lens: bare name on the right. Flow lens: n/a. Object lens: one object,
two bindings.*

---

## Checkpoint 1 — Answers

**C1.1** — `x = x` works out the right side (whatever `x` already points at) and
points `x` at it. Net effect: nothing. It is not an error, *provided* `x` already
exists; if it does not, Python cannot work out the right side and reports a
`NameError`. **Error type if missed:** object-model.

**C1.2** — `False`. `"7"` is a text object, `7` is a number object; they do not
compare equal. **Error type if missed:** syntax-reading — the quotes are the
whole message of the line.

**C1.3** — Two list objects. `one`, `two`, and `three` all point at the first
one (three arrows); `four` alone points at the second (one arrow).
**Error type if missed:** object-model. Go back to 1.3 and 1.13.

**C1.4** — The lookup happens first. Python must know what `total` points at in
order to compute `total * 2`; only after the result exists does the name move.
**Error type if missed:** object-model. Go back to 1.7 and 1.8.

**C1.5** — "`y = x` makes `y` point at the same object `x` points at." Anything
that keeps the word *value* and drops *object* has not fixed the sentence.
**Error type if missed:** vocabulary-only, if your explanation was otherwise
right. Go back to 1.16.

**C1.6** —

```text
1  p = 1
2  q = p + 1
3  p = q + 1
4  print(p, q)   →  3 2
```

Output: `3 2`. **Error type if missed:** flow error, if you used the *final* `p`
when computing line 2. Go back to 1.4.

---

## Before moving on

You should now be able to look at any sequence of assignments and say, without
running it, which names exist and which object each one points at. Stage 2 keeps
the same lines and changes one thing: the objects will now be the kind that can
be **changed** while a name still points at them.
