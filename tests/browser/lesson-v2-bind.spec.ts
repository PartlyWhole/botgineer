/**
 * v2, Memories (`v2-bind`), played in the production page: the crow's
 * demonstration memory is drawn by real Python, the player's lines build
 * the goals in the robot's real memory, and the wipe starts it over
 * without losing the lesson's place.
 */
import { expect, test, type Page } from '@playwright/test'
import { bindLesson } from '../../content/lessons/v2/bind'
import { beat, say } from './helpers'

const SEED = 4

async function openSeeded(page: Page) {
  await page.goto(`./?seed=${SEED}#/v2-bind`)
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
}

const names = (page: Page) =>
  page.evaluate(() => window.botgineer.snapshot().bindings.map((b) => b.name).sort())

test("the crow's demonstration draws x pointing at 1, framed as the crow's", { tag: '@v2' }, async ({ page }) => {
  await openSeeded(page)
  await expect
    .poll(async () => {
      const b = await beat(page)
      if (!/points the name `x` at it/.test(b.text)) await page.evaluate(() => window.botgineer.next())
      return b.text
    })
    .toMatch(/points the name `x` at it/)
  await expect(page.getByTestId('memory-view')).toContainText('x')
  // Narration only: the robot's own memory is still empty.
  expect(await names(page)).toEqual([])
})

test('taught, then every goal built in real memory, with wipes', { tag: '@v2' }, async ({ page }) => {
  test.setTimeout(180_000)
  await openSeeded(page)
  const lesson = bindLesson(SEED)
  for (const [i, step] of lesson.steps.entries()) {
    if (step.choices) {
      await page.evaluate(() => window.botgineer.skip())
      await page.getByTestId(`choice-${step.choices.answer}`).click()
    } else {
      // The goals begin with the robot's memory wiped for the player, on
      // the beat that says so: the praise before it is still read over
      // what the player made, and reaching the ask has wiped.
      if (step.wipeFirst) await expect.poll(() => names(page)).toEqual([])
      if ((step.beats ?? []).some((b) => b.wipe)) {
        expect(await names(page)).not.toEqual([])
        await page.evaluate(() => window.botgineer.skip())
        await expect.poll(() => names(page)).toEqual([])
      }
      if (i === lesson.steps.length - 1) {
        await page.evaluate(() => window.botgineer.skip())
        await page.getByTestId('memory-reset').click()
      }
      for (const line of step.model!.split('\n')) await say(page, line)
    }
    await expect.poll(async () => (await beat(page)).kind, { message: `step ${i}: ${step.say}` }).toMatch(/praise|outro/)
  }
  // The last goal: only `total`, from scratch.
  expect(await names(page)).toEqual(['total'])
  await page.evaluate(() => window.botgineer.skip())
  await expect(page.getByTestId('takeaway')).toBeVisible()
})
