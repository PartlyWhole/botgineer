import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    botgineer: {
      setProgram(text: string): void
      getProgram(): string
      run(): Promise<void>
      snapshot(): {
        bindings: { name: string; scope: string; target: string }[]
        objects: Record<string, { id: string; type: string; kind: string; repr: string }>
      }
      state(): { boot: string; busy: boolean; steps: number }
    }
  }
}

async function open(page: Page, activity: string) {
  await page.goto(`./#/${activity}`)
  await expect(page.getByTestId('boot-badge')).toContainText('Python ready', { timeout: 60_000 })
}

/** Sends a program and waits for the run to settle. The panel's own busy
 *  flag is the signal, so there is nothing to sleep on. */
async function send(page: Page, program: string) {
  await page.evaluate((p) => window.botgineer.setProgram(p), program)
  await expect.poll(() => page.evaluate(() => window.botgineer.getProgram())).toBe(program)
  await page.getByTestId('run').click()
  await expect(page.getByTestId('robot-panel')).toHaveAttribute('data-busy', 'no', {
    timeout: 60_000,
  })
}

const targetOf = (page: Page, name: string) =>
  page.evaluate(
    (n) => window.botgineer.snapshot().bindings.find((b) => b.name === n)?.target ?? null,
    name,
  )

/* ---------------------------- the three panels ---------------------------- */

test('all three panels are present and the runtime is isolated', async ({ page }) => {
  await open(page, 'sandbox')
  await expect(page.getByTestId('scene')).toBeVisible()
  await expect(page.getByTestId('robot-panel')).toBeVisible()
  await expect(page.getByTestId('memory')).toBeVisible()
  // GitHub Pages cannot send COOP/COEP; the service-worker shim must.
  await expect.poll(() => page.evaluate(() => window.crossOriginIsolated)).toBe(true)
})

/* ------------------------------ (A) the scene ------------------------------ */

test('the scene says what it is waiting for, then reacts to memory', async ({ page }) => {
  await open(page, 'wake')
  await expect(page.getByTestId('waiting')).toContainText('power')
  await expect(page.getByTestId('actor-lamp')).toHaveAttribute('data-lit', 'no')

  await send(page, 'power = True\nname = "Bolt"\ncharge = 72\n')

  await expect(page.getByTestId('actor-lamp')).toHaveAttribute('data-lit', 'yes')
  // A sign in the world shows the text; the memory panel still shows 'Bolt'.
  await expect(page.locator('[data-testid="actor-nameplate"] .sign-body')).toHaveText('Bolt')
  await expect(page.locator('.gauge-text')).toHaveText('72%')
  await expect(page.getByTestId('waiting')).toHaveCount(0)
})

test('a list in memory picks actors out of the scene', async ({ page }) => {
  await open(page, 'belt')
  await send(page, 'heavy = ["B1", "D3"]\n')

  await expect(page.getByTestId('actor-B1')).toHaveAttribute('data-picked', 'yes')
  await expect(page.getByTestId('actor-D3')).toHaveAttribute('data-picked', 'yes')
  for (const id of ['A7', 'C2', 'E5']) {
    await expect(page.getByTestId(`actor-${id}`)).toHaveAttribute('data-picked', 'no')
  }
})

/* ------------------------------ (C) the memory ----------------------------- */

test('two names for one value share an object; two equal lists do not', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'a = 10\nb = a\nxs = [1]\nys = xs\nzs = [1]\n')

  // Equal immutables are one entry — that is what Python lets you observe.
  expect(await targetOf(page, 'a')).toBe(await targetOf(page, 'b'))
  // Aliasing is real and shared.
  expect(await targetOf(page, 'xs')).toBe(await targetOf(page, 'ys'))
  // An equal list is a different object, because it really is.
  expect(await targetOf(page, 'xs')).not.toBe(await targetOf(page, 'zs'))
})

test('only reference objects carry an identity badge', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'n = 7\nxs = [7]\n')

  const intChip = page.locator('.chip.object.value[data-type="int"]')
  const listChip = page.locator('.chip.object.reference[data-type="list"]')
  await expect(intChip.locator('.badge')).toHaveCount(0)
  await expect(listChip.locator('.badge')).toHaveCount(1)
})

test('selecting a name lifts it out and shows what it points at', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'xs = ["p", "q"]\nalias = xs\n')

  await page.getByTestId('name-xs').click()
  const card = page.getByTestId('object-card')
  await expect(card).toContainText('list')
  await expect(card).toContainText('2 items')
  // Both names that point at it are listed, including the one not selected.
  await expect(card.locator('footer')).toContainText('alias')
  // The chip is lifted, not duplicated.
  await expect(page.getByTestId('name-xs')).toHaveClass(/lifted/)
})

test('following a pointer moves the selection to that object', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'xs = ["p", "q"]\n')

  await page.getByTestId('name-xs').click()
  await page.getByTestId('element-1').click()
  const card = page.getByTestId('object-card')
  await expect(card).toContainText('str')
  await expect(card).toContainText("'q'")
  await expect(card).toContainText('a value')
})

test('a collection holding itself does not hang the panel', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'xs = []\nxs.append(xs)\n')
  await page.getByTestId('name-xs').click()
  await expect(page.getByTestId('object-card')).toContainText('1 item')
  await page.getByTestId('element-0').click()
  await expect(page.getByTestId('object-card')).toContainText('list')
})

/* ------------------------ one snapshot, three panels ----------------------- */

test('scrubbing the run rewinds the scene and memory together', async ({ page }) => {
  await open(page, 'belt')
  await send(
    page,
    'heavy = []\nheavy.append("B1")\nheavy.append("D3")\n',
  )
  await expect(page.getByTestId('actor-B1')).toHaveAttribute('data-picked', 'yes')

  // Step 1 is before anything was appended: the scene must agree.
  await page.getByTestId('scrubber').fill('0')
  await expect(page.getByTestId('actor-B1')).toHaveAttribute('data-picked', 'no')
  await expect(page.getByTestId('actor-D3')).toHaveAttribute('data-picked', 'no')

  // …and stepping back to the end brings it back.
  const scrubber = page.getByTestId('scrubber')
  await scrubber.fill((await scrubber.getAttribute('max')) ?? '0')
  await expect(page.getByTestId('actor-D3')).toHaveAttribute('data-picked', 'yes')
})

/* --------------------------------- failure -------------------------------- */

test('an error is reported and the panel stays usable', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'x = 1 / 0\n')
  await expect(page.getByTestId('transcript')).toContainText('ZeroDivisionError')
  await expect(page.getByTestId('run')).toBeEnabled()

  await send(page, 'ok = 1\n')
  await expect(page.getByTestId('transcript')).toContainText('Done.')
  expect(await targetOf(page, 'ok')).not.toBeNull()
})

test('output reaches the transcript', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'print("hello from the robot")\n')
  await expect(page.getByTestId('transcript')).toContainText('hello from the robot')
})

/* -------------------------------- activities ------------------------------- */

test('activities are separate scenes and each deep-links', async ({ page }) => {
  await open(page, 'belt')
  await expect(page.getByTestId('brief')).toContainText('parcels')
  await page.reload()
  await expect(page.getByTestId('actor-A7')).toBeVisible()

  await page.getByTestId('route-wake').click()
  await expect(page.getByTestId('actor-lamp')).toBeVisible()
  expect(page.url()).toContain('#/wake')
  // Switching activities starts that one fresh.
  await expect(page.getByTestId('step-label')).toContainText('no run yet')
})
