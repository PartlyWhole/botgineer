import { expect, test, type Page } from '@playwright/test'

const CORRECT = `def respond(parcels, limit):
    heavy = []
    for parcel in parcels:
        if parcel[1] > limit:
            heavy.append(parcel[0])
    return heavy
`

const INCLUSIVE = CORRECT.replace('> limit', '>= limit')
const CRASH = 'def respond(parcels, limit):\n    return 1 / 0\n'
const FOREVER = 'def respond(parcels, limit):\n    while True:\n        pass\n'

/** Waits for the eager boot run to finish. Nothing can be attempted before
 *  the runtime reports ready. */
async function boot(page: Page) {
  await page.goto('./')
  await expect(page.getByTestId('boot-badge')).toContainText('Python ready', { timeout: 60_000 })
}

async function attempt(page: Page, solution: string) {
  await page.getByTestId('solution').fill(solution)
  await page.getByTestId('run').click()
  // Every run must reach a terminal state; the button coming back is the
  // observable proof that it did.
  await expect(page.getByTestId('run')).toBeEnabled({ timeout: 60_000 })
  await expect(page.getByTestId('feedback')).toBeVisible()
}

test('the runtime boots and the scene matches the Python data', async ({ page }) => {
  await boot(page)

  // The crates are generated from the same world object as the preamble, so
  // a drift between picture and data would show up here.
  const belt: [string, string][] = [
    ['A7', '3.2'],
    ['B1', '7.4'],
    ['C2', '1.1'],
    ['D3', '9.8'],
    ['E5', '5.0'],
  ]
  for (const [id, kg] of belt) {
    const crate = page.getByTestId(`crate-${id}`)
    await expect(crate).toContainText(id)
    await expect(crate).toContainText(`${kg} kg`)
    await expect(page.locator('.region.locked').first()).toContainText(`("${id}", ${kg})`)
  }
})

test('a correct solution passes, the robot speaks, and the crates light up', async ({ page }) => {
  await boot(page)
  await attempt(page, CORRECT)

  await expect(page.getByTestId('feedback')).toHaveAttribute('data-status', 'passed')
  await expect(page.getByTestId('robot-line')).toContainText("['B1', 'D3']")

  await expect(page.getByTestId('crate-B1')).toHaveAttribute('data-picked', 'yes')
  await expect(page.getByTestId('crate-D3')).toHaveAttribute('data-picked', 'yes')
  for (const id of ['A7', 'C2', 'E5']) {
    await expect(page.getByTestId(`crate-${id}`)).toHaveAttribute('data-picked', 'no')
  }

  // The program's own output, in a real terminal.
  await expect(page.locator('.xterm-rows')).toContainText("Robot says: ['B1', 'D3']")

  // The memory panel renders a trace the interpreter produced.
  await expect(page.getByTestId('step-label')).toContainText('/')
  await expect(page.getByTestId('names')).toContainText('parcels')
})

test('a >= mistake gets the specific diagnosis, not a shrug', async ({ page }) => {
  await boot(page)
  await attempt(page, INCLUSIVE)

  await expect(page.getByTestId('feedback')).toHaveAttribute('data-status', 'failed')
  await expect(page.getByTestId('feedback')).toContainText('E5 weighs exactly 5.0 kg')
  await expect(page.getByTestId('robot-line')).toContainText("['B1', 'D3', 'E5']")
})

test('a crash is reported with the line in the player own numbering', async ({ page }) => {
  await boot(page)
  await attempt(page, CRASH)

  await expect(page.getByTestId('feedback')).toHaveAttribute('data-status', 'crashed')
  await expect(page.getByTestId('feedback')).toContainText('ZeroDivisionError')
  await expect(page.getByTestId('feedback')).toContainText('of your code')
  await expect(page.locator('.xterm-rows')).toContainText('ZeroDivisionError')
})

test('an endless loop stops on the step budget and leaves the page usable', async ({ page }) => {
  await boot(page)
  await attempt(page, FOREVER)

  await expect(page.getByTestId('feedback')).toHaveAttribute('data-status', 'stopped')
  await expect(page.getByTestId('feedback')).toContainText('ran out of steps')

  // The page must still work afterwards.
  await attempt(page, CORRECT)
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-status', 'passed')
})

test('the trace can be scrubbed after the run', async ({ page }) => {
  await boot(page)
  await attempt(page, CORRECT)

  const label = await page.getByTestId('step-label').textContent()
  await page.getByTestId('scrubber').fill('1')
  await expect(page.getByTestId('step-label')).toContainText('step 2 /')
  expect(label).not.toBe(await page.getByTestId('step-label').textContent())
})

test('cross-origin isolation is obtained without server headers', async ({ page }) => {
  await boot(page)
  // GitHub Pages cannot send COOP/COEP; coi-serviceworker must supply it.
  // This is what unlocks live input and cooperative interrupt later.
  await expect
    .poll(() => page.evaluate(() => window.crossOriginIsolated), { timeout: 30_000 })
    .toBe(true)
  await expect(page.getByTestId('boot-badge')).toContainText('isolated')
})

test('the degraded posture is still a working app', async ({ page }) => {
  await page.goto('./?nonisolated')
  await expect(page.getByTestId('boot-badge')).toContainText('Python ready', { timeout: 60_000 })
  await attempt(page, CORRECT)
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-status', 'passed')
})
