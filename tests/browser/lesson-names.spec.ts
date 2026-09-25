/**
 * The names lesson (`names`), played: the robot has forgotten, a name is
 * the fix, and a name is an arrow. Finishing it is the way back to the map.
 */
import { expect, test } from '@playwright/test'
import { WARM_UP, beat, open, say, seedProgress } from './helpers'

/** What each name points at, by value. */
const bound = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const s = window.botgineer.snapshot()
    return Object.fromEntries(s.bindings.map((b) => [b.name, s.objects[b.target]?.repr]))
  })

test('the robot has forgotten the crates, and must work them out again', async ({ page }) => {
  await open(page, 'names')
  expect((await beat(page)).text).toContain('seven crates')
  await expect(page.getByTestId('prop')).toHaveAttribute('data-prop', 'crates')
  // The forgetting, demonstrated: a question mark in the cloud.
  await page.evaluate(() => window.botgineer.next())
  await expect(page.getByTestId('thought')).toHaveText('?')

  // Typing the answer from memory is not asking the robot.
  await say(page, '42')
  await expect(page.getByTestId('guide')).toContainText('you remembering')
  // Nor is dressing the remembered answer up as a sum.
  await say(page, '21 * 2')
  await expect(page.getByTestId('guide')).toContainText('not from seven crates of six')
  await say(page, '7 * 6')
  await expect(page.getByTestId('thought')).toHaveText('42')
  await expect(page.getByTestId('guide')).toContainText('because it kept nothing')
  expect(await bound(page)).toEqual({})
})

test('a name is an arrow, and the crow points at it as it appears', async ({ page }) => {
  await open(page, 'names')
  await say(page, '7 * 6')
  await say(page, 'x = 10')
  // Praise first, then the pointing — at the memory pane, which pulses.
  expect((await beat(page)).kind).toBe('praise')
  await page.evaluate(() => window.botgineer.next())
  expect((await beat(page)).text).toContain('Look below')
  await expect(page.locator('.memory-view')).toHaveAttribute('data-focus', 'yes')
  await expect(page.locator('.graph .edge')).toHaveCount(1)
  // The 42 was let go, and the cloud says so.
  await expect(page.getByTestId('thought')).toHaveCount(0)
  // The right `x = 10` is not answered as a miss when the ask comes.
  await page.evaluate(() => window.botgineer.skip())
  expect((await beat(page)).kind).toBe('ask')

  // The bug: typing 10 used to pass "ask for it back".
  await say(page, '10')
  await expect(page.getByTestId('guide')).toContainText('you remembering')
  expect((await beat(page)).kind).toBe('reply')
  await say(page, 'x')
  await expect(page.getByTestId('thought')).toHaveText('10')
  await expect(page.getByTestId('guide')).toContainText('followed the arrow')

  await say(page, 'y = x')
  await expect(page.getByTestId('guide')).toContainText('because y = x points y')
  // One object, two names on it.
  expect(
    await page.evaluate(() => new Set(window.botgineer.snapshot().bindings.map((b) => b.target)).size),
  ).toBe(1)
  await say(page, 'x = 99')
  // x moved; y did not.
  expect(await bound(page)).toEqual({ x: '99', y: '10' })

  // Rebinding x makes step two false again, so progress would slide back
  // if it were read from the current snapshot alone.
  const end = await beat(page)
  expect(end.kind).toBe('outro')
  expect(end.text).toContain('still points where it did')
  await expect(page.locator('.memory-view')).toHaveAttribute('data-focus', 'yes')
  await page.evaluate(() => window.botgineer.skip())
  await expect(page.getByTestId('takeaway')).toContainText('arrow')
})

test('finishing a lesson offers the way back to the map, and only then', async ({ page }) => {
  await seedProgress(page, WARM_UP)
  await open(page, 'names')
  await expect(page.getByTestId('advance')).toHaveCount(0)

  await say(page, '7 * 6')
  await say(page, 'x = 10')
  await expect(page.getByTestId('advance')).toHaveCount(0)
  await say(page, 'x')
  await say(page, 'y = x')
  await say(page, 'x = 99')

  await page.getByTestId('advance').click()
  expect(page.url()).toContain('#/map')
  // Where the level just finished pops and the one it unlocked bounces.
  await expect(page.getByTestId('level-names')).toHaveAttribute('data-state', 'done')
  await expect(page.locator('[data-cheer="done"] [data-testid="level-names"]')).toHaveCount(1)
  await expect(page.locator('[data-cheer="unlocked"] [data-testid="level-order"]')).toHaveCount(1)
})
