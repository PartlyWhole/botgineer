/**
 * Taking an order (`order`), played: the courier asks, the robot answers
 * from what it stored, and the last lesson of the unit still has somewhere
 * to send you.
 */
import { expect, test } from '@playwright/test'
import { WARM_UP, open, say, seedProgress } from './helpers'

test('the courier asks, and the robot answers from what it stored', async ({ page }) => {
  await open(page, 'order')
  // The courier does the talking in this one, not the crow.
  await expect(page.getByTestId('guide')).toHaveAttribute('data-speaker', 'courier')
  await expect(page.getByTestId('waiting')).toContainText('customer')
  await expect(page.locator('[data-testid="actor-ticket"] .sign-body')).toHaveText('no customer')

  await say(page, 'customer = "Mira"')
  // Storing a name is visible in the world, not just in memory.
  await expect(page.locator('[data-testid="actor-ticket"] .sign-body')).toHaveText('Mira')
  await expect(page.getByTestId('waiting')).toHaveCount(0)

  await say(page, 'parcels = 7')
  await expect(page.getByTestId('guide')).toContainText('two kilos')

  // The answer was never stored, and was never said out loud by anyone.
  await say(page, 'parcels * 2')
  await expect(page.getByTestId('echo').last()).toHaveText('14')
  await expect(page.getByTestId('guide')).toContainText('Fourteen')
})

test('the last lesson offers somewhere to go, and only once it is done', async ({ page }) => {
  await seedProgress(page, [...WARM_UP, 'names'])
  await open(page, 'order')
  await expect(page.getByTestId('advance')).toHaveCount(0)

  await say(page, 'customer = "Mira"')
  await say(page, 'parcels = 7')
  await expect(page.getByTestId('advance')).toHaveCount(0)
  await say(page, 'parcels * 2')

  // This used to be the end of the road: the crow said its piece and
  // there was nothing on screen to do next.
  await expect(page.getByTestId('guide')).toContainText('Fourteen')
  await page.getByTestId('advance').click()
  expect(page.url()).toContain('#/map')
  // Which unlocks the unit's practice, bouncing on the way back.
  await expect(page.locator('[data-cheer="unlocked"] [data-testid="level-practice-remembering"]')).toHaveCount(1)
})

