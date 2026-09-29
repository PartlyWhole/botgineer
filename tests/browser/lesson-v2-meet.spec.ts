/**
 * v2, Meet the robot (`v2-meet`), played in the production page: the
 * crow types two demonstrations into the console, the robot thinks of
 * each only once it is in, and the player's own number finishes it and
 * goes back to the v2 map.
 */
import { expect, test } from '@playwright/test'
import { beat, open, say } from './helpers'

test('the crow types its example, then the player types their own', { tag: ['@smoke', '@v2'] }, async ({ page }) => {
  await open(page, 'v2-meet')
  // Walk to the first demonstration.
  await expect.poll(async () => {
    const b = await beat(page)
    if (!/I type `7`/.test(b.text)) await page.evaluate(() => window.botgineer.next())
    return b.text
  }).toMatch(/I type `7`/)

  // It is typed, never run, and the robot's thought waits for it.
  await expect(page.getByTestId('demo-echo')).toHaveText('7', { timeout: 10_000 })
  await expect(page.getByTestId('thought')).toHaveText('7')
  await expect(page.getByTestId('demo-exchange')).toContainText('7')

  // The question clears it, and the player's own line does the step.
  await say(page, '12')
  await expect(page.getByTestId('demo-exchange')).toHaveCount(0)
  await expect(page.getByTestId('thought')).toHaveText('12')
  await expect.poll(async () => (await beat(page)).kind).toBe('praise')

  await page.evaluate(() => window.botgineer.skip())
  await page.locator('.advance').click()
  await expect(page).toHaveURL(/#\/v2$/)
})
