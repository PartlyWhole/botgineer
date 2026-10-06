import { expect, test, type Page } from '@playwright/test'

/* The sandbox (`#/code`, `src/app/Sandbox.tsx`): the editor and memory
   alone. A run opens on its first step and is walked by hand. */

type Api = {
  setProgram: (s: string) => void
  run: () => Promise<void>
  state: () => { boot: string; busy: boolean; step: number; steps: number }
}
const api = (page: Page) => page.evaluate.bind(page)

async function openSandbox(page: Page) {
  await page.goto('./#/code')
  await expect(page.locator('.app[data-boot="ready"]')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('code-sandbox')).toBeVisible()
}

test('a run opens on its first step and is walked by hand', { tag: '@smoke' }, async ({ page }) => {
  await openSandbox(page)
  await api(page)(() => (window as unknown as { botgineer: Api }).botgineer.setProgram('x = 1\ny = x + 1\nprint(y)\n'))
  await page.getByTestId('run').click()
  await expect(page.getByTestId('step-label')).toHaveText(/^1 \/ \d+$/)
  // Nothing has run yet: memory is empty and nothing is printed.
  await expect(page.getByTestId('memory-empty')).toBeVisible()
  await expect(page.getByTestId('transcript')).not.toContainText('2')

  // Step 1 is line 1 about to run: one press forward runs it.
  await expect(page.locator('.cm-line').first()).toHaveClass(/now|current/)
  await page.getByTestId('step-forward').click()
  await expect(page.locator('.node.name', { hasText: 'x' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { botgineer: { events: () => string[] } }).botgineer.events()[0])).toBe('line:__main__:1')

  await page.getByTestId('step-last').click()
  await expect(page.locator('.node.name', { hasText: 'y' })).toBeVisible()
  await expect(page.getByTestId('transcript')).toContainText('2')
  await expect(page.getByTestId('transcript')).toContainText('Done.')

  await page.getByTestId('step-first').click()
  await expect(page.getByTestId('step-label')).toHaveText(/^1 \//)
})

test('editing the program puts the run away', async ({ page }) => {
  await openSandbox(page)
  await page.getByTestId('run').click()
  await expect(page.getByTestId('step-label')).toHaveText(/^1 \//)
  await api(page)(() => (window as unknown as { botgineer: Api }).botgineer.setProgram('z = 3\n'))
  await expect(page.getByTestId('step-label')).toHaveText('—')
})

test('a press on empty memory lets go of the card picked', async ({ page }) => {
  await openSandbox(page)
  await page.getByTestId('run').click()
  await page.getByTestId('step-last').click()
  await page.locator('.node.name', { hasText: 'backpack' }).click()
  await expect(page.getByTestId('memory')).toHaveAttribute('data-picked', 'yes')
  const box = (await page.getByTestId('graph').boundingBox())!
  await page.mouse.click(box.x + box.width - 30, box.y + box.height - 30)
  await expect(page.getByTestId('memory')).toHaveAttribute('data-picked', 'no')
})
