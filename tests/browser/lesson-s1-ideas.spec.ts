/**
 * Stage 1's ideas, played: a console lesson now, with memory as the
 * picture, where it used to be the collection's page of prose.
 */
import { expect, test } from '@playwright/test'
import { beat, open, reprs, say, skip } from './helpers'

test('Stage 1’s ideas open on the bridge, and every idea happens in memory', async ({ page }) => {
  await open(page, 's1-ideas')
  await expect(page.getByTestId('guide')).toContainText('other people write the programs')
  await page.evaluate(() => window.botgineer.next())
  await expect(page.getByTestId('guide')).toContainText('A good engineer knows what the robot will do before it does it.')
  // No page of prose: the ideas sheet is gone.
  await expect(page.getByTestId('ideas-end')).toHaveCount(0)

  await say(page, 'total = 5')
  await say(page, 'total = total + 1')
  // Predict before running: running it is answered, not accepted.
  await say(page, 'total = total + 1')
  await expect(page.getByTestId('guide')).toContainText('Predict it first')
  // The line has run, so the arrow is already at 7; typing it answers.
  await say(page, '7')
  expect((await beat(page)).kind).toBe('praise')
  await say(page, 'shown = print(total)')
  await say(page, 'a = [10, 20]')
  await say(page, 'b = a')
  await say(page, 'id(a) == id(b)')
  await say(page, 'c = [10, 20]')
  await say(page, 'id(c) == id(a)')
  expect(await reprs(page)).toContain('None')
  await skip(page)
  await expect(page.getByTestId('takeaway')).toContainText('see which arrow moves')
  await expect(page.getByTestId('advance')).toBeVisible()
})
