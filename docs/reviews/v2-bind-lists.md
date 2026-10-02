# Review: `v2-bind` and `v2-lists` (Lessons 4–5), 2026-10-02

The Memory unit, run with the `review-lessons` workflow. Seed 1 storyboards; scripts for seeds 1–3. 30 findings → 28 clusters → **24 kept, 4 dropped**. Cost in [LESSON-REVIEW-COST.md](../LESSON-REVIEW-COST.md). Nothing here is fixed yet.

## Kept

1. **'Only lists do it' teaches that assignment copies non-lists** — `v2-lists`, high (keep; from teacher-1).
   > One more thing, and only lists do it. Read these three lines with me.
   `b = a` never copies for any type; saying only lists do it implies ints and strs are copied, contradicting the memory graph.
   *Verified:* lists.ts Step 7's first beat says "One more thing, and only lists do it.", and the next beats say `b = a` makes no copy. A child will read the "it" as the no-copy rule, which is false: `b = a` never copies anything. The memory graph proves it, since `m = n` with ints draws both arrows onto one card (invariant 4). What only a list can do here is be changed in place, so the effect is visible; the sharing itself is the same for every type. This seeds the belief that assignment copies numbers and strings.
   *Fix:* "One more thing. `b = a` never makes a copy, and a list is where you can see it. Read these three lines with me."

2. **Memory wiped during Step 6's praise, before the wipe beat** — `v2-bind`, high (keep; from pictures:v2-bind-1).
   > `0`, `1`, `2`, `3`: `score` moved on one each time.
   The praised `score` card is already gone; the later wipe line announces what already happened.
   *Verified:* Confirmed in the source and the storyboard. Step 7 has `wipeFirst: true` (bind.ts, goals()), and Workbench.tsx:687-698 wipes as soon as `told.at` reaches the step. Step 6's praise is index 0 of step 7's script, so in 07-00-praise.png the crow says "`0`, `1`, `2`, `3`: `score` moved on one each time" over an empty console and an empty memory. Two beats later (07-02) it says "I've wiped the robot's memory", which by then is old news. At the moment the learner should be looking at their own work, the picture contradicts the crow.
   *Fix:* Fire the wipe from the beat that announces it, not from the step's start. Add a beat-level flag (e.g. `wipe: true` on 'I've wiped the robot's memory…'), or have Workbench wipe once `told.at === step && beat index >= that beat`, keeping its once-per-visit guard. The praise and the first goal beat then show the learner's score memory, and memory empties on the line that says so. content/lessons/v2/lists.ts:360 uses the same wipeFirst, so check its praise beat as well.

3. **Mira walks on unintroduced at an unmentioned trailhead** — `v2-lists`, medium (keep; from story-1).
   > Loot for the robot! A sword, a shield and a potion.
   First time Mira is on stage in v2; nobody says who she is or why the robot is outdoors, so her loot has no reason.
   *Verified:* v2-lists is Mira's first time on stage in the v2 track. v2-meet, v2-ops and v2-bind never use the courier, and v2-types only types "Mira" as a string. The scene also moves from WORKSHOP to the trailhead here (content/activities/v2.ts:99). Even so, Step 1 opens with Mira entering and saying "Loot for the robot!" (shot 01-00-beat-stage.png), and nobody says who she is, why we are outdoors, or why she brings loot. The cave adventure that explains the trailhead is only mentioned at Step 8.
   *Fix:* Add a first crow beat with Mira's `enter` act on it: "Out of the workshop today. This is Mira, a person. She's off to explore the caves, and she's brought the robot some loot." Her loot line comes next.

4. **Mira talks like the engineer** — `v2-lists`, medium (keep-with-changes; from story-2).
   > I'll swap you my gem for your helmet. Change just that index.
   Mira 'speaks no robot' but says index, memory and names variables, blurring what the crow is for.
   *Verified:* PEDAGOGY.md:80 says Mira "speaks no robot". Yet she asks every practice question in robot terms: "make the robot's memory match" (Step 8), "what index will it land at?" (Step 10), "Change just that index." (Step 15) and "I'll carry it too, as `bag`. The same backpack, not a copy!" (Step 16, naming a variable). That takes away the crow's job of translating a person's need into robot. "Ask the robot" in Mira's mouth is fine.
   *Fix:* Keep Mira's need as a beat in her own words ("I'll swap you my gem for your helmet!", "I want to carry the backpack too!"). Make the ask in Steps 8, 10, 15 and 16 the crow's (drop `speaker: 'courier'` on the ask), for example "Change just that slot: index `1`." and "Point `bag` at the same list as `backpack`, not a copy."

5. **The hotbar is wiped without reason, and before the crow says so** — `v2-lists`, medium (keep-with-changes; from story-3, pictures:v2-lists-5).
   > I've wiped the robot's memory for it.
   The hotbar (with Mira's bow) vanishes at Step 7's praise, two beats before the wipe is announced, with no story reason; a new backpack repacks a map.
   *Verified:* Confirmed. Workbench.tsx:687-698 wipes memory as soon as a `wipeFirst` step is reached. In 08-00-praise.png, while Step 7's praise about `a` and `b` is still being read, the console and memory are already empty and the hotbar with Mira's bow is gone. The crow only explains this two beats later ("I've wiped the robot's memory for it", 08-02), and no line gives a story reason. The suggested option of keeping the hotbar beside the backpack does not fit: the goals compare the whole memory, and `goalMiss` flags extra names, so that would mean redesigning the goals.
   *Fix:* Have the crow say it on the first beat after the praise, with a reason: "The hotbar's game is over, so I've wiped the robot's memory: the backpack starts from nothing." Put Mira's backpack line after it. Better still, let a beat carry the wipe (a beat-level `wipe` flag), so the memory empties on that line and not during the praise.

6. **The aliasing payoff is never shown** — `v2-lists`, medium (keep-with-changes; from pictures:v2-lists-2).
   > `a` and `b` are one list, so `b` has the `3` too: `[1, 2, 3]`.
   No memory, console or picture ever shows b holding [1, 2, 3]; at the praise memory is blank.
   *Verified:* Confirmed. The crow's demonstration stops at `b = a` (07-05-beat.png: Corvid's memory overlay shows a and b on a 2-item list), and the ask shows the hotbar. The praise is said while step 8 is current, and step 8 is `wipeFirst` (Workbench.tsx:687-697 wipes when stepAt changes), so 08-00-praise.png shows empty memory under "`b` has the `3` too". The payoff of aliasing is never drawn. A praise is a plain string (core.ts:360) with no `memory`, so the fix as proposed (run the lines during the praise) cannot be written today.
   *Fix:* Open practice step 1 with a crow beat before the courier's: `{ say: 'Here it is: one list, two names, and the 3 on the end of it.', memory: ['a = [1, 2]', 'b = a', 'a.append(3)'], mark: ['a', 'b'], show: { kind: 'code', text: 'a = [1, 2]\nb = a\na.append(3)', mark: 3 } }`. Demonstration memory shows in the Corvid overlay whatever has been wiped. Or let a praise carry `memory`.

7. **Doubling step accepts a typed answer; praise describes unworked maths** — `v2-bind`, medium (keep-with-changes; from teacher-2).
   > The speed has doubled. Let the robot work out the new one.
   Judged only on reaching the goal, so `speed = 5.0` passes and the praise describes `speed * 2` never typed; Step 4 refuses the same; Step 9 shares the gap.
   *Verified:* Confirmed for Step 11: the g5 goal step uses `done: reached(e, goal)` (bind.ts goalStep), so a typed `speed = 5.0` finishes it, and the praise "`speed * 2` is `5.0`: still a `float`." then describes working the player never asked for. That contradicts the ask "Let the robot work out the new one." and Step 4, which refuses `b = 5` with "That's the answer typed in." The claim about Step 9 does not hold: its ask, "Move the robot's `x` to match.", does not require working, and its praise, "`x` moved to `8`, and `name` stayed put.", is true whichever way it was done. Also, goalMiss returns undefined when memory matches, so the literal-typed nudge has to be checked before goalMiss runs.
   *Fix:* Step 11 only. Give it `done: (e) => everBy(e, (src, s) => /^\s*speed\s*=.*\bspeed\b/m.test(src) && compare(g5, s).met)`, and a nudge that runs before goalMiss: when the source matches `/^\s*speed\s*=\s*[\d.]+\s*$/`, say "That's the answer typed in. Let the robot double it: `speed = speed * 2`." Either require `*` in the regex, or change the praise to "The robot worked out `5.0` from `speed`: still a `float`." so `speed = speed + 2.5` doesn't get praise about `* 2`. Leave Step 9 as it is.

8. **'Undo that line' is wrong advice when extras predate the line** — `v2-bind`, medium (keep; from teacher-3).
   > isn't in the goal. Undo that line, or wipe the memory and start again.
   Typing `total = 20` over earlier memory gets told to undo the one right line.
   *Verified:* Confirmed in goalMiss (bind.ts). At Step 12, memory still holds x, name and speed from Steps 7 to 11. Typing `total = 20` makes `made = 'total'`, which is not an extra, and every row is ok. So it falls through to `extra.length` and replies "`x` isn't in the goal. Undo that line, or wipe the memory and start again." Undo would take back the one right line. This is the most likely first line at Step 12, because the ask names `total` and does not mention wiping.
   *Fix:* In goalMiss, for extras this line did not make: "`${extra[0]}` isn't in the goal. Wipe the memory, then build just what the goal shows." (Step 12 can say "…then make just `total`."). Keep the 'Undo that line' reply only for the branch where this line made the extra name.

9. **Mutate-vs-rebind is refused but never shown to matter** — `v2-lists`, medium (keep-with-changes; from teacher-4).
   > That made a whole new list. Move just index `1`: `hotbar[1] = "bow"`.
   A rebuilt list looks identical to the goal until sharing appears in the last step, so refusals have nothing visible behind them.
   *Verified:* Step 5 (lists.ts:238-241) and practice step 8 (lists.ts:440) turn away `hotbar = ["sword", "bow", "potion"]` with 'That made a whole new list', but the result looks exactly like the goal. The new list's handle only shows on hover (invariant 16), so nothing visible backs up the refusal. `teaches` includes 'mutate-vs-rebind' (lists.ts:465), yet sharing (step 7, practice 9) is only shown with `append` on a shared list. Rebinding is never shown leaving the other name behind, so the distinction never pays off. The suggested 'soften and drop from teaches' would throw away a true and useful idea, so I would not do that.
   *Fix:* After `bag = backpack`, add one prediction: code card `backpack = ["rope"]`, 'What is `bag` now?', with the options the old list / `["rope"]`. Praise: '`backpack` points at a new list now; `bag` still has the old one. That is why a swap moves a slot instead of making a new list.' Keep the refusals as they are.

10. **First function call and method dot go unexplained** — `v2-lists`, medium (keep-with-changes; from teacher-5).
   > `len` counts the slots in a list.
   Round brackets for `len` and the dot in `.append` are never named; likely misses get unhelpful NameError/TypeError replies.
   *Verified:* `len(...)` is the first function call in the v2 path, and `.append` is the first method (no earlier v2 lesson has one; round brackets so far meant 'do this first', in ops.ts:240). Neither is named. The beats only show them typed (lists.ts:214, 247). In the live page, `append("map")` got 'That uses a name the robot has no memory of yet.' and `hotbar.append "map"` got 'That stopped the robot with a `SyntaxError`. Check the line against the goal.' Neither tells the player what to type. The `len` misses already fall back to the model line, so the gap is mostly `append`.
   *Fix:* Change beat 214 to: '`len` counts the slots in a list. What it counts goes in round brackets: `len(hotbar)`.' Change beat 247 to: '…`hotbar.append("map")`: the dot says it is `hotbar`'s list that grows.' In step 6's nudge, before goalMiss, answer a NameError whose line starts with `append` with '`append` belongs to a list: `hotbar.append("map")`.', and a SyntaxError on a line with `.append` with 'The item goes in round brackets: `hotbar.append("map")`.'

11. **Unquoted `map` is a builtin, so the miss runs and the reply misleads** — `v2-lists`, medium (keep; from teacher-6).
   > That appended the wrong item. Undo that line, and append again.
   `hotbar.append(map)` succeeds with a class; reply never mentions quotes.
   *Verified:* Confirmed live. `hotbar.append(map)` runs, because `map` is a builtin, and leaves a `<type>` card in slot 3 (vl-unquoted.png). The reply is 'That appended the wrong item. Undo that line, and append again.' (goalMiss, lists.ts:119-120), which never mentions quotes, so the player will probably retype it the same way. The same trap is in practice: `backpack = [map, "helmet"]` runs and gets a reply about the goal rather than about quotes. The listMiss quote hint (lists.ts:76) only catches a NameError.
   *Fix:* In goalMiss, before the other checks: if the line ran but left a non-`str` object in a slot where the goal has a word, or a goal item appears in the source without quotes, say 'Words need quotes, or the robot reads them as names: `"map"`. Undo that line, and try again.' Keep `map` as the item: it is also the practice's first item, so renaming it would not fix practice.

12. **'Point b at a + 1' states the refused misconception** — `v2-bind`, medium (keep; from teacher-7).
   > Point `a` at `4`. Then point `b` at `a + 1`.
   Right after insisting the robot never keeps a sum, the ask says to point at an expression.
   *Verified:* The ask in bind.ts Step 4 says "Then point `b` at `a + 1`." The beats just before it say the robot works out a new `3` and points `x` at it. Step 3's nudge says "The robot never keeps a sum", and Step 5 offers `n + 1` as a wrong option to pick. So the ask puts into words the very misconception the lesson has just refused. The line the player types is still clear, which is why this is medium and not high.
   *Fix:* "Point `a` at `4`. Then let the robot work out `b` from it: `b = a + 1`."

13. **Old card turns into the new value in place** — `v2-bind`, medium (keep-with-changes; from pictures:v2-bind-2).
   > Nothing points at the old `1` now, so the robot lets it go.
   The `1` card reads `3` in the same spot, looking like mutation; old object never seen leaving (Step 5 too).
   *Verified:* Confirmed live (vb-3b-strip.png). On the step from '…`1 + 2` is a new object, `3`…' to '…and only then does it move `x` to the `3`', the `1` card is gone within 60 ms and the `3` card fades in at exactly the same place (cards are keyed by handle, and graphLayout puts x's object at the head of its row). The next beat, 'Nothing points at the old `1` now, so the robot lets it go', is the same screen as 03-04. The learner sees the box's contents change, which is the mutation model this lesson exists to replace. Step 5's count beats behave the same way. The proposed fix of showing the new object beside the old one cannot come from the placement as it stands: invariant 15 makes place a pure function of memory, and after the line the `1` is not in memory.
   *Fix:* Fix it in the tween, not the layout. In MemoryGraph, keep a card whose handle has just left memory rendered for a moment, dimmed and drifting or fading out where it stood. Have the newcomer arrive from the robot's thought-cloud side (or slightly offset) before it tweens to its slot, so the old and new cards are both visible and the arrow visibly swings. That keeps placement pure, and the 'lets it go' beat then follows a departure the learner has actually seen. A cheaper fallback is to reword the 'lets it go' beat to 'The old `1` is gone: nothing pointed at it.' so it describes what the picture already did.

14. **Answer chip covers index badges, misplaced under wrong slot** — `v2-lists`, medium (keep; from pictures:v2-lists-1).
   > The third thing is at index `2`, counting from `0`: the torch.
   Chip hides the badge being named and sits under the wrong item.
   *Verified:* Confirmed in storyboard 14-00-praise.png. The answer chip ('torch' str ✓) is centred under the backpack as a whole, not under the torch's pocket. It covers the index badges `1` and `2` while the crow says "at index `2`, counting from `0`", so the very badge being named is hidden. It also sits closer to the helmet/torch boundary than under the torch.
   *Fix:* In the backpack and hotbar pictures (src/ui/Props.tsx, Backpack/Hotbar), place the looked-up answer chip under the slot it came from (`lit`), below the badge row. A `len` count chip can stay at the corner. Never draw a chip over the index badges.

15. **Stage picture runs ahead of memory during demos** — `v2-lists`, medium (keep-with-changes; from pictures:v2-lists-4).
   > The list grows. Its new slot, at index `3`, points at `"map"`.
   Stage shows index 3 while the crow says there is none and memory still has 3 items; same in Step 5.
   *Verified:* Confirmed in the live page (vl/s6-2-a/m/b.png): in Step 6, the stage switches to the four-slot hotbar with the map at index 3 the moment the beat starts. During those same seconds the crow is saying "There's no index `3` to change", and memory still shows 3 items until `hotbar.append("map")` lands about a second later. The cause is lists.ts:247, where `show: hotbar(GROWN, 3)` sits on the beat that both says that sentence and types the line. Step 5 (s5-2 strips) shows the bow before memory moves, but nothing it says contradicts that, so it is a minor lead and not a contradiction.
   *Fix:* In lists.ts Step 6, split the beat. Put "There's no index `3` to change." over `hotbar(SWAPPED)`, with nothing typed. Then let the typing beat say "`append` adds a new slot on the end." with `hotbar(GROWN, 3)`. A more general fix is in the engine: for a beat that `types` a line, hold the previous picture until that line is accepted.

16. **In a swap, Mira's shield is just 'let go'** — `v2-lists`, low (keep-with-changes; from story-4).
   > Nothing points at the shield now, so it's let go.
   A swap means Mira gets the shield, but the crow says it is let go; same with the helmet in Step 15.
   *Verified:* Step 5 calls the trade a "swap" ("Swap your shield for my bow!"), and the crow then says "Nothing points at the shield now, so it's let go." That is true of Python: the str has no references left. In the story, though, Mira should end up with the shield. The cluster's claim that the same happens to the helmet in Step 15 is overstated: Step 15 has no beats and never says "let go". The suggested fix drops the true memory idea (invariant 8's "let go").
   *Fix:* Keep the Python and add the story: "It's the same list, with one arrow moved. Nothing in the robot's memory points at the shield now, so the robot lets it go. It's Mira's now."

17. **'Equip' promises an effect that never happens** — `v2-lists`, low (keep; from story-6).
   > Equip the first item: ask the robot for it.
   Equipping implies a change; `hotbar[0]` only thinks of 'sword' and nothing changes.
   *Verified:* lists.ts:203. To a gamer, 'equip' means putting the item in your hand, but `hotbar[0]` only thinks of 'sword' and nothing changes in memory or on the stage (03-01-ask.png). A learner who takes 'equip' at its word may type `equipped = hotbar[0]`. That binds without a thought, so `lookedUp` never passes, and since the line did not stop, `lookupMiss` falls through to `stopped()` and returns undefined (no reply). The cost is small, but it is real.
   *Fix:* say: 'Which item is in the first slot? Ask the robot.' (ask: 'The first item', unchanged).

18. **Goal nouns belong to no one** — `v2-bind`, low (keep-with-changes; from story-7).
   > The speed has doubled. Let the robot work out the new one.
   `name`, `x`, `speed` refer to nothing on stage; puzzles feel like busywork.
   *Verified:* Mostly taste. The goal card is on the stage in every goal shot (11-01-ask.png shows x, name and speed with their values), so S3 is met and the task is clear. The one real cost is "The speed has doubled.", which reads as a fact about something in the world, and nothing on stage has a speed. The proposed fix, the robot's name, would break S5: the robot is 'Robot' in content/cast.ts, and a seeded 'Bolt'/'Sprocket'/'Pip' would change its name each game and be forgotten later.
   *Fix:* Give only `speed` an owner: Step 10 "Give the robot a `speed`." and Step 11 "The robot's speed has doubled. Let it work out the new one." Don't call `name` the robot's name. Leave `x` and `name` as plain goal entries.

19. **'Add one to it' implies an int is changed in place** — `v2-bind`, low (keep; from teacher-8).
   > point `score` at `0`, then add one to it, three times.
   Contradicts the beats saying the name moves to a new object.
   *Verified:* Step 6's ask says "add one to it, three times", which reads as changing the object `0` in place. The beats before it say "…and move `count` to it", and the step's own praise says "`score` moved on one each time." The cost is small because the praise puts it right at once, but the ask should match the model the lesson builds.
   *Fix:* "Make the robot count: point `score` at `0`, then move it on by one, three times."

20. **Indexing is said to 'make' an object** — `v2-lists`, low (keep; from teacher-9).
   > What does `hotbar[2]` make?
   Indexing follows a slot to an existing object; 'make' suggests a copy.
   *Verified:* lists.ts:194/196 and 424/426 ask 'What does `hotbar[2]` make?'. 'Make' is the house word for an expression that makes a new object (logic.ts:301). But this lesson's own beat (lists.ts:189) says indexing follows the name and the slot to an object that already exists, and the alias step depends on that 'no copy' idea. 'Make' quietly contradicts both. The fix keeps the IndexError option ('It stops') making sense.
   *Fix:* 'What does `hotbar[2]` find?' / ask 'What does it find?', and the same for `backpack[4]` at lists.ts:424/426.

21. **Step 5 IndexError reply points to unseen `append`** — `v2-lists`, low (keep-with-changes; from teacher-10).
   > There's no slot at that index. `append` adds one on the end.
   `append` is not yet taught and the player miscounted rather than needing a new slot.
   *Verified:* lists.ts:99, `goalMiss`, replies to every IndexError with "`append` adds one on the end." Step 5 (the swap, lists.ts:238-244) uses `goalMiss`, but `append` is first shown in Step 6. In Step 5 an IndexError comes from a miscounted index, such as `hotbar[3] = "bow"`, so the advice is both unseen and wrong: the slot is there, the count is off. The proposed fix only fits Step 5, though. `goalMiss` is shared with the practice steps (where append is known and sometimes the right advice), so its wording cannot just be changed.
   *Fix:* Let `goalMiss` take an optional IndexError reply. For Step 5 pass "Three items have indexes `0`, `1` and `2`: the shield is at index `1`." Keep the current append reply as the default for the steps after Step 6. Practice step g7 (the swap of index 1) needs an index-counting reply too, not the append one.

22. **Praise says x points at 10 while memory shows x -> 1** — `v2-bind`, low (keep-with-changes; from pictures:v2-bind-3).
   > The right side first: `2 * 5` is `10`, and `x` points at the `10`.
   Multiple-choice ran nothing, so memory contradicts the crow; stray period wraps.
   *Verified:* Confirmed in 04-00-praise.png. The praise says "`x` points at the `10`" while the robot's memory beside it shows x -> 1 (int), the learner's own binding from Step 1, because the multiple-choice step runs nothing. The question was hypothetical ('After `x = 2 * 5`'), so the contradiction is mild, but a ten-year-old checking memory sees 1. The lone period wrapping onto its own line is also real: it follows the `10` code chip.
   *Fix:* Reword the praise so it is about the line, not the robot: "The right side first: `2 * 5` is `10`, so that line points `x` at the `10`." Do not run it into memory, because that would rebind the learner's x behind their back. Fix the stray period in the bubble renderer, not per line: keep trailing punctuation glued to the inline code before it (a no-wrap span around a chip and its punctuation).

23. **Undo and Wipe named but barely visible** — `v2-bind`, low (keep-with-changes; from pictures:v2-bind-5).
   > Undo takes it back. Wipe starts the whole memory again.
   Buttons greyed and small; highlight frames the whole panel.
   *Verified:* Confirmed in 07-04-beat.png. The Undo and Wipe buttons sit small and greyed in the memory pane's top-right corner while the green focus ring frames the whole memory panel, so 'Undo takes it back. Wipe starts the whole memory again.' points at nothing in particular. They are greyed because memory is empty, so there is nothing to undo or wipe, and that disabled look is honest. Raising them to full contrast while they do nothing would misstate what they do.
   *Fix:* Add a focus target for the memory pane's Undo/Wipe controls and use it on this beat (`focus: 'memory-tools'` or similar), so the ring or glow sits on the two buttons. Keep their disabled state.

24. **Outro names a hotbar memory no longer holds** — `v2-lists`, low (keep; from pictures:v2-lists-7).
   > Now the robot can keep a whole hotbar of things under one name.
   Memory holds backpack and bag; hotbar was wiped.
   *Verified:* lists.ts:470: the outro line "a whole hotbar of things under one name" carries `focus: 'memory'`. But the lesson wipes memory for practice (`wipe: true`), and 17-00-praise.png shows memory holding only `backpack` and `bag`. The crow points at memory and names something that is not in it.
   *Fix:* Change lists.ts:470 to "Now the robot can keep a whole backpack of things under one name."

## Dropped

- **Aliasing step drops the story for bare a/b** — `v2-lists`. The bare `a = [1, 2]; b = a; a.append(3)` card is a deliberate read-and-predict code card. It keeps the aliasing question free of story noise, in the style of the Reading collection. The story version follows straight away in Step 16 (`bag = backpack`), so the suggested `mira = hotbar` would duplicate it. It would also put a variable in Mira's name, against C2. The `a` from Step 1 was only the crow's dashed demonstration memory, never the learner's, so nothing is lost by reusing the name.
- **`2 * 5` called a sum** — `v2-bind`. The game uses "sum" throughout to mean any piece of arithmetic, in the British way ("do your sums"). operations.ts calls seven crates of six bolts (a multiplication) "a sum", and order.ts says "Now type the sum on its own". "Product" is never taught, so no word the learner has just learned is blurred. Changing it to "the working" here alone would make this nudge disagree with the rest of the game.
- **Step 5 praise may clip its last sentence** — `v2-bind`. This was a timing artifact. 05-00-praise.png was taken mid-typing (Next is still disabled). In the live page, after the typing finishes (vb-5praise.png), the bubble shows the whole praise, ending "`a` didn't move.", with nothing clipped.
- **IndexError named but possibly never shown** — `v2-lists`. The storyboard shot 02-04-beat.png while `hotbar[3]` was still being typed, and the next beat was listed against that same shot. In the live page the line is submitted: by the end of the "There's no index `3`" beat (vl/s2-4-b.png), and from the very start of the "Asking for an index that isn't there…" beat (vl/s2-5-a.png), the console shows `hotbar[3]` followed by an IndexError. That comes from `stops: 'IndexError'` at lists.ts:191.
