/**
 * A lesson, written out as the learner meets it: every beat with who says
 * it, what the crow types and keeps in memory, and what the stage shows;
 * each question, its options, its praise, and the replies to the usual
 * mistakes. For a reviewer to read whole (docs/LESSON-REVIEW.md), without
 * a browser.
 *
 *   npx tsx scripts/lesson-script.ts <lesson-id> [seed ...]
 *
 * A seeded lesson (its practice drawn from `?seed=`) is written once per
 * seed. Pictures are described in the sentence each one already writes
 * for a screen reader (`describe` in src/ui/Props.tsx), so the reviewer
 * reads what is drawn, not what the author meant to draw.
 *
 * The replies come from a battery of typical misses fed to each step's
 * `nudge` — a word without quotes, a number of the wrong kind, the answer
 * typed by hand, a line that stops the robot. They are made-up lines, not
 * Python's: what the crow would say to each, not whether Python agrees.
 */
import { LESSONS, type Beat, type Lesson, type LessonStep, type Line } from '../content/lessons'
import { ACTIVITIES } from '../content/activities'
import { CROW_NAME } from '../content/cast'
import type { Prop } from '../src/scene/props'
import { describe } from '../src/ui/Props'

const id = process.argv[2]
const seeds = process.argv.slice(3).map(Number)
if (!id || !LESSONS[id]) {
  console.error(`usage: lesson-script <id> [seed ...]\nknown: ${Object.keys(LESSONS).join(', ')}`)
  process.exit(1)
}

/** The lesson for a seed: v2's seeded lessons export a maker beside the
 *  registered instance (`listsLesson(seed)`), found by its id. */
async function lessonFor(seed: number | undefined): Promise<Lesson> {
  const fallback = LESSONS[id!]!
  if (seed === undefined) return fallback
  const file = id!.startsWith('v2-') ? `../content/lessons/v2/${{ 'v2-if': 'ifs' }[id!] ?? id!.slice(3)}` : null
  if (!file) return fallback
  const mod = (await import(file)) as Record<string, unknown>
  const make = Object.entries(mod).find(([k, v]) => /Lesson$/.test(k) && typeof v === 'function')?.[1] as ((s: number) => Lesson) | undefined
  return make ? make(seed) : fallback
}

const picture = (p: Prop | undefined): string | null => {
  if (!p) return null
  try {
    return describe({ prop: p, answer: null, verdict: null, heard: [] })
  } catch (e) {
    return `(${p.kind}: could not describe — ${String(e)})`
  }
}

const NAMES: Record<string, string> = { crow: CROW_NAME, robot: 'Robot', courier: 'Mira' }
const said = (b: { say: string; speaker?: string | undefined }) =>
  `**${NAMES[b.speaker ?? 'crow'] ?? b.speaker}:** ${b.say.split('{CROW_NAME}').join(CROW_NAME).split('{CONSOLE}').join('on the right')}`

function beatLines(b: Beat): string[] {
  const out = [`- ${said(b)}`]
  const add = (k: string, v: string | undefined) => v !== undefined && out.push(`  - ${k}: ${v}`)
  add('types into the console', b.types !== undefined ? `\`${b.types}\`` : undefined)
  add('robot thinks', b.thought === '' ? '(nothing)' : b.thought !== undefined ? `\`${b.thought}\`` : undefined)
  add('robot stops with', b.stops)
  add("crow's memory (lines run)", b.memory?.map((l) => `\`${l}\``).join('; '))
  add('memory names lit', b.mark?.join(', '))
  add('editor shows the crow\'s program', b.code !== undefined ? '\n\n```python\n' + b.code + '\n```\n' : undefined)
  add('crow runs it, showing', b.run === undefined ? undefined : b.run === 'end' ? 'the whole run (skipped lines dimmed)' : `just after line ${b.run.line} ran (pass ${b.run.pass ?? 1})`)
  add('stage', picture(b.show) ?? undefined)
  add('cast', b.act?.map((a) => `${a.actor} ${a.do}`).join(', '))
  add('points at', b.focus)
  return out
}

/** Typical misses, as lines the crow could be answering. */
function misses(step: LessonStep): { what: string; line: Line }[] {
  const th = (type: string, repr: string) => ({ type, repr })
  const typed = (source: string, thought: { type: string; repr: string } | null): Line => ({ source, ok: true, error: null, thought })
  const failed = (source: string, error: string): Line => ({ source, ok: false, error, thought: null })
  return [
    { what: 'a word without quotes', line: failed('seven', "NameError: name 'seven' is not defined") },
    { what: 'words in quotes', line: typed('"seven"', th('str', "'seven'")) },
    { what: 'a whole number', line: typed('7', th('int', '7')) },
    { what: 'a number with a dot', line: typed('7.0', th('float', '7.0')) },
    { what: 'True typed by hand', line: typed('True', th('bool', 'True')) },
    { what: 'lower-case true', line: failed('true', "NameError: name 'true' is not defined") },
    { what: 'a line that stops the robot', line: failed('7 +', 'SyntaxError: invalid syntax') },
    ...(step.model ? [{ what: 'one = where == was meant', line: typed(step.model.replace(/==/, '='), null) }] : []),
  ]
}

function stepLines(step: LessonStep, i: number): string[] {
  const out = [`### Step ${i + 1}${step.tag ? ` (${step.tag === 'robot' ? 'the robot works it out' : 'the learner answers'})` : ''}`, '']
  for (const b of step.beats ?? []) out.push(...beatLines(b))
  out.push('', `- **ASK** — ${said(step)}`)
  if (step.ask) out.push(`  - caption under the picture: "${step.ask}"`)
  const pic = picture(step.show)
  if (pic) out.push(`  - stage: ${pic}`)
  if (step.code !== undefined) out.push("  - the editor is handed this program:\n\n```python\n" + step.code + '\n```\n')
  if (step.cases) out.push(`  - the robot tries the program on: ${step.cases.map((c) => Object.entries(c).map(([k, v]) => `${k} = ${v}`).join(', ')).join(' | ')}`)
  if (step.choices) {
    out.push('  - options (shown A, B, C… in a shuffled order):')
    for (const o of step.choices.options) {
      const reply = step.choices.nudge?.(o.id) ?? 'Not that one. Try another.'
      out.push(`    - ${o.id === step.choices.answer ? '✓' : '✗'} ${o.label}${o.id === step.choices.answer ? '' : ` — reply: "${reply}"`}`)
    }
  } else {
    if (step.model) out.push(`  - a right answer (the key): \`${step.model.replace(/\n/g, '⏎')}\``)
    if (step.nudge) {
      out.push('  - replies to typical misses (made-up lines; a reply only shows for a line that did not do the step):')
      for (const m of misses(step)) {
        let reply: string | undefined
        try {
          reply = step.nudge(m.line)
        } catch (e) {
          reply = `(threw: ${String(e)})`
        }
        out.push(`    - ${m.what} (\`${m.line.source}\`): ${reply === undefined ? '(the question again)' : `"${reply}"`}`)
      }
    }
  }
  const praise = typeof step.praise === 'function' ? step.praise({ type: 'int', repr: '7', source: '7' }) : step.praise
  if (praise) out.push(`  - **praise** when done: "${praise}"`)
  out.push('')
  return out
}

function write(lesson: Lesson, seed: number | undefined): string {
  const out = [`## \`${lesson.id}\`${seed !== undefined ? ` — seed ${seed}` : ''}`, '']
  const a = ACTIVITIES.find((x) => x.lesson === lesson.id)
  if (a) {
    const cast = a.scene.actors.map((x) => NAMES[x.id] ?? x.id).join(', ')
    out.push(
      `**${a.title}** — ${a.brief}`,
      '',
      `Scene: ${a.scene.title}${a.scene.backdrop ? ` (backdrop: ${a.scene.backdrop})` : ''}; on stage: ${cast}. ` +
        `The learner types into ${a.mode === 'editor' ? 'a code editor, and presses Run' : 'a console, one line at a time'}; the robot's memory is drawn beside it.`,
      '',
    )
  }
  out.push(`${lesson.steps.length} steps. Teaches: ${lesson.teaches.join(', ') || '(nothing tracked)'}.`, '')
  lesson.steps.forEach((s, i) => out.push(...stepLines(s, i)))
  out.push('### Outro', '')
  const outro = typeof lesson.outro === 'string' ? [{ say: lesson.outro }] : lesson.outro
  for (const b of outro) out.push(...beatLines(b as Beat))
  if (lesson.takeaway) out.push('', `**Takeaway bar:** ${lesson.takeaway}`)
  return out.join('\n')
}

// The first seed in full; each further seed only for the steps that come
// out differently (a seeded lesson's teaching is the same every time, so
// writing it three times only tripled what a reviewer reads).
const runs = seeds.length > 0 ? seeds : [undefined]
const first = await lessonFor(runs[0])
const parts: string[] = [write(first, runs[0])]
const firstSteps = first.steps.map((st, i) => stepLines(st, i).join('\n'))
for (const s of runs.slice(1)) {
  const other = await lessonFor(s)
  const changed = other.steps.map((st, i) => stepLines(st, i).join('\n')).filter((text, i) => text !== firstSteps[i])
  parts.push([`## \`${id}\` — seed ${s}: only the steps that differ from seed ${runs[0]}`, '', ...(changed.length ? changed : ['(none)'])].join('\n'))
}
console.log(parts.join('\n\n---\n\n'))
