# BotGineer — pedagogy of record

**Status:** design of record for every lesson, practice and reading level.
The review that produced it lives in the Claude doc *BotGineer — Pedagogy
Review*; this file is the part the code is held to. Where the two differ,
this file wins, because it records the decisions taken since.

---

## 1. The one rule

**Show, then name, then ask** — in short beats the learner advances
themselves. A concept is demonstrated on the stage before it has a word,
has a word before the learner is asked to use it, and is asked about in a
beat that holds nothing but the question.

## 2. The rubric

Every step of every lesson is checked against these. A step that breaks
one is rewritten.

| # | Rule | The test |
|---|---|---|
| R1 | **Show, then name, then ask.** | Point to the beat that *showed* it before the beat that asks. |
| R2 | **One idea per beat.** One sentence, ≤ 20 words, ≤ 110 characters. | Count sentences and ideas. |
| R3 | **The question stands alone.** When the console waits, the bubble holds only the question. | Is the `ask` a question and nothing else? |
| R4 | **Say who does the work.** If the robot must compute, a beat says so (and why) before asking. | Would a right answer typed by hand be refused? Then a beat must have said so. |
| R5 | **Nothing unintroduced.** Every symbol, word and operator in a question was shown earlier. | List the prompt's tokens; find each one's introduction. |
| R6 | **The picture proves it with the sound off.** | Mute the text. Does the stage alone show what changed? |
| R7 | **Teach by contrast.** Two things side by side that differ in one way. | Is there a pair differing in exactly one thing? |
| R8 | **True to Python.** Simplify, never mislead. | Could a Python expert object to the sentence? |
| R9 | **Praise names the reason.** | Does the praise contain a *because*? ("Counted, so an `int`.") |
| R10 | **Misses are drawn, then named.** | Is the miss visible on the stage, and does the reply say which mistake? |
| R11 | **Takeaways are whole sentences.** One or two, set up by the last line, not repeating it. | Read it aloud: does it sound like a person? |
| R12 | **Every lesson has a reason in the story.** Opens on what the robot cannot do yet; closes on what it now can. | State the robot's problem in one line. |

Two rules for the whole progression:

- **The learner's power grows visibly.** Each level ends on something the
  robot can now do, and the next opens on its limit.
- **Vocabulary is earned.** A term appears on screen as a label the moment
  it is named and stays for the rest of the lesson. No term is used before
  its label exists.

Plus one that is a bug if broken: **a step's `done` cannot be passed by
typing the answer the step forbids** (a "make the robot work it out" step
must check the source, as `recall` in `src/practice/exercises.ts` does).

## 3. The cast and the story

The story in one sentence: **a robot that can do nothing on its own, a
crow who knows how it works, and you — the one who learns to instruct it.**

| Who | Actor id | Name tag | Role | Never does |
|---|---|---|---|---|
| The crow | `crow` | `CROW_NAME` (see §8) | Guide. Knows the robot; has no hands to type. Warm, brief, a little dry. Asks more than it tells | Types for you; talks for more than a few beats without handing over |
| The robot | `robot` | Robot | Does exactly what it is told. Wordless: it *thinks*, in a cloud | Guesses what you meant |
| Mira | `courier` | Mira | A person. Brings problems from outside. Speaks no robot | Understands `True` or `12` |
| You | — | — | The robot's engineer: the BotGineer | — |

The crow *speaks* (speech bubble); the robot *thinks* (thought cloud);
Mira speaks. Mira is referred to as she/her — she is a character the
content defines.

### The arc

| Level (activity id) | The robot's problem at the start | What it can do at the end |
|---|---|---|
| 1a Meet the robot (`sandbox`) | Switched on, but does nothing without instructions | Think of whatever you write |
| 1b Five data types (`types`) | Thinks of everything the same way | Knows five kinds of data |
| 1c Choose the type (`choose`) | — | Answer any question with the right *type* |
| 2 Working things out (`operations`) | Can only think of what you tell it | Make new values from old ones |
| 3 Practice: thinking (`practice-thinking`) | — | — |
| 4 Names (`names`) | Forgets everything the moment it has thought it | Keep things, under names |
| 5 Taking an order (`order`) | Mira needs something remembered and worked out | Be useful to a person |
| 6 Practice: remembering (`practice-remembering`) | — | — |
| 7 Wake the robot (`wake`) | One line at a time is slow | Run a whole program |
| Stages 1–9 | Others wrote programs for it; it runs them faithfully, bugs and all | You can say what a short program will do *before* it runs |

The bridge into reading is said once, by the crow, at `s1-ideas`: *"A good
engineer knows what the robot will do before it does it."*

## 4. The dialogue system

Dialogue is a sequence of short **beats** the learner advances, ending on
an **ask** that hands the keyboard to the console. The console is closed
while a character is talking and open while they wait for an answer.

| Beat kind | What | Advances on |
|---|---|---|
| narration beat | one line, one speaker, optionally a picture, a demo thought, a cast action or a focus | **Next** (button, Enter, Space) |
| ask | the question alone; the console opens and takes focus | evidence (unchanged: `done(evidence)`) |
| reply | the answer to a miss, drawn into the picture | the next typed line |
| praise | why it was right — the first beat shown after a step is done | Next |

**Which beat is showing is view state** (React state, reset when the step
changes or the level remounts; never stored). **Which step** is still
`progress(lesson, evidence)` — invariant 11 holds: a beat is narration, not
a step, and was never checked.

Controls: **Next** (dimmed while a line types or a demonstration plays;
first press finishes the line, second advances), **Back** (previous beat
of the current run of beats), **Replay** (the current demonstration). When
the ask arrives, Next gives way to the console glowing and a pointer:
"Type your answer →".

### The speech bubble

| Part | Design |
|---|---|
| Shape | Rounded ~20px card, 2px border, flat 4px "lip" underneath — the map's chunky style (`roadmap.css`, Nunito) |
| Speaker tag | A pill on the top-left edge in the speaker's colour: crow (ink), Robot (brand blue), Mira (orange) |
| Tail | Short, curved, rounded (an SVG path), swings to the speaker (≈250ms) when the speaker changes |
| Type | Nunito 17–18px, weight 700, line-height 1.5 |
| Reveal | Types on at ~45 chars/s with brief pauses at `,` and `.`; code chips pop in whole |
| Speaker in sync | The speaker animates (talks) while text types; the others look at them |
| Continue cue | A small bouncing ▸ bottom-right once the line has finished |
| Ask state | Border takes the colour of what is asked when known (`--k-bool`…); a dotted pointer towards the console |
| Reply state | A softer tint, never red. A miss is a conversation, not an error |
| Entrance | Scale .96→1 + fade from the tail, ~180ms; a speaker change slides the bubble instead of re-popping |
| Reduced motion | No typing, no fly; text whole; cue static |

## 5. Lesson 1 — Data types (the script)

Main idea: different kinds of thing need different kinds of data. There
are five basic kinds; everything else is built from how they are arranged.
The learner *meets* all five, then *chooses* between them.

**Bold** rows are asks (the console opens). *On stage* is what plays
during that beat.

### 1a — Meet the robot (`sandbox`)

| # | Who | Line | On stage |
|---|---|---|---|
| 1 | Crow | Hello! I'm {CROW_NAME}. I'm a crow, and I know a lot about robots. | The crow hops and waves |
| 2 | Crow | And this is my friend, the robot. | Spotlight on the robot; its screen is dark (asleep) |
| 3 | Crow | It's very clever. But on its own, it does nothing at all. | The screen lights, eyes blink, it stands still. Nothing happens |
| 4 | Crow | It needs someone to give it instructions. That's you. | The console glows; a tag: *your instructions go here* |
| 5 | Crow | Write an instruction on the right and press Enter. The robot will think of it. | A demo: `7` appears in the robot's cloud, then clears |
| **6** | Crow | **Try it. Make the robot think of a number.** | done: any `int` or `float` thought |
| 7 | Crow | *(praise)* It's thinking of {n}! | The cloud holds their number |
| **8** | Crow | **Another one. Any number you like.** | done: a second number thought |
| 9 | Crow | *(outro)* See? It thinks of whatever you write. Then it lets the thought go. | The cloud fades (Level 4 pays this off) |

Takeaway: "The robot does nothing until you give it an instruction — and it thinks of whatever you write."

Replies: a bare word → `NameError` → "The robot doesn't know the word `seven`. Try digits: `7`." A comma decimal → tuple → "Python writes the dot as a full stop: `1.5`."

### 1b — Five data types (`types`)

A **shelf** of five slots sits on the stage throughout; each type, once
named, flies into its slot with its examples and stays. (It replaces the
nested boxes, which claimed `int` sits inside `float` — R8.)

| # | Who | Line | On stage |
|---|---|---|---|
| 1 | Crow | The robot doesn't think of everything the same way. | The shelf: five slots, each "?" |
| 2 | Crow | It sorts things into kinds. Programmers call a kind a **data type**. | *Data types* settles over the shelf |
| 3 | Crow | There are five basic ones. Let's meet them. | The five "?" pulse in turn |
| 4 | Crow | First, questions with only two answers. Is the lamp on? | Lamp dark, with a switch |
| 5 | Crow | Yes or no. The robot says yes as `True`… | Switch flips to `True`, lamp lights |
| 6 | Crow | …and no as `False`. | Switch flips back, lamp dark |
| 7 | Crow | This type is called `bool`. Capital letter, no quotes. | `bool` label with `True`/`False` flies to slot 1 |
| **8** | Crow | **Your turn. Turn the lamp on.** | done: `True`. `true` → "Nearly — it needs a capital T." |
| 9 | Crow | Next, questions that ask *how many*. | Basket; apples drop one at a time, counter 1, 2, 3 |
| 10 | Crow | You count in whole steps. No halves in between. | A half apple bounces off; counter stays at 3 |
| 11 | Crow | Counting numbers are called `int`s — short for *integer*. | `int` label with `3`, `12` flies to slot 2 |
| 12 | Crow | They go below zero, too. | Lift: floors 3…−2, it sinks to −1; `-1` joins the slot |
| **13** | Crow | **Send the lift down to the car park: `-1`.** | done: `-1`. `1.5` sticks between floors |
| 14 | Crow | Some things you can't count. You have to *measure* them. | A glass fills smoothly |
| 15 | Crow | A measurement can land between whole numbers. | Number line 0–1; the level slides to the middle |
| 16 | Crow | Python writes it with a dot: `0.5`. | `0.5` marked between `0` and `1` |
| 17 | Crow | Numbers with a dot are called `float`s. | `float` label with `0.5`, `1.4` flies to slot 3 |
| **18** | Crow | **Tell the robot how full the glass is.** | done: `0.5`; a second glass fills to the answer |
| 19 | Crow | Here's Mira. Mira is a person. | Mira enters and waves |
| 20 | Mira | Hi! I don't speak `True` or `12`. I read letters. | Letters float up around her |
| 21 | Crow | One letter, digit or symbol is a **character** — a *char* for short. | A lone `"A"` chip, quotes marked like clasps |
| 22 | Crow | Quotes make it a character. `"7"` is a thing to read. `7` is a number. | Contrast: `7` (int colour) beside `"7"` (char colour) |
| 23 | Crow | Python keeps a char as a string one letter long. It calls it `str`. | Robot thinks `"A"`, type tag `str`; char label to slot 4, tagged `str · length 1` |
| **24** | Crow | **Write the first letter of Mira's name: `"M"`.** | done: `str` `'M'` |
| 25 | Crow | Put characters in a row and you get a **string**. | Beads h-e-l-l-o slide onto a thread; quotes clip on each end |
| 26 | Crow | The quotes show where the string starts and stops. | The clasps glow |
| 27 | Crow | Strings are called `str`. They're for talking to people. | `str` label with `"hello"`, `"Mira"` to slot 5 |
| **28** | Crow | **Say hello to Mira.** | done: any non-empty `str`; Mira reads it from a card |
| 29 | Crow | *(outro)* Five data types. Everything the robot thinks is built from these. | Full shelf; each slot bounces |
| 30 | Crow | *(outro)* Bigger things are these, arranged. A list is a row of them, for example. | Ghost chips line up in `[ ]`, tagged *later* |

Takeaway: "There are five basic data types — bool, int, float, char and str — and everything else is built from them."

R8 note: **Python has no separate char type**; `type("A")` is `str`. The
lesson teaches "a character" as a real idea and says plainly that Python
keeps it as a one-letter `str`. The shelf shows five *ideas*, four Python
types.

### 1c — Choose the type (`choose`)

The shelf stays as a reference. Each question: one picture, one ask, no
hint about the type. A right answer's chip flies into its slot.

| # | Who | Opening beats | Ask | Right | Praise | The miss to draw |
|---|---|---|---|---|---|---|
| 0 | Crow | "Now you choose. I'll ask; you give the robot the answer." · "Pick the right data type. The shelf is there if you need it." | — | — | — | — |
| 1 | Crow | — | Is a fish a bird? | `False` | Yes or no, so a `bool`. | `"no"`: a note stuck on the fish; nothing happens |
| 2 | Crow | — | How many eggs fit in this box? | `6` | Counted, so an `int`. | `6.0`: the dot means measured; eggs are counted |
| 3 | Crow | — | How full is this glass? | `0.25` | Measured, so a `float`. | `0`: "Empty? There's water in it!" |
| 4 | Mira | "I need a sign for my door." | What should the sign say? | `"Mira"` | Words for people, so a `str`. | `Mira` unquoted: `NameError` |
| 5 | Crow | — | Which floor is the car park, one under the ground? | `-1` | Floors are counted, below zero too. | `1`: the lift goes *up* |
| 6 | Mira | — | What letter does my name start with? | `"M"` | One letter: a char, which Python keeps as a `str`. | `"Mira"`: the whole name, not one letter |
| 7 | Crow | — | How tall are you, in metres? | a `float` 0.5–2.5 | Measured, so a `float`. | `140`: "That sounds like centimetres" |
| 8 | Crow | — | Did you have breakfast today? | any `bool` | A yes-or-no, so a `bool`. | `"yes"`: "That's for people. Tell the *robot*." |
| 9 | Mira | "Can the robot keep my phone number? It's 0412 555 019." | Type Mira's number. | `"0412 555 019"` (digits compared) | Nobody adds up phone numbers, so it's words: a `str`. | Unquoted: `SyntaxError`; `412555019`: the leading 0 falls off |
| 10 | Crow | "A football match is two halves of 45 minutes." | How long is it, in hours? | `1.5` | Between one hour and two, so a `float`. | `1.3`: "A dot is not a clock" |
| 11 | Mira | "Is the front door locked? It is." · Crow: "First, tell the robot." | Tell the robot: is it locked? | `True` | The robot's yes is `True`. | `"yes"`: "That's Mira's word. The robot's yes has no quotes" |
| 12 | Crow | "Now tell *Mira*. She needs words." | Tell Mira: is it locked? | a `str` with lock/yes | Same answer, new reader: a `str`. | `True`: "That's robot for yes. Mira reads words" |

Close: "Every answer you gave had a data type. And you picked the right
one." · "The question tells you the type: yes or no, how many, how much, or
words." · "Next, the robot works things out for itself."

Takeaway: "Every value has a data type, and the question you are answering decides which one."

### What moved out of Lesson 1

| Was | Now | Why |
|---|---|---|
| `True + True` | Level 2, after `+` on numbers, as two lit lamps: `1 + 1` | R1, R5 |
| `2 + 0.5` | Level 2's "what type comes back?", after the beat "Don't tell me the answer — make the robot work it out." | R4 |
| Nested containment boxes | The shelf | R8 |
| "Everything you said, sorted — and gone." | The close and takeaway | R11 |
| `ord("A")` | Level 2: "every character is secretly a number", letters sliding onto a number line at 65, 66, 67 | an operation; needs a picture |
| `"7" + "7"` | Level 2, the contrast to `7 + 7` | an operation |
| `talking` lesson / `words` level | Folded into 1b/1c and Level 2 | the type family belongs together |

## 6. The other levels

### Level 2 — Working things out (`operations`)

- R12: open on Mira's problem — "Seven crates, six bolts in each. How many
  bolts?" — which the robot cannot answer from what it knows.
- R4: before the first question, the crow: "Don't tell me the answer. Give
  the robot the sum, and let *it* work it out." Every ask here carries the
  tag *Robot works it out*.
- R2/R3: split praise, rule (as a label), and question.
- R1: `"ha" * 3` — the tile stamps itself three times; `==` — the balance
  levels and a lamp lights `True`.
- Absorbs, as "what type comes back?": `7 + 7` vs `"7" + "7"`, `2 + 0.5`,
  `ord("A")`, and `True + True` (two lit lamps as `1 + 1`).
- R5: a reply that mentions `//` names it as a new sign.
- Close: "The robot worked out twenty, and then forgot it. Next, we'll help
  it remember." Takeaway: "An operation makes a new value, and its type
  depends on the operation."

### Level 4 — Names (`names`)

- **Bug:** "ask for it back: just `x`" must require the thought's source to
  be the name, not `10`.
- R12: first show the forgetting: the crow asks what `7 * 6` was; the robot
  has to work it out again.
- R6: beats point at the memory panel ("Look below: there's `x`, and an
  arrow to `10`."), which pulses.
- Metaphor: **arrow** (what the screen draws). Stage 1's markdown gets one
  bridging line.
- Takeaway: "A name is an arrow to an object. Moving the arrow never changes the object."

### Level 5 — Taking an order (`order`)

- **Bug:** "work it out from what you kept" must require `parcels` in the
  source and no `7`.
- R2: Mira says the facts in her words; the crow translates: "Keep that. `parcels = 7`."
- R6: a scale fills 7 × 2 kg as the robot works it out.

### Practice

- R4: every exercise card carries **You answer** or **Robot works it out**.
- Praise is its own beat, and Next moves to the next exercise.
- The warm-up's skills gain `char`.

### Level 7 — Wake the robot (`wake`)

Four beats before the task: the editor arrives ("Now you can give it a
whole list of instructions"), Run is shown, the lamp, sign and gauge are
pointed at, then the task.

### The reading stages

- Each stage opens with one line from the crow, in the story (R12).
- Ideas are shown one paragraph a beat, the example running in place; the
  markdown stays the source of truth.
- Stage 6's switch to formal words is a labelled beat per term: "You've
  been saying *a name pointing at an object*. The formal word is **binding**."
- `voice.ts` task lines ≤ 20 words (R2).
- R8 audit: equal values show as one object (invariant 4); check every
  `identity` item for a scalar `is` that would draw falsely.

## 7. Implementation contract

What the code must look like, so that separate pieces of work fit.

### Lessons are files

`content/lessons/` is a directory. `content/lessons/index.ts` exports the
types, `progress`, `guidance`, `staging`, the predicates and the `LESSONS`
registry; each lesson is its own file (`meet.ts`, `types.ts`,
`choose.ts`, `operations.ts`, `names.ts`, `order.ts`, `wake.ts`).
Importers keep importing `content/lessons`.

### The beat model (additive — nothing existing is removed)

```ts
type Beat = {
  say: string                 // one line, R2
  speaker?: string            // actor id; the crow when omitted
  show?: Prop                 // the stage picture from this beat on (until another beat or the ask sets one)
  thought?: string            // a demonstration thought in the robot's cloud (not evidence)
  act?: CastAction[]          // e.g. { actor: 'courier', do: 'enter' } | 'hide' | 'wave' | 'hop' | 'sleep' | 'wake'
  focus?: 'console' | 'memory' | 'run'   // pulse that part of the screen
}
type LessonStep = {
  say: string                 // the ASK: the question alone (R3)
  beats?: Beat[]              // told before the ask
  praise?: string             // the first beat shown once this step is done (R9)
  tag?: 'you' | 'robot'       // who does the work (R4)
  // unchanged: speaker, show, ask, done, nudge
}
type Lesson = {
  // unchanged: id, teaches, steps, ordered, finale, outroSpeaker
  outro: string | Beat[]      // closing beats
  takeaway?: string           // the bar shown when finished (R11)
}
```

`guidance()` stays pure and derived. What it shows at step `at` is the
sequence `[praise of step at-1] + beats of step at + ask of step at`
(or `[praise of the last step] + outro` when finished); the workbench
holds only the index into that sequence. A reply to a miss replaces the
ask while it applies, as today.

### Test surface

`window.botgineer` keeps its shape (invariant 14) and gains
`beat(): { at: number; of: number; text: string; asking: boolean }`,
`next()` and `skip()` (jump to the ask). **`say(line)` skips any narration
first**, so a test can still answer a lesson by typing.

### Ownership

Stage pictures (`src/scene/props.ts`, `src/ui/Props.tsx`,
`src/app/props.css`) are one workstream's; lesson content files are each
one workstream's. A content change that needs a new picture asks for it
rather than editing another workstream's files.

## 8. Decisions taken

| Question | Decision | Change it by |
|---|---|---|
| The crow's name | "Corvid", a placeholder, held in one constant `CROW_NAME` in `content/cast.ts` | editing that constant |
| Char on the shelf | Five slots; char tagged `str · length 1` | `types.ts` + the shelf prop |
| 1b copy tasks | Kept (one per type) | `types.ts` |
| `True + True` | Moved to Level 2 as a lamp demonstration | `operations.ts` |
| `talking` / `words` | Folded into Level 1 and 2; `words` leaves the roadmap | `content/roadmap.ts` |
| Metaphor | Arrow, with a bridging line in Stage 1 | `stage-01-straight-line-code.md` |
| Returning mid-level | Resume at the derived step and replay its beats | the workbench's beat index |
