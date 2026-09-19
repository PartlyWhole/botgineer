import { expect, test, type Page } from '@playwright/test'

/** Waits for the shared runtime. The tutorial is the default route. */
async function boot(page: Page) {
  await page.goto('./#/tutorial')
  await expect(page.getByTestId('boot-badge')).toContainText('Python ready', { timeout: 60_000 })
}

/** Types an expression at the prompt and waits for the run to settle.
 *  The prompt's own busy flag is the signal, so there is nothing to sleep
 *  on and no run can be left in flight. */
async function type(page: Page, source: string) {
  const input = page.getByTestId('repl-input')
  await input.fill(source)
  await input.press('Enter')
  await expect(page.getByTestId('repl')).toHaveAttribute('data-busy', 'no', { timeout: 60_000 })
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
  await type(page, '10')

  await expect(tiles(page)).toHaveCount(1)
  const tile = page.getByTestId('tile-0')
  await expect(tile).toHaveAttribute('data-type', 'int')
  await expect(tile).toContainText('10')
  // The prompt echoes the value the way Python would.
  await expect(page.locator('.repl-line.result').last()).toContainText('10')
  await expect(page.getByTestId('progress')).toContainText('step 2 of 6')
})

test('a value of the wrong type is still a real object, and the crow just asks again', async ({
  page,
}) => {
  await boot(page)
  await type(page, '"John"')

  // Nothing is taken away for being wrong.
  await expect(tiles(page)).toHaveCount(1)
  await expect(page.getByTestId('tile-0')).toHaveAttribute('data-type', 'str')
  await expect(page.getByTestId('progress')).toContainText('step 1 of 6')
  await expect(page.locator('.repl-line.note').last()).toContainText('whole number')
})

test('scalars carry no identity and containers do', async ({ page }) => {
  await boot(page)
  await type(page, '10')
  await type(page, '[1, 2, 3]')

  // CPython interns small ints; claiming an identity for them would teach
  // something false, so the engine gives scalars none and neither do we.
  await expect(page.getByTestId('tile-0').locator('.tile-id')).toHaveCount(0)
  await expect(page.getByTestId('tile-1').locator('.tile-id')).toHaveCount(1)
})

test('two equal lists are two different objects', async ({ page }) => {
  await boot(page)
  await type(page, '[1, 2, 3]')
  await type(page, '[1, 2, 3]')

  await expect(tiles(page)).toHaveCount(2)
  const first = await page.getByTestId('tile-0').locator('.tile-id').innerText()
  const second = await page.getByTestId('tile-1').locator('.tile-id').innerText()
  expect(first).not.toBe(second)
  await expect(page.getByTestId('tile-0')).toContainText('[1, 2, 3]')
  await expect(page.getByTestId('tile-1')).toContainText('[1, 2, 3]')
})

test('a line that is not an expression is explained and not kept', async ({ page }) => {
  await boot(page)
  await type(page, '10')
  await type(page, 'x = 5')

  await expect(page.locator('.repl-line.error').last()).toContainText('not an expression')
  // The failed line must not poison the session.
  await expect(tiles(page)).toHaveCount(1)
  await type(page, '"John"')
  await expect(tiles(page)).toHaveCount(2)
})

test('the suggestion fills the prompt but never submits it', async ({ page }) => {
  await boot(page)
  await page.getByTestId('suggestion').click()
  await expect(page.getByTestId('repl-input')).toHaveValue('10')
  await expect(tiles(page)).toHaveCount(0)

  await page.getByTestId('repl-input').press('Enter')
  await expect(page.getByTestId('repl')).toHaveAttribute('data-busy', 'no', { timeout: 60_000 })
  await expect(tiles(page)).toHaveCount(1)
})

test('the prompt recalls history with the arrow keys', async ({ page }) => {
  await boot(page)
  await type(page, '10')
  await type(page, '"John"')

  const input = page.getByTestId('repl-input')
  await input.press('ArrowUp')
  await expect(input).toHaveValue('"John"')
  await input.press('ArrowUp')
  await expect(input).toHaveValue('10')
  await input.press('ArrowDown')
  await expect(input).toHaveValue('"John"')
})

test('the whole lesson can be completed, and started over', async ({ page }) => {
  await boot(page)
  for (const s of ['10', '"John"', '3.5', 'True', '[1, 2, 3]', '[1, 2, 3]']) await type(page, s)

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
  await expect(page.getByTestId('repl-input')).toBeVisible()
  expect(page.url()).toContain('#/tutorial')
})
