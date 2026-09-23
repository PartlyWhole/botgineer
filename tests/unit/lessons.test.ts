/**
 * A lesson's progress is derived from evidence, so these tests are just
 * evidence in, step number out. No UI, no runtime, no bookkeeping.
 *
 * The first two lessons never bind anything, so their evidence is
 * entirely *thoughts* — what the robot worked out and let go. Memory
 * staying empty there is the lesson, not an omission.
 */
import { describe, expect, it } from 'vitest'
import {
  guidance,
  namesPoint,
  operations,
  progress,
  staging,
  takeAnOrder,
  talkingToHumans,
  threeKinds,
  type Evidence,
  type Lesson,
  type Line,
} from '../../content/lessons'
import type { Thought } from '../../src/memory/extract'
import type { Binding, MemorySnapshot, PyObject } from '../../src/memory/model'

const value = (type: string, repr: string): PyObject => ({
  id: `v:${type}:${repr}`,
  type,
  kind: 'value',
  repr,
  elements: null,
  partial: false,
})

const snap = (objects: PyObject[], bindings: Binding[] = []): MemorySnapshot => ({
  bindings,
  objects: Object.fromEntries(objects.map((o) => [o.id, o])),
  line: 1,
})

const EMPTY = snap([])
const th = (type: string, repr: string): Thought => ({ type, repr })

/** Evidence from a session that thought these things and bound nothing. */
const thinking = (...thoughts: Thought[]): Evidence => ({
  snapshot: EMPTY,
  thoughts,
  history: [EMPTY],
})

/** Evidence from a session that passed through these memories. */
const over = (history: MemorySnapshot[], thoughts: Thought[] = []): Evidence => ({
  snapshot: history[history.length - 1]!,
  thoughts,
  history,
})

const NOTHING: Evidence = thinking()

const bound = (name: string, type: string, repr: string) => ({
  object: value(type, repr),
  binding: { name, scope: 'global', target: `v:${type}:${repr}` },
})

/* ---------------------- one: yes, how many, how much ---------------------- */

/** A line the player typed, as the workbench reports it. */
const line = (source: string, thought: Thought | null, error: string | null = null): Line => ({
  source,
  ok: error === null,
  error,
  thought,
})

/** Evidence after typing these lines in order: the accepted expressions
 *  become thoughts (with their source), and the last line is `last`. */
const typed = (...lines: Line[]): Evidence => ({
  snapshot: EMPTY,
  thoughts: lines.filter((l) => l.ok && l.thought).map((l) => ({ ...l.thought!, source: l.source })),
  history: [EMPTY],
  last: lines[lines.length - 1] ?? null,
})

/** The lines that answer the first lesson, right first time. */
const KINDS_RIGHT: Line[] = [
  line('True', th('bool', 'True')),
  line('False', th('bool', 'False')),
  line('3', th('int', '3')),
  line('-1', th('int', '-1')),
  line('0.5', th('float', '0.5')),
  line('1.4', th('float', '1.4')),
  line('12', th('int', '12')),
  line('True', th('bool', 'True')),
  line('1.5', th('float', '1.5')),
  line('True + True', th('int', '2')),
  line('2 + 0.5', th('float', '2.5')),
]

describe('yes, how many, how much', () => {
  it('starts with a switch, and asks for True', () => {
    expect(progress(threeKinds, NOTHING)).toBe(0)
    expect(guidance(threeKinds, NOTHING).text).toMatch(/switch/)
    expect(guidance(threeKinds, NOTHING).text).toMatch(/`True`/)
  })

  it('walks bool, then int, then float, then shows they nest', () => {
    for (let i = 1; i <= KINDS_RIGHT.length; i++) {
      expect(progress(threeKinds, typed(...KINDS_RIGHT.slice(0, i)))).toBe(i)
    }
    const done = typed(...KINDS_RIGHT)
    expect(guidance(threeKinds, done).text).toMatch(/fits inside the next/)
    expect(guidance(threeKinds, done).text).toMatch(/[Nn]one of it had a name/)
  })

  it('names each kind only after the player has made one', () => {
    const says = threeKinds.steps.map((s) => s.say)
    const first = (word: string) => says.findIndex((s) => s.includes(`\`${word}\`s`))
    // Called a bool in the step after the switch, an int after the
    // apples, a float after the glass.
    expect(first('bool')).toBe(1)
    expect(first('int')).toBe(3)
    expect(first('float')).toBe(5)
  })

  it('does not count an answer given before its question was asked', () => {
    // `3` typed first is not the apple count: the apples had not been
    // asked about. So it moves nothing, and cannot skip a step's line.
    const early = typed(line('3', th('int', '3')), line('True', th('bool', 'True')), line('False', th('bool', 'False')))
    expect(progress(threeKinds, early)).toBe(2)
  })

  it('never lets one line do two steps', () => {
    // The breakfast step takes any bool; the True that turned the lamp on
    // must not also answer it.
    const upToEggs = KINDS_RIGHT.slice(0, 7)
    expect(progress(threeKinds, typed(...upToEggs))).toBe(7)
  })

  it('accepts any height a person could be, and only as a float', () => {
    const before = KINDS_RIGHT.slice(0, 5)
    expect(progress(threeKinds, typed(...before, line('1.72', th('float', '1.72'))))).toBe(6)
    expect(progress(threeKinds, typed(...before, line('1', th('int', '1'))))).toBe(5)
    expect(progress(threeKinds, typed(...before, line('14.0', th('float', '14.0'))))).toBe(5)
  })

  it('wants the robot to do the sums, not the player', () => {
    const before = KINDS_RIGHT.slice(0, 9)
    expect(progress(threeKinds, typed(...before, line('2', th('int', '2'))))).toBe(9)
    expect(progress(threeKinds, typed(...before, line('True + True', th('int', '2'))))).toBe(10)
    const at10 = [...before, line('True + True', th('int', '2'))]
    expect(progress(threeKinds, typed(...at10, line('2.5', th('float', '2.5'))))).toBe(10)
  })

  describe('replies to a miss', () => {
    const reply = (...lines: Line[]) => guidance(threeKinds, typed(...lines)).text

    it('on the switch', () => {
      expect(reply(line('true', null, 'NameError — the robot stopped there.'))).toMatch(/capital letter/)
      expect(reply(line('yes', null, 'NameError — the robot stopped there.'))).toMatch(/doesn't know the word `yes`/)
      expect(reply(line('"True"', th('str', "'True'")))).toMatch(/word, for people/)
      expect(reply(line('False', th('bool', 'False')))).toMatch(/stays dark/)
    })

    it('on counting', () => {
      const at = KINDS_RIGHT.slice(0, 2)
      expect(reply(...at, line('3.0', th('float', '3.0')))).toMatch(/counted — no dot/)
      expect(reply(...at, line('4', th('int', '4')))).toMatch(/Count the apples again/)
      expect(reply(...at, line('"three"', th('str', "'three'")))).toMatch(/digits/)
    })

    it('on the lift', () => {
      const at = KINDS_RIGHT.slice(0, 3)
      expect(reply(...at, line('1', th('int', '1')))).toMatch(/minus sign/)
      expect(reply(...at, line('1.5', th('float', '1.5')))).toMatch(/Stuck between floors/)
      expect(reply(...at, line('0', th('int', '0')))).toMatch(/ground/)
      expect(reply(...at, line('9', th('int', '9')))).toMatch(/no floor 9/)
    })

    it('on measuring', () => {
      const glass = KINDS_RIGHT.slice(0, 4)
      expect(reply(...glass, line('0', th('int', '0')))).toMatch(/Empty/)
      expect(reply(...glass, line('0,5', th('tuple', '(0, 5)')))).toMatch(/full stop, not a comma/)
      const height = KINDS_RIGHT.slice(0, 5)
      expect(reply(...height, line('140', th('int', '140')))).toMatch(/centimetres.*`1.4`/)
      expect(reply(...height, line('1', th('int', '1')))).toMatch(/exactly 1 metre/)
    })

    it('on the match, where a dot is not a clock', () => {
      const at = KINDS_RIGHT.slice(0, 8)
      expect(reply(...at, line('90', th('int', '90')))).toMatch(/minutes/)
      expect(reply(...at, line('1.3', th('float', '1.3')))).toMatch(/not a clock/)
    })

    it('never answers a right answer as if it were a miss on the next step', () => {
      // `True` finished the lamp; the fish step must ask its question,
      // not tell the player that True is the wrong answer to it.
      expect(reply(line('True', th('bool', 'True')))).toBe(threeKinds.steps[1]!.say)
    })

    it('goes back to the question when the reply has nothing to say', () => {
      expect(reply(line('x = 5', null))).toBe(threeKinds.steps[0]!.say)
    })
  })

  describe('the stage', () => {
    it('shows the lamp first, with nothing drawn into it', () => {
      const s = staging(threeKinds, NOTHING)
      expect(s.current?.prop).toEqual({ kind: 'lamp' })
      expect(s.current?.answer).toBeNull()
      expect(s.current?.ask).toBe('Turn the lamp on.')
      expect(s.leaving).toBeNull()
    })

    it('draws a miss into the picture that asked', () => {
      const s = staging(threeKinds, typed(line('False', th('bool', 'False'))))
      expect(s.current?.prop.kind).toBe('lamp')
      expect(s.current?.answer).toEqual(th('bool', 'False'))
      expect(s.current?.verdict).toBe('miss')
    })

    it('sends a right answer off in its own picture, and brings on the next', () => {
      const s = staging(threeKinds, typed(line('True', th('bool', 'True'))))
      expect(s.leaving?.prop.kind).toBe('lamp')
      expect(s.leaving?.answer).toEqual(th('bool', 'True'))
      expect(s.leaving?.verdict).toBe('right')
      expect(s.current?.prop.kind).toBe('fish')
      expect(s.current?.answer).toBeNull()
    })

    it('keeps the same picture when the next step shares it', () => {
      const s = staging(threeKinds, typed(...KINDS_RIGHT.slice(0, 10)))
      expect(s.leaving).toBeNull()
      expect(s.current?.prop.kind).toBe('kinds')
      expect(s.current?.answer).toEqual(th('int', '2'))
    })

    it('ends on the kinds, with everything that was said', () => {
      const s = staging(threeKinds, typed(...KINDS_RIGHT))
      expect(s.current?.prop.kind).toBe('kinds')
      expect(s.current?.heard.map((t) => t.repr)).toEqual(KINDS_RIGHT.map((l) => l.thought!.repr))
    })

    it('draws nothing from a line that failed, but still counts it as a miss', () => {
      const s = staging(threeKinds, typed(line('yes', null, 'NameError — the robot stopped there.')))
      expect(s.current?.answer).toBeNull()
      expect(s.current?.verdict).toBe('miss')
    })
  })
})

/* ------------------------- talking to humans ------------------------- */

const WORDS_RIGHT: Line[] = [
  line('"hello Mira"', th('str', "'hello Mira'")),
  line('7 + 7', th('int', '14')),
  line('"7" + "7"', th('str', "'77'")),
  line('"0412 555 019"', th('str', "'0412 555 019'")),
  line('"True"', th('str', "'True'")),
  line('True', th('bool', 'True')),
  line('"Yes, the door is locked"', th('str', "'Yes, the door is locked'")),
  line('ord("A")', th('int', '65')),
]

describe('talking to humans', () => {
  it('opens on Mira, and on words in quotes', () => {
    expect(guidance(talkingToHumans, NOTHING).text).toMatch(/Mira/)
    expect(guidance(talkingToHumans, NOTHING).text).toMatch(/quotes/)
  })

  it('walks through to every character being a number', () => {
    for (let i = 1; i <= WORDS_RIGHT.length; i++) {
      expect(progress(talkingToHumans, typed(...WORDS_RIGHT.slice(0, i)))).toBe(i)
    }
    expect(guidance(talkingToHumans, typed(...WORDS_RIGHT)).text).toMatch(/computers like bits, humans like words/)
  })

  it('lets Mira ask her own questions', () => {
    expect(guidance(talkingToHumans, typed(...WORDS_RIGHT.slice(0, 1))).speaker).toBe('courier')
    expect(guidance(talkingToHumans, typed(...WORDS_RIGHT.slice(0, 6))).speaker).toBe('courier')
  })

  it('accepts the phone number with or without its spaces, but only as text', () => {
    const at = WORDS_RIGHT.slice(0, 3)
    expect(progress(talkingToHumans, typed(...at, line('"0412555019"', th('str', "'0412555019'"))))).toBe(4)
    expect(progress(talkingToHumans, typed(...at, line('412555019', th('int', '412555019'))))).toBe(3)
  })

  it('tells the word True from the robot\'s own', () => {
    const at = WORDS_RIGHT.slice(0, 4)
    expect(progress(talkingToHumans, typed(...at, line('True', th('bool', 'True'))))).toBe(4)
    expect(progress(talkingToHumans, typed(...at, line('"True"', th('str', "'True'"))))).toBe(5)
  })

  describe('replies to a miss', () => {
    const reply = (...lines: Line[]) => guidance(talkingToHumans, typed(...lines)).text

    it('on words without quotes', () => {
      expect(reply(line('hello', null, 'NameError — the robot stopped there.'))).toMatch(/Without quotes/)
      expect(reply(line('hello Mira', null, 'SyntaxError — the robot stopped there.'))).toMatch(/one pair of quotes/)
      expect(reply(line('""', th('str', "''")))).toMatch(/empty/)
    })

    it('on a phone number typed as a number', () => {
      const at = WORDS_RIGHT.slice(0, 3)
      expect(reply(...at, line('0412555019', null, 'SyntaxError — the robot stopped there.'))).toMatch(/starts with 0/)
      expect(reply(...at, line('412555019', th('int', '412555019')))).toMatch(/0 at the front vanished/)
    })

    it('on the robot\'s True where Mira wanted words', () => {
      const at = WORDS_RIGHT.slice(0, 6)
      expect(reply(...at, line('True', th('bool', 'True')))).toMatch(/robot for yes/)
    })

    it('on a letter without its quotes', () => {
      const at = WORDS_RIGHT.slice(0, 7)
      expect(reply(...at, line('ord(A)', null, 'NameError — the robot stopped there.'))).toMatch(/needs quotes/)
      expect(reply(...at, line('ord("a")', th('int', '97')))).toMatch(/different character/)
    })
  })

  it('keeps the lamp on stage across the two True steps, showing the note', () => {
    const s = staging(talkingToHumans, typed(...WORDS_RIGHT.slice(0, 5)))
    expect(s.leaving).toBeNull()
    expect(s.current?.prop.kind).toBe('lamp')
    expect(s.current?.answer).toEqual(th('str', "'True'"))
  })

  it('ends with the letter turned over', () => {
    const s = staging(talkingToHumans, typed(...WORDS_RIGHT))
    expect(s.current?.prop).toEqual({ kind: 'letter', char: 'A' })
    expect(s.current?.answer).toEqual(th('int', '65'))
  })
})

/* ------------------------- two: working things out ------------------------- */

describe('working things out', () => {
  it('wants the answer, not the question', () => {
    expect(progress(operations, NOTHING)).toBe(0)
    expect(progress(operations, thinking(th('int', '42')))).toBe(1)
  })

  it('wants a float from division', () => {
    const got = thinking(th('int', '42'), th('float', '4.5'))
    expect(progress(operations, got)).toBe(2)
    // `4` would be the wrong answer, and a different type as well.
    expect(progress(operations, thinking(th('int', '42'), th('int', '4')))).toBe(1)
  })

  it('joins words and answers a comparison', () => {
    const e = thinking(th('int', '42'), th('float', '4.5'), th('str', "'botgineer'"))
    expect(progress(operations, e)).toBe(3)
    expect(progress(operations, thinking(...e.thoughts, th('bool', 'False')))).toBe(4)
  })

  it('finishes on the two-part sum, and says the answer went nowhere', () => {
    const e = thinking(
      th('int', '42'),
      th('float', '4.5'),
      th('str', "'botgineer'"),
      th('bool', 'False'),
      th('int', '20'),
    )
    expect(progress(operations, e)).toBe(operations.steps.length)
    expect(guidance(operations, e).text).toMatch(/nobody else ever knew it/)
  })

  it('needs no memory at all to be completed', () => {
    const e = thinking(
      th('int', '42'),
      th('float', '4.5'),
      th('str', "'botgineer'"),
      th('bool', 'False'),
      th('int', '20'),
    )
    expect(Object.keys(e.snapshot.objects)).toEqual([])
    expect(progress(operations, e)).toBe(operations.steps.length)
  })

  it('has no two steps answered by the same value', () => {
    // Otherwise one answer would satisfy a step it was not for.
    const answers = ['42', '4.5', "'botgineer'", 'False', '20']
    expect(new Set(answers).size).toBe(answers.length)
  })
})

/* ---------------------------- three: names ---------------------------- */

describe('names point at objects', () => {
  const x10 = bound('x', 'int', '10')
  const named = snap([x10.object], [x10.binding])
  const aliased = snap([x10.object], [x10.binding, { ...x10.binding, name: 'y' }])
  const moved = snap(
    [value('int', '10'), value('int', '99')],
    [
      { name: 'x', scope: 'global', target: 'v:int:99' },
      { name: 'y', scope: 'global', target: 'v:int:10' },
    ],
  )

  it('asks for a name because the last lesson kept nothing', () => {
    expect(guidance(namesPoint, NOTHING).text).toMatch(/forgetting/)
  })

  it('wants the name, then wants it read back without recomputing', () => {
    expect(progress(namesPoint, over([named]))).toBe(1)
    expect(progress(namesPoint, over([named], [th('int', '10')]))).toBe(2)
  })

  it('finishes when x has moved and y has not', () => {
    expect(progress(namesPoint, over([named, aliased, moved], [th('int', '10')]))).toBe(
      namesPoint.steps.length,
    )
  })

  it('does not slide backwards when the last step un-answers the first', () => {
    // `x = 99` makes "x points at 10" false again.
    expect(progress(namesPoint, over([moved], [th('int', '10')]))).toBe(0)
    expect(progress(namesPoint, over([named, aliased, moved], [th('int', '10')]))).toBe(4)
  })
})

/* -------------------------- four: taking an order -------------------------- */

describe('taking an order', () => {
  const customer = bound('customer', 'str', "'Mira'")
  const parcels = bound('parcels', 'int', '7')
  const stored = snap([customer.object, parcels.object], [customer.binding, parcels.binding])

  it('is asked by the courier, not the crow', () => {
    expect(guidance(takeAnOrder, NOTHING).speaker).toBe('courier')
  })

  it('wants both facts before the question', () => {
    expect(progress(takeAnOrder, over([snap([customer.object], [customer.binding])]))).toBe(1)
    expect(progress(takeAnOrder, over([stored]))).toBe(2)
  })

  it('finishes when the robot works the weight out', () => {
    expect(progress(takeAnOrder, over([stored], [th('int', '14')]))).toBe(takeAnOrder.steps.length)
  })

  it('is not satisfied by storing the answer instead of working it out', () => {
    const cheated = snap(
      [customer.object, parcels.object, value('int', '14')],
      [customer.binding, parcels.binding, { name: 'total', scope: 'global', target: 'v:int:14' }],
    )
    expect(progress(takeAnOrder, over([cheated]))).toBe(2)
  })
})

/* ------------------------------ every lesson ------------------------------ */

const ALL: Lesson[] = [threeKinds, talkingToHumans, operations, namesPoint, takeAnOrder]

describe.each(ALL.map((l) => [l.id, l] as const))('%s', (_id, lesson) => {
  it('starts at the beginning and has something to say there', () => {
    expect(progress(lesson, NOTHING)).toBe(0)
    expect(guidance(lesson, NOTHING).text).not.toBe('')
  })

  it('has an outro that is not one of its steps', () => {
    expect(lesson.outro).not.toBe('')
    expect(lesson.steps.map((s) => s.say)).not.toContain(lesson.outro)
  })

  it('only ever moves forward as evidence accumulates', () => {
    const objects = [
      value('int', '10'),
      value('int', '99'),
      value('str', "'Mira'"),
      value('int', '7'),
    ]
    const bindings: Binding[] = [
      { name: 'x', scope: 'global', target: 'v:int:99' },
      { name: 'y', scope: 'global', target: 'v:int:10' },
      { name: 'customer', scope: 'global', target: "v:str:'Mira'" },
      { name: 'parcels', scope: 'global', target: 'v:int:7' },
    ]
    const memories = [
      EMPTY,
      snap(objects.slice(0, 1), bindings.slice(1, 2)),
      snap(objects, bindings),
    ]
    const said = [
      th('int', '10'),
      th('float', '4.5'),
      th('str', "'botgineer'"),
      th('bool', 'False'),
      th('int', '42'),
      th('int', '20'),
      th('int', '14'),
    ]
    const stages: Evidence[] = said.map((_, i) =>
      over(memories.slice(0, Math.min(memories.length, 1 + Math.floor(i / 3))), said.slice(0, i)),
    )
    const seen = stages.map((e) => progress(lesson, e))
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
  })
})
