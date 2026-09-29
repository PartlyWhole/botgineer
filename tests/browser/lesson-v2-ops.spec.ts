/**
 * v2, Working things out (`v2-ops`), played through in the production
 * page with fixed seeds: every typed sum is worked out by real CPython and
 * must agree with the lesson's key, and every pick is made wrong first,
 * then right. The TypeError is demonstrated before it is asked about.
 */
import { expect, test, type Page } from '@playwright/test'
import { opsLesson } from '../../content/lessons/v2/ops'
import { beat, say } from './helpers'

async function openSeeded(page: Page, seed: number) {
  await page.goto(`./?seed=${seed}#/v2-ops`)
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
}

/** Answers one step: a pick, wrong first then right, or its model sum. */
async function answer(page: Page, step: ReturnType<typeof opsLesson>['steps'][number], i: number) {
  if (step.choices) {
    await page.evaluate(() => window.botgineer.skip())
    await expect(page.getByTestId('choices')).toBeVisible()
    const wrong = step.choices.options.find((o) => o.id !== step.choices!.answer)!.id
    await page.getByTestId(`choice-${wrong}`).click()
    await expect.poll(async () => (await beat(page)).kind).toBe('reply')
    await page.getByTestId(`choice-${step.choices.answer}`).click()
  } else {
    await say(page, step.model!)
  }
  await expect.poll(async () => (await beat(page)).kind, { message: `step ${i}: ${step.say}` }).toMatch(/praise|outro/)
}

async function play(page: Page, seed: number) {
  const lesson = opsLesson(seed)
  for (const [i, step] of lesson.steps.entries()) {
    // A number typed by hand is refused: the robot is to work it out.
    if (i === 0) {
      await say(page, '42')
      await expect.poll(async () => (await beat(page)).kind).toBe('reply')
    }
    await answer(page, step, i)
  }
  await page.evaluate(() => window.botgineer.skip())
  await expect(page.getByTestId('takeaway')).toBeVisible()
}

test('the crow shows a word plus a number stopping the robot, before asking', { tag: '@v2' }, async ({ page }) => {
  await openSeeded(page, 1)
  const lesson = opsLesson(1)
  for (let i = 0; i < 4; i++) await answer(page, lesson.steps[i]!, i)
  await expect
    .poll(async () => {
      const b = await beat(page)
      if (!/can't be added to a number/.test(b.text)) await page.evaluate(() => window.botgineer.next())
      return b.text
    })
    .toMatch(/can't be added to a number/)
  await expect(page.getByTestId('demo-error')).toContainText('TypeError', { timeout: 10_000 })
})

for (const seed of [2, 5]) {
  test(`every sum agrees with real Python, and every pick is judged (seed ${seed})`, { tag: '@v2' }, async ({ page }) => {
    test.setTimeout(180_000)
    await openSeeded(page, seed)
    await play(page, seed)
  })
}
