/**
 * A lesson's storyboard: the whole screen at every beat, played in the
 * real page against real Python, each question answered with the lesson's
 * own key (`model`, or a choice's `answer`). For a reviewer checking that
 * what is said is what is shown (docs/LESSON-REVIEW.md).
 *
 *   npx tsx scripts/storyboard.ts <lesson-id> <out-dir> [seed] [width] [height]
 *
 * Needs the dev server (`npm run dev`, http://localhost:5173). Writes
 * `NN-MM-<kind>.png` (step NN, beat MM) and `index.md`, which lists each
 * shot beside the line being said, so a shot can be cited by its name.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { LESSONS, type Lesson } from '../content/lessons'

const [id, out, seedArg, w = '1280', h = '800'] = process.argv.slice(2)
if (!id || !out || !LESSONS[id]) {
  console.error('usage: storyboard <lesson-id> <out-dir> [seed] [width] [height]')
  process.exit(1)
}
const seed = seedArg ? Number(seedArg) : 1

async function lessonFor(): Promise<Lesson> {
  if (!id!.startsWith('v2-')) return LESSONS[id!]!
  const file = `../content/lessons/v2/${{ 'v2-if': 'ifs' }[id!] ?? id!.slice(3)}`
  const mod = (await import(file)) as Record<string, unknown>
  const make = Object.values(mod).find((v): v is (s: number) => Lesson => typeof v === 'function' && (v as (s: number) => Lesson).length === 1)
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

/** Shoots every line from where the step's telling is now to its rest. */
async function shootStep(step: number) {
  for (let guard = 0; guard < 40; guard++) {
    // Let the line type itself out and the picture's demonstration play.
    await page.waitForTimeout(1800)
    const b = await beat()
    const name = `${pad(step)}-${pad(b.at)}-${b.kind}.png`
    await page.screenshot({ path: `${out}/${name}` })
    index.push(`- \`${name}\` — **${b.speaker}** (${b.kind}): ${b.text}`)
    if (b.asking || b.at >= b.of - 1) return b
    await page.evaluate(() => (window as any).botgineer.next())
  }
  return beat()
}

for (const [i, step] of lesson.steps.entries()) {
  index.push('', `## Step ${i + 1}`, '')
  await shootStep(i + 1)
  if (step.choices) {
    await page.getByTestId(`choice-${step.choices.answer}`).click()
  } else if (editor) {
    await page.evaluate((m) => (window as any).botgineer.send(m), step.model!)
  } else {
    for (const l of (step.model ?? '').split('\n')) await page.evaluate((x) => (window as any).botgineer.say(x), l)
  }
}
index.push('', '## Outro', '')
await shootStep(lesson.steps.length + 1)
if (errors.length) index.push('', '## Page errors', '', ...errors.map((e) => `- ${e}`))
writeFileSync(`${out}/index.md`, index.join('\n') + '\n')
await browser.close()
console.log(`${index.filter((l) => l.startsWith('- `')).length} shots → ${out}`)
