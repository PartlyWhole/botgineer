/**
 * The names lesson (`names`), played: a name is an arrow, and finishing it
 * is the way back to the map. It has no beats yet, so it plays exactly as
 * before them — and the journeys type through `say`, which skips any
 * narration a rewrite adds.
 */
import { expect, test } from '@playwright/test'
import { WARM_UP, open, say, seedProgress } from './helpers'

test('the naming lesson teaches that a name is an arrow', async ({ page }) => {
  await open(page, 'names')
  await expect(page.getByTestId('guide')).toContainText('x = 10')

  await say(page, 'x = 10')
  // Reading it back is a step of its own: the point is that it was simply
  // there, where the previous lesson would have had to recompute it.
  // Backticks in a lesson render as a code chip, so they are not in the text.
  await expect(page.getByTestId('guide')).toContainText('pointing at')
  await say(page, 'x')
  await expect(page.getByTestId('thought')).toHaveText('10')
  await say(page, 'y = x')
  // One object, two names on it.
  expect(
    await page.evaluate(() => {
      const s = window.botgineer.snapshot()
      return new Set(s.bindings.map((b) => b.target)).size
    }),
  ).toBe(1)

  await say(page, 'x = 99')
  const bound = await page.evaluate(() =>
    Object.fromEntries(
      window.botgineer
        .snapshot()
        .bindings.map((b) => [b.name, window.botgineer.snapshot().objects[b.target]?.repr]),
    ),
  )
  // x moved; y did not.
  expect(bound).toEqual({ x: '99', y: '10' })

  // Rebinding x makes step one false again, so progress would slide back
  // to the start if it were read from the current snapshot alone.
  await expect(page.getByTestId('guide')).toContainText('it never held it')
})

test('finishing a lesson offers the way back to the map, and only then', async ({ page }) => {
  await seedProgress(page, WARM_UP)
  await open(page, 'names')
  await expect(page.getByTestId('advance')).toHaveCount(0)

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
