/**
 * Stage 3's ideas, played: a console lesson now, with memory as the
 * picture, where it used to be the collection's page of prose. Every read
 * is the robot's, every write moves an arrow in memory, and the real
 * interpreter answers each one.
 */
import { expect, test, type Page } from '@playwright/test'
import { beat, open, say, skip, targetOf } from './helpers'

/** What slot `label` of the object `name` points at, by its repr. */
const slot = (page: Page, name: string, label: string) =>
  page.evaluate(
    ([n, l]) => {
      const s = window.botgineer.snapshot()
      const id = s.bindings.find((b) => b.name === n)?.target
      const target = id ? s.objects[id]?.elements?.find((e) => e.label === l)?.target : undefined
      return target ? (s.objects[target]?.repr ?? null) : null
    },
    [name, label] as const,
  )

test('Stage 3’s ideas open on Mira’s wrong slot, and every bracket happens in memory', async ({ page }) => {
  await open(page, 's3-ideas')
  await expect(page.getByTestId('guide')).toContainText('wrote into the wrong slot')
  await expect(page.getByTestId('ideas-end')).toHaveCount(0)

  await say(page, 'items = ["a", "b", "c"]')
  expect(await slot(page, 'items', '1')).toBe("'b'")
  // Typed by hand is not a read.
  await say(page, '"b"')
  await expect(page.getByTestId('guide')).toContainText('Let the robot read the slot')
  await say(page, 'items[3]')
  await expect(page.getByTestId('guide')).toContainText('IndexError')
  await say(page, 'items[1]')
  await say(page, 'items[-1]')
  expect((await beat(page)).kind).toBe('praise')

  const list = await targetOf(page, 'items')
  await say(page, 'items[1] = "z"')
  // The same list, changed: no name moved.
  expect(await targetOf(page, 'items')).toBe(list)
  expect(await slot(page, 'items', '1')).toBe("'z'")

  // Predict before running: running it is answered, not accepted.
  await say(page, 'items[1:3]')
  await expect(page.getByTestId('guide')).toContainText('Predict it first')
  await say(page, '3')
  await expect(page.getByTestId('guide')).toContainText('stops before its end')
  await say(page, '2')
  await say(page, 'part = items[1:3]')
  expect(await targetOf(page, 'part')).not.toBe(list)
  expect(await slot(page, 'part', '0')).toBe("'z'")
  expect(await slot(page, 'part', '1')).toBe("'c'")

  await say(page, 'ages = {"ann": 30, "bo": 25}')
  expect(await slot(page, 'ages', "'ann'")).toBe('30')
  await say(page, 'ages["ann"]')
  await say(page, 'ages["cy"]')
  await expect(page.getByTestId('guide')).toContainText('KeyError')
  // A bare None is not said aloud, so the robot is asked for a default.
  await say(page, 'ages.get("cy")')
  await expect(page.getByTestId('guide')).toContainText('Give it a default')
  await say(page, 'ages.get("cy", 0)')
  await say(page, '30 in ages')
  expect((await beat(page)).kind).toBe('praise')

  await say(page, 'grid = [[1, 2], [3, 4]]')
  await say(page, 'grid[1][0]')
  await skip(page)
  await expect(page.getByTestId('takeaway')).toContainText('a key finds its pair')
  await expect(page.getByTestId('advance')).toBeVisible()
})
