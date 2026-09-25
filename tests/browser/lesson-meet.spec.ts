/**
 * Meet the robot (`sandbox`, lesson `meet`), played.
 *
 * The lesson is a PLACEHOLDER until workstream C1 writes docs/PEDAGOGY.md
 * §5's script into `content/lessons/meet.ts`; this journey plays it by
 * the test surface and its shape, not its words, so it should survive
 * that rewrite. C1 adds the journeys for the lines themselves (the
 * replies to `seven` and `1,5`) and deletes the `fixme` below, which is
 * the old first lesson's journey kept for reference.
 */
import { expect, test } from '@playwright/test'
import { beat, open, say, skip } from './helpers'

test('the robot is introduced before it is asked anything, and thinks of a number', async ({ page }) => {
  await open(page, 'sandbox')
  // Narration first: the crow talks, and the console waits.
  expect((await beat(page)).asking).toBe(false)
  await expect(page.getByTestId('console-input')).toBeDisabled()
  await skip(page)
  await expect(page.getByTestId('console-input')).toBeEnabled()

  await say(page, '7')
  await expect(page.getByTestId('thought')).toHaveText('7')
  // Thought of and let go: nothing had a name.
  await expect(page.getByTestId('memory')).toContainText('Memory is empty')
  // Finished, and the way on is offered at once (invariant 10); the
  // praise and the closing lines are told first, then the takeaway stays.
  await expect(page.getByTestId('advance')).toBeVisible()
  expect((await beat(page)).kind).toBe('praise')
  await skip(page)
  await expect(page.getByTestId('takeaway')).toBeVisible()
})

/** Lines that answered the old first level right, in order. */
const KINDS = ['True', 'False', '3', '-1', '0.5', '1.4', '12', 'True', '1.5', 'True + True', '2 + 0.5']

test.fixme('the first lesson asks by situation, and the answer is drawn into it (C1: rewrite for meet/types/choose)', async ({ page }) => {
  await open(page, 'sandbox')
  await expect(page.getByTestId('guide')).toContainText('switch')
  await expect(page.getByTestId('prop')).toHaveAttribute('data-prop', 'lamp')
  await expect(page.getByTestId('prop-ask')).toHaveText('Turn the lamp on.')

  // A miss is answered, not repeated — and drawn: the word sits on the
  // lamp as a note, and the lamp stays dark.
  await say(page, '"True"')
  await expect(page.getByTestId('guide')).toContainText('word, for people')
  await expect(page.getByTestId('prop')).toHaveAttribute('aria-label', /dark, with a note/)
  await expect(page.getByTestId('answer-tag')).toContainText('str')

  // Right: the lamp leaves lit, with its answer, and the fish arrives.
  await say(page, 'True')
  await expect(page.getByTestId('prop-leaving')).toHaveAttribute('data-prop', 'lamp')
  await expect(page.locator('[data-testid="prop-leaving"] .lamp')).toHaveClass(/on/)
  await expect(page.getByTestId('prop')).toHaveAttribute('data-prop', 'fish')
  await expect(page.getByTestId('guide')).toContainText('bool')

  await say(page, 'False')
  // An answer typed as the wrong kind shows what goes wrong with it.
  await say(page, '3.0')
  await expect(page.getByTestId('guide')).toContainText('counted')
  await say(page, '3')
  await say(page, '1.5')
  await expect(page.getByTestId('guide')).toContainText('Stuck between floors')
  await expect(page.getByTestId('prop')).toHaveAttribute('aria-label', /stuck between floors/)

  for (const line of KINDS.slice(3)) await say(page, line)
  await expect(page.getByTestId('guide')).toContainText('fits inside the next')
  await expect(page.getByTestId('prop')).toHaveAttribute('data-prop', 'kinds')
  // Memory stayed empty the whole way: nothing had a name.
  await expect(page.getByTestId('memory')).toContainText('Memory is empty')
  await expect(page.getByTestId('advance')).toBeVisible()
})
