/**
 * Props: the picture a lesson step puts on the stage, and what the
 * robot's answer does to it.
 *
 * A lesson step asks a question about a situation — a lamp, a basket of
 * apples, a lift — and the situation is drawn between the crow and the
 * robot. The player's answer is drawn *into* it: `True` lights the lamp,
 * `-1` sends the lift to the car park, `0.5` fills a glass halfway, and
 * `1.5` leaves the lift stuck between floors. So a wrong kind of value is
 * not only a line the crow says, it is something the player can see go
 * wrong.
 *
 * Still a view, and still no state (invariant 12). What a prop shows is a
 * function of three things the workbench already has: which step the
 * lesson is on, the last line the player typed, and what the robot
 * thought of it. Each prop plays a short demonstration when it arrives,
 * which is CSS, not a timer.
 *
 * A narration beat (docs/PEDAGOGY.md §4) shows a picture too, before
 * anything has been asked. Some pictures take a `demo` or a similar field
 * for that: a state forced for the beat — the lamp switched on, the lift
 * sent to −1 — so the stage *shows* the claim the crow is making with the
 * sound off (rule R6). Those fields are narration, not a different
 * picture (`sameProp`), so a beat that changes one keeps the picture on
 * stage and the change plays on it.
 *
 * This module is the pure half: the types and the reading of an answer.
 * `ui/Props.tsx` draws them.
 */
import type { MemorySnapshot } from '../memory/model'
import type { Thought } from '../memory/extract'
import { compare, itemsOf, type Goal, type GoalRow } from '../memory/goal'
import type { Run } from '../../content/lessons/core'

export type Prop =
  /** A lamp on a switch. A bool drives it; a word is stuck on it as a note
   *  and lights nothing, which is the difference between `True` and
   *  `"True"`. `demo` forces the switch for a narration beat — `'on'`
   *  flips it and lights the lamp, `'off'` flips it back — while no
   *  answer is drawn; an answer always wins over it, so an ask that
   *  reuses the picture is never answered by its own narration. */
  | { kind: 'lamp'; demo?: 'on' | 'off' }
  /** A fish, a bird, and the robot's answer to whether they are the same.
   *  A word (`"no"`) is stuck on the fish as a note and changes nothing. */
  | { kind: 'fish' }
  /** A basket of apples; the answer is drawn as counted tokens under it.
   *  `demo: 'count'` drops the apples in one at a time with a counter
   *  ticking 1, 2, 3 under the basket; `'half'` has half an apple try to
   *  join and bounce off the rim, the counter staying where it was —
   *  counting goes in whole steps.
   *
   *  `'tally'` makes `apples` narration too: beats that change it keep
   *  the basket on stage, and the change plays on it — apples drop in or
   *  are lifted out, and a counter beside the basket rolls to the new
   *  count in whole steps. At most `APPLE_AT`'s six apples are drawn. A
   *  tally is a different picture from a basket without one (`sameProp`),
   *  so an ask that keeps the basket on stage keeps `demo: 'tally'`. */
  | { kind: 'basket'; apples: number; demo?: 'count' | 'half' | 'tally' }
  /** A building in section, floors `lowest..highest`, 0 the ground. The
   *  answer is where the lift goes; a float stops it between floors.
   *  `demo` sends it to that floor for a narration beat, before anyone
   *  has answered: below zero is a floor too. */
  | { kind: 'lift'; lowest: number; highest: number; demo?: number }
  /** A glass filled to `level` (0..1), and a second glass filled to the
   *  answer. `demo: 'fill'` is instead one glass filling smoothly to
   *  `level` — no steps on the way, which is what *measured* means. */
  | { kind: 'glass'; level: number; demo?: 'fill' }
  /** A height chart in metres; the answer is how tall the figure stands. */
  | { kind: 'height' }
  /** An egg box with `slots` hollows; the answer is how many eggs. */
  | { kind: 'carton'; slots: number }
  /** A plate: breakfast if `True`, empty if `False`. */
  | { kind: 'plate' }
  /** A football match on a timeline of hours: two halves of 45 minutes. */
  | { kind: 'match' }
  /** The three kinds, nested: bool inside int inside float, with every
   *  value the player has thought of placed in its ring. The shelf
   *  replaces it in Lesson 1, because it claims an int sits inside a
   *  float (R8); it stays drawable for whatever still stands it. */
  | { kind: 'kinds' }
  /** Numbers as blocks and text as letter tiles: `7 + 7` against
   *  `"7" + "7"`. `parts` is what is shown before the answer, as Python
   *  literals and operators; `7 + 7` when omitted. `demo: 'stamp'`, for a
   *  str times an int (`"ha" * 3`), has the word stamp itself that many
   *  times under the sum: repetition, seen. */
  | { kind: 'tiles'; parts?: string[]; demo?: 'stamp' }
  /** Crates in a row, each holding `each` bolts: multiplication as an
   *  array. The answer lights that many bolts. */
  | { kind: 'crates'; crates: number; each: number }
  /** A jug of `litres` and `robots` tanks; the answer is what each tank
   *  gets, and anything not shared stays in the jug. */
  | { kind: 'share'; litres: number; robots: number }
  /** `have` bolts, `use` of them used up; the answer is ringed. */
  | { kind: 'bolts'; have: number; use: number }
  /** A balance with `left` and `right` blocks, asked `left op right`.
   *  `lamp` stands a small lamp beside it that settles with the beam and
   *  lights with the comparison's truth — the answer to a comparison is a
   *  bool. For the narration beat before the ask: on the ask itself it
   *  would be the answer, so leave it off there.
   *
   *  `leftLabel` and `rightLabel` are what each pan says, and so what the
   *  question says, when a side is written as more than its number:
   *  `2 + 2` on the left of `2 + 2 == 4`. Without them each side is its
   *  number. A label that is a sum of whole numbers (`2 + 2`) splits its
   *  pan's blocks into its parts, in two colours, so the sum is seen to
   *  weigh what its total does. */
  | {
      kind: 'balance'
      left: number
      right: number
      op: '>' | '<' | '=='
      lamp?: boolean
      leftLabel?: string
      rightLabel?: string
    }
  /** An expression worked one operation at a time: `first` is done
   *  first, then each of `then`. The working shows once answered.
   *  `demo: 'work'` (narration) plays the working for a beat while
   *  nothing is answered: `first` lights up in the expression, then each
   *  line of `then` arrives in turn, the lit span collapsing into the
   *  result it made (`exprWorking`), and it rests on the final value. */
  | { kind: 'expr'; text: string; first: string; then: string[]; demo?: 'work' }
  /** The four operator keys, `+ - * /`, as big keys in a row, each with a
   *  word under it (`OP_WORDS`). `mark` (narration) presses and lights
   *  one, so beats that move it press the next key in place. Draws no
   *  answer. */
  | { kind: 'ops'; mark?: Op }
  /** Two literals that do not go together, as tiles in their kinds'
   *  colours (`literalKind`) either side of `op`: they slide together,
   *  bump, bounce apart, and a ✕ `TypeError` appears under them — the
   *  robot stops. Draws no answer. */
  | { kind: 'clash'; left: string; op: string; right: string }
  /** `packs` boxes in a row, each holding `each[0]` items of one colour
   *  and `each[1]` of a second when given, with `loose` more beside the
   *  boxes: a chained sum, `3 * 4 + 2` or `2 * (3 + 4)`. At most 5 boxes,
   *  6 of each colour a box, 6 loose. A number the robot thinks of lights
   *  that many items, box by box, then the loose ones. */
  | { kind: 'packs'; packs: number; each: number[]; loose?: number }
  /** A phone whose screen shows the number exactly as the robot has it. */
  | { kind: 'phone'; number: string }
  /** A locked door, and a note to the person on the other side. */
  | { kind: 'door' }
  /** A door in its frame, seen from the front: open or shut is a bool.
   *  `True` swings it open, `False` shuts it; a word (`"open"`) is stuck
   *  on as a note and moves nothing, as on the lamp. `demo` (narration)
   *  swings it open or shut for a beat while nothing has been answered;
   *  an answer always wins over it. */
  | { kind: 'doorway'; demo?: 'open' | 'closed' }
  /** A small car and its speedometer (km/h, 0–120) with a digital
   *  readout. `demo: 'drive'` shows `speed`; both are narration, so
   *  beats that change it keep the car on stage (the ask too), and the
   *  needle sweeps smoothly to the new
   *  speed while the readout shows it as a float, always with a decimal
   *  point (`48.5`, `50.0`). Without `demo` (the ask) the needle waits at
   *  0 and the readout says `? km/h`; a number the robot thinks of moves
   *  the needle and the readout to it, in its own kind's colour, and a
   *  word is stuck on as a note. */
  | { kind: 'car'; speed: number; demo?: 'drive' }
  /** A sticky note with `text` handwritten on it, and a small `title`
   *  above (`name`). The robot's answer is written on a tag beside it as
   *  the robot has it: a str in quotes, in the str colour; anything else
   *  as itself, in its own kind's colour. */
  | { kind: 'note'; text: string; title?: string }
  /** One Python literal on a plain card (`3`, `3.0`, `True`, `"True"`),
   *  big, in monospace and in neutral ink — never its kind's colour,
   *  because the question is which kind it is. Draws no answer. */
  | { kind: 'value'; text: string }
  /** A card handed to a person, showing whatever text is on it. */
  | { kind: 'card' }
  /** A letter tile with its number on the back. */
  | { kind: 'letter'; char: string }
  /**
   * The five data types as a shelf of five slots, bool · int · float ·
   * char · str, left to right. The lesson fills it as it names each one.
   * It replaces the nested boxes, which claimed an int sits inside a
   * float (R8: `3` and `3.0` are different objects of different types).
   *
   * `filled` is which slots have been named, in the order they were: the
   * last is the newcomer, and only it flies in with its label and its
   * examples (`examples`, else `SLOT_EXAMPLES`), so a picture drawn again
   * from scratch does not replay the whole lesson. An unnamed slot is a
   * `?`; `pulse` has the `?`s pulse in turn. `title` settles *Data types*
   * over the shelf; `later` lines up ghost chips in `[ ]`, tagged *later*
   * — what the five get arranged into; `cheer` bounces every filled slot.
   *
   * Everything heard so far is drawn into the slot of its own type
   * (`slotOf`: a one-character str is a char), so a shelf that stays on
   * stage through a round of questions collects the answers, and the
   * newest (the view's answer) flies in. That is Python's truth whether
   * or not the answer was right, so a miss sorted there is honest; a
   * staging that wants only right answers passes only those, as practice
   * does with `kinds`.
   *
   * `slots` is which slots to draw, left to right: all five when omitted.
   * Fewer slots share the whole width. Without a char slot a
   * one-character str is filed under str, where Python keeps it. A
   * different set of slots is a different picture (not narration).
   */
  | {
      kind: 'shelf'
      filled: TypeSlot[]
      slots?: TypeSlot[]
      title?: boolean
      pulse?: boolean
      later?: boolean
      cheer?: boolean
      examples?: Partial<Record<TypeSlot, string[]>>
    }
  /** A number line from `from` to `to`, whole numbers ticked, tenths
   *  between them when the line is short. A marker slides along from
   *  `from` and stops at `mark`, its value written between the ticks —
   *  unless `unnamed`, for the beat before the value has its name. A
   *  number the robot thinks of moves the marker instead.
   *
   *  `want` is the number the ask is after, when the ask is for the robot
   *  to work one out (`2 + 0.5`): the same number typed by hand is then
   *  drawn as not worked out yet (`unworked`), not as a measurement. */
  | { kind: 'numberline'; from: number; to: number; mark?: number; unnamed?: boolean; want?: number }
  /** Letters floating up into the air where Mira reads them: characters,
   *  one at a time, which is all a person reads. */
  | { kind: 'letters'; chars: string[] }
  /** One character, alone. `clasps` draws its quotes as clasps closed
   *  round it: the quotes are what make it a thing to read. */
  | { kind: 'char'; char: string; clasps?: boolean }
  /** Two things side by side in their kinds' colours, differing in one
   *  way (R7): `7` beside `"7"`. With a `result` on each side, what each
   *  one makes: `7 + 7` → `14` beside `"7" + "7"` → `"77"`. */
  | { kind: 'contrast'; left: ContrastSide; right: ContrastSide }
  /** A string as beads on a thread: the characters slide on one at a
   *  time and a quote clips on at each end. `glow` lights the clasps —
   *  the quotes show where the string starts and stops. */
  | { kind: 'beads'; text: string; glow?: boolean }
  /** An arrow off the right edge of the stage, towards the console, with
   *  a tag: where the player's instructions go. */
  | { kind: 'pointer'; to: 'console'; label: string }
  /** `on` lit lamps, each a `True`, adding up: each lamp turns into a 1
   *  and the sum comes out an int. `True + True` is `2`. */
  | { kind: 'lamps'; on: number }
  /** Letters sliding onto a number line at their codes — A at 65, B at
   *  66: every character is secretly a number (`ord`). */
  | { kind: 'codes'; chars: string }
  /** A scale and `parcels` parcels of `each` kg. The answer is the
   *  reading: when the robot has worked it out, the parcels go on one by
   *  one and the scale reads what it said, in kg. A reading that is not
   *  what the parcels weigh is drawn as a scale that disagrees. */
  | { kind: 'scale'; parcels: number; each: number }
  /** A short Python block, drawn as code: monospace, its indentation
   *  kept and guided, so a lesson can *show* the block it asks the player
   *  to read before running it (R1: a sentence describing a loop is not a
   *  loop). `text` is the block, one line per `\n`; a common leading
   *  indent (a template literal's) is taken off, and past `CODE_LINES`
   *  lines the rest is cut to `…`. `mark` (narration) highlights one
   *  line, counted from 1, so a beat can point at it and the next beat
   *  move the highlight without the card arriving again. Draws no answer:
   *  it is the code, not what the code did — memory shows that. */
  | { kind: 'code'; text: string; mark?: number }
  /** A goal memory: what the robot's memory should hold, drawn the way
   *  the memory graph draws memory — a name, an arrow, an object card
   *  with the value in its kind's colour — but as a blueprint, dashed on
   *  a faint wash, headed by `title` ("Goal" when omitted). At most
   *  `GOAL_ROWS` rows are drawn. With `view.memory`, each row the robot's
   *  memory already has (`memory/goal`'s `compare`) is ticked and filled
   *  in; a name pointing at something else says what it points at now;
   *  names memory has that the goal does not are listed under the rows;
   *  and a goal met settles once. Draws no answer: memory is the answer. */
  | { kind: 'goal'; goal: Goal; title?: string }
  /** A game's inventory hotbar: a row of square slots, each holding an
   *  item drawn as an icon (`HOTBAR_ICONS`; any other name is a plain tile
   *  with the word on it) with its name in small type under it, and each
   *  slot's number (0, 1, 2 …) under the cell in a list's slot style: a
   *  list of strs, seen. At most `HOTBAR_MAX` slots are drawn. `mark`
   *  (narration) selects one slot, as a game's selected slot is framed and
   *  lifted, so beats that move it keep the hotbar on stage and the
   *  selection moves along. The items are narration too while their count
   *  stays the same: a beat that swaps one (`hotbar[1] = "bow"`) keeps the
   *  hotbar, and the new item pops into its cell. A different count is a
   *  different picture. A str the robot thinks of lights the cell holding
   *  that item (the selected one first); a str no cell holds lights
   *  nothing, and anything else is only its tag. */
  | { kind: 'hotbar'; items: string[]; mark?: number }
  /** An open adventure backpack, its items tucked into a row of numbered
   *  pockets across its front (each index in a list's slot style): a
   *  list of strs, carried. Each pocket shows its item as the hotbar does
   *  (an icon from `HOTBAR_ICONS`, else a tile with the word) and its
   *  name in small type. At most `BACKPACK_MAX`. `mark` (narration) lifts
   *  that item a little out of its pocket and lights it and its number;
   *  the items are narration too while their count stays the same, so a
   *  swapped item pops into its pocket. A str the robot thinks of lights
   *  the item it names (the marked one first). An int is a count: a tag
   *  says how many things, and that many pockets are ticked, in order.
   *  The count is a number to work out (`len`), so the right count typed
   *  by hand is drawn unworked (`rightNumber`). */
  | { kind: 'backpack'; items: string[]; mark?: number }
  /** A game's status panel, a character sheet: one row per stat, each a
   *  big icon chosen from its name (`hudIcon`: a heart and a bar for
   *  `hp`, a coin for `coins`, a key bright for `True` and ghosted for
   *  `False`, a torch lit only when `True` …), the name in code font and
   *  the value as a Python literal in its kind's colour; a list value is
   *  drawn as its items' icons. At most `HUD_ROWS` rows. `title` heads
   *  the panel. `mark` (narration) frames the rows a condition reads.
   *  The values are narration too while the names stay the same, so a
   *  beat that changes `hp` keeps the panel and the new value pops in.
   *  A bool the robot thinks of is a verdict badge beside the panel,
   *  `True` or `False` in the bool colour, amber when refused; on the
   *  ask (`view.ask`) an empty `?` badge waits there. Anything else is
   *  only its tag. */
  | { kind: 'hud'; stats: { name: string; value: string }[]; mark?: string[]; title?: string }
  /** A cave gate worked by a little circuit: one lamp per lock, each
   *  labelled with its condition in code font, lit when it is `True`.
   *  `and` wires the lamps in series down one wire, so current reaches
   *  the gate only through every lamp; `or` wires them in parallel, rungs
   *  of a ladder, so any lit lamp lets it through (`gateCurrent`). The
   *  word `and` or `or` sits on the wiring. Unanswered, the gate is shut
   *  under a `?` plaque: will it open? A bool the robot thinks of that
   *  agrees with the lamps (`gateOpens`) slides the portcullis up, or
   *  leaves it shut and padlocked; one that disagrees, or a refused one,
   *  moves nothing and the plaque turns amber (`gateShows`). `demo:
   *  'try'` (narration) runs the current lamp by lamp and then opens the
   *  gate or rattles it shut. The lamps' `on` is narration too: a beat
   *  that lights one keeps the gate on stage. 1 to `GATE_LOCKS` locks. */
  | { kind: 'gate'; op: 'and' | 'or'; locks: { label: string; on: boolean }[]; demo?: 'try' }
  /** A fork in a cave tunnel, for `if`/`elif`/`else`: a corridor down the
   *  left, and off it one side tunnel per branch, checked top to bottom.
   *  Each has a signpost with its test in code font (`hp > 50`, or
   *  `else`) and where it leads at its far end (`result`, with an icon
   *  when it names one: `pathIcon`). `taken` (narration) is the branch
   *  that ran: its sign ticks and its tunnel lights; the signs before it
   *  are crossed (checked, and said no); the signs after it are greyed
   *  and never checked (`pathMarks`) — the first yes wins. `null` is no
   *  branch at all (an `if` whose test said no): every sign crossed, and
   *  the robot walks straight on. Undefined is nothing decided yet. `demo:
   *  'walk'` (narration) walks the robot down the signs, checking each in
   *  turn, and into the tunnel it takes. At most `PATHS_MAX` branches. */
  | { kind: 'paths'; branches: { test: string; result: string }[]; taken?: number | null; demo?: 'walk' }
  /** A loop adding up: a row of coins (or gems) each with its value on
   *  it, and a counter, `label` (`total` when omitted) pointing at its
   *  value as memory draws a name. `mark` (narration) is the loop's pass:
   *  a pointer over that coin, which glows, and the coins before it
   *  counted (dimmed, ticked); `mark` past the last coin is the loop
   *  done. `total` (narration) is what the counter holds; null or left
   *  out, the counter is empty. A number the robot thinks of is written
   *  in the counter instead, in its kind's colour, amber when refused. At
   *  most `TALLY_MAX` coins. */
  | { kind: 'tally'; values: number[]; mark?: number; total?: number | null; label?: string; item?: 'coin' | 'gem' }
  /** The robot trying the player's program on several cases, as a
   *  scoreboard of encounter cards: each row's given values in code font
   *  (`hp = 20`), the value `name` should end up holding (`want`), and
   *  what the program made of it on the last run (`caseResult`, from
   *  `view.run`): ✓ when they agree, an amber ✗ when not. Before any run
   *  the got column says `—` and nothing is marked. At most `CASES_MAX`
   *  rows. Draws no answer. */
  | { kind: 'cases'; name: string; rows: { given: string; want: string }[] }

/** How many slots the hotbar draws. */
export const HOTBAR_MAX = 6

/** The items the hotbar has an icon for. Anything else is a plain tile
 *  with its name written on it. */
export const HOTBAR_ICONS = ['sword', 'shield', 'potion', 'bow', 'map', 'gem', 'key', 'apple', 'torch', 'helmet', 'coin', 'pickaxe'] as const

/** Which hotbar cell a thought lights: a str equal to an item, the
 *  selected cell if it holds it, else the first that does, else none. */
export function hotbarLit(p: { items: readonly string[]; mark?: number }, t: Thought | null): number | null {
  const text = textOf(t)
  if (text === null) return null
  const items = p.items.slice(0, HOTBAR_MAX)
  if (p.mark !== undefined && items[p.mark] === text) return p.mark
  const at = items.indexOf(text)
  return at < 0 ? null : at
}

/** How many items the backpack draws. */
export const BACKPACK_MAX = 6

/** Which pocket a thought lights: as on the hotbar, a str equal to an
 *  item, the marked one first. */
export const backpackLit = hotbarLit

/** How many pockets a count ticks: an int answer, in order from pocket 0,
 *  no more than the backpack has. Null for anything that is not a whole
 *  count, or a count not yet worked out. */
export function backpackTicks(view: PropView): number | null {
  if (view.prop.kind !== 'backpack' || view.answer?.type !== 'int' || unworked(view)) return null
  const n = Number(view.answer.repr)
  return Number.isInteger(n) ? clamp(n, 0, Math.min(BACKPACK_MAX, view.prop.items.length)) : null
}

/** How many rows of a goal memory the picture draws: four, a list among
 *  them included — the rows are scaled into the frame, and a raised goal
 *  (the top of a wide stage) has the room. Mira's explorer card is three
 *  names and a backpack. */
export const GOAL_ROWS = 4
export const GOAL_ROWS_WITH_LIST = 4
/** How many of a list's slots the picture draws. */
export const GOAL_ITEMS = 5

/** A goal row as its picture draws it. `items` are a list's slots, as
 *  literals, when the row draws a list of its own; `alias` is the index,
 *  among the rows drawn, of the row whose object a `same` row's arrow
 *  converges on, and such a row draws no object of its own. */
export type GoalShownRow = GoalRow & {
  items: string[] | null
  alias: number | null
  /** A `same` row, against memory: whether its name and the one it names
   *  point at one object now (null without memory, or when either name is
   *  missing). An equal copy is `false`. */
  sameNow: boolean | null
}

/**
 * A goal memory as its picture draws it: the rows it has room for, each
 * against the robot's memory when there is one (`checked`), and the
 * names memory has that the goal does not. `met` is of the whole goal,
 * never only of the rows drawn, so the picture and the lesson agree.
 * Without memory nothing is ticked and nothing is extra: a blueprint.
 *
 * A list is drawn once. A row that must be the `same` object as another
 * row draws its arrow to that row's object, as memory draws aliasing;
 * only when that row is not drawn does it draw the value itself.
 */
export function goalShown(
  goal: Goal,
  memory: MemorySnapshot | undefined,
): { rows: GoalShownRow[]; extra: string[]; met: boolean; checked: boolean } {
  const c = memory
    ? compare(goal, memory)
    : { rows: goal.map((g) => ({ ...g, have: null, haveType: null, ok: false })), extra: [], met: false }
  const aliasOf = (r: GoalRow, drawn: GoalRow[]) => {
    if (r.same === undefined) return null
    const at = drawn.findIndex((d) => d.name === r.same && d.same === undefined)
    return at < 0 ? null : at
  }
  const listy = (r: GoalRow, drawn: GoalRow[]) => aliasOf(r, drawn) === null && itemsOf(r.value) !== null
  let drawn = c.rows.slice(0, GOAL_ROWS)
  if (drawn.some((r) => listy(r, drawn))) drawn = c.rows.slice(0, GOAL_ROWS_WITH_LIST)
  const target = (name: string) => memory?.bindings.find((b) => b.name === name)?.target
  const rows = drawn.map((r) => {
    const alias = aliasOf(r, drawn)
    const mine = target(r.name)
    const theirs = r.same === undefined ? undefined : target(r.same)
    return {
      ...r,
      alias,
      items: alias === null ? (itemsOf(r.value)?.slice(0, GOAL_ITEMS) ?? null) : null,
      sameNow: mine === undefined || theirs === undefined ? null : mine === theirs,
    }
  })
  return { rows, extra: c.extra, met: c.met, checked: memory !== undefined }
}

/** One side of a `contrast`. `text` is the value as Python writes it —
 *  or, with `result`, the expression that makes it. `label` is a word for
 *  people under it ("a number", "a thing to read"). */
export type ContrastSide = {
  text: string
  kind: TypeSlot
  label?: string
  /** What `text` makes, as Python writes it. */
  result?: string
  /** The result's kind, when it is not the side's own. */
  resultKind?: TypeSlot
}

/** Everything a prop needs to draw itself, and nothing it could change. */
export type PropView = {
  prop: Prop
  /** The question, kept on screen under the picture — the crow's bubble
   *  answers a miss, so without this the question would disappear. */
  ask?: string | undefined
  /** What the robot made of the last line, if it is this prop's to show. */
  answer: Thought | null
  /** `right` once the step this prop belongs to is done; `miss` for an
   *  answer that did not do it; null before anything has been tried. */
  verdict: 'right' | 'miss' | null
  /** Everything thought of so far, oldest first. The kinds diagram and
   *  the shelf sort them into place; nothing else reads it. */
  heard: Thought[]
  /** The robot's memory now, for a picture of a goal memory that ticks
   *  the rows already met (`memory/goal`). */
  memory?: MemorySnapshot | undefined
  /** An editor lesson's last run, for a picture of the cases the robot
   *  tried the program on (`cases`). */
  run?: Run | null | undefined
}

/**
 * What the stage shows: the current step's prop, and the one the player
 * has just answered, on its way out.
 *
 * `leaving` is the payoff. A right answer advances the lesson at once, so
 * without it the lamp would never be seen lit — the fish would already
 * be there. It is drawn for a beat and then gives way, in CSS.
 */
export type Staging = {
  current: (PropView & { key: string }) | null
  leaving: (PropView & { key: string }) | null
}

export const NO_STAGING: Staging = { current: null, leaving: null }

/**
 * The fields of each prop that narrate rather than make a different
 * picture: a lamp switched on for a beat is still the lamp, a shelf with
 * one more slot filled is still the shelf. Two props that differ only in
 * these are the same picture, so the element stays on stage and the
 * change plays as a transition on it — the switch flips, the newcomer
 * flies into its slot — instead of the picture leaving and coming back as
 * itself, which would replay its arrival and bury the one thing that
 * changed.
 */
const NARRATION: Partial<Record<Prop['kind'], string[]>> = {
  lamp: ['demo'],
  basket: ['demo'],
  lift: ['demo'],
  doorway: ['demo'],
  expr: ['demo'],
  ops: ['mark'],
  // Every car is one picture: the ask draws no speed of its own (the
  // needle waits at 0), so a drive's beats and the ask after them keep
  // the car on stage, and the needle sweeps back to wait.
  car: ['demo', 'speed'],
  balance: ['lamp'],
  shelf: ['filled', 'title', 'pulse', 'later', 'cheer', 'examples'],
  numberline: ['mark', 'unnamed'],
  char: ['clasps'],
  beads: ['glow'],
  code: ['mark'],
  hotbar: ['mark'],
  backpack: ['mark'],
  hud: ['mark'],
  gate: ['demo'],
  paths: ['taken', 'demo'],
  tally: ['mark', 'total'],
}

/** A prop without its narration: what identifies the picture. A tally
 *  (`basket`, `demo: 'tally'`) is a picture of its own whose count is
 *  narration, so it keeps its mode and drops the number. */
function picture(p: Prop): Record<string, unknown> {
  const out: Record<string, unknown> = { ...p }
  for (const k of NARRATION[p.kind] ?? []) delete out[k]
  if (p.kind === 'basket' && p.demo === 'tally') {
    delete out['apples']
    out['tally'] = true
  }
  // A hotbar: the items are narration, their count is the picture.
  if (p.kind === 'hotbar' || p.kind === 'backpack') out['items'] = p.items.length
  // A status panel: the stats' names are the picture, their values narrate.
  if (p.kind === 'hud') out['stats'] = p.stats.map((s) => s.name)
  // A gate: its conditions are the picture, whether each is lit narrates.
  if (p.kind === 'gate') out['locks'] = p.locks.map((l) => l.label)
  return out
}

/** Two props show the same picture, so a new step keeps it on stage and
 *  only the answer (or the narration) changes, instead of the picture
 *  leaving and coming back as itself. */
export const sameProp = (a: Prop, b: Prop): boolean => JSON.stringify(picture(a)) === JSON.stringify(picture(b))

/* ------------------------------ answers ------------------------------ */

/** A number, if the robot thought of an int or a float. A bool is not
 *  one here, even though Python would let it add: the props draw what
 *  the player *said*, and `True` in a basket is not an apple. */
export function numberOf(t: Thought | null): number | null {
  if (!t || (t.type !== 'int' && t.type !== 'float')) return null
  const n = Number(t.repr)
  return Number.isFinite(n) ? n : null
}

/** True or false, if the robot thought of a bool. */
export function boolOf(t: Thought | null): boolean | null {
  if (!t || t.type !== 'bool') return null
  return t.repr === 'True'
}

/**
 * The text of a str, from its repr: `'it\'s'` → `it's`.
 *
 * Python chooses the quotes and escapes, so this undoes exactly what
 * `repr` does for the characters a player can type. Anything that is not
 * a str is null — a prop shows words only when they are words.
 */
export function textOf(t: Thought | null): string | null {
  if (!t || t.type !== 'str') return null
  const r = t.repr
  if (r.length < 2) return null
  const body = r.slice(1, -1)
  return body.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/g, (_, e: string) => {
    if (e === 'n') return '\n'
    if (e === 't') return '\t'
    if (e === 'r') return '\r'
    if (e.length > 1) return String.fromCodePoint(parseInt(e.slice(1), 16))
    return e
  })
}

/** Keeps a number on a scale, so an answer of a million still draws. */
export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

/* ------------------------- right, but not worked out ------------------------- */

/**
 * What a row of tiles makes, when it is a sum the robot can be asked to
 * work out: whole numbers joined by `+` or `*`, or words glued by `+`
 * and repeated by `*` a whole number of times. One operator throughout,
 * so no order of operations is guessed at. A lone word is not a sum —
 * its question is about a letter of it — and nor is anything else
 * (`2 + 2 == 4` is a comparison, drawn for a beat, never asked).
 */
export function tilesMake(parts: readonly string[]): { number: number } | { text: string } | null {
  if (parts.length < 3 || parts.length % 2 === 0) return null
  const ops = parts.filter((_, i) => i % 2 === 1)
  const op = ops[0]
  if ((op !== '+' && op !== '*') || ops.some((o) => o !== op)) return null
  const texts: string[] = []
  const nums: number[] = []
  for (const v of parts.filter((_, i) => i % 2 === 0)) {
    if (/^".*"$/.test(v)) texts.push(v.slice(1, -1))
    else if (/^-?\d+$/.test(v)) nums.push(Number(v))
    else return null
  }
  if (texts.length === 0) return { number: nums.reduce((a, v) => (op === '+' ? a + v : a * v), op === '+' ? 0 : 1) }
  if (op === '+') return nums.length === 0 ? { text: texts.join('') } : null
  // A word times whole numbers: the one word, repeated.
  if (texts.length !== 1) return null
  return { text: texts[0]!.repeat(Math.max(0, nums.reduce((a, v) => a * v, 1))) }
}

/**
 * The number a picture that asks for one is asking for: what the crates
 * hold, what is left of the bolts, what each tank gets, what the parcels
 * weigh, where the working ends, the letter's code, what a sum of blocks
 * makes. Null for a picture that does not draw a number as its answer
 * (the lamps and the codes narrate; they draw no answer at all).
 */
export function rightNumber(p: Prop): number | null {
  switch (p.kind) {
    case 'crates':
      return p.crates * p.each
    case 'bolts':
      return p.have - p.use
    case 'share':
      return p.robots > 0 ? p.litres / p.robots : null
    case 'scale':
      return p.parcels * p.each
    case 'expr': {
      const last = Number(p.then[p.then.length - 1])
      return p.then.length > 0 && Number.isFinite(last) ? last : null
    }
    case 'letter':
      return p.char.codePointAt(0) ?? null
    case 'packs':
      return packsTotal(p)
    case 'numberline':
      return p.want ?? null
    case 'backpack':
      return p.items.length
    case 'tiles': {
      const made = tilesMake(p.parts ?? [])
      return made && 'number' in made ? made.number : null
    }
    default:
      return null
  }
}

/** The words a picture asks the robot to make: what a sum of words glues
 *  or repeats into (`"bot" + "gineer"`, `"ha" * 5`). */
export function rightText(p: Prop): string | null {
  if (p.kind !== 'tiles') return null
  const made = tilesMake(p.parts ?? [])
  return made && 'text' in made ? made.text : null
}

/**
 * The right answer, said the wrong way: the step refused it (`miss`) and
 * yet it is the number, or the words, the picture asks for — typed by
 * hand, or worked out from the wrong thing. The crow's reply says *not
 * like that*, so the picture must not say *yes*: drawn as an answer it
 * would fill the crates, weigh the parcels, tick the reading and glue
 * the tiles while the words refuse it. Such a picture is drawn as not
 * worked out yet: waiting, in amber, with a `?` where the working would
 * go.
 *
 * Compared by value, so a typed `4` for `8 / 2`'s `4.0` counts: the right
 * amount, and still not what the robot was asked to work out.
 */
export function unworked(view: PropView): boolean {
  if (view.verdict !== 'miss') return false
  const n = numberOf(view.answer)
  const want = rightNumber(view.prop)
  if (n !== null && want !== null && Math.abs(n - want) < 1e-9) return true
  const text = textOf(view.answer)
  const words = rightText(view.prop)
  return text !== null && words !== null && text === words
}

/** How close two amounts read by eye must be to look the same: a glass
 *  or a bar a twentieth off is not a different picture. Practice judges
 *  a glass by the same margin. */
export const BY_EYE = 0.051

/** The heights, in metres, the chart draws as a person standing there:
 *  what the choose lesson takes for an answer. */
export const HEIGHT_RANGE = [0.5, 2.5] as const

/**
 * Whether the picture draws this answer the way it draws the answer it
 * asks for — which is what the player reads as *yes*. Not whether the
 * answer is right: that is the step's to say, from the evidence. A
 * picture draws what the robot thought, and three apples are three
 * apples whether they were `3`, `3.0` or `2 + 1`. So this is the half a
 * picture can know, and `refused` sets it beside the step's verdict.
 *
 * Per picture: the lamp lit (the doorway swung, either way); the fish not a bird; the basket counted to
 * its apples; the lift parked on a floor it has; the second glass filled
 * like the first; a person on the height chart; the egg box full; the
 * plate uncovered; the bar reaching the final whistle; words on the card
 * or the note; the phone calling; the tiles making what the sum makes
 * (or, under a lone word, one letter tile); every crate's bolts lit; the
 * jug emptied into the tanks; the bolts left ringed; the letter turned;
 * the scale reading what the parcels weigh; the marker where the ask
 * wants it; the selected hotbar slot's item; the backpack's marked item, or
 * its count; the note's tag saying the note's words; every item in the
 * packs lit; any bool on the status panel's badge or at the gate; any
 * number in the tally's counter. The balance and the working are drawn only once the step is
 * right, the shelf and the kinds sort by type (Python's truth either
 * way), and the rest draw no answer: none of those can look right on a
 * miss.
 */
export function looksRight(view: PropView): boolean {
  const p = view.prop
  const a = view.answer
  if (!a) return false
  const n = numberOf(a)
  const b = boolOf(a)
  const t = textOf(a)
  switch (p.kind) {
    case 'lamp':
    case 'doorway':
      // Either answer lights or darkens the switch (swings the door open
      // or shut) the way the right one would, so a refused `False` is as
      // misleading as a refused `True`.
      return b !== null
    case 'fish':
      return b === false
    case 'basket':
      return n !== null && n === p.apples
    case 'lift':
      return n !== null && Number.isInteger(n) && n >= p.lowest && n <= p.highest
    case 'glass':
      return p.demo !== 'fill' && n !== null && Math.abs(n - p.level) <= BY_EYE
    case 'height':
      return n !== null && n >= HEIGHT_RANGE[0] && n <= HEIGHT_RANGE[1]
    case 'carton':
      return n !== null && Math.floor(n) === p.slots
    case 'plate':
      return b !== null
    case 'match':
      return n !== null && Math.abs(n - 1.5) <= BY_EYE
    case 'card':
    case 'door':
      return t !== null && t.trim() !== ''
    case 'phone':
      return t !== null && t.replace(/\D/g, '') === p.number
    case 'note':
      return t !== null && t === p.text
    case 'tiles': {
      const made = tilesMake(p.parts ?? [])
      if (made === null) return (p.parts ?? []).length === 1 && t !== null && [...t].length === 1
      return 'text' in made ? t === made.text : n !== null && Math.abs(n - made.number) < 1e-9
    }
    case 'crates':
      return n !== null && Math.floor(n) >= p.crates * p.each
    case 'share':
      return n !== null && p.robots > 0 && n * p.robots >= p.litres - 1e-9
    case 'bolts':
      return n !== null && clamp(Math.floor(n), 0, p.have) === p.have - p.use
    case 'letter':
      return a.type === 'int'
    case 'scale':
      return n !== null && Math.abs(n - p.parcels * p.each) < 1e-9
    case 'packs':
      return n !== null && Math.abs(n - packsTotal(p)) < 1e-9
    case 'numberline':
      return n !== null && p.want !== undefined && Math.abs(n - p.want) < 1e-9
    case 'hotbar':
      return t !== null && p.mark !== undefined && p.items[p.mark] === t
    case 'backpack':
      return (t !== null && p.mark !== undefined && p.items[p.mark] === t) || (a.type === 'int' && n === p.items.length)
    // A bool is a verdict either way (the badge, the gate moving), and a
    // number fills the counter as the right total would.
    case 'hud':
    case 'gate':
      return b !== null
    case 'tally':
      return n !== null
    default:
      return false
  }
}

/**
 * A miss the picture would draw as a yes: the step refused the answer,
 * and the picture, left to itself, would draw it the way it draws the
 * right one (`looksRight`) — `3.0` apples counted into a basket of
 * three, a lift parked at `-1.0`, the lamp lit by a typed `True`. Such a
 * picture draws the answer *refused*: still what the robot thought, but
 * in amber, in its own idiom, so what the player sees agrees with what
 * the crow says.
 *
 * The right answer said the wrong way (`unworked`) is not this: that
 * picture draws nothing done at all, and waits for the working.
 */
export function refused(view: PropView): boolean {
  return view.verdict === 'miss' && !unworked(view) && looksRight(view)
}

/** The kinds, in the order the first level builds them. */
export type Kind = 'bool' | 'int' | 'float' | 'str'

export const KINDS: Kind[] = ['bool', 'int', 'float', 'str']

export const kindOf = (t: Thought | null): Kind | null =>
  t && (KINDS as string[]).includes(t.type) ? (t.type as Kind) : null

/* ------------------------------ the shelf ------------------------------ */

/**
 * The shelf's five slots. Five *ideas*, four Python types: Python has no
 * char type and keeps a character as a str one long, which is what the
 * char slot's tag says (`str · length 1`) wherever a char is drawn.
 */
export type TypeSlot = 'bool' | 'int' | 'float' | 'char' | 'str'

export const SLOTS: TypeSlot[] = ['bool', 'int', 'float', 'char', 'str']

/** The slots a shelf draws, left to right: its own `slots`, each once,
 *  or all five. */
export const shelfSlots = (p: { slots?: readonly TypeSlot[] }): TypeSlot[] => {
  const own = (p.slots ?? []).filter((k, i, all) => SLOTS.includes(k) && all.indexOf(k) === i)
  return own.length > 0 ? own : [...SLOTS]
}

/** What each slot shows once it is named, as Python writes them — a str
 *  in the double quotes the lessons use. */
export const SLOT_EXAMPLES: Record<TypeSlot, string[]> = {
  bool: ['True', 'False'],
  int: ['3', '12', '-1'],
  float: ['0.5', '1.4'],
  char: ['"A"'],
  str: ['"hello"', '"Mira"'],
}

/** Which slot a thought belongs in: its own type, except that a str of
 *  exactly one character is a char. Counted in code points, so `"é"` is
 *  one character the way Python's `len` says. The empty string is a str
 *  of no characters, not a char. A shelf without a char slot (`slots`)
 *  files every str under str, which is where Python keeps it. */
export function slotOf(t: Thought | null, slots: readonly TypeSlot[] = SLOTS): TypeSlot | null {
  if (!t) return null
  if (t.type === 'bool' || t.type === 'int' || t.type === 'float') return t.type
  if (t.type !== 'str') return null
  const text = textOf(t)
  if (text === null) return null
  return [...text].length === 1 && slots.includes('char') ? 'char' : 'str'
}

/** The gap between two slots, in the picture's units. */
export const CUBBY_GAP = 1.875

/** How wide each of `count` slots is when they share the picture's 200
 *  units: 38.5 for five, 48.6 for four. */
export const cubbyWidth = (count: number): number => (200 - (Math.max(1, count) - 1) * CUBBY_GAP) / Math.max(1, count)

/** How many characters a chip's row holds on a shelf of `count` slots:
 *  `CHIP_CHARS` for five, more as the slots widen. */
export const chipChars = (count: number): number => Math.max(CHIP_CHARS, Math.floor((CHIP_CHARS * cubbyWidth(count)) / cubbyWidth(SLOTS.length)))

/** A thought as the shelf writes it: a str in double quotes, the way the
 *  lessons write one, everything else as Python's repr. */
export function chipText(t: Thought): string {
  const text = textOf(t)
  return text === null ? t.repr : `"${text}"`
}

export type ShelfSlot = { examples: { text: string; said: boolean }[]; heard: string[] }

/** How many rows a slot has under its label, and how many characters a
 *  chip's row holds at the shelf's size. */
export const CHIP_ROWS = 5
export const CHIP_CHARS = 8

/**
 * A chip's text as the shelf writes it: one row, and a value too long for
 * it cut short with an ellipsis, at the length of `"hello"`, so it draws
 * at the same size as the chips beside it. Over two rows, the choose
 * close's phone number and short sentence came out at 6.8px and 8.1px on
 * a desktop shelf; shortened, they read at the shelf's own size. The whole
 * value is still in the shelf's sentence for a screen reader (`shelved`).
 */
export function chipLines(text: string, width = CHIP_CHARS): string[] {
  const chars = [...text]
  if (chars.length <= width) return [text]
  return [`${chars.slice(0, width - 2).join('').trimEnd()}…`]
}

/** The rows a chip takes: one per line of its text. */
export const chipRows = (text: string): number => chipLines(text).length

/**
 * The rows each slot has left for heard values, once its examples (and
 * the char slot's two-row tag) are drawn. The drawing and the sentence a
 * screen reader hears both take it from here, so they list the same
 * values: they disagreed once, the sentence listing two a slot while the
 * picture showed five.
 */
export function shelfRoom(filled: readonly TypeSlot[], examples: Partial<Record<TypeSlot, string[]>> = {}): Record<TypeSlot, number> {
  const out = {} as Record<TypeSlot, number>
  for (const k of SLOTS) {
    const named = filled.includes(k)
    const shown = named ? (examples[k] ?? SLOT_EXAMPLES[k]) : []
    const tag = k === 'char' && named ? 2 : 0
    out[k] = Math.max(0, CHIP_ROWS - shown.reduce((sum, e) => sum + chipRows(e), 0) - tag)
  }
  return out
}

/**
 * What each slot holds: its examples once named, then the values heard of
 * that slot that are not already examples, newest last, as many as fit
 * in `room` rows (2 unless said; a chip that wraps takes two, `chipRows`).
 * An example the player has said is `said`.
 * Heard values go in whether or not their slot is named yet: a value has
 * its type before anyone has told the player the word. `slots` is the
 * shelf's own (`slotOf`). Pure, so the sorting is tested without drawing
 * it.
 */
export function shelved(
  filled: readonly TypeSlot[],
  heard: readonly Thought[],
  examples: Partial<Record<TypeSlot, string[]>> = {},
  room: Partial<Record<TypeSlot, number>> = {},
  slots: readonly TypeSlot[] = SLOTS,
): Record<TypeSlot, ShelfSlot> {
  const out = {} as Record<TypeSlot, ShelfSlot>
  for (const slot of SLOTS) {
    const shown = filled.includes(slot) ? (examples[slot] ?? SLOT_EXAMPLES[slot]) : []
    const said: string[] = []
    for (const t of heard) {
      if (slotOf(t, slots) !== slot) continue
      const text = chipText(t)
      // Newest last: a value said again moves to the end.
      const was = said.indexOf(text)
      if (was >= 0) said.splice(was, 1)
      said.push(text)
    }
    const extra = said.filter((s) => !shown.includes(s))
    // The newest that fit, counted in rows from the newest back: an older
    // one-row value never pushes out a newer one that wraps.
    let rows = room[slot] ?? 2
    const kept: string[] = []
    for (let i = extra.length - 1; i >= 0; i--) {
      const need = chipRows(extra[i]!)
      if (need > rows) break
      rows -= need
      kept.unshift(extra[i]!)
    }
    out[slot] = {
      examples: shown.map((text) => ({ text, said: said.includes(text) })),
      heard: kept,
    }
  }
  return out
}

/* ------------------------------ the codes ------------------------------ */

/**
 * Where each character sits on the codes line: its code, and its place
 * along the line from 0 to 1, each character once. Close codes are
 * spaced by value, so A, B and C sit one step apart and a gap in the
 * codes is a gap on the line; codes too far apart to share a line (`A`
 * and `z`) are spaced evenly in code order instead, which keeps every one
 * readable at the cost of the spacing meaning anything.
 */
export function codeLine(chars: string): { char: string; code: number; at: number; even: boolean }[] {
  const seen: string[] = []
  for (const c of chars) if (!seen.includes(c)) seen.push(c)
  const codes = seen.map((c) => ({ char: c, code: c.codePointAt(0)! }))
  if (codes.length === 0) return []
  const lo = Math.min(...codes.map((c) => c.code))
  const hi = Math.max(...codes.map((c) => c.code))
  if (hi - lo <= 10) {
    const span = hi - lo + 2
    return codes.map((c) => ({ ...c, at: (c.code - lo + 1) / span, even: false }))
  }
  const order = [...codes].sort((a, b) => a.code - b.code)
  return codes.map((c) => ({ ...c, at: (order.indexOf(c) + 1) / (codes.length + 1), even: true }))
}

/* ------------------------------ the code ------------------------------ */

/** The most lines a code card draws; a longer block ends in `…`. Past
 *  eight, a line is too small to read at a phone's width. */
export const CODE_LINES = 8

/**
 * A block as the code card draws it: tabs as four spaces, blank lines at
 * either end dropped, the indent every line shares taken off (so a
 * template literal indented to sit in its lesson reads flush), and at
 * most `CODE_LINES` lines, the last of a longer block replaced by `…`.
 * Indentation inside the block is the point of the picture, so it is
 * kept exactly.
 */
export function codeLines(text: string): string[] {
  const lines = text.replace(/\t/g, '    ').split('\n').map((l) => l.replace(/\s+$/, ''))
  while (lines.length > 0 && lines[0] === '') lines.shift()
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  const shared = Math.min(...lines.filter((l) => l !== '').map((l) => l.length - l.trimStart().length))
  const flush = Number.isFinite(shared) ? lines.map((l) => l.slice(shared)) : lines
  return flush.length > CODE_LINES ? [...flush.slice(0, CODE_LINES - 1), '…'] : flush
}

/** How far a line is indented, in levels of four spaces (rounded down). */
export const indentOf = (line: string): number => Math.floor((line.length - line.trimStart().length) / 4)

export type CodeToken = { text: string; kind: 'keyword' | 'string' | 'number' | 'comment' | 'plain' }

const KEYWORDS = new Set([
  'and', 'as', 'break', 'continue', 'def', 'elif', 'else', 'for', 'from', 'if', 'import',
  'in', 'is', 'not', 'or', 'pass', 'return', 'while', 'with', 'True', 'False', 'None',
])

/**
 * One line of Python cut into what the card colours: keywords, strings,
 * numbers, a comment, and everything else as it stands. Just enough to
 * read by, not a parser: joined back together the tokens are exactly the
 * line, spaces and all, so nothing the player reads is changed.
 */
export function codeTokens(line: string): CodeToken[] {
  const out: CodeToken[] = []
  const push = (text: string, kind: CodeToken['kind']) => {
    const last = out[out.length - 1]
    if (last && last.kind === kind && kind === 'plain') last.text += text
    else out.push({ text, kind })
  }
  const re = /(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+|.)/g
  for (const m of line.matchAll(re)) {
    if (m[1]) push(m[1], 'comment')
    else if (m[2]) push(m[2], 'string')
    else if (m[3]) push(m[3], 'number')
    else if (m[4]) push(m[4], KEYWORDS.has(m[4]) ? 'keyword' : 'plain')
    else push(m[0], 'plain')
  }
  return out
}

/** The code card's geometry, in the picture's 200 × 130 units: the type
 *  as large as the longest line and the line count allow, up to a cap,
 *  so a two-line loop reads big and an eight-line block still fits. A
 *  monospace character is taken as 0.6 of its size wide. */
export const CODE_BOX = { width: 200, height: 130, pad: 9, lineHeight: 1.45, charWidth: 0.6, maxSize: 16 } as const

export function codeSize(lines: readonly string[]): number {
  const longest = Math.max(1, ...lines.map((l) => [...l].length))
  const across = (CODE_BOX.width - 2 * CODE_BOX.pad) / (longest * CODE_BOX.charWidth)
  const down = (CODE_BOX.height - 2 * CODE_BOX.pad) / (Math.max(1, lines.length) * CODE_BOX.lineHeight)
  return Math.min(CODE_BOX.maxSize, across, down)
}

/* ------------------------------ the car ------------------------------ */

/** The speedometer's range, in km/h, and the angle its needle sweeps
 *  either side of straight up. */
export const SPEED_MAX = 120
export const DIAL_SWEEP = 120

/** A speed as the car's readout writes a measurement: always with a
 *  decimal point, as Python writes a float (`50` → `50.0`). */
export const carReading = (speed: number): string => (Number.isInteger(speed) ? speed.toFixed(1) : String(speed))

/** Where the needle points for a speed, in degrees from straight up:
 *  `-DIAL_SWEEP` at 0, `+DIAL_SWEEP` at `SPEED_MAX`, pinned at either end
 *  (and a little past the top, for a speed off the dial). */
export const needleAngle = (speed: number): number =>
  -DIAL_SWEEP + (2 * DIAL_SWEEP * clamp(speed, 0, SPEED_MAX * 1.04)) / SPEED_MAX

/* ------------------------------ operations ------------------------------ */

export type Op = '+' | '-' | '*' | '/'

export const OPS: Op[] = ['+', '-', '*', '/']

/** The word under each operator key. */
export const OP_WORDS: Record<Op, string> = { '+': 'add', '-': 'take away', '*': 'times', '/': 'divide' }

/**
 * A literal's kind, from how it is written: quotes make a str, `True` and
 * `False` a bool, a point a float, anything else an int. Enough for the
 * literals a picture is given, not a parser.
 */
export function literalKind(text: string): Kind {
  const t = text.trim()
  if (/^(['"]).*\1$/s.test(t)) return 'str'
  if (t === 'True' || t === 'False') return 'bool'
  if (t.includes('.') || /e/i.test(t.replace(/^-/, ''))) return 'float'
  return 'int'
}

/** One line of a worked expression: its text, the span about to be
 *  worked (`work`), and the span the last step's result landed in
 *  (`made`), each as `[start, end)` in characters. */
export type WorkedLine = { text: string; work?: [number, number]; made?: [number, number] }

/** The whitespace-separated pieces of a line, with where each starts. */
const pieces = (line: string): { at: number; end: number }[] => [...line.matchAll(/\S+/g)].map((m) => ({ at: m.index!, end: m.index! + m[0].length }))

/** What changed between two lines of working, piece by piece: the span of
 *  `a` that was worked and the span of `b` it became, or null when the
 *  lines share everything. */
function changed(a: string, b: string): { work: [number, number]; made: [number, number] } | null {
  const pa = pieces(a)
  const pb = pieces(b)
  const same = (i: number, j: number) => a.slice(pa[i]!.at, pa[i]!.end) === b.slice(pb[j]!.at, pb[j]!.end)
  let p = 0
  while (p < pa.length && p < pb.length && same(p, p)) p++
  let q = 0
  while (q < pa.length - p && q < pb.length - p && same(pa.length - 1 - q, pb.length - 1 - q)) q++
  if (p > pa.length - q - 1 || p > pb.length - q - 1) return null
  return { work: [pa[p]!.at, pa[pa.length - q - 1]!.end], made: [pb[p]!.at, pb[pb.length - q - 1]!.end] }
}

/**
 * The working as the expression card draws it: the expression, then each
 * line of `then`. The first step's span is `first` itself, found in the
 * expression, and what it became is the rest of the next line once the
 * text either side of it is taken off (`(2 + 3) * 4` → `5 * 4`: `5`).
 * Each later step is found by what changed between two lines, piece by
 * piece (`2 + 12` → `14`: all of it). Pure, so a bracket, a left-to-right
 * chain and a float are tested without drawing them.
 */
export function exprWorking(text: string, first: string, then: readonly string[]): WorkedLine[] {
  const lines: WorkedLine[] = [text, ...then].map((t) => ({ text: t }))
  for (let k = 0; k + 1 < lines.length; k++) {
    const a = lines[k]!.text
    const b = lines[k + 1]!.text
    const at = k === 0 && first !== '' ? a.indexOf(first) : -1
    if (at >= 0) {
      const before = a.slice(0, at)
      const after = a.slice(at + first.length)
      lines[k]!.work = [at, at + first.length]
      if (b.startsWith(before) && b.endsWith(after) && b.length > before.length + after.length) lines[k + 1]!.made = [before.length, b.length - after.length]
      continue
    }
    const c = changed(a, b)
    if (c) {
      lines[k]!.work = c.work
      lines[k + 1]!.made = c.made
    }
  }
  return lines
}

/* ------------------------------ the packs ------------------------------ */

/** The packs as drawn: at most 5 boxes, 6 of each colour a box, 6 loose. */
export function packsShape(p: { packs: number; each: readonly number[]; loose?: number }): { packs: number; a: number; b: number; loose: number } {
  const whole = (n: number | undefined, hi: number) => clamp(Math.floor(n ?? 0), 0, hi)
  return { packs: clamp(Math.floor(p.packs), 1, 5), a: whole(p.each[0], 6), b: whole(p.each[1], 6), loose: whole(p.loose, 6) }
}

/** What the sum makes: `packs * sum(each) + loose`, from the prop's own
 *  numbers, not the drawing's caps. */
export function packsTotal(p: { packs: number; each: readonly number[]; loose?: number }): number {
  return p.packs * p.each.reduce((a, v) => a + v, 0) + (p.loose ?? 0)
}

/** The packs as the sum they are: `3 * 4 + 2`, `2 * (3 + 4)`. */
export function packsSum(p: { packs: number; each: readonly number[]; loose?: number }): string {
  const inner = p.each.length > 1 ? `(${p.each.join(' + ')})` : `${p.each[0] ?? 0}`
  return `${p.packs} * ${inner}${p.loose ? ` + ${p.loose}` : ''}`
}

/* ------------------------------ the status panel ------------------------------ */

/** How many rows the status panel draws. */
export const HUD_ROWS = 5

/** The icons a status row can wear. */
export type HudIcon = 'heart' | 'coin' | 'star' | 'key' | 'torch' | 'potion' | 'gem' | 'tag' | 'items' | 'tile'

/** A stat's icon, from its name (and, for a list, its value): what a game
 *  would draw beside it. Anything unnamed is a plain tile. */
export function hudIcon(name: string, value: string): HudIcon {
  const n = name.toLowerCase()
  if (itemsOf(value) !== null) return 'items'
  if (n === 'hp' || n === 'health') return 'heart'
  if (n === 'coins' || n === 'gold') return 'coin'
  if (n === 'level') return 'star'
  if (n === 'has_key' || n === 'key') return 'key'
  if (n === 'torch' || n === 'torch_lit') return 'torch'
  if (n === 'potions') return 'potion'
  if (n === 'gems') return 'gem'
  if (n === 'name') return 'tag'
  return 'tile'
}

/** How full a health bar is drawn, 0..1, from a whole-number value out of
 *  100; null for a value that is not a number. */
export function hudBar(value: string): number | null {
  const v = Number(value.trim())
  return value.trim() !== '' && Number.isFinite(v) ? clamp(v / 100, 0, 1) : null
}

/** A literal's truth, when it is written `True` or `False`. */
export const literalBool = (text: string): boolean | null => (text.trim() === 'True' ? true : text.trim() === 'False' ? false : null)

/* ------------------------------ the gate ------------------------------ */

/** How many locks the gate draws. */
export const GATE_LOCKS = 3

/** Whether the gate's lamps let the current through: all of them lit for
 *  `and`, any for `or`. */
export function gateOpens(p: { op: 'and' | 'or'; locks: readonly { on: boolean }[] }): boolean {
  const locks = p.locks.slice(0, GATE_LOCKS)
  return p.op === 'and' ? locks.length > 0 && locks.every((l) => l.on) : locks.some((l) => l.on)
}

/**
 * Where the current reaches, wire by wire. `into[i]` is the wire into
 * lamp `i`, `outOf[i]` the wire out of it, and `gate` the wire into the
 * gate. In series (`and`) the current reaches a lamp only through every
 * lamp before it; in parallel (`or`) every lamp has the current at its
 * near side, and passes it on only when lit.
 */
export function gateCurrent(p: { op: 'and' | 'or'; locks: readonly { on: boolean }[] }): { into: boolean[]; outOf: boolean[]; gate: boolean } {
  const locks = p.locks.slice(0, GATE_LOCKS)
  const into: boolean[] = []
  const outOf: boolean[] = []
  let live = true
  for (const l of locks) {
    into.push(p.op === 'and' ? live : true)
    const out: boolean = (p.op === 'and' ? live : true) && l.on
    outOf.push(out)
    if (p.op === 'and') live = out
  }
  return { into, outOf, gate: gateOpens(p) }
}

/**
 * What the gate shows. Unanswered, it waits shut (`waiting`), unless a
 * `try` demonstration has the lamps decide (`open` or `shut`). A bool the
 * robot thinks of that agrees with the lamps opens it or keeps it shut;
 * one that disagrees, or a refused one, moves nothing and is drawn
 * `refused`. Anything else leaves it waiting.
 */
export function gateShows(view: PropView): 'waiting' | 'open' | 'shut' | 'refused' {
  if (view.prop.kind !== 'gate') return 'waiting'
  const opens = gateOpens(view.prop)
  const b = boolOf(view.answer)
  if (view.answer !== null) {
    if (b === null) return 'waiting'
    return view.verdict === 'miss' || b !== opens ? 'refused' : b ? 'open' : 'shut'
  }
  if (view.prop.demo === 'try') return opens ? 'open' : 'shut'
  return 'waiting'
}

/* ------------------------------ the fork ------------------------------ */

/** How many branches the fork draws. */
export const PATHS_MAX = 4

/** The icons a branch's far end can show. */
export type PathIcon = 'sword' | 'potion' | 'boots' | 'sneak' | 'campfire' | 'door' | 'sign'

/** A branch's icon, from where it leads (quotes ignored): fight or sword,
 *  drink or potion, run or boots, sneak, rest or campfire, open or door;
 *  anything else a plain sign. */
export function pathIcon(result: string): PathIcon {
  const r = result.trim().replace(/^(['"])(.*)\1$/, '$2').toLowerCase()
  if (r === 'fight' || r === 'sword') return 'sword'
  if (r === 'drink' || r === 'potion') return 'potion'
  if (r === 'run' || r === 'boots') return 'boots'
  if (r === 'sneak') return 'sneak'
  if (r === 'rest' || r === 'campfire') return 'campfire'
  if (r === 'open' || r === 'door') return 'door'
  return 'sign'
}

/**
 * Each sign's mark: `yes` for the branch taken, `no` for each checked
 * before it (its test said no), `skipped` for each after it — never
 * checked, because the first yes wins. With no branch taken (`null`)
 * every sign said no; with nothing decided yet (undefined) none is
 * marked.
 */
export function pathMarks(p: { branches: readonly unknown[]; taken?: number | null }): ('yes' | 'no' | 'skipped' | 'none')[] {
  const n = Math.min(PATHS_MAX, p.branches.length)
  const t = p.taken
  return Array.from({ length: n }, (_, i) => {
    if (t === undefined) return 'none'
    if (t === null) return 'no'
    if (t < 0 || t >= n) return 'none'
    return i < t ? 'no' : i === t ? 'yes' : 'skipped'
  })
}

/* ------------------------------ the tally ------------------------------ */

/** How many coins the tally draws. */
export const TALLY_MAX = 6

/** What the tally's counter holds: the robot's number when it has
 *  thought of one (`refused` on a miss), else the prop's own `total`,
 *  else nothing (an empty counter). */
export function tallyShows(view: PropView): { text: string; kind: string; refused: boolean } | null {
  if (view.prop.kind !== 'tally') return null
  if (numberOf(view.answer) !== null) return { text: view.answer!.repr, kind: view.answer!.type, refused: view.verdict === 'miss' }
  const t = view.prop.total
  if (t === null || t === undefined || !Number.isFinite(t)) return null
  return { text: String(t), kind: Number.isInteger(t) ? 'int' : 'float', refused: false }
}

/* ------------------------------ the cases ------------------------------ */

/** How many cases the scoreboard draws. */
export const CASES_MAX = 4

/** A Python literal as the pictures write it: a str in the double quotes
 *  the lessons use (`'run'` → `"run"`), anything else as it stands. */
export function asWritten(literal: string): string {
  const t = literal.trim()
  const m = /^(['"])(.*)\1$/s.exec(t)
  if (!m) return t
  const body = m[2]!.replace(/\\(['"\\])/g, '$1')
  return `"${body.replace(/(["\\])/g, '\\$1')}"`
}

/** Two literals that write the same value: `'run'` and `"run"` agree. */
export const sameLiteral = (a: string, b: string): boolean => asWritten(a) === asWritten(b)

/**
 * What the player's program made of case `i` on its last run, for the
 * scoreboard: the value `name` was left pointing at (as `asWritten`
 * writes it), `nothing` when the program never bound it, or the type of
 * the error it stopped with (`never ends` for one stopped for running too
 * long). `ok` is whether that is the case's `want`. Null before any run,
 * or for a case the run did not try.
 */
export function caseResult(view: PropView, i: number): { got: string; ok: boolean; how: 'value' | 'nothing' | 'error' } | null {
  if (view.prop.kind !== 'cases') return null
  const row = view.prop.rows[i]
  const c = view.run?.cases?.[i]
  // A run tried on another step's cases is not this scoreboard's.
  const given = c ? Object.entries(c.given).map(([k, v]) => `${k} = ${v}`).join(', ') : ''
  if (!row || !c || given !== row.given) return null
  if (c.raised) return { got: c.raised === 'steps' ? 'never ends' : c.raised, ok: false, how: 'error' }
  const name = view.prop.name
  const b = c.final.bindings.find((x) => x.name === name && x.scope === 'global') ?? c.final.bindings.find((x) => x.name === name)
  const o = b ? c.final.objects[b.target] : undefined
  if (!o) return { got: 'nothing', ok: row.want === 'nothing', how: 'nothing' }
  // A list by its items, as Python writes them (and so as the step's
  // `want` does): its own repr is only how many it holds.
  if (o.type === 'list' && o.elements) {
    const items = `[${o.elements.map((el) => c.final.objects[el.target]?.repr ?? '?').join(', ')}]`
    return { got: items, ok: items === row.want, how: 'value' }
  }
  const got = asWritten(o.repr)
  return { got, ok: sameLiteral(got, row.want), how: 'value' }
}
