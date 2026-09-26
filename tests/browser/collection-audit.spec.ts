/**
 * Every item of the collection, played in the production page with the
 * key's answers, must come out right first time.
 *
 * The Node sweep (`tests/semantics/collection.sweep.test.ts`) proves the
 * key and the interpreter agree, fast. This proves the *page* agrees with
 * both: the same items, through the workbench's own run queue, its quiet
 * runs, its checker, its grading on commit and its recording — every form
 * the collection uses, in the build that ships, at the sub-path it ships
 * at, with no isolation headers.
 *
 * One test per stage, so a failure says where.
 *
 * Opt-in (`npm run test:audit`): it plays ~214 items and is most of the
 * browser suite's time, while the Node sweep checks the same keys against
 * CPython in seconds. Pull requests run it; everyday runs and deploys do
 * not.
 */
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

type StageJson = { stage: number; exercises: { id: string }[]; checkpoint: { items: { id: string }[] } | null }

const STAGES: StageJson[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(
  (n) => JSON.parse(readFileSync(new URL(`../../content/collection/generated/stage-0${n}.json`, import.meta.url), 'utf8')) as StageJson,
)

const read = <T,>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(([fn, args]) => (window as any).botgineer.read[fn as string](...(args as unknown[])), [fn, args] as const) as Promise<T>

async function playRight(page: Page, id: string): Promise<string | null> {
  await page.evaluate((id) => (window.location.hash = `#/x-${id}`), id)
  await expect.poll(() => read<{ item: string | null }>(page, 'state').then((s) => s.item), { timeout: 30_000 }).toBe(id)
  await expect.poll(() => read(page, 'models'), { timeout: 30_000 }).not.toBeNull()
  const models = (await read<({ kind: string } | null)[]>(page, 'models'))!
  for (const [i, m] of models.entries()) {
    if (m && m.kind !== 'rule') await read(page, 'answer', i, m)
    if (m?.kind === 'rule') await read(page, 'answer', i, { kind: 'rule', text: 'the rule', mark: null })
  }
  await expect.poll(() => read<{ canCommit: boolean }>(page, 'state').then((s) => s.canCommit)).toBe(true)
  await read(page, 'commit')
  for (const [i, m] of models.entries()) if (m?.kind === 'rule') await read(page, 'mark', i, 'right')
  for (const [i, m] of models.entries()) {
    if (m !== null) continue
    const program = await read<string | null>(page, 'program', i)
    if (program) await read(page, 'submit', i, program)
  }
  await expect.poll(() => read<{ outcome: unknown }>(page, 'state').then((s) => s.outcome), { timeout: 30_000 }).not.toBeNull()
  const s = await read<{ outcome: { right: boolean }; graded: ({ right: boolean; expected?: string } | null)[] }>(page, 'state')
  if (s.outcome.right) return null
  return `${id}: ${JSON.stringify(s.graded.filter((g) => g && !g.right))}`
}

test.skip(!process.env.AUDIT, 'the collection audit is opt-in: npm run test:audit')

for (const stage of STAGES) {
  test(`Stage ${stage.stage}: every item, played with the key's answers, is right first time`, async ({ page }) => {
    test.setTimeout(420_000)
    await page.goto('./#/map')
    await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
    const ids = [...stage.exercises.map((e) => e.id), ...(stage.checkpoint?.items ?? []).map((q) => q.id)]
    const wrong: string[] = []
    for (const id of ids) {
      const w = await playRight(page, id)
      if (w) wrong.push(w)
    }
    expect(wrong).toEqual([])
  })
}
