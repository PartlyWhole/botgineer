# Review: `v2-meet` (Lesson 1), 2026-10-01

Five reviewers, then one verifier per finding cluster
([LESSON-REVIEW.md](../LESSON-REVIEW.md); cost in
[LESSON-REVIEW-COST.md](../LESSON-REVIEW-COST.md)). 20 findings, merged
into 10 clusters; after verification, 9 kept (one folded into another), 2
dropped. Most severe first. Nothing here is fixed yet.

## Kept

1. **The console's "look here" pulse never shows in the v2 look** — medium, a bug (S3).
   Every beat with `focus: 'console'` pulses an inset outline on
   `.view.instrument`, but the v2 console (`.console.v2`, opaque gradient,
   `position: relative`) fills the box and paints over it. Verified frame
   by frame in the live page. Likely affects every v2 `focus: 'console'`
   beat, and perhaps the v2 `.glow` too.
   *Fix:* draw the v2 pulse where the child cannot cover it (a `::after`
   overlay on `.view.instrument`, or the outline on `.console.v2` itself),
   with its reduced-motion rule.

2. **No line says the thought is let go, and Lesson 4 opens as if one had** — medium (S6, S5).
   `v2-bind` begins "Every thought so far, the robot let go." No v2 lesson
   before it says so; v1's Meet did. The empty memory slots (on screen
   all lesson, never mentioned) are the same gap seen from the other side.
   *Fix:* a last outro beat, `{ say: 'Then it lets the thought go. Nothing stays down there, yet.', thought: '', focus: 'memory' }`.

3. **"Whatever goes in, it thinks of" is false within the lesson, and said four times** — medium (R8, R1, R11).
   The replies to the first likely misses (`seven`, `7 +`) contradict
   "whatever"; beat 2 states the rule before showing it; the takeaway
   repeats the outro.
   *Fix:* beat 2 → "Watch: I'll tell it a number."; beat 6 → "A new number
   in, a new thought."; outro "you type it"; takeaway "One line is one
   instruction: type a number, and the robot thinks of it."

4. **The robot's problem, and the learner's part in it, are never said** — medium (R12).
   v1 opened "On its own it does nothing at all. It needs someone to give
   it instructions, and that's you." v2 opens on the robot already able.
   *Fix:* beat 2 → "On its own, it does nothing at all. It needs someone to
   tell it what to do, and that's you." (with v1's sleep/wake), and the
   outro closes on what it can do now. No new animation.

5. **The replies hand back the crow's `7`, and one gives wrong advice** — low (S6).
   `"seven"` gets "Leave them off: `7`" — but leaving the quotes off gives
   `seven`, a `NameError`. Every reply suggests `7` whatever was typed.
   *Fix (in `content/lessons/meet.ts`, shared with v1):* "…in digits, like `7` or `42`."
   and "A number is just digits, like `7` or `42`, with no quotes."

6. **"Instruction" is the takeaway's word, and no beat says it** — low (S5, R11).
   Later lessons rely on it ("a whole list of instructions"); the verb
   drifts between type and write.
   *Fix:* name it in the outro ("Each line you type is an *instruction*…");
   "type" throughout. (Overlaps 3's takeaway — pick one wording.)

7. **The crow's first demo line vanishes when it says "another"** — low (S3).
   The console shows only `42` at "Now another: `42`." The demo lines
   should accumulate in the crow's block until the question, then clear.
   *Fix:* a `types` beat builds on the step's earlier ones (a change to
   `Demo` and its doc in `core.ts`).

8. **PEDAGOGY §3 says the crow has no hands to type; v2's crow types every demo** — low, docs (S5).
   And §3's arc table is v1's map only. Reviewers check lessons against
   §3, so as written it would flag every v2 demonstration.
   *Fix:* the crow "shows before it asks: it may type a demonstration,
   never your answer"; add v2's arc table.

## Dropped

- **Reply wording, "word" for two things** (G): v2-types itself says
  "words" for a str, so meet already matches it; the proposed "text" would
  put them out of step.
- **The 7 answered before "I type 7, and press Enter" is read** (H, part
  2): live, the typing keeps pace with the line; the storyboard shot is
  taken after it settles. (So `storyboard.ts` should also shoot ~0.6 s
  into a `types` beat.)
