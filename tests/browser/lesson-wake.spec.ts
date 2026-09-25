/**
 * Wake the robot (`wake`), played: the editor's level, and a lesson
 * judged on what a run left in memory. A PLACEHOLDER lesson; the content
 * workstream adds §6's four beats before the task.
 */
import { expect, test } from '@playwright/test'
import { open, send } from './helpers'

test('the lesson finishes on the run that wakes the robot, and not before', async ({ page }) => {
  await open(page, 'wake')
  await expect(page.getByTestId('guide')).toHaveAttribute('data-speaker', 'crow')
  await send(page, 'power = 0\nname = "Bolt"\ncharge = 72\n')
  await expect(page.getByTestId('advance')).toHaveCount(0)
  await send(page, 'power = True\nname = "Bolt"\ncharge = 72\n')
  await expect(page.getByTestId('advance')).toBeVisible()
  await expect(page.getByTestId('guide')).toContainText('Awake')
})
