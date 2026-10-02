# Review: `v2-types` and `v2-ops` (Lessons 2–3), 2026-10-01

**Fixed** 2026-10-01: all 26 kept findings.

The rest of the Thinking unit, run with the `review-lessons` workflow (two text reviewers over both lessons, a picture checker per lesson, one merge, verification in batches of one lesson and at most six clusters). Seed 1 storyboards; scripts for seeds 1–3. 31 findings → 29 clusters → **26 kept, 3 dropped**. Cost in [LESSON-REVIEW-COST.md](../LESSON-REVIEW-COST.md).

## Kept

1. **Lower-case bool reply says 'nearly' even when the value is wrong** — `v2-types`, medium (keep-with-changes; from teacher-1).
   > Nearly — it needs a capital letter: `True`.
   The case-fix reply ignores which bool the step wants, so `true` for a shut door is told to type `True`, which is a second miss.
   *Verified:* `boolMiss` (core.ts:462) capitalises whatever was typed, so `true` on seed 2's "Shut the door" (types.ts:226) gets "Nearly — it needs a capital letter: `True`." The child types `True`, a valid bool, and boolMiss then falls through to `stopped` and says nothing, so the question just comes again (script seed 2 Step 11). The same gap means a plain `True` on the door, or `False` on the lamp, gets no reply. Old `types.ts:130` special-cased the lamp's `False`, and v2 dropped that.
   *Fix:* Give boolMiss the wanted value (`boolMiss(want)`). Right value in lower case: "Nearly — it needs a capital letter: `False`." Wrong value in lower case: "Shut is the robot's no, and it starts with a capital: `False`." Wrong value correctly typed: "`True` is yes, so the door stays open. Shut is `False`." (Lamp: "`False` is no, so the lamp stays dark. On is `True`.")

2. **Single vs double quotes switch without explanation** — `v2-ops`, medium (keep; from story-4, teacher-6).
   > Words join: `'3' + '3'` is `'33'`.
   Beats teach double quotes; quiz cards, options and model answers switch to single quotes, and Step 13 mixes both, with no word that the two mean the same.
   *Verified:* The beats type `"bot" + "gineer"` and `"7" + "7"`, but quiz question cards, praise and model answers go through render()/repr() (src/practice/python.ts:70), which uses single quotes. The `makes` labels convert options back to double. So step 13 of seed 1 asks about `'3' + '3'`, offers `"33"`, and praises `'33'`. The robot's own echo (thought `'botgineer'`) is single too. Nothing in v2-types or v2-ops says the two kinds of quote mean the same thing (grep of both scripts and types.ts).
   *Fix:* Use the proposed v2-types beat at the `"Mira"` → `'Mira'` echo ("The robot writes it with single quotes. Either kind works, as long as both ends match."); it is needed whatever else changes, because the robot's echo will always be single. In v2-ops, show cards, praise and the typed model in double quotes (a display renderer like `makes`' label), so only the robot's own echo is single.

3. **No reason given for letting the robot do the working** — `v2-ops`, medium (keep-with-changes; from story-2).
   > You write the sum; the robot does the working. So don't work it out yourself!
   The rule sounds arbitrary to a kid who knows 7 × 6, and clashes with v2-types praising a counted `4`.
   *Verified:* Step 1 beat 7 says "You write the sum; the robot does the working. So don't work it out yourself!" and gives no reason, and workMiss refuses a right number typed by hand. A kid who knows 7 × 6 is told no for being right, which feels arbitrary. The claimed clash with v2-types' counted `4` is weak, because that step was about the type of a value, not working one out. The proposed reason "The robot never slips" is not true to Python: float sums like `0.1 + 0.2` do slip, and later lessons may show it.
   *Fix:* Tie the reason to the story and the robot's new skill instead: "The robot is learning to work things out, so give it the sum, not the answer. Then it can do sums too big for your head."

4. **Takeaway says words and numbers don't mix at all** — `v2-ops`, medium (keep-with-changes; from teacher-2).
   > and words don't mix with numbers.
   Contradicts `"ha" * 3` and the quiz's word-times-number cases; only `+` fails.
   *Verified:* The takeaway (ops.ts, opsLesson.takeaway) ends "and words don't mix with numbers". The lesson's own beat says "a word times a number repeats it" (`"ha" * 3`). The quiz asks `'4' * 2` (a `str`, step 9 of seed 1) and `'ha' * n`, and the last typed step makes the player write `'ha' * 3`. So the last thing the lesson says contradicts what the player just did. Only `+`, `-` and `/` between a word and a number stop the robot.
   *Fix:* Shorter than the proposed line: "You write the sum and the robot works it out: `*` and `/` before `+` and `-`, brackets first. Words join with `+` and repeat with `*`, but a word plus a number stops the robot."

5. **Brackets step accepted without brackets, praise credits them** — `v2-ops`, medium (keep; from teacher-4).
   > `2 * (3 + 2)`: each box first, in brackets, then times the boxes.
   `workedOut` accepts `2*3 + 2*2` or `6 + 4`, so brackets are never needed and praise misdescribes the line.
   *Verified:* brackets() uses situation(), so done is workedOut(ev, want), which accepts any line that contains an operator and gives the right value (ops.ts hasOp/workedOut). `2*3 + 2*2`, `3+2+3+2` and `6 + 4` all pass, but the praise always says "each box first, in brackets, then times the boxes". The header calls this step "a chained situation that needs brackets", and it is the only quiz step on brackets, so the concept can be passed without being used and the praise misdescribes what the player typed.
   *Fix:* Choose the praise by form: if the accepted line has `(`, keep the current praise. If not, say "Right, `10`! Brackets say it shorter: `2 * (3 + 2)`, each box first." Do not refuse a correct distributive sum. If brackets must be shown, add a `why` reply only for the n*red+blue miss, as now.

6. **Word-times-word asked but never shown** — `v2-ops`, medium (keep; from teacher-5).
   > Both sides are words. A word can be repeated a number of times, but not a word of times.
   The `times-words` variant is asked before any beat shows it, and 'a word of times' is unclear English.
   *Verified:* rulePick's `times-words` variant asks `'4' * '2'`. The teaching beats show word + word, word * number, word + number, and say "It can't take away from words, or divide them, either", but never word * word. That breaks the lesson's own R1 ("each shown before it is asked", ops.ts header). The reply "not a word of times" is not clear English for a ten-year-old.
   *Fix:* Add it to the existing beat: "It can't take away from words, divide them, or times a word by a word, either." (under 110). Reply: "Both sides are words. `*` repeats a word a *number* of times, so the robot stops."

7. **Step 6 repeats Step 2's apple count in seed 1** — `v2-types`, medium (keep-with-changes; from pictures:v2-types-3).
   > How many apples are in the basket?
   Same basket of 4 and same question, with the earlier answer still in the console.
   *Verified:* In `situations`, `apples = 3 + floor(r()*6)` (types.ts:189) can draw 4, the teach step's count (types.ts:135). Seed 1 does, so Step 6 repeats Step 2 word for word, and `>>> 4` is still in the console (09-01-ask.png shows it). The same happens elsewhere: seed 3 Step 6 is "Turn the lamp on.", the same as Step 1 (script seed 3). The cluster only names apples; the fix has to cover the lamp too. The speed list already leaves out 36.5.
   *Fix:* Draw the quiz's apples from 3..8 without 4. Make the quiz's typed bool always ask something Step 1 did not: for the lamp, "The lamp is on. Turn it off." (`False`); for the door, "Shut the door."

8. **Overlapping apples make the count unreliable** — `v2-types`, medium (keep; from pictures:v2-types-4).
   > How many apples are in the basket?
   One apple is mostly hidden with no stem, so a child easily counts 3.
   *Verified:* Zoomed 02-05-ask.png and 06-01-ask.png: the basket holds 4 apples, but the bottom-left one (APPLE_AT[0] at 80,72) has its stalk and leaf painted over by apple 4 (90,58). That leaves three stalks and one bare red blob, so a child counting stems gets 3, and here the count is the answer. The cause is in src/ui/Props.tsx:618-705: the apples are painted in index order, so the back (higher) apples sit on top of the front ones. The same thing happens with 5 and 6 apples, which the quiz draws in some seeds (seed 2 step 7 has 6).
   *Fix:* In Basket (src/ui/Props.tsx), when the count is the question, give each apple its own fully visible place with its own stalk. Either set the 3 to 6 APPLE_AT places so no apple overlaps another's top, or at least paint the back row first (sort by y, descending) so every stalk stays on top. Check 4, 5 and 6 apples by eye.

9. **'7 left?' label doubts a praised answer** — `v2-ops`, medium (keep; from pictures:v2-ops-1).
   > `15 - 8` is 7: taken away.
   Props.tsx adds `left?` to every answer, so the right answer's picture shows a question mark.
   *Verified:* Confirmed in the source and on the board. src/ui/Props.tsx:1415 draws `${repr} left?` whenever there is an answer and it is not unworked, with no check for right or refused. Shot 07-00-praise.png shows "7 left?" over the bolts while Corvid says "`15 - 8` is 7: taken away." and the chip reads "7 int ✓", so the picture doubts an answer the crow is praising. That goes against invariant 26: what the player sees must agree with what the crow says.
   *Fix:* In Bolts, write `${repr} left` when the answer is right and keep the `?` only when `refusedOf(view)` is set (amber, dashed). Check the other labels (crates, share) for the same pattern while there.

10. **Phone shows clipped placeholder, not the number discussed** — `v2-types`, medium (keep-with-changes; from pictures:v2-types-6).
   > So is a phone number. It can start with `0`, and it has spaces.
   Phone shows clipped "type a numbe" while the crow describes the number.
   *Verified:* In 04-03-beat-stage.png, during 'So is a phone number. It can start with `0`...' and the next beat, the phone screen reads 'type a number'. Only the robot's cloud shows '0412 555 019'. Phone (Props.tsx:1720-1738) draws only `view.answer` and ignores the `number` the beat passes. In the ask (04-06, zoomed) the hint runs past the screen's edges. Worse, the hint says 'type a number' in the very step that teaches a phone number is words, not a number, and the ask itself never mentions quotes. So the picture pushes the child towards the unquoted miss the lesson is warning against.
   *Fix:* In the two phone beats, draw the beat's `number` on the screen as text, the way a typed str would draw it (for example a `demo` flag on the phone prop, so it stays a picture and is never evidence). In the ask, replace the hint with something short that fits the screen and does not say 'number', such as a blinking cursor or '…'.

11. **Robot thinks values nobody typed** — `v2-types`, low (keep-with-changes; from story-1).
   > Add two more, and the robot thinks `5`.
   v2-meet taught the robot thinks what is typed; here it thinks `5`, `2`, `False` etc. with nothing typed, breaking the rule.
   *Verified:* Correct. v2-meet teaches "It thinks of whatever it's told" and ends "you write it, and the robot thinks of it" (meet.ts:29,43). In v2-types only the first beat of each type has `types:` (types.ts:113,131,147,163). After that the robot thinks `5`, `2`, `False`, `48.5` and so on with an empty console (02-02-beat-stage.png). The header says this is deliberate (types the first of each). It is low because the crow is narrating a demonstration, but it does bend the one rule Lesson 1 taught.
   *Fix:* Have the crow say she is telling the robot, without typing every value: "I add two more, and tell the robot: `5`." "Take three away, and I tell it `2`. Always a whole number." Or add `types:` to each beat, if that does not slow the beats too much.

12. **'Write True on the sign' has no purpose and the sign already says it** — `v2-types`, low (keep-with-changes; from story-3, pictures:v2-types-2).
   > Write the word True on the sign, as words.
   No reason to want the word True on a sign, and the sign already shows True before the learner types, so the ask reads as a trick.
   *Verified:* Correct that the sign already reads True before the child types (09-01-ask.png). But that is how the note picture works: it shows the text and a '?' slot below for the robot's copy, the same way as Pip (Step 11) and the phone (Step 4). The real fault is the verb. "Write the word True on the sign" asks the child to write what is already written. The sign does not need a backstory; the point of the step is quotes against bool.
   *Fix:* Reword the line only (types.ts:338): "The sign says True, in words. Make the robot think of it as words too." Keep the caption "The word True, as words" and keep the picture as it is.

13. **Float defined by meaning (measured) instead of by the dot** — `v2-types`, low (keep-with-changes; from teacher-3).
   > Yes-or-no is a `bool`, counted is an `int`, measured is a `float`, and words in quotes are a `str`.
   Two rules for float; 'measured is a float' is contradicted by `8 / 2` → `4.0` in v2-ops and must be unlearned.
   *Verified:* Partly right. The lesson already makes the dot the rule: "Numbers with a dot are called *floats*" (types.ts:150) and "The dot makes it a float, even .0" (Step 5). "Measured" is still needed, because the situation questions ("Which type fits how fast the car is going?") are about choosing a type by meaning, so the proposed fix of dropping it would break those steps. What is untrue in Python is countMiss's "The dot means *measured*" (core.ts:476), together with the takeaway's "measured is a float". Both clash with v2-ops' `8 / 2` → `4.0` (ops.ts:180).
   *Fix:* Takeaway: "Yes-or-no is a `bool`, a whole number is an `int`, a number with a dot is a `float`, and words in quotes are a `str`." countMiss: "`7.0` has a dot, so it's a `float`. Apples are counted in whole numbers, no dot." Keep "measured" in the FITS replies for the situation questions.

14. **Previous pick's outline carries into the next choice** — `v2-types`, low (keep-with-changes; from pictures:v2-types-5).
   > What type is this?
   An option opens already outlined (the last pick), hinting right or wrong answers; may be focus left from the click.
   *Verified:* I checked this in the live page (scratchpad/unit1/c13.mjs, seed 1). After clicking `float` on step 7, step 8 opens with document.activeElement = body, and `choice-float` matches :hover but not :focus or :focus-visible. Moving the mouse away clears the ring (c13-a/c13-b crops). So it is not focus: it is the global `button:hover { border-color: var(--brand) }` (src/app/styles.css:159), which repaints the option's own coloured border as a blue ring that looks like a selection. With a mouse it only shows under the pointer. On a touchscreen, hover sticks after a tap, so the next question's option in the same place opens ringed. In 08-01 that is `float` for `False`, a wrong answer that looks picked. The proposed fix (clear focus) targets the wrong cause.
   *Fix:* In src/app/console.css, keep the option's own border on hover (`.stage .choice:hover:not([disabled]) { border-color: var(--c-line) }`, so only the lift shows hover). Put the choice hover rules inside `@media (hover: hover)` so a tap on a touchscreen leaves nothing behind on the next question.

15. **Reduction pictures stop short of the result the line names** — `v2-ops`, low (keep-with-changes; from pictures:v2-ops-2).
   > Two of the same kind go left to right: `10 - 2 - 3` is `5`.
   When the bubble finishes, the stage has not reached `5`, `20`, `14` or `hahaha`; possibly animation outlasting the typing.
   *Verified:* I confirmed this in the live page. On the `10 - 2 - 3` beat the bubble finished typing at about 1.2 s and Next was live by 1.8 s (ops-verify/leftright-1828.png still stops at `8 - 3`). The picture only came to rest on `5` at about 2.9 s (leftright-3026.png). `(2 + 3) * 4` behaved the same, typing done ~1.1 s and at rest ~3.0 s. The cause is props.css `.expr.working`, which lays the stages out at `0.3s + var(--s) * 1.1s`. I'm downgrading it because the line itself says 'is `5`', the picture does finish, and a 10-year-old reading the line usually takes longer than the gap. The cost falls on a fast clicker, who never sees the working reach its value. The storyboard's settled shot is taken at 1.8 s, before the rest point, which is why every frame looked short.
   *Fix:* Shorten the stride in props.css `.expr.working` (`.step`, `.work`, `.made`) from `var(--s) * 1.1s` to about `var(--s) * 0.6s`. The last stage then lands near 1.6 s, as the typing ends. Do not hold Next until the picture rests: that gates the narration on a timer, and pressing the picture already replays it. Separately, the storyboard's settled shot should wait for `.prop` animations to finish (getAnimations empty) instead of a fixed 1.8 s.

16. **Other robots appear in a one-robot world** — `v2-ops`, low (keep-with-changes; from story-5).
   > Nine litres of oil, shared between two robots.
   Unseen other robots (four in Step 10) raise continuity questions.
   *Verified:* The quote is accurate: ops.ts:189 'shared between two robots', and `sharing()` at ops.ts:401 makes it 'shared between 4 robots' in Step 10. The world has only one robot on stage, and the picture shows a jug and tanks, not robots (02-03-ask.png). So the words name robots the player never sees and the picture never draws. The cost is small (a child can imagine other robots), but the fix also brings the words in line with the picture. The proposed fix drops the idea of equal shares, and that is what makes it a division.
   *Fix:* Step 2: "Nine litres of oil, poured evenly into two tanks. Let the robot work out how much goes in each." In `sharing()` (ops.ts:401): `${litres} litres of oil, poured evenly into ${robots} tanks. Let the robot work out how much goes in each.` Keep the reply 'Sharing out is divide' as it is, or change it to 'Pouring evenly is divide: `/`.'

17. **Mira and Pip appear with no introduction** — `v2-types`, low (keep-with-changes; from story-6).
   > Make the robot think of Mira's phone number: 0412 555 019.
   Unseen names with no reason read as filler.
   *Verified:* Mira is a real cast member (content/cast.ts:30, the courier), but she is only met properly later, in v2-lists and v2-logic. In v2-types she is a bare name: the 'Mira' note in the str beat, then 'Make the robot think of Mira's phone number' (types.ts:163,169). A child has no idea who she is. Pip is not a problem: 'The robot's new friend is called Pip' (types.ts:286) is an introduction.
   *Fix:* Keep the 'Mira' name note as a sample word, but drop her from the ask: 'Make the robot think of this phone number: 0412 555 019.' with caption 'The phone number'. Or tie it to the cast already on stage: 'Make the robot think of the crow's phone number.' Leave the Pip ask as it is.

18. **'The 0 falls off' misstates Python** — `v2-types`, low (keep-with-changes; from teacher-7).
   > Without quotes it's a number, and the `0` at the front falls off. Put it in quotes.
   A leading-0 literal is a SyntaxError; the player dropped the 0 themselves.
   *Verified:* phoneMiss (types.ts:75) gives this reply when the thought is an int. A player can only get an int by typing the digits without the 0 (e.g. `412555019`) or some other number: `0412555019` and `0412 555 019` are SyntaxErrors in CPython ('leading zeros in decimal integer literals are not permitted'), and those get the separate quotes reply. So 'the 0 at the front falls off' tells a child Python dropped it, which is false: they dropped it. The picture's ghost zero (Props.tsx:1727, lostZero) is fine, because it only shows that a 0 is missing from what was typed. The proposed wording is close, but a phone number like `555` would also hit this branch, so the reply should not rest only on the 0.
   *Fix:* "A number can't start with `0`, so the robot can't keep it that way. Put the whole thing in quotes: `"0412 555 019"`."

19. **Generic replies for real type-pick mistakes** — `v2-types`, low (keep-with-changes; from teacher-8).
   > Not that one. Try another.
   Wrong picks like `bool` for `"0"` or `int` for `False` get no explanation.
   *Verified:* Confirmed in types.ts:259-275 and core.ts:774. The literal questions give reasons only for one wrong pick each. 7.0 → bool/str, False → int/float and "0" → bool all fall back to 'Not that one. Try another.', while the situation questions give a reason for every wrong pick (FITS). Within one quiz that is inconsistent, and it leaves the likeliest muddle ("0" as a no/zero → bool) unexplained. One correction to the proposed text: 'False is ... not a number' is untrue in Python (bool is a subclass of int, False == 0), so it should not be said.
   *Fix:* Give every wrong option of each literal a reason. q-dot: bool → 'Only `True` and `False` are bools. This is a number with a dot: a `float`.'; str → 'No quotes, so it isn't words. The dot makes it a `float`.' q-quote (unquoted): int/float → 'No quotes, and it's one of the robot's two answers, yes or no: a `bool`.' q-digits: bool → 'The quotes make it words, even a `0`: a `str`.' Avoid 'not a number'.

20. **'Same kind' overloads the word for type; left-to-right never asked** — `v2-ops`, low (keep-with-changes; from teacher-9).
   > Two of the same kind go left to right: `10 - 2 - 3` is `5`.
   'Kind' was taught as type; here it means equal-rank operators, and the rule is never quizzed.
   *Verified:* The quote is accurate (ops.ts:211). The types lesson taught 'kind' as type: types.ts:110 says 'not all things are the same kind.' In `10 - 2 - 3` every operand is an `int`, and so is every operand in `2 + 3 * 4` one beat earlier. A child reading 'same kind' as same type could think the earlier sum should also go left to right, which is the opposite rule. It is also true that left to right is never asked: `orderPick` only asks `a + b * c`. The proposed fix's wording '`+` and `-` rank the same' doesn't fit an example that only has `-`, and 'rank' is a new word.
   *Fix:* "When it's only `+` and `-`, it goes left to right: `10 - 2 - 3` is `5`." (or "Two `-`s go left to right ..."). Asking it is optional: add a `(a - b) - c` reading as a distractor somewhere (for example a one-off pick of `10 - 2 - 3`, with `11` as the right-to-left miss). Otherwise accept that the beat is told and not tested.

21. **'Sum' used for every expression** — `v2-ops`, low (keep-with-changes; from teacher-10).
   > Write it as a sum, like `'Sprock' + 'et'`.
   Calling joins and multiplications sums blurs the add/join distinction the lesson teaches.
   *Verified:* The lesson's register is British (sweets, litres), and for a UK 10-year-old 'a sum' covers `7 * 6` and `9 / 2`, so most of the uses are fine. The weak spot is the word steps. The generic `workMiss` stopped-reply (ops.ts:106, used by `situation()` for `words()`) says 'Write it as a sum, like `'Sprock' + 'et'`' and 'Give the robot a sum to work out, like `'ha' * 3`.' That calls a join or a repeat a sum in the same lesson that says 'numbers add, words join.' The cost is small but real, and only in those replies.
   *Fix:* Leave 'sum' for the number steps. Give `workMiss` a noun parameter (default 'a sum'), and have `words()` pass something like 'the join' or 'the words and the operation'. For example: "Give the robot the words to join, like `'Sprock' + 'et'`" and "Let the robot do the repeating, like `'ha' * 3`."

22. **Outro shelf truncates the phone number** — `v2-types`, low (keep-with-changes; from pictures:v2-types-7).
   > Four types, and you can tell them apart.
   The str entry is cut to "0412 55..." in tiny type.
   *Verified:* Cutting the chip short is a deliberate design. chipLines (src/scene/props.ts:895-907, commit 7b5e44b) shortens long values with an ellipsis because wrapping drew the phone number at 6.8px. But the same comment says the shortened chip 'draws at the same size as the chips beside it', and in 13-01-outro.png (zoomed) it does not: '"0412 55…' is set visibly smaller than '"hello"' and '"Mira"'. The cut is counted in characters (CHIP_CHARS = 8), and digits are wider than letters (0.67 em against about 0.61), so fitText shrinks the chip. The phone number is also the str the lesson spent a beat on ('It can start with `0`, and it has spaces'), so a cut that leaves it both tiny and missing its spaces is a small but real blemish in the recap.
   *Fix:* Don't wrap the chip and don't enlarge the shelf; wrapping was tried and rejected for tiny type. Instead, have chipLines cut by estimated width (the emOf table already in Props.tsx) rather than by character count, so a shortened chip fits at the shelf's own size (for example '"0412 5…'), as its doc comment promises.

23. **Float-in-a-sum beat has no picture of its own** — `v2-ops`, low (keep-with-changes; from pictures:v2-ops-3).
   > And a `float` anywhere in a sum makes the answer a `float` too.
   Stage still shows the division contrast; `2.5` may flash only briefly.
   *Verified:* The claim that `2.5` flashes only briefly is false. In the live page the cloud shows `2.5` for the whole beat, and the console keeps `2 + 0.5` → `2.5` under Corvid's tag (ops-verify/float-5000.png). The other half is true: the stage still shows the `8 / 2` vs `8 * 2` division contrast (ops.ts:181-186), and nothing on screen labels `2.5` as a `float`. The rule is tested later (`typePick` `2 + 0.5`, the parcels' `2 * 2.5`), so a picture of its own would help, but it is polish.
   *Fix:* Give the beat its own contrast: `show: { kind: 'contrast', left: { text: '2 + 0.5', kind: 'float', result: '2.5', resultKind: 'float' }, right: { text: '2 + 1', kind: 'int', result: '3', resultKind: 'int' } }`. Drop the alternative fix of keeping the `2.5` thought up, since it already stays up.

24. **Pictures give away the sum or the answer** — `v2-ops`, low (keep-with-changes; from pictures:v2-ops-5).
   > Seven crates of six bolts. Let the robot work out how many bolts.
   Label shows "7 × 6"; remaining bolts form a countable row, inviting the worked-out miss.
   *Verified:* The cluster mixes two pictures. The crates half doesn't hold up. 01-07-ask shows '7 crates × 6 bolts', which repeats the sentence's own 'seven crates of six bolts'. It states the sum, not the answer, and 42 dots are not something a child counts at a glance (Props.tsx:1311). The bolts half (06-02-ask, 'The robot has 15 bolts and uses 8') is real. Bolts() at Props.tsx:1403-1406 fades the last `use` bolts before anything is answered, so the 7 left stand solid in a short row the child can count. That does the subtraction for them right after the crow says 'don't work it out yourself!'. A typed 7 is caught as unworked, so the harm is a miss the picture invited.
   *Fix:* In Bolts (src/ui/Props.tsx ~1404), set `used` only once the robot has worked out an answer (`n !== null`). Before that, draw all 15 bolts alike under the label '15 bolts, 8 used', and let the 8 fade (with the existing --i stagger) when the answer arrives. Leave the crates label as it is.

25. **'Red' sweets drawn orange** — `v2-ops`, low (keep; from pictures:v2-ops-6).
   > 2 boxes, each with 3 red and 2 blue sweets. Let the robot count them all.
   Colour in picture does not match the words.
   *Verified:* Confirmed in 12-01-ask, zoomed. The 'red' sweets are pale peach with orange outlines (.packs .item.a fill #f6c89a, stroke #d58a45; lit #e0782a, props.css:2207-2221), next to blue ones. The words come from ops.ts:436, '${red} red and ${blue} blue sweets'. The step asks the child to match each colour to a number, so a colour that doesn't match the word gets in the way, if only a little.
   *Fix:* Change the words in ops.ts:436 to '${red} orange and ${blue} blue sweets' (and rename the variable). Recolouring .item.a red would also work, but it would change the apples in the other packs pictures too.

26. **Closing quote touches the card edge** — `v2-ops`, low (keep-with-changes; from pictures:v2-ops-7).
   > What does the robot make of `'3' + '3'`?
   The quote, the key clue, looks clipped against the border.
   *Verified:* Nothing is clipped. Zoomed, both quotes of '3' + '3' are whole, about 4px from the card edges on each side. But the cause is real and affects every value card. Value() at Props.tsx:2027-2030 sizes the text as min(46, 148/(n*0.6)) on a card 152 wide, which leaves about 2 units of padding. The same tightness shows in 07-01 and 11-01, and a bold mono glyph wider than 0.6em can actually overflow.
   *Fix:* Fit to a narrower width in Value() (Props.tsx:2030), e.g. `Math.min(46, 128 / (n * 0.6))`, so every value card keeps about 12 units of padding on each side.

## Dropped

- **Step 1 ask lamp drawn lit while crow says it is off** — `v2-types`. The step 1 ask's lamp is `{ kind: 'lamp' }` with no `demo` (types.ts:121). Arriving, it plays the CSS flick demonstration once (props.css:406-417: 2.6 s, on, off, on, off) and then rests dark. Sampling `.lamp-glow` every 250 ms in the live page (seed 1, scratchpad/unit1/c1check.mjs) gave opacity 0.55 only during the first ~2 s and 0 from then on; c1-16.png shows the lamp dark with the switch on False. Storyboard 01-08-ask.png caught a frame mid-flick (glow on, lever still down). Nothing carries over from the beats, and the flick only shows what the beats just taught.
- **Apple counter reads 2 beside three apples** — `v2-types`. The '2' in 02-01-beat.png was taken mid-animation, and the screenshot was captured while the line was still typing ('Here are three appl'). The counter is the designed tally-up demonstration: it counts from 0 as the apples drop in (props.css:2341-2348, 0.62s delay, then 0.32s per apple). In the live page at http://localhost:5173/#/v2-types it read 0, then 1 at about 300ms, then 3 by about 800ms and stayed at 3. The counter trails the falling apples by about one apple for under a second, and it reads 3 before the crow's line has finished typing. That brief lag is part of the counting, not a resting picture that disagrees with the words.
- **TypeError badge shown before it is named or happens** — `v2-ops`. I checked this live and it is a timing nit, not a teaching problem. The clash badge pops at about 1.05–1.4 s, as the bump lands (props.css `.clash .clash-stop`). The console finishes typing `"3" + 4` at about 1.2 s and prints 'The robot could not do that: TypeError' at about 1.8 s, in the same beat (ops-verify/clash-1203.png, clash-1802.png). So the word `TypeError` is shown by the robot itself on that beat, alongside the crow's line 'The robot stops.' Saying the badge appears two beats before the term is named overlooks the console. The crow's later beat explains a term the player has already seen happen. The badge leads the run by about half a second, and an unlabelled mark first would add a state for no gain.
