/**
 * Stage 8's ideas, played: a console lesson now, with memory as the
 * picture, where it used to be the collection's page of prose. The
 * blocks go in the way a player types them — Enter on the blank line
 * sends one — and every claim is checked in the robot's own memory.
 */
import { expect, test, type Page } from '@playwright/test'
import { beat, open, say, skip, targetOf } from './helpers'

const snapshot = (page: Page) => page.evaluate(() => window.botgineer.snapshot())

const typeOf = async (page: Page, name: string) => {
  const s = await snapshot(page)
  const id = s.bindings.find((b) => b.name === name)?.target
  return id ? s.objects[id]?.type : undefined
}

const itemsOf = async (page: Page, name: string) => {
  const s = await snapshot(page)
  const id = s.bindings.find((b) => b.name === name)?.target
  return id ? (s.objects[id]?.elements?.length ?? null) : null
}

test('Stage 8’s ideas open on Mira’s problem, and every call happens in memory', async ({ page }) => {
  await open(page, 's8-ideas')
  await expect(page.getByTestId('guide')).toContainText('came back changed')
  await expect(page.getByTestId('ideas-end')).toHaveCount(0)

  // `def` builds a function object and runs nothing.
  await say(page, 'def double(n):\n    n = n * 2\n    return n\n')
  expect(await typeOf(page, 'double')).toBe('function')
  expect(await targetOf(page, 'n')).toBeNull()
  expect((await beat(page)).kind).toBe('praise')

  await say(page, 'x = 5')
  const five = await targetOf(page, 'x')
  // Arriving at the prediction asks it; `x = 5` is not a miss.
  await skip(page)
  expect((await beat(page)).kind).toBe('ask')
  // Predict before running: running it is answered, not accepted.
  await say(page, 'double(x)')
  await expect(page.getByTestId('guide')).toContainText('Predict it first')
  await expect(page.getByTestId('echo').last()).toHaveText('10')
  // Rebinding the parameter moved nothing of the caller's, and the call's
  // names are gone with it.
  expect(await targetOf(page, 'x')).toBe(five)
  expect(await targetOf(page, 'n')).toBeNull()
  await say(page, '5')
  // It has run already, so the prediction also finished the check.
  expect((await beat(page)).kind).toBe('praise')

  await say(page, 'def add(item, items=[]):\n    items.append(item)\n    return items\n')
  expect(await typeOf(page, 'add')).toBe('function')
  await say(page, 'things = ["a"]')
  await say(page, 'same = add("b", things)')
  expect(await itemsOf(page, 'things')).toBe(2)
  expect(await targetOf(page, 'same')).toBe(await targetOf(page, 'things'))

  await say(page, '2')
  expect((await beat(page)).kind).toBe('praise')
  await say(page, 'add("x")')
  await say(page, 'add("y")')
  // The one list is the function's own default, with both items in it.
  const s = await snapshot(page)
  const fn = s.objects[(await targetOf(page, 'add'))!]!
  const shared = fn.elements?.find((e) => e.label === 'default 1')?.target
  expect(s.objects[shared!]?.elements?.length).toBe(2)

  await skip(page)
  await expect(page.getByTestId('takeaway')).toContainText('The object is shared and the name is not')
  await expect(page.getByTestId('advance')).toBeVisible()
})
