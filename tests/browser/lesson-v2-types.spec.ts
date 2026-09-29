/**
 * v2, Basic data types (`v2-types`), played through in the production
 * page with a fixed seed: the four types taught and asked in turn, then
 * the quiz, picking on the stage and typing to the robot.
 */
import { expect, test, type Page } from '@playwright/test'
import { quiz } from '../../content/lessons/v2/types'
import { beat, say } from './helpers'

const SEED = 7

/** The typed answer to a quiz question, as a line for the console. */
function lineFor(step: ReturnType<typeof quiz>[number]): string {
  const candidates = [
    'True', 'False', '3', '4', '5', '6', '7', '8', '24.5', '52.5', '61.5', '18.5',
    '"Bolt"', '"Sprocket"', '"Pip"', '"True"',
  ]
  const toThought = (src: string) =>
    src.startsWith('"')
      ? { type: 'str', repr: `'${src.slice(1, -1)}'` }
      : src === 'True' || src === 'False'
        ? { type: 'bool', repr: src }
        : { type: src.includes('.') ? 'float' : 'int', repr: src }
  const hit = candidates.find((c) =>
    step.done({ snapshot: { bindings: [], objects: {}, line: 1 }, thoughts: [toThought(c)], history: [] }),
  )
  if (!hit) throw new Error(`no answer for: ${step.say}`)
  return hit
}

async function openSeeded(page: Page) {
  await page.goto(`./?seed=${SEED}#/v2-types`)
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
}

test('four types taught in turn, then a quiz of picking and typing', { tag: '@v2' }, async ({ page }) => {
  await openSeeded(page)

  // Taught: each asked straight after it is named.
  for (const answer of ['True', '4', '36.5', '"0412 555 019"']) {
    await say(page, answer)
    await expect.poll(async () => (await beat(page)).kind).toBe('praise')
  }

  for (const step of quiz(SEED)) {
    if (step.choices) {
      await page.evaluate(() => window.botgineer.skip())
      // Picked on the stage; the console stays shut.
      await expect(page.getByTestId('choices')).toBeVisible()
      await expect(page.getByTestId('console-input')).toBeDisabled()
      const wrong = step.choices.options.find((o) => o.id !== step.choices!.answer)!.id
      await page.getByTestId(`choice-${wrong}`).click()
      await expect(page.getByTestId(`choice-${wrong}`)).toHaveAttribute('data-tried', 'yes')
      await expect.poll(async () => (await beat(page)).kind).toBe('reply')
      await page.getByTestId(`choice-${step.choices.answer}`).click()
    } else {
      await say(page, lineFor(step))
    }
    await expect.poll(async () => (await beat(page)).kind).toMatch(/praise|outro/)
  }

  await page.evaluate(() => window.botgineer.skip())
  await expect(page.getByTestId('takeaway')).toBeVisible()
  await page.getByTestId('advance').click()
  await expect(page).toHaveURL(/#\/v2$/)
})
