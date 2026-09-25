/**
 * Stage 4's ideas, played: a console lesson now, with memory as the
 * picture, where it used to be the collection's page of prose. Every
 * claim the crow makes about sharing is checked here against real
 * CPython's memory.
 */
import { expect, test, type Page } from '@playwright/test'
import { beat, open, say, skip, targetOf } from './helpers'

/** The objects a name's list points at, slot by slot. */
const slots = (page: Page, name: string) =>
  page.evaluate((n) => {
    const s = window.botgineer.snapshot()
    const id = s.bindings.find((b) => b.name === n)?.target
    return (id && s.objects[id]?.elements?.map((e) => e.target)) ?? null
  }, name)

test('Stage 4’s ideas: one level copied, every level copied, and one row three times', async ({ page }) => {
  await open(page, 's4-ideas')
  await expect(page.getByTestId('guide')).toContainText('seating plan')
  await expect(page.getByTestId('ideas-end')).toHaveCount(0)

  await say(page, 'plan = [["Ann"], ["Bo"]]')
  // Sharing the list is not a copy: answered, not accepted.
  await say(page, 'new = plan')
  await expect(page.getByTestId('guide')).toContainText('Add [:] to build a new one')
  await say(page, 'new = plan[:]')
  expect(await targetOf(page, 'new')).not.toBe(await targetOf(page, 'plan'))
  expect(await slots(page, 'new')).toEqual(await slots(page, 'plan'))

  // The robot counting is not a prediction.
  await say(page, 'len(plan)')
  await expect(page.getByTestId('guide')).toContainText('Predict it first')
  await say(page, '2')
  expect((await beat(page)).kind).toBe('praise')
  await say(page, 'new.append(["Ed"])')
  expect(await slots(page, 'plan')).toHaveLength(2)
  expect(await slots(page, 'new')).toHaveLength(3)

  await say(page, '["Ann"]')
  await expect(page.getByTestId('guide')).toContainText('same table')
  await say(page, '["Ann", "Flo"]')
  await say(page, 'new[0].append("Flo")')

  await say(page, 'safe = copy.deepcopy(plan)')
  await expect(page.getByTestId('guide')).toContainText('Bring the module in first')
  await say(page, 'import copy')
  await say(page, 'safe = copy.deepcopy(plan)')
  const p = (await slots(page, 'plan'))!
  const d = (await slots(page, 'safe'))!
  expect(d).toHaveLength(2)
  for (const k of [0, 1]) expect(d[k]).not.toBe(p[k])

  await say(page, 'grid = [[0] * 3] * 3')
  const g = (await slots(page, 'grid'))!
  expect(new Set(g).size).toBe(1)
  await say(page, '[1, 0, 0]')
  await say(page, 'grid[0][0] = 1')
  expect((await beat(page)).kind).toBe('praise')
  await skip(page)
  await expect(page.getByTestId('takeaway')).toContainText('which level was copied')
  await expect(page.getByTestId('advance')).toBeVisible()
})
