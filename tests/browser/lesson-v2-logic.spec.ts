/**
 * v2, Asking Questions (`v2-logic`), played in the production page against
 * real Python: Mira's card typed into memory, every question asked of it by
 * its model line, every pick judged — and a question answered by hand is
 * refused, then the robot asks it.
 */
import { expect, test, type Page } from '@playwright/test'
import { logicLesson } from '../../content/lessons/v2/logic'
import { beat, say } from './helpers'

const SEED = Number(process.env.SEED ?? 5)

async function openSeeded(page: Page) {
  await page.goto(`./?seed=${SEED}#/v2-logic`)
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
}

test('comparisons, ==, in, and, or, not, and an answer kept', { tag: '@v2' }, async ({ page }) => {
  test.setTimeout(180_000)
  await openSeeded(page)
  const lesson = logicLesson(SEED)
  for (const [i, step] of lesson.steps.entries()) {
    if (step.choices) {
      await page.evaluate(() => window.botgineer.skip())
      await page.getByTestId(`choice-${step.choices.answer}`).click()
    } else {
      // The answer typed by hand is refused: the robot is to ask.
      if (step.model === 'hp > 20') {
        await say(page, 'True')
        await expect.poll(async () => (await beat(page)).text).toMatch(/Let the robot ask it/)
      }
      for (const line of step.model!.split('\n')) await say(page, line)
    }
    await expect.poll(async () => (await beat(page)).kind, { message: `step ${i}: ${step.say}` }).toMatch(/praise|outro/)
  }
  await page.evaluate(() => window.botgineer.skip())
  await expect(page.getByTestId('takeaway')).toBeVisible()
})
