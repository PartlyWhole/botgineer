# Reading the Answer Keys

Each answer-key entry has the same parts. They are not decoration — the reasoning
line is the actual content of the collection, and the error type tells you where
to go next.

---

## What each part is for

**Answer.** The output, final contents, diagram, or corrected code. If this is all
you check, you are grading yourself on the least informative signal available. A
right answer for a wrong reason is common in this material, especially in Stages 2
and 4, where two very different events produce identical printed output.

**Reasoning.** The explanation you were meant to produce. Compare it against
whatever you were thinking, not just against your answer. If your reasoning was
different but also correct, that is fine — there is usually more than one valid
path. If your reasoning was absent ("it just looked right"), treat the exercise as
missed and redo the one it points back to.

**Targeted misconception.** The specific wrong model the exercise was built to
catch. Every exercise in this collection was written backwards from one of these.
Reading them all, even for exercises you got right, is worth more than doing extra
exercises.

**If you missed it.** The error type — see below — plus a pointer back to the
exercise that teaches the missing piece.

**Authoring record.** A compact line in italics recording what the exercise was
designed to do: its target concept, its prerequisites, and the three lenses
(syntax, flow, object) it exercises. This is written for instructors, curriculum
maintainers, and anyone adapting the collection. Learners can ignore it — or read
it to see what the exercise was aiming at, which is sometimes clarifying.

---

## The four error types

Naming the *kind* of mistake is more useful than naming the mistake, because each
kind has a different remedy.

### Syntax-reading error

You misidentified a block boundary, an index, a key, a call, or which side of an
`=` something was on. The code's structure was misread before any reasoning began.

*Remedy:* the "Label the code" and "Mark the block" exercises of the relevant
stage. Read the line aloud, one piece at a time, before predicting anything.

### Flow error

You misjudged *when* or *how often* a line runs — a loop's pass count, what
`break` leaves, whether a body runs at all, whether `def` runs its body.

*Remedy:* execution-order numbering (Stage 5) and the nested counts of Stage 7.
Number the lines; do not estimate.

### Object-model error

You confused binding with mutation, or missed a shared object, or assumed a copy
where there was none.

*Remedy:* draw the names and objects. Stage 2 for bind-versus-change, Stage 4 for
levels of sharing. This is the most common type in the collection and the one that
most rewards drawing.

### Vocabulary-only error

Your explanation was correct and you used the wrong word, or could not produce the
formal term.

*Remedy:* `glossary.md`. Nothing else. This is the cheapest error type and should
never be treated as a gap in understanding.

---

## Grading yourself honestly

Three habits make the difference:

1. **Write the prediction down before checking.** A prediction held in your head
   revises itself the moment you see the answer, and you will remember having
   known it.
2. **Say which type your error was, out loud, every time.** The classification is
   the learning; the correct answer is a by-product.
3. **When an answer key says "go back to X", go back to X.** The ladder assumes
   every rung holds. Stage 7 is unreadable if Stage 4 is shaky, and Stage 8's
   default-argument material is simply Stage 4 again.

---

## For instructors adapting this collection

The authoring records make the coverage auditable. Every exercise declares its
target concept, prerequisites, and its syntax / flow / object lenses, so you can:

- check that a concept appears in more than one *form* (see the nine forms in
  `README.md`) before it is assumed;
- verify that no exercise depends on a concept introduced later;
- and locate every exercise touching a given misconception when a cohort is
  struggling with it.

The recurring misconceptions and where they are attacked:

| Misconception | Exercises |
|---|---|
| Assignment copies a value | 1.2, 1.16, 2.11, 3.3, 3.18 |
| Immutable values cannot be shared | 1.6, 1.14, 2.6, 2.9 |
| A new outer container means new inner objects | 4.2, 4.3, 4.11, 4.16, 9.2 |
| `*` makes independent inner lists | 4.6, 4.7, 4.9, 5.18, 6.15, 7.18, 9.C3 |
| Function parameters are copies | 8.4, 8.5, 8.6, 8.7, C8.3 |
| `for` means only counting | 6.1, 6.2, 6.6, 6.9, 6.13 |
| Indentation is cosmetic | 5.1, 5.4, 7.1, 7.3, 7.13, 9.C1 |
| `def` runs the body immediately | 8.1, 8.2, 8.18 |
| `break` ends all surrounding loops | 7.6, 7.16, 8.15, 9.C5 |
| Set order is reliable | 6.9, 6.10 |
| Methods that change also return the changed object | 2.5, 2.12, 8.20, 9.1, 9.8 |
| Defaults are created per call | 8.16, 8.17, 9.3, 9.C6 |

Every code snippet in every stage file, and every stated output, has been executed
on CPython 3.11 and matches. Two behaviors are deliberately *not* pinned to a
particular output, because they are not guaranteed: set iteration order (6.9,
6.10) and the exact text of the function-object repr in C8.2.
