# Review: `v2-logic`, `v2-if` and `v2-loops` (Lessons 6–8), 2026-10-02

**Fixed** 2026-10-02: all 33 kept findings.

The Deciding unit, run with the `review-lessons` workflow. Seed 1 storyboards; scripts for seeds 1–3. 45 findings → 35 clusters → **33 kept, 2 dropped**. Cost in [LESSON-REVIEW-COST.md](../LESSON-REVIEW-COST.md).

## Kept

1. **The rope bridge changes its rule between Steps 9 and 16, and HP is used as weight** — `v2-logic`, high (keep-with-changes; from story-1, teacher-5).
   > The bridge holds anyone with a rope, or under 60 HP. Ask the robot if I can cross.
   At Step 9 the bridge needs a rope or more than 50 HP and Mira is refused. At Step 16 the same bridge holds anyone under 60 HP and she gets across. The rule flips with no reason given, and HP as a weight limit makes no sense (v2-if uses `weight` for its bridge).
   *Verified:* Confirmed in the source. Step 9 (logic.ts:324) has the bridge guard want a rope or more than 50 HP, so 30 HP is refused. Step 16 (logic.ts:482-486, limit picked from 40/50/60) says the same bridge holds anyone under the limit, so 30 HP gets across. Same bridge, opposite direction, no reason given, and in Step 16 HP is plainly being used as weight. A child who just worked out that Mira cannot cross will be confused.
   *Fix:* Keep Step 9's rule direction. In Step 16, give a reason the rule eases while keeping `hp >` (e.g. the guard adds a second rope rail: now more than 25 HP will do, `"rope" in backpack or hp > 25`). Pick limits below 30 so the `or` still comes out True on the HP side, and change `done`/`model`/`nudge`/`praise` to the `>` shape. Don't use `hp <` as a weight limit anywhere.

2. **The `and` example gives away its own question, and uses an unexplained `coins > 50`** — `v2-logic`, high (keep-with-changes; from story-10, pictures:v2-logic-2).
   > `hp > 20` is `True`, `coins > 50` is `False`. Not both: `False`.
   The crow works `hp > 20 and coins > 50` all the way to False, then asks what it makes, so the question is already answered. The picture shows '= ?' while the crow says False, and `coins > 50` has nothing to do with the gate in the story.
   *Verified:* Confirmed. Step 7's beats (logic.ts:298-299) work `hp > 20 and coins > 50` all the way to False ('Not both: `False`'), then the ask (logic.ts:301) asks what that same expression makes. Storyboard 07-04-beat-stage.png shows the crow saying False beside a picture reading '= ?'. `coins > 50` has no part in the gate story (the gate is HP and a torch).
   *Fix:* Work `and` on a different pair from the story (e.g. `hp > 20 and has_key`: True and False, then False), with the expr picture ending on its answer, not '= ?'. Then ask about `hp > 20 and coins > 50`, giving `coins > 50` a reason (e.g. a 50-coin toll) or using another card-based pair, and keep that working hidden until the pick. Step 8's gate (`hp > 20 and "torch" in backpack`) stays the typed question.

3. **`broke = coins = 0` overwrites the coins, and the reply leaves the learner stuck** — `v2-logic`, high (keep-with-changes; from teacher-1).
   > Point `broke` at the robot's answer: `broke = coins == 0`.
   The chained assignment is legal and sets `coins` to 0. After it, the advised line makes `broke` True, but the step wants False. The learner gets the same reply on every try.
   *Verified:* In logic.ts, keepStep for `broke`: `broke = coins = 0` passes the shape regex but leaves broke at 0, so done fails. The nudge then takes the `l.ok && !l.thought` branch: "Point `broke` at the robot's answer: `broke = coins == 0`". Typing that now gives True, because coins is 0, so done fails again and the same reply comes back. Undo and Wipe are on screen (12-00-praise.png), but no reply tells the learner to use them or that coins changed, so this is a loop. Two `=` signs where `==` was meant is exactly the slip this lesson is about. It only hits the one seed in three that draws `broke`.
   *Fix:* In keepStep's nudge, before the generic branch, catch a chained assignment (`^\s*<name>\s*=\s*[A-Za-z_]\w*\s*=(?!=)`) and name what it did: "Two single `=` signs pointed `coins` at `0` too. Undo that line, and ask with `==`: `broke = coins == 0`." Do not judge against coins' value at the time: the step's answer is fixed at False, and accepting True would teach the wrong thing.

4. **Praise picture shows a stale True chip while the crow says False** — `v2-logic`, high (keep; from pictures:v2-logic-1).
   > `rich` points at `False`, because 12 isn't more than 100. The robot asked, and kept the answer.
   The status panel shows the previous thought (True), and the bound row still reads '?'. This breaks invariant 26.
   *Verified:* Confirmed in 12-00-praise.png: the crow says `rich` points at `False` while the hud's answer chip reads True and the `rich` row still reads `?`. Cause: `rich = coins > 100` has no thought, and logic is an unordered lesson. answerTo (core.ts:639-643) returns `evidence.thoughts[thoughts.length - 1]`, which is the earlier `not has_key` True, and staging passes it to the praise picture. That breaks invariant 26: the picture contradicts the crow, and a thought from a previous step is drawn as this step's answer. Every seed's quiz keepStep has the same shape.
   *Fix:* In staging/answerTo, never use a thought older than the step's start for its praise, so a binding line draws no stale chip. For a step that binds a name, draw the answer from that name's object in the snapshot: fill the hud row (`rich` → `False`) from memory, or set the answer to that object's bool.

5. **The stage answers the question before it is asked (lamps already labelled, reductions already shown)** — `v2-logic`, high (keep-with-changes; from pictures:v2-logic-3, pictures:v2-logic-5).
   > Each side is asked first, then `or` puts them together.
   The gate lamps show True/False for each side before the robot is asked, and the `or` reduction is drawn almost to the end before the question, so the learner reads the answer off the stage.
   *Verified:* Confirmed, and it is wider than the cluster says. Step 9 (logic.ts:325-326) draws both `or` lamps dark and labelled False (09-02-beat-stage.png), then runs the reduction of the very expression asked, through `False or False` to `False` (09-03-beat-stage.png), and only then asks 'What does `"rope" in backpack or hp > 50` make?'. Step 7 does the same thing with `and`: its beats 3-4 reduce `hp > 20 and coins > 50` and the crow says 'Not both: `False`' (07-04-beat-stage.png) right before asking what it makes. The lamps also answer the gate steps ahead of time: step 8 shows both lit True under 'Will the gate open?' (08-01-ask.png), step 16 shows hp < 60 lit True (16-01-ask.png), and in the quiz step 17, where the player answers, coins > 6 is lit True and has_key dark (17-01-ask.png, logic.ts:473 builds the lamps from the answers).
   *Fix:* Build the gate with its lamps unlit and marked '?' while a step is asking, and light them from the robot's answer, or from the praise once the player has picked. Work the `and`/`or` reductions in steps 7 and 9 on a different expression (for example `coins > 5 and hp > 50`), or move the reduction into the praise. Cut the crow's 'Not both: `False`' line from step 7, because it says the answer to that step's own question out loud.

6. **Stale memory from the last run sits beside a demo program or a prediction question** — `v2-if`, high (keep; from pictures:v2-if-1, pictures:v2-if-2, pictures:v2-if-3).
   > After this program runs, what's in the robot's memory?
   Memory still shows the learner's earlier run (names, and even wrong option values) beside a new program that hasn't run yet. That contradicts "each Run starts from empty" and gives misleading answers. The fork picture also stays on its earlier answer.
   *Verified:* Confirmed in the storyboard. At 02-09-ask, the question 'what's in the robot's memory?' about `hp = 20 / if hp > 50` sits next to memory still holding the learner's Step 1 torch=True, steps=3. At 06-09-ask, memory shows hp→20 and action→'run' from the learner's Step 5 program, next to a question whose options include "run". That is a misleading hint, and it contradicts 'Each Run starts from an empty memory'. At 06-08-beat ('Now say hp were 80') the fork picture still has the robot on the ticked 'drink' row from the run before. Workbench only shows demo memory up to the ask (memoryAt loop stops at 'ask'), so it falls back to the player's last run.
   *Fix:* While the crow's program is on show for a prediction question (from the beat that puts it up, through the ask), show an empty memory marked as the crow's 'not run yet' rather than the player's last run. Don't show the crow's real run, which would give the answer away. Reset the fork picture to unanswered on the beat that changes the program (06-08).

7. **The `in` example asks about a key that the card (`has_key`) already answers** — `v2-logic`, medium (keep-with-changes; from story-3, teacher-3, pictures:v2-logic-8).
   > Did I pack a key at all? I can't remember where it would be.
   `has_key = False` is in memory and on the status panel, so the learner already knows the answer, and there are now two different 'keys' that could disagree. A typed `has_key` reads as a fair answer but gets nothing written for it. The key can also clash with v2-lists' seed.
   *Verified:* Confirmed. Step 6 (logic.ts:278-292) has Mira ask 'Did I pack a key at all?' while the status panel and memory both show has_key False, so the answer is already on screen, and two 'keys' (the flag and a list item) could disagree. Worse, a typed `has_key` (a fair answer) is a bool whose source doesn't mention `backpack`, so askMiss (logic.ts:107-108) replies 'Ask about the name, `backpack`, not the number', which is wrong because there is no number. The proposed fix collides: the Step 6 beats already demonstrate `"rope" in backpack` (logic.ts:280), and the Step 14 quiz picks torch or rope (logic.ts:439-450).
   *Fix:* Ask `in` about something the card doesn't record and the beats don't demonstrate. Keep the torch demo, drop the rope demo beat (or demo with 'map'), and ask Mira's 'Did I pack a rope? The bridge ahead might need one' as `"rope" in backpack` (which also sets up Step 9). Change the Step 14 quiz to items other than rope (e.g. map/food). Show the backpack picture at this step, not the HUD with has_key.

8. **The rule behind `not` has no reason, and Mira says so** — `v2-logic`, medium (keep-with-changes; from story-5).
   > Some caves are only for explorers *without* a key. Funny rule!
   A rule the story itself calls odd leaves `not` attached to a made-up need.
   *Verified:* Confirmed (logic.ts:338): 'Some caves are only for explorers *without* a key. Funny rule!' The story itself admits the rule has no reason, so `not` is attached to a made-up need. The suggested fix (offer to unlock the gate) doesn't fit, because the gate already opened at Step 8.
   *Fix:* Give `not` a need that comes after the gate, e.g. a locksmith in the cave: 'I cut keys, but only for explorers who don't have one yet.' Ask the robot whether Mira is without a key: `not has_key`. The step's test and model stay as they are.

9. **Says both sides of `and`/`or` are always asked (wrong: short-circuit)** — `v2-logic`, medium (keep-with-changes; from teacher-4).
   > The robot asks each side first, then puts the answers together.
   Python asks the right side only when the left side doesn't settle the answer. Learners will have to unlearn this later.
   *Verified:* logic.ts step 7, beat 3: "The robot asks each side first, then puts the answers together." Step 9 says the same about `or`. As general rules both are false, because Python short-circuits. The two examples happen to need both sides (left True under `and`, left False under `or`), so the demonstration is accurate and only the general sentence is wrong. Later code like `x != 0 and 10 / x > 1` depends on short-circuiting, so this is something the learner would have to unlearn.
   *Fix:* Tie the sentence to the example: "The robot asks the left side first: `hp > 20` is `True`. That doesn't settle it, so it asks `coins > 50` too." For `or`: "`"rope" in backpack` is `False`, so `or` still needs the right side: it asks `hp > 50`." Keep the `expr` working demo as it is.

10. **`in` in `for` does a different job from `in` the question, and nothing says so** — `v2-loops`, medium (keep; from teacher-8).
   > `for thing in cave:` is a header with a colon and a block, like an `if`.
   The lesson before taught `in` as a yes/no question, so a learner can read the loop header as a question.
   *Verified:* The lesson just before teaches `in` as a question: "`in` asks *is it anywhere in the list?*" with `"torch" in backpack` (v2-logic.md:164-171). Here the crow says "`for thing in cave:` is a header with a colon and a block, like an `if`" (loops.ts:159). An `if` header, with the same `in`, invites reading it as "if thing in cave". The pass beats do show `thing` moving item to item, but nothing says this `in` is not the question.
   *Fix:* Add a short beat after the header beat: "Here `in` isn't a question. It hands `thing` each item in `cave`, one per pass."

11. **The `>=` demo answers the question that follows it** — `v2-logic`, medium (keep-with-changes; from pictures:v2-logic-4).
   > Mira has exactly 30 HP. Which question lets her in?
   The beats just before already said `hp >= 30` is True and `hp > 30` is False.
   *Verified:* Confirmed. In step 5 the robot types `hp >= 30` → True and `hp > 30` → False in the beats (logic.ts:264-265, 05-02-beat.png, 05-03-beat.png). Then the step asks 'Mira has exactly 30 HP. Which question lets her in?' with options `hp >= 30`, `hp > 30` and `hp < 30` (logic.ts:160-167). The player only has to match the option to the beat they just heard. A different threshold would no longer show the boundary, though, and the boundary is the whole point of this step.
   *Fix:* Keep the boundary but move it to a different name: have the robot demonstrate `coins >= 12` (True) and `coins > 12` (False) on Mira's 12 coins, so choosing `hp >= 30` for exactly 30 HP needs the idea carried across instead of copied.

12. **Signs, the bridge and the guard are never drawn; the bridge is shown as the gate** — `v2-logic`, medium (keep-with-changes; from pictures:v2-logic-6).
   > A rope bridge! A guard says: you need a rope, *or* more than 50 HP.
   Things the lines name are missing from the stage, and the bridge rule is drawn on the cave gate picture.
   *Verified:* Confirmed for the bridge. Mira says 'A rope bridge! A guard says…' (logic.ts:324) over an empty stage (09-01-beat-stage.png), and the next beat draws the rule as the cave gate's lamp panel with a portcullis (09-02-beat-stage.png). The quiz bridge step does the same, 'The bridge holds anyone…' over a gate (logic.ts:485-486, 16-01-ask.png). The two signs in steps 2 and 5 are a small point, because the HUD shows the hp the sign is about, so the bridge is the real mismatch. Drawing a new bridge prop costs far more than this needs.
   *Fix:* Rename the bridge to a gate in the lines, to match what is drawn: step 9 'Another gate! This one opens for a rope, *or* more than 50 HP.', and in the quiz 'This gate opens for anyone with a rope, or under N HP. Ask the robot if I can get through.' The alternative is to give the gate prop a label, and draw a bridge only if one is wanted for the story.

13. **The card cuts off `"Torch" == "torch"`** — `v2-logic`, medium (keep-with-changes; from pictures:v2-logic-7).
   > What does `"Torch" == "torch"` make?
   The card truncates the very word being compared.
   *Verified:* Confirmed. The step uses `show: { kind: 'value', text: sameText }` (logic.ts:417), and that fixed-size card cuts the text to `"Torch" == "tor…` (13-01-ask.png, 14-00-praise.png), so the half of the comparison that holds the small t is hidden. The speech bubble does show the full expression, which lowers the cost. Highlighting the T/t difference would point straight at the answer, so the fix should not do that.
   *Fix:* Draw the expression on the code card the other 'What does it make?' steps use (the `"rope" in backpack or hp > 50` card in 09-04-ask.png), or make the value card fit its text. Do not highlight the T/t difference.

14. **Praise is said beside the learner's old program instead of the crow's** — `v2-if`, medium (keep; from pictures:v2-if-4).
   > `hp > 50` is `False`, so the block is skipped: only `hp` is made.
   After the pick, the editor and memory go back to the learner's last program, so the explanation sits beside unrelated code.
   *Verified:* Confirmed. At 03-00-praise the crow says '`hp > 50` is `False`, so the block is skipped: only `hp` is made', but the editor shows the learner's `torch = True / steps = 3` and memory shows torch/steps. The codeAt loop in Workbench.tsx (~line 1119) only keeps the crow's code through the ask itself when it has choices, and breaks at the praise/reply line. The explanation ends up beside unrelated code at exactly the moment it explains a skipped line.
   *Fix:* Carry the multiple-choice step's code demo through its praise and miss replies, and then run it, showing the whole run with line 3 dimmed and memory holding only hp→20, so the praise points at what it describes. Hand the player's program back on the next step.

15. **Praise and questions sit beside the learner's old program and stale memory** — `v2-loops`, medium (keep; from pictures:v2-loops-1, pictures:v2-loops-2).
   > What does `total` point at when this loop ends?
   After a pick the editor goes back to the learner's program, and while the crow shows a program it doesn't run, memory still holds unrelated names.
   *Verified:* 02-08-ask.png: the editor shows the crow's RESET program (coins/total), but memory still holds the learner's Step 1 names `cave`, `bag` and `thing`, with no `total` anywhere, under "What does `total` point at". 03-00-praise.png: the praise about `total = 0` sits beside the learner's cave/bag program. 08-00-praise.png: the praise about hp 40/60/80 sits beside the gems/count program and its memory. The picture doesn't agree with what the crow says.
   *Fix:* Keep the crow's program, and its memory, on screen through that step's praise. For a crow's program shown but not run, empty memory or mark it 'not run yet' rather than leaving the learner's last run there.

16. **The gems carry no values and no pass is marked** — `v2-loops`, medium (keep-with-changes; from pictures:v2-loops-4).
   > Only the big gems are worth carrying: more than 4.
   Identical gems with no numbers, so the `if` on each pass is told but never drawn.
   *Verified:* Confirmed in 06-01-beat-stage.png and 06-04-beat.png: three identical 'gem' hotbar cells labelled 0/1/2 and no values. Every pass beat (06-02..06-06) has no `show`, so the floor stays as it is while the crow says `7 > 4`, `2 > 4` is False, and so on, and nothing marks which gem is being asked about. The values and the choice are only in the code and the memory panel. The whole point of the `if` (some gems kept, some skipped) never appears in the scene.
   *Fix:* Draw the gems with their values using the existing tally picture (`item: 'gem'`, values [7, 2, 9]), with `mark` set to 0, 1 and 2 on the pass beats so the pointer walks the gems. Add a kept or skipped mark per gem (tick or cross) as a small extension to tally, or put a `big` row under it that gains 7 and then 9. Drawing the same gem picture at the `count` ask, with `label: 'count'`, ties the ask to the example.

17. **No door, campfire or HP bar on stage while the loops run** — `v2-loops`, medium (keep-with-changes; from pictures:v2-loops-5, pictures:v2-loops-6).
   > A door with a sign: "Knock three times."
   The story's objects are missing just when they are introduced, and the stage plays no part in the loop.
   *Verified:* Confirmed in 04-03-beat.png and 07-03-beat.png: the knock beats and the campfire beats have no `show` in loops.ts (Step 4's and Step 7's beats), so the stage is empty apart from the scenery arch, which is in every shot and has no sign. Nothing in the scene changes from pass to pass, even though the file header promises 'the stage marking the item and the total (R6)'. The door only appears at the next step's ask, as a hud.
   *Fix:* Use the hud picture that already exists instead of drawing new art. Show `{ kind: 'hud', title: 'Door', stats: [{ name: 'knocks', value }] }` on the knock beats with value 0, 1, 2, 3 per pass, and `{ kind: 'hud', title: 'Campfire', stats: [{ name: 'hp', value }] }` on the while beats (70, 80, 100), with the hp going down on the never-ending example. Hud values are already narration (sameProp keeps the panel on stage), so each pass plays on the same picture. A door or campfire drawing is optional on top of that.

18. **The route through the cave is out of order** — `v2-logic`, low (keep-with-changes; from story-2).
   > Deeper in, another sign: 30 HP *or more*.
   Step 5 is already "deeper in", yet the gate only opens at Step 8, and the outro says "Into the cave!" as if they never went in.
   *Verified:* Confirmed. Step 5 (logic.ts:263) says 'Deeper in, another sign' before the gate even opens at Step 8. The bridge (Step 9) and the cave rule (Step 10) come after. Then the outro (logic.ts:542) says 'Into the cave!' as if nobody went in, and the backdrop stays the trailhead the whole time. The order is muddled, but it doesn't block any learning, so low rather than medium.
   *Fix:* Step 5: 'There's a second sign on the gate post: 30 HP *or more*.' Outro: 'Through the gate, and into the cave!' Or set the bridge 'just past the gate'.

19. **The backpack from v2-lists is quietly emptied** — `v2-logic`, low (keep; from story-4).
   > Here's your explorer card: HP, coins, a key, and your backpack.
   v2-lists ended with a fuller backpack, with the torch at index 2. This lesson opens with only a map and a torch (torch at index 1), and nothing explains why.
   *Verified:* Confirmed. In the roadmap, v2-lists comes directly before v2-logic (roadmap.ts:91,99). v2-lists ends with the backpack holding map, the second item (or gem), torch at index 2 and a snack (lists.ts:315-319). v2-logic wipes memory and starts with ['map', 'torch'] (logic.ts:66), torch at index 1, with no word about why. It's minor, but a careful child will notice the torch moved.
   *Fix:* Add a line to the Step 1 beats, e.g. Mira: 'I left the snacks and the gem at camp. Just the map and the torch for the cave.'

20. **Lanterns cost 8 coins here but cost 20 in v2-logic; the map-only rule has no reason** — `v2-if`, low (keep-with-changes; from story-6).
   > The cave shop sells lanterns for 8 coins, only to explorers with a map.
   The price changes from the lesson before without a word, and a shop that sells only to people with a map has no reason a kid would guess.
   *Verified:* Confirmed. v2-logic (played just before, content/roadmap.ts:99) prices the lantern at 15/20/25 (logic.ts:382) and ends 'No lantern yet' because Mira has 12. v2-if prices it at 5/8/10 (ifs.ts:438), so the item she could not afford is now cheap, and nothing says why. 'Only to explorers with a map' (ifs.ts:447) gives no reason either. It is low because it is a different lesson and a different shop, but a kid who remembers the lesson before will notice.
   *Fix:* Have Mira say why it is cheaper (e.g. 'Down here lanterns are cheaper: only N coins!'), or sell something else. Give the map rule a reason in one clause (e.g. 'they only sell to explorers with a map, so you can find your way back'). Keep the and-condition, since the step teaches `and`.

21. **A troll fight that never happened, and HP numbers that don't match** — `v2-loops`, low (keep-with-changes; from story-7).
   > Ouch, that troll! Let's rest by a campfire until I'm back to 100 HP.
   Mira never fought the troll in v2-if, and her HP was 30 earlier, yet here she starts at 70 with full at 100.
   *Verified:* In v2-if the troll ends in `action = "drink"` (v2-if.md:257-318, ifs.ts:114, 267). Mira had hp 30 and drank a potion; she never fought. loops.ts:270 still opens with "Ouch, that troll!" and HEAL starts at hp = 70, which nothing explains. The 'full is 100' half doesn't hold up: "until I'm back to 100 HP" already says 100 is full, and the outro says "HP back to full". So this is a small continuity slip, not medium.
   *Fix:* Make Mira's line agree with v2-if, e.g. "That potion only got me to 70 HP. Let's rest by a campfire until I'm back to 100." Leave the 100 cap as it is.

22. **One coin in the treasure becomes three** — `v2-loops`, low (keep; from story-8).
   > How much is it all worth? Let's add up these coins.
   The treasure was a gem, a coin and a key, but three coins are then added up, and "it all" suggests the gem and key count too.
   *Verified:* Step 1 names one gem, one coin and one key (loops.ts:156). Step 2 then says "How much is it all worth? Let's add up these coins" (loops.ts:184) over three coins worth 3, 5 and 2 (02-08-ask.png shows three coins). "It all" points back at the gem and key, and the three coins appear from nowhere. It's minor, but it's a real slip.
   *Fix:* Bring the coins in as their own find: "And a pile of coins! How much are they worth? Let's add them up."

23. **The knocking door: same door suddenly wants 10, and the loop just makes a number the learner already knows** — `v2-loops`, low (keep-with-changes; from story-9, teacher-9).
   > The door wants 10 knocks. Make `knocks` count them, with `range`.
   The same door asked for three knocks one step earlier. A loop that counts to 10 also does what `knocks = 10` does in one line, so `range` looks pointless.
   *Verified:* The continuity half holds. Step 4's door says "Knock three times." (loops.ts:215), and Step 5, with nothing new in the story, says "The door wants 10 knocks" (loops.ts:230). The 'range looks pointless' half doesn't: doing something a number of times is exactly what this lesson teaches ("a number of times", header line 8). The judge requires a `for ... in range(` loop (loops.ts:237), so `knocks = 10` alone isn't accepted, and the counter is what shows the passes in memory. Rebuilding the step around appending each `i` would be scope creep.
   *Fix:* Make it a second door: "Another door, and this one wants 10 knocks. Make `knocks` count them, with `range`." Keep the counting task.

24. **The climbing fix is judged on a step size the ask never states** — `v2-loops`, low (keep-with-changes; from teacher-2).
   > This loop should climb until `height` is at least 50. The robot never finishes it. Fix it!
   A fix that steps by 5 or 20 meets the ask but is refused, because the cases expect steps of 10.
   *Verified:* The cases expect steps of 10: 10 becomes 50 and 45 becomes 55 (loops.ts:360-365). So `height + 5` (45 ends at 50) and `height + 20` (45 ends at 65) both meet "at least 50" and are refused. The cases picture partly makes up for it: it says 'With height = 45, height should be 55' (v2-loops.md:595), and flipping `-` to `+` is the natural repair. It's still a judge that's stricter than its ask, and only seeds whose fix exercise is the climbing loop meet it. So low, not medium.
   *Fix:* State the step in the ask: "This loop should climb 10 at a time until `height` is at least 50. The robot never finishes it. Fix it!" That's simpler than loosening the judge, and it agrees with the cases picture.

25. **Reply to a one-`=` slip says the backpack changed when it didn't** — `v2-logic`, low (keep-with-changes; from teacher-6).
   > One `=` pointed that slot at something: it asked nothing, and changed the backpack. Undo that line, and ask with `==`.
   The slot already pointed at that value, so memory shows no change and the reply contradicts the screen. Step 3's option reply has the same problem.
   *Verified:* In step 4, the slip the learner is most likely to type is `backpack[1] = "torch"`, and slot 1 already points at "torch". Value objects are keyed by type+value (invariant 4), so the memory graph shows no change, yet the reply says "changed the backpack". The same claim appears in the `asks` nudge ("changes the backpack" for `backpack[0] = "map"`, which is already true) and in step 3, beat 4 ("it changes, and asks nothing"). Telling an unchanged screen that it changed breaks the rule that what is seen must agree with what the crow says. It is low because nothing is lost and Undo is harmless.
   *Fix:* Step 4 reply: "One `=` tells, and asks nothing: it pointed that slot at `"torch"`, where it already pointed. To ask, use two: `backpack[1] == "torch"`." Reword the `asks` nudge and step 3, beat 4 the same way, e.g. "One `=` points the slot at `"map"`: it tells, and asks nothing." Drop "changes the backpack".

26. **A typed `True` at the gate gets the "asks one thing" reply** — `v2-logic`, low (keep; from teacher-7).
   > That asks one thing. Join both questions with `and`: `hp > 20 and "torch" in backpack`.
   A literal `True` is the learner's own answer, not a question, but it gets advice meant for a one-sided question.
   *Verified:* In step 8's nudge, a typed `True` has `thought.type === 'bool'` and no `and`, so it gets "That asks one thing. Join both questions with `and`" before the literal check in askMiss can run. That is wrong advice: the learner asked nothing. quiz orStep has the same ordering problem ("Ask both, joined with `or`").
   *Fix:* In step 8 and in orStep, return askMiss's literal True/False reply first, e.g. `if (/^\s*(True|False|true|false)\s*$/.test(l.source)) return askMiss(...)(l)`, before the and/or checks.

27. **`!=` is shown once and never practised** — `v2-logic`, low (keep-with-changes; from teacher-10).
   > And `!=` asks the opposite: *is it different?*
   Every other operator gets an ask; `!=` appears only in one demonstration beat.
   *Verified:* `!=` appears only in a demonstration beat (step 4's first beat). No teach step and no quiz variant asks for it, and v2/ifs.ts does not use it either (grep found none). `<=` is also introduced in a beat, but the quiz's edgeStep sometimes asks it, so `!=` is the only operator the learner never uses. It is a coverage gap rather than an error, and the takeaway does not promise it.
   *Fix:* Add a `!=` variant to the quiz's sameStep, e.g. `"map" != "torch"` (True) with a nudge that `!=` asks *is it different?*. That is cheaper than a new step.

28. **Reduction runs into the robot; praise pictures shrink until unreadable** — `v2-logic`, low (keep-with-changes; from pictures:v2-logic-10).
   > Each side is asked first, then `or` puts them together.
   The reduction text is cut off by the cast, and the praise pictures are too small to read.
   *Verified:* The overlap is real: in 09-03-beat-stage.png the top line of the reduction is cut to '"rope" in backpack or hp > 5' where it runs under the robot. The shrinking is how a right answer's picture is meant to leave (invariant 26), and in the live page it stays that small at rest (checked on step 6's praise: the HUD sits small between the crow and the robot). It can still be read there, but the praise gate in 17-00-praise.png and 07-00-praise.png is tiny and its labels cannot be read. The praise says the result in words, so the player loses little.
   *Fix:* Fit the expression picture to the width between the crow and the robot: wrap or scale it down, or stack it above the cast. Give the praise (leaving) state a minimum size, so the gate's labels can still be read.

29. **The troll, bridge, gate and shop are never on stage** — `v2-if`, low (keep; from pictures:v2-if-5).
   > A troll! Fight it if you're strong. If not, drink a potion if you have one. Or run!
   The lesson's set pieces are told but never shown.
   *Verified:* Confirmed. At 06-01-beat-stage, 'A troll!' plays on an empty cave stage with only the usual cast. The bridge (10-02), toll gate (11-01) and shop (14-01) show only the case table or fork picture. It is flavour, and the fork props do carry the meaning, so it is low.
   *Fix:* Add a small prop as each encounter is named (troll, bridge, gate, shop stall), or tone the lines down so they don't announce a creature that never appears (e.g. 'A troll is ahead…' while the fork shows the choice).

30. **Want values in the case table shrink to fit their column** — `v2-if`, low (keep; from pictures:v2-if-6).
   > Set `plan` to `"buy"` or `"leave"`.
   'leave' and 'shiny' are drawn much smaller than the values beside them.
   *Verified:* Confirmed. At 14-01-ask, 'leave' in the WANT column is drawn noticeably smaller than 'buy'. At 10-02-ask, 'cross' is smaller than 'wait'. Values are shrunk to fit a fixed column, so equal kinds of answer look unequal.
   *Fix:* Size the WANT/GOT columns to the longest value across the cases (or let them grow) and draw every value at one font size.

31. **Options can be clicked while the demo program is still being typed (timing, to verify)** — `v2-if`, low (keep-with-changes; from pictures:v2-if-7).
   > With `hp` at 80 and one potion, what does `action` point at?
   The ask shows while the program is half-written.
   *Verified:* Confirmed live (scratchpad/unit3/c30.mjs, seed 1, step 2). After Next on 'Read this one.', the ask's three options were already enabled at t=0 while the editor read 'hp = 20\ni'. The program finished typing about 1.3s later. Workbench computes codeWaiting but gates only the demo run on it (line ~1163), not the Options. It is worse at 06-08/06-09. Changing only 30→80 gives typeFrom = the common prefix 'hp = ', so the whole 8-line program is typed again (06-09 shows 'act' still typing at the ask).
   *Fix:* Hold the options (or disable them) until the crow's program has finished typing (codeWaiting false). Also, when a beat changes only part of the program, edit just that part in place instead of retyping everything after the first difference, so 'Now say hp were 80' changes one number.

32. **The total box stays empty after a right answer** — `v2-loops`, low (keep-with-changes; from pictures:v2-loops-3).
   > One coin a pass: 4 + 1 + 4 is `9`.
   The picture never shows the total the crow says.
   *Verified:* Confirmed in 10-00-praise.png: the crow says 4 + 1 + 4 is `9` while the `total` box under the coins stays empty and dashed. In loops.ts p1 the show is `tally(vals, undefined, null)`, and `tallyShows` (src/scene/props.ts:1378) fills the counter only from a number the robot thought of. A multiple-choice pick is not a thought, so a right pick never reaches the box. The same gap shows at 03-00-praise.png, where Step 2's `2` is never drawn either.
   *Fix:* Have staging treat a right pick on a choice step whose picture is a tally as that tally's answer, so the counter fills while the praise is read (9 in the practice step, 2 in the reset step). If staging stays as it is, drawing the praise with `total` set to the answer in loops.ts does the same job. Apply it to both choice steps that use a tally, not only the practice one.

33. **Long case rows are drawn tiny** — `v2-loops`, low (keep; from pictures:v2-loops-7).
   > A magic pool makes every coin worth 2 times as much! Put each coin's new value into `magic`.
   The longer rows shrink until the target values are hard to read.
   *Verified:* Confirmed in 12-01-ask.png: the first case row's `coins = [1, 4, 5]` and its want `[2, 8, 10]` are drawn in a tiny font. The second row's `coins = [3]` and `[6]` are at full size, so the rows are not the same size. The want column is the target the player has to hit, so the shrink lands on the most important text, though the run still judges it either way.
   *Fix:* Size every row of the cases scoreboard the same, to fit the longest row (or widen the card, or wrap the given onto two lines), so no single row shrinks on its own.

## Dropped

- **"Slot by slot" is said over a picture with no slots** — `v2-logic`. There is something to watch. The HUD's backpack row lights up and shows the map and torch in order (06-03-beat.png), and the memory panel next to it, which is always on screen, lights `backpack` and its list with slots 0 and 1 drawn as labelled arrows. 'Slot by slot' matches what memory shows, and the praise uses 'every slot' the same way. Lighting each pocket in turn would be a nice extra, but nothing in the lesson is wrong without it.
- **The demo's `can_enter` may never appear in memory (timing, to verify)** — `v2-logic`. The storyboard never photographed this beat: index.md lists it as '(same screen as 11-01-beat.png)', and 11-01 was taken while the line was still being typed. So the gap is in the storyboard, not in the lesson. In the live page (scratchpad/unit3/c25.mjs, shot c25-2-1000.png), once Next lands on 'It asks the question once, and points can_enter at the answer: True', memory shows `can_enter -> bool True`, outlined and lit, and the line sits in the console. It stays on screen for the whole beat (it was still there in the 300 ms, 1 s, 2.5 s and 4.5 s checks). logic.ts:352-353 gives both beats the demo memory with `can_enter`, so the source says the same.
