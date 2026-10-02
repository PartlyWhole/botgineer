/**
 * v2, Lists (`v2-lists`), played in the production page against real
 * Python: every model line builds the goal in the robot's real memory,
 * picks are judged, and the shared list is the very same object.
 */
import { expect, test, type Page } from '@playwright/test'
import { listsLesson } from '../../content/lessons/v2/lists'
import { beat, say } from './helpers'

const SEED = 3

async function openSeeded(page: Page) {
  await page.goto(`./?seed=${SEED}#/v2-lists`)
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
}

test('taught, then the backpack: packed, added to, counted, looked up, swapped and shared', { tag: '@v2' }, async ({ page }) => {
  test.setTimeout(180_000)
  await openSeeded(page)
  const lesson = listsLesson(SEED)
  for (const [i, step] of lesson.steps.entries()) {
    if (step.choices) {
      await page.evaluate(() => window.botgineer.skip())
      await page.getByTestId(`choice-${step.choices.answer}`).click()
    } else {
      // The eight start from a memory wiped for the player, on the beat
      // that says so (or as the step begins, for `wipeFirst`): the praise
      // before it is read over the hotbar, and reaching the ask has wiped.
      const wipes = (step.beats ?? []).some((b) => b.wipe)
      if (wipes) {
        expect(await page.evaluate(() => window.botgineer.snapshot().bindings.length)).toBeGreaterThan(0)
        await page.evaluate(() => window.botgineer.skip())
      }
      if (step.wipeFirst || wipes) {
        await expect
          .poll(() => page.evaluate(() => window.botgineer.snapshot().bindings.length))
          .toBe(0)
      }
      // A slip on the way: the wrong item appended, which nothing taught
      // takes back out. The crow says to undo, and Undo does.
      if (step.model === 'hotbar.append("map")') {
        await say(page, 'hotbar.append("mapp")')
        await expect.poll(async () => (await beat(page)).text).toMatch(/appended the wrong item. Undo/)
        await page.getByTestId('memory-undo').click()
        await expect
          .poll(() => page.evaluate(() => window.botgineer.snapshot().bindings.length))
          .toBe(1)
      }
      for (const line of step.model!.split('\n')) await say(page, line)
    }
    await expect.poll(async () => (await beat(page)).kind, { message: `step ${i}: ${step.say}` }).toMatch(/praise|outro/)
  }
  // `bag` and `backpack` point at one object.
  const same = await page.evaluate(() => {
    const b = window.botgineer.snapshot().bindings
    return b.find((x) => x.name === 'bag')?.target === b.find((x) => x.name === 'backpack')?.target
  })
  expect(same).toBe(true)
  await page.evaluate(() => window.botgineer.skip())
  await expect(page.getByTestId('takeaway')).toBeVisible()
})
