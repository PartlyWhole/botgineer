/**
 * A lesson's storyboard: the whole screen at every beat, played in the
 * real page against real Python, each question answered with the lesson's
 * own key (`model`, or a choice's `answer`). For a reviewer checking that
 * what is said is what is shown (docs/LESSON-REVIEW.md).
 *
 *   npx tsx scripts/storyboard.ts <lesson-id> <out-dir> [seed] [width] [height] [--every]
 *
 * By default a beat is shot only when the screen changes on it: a new
 * picture, a line typed or a program shown, the crow's memory or a run
 * moment, the cast acting, a part of the screen pointed at — and every
 * question, praise and outro line. A beat that only says something over
 * the same screen is listed in `index.md` against the last shot, not shot
 * again: screenshots are most of what a picture reviewer reads, and most
 * of what it costs. `--every` shoots every beat. A beat that types a
 * line is also shot early (`-typing`), while the line is going in, since
 * the settled frame cannot show whether the typing kept pace with the
 * words (once a lesson: the pace is the console's, the same for every
 * line). A beat that changes only the stage is shot as the stage alone
 * (`-stage`), about half the pixels of the whole screen.
 *
 * Needs the dev server (`npm run dev`, http://localhost:5173). Writes
 * `NN-MM-<kind>.png` (step NN, beat MM) and `index.md`, which lists each
 * shot beside the line being said, so a shot can be cited by its name.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { LESSONS, type Lesson } from '../content/lessons'

const every = process.argv.includes('--every')
const [id, out, seedArg, w = '1280', h = '800'] = process.argv.slice(2).filter((a) => a !== '--every')
if (!id || !out || !LESSONS[id]) {
  console.error('usage: storyboard <lesson-id> <out-dir> [seed] [width] [height]')
  process.exit(1)
}
const seed = seedArg ? Number(seedArg) : 1

async function lessonFor(): Promise<Lesson> {
  if (!id!.startsWith('v2-')) return LESSONS[id!]!
  const file = `../content/lessons/v2/${{ 'v2-if': 'ifs' }[id!] ?? id!.slice(3)}`
  const mod = (await import(file)) as Record<string, unknown>
  const make = Object.entries(mod).find(([k, v]) => /Lesson$/.test(k) && typeof v === 'function')?.[1] as ((s: number) => Lesson) | undefined
  return make ? make(seed) : LESSONS[id!]!
}

const lesson = await lessonFor()
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } })
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`http://localhost:5173/?seed=${seed}#/${id}`)
await page.waitForSelector('.app[data-boot="ready"]', { timeout: 60_000 })
const editor = (await page.evaluate(() => (window as any).botgineer.state().mode)) === 'editor'
const beat = () => page.evaluate(() => (window as any).botgineer.beat()) as Promise<{ at: number; of: number; text: string; kind: string; speaker: string; asking: boolean }>
const index: string[] = [`# Storyboard: \`${id}\`, seed ${seed}`, '']
const pad = (n: number) => String(n).padStart(2, '0')
/** One early shot of typing is enough: it checks the console's pace, which
 *  is the same for every typed line. */
let typingShot = false
/** The robot's panel changes on this beat (or it is a question, an answer
 *  or the end), so the whole screen is shot; otherwise only the stage,
 *  about half the pixels a reviewer has to read. */
const robotSide = (b: B | undefined, kind: string) =>
  kind !== 'beat' || !b || b.types !== undefined || b.memory !== undefined || b.mark !== undefined || b.code !== undefined || b.run !== undefined || b.focus !== undefined

/** What a beat changes on screen, from the lesson itself: anything set
 *  means a new frame. The beats of step `s` (1-based), or the outro. */
function beatsOf(s: number) {
  const st = lesson.steps[s - 1]
  const list = st ? (st.beats ?? []) : typeof lesson.outro === 'string' ? [] : lesson.outro
  return list as { show?: unknown; types?: string; code?: string; run?: unknown; memory?: unknown; mark?: unknown; act?: unknown; focus?: unknown; thought?: string }[]
}
type B = ReturnType<typeof beatsOf>[number]
/** The beat puts something new on the screen, against the beat before it:
 *  a line typed, the cast acting, a part pointed at, or a picture, program,
 *  run moment, memory, lit names or thought that differs. A lesson repeats
 *  the same picture and memory beat after beat, so "is it set?" is not
 *  the question; "is it different?" is. */
const changes = (b: B | undefined, before: B | undefined) => {
  if (!b) return true
  if (b.types !== undefined || b.act !== undefined || b.focus !== undefined) return true
  const same = (k: keyof B) => b[k] === undefined || JSON.stringify(b[k]) === JSON.stringify(before?.[k])
  return !(['show', 'code', 'run', 'memory', 'mark', 'thought'] as const).every(same)
}

/** Shoots the lines from where the step's telling is now to its rest. */
async function shootStep(step: number) {
  let last = ''
  for (let guard = 0; guard < 40; guard++) {
    const b = await beat()
    // Which of the step's own beats this is: the script may start with
    // the praise of the step before.
    const praised = step > 1 && lesson.steps[step - 2]?.praise !== undefined ? 1 : 0
    const own = b.kind === 'beat' || b.kind === 'outro' ? beatsOf(step)[b.at - (b.kind === 'beat' ? praised : 0)] : undefined
    const ownAt = b.at - (b.kind === 'beat' ? praised : 0)
    const shoot = every || (b.kind !== 'beat' && b.kind !== 'outro') || ownAt === 0 || changes(own, beatsOf(step)[ownAt - 1])
    if (own?.types !== undefined && !typingShot) {
      typingShot = true
      await page.waitForTimeout(600)
      const early = `${pad(step)}-${pad(b.at)}-typing.png`
      await page.screenshot({ path: `${out}/${early}` })
      index.push(`- \`${early}\` — (0.6 s in, while \`${own.types}\` is typed)`)
    }
    // Let the line type itself out and the picture's demonstration play.
    await page.waitForTimeout(own?.types !== undefined ? 1200 : 1800)
    if (shoot) {
      const whole = robotSide(own, b.kind)
      last = `${pad(step)}-${pad(b.at)}-${b.kind}${whole ? '' : '-stage'}.png`
      if (whole) await page.screenshot({ path: `${out}/${last}` })
      else await page.locator('.scene-pane').screenshot({ path: `${out}/${last}` })
      index.push(`- \`${last}\` — **${b.speaker}** (${b.kind}): ${b.text}`)
    } else {
      index.push(`- (same screen as \`${last}\`) — **${b.speaker}** (${b.kind}): ${b.text}`)
    }
    if (b.asking || b.at >= b.of - 1) return b
    // Next, until the line has really moved on: the first press after an
    // answer can land on the test surface of the render before, and be
    // lost (it then shot one beat twice).
    for (let tries = 0; tries < 10 && (await beat()).at === b.at; tries++) {
      await page.evaluate(() => (window as any).botgineer.next())
      await page.waitForTimeout(150)
    }
  }
  return beat()
}

for (const [i, step] of lesson.steps.entries()) {
  index.push('', `## Step ${i + 1}`, '')
  const asked = await shootStep(i + 1)
  if (step.choices) {
    await page.evaluate(() => (window as any).botgineer.skip())
    const button = page.getByTestId(`choice-${step.choices.answer}`)
    if (!(await button.isVisible().catch(() => false))) {
      // Not the question this step asks: an earlier answer did not land.
      index.push('', `**Stopped:** step ${i + 1} expected options with \`${step.choices.answer}\`, but the screen asks: "${asked.text}"`)
      break
    }
    await button.click()
  } else if (editor) {
    await page.evaluate((m) => (window as any).botgineer.send(m), step.model!)
  } else {
    for (const l of (step.model ?? '').split('\n')) await page.evaluate((x) => (window as any).botgineer.say(x), l)
  }
  await page.waitForTimeout(300)
  const after = await beat()
  if (after.kind !== 'praise' && after.kind !== 'outro') {
    index.push('', `**Stopped:** the key for step ${i + 1} (\`${step.model ?? step.choices?.answer}\`) did not do it; the screen says: "${after.text}"`)
    break
  }
}
index.push('', '## Outro', '')
await shootStep(lesson.steps.length + 1)
if (errors.length) index.push('', '## Page errors', '', ...errors.map((e) => `- ${e}`))
writeFileSync(`${out}/index.md`, index.join('\n') + '\n')
await browser.close()
console.log(`${index.filter((l) => l.startsWith('- `')).length} shots, ${index.filter((l) => l.startsWith('- (same')).length} beats on a screen already shot → ${out}`)
