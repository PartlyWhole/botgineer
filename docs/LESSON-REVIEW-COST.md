# What a lesson review costs

Measured on `v2-meet` (Lesson 1: one step, six beats, an outro), the first
run of [LESSON-REVIEW.md](LESSON-REVIEW.md), 2026-10-01. Token counts are
as each subagent reported them, and include the context every agent
starts with (its instructions and the project guide), much of it cached.

## Preparing the inputs (no agents)

| Step | Time |
|---|---|
| Export the script (`scripts/lesson-script.ts`) | 1.3 s |
| Storyboard, 9 shots (`scripts/storyboard.ts`) | 23 s |
| Merging 20 findings into 10 clusters (the lead, by hand) | a few minutes of reading |

## The agents

| Phase | Agents | Tokens | Tool calls | Wall time (parallel) |
|---|---|---|---|---|
| Reviewers (kid, teacher, continuity, pictures, Python) | 5 | 362,782 | 48 | 79 s |
| Verifiers (one per cluster) | 10 | 648,313 | 53 | 133 s |
| **Total** | **15** | **1,011,095** | **101** | **about 5.5 min** end to end |

Per agent:

| Agent | Tokens | Tool calls | Time | Result |
|---|---|---|---|---|
| Skeptical kid | 68,237 | 8 | 45 s | 5 findings |
| Teacher | 80,990 | 12 | 79 s | 6 findings |
| Continuity editor | 72,279 | 10 | 64 s | 3 findings |
| Picture checker | 74,374 | 12 | 48 s | 4 findings |
| Python expert | 66,902 | 6 | 53 s | 2 findings |
| Verify A (the thought is never let go) | 62,366 | 4 | 29 s | keep, medium |
| Verify B ("whatever goes in") | 63,891 | 5 | 43 s | keep, medium |
| Verify C (the empty memory pane) | 64,707 | 5 | 31 s | keep, low (folded into A) |
| Verify D (no problem stated) | 66,340 | 3 | 27 s | keep, medium |
| Verify E (copying the crow's 7) | 59,243 | 3 | 27 s | keep, low (the replies only) |
| Verify F ("instruction" never said) | 59,634 | 2 | 23 s | keep, low |
| Verify G (reply wording) | 60,256 | 2 | 19 s | **drop** |
| Verify H (the pictures, in the live page) | 81,238 | 16 | 133 s | (1) keep, medium: a real bug; (2) **drop**: a screenshot artifact |
| Verify I (the crow's demo lines vanish) | 66,112 | 7 | 34 s | keep, low |
| Verify J (the docs say the crow can't type) | 64,526 | 6 | 38 s | keep, low |

## What the numbers say

- **The floor is the cost.** Every agent cost at least 59k tokens, even
  one that made two tool calls. Roughly 55k of each is the context an
  agent starts with; the reading itself was 5–25k. Fifteen agents is
  about 830k of overhead and 180k of work.
- **So fewer, fuller agents are much cheaper.** One verifier taking all
  ten clusters would have cost about 100k, not 648k — at some cost to
  independence (one agent arguing ten findings away tends to agree with
  its own earlier verdicts). A middle way: verify in two or three
  batches, grouped so one verifier never judges two findings about the
  same line.
- **Verification earned its place.** It dropped 3 of 21 claims (G, and H
  part 2, a timing artifact of the storyboard; C folded into A), turned
  "maybe a timing artifact" into a confirmed bug with its cause (H part
  1), and corrected two fixes that were wrong (E: "leave the quotes off"
  advice that would produce a `NameError`; C: removing the memory slots
  the next lesson fills).
- **A longer lesson costs more per agent, not more agents.** Lesson 1 is
  287 words. A lesson of 15 steps is ~5,000 words of script and ~60
  shots; reviewers would read 3–5× more (perhaps 90–150k each), and the
  picture checker most of all. Expect roughly 1.5–2.5M tokens for a
  long lesson at this design, or 0.6–1M with batched verification.
