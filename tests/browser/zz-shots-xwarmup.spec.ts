import { expect, test } from '@playwright/test'
import { beat, open, say, send } from './helpers'
const DIR = '/private/tmp/claude-501/-Users-alan-BotGineer/79cf2d19-82cc-4fb8-84d9-57dd456116c3/scratchpad/shots/'
test('shots', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, 'sandbox')
  for (let i = 0; i < 4; i++) await page.evaluate(() => window.botgineer.next())
  await page.waitForTimeout(2500)
  await page.screenshot({ path: DIR + 'X-warmup-1.png' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await open(page, 'names')
  await say(page, '7 * 6')
  await say(page, 'x = 10')
  await say(page, 'x')
  await say(page, 'y = x')
  await say(page, 'y = 5')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: DIR + 'X-warmup-2.png' })
  await open(page, 'wake')
  await send(page, 'power = 0\nname = "Bolt"\ncharge = 72\n')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: DIR + 'X-warmup-3.png' })
  await open(page, 'types')
  await say(page, 'True')
  await say(page, '-1')
  await say(page, '0.5')
  for (let i = 0; i < 20; i++) {
    const b = await beat(page)
    if (b.text.includes('either kind')) break
    await page.evaluate(() => window.botgineer.next())
  }
  await page.waitForTimeout(2500)
  await page.screenshot({ path: DIR + 'X-warmup-4.png' })
  expect(true).toBe(true)
})
