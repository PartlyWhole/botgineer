/**
 * Stage 2's ideas, played: changing an object against moving a name,
 * with memory as the picture, where it used to be a page of prose.
 */
import { expect, test } from '@playwright/test'
import { beat, open, reprs, say, skip, targetOf } from './helpers'

const listOf = (page: import('@playwright/test').Page, name: string) =>
  page.evaluate((n) => {
    const s = window.botgineer.snapshot()
    const id = s.bindings.find((b) => b.name === n)?.target
    const o = id ? s.objects[id] : undefined
    if (!o) return null
    if (!o.elements) return o.repr
    return `[${o.elements.map((el) => s.objects[el.target]?.repr).join(', ')}]`
  }, name)

test('Stage 2’s ideas: a change every name sees, and a move only one name makes', async ({ page }) => {
  await open(page, 's2-ideas')
  await expect(page.getByTestId('guide')).toContainText('swears she didn’t touch it')
  await expect(page.getByTestId('ideas-end')).toHaveCount(0)

  await say(page, 'nums = [1, 2]')
  await say(page, 'other = nums')
  await say(page, 'nums.append(3)')
  // Changed, not moved: both names still on one list, which holds the 3.
  expect(await targetOf(page, 'nums')).toBe(await targetOf(page, 'other'))
  expect(await listOf(page, 'other')).toBe('[1, 2, 3]')

  // Predict before running: asking the robot is answered, not accepted.
  await say(page, 'other')
  await expect(page.getByTestId('guide')).toContainText('Predict it first')
  await say(page, '[1, 2, 3]')
  expect((await beat(page)).kind).toBe('praise')
  await say(page, 'nums = nums + [4]')
  expect(await targetOf(page, 'nums')).not.toBe(await targetOf(page, 'other'))
  expect(await listOf(page, 'other')).toBe('[1, 2, 3]')
  expect(await listOf(page, 'nums')).toBe('[1, 2, 3, 4]')

  // A changing method hands back None, and keeping it loses the list.
  // The console echoes no None, so asking bare is answered, not accepted.
  await say(page, 'other.sort()')
  await expect(page.getByTestId('guide')).toContainText('Keep it under a name to see it')
  await say(page, 'other = other.sort()')
  expect(await listOf(page, 'other')).toBe('None')
  expect(await reprs(page)).not.toContain('3 items')

  // += changes a list, and replaces a number.
  await say(page, 'other = nums')
  await expect(page.getByTestId('guide')).toContainText('and watch other')
  await say(page, 'nums += [5]')
  expect(await targetOf(page, 'other')).toBe(await targetOf(page, 'nums'))
  expect(await listOf(page, 'other')).toBe('[1, 2, 3, 4, 5]')
  await say(page, 'n = 10')
  await say(page, 'm = n')
  await say(page, 'n += 1')
  expect(await page.evaluate(() => {
    const s = window.botgineer.snapshot()
    const at = (n: string) => s.objects[s.bindings.find((b) => b.name === n)!.target]!.repr
    return [at('n'), at('m')]
  })).toEqual(['11', '10'])

  await skip(page)
  await expect(page.getByTestId('takeaway')).toContainText('every name on it sees')
  await expect(page.getByTestId('advance')).toBeVisible()
})
