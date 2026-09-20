import { expect, test, type Page } from '@playwright/test'

/** Waits for the shared runtime. The tutorial is the default route. */
async function boot(page: Page) {
  await page.goto('./#/tutorial')
  await expect(page.getByTestId('boot-badge')).toContainText('Python ready', { timeout: 60_000 })
}

/** Says something to the robot and waits for the run to settle. The
 *  conversation's own busy flag is the signal, so there is nothing to
 *  sleep on and no run can be left in flight. */
async function say(page: Page, source: string) {
  // Waiting only on the busy flag races: it is still 'no' in the instant
  // between pressing Enter and the run starting. A reply always adds at
  // least two turns (yours, and the robot's), so wait for both.
  const before = await page.locator('.turn').count()
  const input = page.getByTestId('composer-input')
  await input.fill(source)
  await input.press('Enter')
  await expect
    .poll(() => page.locator('.turn').count(), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(before + 2)
  await expect(page.getByTestId('conversation')).toHaveAttribute('data-busy', 'no', {
    timeout: 60_000,
  })
}

const tiles = (page: Page) => page.locator('.tile')

test('the crow opens the lesson with an empty memory', async ({ page }) => {
  await boot(page)
  await expect(page.getByTestId('crow-line')).toContainText('memory is empty')
  await expect(page.getByTestId('progress')).toContainText('step 1 of 6')
  await expect(tiles(page)).toHaveCount(0)
})

test('typing a value makes an object appear, with its real type', async ({ page }) => {
  await boot(page)
  await say(page, '10')

  await expect(tiles(page)).toHaveCount(1)
  const tile = page.getByTestId('tile-0')
  await expect(tile).toHaveAttribute('data-type', 'int')
  await expect(tile).toContainText('10')
  // The robot reports back with the value, the way Python prints it.
  await expect(page.locator('.turn.robot').last()).toContainText("That's an int")
  await expect(page.locator('.turn.robot code.made').last()).toHaveText('10')
  await expect(page.getByTestId('progress')).toContainText('step 2 of 6')
})

test('a value of the wrong type is still a real object, and the crow just asks again', async ({
  page,
}) => {
  await boot(page)
  await say(page, '"John"')

  // Nothing is taken away for being wrong.
  await expect(tiles(page)).toHaveCount(1)
  await expect(page.getByTestId('tile-0')).toHaveAttribute('data-type', 'str')
  await expect(page.getByTestId('progress')).toContainText('step 1 of 6')
  await expect(page.locator('.turn.crow-turn').last()).toContainText('whole number')
})

test('scalars carry no identity and containers do', async ({ page }) => {
  await boot(page)
  await say(page, '10')
  await say(page, '[1, 2, 3]')

  // CPython interns small ints; claiming an identity for them would teach
  // something false, so the engine gives scalars none and neither do we.
  await expect(page.getByTestId('tile-0').locator('.tile-id')).toHaveCount(0)
  await expect(page.getByTestId('tile-1').locator('.tile-id')).toHaveCount(1)
})

test('two equal lists are two different objects', async ({ page }) => {
  await boot(page)
  await say(page, '[1, 2, 3]')
  await say(page, '[1, 2, 3]')

  await expect(tiles(page)).toHaveCount(2)
  const first = await page.getByTestId('tile-0').locator('.tile-id').innerText()
  const second = await page.getByTestId('tile-1').locator('.tile-id').innerText()
  expect(first).not.toBe(second)
  await expect(page.getByTestId('tile-0')).toContainText('[1, 2, 3]')
  await expect(page.getByTestId('tile-1')).toContainText('[1, 2, 3]')
})

test('a line that is not an expression is explained and not kept', async ({ page }) => {
  await boot(page)
  await say(page, '10')
  await say(page, 'x = 5')

  // The robot reports the failure; the crow explains it. Never the same voice.
  await expect(page.locator('.turn.robot').last()).toContainText('SyntaxError')
  await expect(page.locator('.turn.crow-turn').last()).toContainText('not a value')
  // The failed line must not poison the session.
  await expect(tiles(page)).toHaveCount(1)
  await say(page, '"John"')
  await expect(tiles(page)).toHaveCount(2)
})

test('the suggestion fills the box but never sends it', async ({ page }) => {
  await boot(page)
  await page.getByTestId('suggestion').click()
  await expect(page.getByTestId('composer-input')).toHaveValue('10')
  await expect(tiles(page)).toHaveCount(0)

  await page.getByTestId('send').click()
  await expect(tiles(page)).toHaveCount(1, { timeout: 60_000 })
})

test('the conversation opens with the robot, then the crow', async ({ page }) => {
  await boot(page)
  await expect(page.locator('.turn').first()).toHaveClass(/robot/)
  await expect(page.locator('.turn').first()).toContainText('memory is completely empty')
  await expect(page.locator('.turn.crow-turn').first()).toContainText('Type a number')
})

test('what the player says is shown as their own code', async ({ page }) => {
  await boot(page)
  await say(page, '10')
  const mine = page.locator('.turn.you').last()
  await expect(mine).toContainText('10')
  await expect(mine.locator('code')).toHaveCount(1)
})

test('the lesson text renders its marks, and never leaves them on screen', async ({ page }) => {
  await boot(page)
  await say(page, '"John"')
  // The crow's nudge mentions `10`; a literal backtick on screen would be
  // teaching the opposite of the thing being taught.
  const crow = page.locator('.turn.crow-turn').last()
  await expect(crow.locator('code.inline').first()).toBeVisible()

  // And the same for emphasis, which the lesson text also uses.
  await say(page, 'x = 5')
  const transcript = page.locator('.convo-scroll')
  await expect(transcript.locator('em').first()).toBeVisible()
  expect(await transcript.innerText()).not.toMatch(/[`*]/)
})

test('the prompt recalls history with the arrow keys', async ({ page }) => {
  await boot(page)
  await say(page, '10')
  await say(page, '"John"')

  const input = page.getByTestId('composer-input')
  await input.press('ArrowUp')
  await expect(input).toHaveValue('"John"')
  await input.press('ArrowUp')
  await expect(input).toHaveValue('10')
  await input.press('ArrowDown')
  await expect(input).toHaveValue('"John"')
})

test('the whole lesson can be completed, and started over', async ({ page }) => {
  await boot(page)
  for (const s of ['10', '"John"', '3.5', 'True', '[1, 2, 3]', '[1, 2, 3]']) await say(page, s)

  await expect(page.getByTestId('progress')).toContainText('lesson complete')
  await expect(tiles(page)).toHaveCount(6)
  await expect(tiles(page).nth(5)).toHaveAttribute('data-type', 'list')

  await page.getByTestId('restart').click()
  await expect(tiles(page)).toHaveCount(0)
  await expect(page.getByTestId('progress')).toContainText('step 1 of 6')
})

test('the two lessons are separate routes and both deep-link', async ({ page }) => {
  await page.goto('./#/parcels')
  await expect(page.getByTestId('run')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('run')).toBeVisible()

  await page.getByTestId('route-tutorial').click()
  await expect(page.getByTestId('composer-input')).toBeVisible()
  expect(page.url()).toContain('#/tutorial')
})
