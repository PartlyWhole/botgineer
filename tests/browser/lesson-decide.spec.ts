/**
 * Making Choices, played: `if`, `else`, an `if` inside a loop and a
 * `break` under one, every block typed into the console the way a player
 * types it, and judged on what it left in memory.
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

/** A block as a player types it: each line (indent included), Enter
 *  after each, and Enter again on the blank line that closes it. */
async function block(page: Page, ...lines: string[]) {
  await skip(page)
  const input = page.getByTestId('console-input')
  await input.click()
  // A line that failed stays in the input to be mended; start clean.
  await input.fill('')
  // The console indents after a colon (and keeps the indent otherwise).
  // Each line here carries its own indent, so only the difference is
  // typed: Backspace in the indent goes back a level, as a player would
  // before an \`else:\`.
  let auto = 0
  for (const l of lines) {
    const want = l.length - l.trimStart().length
    for (let d = auto; d > want; d -= 4) await page.keyboard.press('Backspace')
    await page.keyboard.type(' '.repeat(Math.max(0, want - auto)) + l.trimStart())
    await page.keyboard.press('Enter')
    auto = want + (l.trimEnd().endsWith(':') ? 4 : 0)
  }
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('robot-panel')).toHaveAttribute('data-busy', 'no', { timeout: 60_000 })
}

test('Making Choices: the robot asks, and the answer decides which lines run', async ({ page }) => {
  await open(page, 'decide')
  await expect(page.getByTestId('guide')).toContainText('van')

  await say(page, 'weight = 12')
  // Answering it yourself is not the robot comparing.
  await say(page, 'True')
  await expect(page.getByTestId('guide')).toContainText('you answered it')
  await say(page, 'weight > 10')
  await expect(page.getByTestId('thought')).toHaveText('True')
  expect((await beat(page)).kind).toBe('praise')

  // A header without its colon stops the robot, and is answered.
  await say(page, 'if weight > 10')
  await expect(page.getByTestId('guide')).toContainText('colon')
  // A body typed without its indent stops the robot, and memory still
  // shows what the robot has: a failed line is never kept, so nothing in
  // memory changed.
  await block(page, 'if weight > 10:', 'ride = "van"')
  await expect(page.getByTestId('guide')).toContainText('spaces in front')
  await expect(page.getByTestId('memory')).not.toContainText('Memory is empty')
  await expect(page.getByTestId('node-weight')).toBeVisible()
  expect(await bound(page)).toEqual({ weight: '12' })
  // Pointing `ride` by hand chooses for the robot: the same memory as the
  // block, and not the step.
  await say(page, 'ride = "van"')
  await expect(page.getByTestId('guide')).toContainText('Let the robot decide')
  expect((await beat(page)).kind).toBe('reply')
  await block(page, 'if weight > 10:', '    ride = "van"')
  expect(await bound(page)).toMatchObject({ weight: '12', ride: "'van'" })
  expect((await beat(page)).kind).toBe('praise')

  await say(page, 'weight = 3')
  // Predict: the block would say "truck", but its question answers False.
  await say(page, '"truck"')
  await expect(page.getByTestId('guide')).toContainText('skipped')
  await say(page, '"van"')
  expect((await beat(page)).kind).toBe('praise')
  expect(await bound(page)).toMatchObject({ weight: '3', ride: "'van'" })

  // And `ride = "bike"` by hand is not the `else` block either.
  await say(page, 'ride = "bike"')
  await expect(page.getByTestId('guide')).toContainText('Let the robot decide')
  expect((await beat(page)).kind).toBe('reply')
  await block(page, 'if weight > 10:', '    ride = "van"', 'else:', '    ride = "bike"')
  expect(await bound(page)).toMatchObject({ ride: "'bike'" })

  await say(page, 'heavy = []')
  // A block inside a block, one indent deeper.
  await block(page, 'for w in [12, 3, 15]:', '    if w > 10:', '        heavy.append(w)')
  expect(await bound(page)).toMatchObject({ heavy: '[12, 15]', w: '15' })

  // One `=` in the question is a SyntaxError, and is named.
  await block(page, 'for w in [12, 3, 15]:', '    if w = 3:', '        break')
  await expect(page.getByTestId('guide')).toContainText('==')
  await block(page, 'for w in [12, 3, 15]:', '    if w == 3:', '        break')
  expect(await bound(page)).toMatchObject({ w: '3', heavy: '[12, 15]' })

  await skip(page)
  await expect(page.getByTestId('takeaway')).toContainText('only when its condition is')
  await expect(page.getByTestId('advance')).toBeVisible()
})
