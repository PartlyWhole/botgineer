import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    botgineer: {
      setProgram(text: string): void
      getProgram(): string
      run(): Promise<void>
      snapshot(): {
        bindings: { name: string; scope: string; target: string }[]
        objects: Record<
          string,
          {
            id: string
            type: string
            kind: string
            repr: string
            elements: { label: string | null; target: string }[] | null
          }
        >
      }
      state(): { boot: string; busy: boolean; steps: number }
    }
  }
}

async function open(page: Page, activity: string) {
  await page.goto(`./#/${activity}`)
  // The runtime does not announce that it works; it announces failure.
  // The shell carries its state as data so there is still something to
  // wait on without putting a badge on screen.
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
}

/** Memory is a view of the robot panel, so it has to be brought up. */
async function showMemory(page: Page) {
  await page.getByTestId('view-memory').click()
  await expect(page.getByTestId('memory')).toBeVisible()
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

test('two panels, with memory as a view of the robot', async ({ page }) => {
  await open(page, 'sandbox')
  await expect(page.getByTestId('scene')).toBeVisible()
  await expect(page.getByTestId('robot-panel')).toBeVisible()
  // Memory is not a panel of its own, and Code is what opens.
  await expect(page.getByTestId('memory')).toBeHidden()
  await expect(page.getByTestId('editor')).toBeVisible()
  await showMemory(page)
  await expect(page.getByTestId('editor')).toBeHidden()
  // GitHub Pages cannot send COOP/COEP; the service-worker shim must.
  await expect.poll(() => page.evaluate(() => window.crossOriginIsolated)).toBe(true)
  await expect(page.locator('.app')).toHaveAttribute('data-isolated', 'yes')
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

/** The camera's zoom, read off the shared transform. */
const zoom = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('.graph .world')
    if (!el) return 0
    return +new DOMMatrix(getComputedStyle(el).transform).a.toFixed(3)
  })

/** Waits for the field and the camera to stop moving, so a measurement is
 *  of where things ended rather than where they were passing through. */
async function stillness(page: Page) {
  let last = ''
  for (let i = 0; i < 40; i++) {
    const now = await page.evaluate(() =>
      [...document.querySelectorAll('.node')].map((n) => (n as HTMLElement).style.transform).join('|') +
      (document.querySelector('.graph .world') as HTMLElement | null)?.style.transform,
    )
    if (now === last) return
    last = now
    await page.waitForTimeout(120)
  }
}

test('memory is one field of nodes and edges, not two boxes', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, "letters = ['x', 'y']\nsame = letters\nn = 10\nm = n\n")
  await showMemory(page)
  await stillness(page)

  // 4 names + 4 objects (list, 'x', 'y', 10)
  await expect(page.locator('.node.name')).toHaveCount(4)
  await expect(page.locator('.node.object')).toHaveCount(4)
  // 4 bindings + 2 list pointers
  await expect(page.locator('.edge path')).toHaveCount(6)
  // There is no separate stage to switch to.
  await expect(page.locator('.stage-focus')).toHaveCount(0)
})

test('names settle to the left of objects', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, "a = 1\nb = 2\nc = 3\n")
  await showMemory(page)
  await stillness(page)

  const mid = async (sel: string) => {
    const boxes = await page.locator(sel).evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().left + e.getBoundingClientRect().width / 2),
    )
    return boxes.reduce((t, x) => t + x, 0) / boxes.length
  }
  expect(await mid('.node.name')).toBeLessThan(await mid('.node.object'))
})

test('every object carries a handle, primitives included', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, 'n = 7\nxs = [7]\n')
  await showMemory(page)
  await stillness(page)

  // A collection points at objects, so the primitives it points at need
  // handles to be pointed at by.
  const value = page.locator('.node.object.value[data-type="int"]')
  const reference = page.locator('.node.object.reference[data-type="list"]')
  await expect(value.locator('.handle')).toHaveText(/^obj\d+$/)
  await expect(reference.locator('.handle')).toHaveText(/^obj\d+$/)
})

test('picking a name zooms in on it and lights the connection', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, "letters = ['x', 'y']\nsame = letters\nspare = 99\n")
  await showMemory(page)
  await stillness(page)
  const before = await zoom(page)

  await page.getByTestId('node-letters').click()
  await stillness(page)

  // The camera moved in, rather than a panel opening somewhere else.
  expect(await zoom(page)).toBeGreaterThan(before)
  await expect(page.getByTestId('graph')).toHaveAttribute('data-picked', /letters$/)
  // Its own edge is lit; unrelated nodes step back but stay where they are.
  await expect(page.locator('.edge.lit')).toHaveCount(1)
  await expect(page.getByTestId('node-spare')).toHaveClass(/dimmed/)
  await expect(page.getByTestId('node-letters')).not.toHaveClass(/dimmed/)
  // The picked node says what it is; there is no prose underneath.
  await expect(page.getByTestId('node-letters')).toHaveClass(/picked/)
  await expect(page.getByTestId('caption')).toHaveCount(0)
})

test("a list points at objects — it does not contain letters", async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, "letters = ['x', 'y']\n")
  await showMemory(page)
  await stillness(page)

  const listId = await page.evaluate(() => {
    const s = window.botgineer.snapshot()
    return s.bindings.find((b) => b.name === 'letters')!.target
  })
  await page.getByTestId(`node-${listId}`).click()
  await stillness(page)

  // One edge in from the name, two out to the str objects it points at.
  await expect(page.locator('.edge.lit')).toHaveCount(3)
  // The pointers are labelled by index, and only while relevant.
  await expect(page.locator('.edge-label')).toHaveCount(2)
})

test('clicking a neighbour walks the graph', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, "letters = ['x', 'y']\n")
  await showMemory(page)
  await stillness(page)

  await page.getByTestId('node-letters').click()
  await stillness(page)
  const first = await page.getByTestId('graph').getAttribute('data-picked')

  // The object it points at is a neighbour, so it is right there to click.
  await page.locator('.node.object.reference').click()
  await stillness(page)
  const second = await page.getByTestId('graph').getAttribute('data-picked')
  expect(second).not.toBe(first)
})

test('equal values in two collections are the same object', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, "a = ['x']\nb = ['x']\n")

  const targets = await page.evaluate(() => {
    const s = window.botgineer.snapshot()
    const list = (n: string) => s.objects[s.bindings.find((b) => b.name === n)!.target]!
    return [list('a').elements![0]!.target, list('b').elements![0]!.target]
  })
  // Two separate lists, one interned string.
  expect(targets[0]).toBe(targets[1])
})

test('Escape zooms back out and clears the selection', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, "xs = [1, 2, 3]\nother = 'q'\n")
  await showMemory(page)
  await stillness(page)

  await page.getByTestId('node-xs').click()
  await stillness(page)
  const zoomedIn = await zoom(page)

  await page.keyboard.press('Escape')
  await stillness(page)
  expect(await zoom(page)).toBeLessThan(zoomedIn)
  await expect(page.getByTestId('graph')).toHaveAttribute('data-picked', '')
  await expect(page.locator('.node.dimmed')).toHaveCount(0)
})

test('a handle keeps its meaning while you scrub', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, "first = 'a'\nsecond = 'b'\nthird = 'c'\n")
  await showMemory(page)
  await stillness(page)

  const handleOf = async (name: string) => {
    const id = await page.evaluate(
      (n) => window.botgineer.snapshot().bindings.find((b) => b.name === n)!.target,
      name,
    )
    return page.getByTestId(`node-${id}`).locator('.handle').innerText()
  }
  const atEnd = await handleOf('first')

  const scrubber = page.getByTestId('scrubber')
  await scrubber.fill('2')
  await stillness(page)
  // Stepping back must not renumber an object that was already on screen.
  expect(await handleOf('first')).toBe(atEnd)
})

test('dragging a node moves it, and its neighbours follow', async ({ page }) => {
  await open(page, 'sandbox')
  await send(page, "xs = [1, 2]\nloner = 'z'\n")
  await showMemory(page)
  await stillness(page)

  const centre = async (t: string) => {
    const b = (await page.getByTestId(t).boundingBox())!
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }
  const listId = await page.evaluate(
    () => window.botgineer.snapshot().bindings.find((b) => b.name === 'xs')!.target,
  )

  const from = await centre('node-xs')
  const neighbourBefore = await centre(`node-${listId}`)
  const lonerBefore = await centre('node-loner')

  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x - 40, from.y + 110, { steps: 14 })
  await page.mouse.up()
  await stillness(page)

  const moved = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y)

  // It went where it was put, and stayed: releasing it back to the
  // simulation would send it home and make dragging pointless.
  expect(moved(await centre('node-xs'), from)).toBeGreaterThan(30)

  // The field responded — the rest of the graph is not a static backdrop.
  // Only that it *moved* is asserted here: on a graph this small a dragged
  // node physically displaces whatever it passes through, so an unrelated
  // node can easily travel further than a neighbour. That the pull is
  // *selective* is a property of the springs, and it is tested in
  // tests/unit/graphLayout.test.ts where the graph can be controlled.
  expect(moved(await centre(`node-${listId}`), neighbourBefore)).toBeGreaterThan(8)
  void lonerBefore

  // And a drag is not a click.
  await expect(page.getByTestId('graph')).toHaveAttribute('data-picked', '')

  // Loosen hands the dropped node back to the field.
  await expect(page.getByTestId('loosen')).toBeVisible()
  await page.getByTestId('loosen').click()
  await stillness(page)
  await expect(page.getByTestId('loosen')).toHaveCount(0)
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

test('nothing advertises the runtime working, or the other activities', async ({ page }) => {
  await open(page, 'sandbox')
  await expect(page.locator('.routes')).toHaveCount(0)
  await expect(page.getByTestId('boot-badge')).toHaveCount(0)
  await expect(page.getByTestId('brief')).toHaveCount(0)
  await expect(page.locator('.editor-hint')).toHaveCount(0)
  await expect(page.locator('.pane-note')).toHaveCount(0)
})

test('activities are separate scenes and each deep-links', async ({ page }) => {
  await open(page, 'belt')
  await expect(page.getByTestId('actor-B1')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('actor-A7')).toBeVisible()

  // No tabs: the other activities are reachable by hash and nothing else.
  await page.goto('./#/wake')
  await expect(page.getByTestId('actor-lamp')).toBeVisible()
  expect(page.url()).toContain('#/wake')
  // Switching activities starts that one fresh.
  await expect(page.getByTestId('step-label')).toHaveText('—')
})
