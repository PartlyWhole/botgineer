# Reviewing a lesson: story, sense and pictures

Why this exists: every automatic check asks whether a lesson is *correct*
— Python agrees, the rubric's rules hold (docs/PEDAGOGY.md), the steps play
through. None asks whether it *makes sense*. "A chest that opens for
exactly 12 coins" was valid Python, showed `==` before naming it, and
passed every test; no game has that rule, and no chest was on the stage.
This review reads a lesson the way a learner hears it.

## The inputs

1. **The script** — `npx tsx scripts/lesson-script.ts <id> [seed ...]`:
   every beat, ask, option, praise and reply, in order, with each
   picture described by the sentence it writes for a screen reader. A
   seeded lesson is exported for three seeds (`1 2 3`), since its
   practice changes with each.
2. **The storyboard** — `npx tsx scripts/storyboard.ts <id> <dir> [seed]`
   (dev server running): the whole screen at every beat, with `index.md`
   naming each shot beside its line.
3. **The rules already in force** — `docs/PEDAGOGY.md` (R1–R12, the cast,
   the decisions) and the lesson file's own header (what it means to do).

## The story-logic rubric

On top of R1–R12. Each finding names one of these.

| # | Check | The test |
|---|---|---|
| S1 | **The world would have this rule.** | Would a game, shop, cave or person really work this way? |
| S2 | **The situation needs this idea, not a simpler one.** | `==` fits "is it the one I expect?", `>=` a minimum, `and` two requirements. Would a different operator or idea fit the story better? |
| S3 | **Everything a line mentions is on the stage** (or in memory, or the console) when it is said. | Point to it in the storyboard shot. |
| S4 | **Characters have reasons.** | Why does this character want to know, or do, this now? |
| S5 | **The facts stay put.** | Names, items, values, who has what — the same from step to step, and lesson to lesson. |
| S6 | **Each step follows from the one before**, and sets up the next. | Could a learner say why this comes now? |
| S7 | **The question is a real question.** | The picture or the wording does not give the answer away; each wrong option is a mistake someone would make. |
| S8 | **The kid test.** | Would a 10-year-old gamer say "why would anyone do that?", "what does that mean?", or "I already know that"? |

## The reviewers

Each is one agent, reading the script and the files it names; they run in
parallel and do not see each other's findings.

- **The skeptical kid** (S1, S4, S8). Reads only what is said and shown,
  as a 10-year-old who plays games and has never programmed. Ignores
  whether the Python is right. Flags what sounds made up, pointless,
  confusing, babyish or boring.
- **The teacher** (R1–R12, S2, S6). Does each example *need* its idea?
  Is anything asked before it is shown? Does each step build on the one
  before? Is anything taught that is never used, or used and never taught?
- **The continuity editor** (S5). Reads the lesson beside the lessons
  before it in its unit (and the previous unit's last). Do facts, names,
  the cast and the world agree? Does the lesson pick up where the last
  left off?
- **The picture checker** (S3, S7). Walks the storyboard shot by shot
  against its line: is what is mentioned shown, does the picture agree
  with the words, does the stage give the answer away, is anything
  unreadable or overlapping?
- **The Python expert** (R8). Could an expert object to any sentence? Is
  anything simplified so far it is false?

## A finding

```
- id: <lens>-<n>
  where: Step 2, beat 3 (storyboard 02-03-beat.png)
  quote: "the exact words"
  check: S1
  problem: one or two sentences, from the learner's side
  severity: high (a learner is confused or misled) | medium (it weakens
    the lesson) | low (polish)
  fix: a rewritten line, or what to change
```

No finding without a quote. Taste is not a finding unless it costs the
learner something; say what it costs.

## Verifying

Every finding goes to one more agent, told to argue it away: is this a
real problem for a learner, does the script or storyboard actually say
that, is the fix better? It answers **keep** (with the reason), **drop**,
or **merge with** another finding. Only kept findings are reported,
most severe first. This is the step that keeps a review of taste from
burying the two findings that matter.

## Calibrating

A review that misses a known problem is not trusted. The pre-fix
`v2-logic` (`git show 39b8b95:content/lessons/v2/logic.ts`) has the chest;
the skeptical kid must flag it. Keep a short list of planted defects —
a picture missing its object, a fact changed between steps — and count
how many each review catches.

## What it costs

Measured on `v2-meet` (Lesson 1), in [docs/LESSON-REVIEW-COST.md](LESSON-REVIEW-COST.md).
