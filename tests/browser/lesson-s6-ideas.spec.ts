/**
 * Stage 6's ideas, played: a console lesson now, with memory as the
 * picture, where it used to be the collection's page of prose. Every
 * claim a beat makes about what a loop is handed is checked here against
 * real CPython's memory.
 */
import { expect, test, type Page } from '@playwright/test'
import { beat, open, say } from './helpers'

/** A name's object, written out the way Python would, from memory. */
const shape = (page: Page, name: string) =>
  page.evaluate((n) => {
    const s = window.botgineer.snapshot()
    const out = (id: string): string => {
      const o = s.objects[id]!
      if (o.kind === 'value') return o.repr
      const parts = (o.elements ?? []).map((e) => out(e.target)).join(', ')
      return o.type === 'list' ? `[${parts}]` : o.type === 'tuple' ? `(${parts})` : `<${o.type}>`
    }
    const b = s.bindings.find((x) => x.name === n)
    return b ? out(b.target) : null
  }, name)

test('Stage 6’s ideas: what a loop is handed, predicted, then seen in memory', async ({ page }) => {
  await open(page, 's6-ideas')
  await expect(page.getByTestId('guide')).toContainText('got the names of things back, not the prices')
  await expect(page.getByTestId('ideas-end')).toHaveCount(0)

  await say(page, 'prices = {"tea": 3, "jam": 5}')
  await say(page, 'got = []')
  await page.evaluate(() => window.botgineer.skip())
  await expect(page.getByTestId('guide')).toContainText('Type the list you expect')
  // Predict before running: asking the robot is answered, not accepted.
  await say(page, 'list(prices)')
  await expect(page.getByTestId('guide')).toContainText('Predict it first')
  await say(page, '[3, 5]')
  expect((await beat(page)).kind).toBe('praise')
  await expect(page.getByTestId('guide')).toContainText('`[3, 5]`, you say'.replace(/`/g, ''))

  // A block that lost its indent is answered, and not accepted.
  await say(page, 'for x in prices:\ngot.append(x)\n')
  await expect(page.getByTestId('guide')).toContainText('four spaces')
  await say(page, 'for x in prices:\n    got.append(x)\n')
  expect(await shape(page, 'got')).toBe("['tea', 'jam']")
  expect(await shape(page, 'x')).toBe("'jam'")

  await say(page, 'got = list(prices.items())')
  expect(await shape(page, 'got')).toBe("[('tea', 3), ('jam', 5)]")

  await say(page, 'total = 0')
  await expect(page.getByTestId('guide')).toContainText('Now the loop')
  await say(page, 'for k, v in prices.items():\n    total = total + v\n')
  expect(await shape(page, 'total')).toBe('8')

  await say(page, 'cheap = [k for k, v in prices.items() if v < 4]')
  expect(await shape(page, 'cheap')).toBe("['tea']")

  await say(page, 'squares = (n * n for n in range(3))')
  expect(await shape(page, 'squares')).toBe('<generator>')
  await say(page, 'first = list(squares)')
  await say(page, 'again = list(squares)')
  expect(await shape(page, 'first')).toBe('[0, 1, 4]')
  expect(await shape(page, 'again')).toBe('[]')

  await say(page, 'nums = list(enumerate("tea"))')
  expect(await shape(page, 'nums')).toBe("[(0, 't'), (1, 'e'), (2, 'a')]")

  // The outro's zip is true to Python too.
  await say(page, 'zipped = list(zip("ab", [3, 5]))')
  expect(await shape(page, 'zipped')).toBe("[('a', 3), ('b', 5)]")
  await expect(page.getByTestId('takeaway')).toContainText('only one walk')
  await expect(page.getByTestId('advance')).toBeVisible()
})
