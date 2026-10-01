/**
 * v2, the editor lesson `v2-loops`, played in the production page against
 * real Python: every program sent from the editor and judged on the cases
 * the robot tries it on, every pick judged, the crow's runs shown.
 */
import { expect, test, type Page } from '@playwright/test'
import { loopsLesson } from '../../content/lessons/v2/loops'
import { beat } from './helpers'

const SEED = Number(process.env.SEED ?? 3)

async function openSeeded(page: Page) {
  await page.goto(`./?seed=${SEED}#/v2-loops`)
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
}

test('every step played from the editor, then the takeaway', { tag: '@v2' }, async ({ page }) => {
  test.setTimeout(240_000)
  await openSeeded(page)
  const lesson = loopsLesson(SEED)
  for (const [i, step] of lesson.steps.entries()) {
    if (step.choices) {
      await page.evaluate(() => window.botgineer.skip())
      await page.getByTestId(`choice-${step.choices.answer}`).click()
    } else {
      // A step that hands over a broken program: Run it as given first,
      // and the crow names what is wrong with it.
      if (step.code && (step.ask === 'Fix the program' || step.ask === 'Fix the loop')) {
        await page.evaluate((p) => window.botgineer.send(p), step.code!)
        await expect.poll(async () => (await beat(page)).kind).toBe('reply')
      }
      await page.evaluate((p) => window.botgineer.send(p), step.model!)
    }
    await expect.poll(async () => (await beat(page)).kind, { message: `step ${i}: ${step.say}` }).toMatch(/praise|outro/)
  }
  await page.evaluate(() => window.botgineer.skip())
  await expect(page.getByTestId('takeaway')).toBeVisible()
})
