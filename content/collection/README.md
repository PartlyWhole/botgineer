# Reading Python: A Mental-Model Exercise Collection

A sequenced set of exercises that trains one skill: **looking at a short Python
program and saying, accurately and in plain language, what it does.**

This collection is built from the meta-plan *Authoring a Python Mental-Model
Exercise Collection*. It follows the nine-stage ladder in that document.

---

## 1. Who this is for

A learner who already recognizes Python's basic notation on sight:

- numbers and strings: `7`, `3.5`, `"cat"`
- lists: `[1, 2, 3]`
- tuples: `(1, 2)`
- dictionaries: `{"a": 1}`
- sets: `{1, 2}`
- the shape of a `for` line and a `def` line, even if what they *do* is fuzzy

You do **not** need to know what any of these do at runtime. That is what the
collection teaches. If a literal form is unfamiliar, Stage 1's opening section
names each one before it is used.

Everything targets **Python 3.10 or newer**. Dictionary insertion order is
guaranteed; set order is not, and the collection depends on that distinction.

---

## 2. What you will be able to do at the end

Given a short program you have never seen, you will be able to answer:

1. What kind of line is this, and which pieces of punctuation matter?
2. Does Python run this line now, later, once, or repeatedly?
3. Which lines belong to the same indented block?
4. What objects exist, and which names point to them?
5. Does this line bind a name, rebind a name, change an object, look something
   up, make a copy, or send a value back?
6. If a loop or a function is involved, which values are bound on each pass or
   each call?

And then: predict the output, spot the bug, and make the smallest correct fix —
explaining *why* it is the fix.

---

## 3. How the collection is organized

| File | Stage | The one new reasoning move |
|---|---|---|
| `stage-01-straight-line-code.md` | 1 | Follow one line at a time |
| `stage-02-change-vs-replace.md` | 2 | Separate changing a thing from replacing a name |
| `stage-03-structured-access.md` | 3 | Read brackets and keys precisely |
| `stage-04-sharing-and-copies.md` | 4 | Track outer objects and inner objects separately |
| `stage-05-following-one-block.md` | 5 | Tell repeated lines from after-the-loop lines |
| `stage-06-iterating-collections.md` | 6 | Predict what each kind of collection hands you |
| `stage-07-nested-structure.md` | 7 | Track which indentation level is active |
| `stage-08-function-boundary.md` | 8 | Cross into a call and back out again |
| `stage-09-integration-capstone.md` | 9 | Explain and repair a realistic program |
| `glossary.md` | — | Plain phrase → formal term, once the idea is already yours |
| `answer-key-conventions.md` | — | How to read the answer keys and grade yourself |

Each stage file contains, in order:

1. **What this stage adds** — one paragraph.
2. **The ideas, in plain language** — short, no jargon beyond what is already earned.
3. **Exercises** — twelve to eighteen, each labeled with its *form* (see below).
4. **Checkpoint** — four to six mixed questions introducing no new syntax.
5. **Answer key** — for every exercise and checkpoint question: the answer, the
   reasoning you were supposed to use, the wrong model it was aimed at, and a
   note telling you which *kind* of mistake you made if you got it wrong.

Work a stage's exercises with the answer key covered. Then read the key for
**every** exercise, including the ones you got right — the reasoning line is
the actual content.

---

## 4. The nine exercise forms

Correct output alone is not evidence of understanding. Each concept therefore
appears in more than one of these forms:

| Form | What you do |
|---|---|
| **Label the code** | Say the plain-language role of each piece of a line |
| **Mark the block** | Say which lines belong to a loop or a function body |
| **What runs next?** | Number lines in execution order, repeating numbers when a loop repeats |
| **Draw names and objects** | Show which names point to which objects at a stated moment |
| **Predict the result** | State the printed output or the final contents |
| **Compare near-matches** | Explain the difference between two almost identical snippets |
| **Find and fix** | Make the *smallest* correction to a bug |
| **Write a small program** | Produce code with a specified binding or iteration behavior |
| **State the rule** | Generalize from an example, in plain words |

---

## 5. Notation used throughout

**Object diagrams.** A name pointing at an object is written with an arrow. Two
names pointing at the *same* object share one object box, which is given a tag
like `#1`:

```text
a ──┐
    ├──▶ #1 [10, 20]
b ──┘
c ─────▶ #2 [10, 20]
```

`a` and `b` point at one list. `c` points at a different list that happens to
look the same. Changing `#1` shows up through both `a` and `b`, and not through `c`.

**Execution-order numbering.** When asked "what runs next?", number the lines in
the order Python actually reaches them. A line inside a loop gets a number each
time it runs:

```text
1  total = 0
2  for n in [1, 2]:
3      total = total + n
4  for n in [1, 2]:      (second pass)
5      total = total + n
6  for n in [1, 2]:      (loop is exhausted)
7  print(total)
```

**Snippet labels.** Paired snippets are labeled **A** and **B**. When you are
asked to compare them, name the *first line where their behavior differs*, not
just the different output.

---

## 6. Four kinds of mistake

Every answer key ends by classifying the likely error. Knowing which kind you
made tells you what to reread.

| Kind | What went wrong | Where to go back to |
|---|---|---|
| **Syntax-reading** | You misread a block boundary, an index, a key, or a call | The "Label the code" and "Mark the block" exercises of that stage |
| **Flow** | You misjudged *when* or *how often* a line runs | Stage 5 and Stage 7 |
| **Object-model** | You confused rebinding, changing, copying, or sharing | Stage 2 and Stage 4 |
| **Vocabulary-only** | Your explanation was right but you used the wrong word | `glossary.md` — this is the cheapest kind of mistake |

---

## 7. Language policy

Stages 1–5 use plain phrases only: *a name pointing to an object*, *change the
existing list*, *give the name a new object*, *the line inside the loop*, *a
function recipe*, *a value sent in*, *a value sent back*.

Stages 6–9 attach the formal terms — *binding*, *iterable*, *loop variable*,
*arguments*, *parameters*, *block*, *control flow* — as labels for ideas you
have already practiced. `glossary.md` holds the full mapping. If you can explain
an idea in plain words but forget its formal name, that is a vocabulary-only
mistake and nothing more.

---

## 8. How to use this collection

- **Pace.** One stage per sitting is plenty. Stages 4, 7, and 8 are the hard ones.
- **Write your answers down** before checking. A prediction you keep in your head
  is a prediction you will unconsciously revise.
- **Run the code afterward, not before.** Predict first; the interpreter is the
  grader, not the teacher.
- **If you miss a checkpoint question**, redo the two exercises the key points
  you back to before moving on. The ladder assumes every rung holds.
