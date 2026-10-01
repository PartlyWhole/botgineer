/**
 * Everything a lesson review reads, for a list of lessons, in one folder
 * (docs/LESSON-REVIEW.md): each lesson's script (`<id>.md`, three seeds
 * for a seeded lesson, the second and third only where they differ) and
 * its storyboard (`<id>-board/`). Then run the `review-lessons` workflow
 * on the folder.
 *
 *   npx tsx scripts/review-prep.ts <out-dir> <lesson-id> [lesson-id ...]
 *
 * Needs the dev server for the storyboards. No agents: this is the cheap
 * part, about 1 s a script and 20–140 s a storyboard.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const [out, ...ids] = process.argv.slice(2)
if (!out || ids.length === 0) {
  console.error('usage: review-prep <out-dir> <lesson-id> [lesson-id ...]')
  process.exit(1)
}
mkdirSync(out, { recursive: true })
const tsx = (args: string[]) => execFileSync('npx', ['tsx', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const seeded = (id: string) => id.startsWith('v2-') && id !== 'v2-meet'

for (const id of ids) {
  const t = performance.now()
  writeFileSync(`${out}/${id}.md`, tsx(['scripts/lesson-script.ts', id, ...(seeded(id) ? ['1', '2', '3'] : [])]))
  const board = tsx(['scripts/storyboard.ts', id, `${out}/${id}-board`, '1']).trim()
  console.log(`${id}: ${board} (${((performance.now() - t) / 1000).toFixed(0)} s)`)
}
writeFileSync(`${out}/lessons.json`, JSON.stringify({ dir: out, lessons: ids }, null, 2) + '\n')
console.log(`\nThen: the review-lessons workflow, with args ${JSON.stringify({ dir: out, lessons: ids })}`)
