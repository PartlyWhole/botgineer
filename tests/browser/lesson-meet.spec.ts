/**
 * Meet the robot (`sandbox`, lesson `meet`), played end to end through
 * the test surface: the introductions, the misses a newcomer makes (each
 * one visible in the robot's cloud or the console, and answered by
 * name), one number thought of, and the thought let go.
 */
import { expect, test } from '@playwright/test'
import { CROW_NAME } from '../../content/cast'
import { beat, open, say, skip } from './helpers'

test('the robot is introduced before it is asked anything', async ({ page }) => {
  await open(page, 'sandbox')
  const first = await beat(page)
  expect(first).toMatchObject({ at: 0, kind: 'beat', speaker: 'crow', listening: true })
  expect(first.text).toContain(CROW_NAME)
  await expect(page.getByTestId('console-input')).toBeDisabled()

  // Walk the introductions: the robot sleeps, wakes, the console
  // pulses where the typing goes, and the robot shows what a thought looks like.
  const seen = { asleep: false, pulse: false, demo: false }
  while ((await beat(page)).listening) {
    const now = await page.evaluate(() => ({
      asleep: document.querySelector('[data-testid="actor-robot"]')?.getAttribute('data-asleep') === 'yes',
      pulse: document.querySelector('[data-testid="instrument"]')?.classList.contains('pulse') === true,
      demo: document.querySelector('[data-testid="thought"]')?.textContent === '7',
    }))
    seen.asleep ||= now.asleep
    seen.pulse ||= now.pulse
    seen.demo ||= now.demo
    await page.evaluate(() => window.botgineer.next())
  }
  expect(seen).toEqual({ asleep: true, pulse: true, demo: true })
  const ask = await beat(page)
  expect(ask).toMatchObject({ kind: 'ask', asking: true, text: 'Make the robot think of a number.' })
  await expect(page.getByTestId('ask-tag')).toContainText('You answer')
  await expect(page.getByTestId('console-input')).toBeEnabled()
})

test('the misses are shown and named, then a number is thought of and let go', async ({ page }) => {
  await open(page, 'sandbox')
  await skip(page)

  // A number word stops the robot: there is nothing to think of.
  await say(page, 'seven')
  expect(await beat(page)).toMatchObject({ kind: 'reply', asking: true })
  await expect(page.getByTestId('guide')).toContainText("doesn't know the word seven")
  await expect(page.getByTestId('thought')).toHaveCount(0)

  // A comma where the decimal point goes: named for what it is.
  await say(page, '1,5')
  await expect(page.getByTestId('guide')).toContainText('dot, not a comma: 1.5')

  // Digits in quotes are a word.
  await say(page, '"7"')
  await expect(page.getByTestId('thought')).toHaveText("'7'")
  await expect(page.getByTestId('guide')).toContainText('quotes make that a word')

  // A yes-or-no is not a number either.
  await say(page, 'True')
  await expect(page.getByTestId('thought')).toHaveText('True')
  await expect(page.getByTestId('guide')).toContainText('yes-or-no, not a number')

  await say(page, '7')
  await expect(page.getByTestId('thought')).toHaveText('7')
  expect(await beat(page)).toMatchObject({ kind: 'praise', listening: true })
  await expect(page.getByTestId('guide')).toContainText("It's thinking of 7, because that's what you wrote.")
  // Thought of and let go: nothing had a name.
  await expect(page.getByTestId('memory')).toContainText('Memory is empty')
  // Finished, and the way on is offered at once (invariant 10).
  await expect(page.getByTestId('advance')).toBeVisible()

  await page.evaluate(() => window.botgineer.next())
  expect((await beat(page)).kind).toBe('outro')
  await expect(page.getByTestId('guide')).toContainText('It thinks of whatever you write.')
  await page.evaluate(() => window.botgineer.next())
  // The last line lets the thought go, and the cloud goes with it.
  await expect(page.getByTestId('guide')).toContainText('lets the thought go')
  await expect(page.getByTestId('thought')).toHaveCount(0)
  await expect(page.getByTestId('takeaway')).toContainText('thinks of whatever you write')
})

test('a sum typed is worked out, and the praise says so', async ({ page }) => {
  await open(page, 'sandbox')
  await say(page, '3 + 4')
  await expect(page.getByTestId('thought')).toHaveText('7')
  await expect(page.getByTestId('guide')).toContainText('it worked that out from what you wrote')
})
