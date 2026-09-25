/**
 * Working things out (`operations`), played: every operation drawn, and
 * none of the answers kept.
 */
import { expect, test } from '@playwright/test'
import { OPS, open, reprs, say } from './helpers'

test('the operations lesson works things out, drawn, and keeps none of them', async ({ page }) => {
  await open(page, 'operations')
  await expect(page.getByTestId('guide')).toContainText('7 * 6')
  await expect(page.getByTestId('prop')).toHaveAttribute('data-prop', 'crates')

  // Typing the answer is not asking the robot.
  await say(page, '42')
  await expect(page.getByTestId('guide')).toContainText('let the robot')
  await say(page, '7 * 6')
  await expect(page.getByTestId('thought')).toHaveText('42')

  // Whole litres only leave one in the jug — in the picture, too.
  await say(page, '9 // 2')
  await expect(page.getByTestId('guide')).toContainText('one is left in the jug')
  await expect(page.getByTestId('prop')).toHaveAttribute('aria-label', /Each tank gets 4\./)
  await say(page, '9 / 2')
  await say(page, '8 / 2')
  await expect(page.getByTestId('thought')).toHaveText('4.0')

  // One equals sign is not a question, and real Python says so.
  for (const line of OPS.slice(3, 5)) await say(page, line)
  await say(page, '2 + 2 = 4')
  await expect(page.getByTestId('console-error').last()).toContainText('SyntaxError')
  await expect(page.getByTestId('guide')).toContainText('give it a name')

  for (const line of OPS.slice(5)) await say(page, line)
  await expect(page.getByTestId('thought')).toHaveText('20')
  await expect(page.getByTestId('guide')).toContainText('nobody else ever knew it')
  expect(await reprs(page)).toEqual([])
  await expect(page.getByTestId('advance')).toBeVisible()
})
