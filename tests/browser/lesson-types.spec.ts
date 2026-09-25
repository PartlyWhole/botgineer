/**
 * Five data types (`types`), played.
 *
 * A PLACEHOLDER lesson until workstream C1 writes docs/PEDAGOGY.md §5
 * into `content/lessons/types.ts`. What this pins is what the level must
 * keep whatever its words: Mira is in the scene but off stage until a
 * beat brings her on.
 */
import { expect, test } from '@playwright/test'
import { open, say, skip } from './helpers'

test('Mira waits off stage until a beat brings her on', async ({ page }) => {
  await open(page, 'types')
  await expect(page.getByTestId('actor-courier')).toHaveAttribute('data-offstage', 'yes')
  await expect(page.getByTestId('actor-courier')).not.toBeVisible()
  await say(page, 'True')
  await skip(page)
  await expect(page.getByTestId('actor-courier')).toHaveAttribute('data-offstage', 'no')
  await expect(page.getByTestId('actor-courier')).toBeVisible()
  await expect(page.getByTestId('advance')).toBeVisible()
})

test.fixme('the strings level: words are for people, and Python agrees (C1: fold into types/choose/operations)', async ({ page }) => {
  // The old `words` level's journey — `hello` without quotes, `"7" + "7"`,
  // a phone number's leading zero, the word "True" on the lamp, and
  // `ord("A")` — is C1's to re-home as those beats move into Level 1 and 2.
  await open(page, 'types')
})
