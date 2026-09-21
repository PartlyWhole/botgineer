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

test('picking a name pulls it out, with the object it points at', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'xs = ["p", "q"]\nalias = xs\n')
  await expect(page.getByTestId('memory')).toHaveAttribute('data-focused', 'no')

  await page.getByTestId('name-xs').click()

  // Both pills come out of their clouds, with an arrow between them.
  await expect(page.getByTestId('memory')).toHaveAttribute('data-focused', 'yes')
  await expect(page.getByTestId('focus-name')).toHaveText('xs')
  await expect(page.getByTestId('focus-object')).toContainText('list')
  await expect(page.getByTestId('focus-object')).toContainText('2 items')
  await expect(page.locator('.points-at')).toHaveCount(1)

  // Both names that point at it are listed, including the one not picked.
  await expect(page.getByTestId('object-card').locator('.held-by')).toContainText('alias')
  // The pill is lifted out, not duplicated: its place in the cloud is a gap.
  await expect(page.getByTestId('name-xs')).toHaveClass(/lifted/)
  await expect(page.getByTestId('object-o:1')).toHaveClass(/lifted/)
})

test('picking an object pulls out just the object', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'n = 7\n')
  await page.locator('.chip.object.value').first().click()
  await expect(page.getByTestId('focus-object')).toContainText('int')
  // No name was picked, so there is nothing for an arrow to point from.
  await expect(page.getByTestId('focus-name')).toHaveCount(0)
  await expect(page.locator('.points-at')).toHaveCount(0)
})

test('a slot holding a value is not called a pointer', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, "letters = ['x', 'y']\n")
  await page.getByTestId('name-letters').click()

  // ['x', 'y'] holds two string VALUES. Calling them pointers contradicts
  // the rule that value objects have no identity to point at.
  await expect(page.getByTestId('slots-heading')).toHaveText('holds 2 values')
  await expect(page.getByTestId('element-0')).toHaveAttribute('data-slot', 'value')
  await expect(page.getByTestId('element-0')).toContainText("'x'")
  await expect(page.getByTestId('element-0')).not.toContainText('→')
})

test('a slot holding an object is a pointer, and says which object', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'nested = [[1], [2]]\n')
  await page.getByTestId('name-nested').click()

  await expect(page.getByTestId('slots-heading')).toHaveText('points at 2 objects')
  await expect(page.getByTestId('element-0')).toHaveAttribute('data-slot', 'pointer')
  await expect(page.getByTestId('element-0')).toContainText('list')
  await expect(page.getByTestId('element-0').locator('.badge')).toHaveCount(1)
})

test('a mixed collection says exactly what it holds', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'mixed = [1, [2]]\n')
  await page.getByTestId('name-mixed').click()
  await expect(page.getByTestId('slots-heading')).toHaveText(
    'holds 1 value and points at 1 object',
  )
})

test('a value is used by, not pointed at by', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, "n = 10\nm = 10\nxs = [1]\n")

  await page.getByTestId('name-n').click()
  await expect(page.getByTestId('object-card').locator('.held-by')).toContainText('used by')
  await expect(page.getByTestId('object-card').locator('.held-by')).toContainText('m')

  await page.getByTestId('dismiss').click()
  await page.getByTestId('name-xs').click()
  await expect(page.getByTestId('object-card').locator('.held-by')).toContainText('pointed at by')
})

test('following a pointer moves the selection to that object', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'xs = ["p", "q"]\n')

  await page.getByTestId('name-xs').click()
  await page.getByTestId('element-1').click()
  await expect(page.getByTestId('focus-object')).toContainText('str')
  await expect(page.getByTestId('focus-object')).toContainText("'q'")
  await expect(page.getByTestId('object-card')).toContainText('A value')
})

test('Escape and the button both put it back in the cloud', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'xs = [1]\n')

  await page.getByTestId('name-xs').click()
  await expect(page.getByTestId('memory')).toHaveAttribute('data-focused', 'yes')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('memory')).toHaveAttribute('data-focused', 'no')

  await page.getByTestId('name-xs').click()
  await page.getByTestId('dismiss').click()
  await expect(page.getByTestId('memory')).toHaveAttribute('data-focused', 'no')
  await expect(page.getByTestId('stage')).toHaveCount(0)
})

/* -------------------------------- the clouds ------------------------------- */

/** Rendered pill rectangles for one cloud, so overlap is measured on what
 *  is actually on screen rather than on the layout's own numbers. */
const pillBoxes = (page: Page, cloud: string) =>
  page.locator(`[aria-label="${cloud}"] .chip`).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return { l: r.left, t: r.top, r: r.right, b: r.bottom }
    }),
  )

function overlapping(boxes: { l: number; t: number; r: number; b: number }[]): number {
  let n = 0
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!
      const b = boxes[j]!
      if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) n++
    }
  }
  return n
}

test('the clouds lay pills out without any of them overlapping', async ({ page }) => {
  await open(page, 'sandbox')
  await send(
    page,
    'parcels = [("A7", 3.2), ("B1", 7.4), ("C2", 1.1), ("D3", 9.8), ("E5", 5.0)]\n' +
      'heavy = ["B1", "D3"]\nn = 1\nm = 2.5\nflag = True\nd = {"a": 1}\n',
  )
  const names = await pillBoxes(page, 'Names')
  const objects = await pillBoxes(page, 'Objects')
  expect(names.length).toBeGreaterThan(3)
  expect(objects.length).toBeGreaterThan(8)
  expect(overlapping(names)).toBe(0)
  expect(overlapping(objects)).toBe(0)
})

test('a pill can be dragged, and the cloud reorganises around it', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'aa = 1\nbb = 2\ncc = 3\ndd = 4\n')

  const pill = page.getByTestId('name-aa')
  const before = (await pill.boundingBox())!
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(before.x + 90, before.y - 40, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(600)

  // A dropped pill stays where it was put — otherwise dragging does
  // nothing, because packing would send it straight back.
  const after = (await pill.boundingBox())!
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(20)
  // Everything still readable: dragging must not pile pills on top of each other.
  expect(overlapping(await pillBoxes(page, 'Names'))).toBe(0)
  // And a drag is not a click.
  await expect(page.getByTestId('memory')).toHaveAttribute('data-focused', 'no')

  // Tidy puts everything back in the cloud.
  await page.getByTestId('tidy-names').click()
  await page.waitForTimeout(600)
  const tidied = (await pill.boundingBox())!
  expect(Math.hypot(tidied.x - before.x, tidied.y - before.y)).toBeLessThan(3)
  expect(overlapping(await pillBoxes(page, 'Names'))).toBe(0)
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
