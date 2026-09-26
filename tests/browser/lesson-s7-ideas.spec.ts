/**
 * Stage 7's ideas, played: nested loops typed at the console as two-line
 * blocks, with memory as the picture, where it used to be the
 * collection's page of prose.
 */
import { expect, test, type Page } from '@playwright/test'
import { beat, open, say, skip, targetOf } from './helpers'

/** A block, closed by the empty line that ends it at the console. */
const block = (page: Page, ...lines: string[]) => say(page, `${lines.join('\n')}\n`)

const reprOf = (page: Page, name: string) =>
  page.evaluate((n) => {
    const s = window.botgineer.snapshot()
    const id = s.bindings.find((b) => b.name === n)?.target
    return id ? (s.objects[id]?.repr ?? null) : null
  }, name)

const gridSlots = (page: Page) =>
  page.evaluate(() => {
    const s = window.botgineer.snapshot()
    const id = s.bindings.find((b) => b.name === 'grid')?.target
    return (id ? s.objects[id]?.elements ?? [] : []).map((e) => e.target)
  })

test('Stage 7’s ideas open on Mira’s search, and every idea happens in memory', async ({ page }) => {
  await open(page, 's7-ideas')
  await expect(page.getByTestId('guide')).toContainText('carried on looking through every other shelf')
  await expect(page.getByTestId('ideas-end')).toHaveCount(0)

  // The inner loop runs through before the outer moves on: the printout.
  await block(page, 'for r in range(2):', '    for c in range(2): print(r, c)')
  await expect(page.getByTestId('robot-panel')).toContainText('0 0\n0 1\n1 0\n1 1')
  expect(await reprOf(page, 'r')).toBe('1')
  expect(await reprOf(page, 'c')).toBe('1')

  await say(page, 'n = 0')
  // Predict before running: running it is answered, not accepted.
  await say(page, 'n')
  await expect(page.getByTestId('guide')).toContainText('Predict it first')
  await say(page, '5')
  await expect(page.getByTestId('guide')).toContainText('Multiply')
  await say(page, '6')
  expect((await beat(page)).kind).toBe('praise')
  await block(page, 'for r in range(3):', '    for c in range(2): n = n + 1')
  expect(await reprOf(page, 'n')).toBe('6')

  // break leaves only the inner loop.
  await say(page, '0')
  await expect(page.getByTestId('guide')).toContainText('left both loops')
  await say(page, '2')
  await block(page, 'for shelf in range(3):', '    for spot in range(2): break')
  expect(await reprOf(page, 'shelf')).toBe('2')
  expect(await reprOf(page, 'spot')).toBe('0')

  // One row, shared; then a fresh row on every pass.
  await say(page, 'grid = []')
  await say(page, 'row = []')
  await say(page, 'for r in range(2): grid.append(row)')
  const shared = await gridSlots(page)
  expect(shared).toHaveLength(2)
  expect(shared[0]).toBe(shared[1])
  expect(shared[0]).toBe(await targetOf(page, 'row'))
  await say(page, 'grid = []')
  await say(page, 'for r in range(2): grid.append([])')
  const fresh = await gridSlots(page)
  expect(fresh).toHaveLength(2)
  expect(fresh[0]).not.toBe(fresh[1])

  await skip(page)
  await expect(page.getByTestId('takeaway')).toContainText('multiply the passes')
  await expect(page.getByTestId('advance')).toBeVisible()
})
