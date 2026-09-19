import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    botgineer: {
      setSolution(text: string): void
      getSolution(): string
      run(): Promise<void>
      state(): { boot: string; running: boolean; verdict: string | null; steps: number }
    }
  }
}

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

/** The editor is a contenteditable, so tests drive the small debug API the
 *  app exposes rather than typing into it. */
async function setSolution(page: Page, text: string) {
  await page.evaluate((t) => window.botgineer.setSolution(t), text)
  await expect.poll(() => page.evaluate(() => window.botgineer.getSolution())).toBe(text)
}

const solutionOf = (page: Page) => page.evaluate(() => window.botgineer.getSolution())

/** Waits for the eager boot run to finish. Nothing can be attempted before
 *  the runtime reports ready. */
async function boot(page: Page) {
  // The tutorial is the default route; these journeys are the scenario.
  await page.goto('./#/parcels')
  await expect(page.getByTestId('boot-badge')).toContainText('Python ready', { timeout: 60_000 })
}

async function attempt(page: Page, solution: string) {
  await setSolution(page, solution)
  await page.getByTestId('run').click()
  // Every run must reach a terminal state; the button coming back is the
  // observable proof that it did.
  await expect(page.getByTestId('run')).toBeEnabled({ timeout: 60_000 })
  await expect(page.getByTestId('feedback')).toBeVisible()
}

/* ------------------------------ the loop ------------------------------ */

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
    await expect(page.getByTestId('editor')).toContainText(`("${id}", ${kg})`)
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
  const names = page.getByTestId('names')
  await expect(names).toContainText('parcels')
  await expect(names).toContainText('answer')
  // Python prints 5.0, not 5. The whole scenario turns on that boundary, so
  // the memory panel must spell floats the way the interpreter does.
  await expect(names).toContainText('LIMIT')
  await expect(names).toContainText("('E5', 5.0)")
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

test('the trace can be scrubbed, and it highlights the line in the editor', async ({ page }) => {
  await boot(page)
  await attempt(page, CORRECT)

  const label = await page.getByTestId('step-label').textContent()
  await page.getByTestId('scrubber').fill('1')
  await expect(page.getByTestId('step-label')).toContainText('step 2 /')
  expect(label).not.toBe(await page.getByTestId('step-label').textContent())

  // The trace drives the editor highlight — the memory panel and the code
  // are two views of the same step.
  await expect(page.locator('.cm-traced')).toHaveCount(1)
})

/* ------------------------------ the editor ------------------------------ */

const MULTI = `def respond(parcels, limit):
    a = 1
    b = 2
    return []
`

/** Puts the cursor at the start of `a = 1` and extends the selection down
 *  one line, so the next key acts on two lines at once. */
async function selectTwoLines(page: Page) {
  await page.getByText('a = 1').click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+ArrowDown')
  await page.keyboard.press('Shift+End')
}

test('Tab indents a multi-line selection and Shift+Tab dedents it', async ({ page }) => {
  await boot(page)
  await setSolution(page, MULTI)

  await selectTwoLines(page)
  await page.keyboard.press('Tab')
  await expect.poll(() => solutionOf(page)).toContain('        a = 1\n        b = 2')

  await page.keyboard.press('Shift+Tab')
  await expect.poll(() => solutionOf(page)).toContain('    a = 1\n    b = 2')
})

test('the comment shortcut toggles a whole selection', async ({ page }) => {
  await boot(page)
  await setSolution(page, MULTI)

  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
  await selectTwoLines(page)
  await page.keyboard.press(`${mod}+/`)
  await expect.poll(() => solutionOf(page)).toMatch(/#\s*a = 1[\s\S]*#\s*b = 2/)

  await page.keyboard.press(`${mod}+/`)
  await expect.poll(() => solutionOf(page)).toContain('    a = 1\n    b = 2')
})

test('Enter keeps Python indentation', async ({ page }) => {
  await boot(page)
  await setSolution(page, MULTI)

  await page.getByText('a = 1').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('c = 3')
  await expect.poll(() => solutionOf(page)).toContain('    a = 1\n    c = 3')
})

test('the situation and the harness cannot be edited', async ({ page }) => {
  await boot(page)
  const before = await solutionOf(page)

  // Typing inside the preamble must change nothing at all.
  await page.getByText('LIMIT = 5.0').click()
  await page.keyboard.press('End')
  await page.keyboard.type('XXXX')
  await expect(page.getByTestId('editor')).toContainText('LIMIT = 5.0')
  await expect(page.getByTestId('editor')).not.toContainText('XXXX')
  expect(await solutionOf(page)).toBe(before)

  // And so must typing inside the harness.
  // Exact: the preamble also contains `def report(answer):`.
  await page.getByText('report(answer)', { exact: true }).click()
  await page.keyboard.press('End')
  await page.keyboard.type('YYYY')
  await expect(page.getByTestId('editor')).not.toContainText('YYYY')
  expect(await solutionOf(page)).toBe(before)
})

test('Escape releases the editor so Tab can still leave it', async ({ page }) => {
  await boot(page)
  await page.getByText('heavy = []').click()
  await expect(page.locator('.cm-editor.cm-focused')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('.cm-editor.cm-focused')).toHaveCount(0)
})

/* ------------------------------ layout ------------------------------ */

test('the panes can be resized and the split is remembered', async ({ page }) => {
  await boot(page)
  const terminalPane = page.locator('.pane.fixed').first()
  const before = (await terminalPane.boundingBox())?.height ?? 0

  // Keyboard-operable: a layout you can only change with a mouse is a
  // layout some people cannot change at all.
  const gutter = page.getByRole('separator', { name: 'Resize the terminal' })
  await gutter.focus()
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp')

  const after = (await terminalPane.boundingBox())?.height ?? 0
  expect(after).toBeGreaterThan(before)

  await page.reload()
  await expect(page.getByTestId('boot-badge')).toContainText('Python ready', { timeout: 60_000 })
  const restored = (await page.locator('.pane.fixed').first().boundingBox())?.height ?? 0
  expect(Math.abs(restored - after)).toBeLessThan(2)
})

/* ------------------------------ posture ------------------------------ */

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
  await page.goto('./?nonisolated#/parcels')
  await expect(page.getByTestId('boot-badge')).toContainText('Python ready', { timeout: 60_000 })
  await attempt(page, CORRECT)
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-status', 'passed')
})
