# Glossary — Plain Phrase to Formal Term

Every term here is a **label for something you already practiced**. If you can
explain the idea in the left-hand column and forget the right-hand word, that is a
vocabulary-only error and the cheapest kind there is.

The "First met" column points at the exercise where the idea was introduced, not
where the word was.

---

## Names and objects

| Plain phrase | Formal term | What it actually means | First met |
|---|---|---|---|
| a name pointing at an object | a **binding** | the name is a label attached to an object, not a box holding a value | 1.1 |
| giving a name a new object | **rebinding** | the label moves; nothing about the old object changes | 1.2 |
| two names for one object | **aliasing** | both names reach the same object, so a change through one is visible through the other | 1.3 |
| the object itself, as opposed to what it looks like | **identity** | tested with `is` or `id()`; distinct from `==`, which compares appearance | 1.11 |
| changeable | **mutable** | list, dictionary, set — can be altered while every name stays put | 2.1 |
| unchangeable | **immutable** | number, string, tuple, `True`/`False`, `None` — can only be replaced | 2.1 |
| changing the object | **mutation** | e.g. `.append()`, `xs[0] = 1`, `d[k] = v` — no name moves | 2.2 |
| nothing here | **`None`** | the object a function hands back when it has nothing to return | 1.9 |

## Collections and access

| Plain phrase | Formal term | What it actually means | First met |
|---|---|---|---|
| position in a list | **index** | counted from 0; negative counts from the end | 3.2 |
| taking a run of positions | **slice** | `xs[a:b]`, stopping before `b`; always produces a new list | 3.2 |
| may be used as a dictionary key or set item | **hashable** | the object can be filed by what it looks like and will not change afterward | 3.9 |
| a copy of the outer container only | **shallow copy** | `xs[:]`, `list(xs)`, `dict(d)`, `copy.copy(x)` — inner objects stay shared | 4.2 |
| a copy all the way down | **deep copy** | `copy.deepcopy(x)` — nothing shared at any level | 4.5 |

## Blocks and flow

| Plain phrase | Formal term | What it actually means | First met |
|---|---|---|---|
| indented lines belonging together | a **block** | membership is decided by indentation alone | 5.1 |
| the order in which lines run | **control flow** | top to bottom, except where loops and calls redirect it | 5.2 |
| the lines inside a loop | the loop **body** | runs once per pass | 5.1 |
| one trip through the body | an **iteration** or **pass** | the loop variable is rebound at the start of each | 5.2 |
| the running name a loop keeps updating | **loop variable** | an ordinary name; it survives after the loop ends | 5.3 |
| the name that builds up a result | an **accumulator** | must be bound *before* the loop | 5.6 |

## Iteration

| Plain phrase | Formal term | What it actually means | First met |
|---|---|---|---|
| anything a `for` loop can walk | an **iterable** | list, tuple, string, range, dict, set, file, generator | 6.1 |
| a one-pass position marker over an iterable | an **iterator** | what `for` makes for you invisibly; `next()` advances it | 6.19 |
| used up, nothing left | **exhausted** | a generator or iterator that has produced its last value | 6.6 |
| a recipe that produces values on demand | a **generator** | holds no items; one pass only | 6.6 |
| building a list in one expression | a **list comprehension** | `[expr for x in it if cond]`; produces a new object | 6.14 |
| pulling several names out of one item | **unpacking** | `k, v = pair` — the same thing `for k, v in ...` does per pass | 6.4 |
| producing values only as asked | **lazy** | `range` and generators; contrast the **eager** list comprehension | 6.14 |

## Functions

| Plain phrase | Formal term | What it actually means | First met |
|---|---|---|---|
| a function recipe | a **function definition** | `def` builds a function object and binds a name to it | 8.1 |
| running it | a **call** | `f()` — the parentheses are the call, and nothing else is | 8.2 |
| local names in the recipe | **parameters** | bound in a fresh set of names for each call | 8.4 |
| values sent into the function | **arguments** | the objects the caller's expressions produced | 8.4 |
| the fresh set of names a call gets | the **local scope** | created on entry, gone on return | 8.8 |
| an inner name hiding an outer one of the same spelling | **shadowing** | they are different names; assigning to one does not touch the other | 8.9 |
| the value sent back | the **return value** | an object, not a copy of one | 8.11 |
| a stand-in default meaning "nothing was given" | a **sentinel** | usually `None`, because it cannot be changed | 8.17 |

---

## Words this collection avoids, and why

**"Variable."** Not wrong, but it invites the box-and-contents picture. *Name* and
*binding* keep the arrow visible. Use "variable" freely once the picture is
secure.

**"Value."** Ambiguous between *the object* and *what the object looks like* —
precisely the distinction Exercises 1.11 and 4.13 turn on. Say "object" when you
mean the thing and "contents" when you mean its appearance.

**"Pass by reference" / "pass by value."** These describe a choice Python does not
make. Arguments are bound to parameter names; a caller sees a change if and only
if the body changed an object the caller can also reach (8.6). Any sentence
starting "Python passes by..." is about to be less accurate than the sentence it
replaced.

**"Copy," unqualified.** Always say which level: *shallow* or *deep*. An
unqualified "copy" is where the bugs in Stage 4 live.
