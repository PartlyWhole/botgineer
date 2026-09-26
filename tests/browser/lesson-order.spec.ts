/**
 * Taking an order (`order`), played: Mira says it in her words, the crow
 * says it in code, the robot answers from what it stored, and the last
 * lesson of the unit still has somewhere to send you.
 */
import { expect, test } from '@playwright/test'
import { WARM_UP, beat, open, say, seedProgress, skip } from './helpers'

test('Mira talks, the robot keeps it, and works the weight out from what it kept', async ({ page }) => {
  await open(page, 'order')
  // Mira opens, in her own words; the crow asks, in code.
  await expect(page.getByTestId('guide')).toHaveAttribute('data-speaker', 'courier')
  await expect(page.getByTestId('waiting')).toContainText('customer')
  await expect(page.locator('[data-testid="actor-ticket"] .sign-body')).toHaveText('no customer')

  await say(page, 'customer = Mira')
  await expect(page.getByTestId('guide')).toContainText('Without quotes')
  await say(page, 'customer = "Mira"')
  // Storing a name is visible in the world, not just in memory.
  await expect(page.locator('[data-testid="actor-ticket"] .sign-body')).toHaveText('Mira')
  await expect(page.getByTestId('waiting')).toHaveCount(0)
  expect(await beat(page)).toMatchObject({ speaker: 'courier', kind: 'beat' })

  await say(page, 'parcels = 7')
  // The scale arrives with Mira's weight: seven parcels on the floor.
  expect((await beat(page)).text).toContain('two kilos')
  await expect(page.getByTestId('prop')).toHaveAttribute('data-prop', 'scale')

  // The bug: typing the answer, or the seven, used to pass.
  await say(page, '14')
  await expect(page.getByTestId('guide')).toContainText('wrote the answer in yourself')
  await say(page, '7 * 2')
  await expect(page.getByTestId('guide')).toContainText('seven you remember')
  await expect(page.getByTestId('advance')).toHaveCount(0)
  // Kept under a name of its own is right, and said to be; the step still
  // wants the working itself.
  await say(page, 'weight = parcels * 2')
  await expect(page.getByTestId('guide')).toContainText('sum on its own')
  await say(page, 'weight')
  await expect(page.getByTestId('guide')).toContainText('Right, fourteen!')
  await expect(page.getByTestId('advance')).toHaveCount(0)

  // The answer was never stored, and was never said out loud by anyone.
  await say(page, 'parcels * 2')
  await expect(page.getByTestId('echo').last()).toHaveText('14')
  await expect(page.getByTestId('guide')).toContainText('Fourteen')
  await expect(page.getByTestId('prop')).toHaveAttribute('aria-label', /reads 14 kg/)
})

test('the last lesson offers somewhere to go, and only once it is done', async ({ page }) => {
  await seedProgress(page, [...WARM_UP, 'names'])
  await open(page, 'order')
  await expect(page.getByTestId('advance')).toHaveCount(0)

  await say(page, 'customer = "Mira"')
  await say(page, 'parcels = 7')
  await expect(page.getByTestId('advance')).toHaveCount(0)
  await say(page, 'parcels * 2')

  await expect(page.getByTestId('guide')).toContainText('Fourteen')
  // Continue waits for the closing lines, then replaces Next.
  await expect(page.getByTestId('advance')).toHaveCount(0)
  await skip(page)
  await page.getByTestId('advance').click()
  expect(page.url()).toContain('#/map')
  // Which unlocks the unit's practice, bouncing on the way back.
  await expect(page.locator('[data-cheer="unlocked"] [data-testid="level-practice-remembering"]')).toHaveCount(1)
})
