/**
 * Stage 5's ideas, played: a console lesson, with memory as the picture,
 * where it used to be the collection's page of prose. Every loop here is
 * a real two-line block typed into the console, closed by a blank line.
 */
import { expect, test, type Page } from '@playwright/test'
import { beat, open, say, skip } from './helpers'

/** What each name points at, by repr; a list, slot by slot. */
const bound = (page: Page) =>
  page.evaluate(() => {
    const s = window.botgineer.snapshot()
    const show = (id: string): string => {
      const o = s.objects[id]
      if (!o) return '?'
      return o.elements ? `[${o.elements.map((e) => show(e.target)).join(', ')}]` : o.repr
    }
    return Object.fromEntries(s.bindings.map((b) => [b.name, show(b.target)]))
  })

/** A block as a player types it: the header, Enter, the body indented,
 *  Enter, and Enter again on the blank line that closes it. */
async function block(page: Page, header: string, body: string) {
  await skip(page)
  const input = page.getByTestId('console-input')
  await input.click()
  await page.keyboard.type(header)
  await page.keyboard.press('Enter')
  await page.keyboard.type(`    ${body}`)
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('robot-panel')).toHaveAttribute('data-busy', 'no', { timeout: 60_000 })
}

test('Stage 5’s ideas open on Mira’s total, and every loop happens in memory', async ({ page }) => {
  await open(page, 's5-ideas')
  await expect(page.getByTestId('guide')).toContainText('the total comes out wrong')
  await expect(page.getByTestId('ideas-end')).toHaveCount(0)

  await say(page, 'parcels = [5, 7, 4]')
  await say(page, 'total = 0')
  // Predict before running: a sum the robot works out is not a prediction.
  await say(page, '5 + 7 + 4')
  await expect(page.getByTestId('guide')).toContainText('Predict it first')
  await say(page, '16')
  expect((await beat(page)).kind).toBe('praise')

  // A body with no indent is not inside the loop, and is answered.
  await say(page, 'for p in parcels:\ntotal = total + p\n')
  await expect(page.getByTestId('guide')).toContainText('spaces in front')
  await block(page, 'for p in parcels:', 'total = total + p')
  expect(await bound(page)).toMatchObject({ total: '16', p: '4', parcels: '[5, 7, 4]' })
  expect((await beat(page)).kind).toBe('praise')

  await say(page, '2')
  await expect(page.getByTestId('guide')).toContainText('how often the body runs')
  await say(page, '3')

  await block(page, 'for p in parcels:', 'p = p * 2')
  // The loop name moved; the list did not.
  expect(await bound(page)).toMatchObject({ p: '8', parcels: '[5, 7, 4]' })

  // The robot counts, and lets the list go: memory keeps only what has a name.
  await say(page, 'list(range(0, 9, 3))')
  await expect(page.getByTestId('thought')).toHaveText('[0, 3, 6]')
  expect(Object.keys(await bound(page)).sort()).toEqual(['p', 'parcels', 'total'])

  await block(page, 'for p in parcels:', 'break')
  expect(await bound(page)).toMatchObject({ p: '5' })

  await say(page, '[]')
  await expect(page.getByTestId('guide')).toContainText('slides the rest left')
  await say(page, '[7]')
  await block(page, 'for p in parcels:', 'parcels.remove(p)')
  expect(await bound(page)).toMatchObject({ parcels: '[7]', p: '4' })

  await skip(page)
  await expect(page.getByTestId('takeaway')).toContainText('exist before the loop starts')
  await expect(page.getByTestId('advance')).toBeVisible()
})
