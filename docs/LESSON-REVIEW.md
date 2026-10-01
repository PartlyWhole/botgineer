# Reviewing a lesson: story, sense and pictures

Why this exists: every automatic check asks whether a lesson is *correct*
— Python agrees, the rubric's rules hold (docs/PEDAGOGY.md), the steps play
through. None asks whether it *makes sense*. "A chest that opens for
exactly 12 coins" was valid Python, showed `==` before naming it, and
passed every test; no game has that rule, and no chest was on the stage.
This review reads a lesson the way a learner hears it.

## Running it

A **unit** at a time (the lessons of one stretch of the map, in play
order), not a lesson at a time: an agent costs about 55k tokens before it
reads a word, so the cost is mostly how many agents run
([LESSON-REVIEW-COST.md](LESSON-REVIEW-COST.md)).

1. With the dev server running:
   `npx tsx scripts/review-prep.ts <dir> <id> [<id> ...]` — writes each
   lesson's script and storyboard into `<dir>` (no agents; about a minute
   a lesson).
2. Run the `review-lessons` workflow (`.claude/workflows/review-lessons.js`)
   with `{ dir, lessons: [...] }`, the line `review-prep` prints. It
   returns the kept findings, most severe first, and the dropped ones.
3. Write the report to `docs/reviews/<unit or id>.md`.

## The inputs

1. **The script** — `scripts/lesson-script.ts <id> [seed ...]`: every
   beat, ask, option, praise and reply, in order, with each picture
   described by the sentence it writes for a screen reader. A seeded
   lesson is written in full for its first seed, and only the steps that
   differ for the next two (the teaching is the same every seed).
2. **The storyboard** — `scripts/storyboard.ts <id> <dir> [seed]`: the
   screen at every beat that changes it, with `index.md` naming each shot
   beside its line. A beat that changes only the stage is shot as the
   stage alone; a beat that puts nothing new on screen is listed against
   the last shot; the first typed line is also shot while it is typed.
   (`--every` shoots every beat, whole.)
3. **The rules already in force** — `docs/PEDAGOGY.md` (R1–R12, the cast,
   the decisions) and each lesson file's own header (what it means to do).

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

Five angles in three kinds of agent. They run in parallel and do not see
each other's findings.

- **The story reader** — the skeptical kid and the continuity editor,
  one agent for the whole unit (S1, S4, S5, S8). As the kid: reads only
  what is said and shown, as a 10-year-old who plays games and has never
  programmed; ignores whether the Python is right; flags what sounds made
  up, pointless, confusing, babyish or boring. As the continuity editor:
  facts, names, the cast and the world agree from step to step and lesson
  to lesson, and each lesson picks up where the last left off — which is
  why one agent reads the whole unit.
- **The teacher** — the teacher and the Python expert, one agent for the
  whole unit (R1–R12, S2, S6, R8). Does each example *need* its idea? Is
  anything asked before it is shown? Is anything taught and never used,
  or used and never taught? Could an expert object to any sentence?
- **The picture checker** — one agent per lesson (S3, S7), because the
  storyboard is the heaviest thing any reviewer reads. Shot by shot: is
  what is mentioned shown, does the picture agree with the words, does
  the stage give the answer away, is anything unreadable or overlapping?

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

## Merging and verifying

One agent merges the findings into clusters, one per distinct problem
(low effort, reading nothing but the findings). Then the clusters go to
verifiers in **batches** — one lesson per batch, at most six clusters —
each told to argue every cluster away: is this a real problem for a
learner, does the script or storyboard actually say that, is the fix
right? It answers **keep**, **keep-with-changes** or **drop**, with the
evidence, and may settle a doubt about timing or animation in the live
page. Only kept findings are reported, most severe first. This is the step
that keeps a review of taste from burying the findings that matter: on
Lesson 1 it dropped two claims, confirmed a bug the screenshots could not
show, and corrected two wrong fixes.

(The first run gave every cluster its own verifier. Batching costs some
independence — a verifier arguing six findings may grow consistent with
itself — and saves most of the verification's cost. Keep one lesson per
batch, so no verifier weighs two lessons' findings against each other.)

## Calibrating

A review that misses a known problem is not trusted. The pre-fix
`v2-logic` (`git show 39b8b95:content/lessons/v2/logic.ts`) has the chest;
the skeptical kid must flag it. Keep a short list of planted defects —
a picture missing its object, a fact changed between steps — and count
how many each review catches.

## What it costs

Measured on `v2-meet` (Lesson 1), in [docs/LESSON-REVIEW-COST.md](LESSON-REVIEW-COST.md).
