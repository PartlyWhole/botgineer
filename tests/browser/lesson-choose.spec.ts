/**
 * Choose the type (`choose`), played. A PLACEHOLDER lesson until
 * workstream C1 writes docs/PEDAGOGY.md §5's twelve questions into
 * `content/lessons/choose.ts`.
 */
import { expect, test } from '@playwright/test'
import { beat, open, say } from './helpers'

test('a question with no hint, a miss answered, and praise that says why', async ({ page }) => {
  await open(page, 'choose')
  await say(page, 'True')
  expect((await beat(page)).kind).toBe('reply')
  await say(page, 'False')
  expect((await beat(page)).kind).toBe('praise')
  await expect(page.getByTestId('guide')).toContainText('bool')
  await expect(page.getByTestId('advance')).toBeVisible()
})
