/**
 * Wake the robot (`wake`), played: the editor's level, and a lesson
 * judged on what a run left in memory. Four beats before the task — the
 * robot asleep, the editor, Run, the fixtures — then the task.
 */
import { expect, test } from '@playwright/test'
import { beat, open, send } from './helpers'

test('the editor arrives, Run is shown, then the task', async ({ page }) => {
  await open(page, 'wake')
  await expect(page.getByTestId('guide')).toHaveAttribute('data-speaker', 'crow')
  await expect(page.getByTestId('actor-robot')).toHaveAttribute('data-asleep', 'yes')
  const next = () => page.evaluate(() => window.botgineer.next())

  await next()
  await expect(page.getByTestId('instrument')).toHaveAttribute('data-focus', 'yes')
  expect((await beat(page)).text).toContain('whole list of instructions')
  await next()
  await expect(page.getByTestId('run')).toHaveClass(/pulse/)
  await next()
  expect((await beat(page)).text).toContain('lamp')
  await next()
  expect(await beat(page)).toMatchObject({ kind: 'ask', asking: true })
  await expect(page.getByTestId('ask-tag')).toBeVisible()
})

test('the lesson finishes on the run that wakes the robot, and not before', async ({ page }) => {
  await open(page, 'wake')
  await send(page, 'power = 0\nname = "Bolt"\ncharge = 72\n')
  await expect(page.getByTestId('advance')).toHaveCount(0)
  await expect(page.getByTestId('actor-robot')).toHaveAttribute('data-asleep', 'yes')
  await send(page, 'power = True\nname = "Bolt"\ncharge = 72\n')
  await expect(page.getByTestId('advance')).toBeVisible()
  await expect(page.getByTestId('guide')).toContainText('Awake')
  await expect(page.getByTestId('actor-robot')).toHaveAttribute('data-asleep', 'no')
  await page.evaluate(() => window.botgineer.skip())
  await expect(page.getByTestId('takeaway')).toContainText('program')
})
