import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    botgineer: {
      setProgram(text: string): void
      getProgram(): string
      run(): Promise<void>
      say(line: string): Promise<void>
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
      state(): {
        boot: string
        busy: boolean
        steps: number
        mode: string
        history: string[]
      }
    }
  }
}

/** The starting activity is a console now, so the journeys that are about
 *  the editor run against an activity that still has one. */
const EDITOR = 'wake'

async function open(page: Page, activity: string) {
  await page.goto(`./#/${activity}`)
  // The runtime does not announce that it works; it announces failure.
  // The shell carries its state as data so there is still something to
  // wait on without putting a badge on screen.
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
}

/** Memory shares the robot panel with the instrument — there is nothing
 *  to switch to any more, so this only confirms it is on screen. */
async function showMemory(page: Page) {
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

test('two panels, with memory sharing the robot panel', async ({ page }) => {
  await open(page, 'sandbox')
  await expect(page.getByTestId('scene')).toBeVisible()
  await expect(page.getByTestId('robot-panel')).toBeVisible()
  // Memory is not a panel of its own, and it is not a tab either: it is
  // on screen at the same time as the thing that changes it.
  await expect(page.getByTestId('console')).toBeVisible()
  await expect(page.getByTestId('memory')).toBeVisible()
  await expect(page.locator('[data-testid="view-memory"]')).toHaveCount(0)
  // GitHub Pages cannot send COOP/COEP; the service-worker shim must.
  await expect.poll(() => page.evaluate(() => window.crossOriginIsolated)).toBe(true)
  await expect(page.locator('.app')).toHaveAttribute('data-isolated', 'yes')
})

/** The camera's current scale, for asserting that picking zooms in. */
const zoom = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('.graph .world')
    if (!el) return 0
    return +new DOMMatrix(getComputedStyle(el).transform).a.toFixed(3)
  })

/** Waits until nothing in the field is moving any more. The layout eases
 *  and the camera eases after it, so anything that reads a position or
 *  hovers a pill has to let both finish first. */
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

/* ------------------------------ (A) the scene ------------------------------ */

test('the scene says what it is waiting for, then reacts to memory', async ({ page }) => {
  await open(page, 'wake')
  // The footer exists only while something is unbound, and says what.
  await expect(page.locator('.stage-foot')).toHaveCount(1)
  await expect(page.getByTestId('waiting')).toContainText('power')
  await expect(page.getByTestId('actor-lamp')).toHaveAttribute('data-lit', 'no')
  // Colour is never the only carrier: a dark bulb and a lit one differ by
  // more than 'grey' and 'yellow', which is all a lamp used to say.
  await expect(page.locator('.bulb')).toHaveAttribute('aria-label', /dark/)

  await send(page, 'power = True\nname = "Bolt"\ncharge = 72\n')

  await expect(page.getByTestId('actor-lamp')).toHaveAttribute('data-lit', 'yes')
  await expect(page.locator('.bulb')).toHaveAttribute('aria-label', /lit/)
  // A sign in the world shows the text; the memory panel still shows 'Bolt'.
  await expect(page.locator('[data-testid="actor-nameplate"] .sign-body')).toHaveText('Bolt')
  await expect(page.locator('.gauge-text')).toHaveText('72%')
  await expect(page.getByTestId('waiting')).toHaveCount(0)
  await expect(page.locator('.stage-foot')).toHaveCount(0)
})

test('memory is one field of nodes and edges, not two boxes', async ({ page }) => {
  await open(page, EDITOR)
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
  await open(page, EDITOR)
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
  await open(page, EDITOR)
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
  await open(page, EDITOR)
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
  await open(page, EDITOR)
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
  await open(page, EDITOR)
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
  await open(page, EDITOR)
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
  await open(page, EDITOR)
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
  await open(page, EDITOR)
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
  await open(page, EDITOR)
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
  await open(page, 'wake')
  await send(
    page,
    'power = False\nname = "Bolt"\npower = True\n',
  )
  // The program ends with the lamp on and the nameplate set.
  await expect(page.getByTestId('actor-lamp')).toHaveAttribute('data-lit', 'yes')
  await expect(page.locator('[data-testid="actor-nameplate"] .sign-body')).toHaveText('Bolt')

  // Step 1 is before any of it ran: the scene has to agree.
  await page.getByTestId('scrubber').fill('0')
  await expect(page.getByTestId('actor-lamp')).toHaveAttribute('data-lit', 'no')
  await expect(page.locator('[data-testid="actor-nameplate"] .sign-body')).toHaveText('unnamed')
  // Memory rewinds with it, from the same snapshot.
  expect(await page.evaluate(() => window.botgineer.snapshot().bindings)).toEqual([])

  // …and stepping back to the end brings all of it back.
  const scrubber = page.getByTestId('scrubber')
  await scrubber.fill((await scrubber.getAttribute('max')) ?? '0')
  await expect(page.getByTestId('actor-lamp')).toHaveAttribute('data-lit', 'yes')
  expect(
    await page.evaluate(() => window.botgineer.snapshot().bindings.map((b) => b.name).sort()),
  ).toEqual(['name', 'power'])
})

/* --------------------------------- failure -------------------------------- */

test('an error is reported and the panel stays usable', async ({ page }) => {
  await open(page, EDITOR)
  await send(page, 'x = 1 / 0\n')
  await expect(page.getByTestId('transcript')).toContainText('ZeroDivisionError')
  await expect(page.getByTestId('run')).toBeEnabled()

  await send(page, 'ok = 1\n')
  await expect(page.getByTestId('transcript')).toContainText('Done.')
  expect(await targetOf(page, 'ok')).not.toBeNull()
})

test('output reaches the transcript', async ({ page }) => {
  await open(page, EDITOR)
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
  // The scene describes itself with its contents, not with a line of prose.
  await expect(page.locator('.stage-foot')).toHaveCount(0)
})

test('activities are separate scenes and each deep-links', async ({ page }) => {
  await open(page, 'order')
  await expect(page.getByTestId('actor-courier')).toBeVisible()
  await page.reload()
  await expect(page.getByTestId('actor-ticket')).toBeVisible()

  // No tabs: the other activities are reachable by hash and nothing else.
  await page.goto('./#/wake')
  await expect(page.getByTestId('actor-lamp')).toBeVisible()
  expect(page.url()).toContain('#/wake')
  // Switching activities starts that one fresh.
  await expect(page.getByTestId('step-label')).toHaveText('—')
})

/* --------------------------- the robot's console --------------------------- */

/** Types a line into the console and waits for the robot to finish. */
async function say(page: Page, line: string) {
  const input = page.getByTestId('console-input')
  await input.fill(line)
  await input.press('Enter')
  await expect(page.getByTestId('robot-panel')).toHaveAttribute('data-busy', 'no', {
    timeout: 60_000,
  })
}

const reprs = (page: Page) =>
  page.evaluate(() =>
    Object.values(window.botgineer.snapshot().objects)
      .map((o) => o.repr)
      .sort(),
  )

test('the starting activity is a console, not an editor', async ({ page }) => {
  await open(page, 'sandbox')
  await expect(page.getByTestId('console')).toBeVisible()
  await expect(page.getByTestId('editor')).toHaveCount(0)
  // Enter is the transport: there is no Run button and no step slider.
  await expect(page.getByTestId('run')).toHaveCount(0)
  await expect(page.getByTestId('scrubber')).toHaveCount(0)
  expect(await page.evaluate(() => window.botgineer.state().mode)).toBe('console')
})

test('a bare literal is thought of and let go, never stored', async ({ page }) => {
  await open(page, 'sandbox')
  await say(page, '10')

  // The robot reports it, and it appears above the robot's head.
  await expect(page.getByTestId('echo')).toHaveText('10')
  await expect(page.getByTestId('thought')).toHaveText('10')

  // And nothing is kept. Nothing named it, so there is nothing to keep —
  // which is what the first lesson is for.
  expect(await page.evaluate(() => window.botgineer.snapshot().bindings)).toEqual([])
  expect(await reprs(page)).toEqual([])
  await expect(page.getByTestId('memory')).toContainText('Memory is empty')
})

test('memory stays empty however much the robot works out', async ({ page }) => {
  await open(page, 'sandbox')
  await say(page, '10')
  await say(page, '"John"')
  await say(page, '3 + 4')

  // Three lines, three answers, nothing stored by any of them.
  expect(await reprs(page)).toEqual([])
  await expect(page.getByTestId('echo').last()).toHaveText('7')
  await expect(page.getByTestId('thought')).toHaveText('7')
  // The history is still replayed ahead of every new line.
  expect(await page.evaluate(() => window.botgineer.state().history)).toEqual([
    '10',
    '"John"',
    '3 + 4',
  ])
})

test('a name is what makes something stay', async ({ page }) => {
  await open(page, 'sandbox')
  await say(page, '7 * 6')
  expect(await reprs(page)).toEqual([])

  await say(page, 'answer = 7 * 6')
  // Same computation, but this one had a name to hold it.
  expect(await reprs(page)).toEqual(['42'])
  expect(
    await page.evaluate(() => window.botgineer.snapshot().bindings.map((b) => b.name)),
  ).toEqual(['answer'])
})

test('a statement binds a name and is not echoed', async ({ page }) => {
  await open(page, 'sandbox')
  await say(page, 'x = 5')

  await expect(page.getByTestId('echo')).toHaveCount(0)
  expect(await page.evaluate(() => window.botgineer.snapshot().bindings.map((b) => b.name))).toEqual(
    ['x'],
  )
})

test('print goes to the console once, not once per replay', async ({ page }) => {
  await open(page, 'sandbox')
  await say(page, 'print("hello")')
  await say(page, 'print("again")')

  // Read the robot's output specifically: the scrollback also echoes back
  // the line that was typed, which contains the same words.
  expect(await page.locator('.console .said.out').allInnerTexts()).toEqual(['hello', 'again'])
  // `print` evaluates to None, and a REPL that answered None would be noise.
  await expect(page.getByTestId('echo')).toHaveCount(0)
})

test('a line that fails is reported and not kept', async ({ page }) => {
  await open(page, 'sandbox')
  await say(page, '10')
  await say(page, '1 / 0')

  await expect(page.getByTestId('console-error')).toContainText('ZeroDivisionError')
  // History holds only what worked, which is what makes replay safe.
  expect(await page.evaluate(() => window.botgineer.state().history)).toEqual(['10'])

  // And the console still works afterwards.
  await say(page, '2 + 2')
  await expect(page.getByTestId('echo').last()).toHaveText('4')
})

test('the first lesson walks the four kinds of thing', async ({ page }) => {
  await open(page, 'sandbox')
  await expect(page.getByTestId('guide')).toContainText('whole number')

  // Any int will do: the kind is what is being taught, not the value.
  await say(page, '41')
  await expect(page.getByTestId('guide')).toContainText('with a dot')

  await say(page, '2.5')
  await expect(page.getByTestId('guide')).toContainText('quotes')

  // `"True"` is a str, so it answers this step and not the next one.
  await say(page, '"True"')
  await expect(page.getByTestId('guide')).toContainText('True')
  await expect(page.getByTestId('advance')).toHaveCount(0)

  await say(page, 'True')
  await expect(page.getByTestId('guide')).toContainText('none of them had a name')
  await expect(page.getByTestId('memory')).toContainText('Memory is empty')
  await expect(page.getByTestId('advance')).toBeVisible()
})

test('the second lesson works things out and keeps none of them', async ({ page }) => {
  await open(page, 'operations')
  await expect(page.getByTestId('guide')).toContainText('7 * 6')

  await say(page, '7 * 6')
  await expect(page.getByTestId('thought')).toHaveText('42')
  await say(page, '9 / 2')
  await expect(page.getByTestId('thought')).toHaveText('4.5')
  await say(page, '"bot" + "gineer"')
  await expect(page.getByTestId('thought')).toHaveText("'botgineer'")
  await say(page, '3 > 5')
  await expect(page.getByTestId('thought')).toHaveText('False')
  await say(page, '(2 + 3) * 4')

  await expect(page.getByTestId('thought')).toHaveText('20')
  await expect(page.getByTestId('guide')).toContainText('Nobody else ever knew it')
  // Five answers, and memory never held one of them.
  expect(await reprs(page)).toEqual([])
})

test('a block is collected over several lines before it runs', async ({ page }) => {
  await open(page, 'sandbox')
  const input = page.getByTestId('console-input')

  await input.fill('def double(n):')
  await input.press('Enter')
  // Still collecting: the prompt changed and nothing ran.
  await expect(page.locator('.prompt-row')).toHaveAttribute('data-continuing', 'yes')
  expect(await page.evaluate(() => window.botgineer.state().history)).toEqual([])

  await input.fill('def double(n):\n    return n * 2')
  await input.press('Enter')
  await expect(page.locator('.prompt-row')).toHaveAttribute('data-continuing', 'yes')
  expect(await page.evaluate(() => window.botgineer.state().history)).toEqual([])

  // Enter on the blank line is what closes the block and sends it.
  await input.press('Enter')
  await expect(page.getByTestId('robot-panel')).toHaveAttribute('data-busy', 'no', {
    timeout: 60_000,
  })
  expect(await page.evaluate(() => window.botgineer.state().history)).toEqual([
    'def double(n):\n    return n * 2',
  ])

  await say(page, 'double(21)')
  await expect(page.getByTestId('echo').last()).toHaveText('42')
})

/* ------------------------------ progression ------------------------------ */

test('the naming lesson teaches that a name is an arrow', async ({ page }) => {
  await open(page, 'names')
  await expect(page.getByTestId('guide')).toContainText('x = 10')

  await say(page, 'x = 10')
  // Reading it back is a step of its own: the point is that it was simply
  // there, where the previous lesson would have had to recompute it.
  // Backticks in a lesson render as a code chip, so they are not in the text.
  await expect(page.getByTestId('guide')).toContainText('Look')
  await say(page, 'x')
  await expect(page.getByTestId('thought')).toHaveText('10')
  await say(page, 'y = x')
  // One object, two names on it.
  expect(
    await page.evaluate(() => {
      const s = window.botgineer.snapshot()
      return new Set(s.bindings.map((b) => b.target)).size
    }),
  ).toBe(1)

  await say(page, 'x = 99')
  const bound = await page.evaluate(() =>
    Object.fromEntries(
      window.botgineer
        .snapshot()
        .bindings.map((b) => [b.name, window.botgineer.snapshot().objects[b.target]?.repr]),
    ),
  )
  // x moved; y did not.
  expect(bound).toEqual({ x: '99', y: '10' })

  // Rebinding x makes step one false again, so progress would slide back
  // to the start if it were read from the current snapshot alone.
  await expect(page.getByTestId('guide')).toContainText('it never held it')
})

test('finishing a lesson offers the next one, and only then', async ({ page }) => {
  await open(page, 'names')
  await expect(page.getByTestId('advance')).toHaveCount(0)

  await say(page, 'x = 10')
  await expect(page.getByTestId('advance')).toHaveCount(0)
  await say(page, 'x')
  await say(page, 'y = x')
  await say(page, 'x = 99')

  await page.getByTestId('advance').click()
  expect(page.url()).toContain('#/order')
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
  await expect(page.getByTestId('actor-courier')).toBeVisible()
})

test('the courier asks, and the robot answers from what it stored', async ({ page }) => {
  await open(page, 'order')
  // The courier does the talking in this one, not the crow.
  await expect(page.getByTestId('guide')).toHaveAttribute('data-speaker', 'courier')
  await expect(page.getByTestId('waiting')).toContainText('customer')
  await expect(page.locator('[data-testid="actor-ticket"] .sign-body')).toHaveText('no customer')

  await say(page, 'customer = "Ana"')
  // Storing a name is visible in the world, not just in memory.
  await expect(page.locator('[data-testid="actor-ticket"] .sign-body')).toHaveText('Ana')
  await expect(page.getByTestId('waiting')).toHaveCount(0)

  await say(page, 'parcels = 7')
  await expect(page.getByTestId('guide')).toContainText('Two kilos')

  // The answer was never stored, and was never said out loud by anyone.
  await say(page, 'parcels * 2')
  await expect(page.getByTestId('echo').last()).toHaveText('14')
  await expect(page.getByTestId('guide')).toContainText('Fourteen')
})

/* ------------------------------- the floor ------------------------------- */

/** Feet-to-floor gap in px for every standing actor, at the current shape. */
async function footGaps(page: Page) {
  return page.evaluate(() => {
    const floor = document.querySelector('[data-testid="floor"]')?.getBoundingClientRect()
    if (!floor) return null
    return [...document.querySelectorAll('.actor[data-stand="yes"]')].map((el) => ({
      id: el.getAttribute('data-testid'),
      gap: Math.round(floor.top - el.getBoundingClientRect().bottom),
    }))
  })
}

test('everyone stands on the floor, at every panel shape', async ({ page }) => {
  // Placing an actor by its centre made this gap a function of the
  // panel's aspect ratio: it ran from 65px to 359px and swung 2.4x as
  // the panel was dragged. Anchoring by the feet makes it exactly zero,
  // which is why this can be an equality rather than a tolerance.
  for (const activity of ['sandbox', 'operations', 'order', 'wake']) {
    await open(page, activity)
    for (const [w, h] of [
      [1440, 900],
      [1100, 750],
      [900, 800],
    ] as const) {
      await page.setViewportSize({ width: w, height: h })
      for (const sceneW of [340, 560, 880]) {
        await page.evaluate((v) => {
          const el = document.querySelector('.workbench') as HTMLElement | null
          el?.style.setProperty('--scene-w', `${v}px`)
        }, sceneW)
        const gaps = await footGaps(page)
        expect(gaps, `${activity} has no floor`).not.toBeNull()
        expect(gaps!.length, `${activity} stands nobody`).toBeGreaterThan(0)
        for (const { id, gap } of gaps!) {
          expect(Math.abs(gap), `${activity}/${id} at ${w}x${h} scene ${sceneW}px`).toBeLessThanOrEqual(1)
        }
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 })
})

test('a bubble clears a standing speaker instead of covering them', async ({ page }) => {
  await open(page, 'order')
  const box = await page.evaluate(() => {
    const speaker = document
      .querySelector('[data-testid="guide"]')
      ?.getAttribute('data-speaker')
    const actor = document.querySelector(`[data-testid="actor-${speaker}"]`)?.getBoundingClientRect()
    const bubble = document.querySelector('[data-testid="guide"]')?.getBoundingClientRect()
    const stage = document.querySelector('.stage')?.getBoundingClientRect()
    if (!actor || !bubble || !stage) return null
    return {
      speaker,
      clearance: Math.round(actor.top - bubble.bottom),
      inside:
        bubble.top >= stage.top &&
        bubble.bottom <= stage.bottom &&
        bubble.left >= stage.left &&
        bubble.right <= stage.right,
    }
  })
  expect(box?.speaker).toBe('courier')
  // Above her, not over her. The bubble used to cover 58px of her face.
  expect(box!.clearance).toBeGreaterThanOrEqual(0)
  // And still on the stage. "Above the speaker" is satisfied just as well
  // by a bubble lifted clean off the top of the panel, which is a bug
  // this repo has already shipped once.
  expect(box!.inside).toBe(true)
})

/* ------------------------- what the robot believes ------------------------- */

const robotMood = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-testid="actor-robot"] .character.robot')
    return [...(el?.classList ?? [])].find((c) => c.startsWith('mood-')) ?? null
  })

test('the robot does not celebrate a run that left the lamp dark', async ({ page }) => {
  await open(page, EDITOR)
  // Binds every watched name, raises nothing, completes — and `power = 0`
  // is falsy, so the lamp stays dark. The robot used to beam at this with
  // the same face as a correct run.
  await send(page, 'power = 0\nname = "Bolt"\ncharge = 72\n')

  await expect(page.getByTestId('transcript')).toContainText('Done.')
  await expect(page.getByTestId('waiting')).toHaveCount(0)
  await expect(page.getByTestId('actor-lamp')).toHaveAttribute('data-lit', 'no')
  expect(await robotMood(page)).not.toBe('mood-celebrate')

  // Now make it actually true.
  await send(page, 'power = True\nname = "Bolt"\ncharge = 72\n')
  await expect(page.getByTestId('actor-lamp')).toHaveAttribute('data-lit', 'yes')
  expect(await robotMood(page)).toBe('mood-celebrate')
})

test('a half-finished scene is not a celebration either', async ({ page }) => {
  await open(page, EDITOR)
  await send(page, 'power = True\n')
  await expect(page.getByTestId('actor-lamp')).toHaveAttribute('data-lit', 'yes')
  // One watch of three.
  await expect(page.getByTestId('waiting')).toContainText('name')
  expect(await robotMood(page)).not.toBe('mood-celebrate')
})

test('the empty battery is a battery, not a blank box', async ({ page }) => {
  await open(page, EDITOR)
  const size = () =>
    page.evaluate(() => {
      const box = (sel: string) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const b = el.getBoundingClientRect()
        return { w: Math.round(b.width), h: Math.round(b.height) }
      }
      return { body: box('.gauge-body'), cap: box('.gauge-cap'), actor: box('.actor.gauge') }
    })

  const empty = await size()
  // It has to fill the space the actor was given. Wrapping the body in a
  // flex column once collapsed it to the width of the dash inside it,
  // which looked like a rendering failure rather than an empty gauge.
  expect(empty.body!.w).toBe(empty.actor!.w)
  expect(empty.body!.h).toBeGreaterThan(empty.body!.w)
  expect(empty.cap!.w).toBeGreaterThan(0)
  await expect(page.locator('.gauge-body')).toHaveAttribute('data-level', 'none')
  await expect(page.locator('.battery')).toHaveAttribute('aria-label', /no reading/)

  // Filling it must not change its footprint, or the scene jumps.
  await send(page, 'charge = 72\n')
  const filled = await size()
  expect(filled.body).toEqual(empty.body)
  await expect(page.locator('.gauge-body')).toHaveAttribute('data-level', 'set')
  await expect(page.locator('.battery')).toHaveAttribute('aria-label', 'The battery is at 72 percent')

  // Bound to something that is not a number: empty again, and it says so
  // rather than silently reading zero.
  await send(page, 'charge = "full"\n')
  await expect(page.locator('.gauge-body')).toHaveAttribute('data-level', 'none')
  await expect(page.locator('.gauge-text')).toHaveText('—')
})

test('the cast does not move when the hint bar comes and goes', async ({ page }) => {
  await open(page, EDITOR)
  const geometry = () =>
    page.evaluate(() => {
      const box = (sel: string) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const b = el.getBoundingClientRect()
        return { top: Math.round(b.top), bottom: Math.round(b.bottom) }
      }
      return {
        stage: box('.stage'),
        robot: box('[data-testid="actor-robot"]'),
        floor: box('[data-testid="floor"]'),
        hints: document.querySelectorAll('.stage-foot').length,
      }
    })

  const waiting = await geometry()
  expect(waiting.hints).toBe(1)

  // Binding the last watched name removes the bar. In flow it took ~38px
  // out of the stage on the way out, and since every actor is placed as a
  // percentage of that height, the whole cast jumped — triggered by
  // something with nothing to do with where anyone stands.
  await send(page, 'power = True\nname = "Bolt"\ncharge = 72\n')
  const done = await geometry()
  expect(done.hints).toBe(0)

  expect(done.stage).toEqual(waiting.stage)
  expect(done.robot).toEqual(waiting.robot)
  expect(done.floor).toEqual(waiting.floor)
})

/* ------------------------ memory while you instruct ----------------------- */

test('memory fills in beside the console, without switching to it', async ({ page }) => {
  await open(page, 'sandbox')
  // The point: no switching anywhere in this test.
  await expect(page.getByTestId('console')).toBeVisible()
  await expect(page.getByTestId('memory')).toContainText('Memory is empty')

  // A bare expression is thought of and let go, so memory stays empty.
  await say(page, '10')
  await expect(page.getByTestId('thought')).toHaveText('10')
  await expect(page.getByTestId('memory')).toContainText('Memory is empty')

  // A name is what puts something there, and it appears as you type it.
  await say(page, 'x = 5')
  await expect(page.locator('.node.name')).toHaveText(['x'])
  await expect(page.locator('.node.object .repr')).toHaveText('5')
  await expect(page.getByTestId('console')).toBeVisible()
})

test('an object card leads with its value, and hides its handle', async ({ page }) => {
  await open(page, 'sandbox')
  // Named, because an unnamed value is never in memory to draw.
  await say(page, 'n = 10')
  await stillness(page)
  const card = page.locator('.node.object').first()

  // The value is the thing in the middle, and the biggest thing on it.
  await expect(card.locator('.repr')).toHaveText('10')
  const tiers = await card.evaluate((el) => {
    const px = (sel: string) =>
      parseFloat(getComputedStyle(el.querySelector(sel)!).fontSize)
    return { repr: px('.repr'), type: px('.type'), handle: px('.handle') }
  })
  expect(tiers.repr).toBeGreaterThan(tiers.type)
  expect(tiers.type).toBeGreaterThan(tiers.handle)

  // The type is present but off to the side, not centred with the value.
  await expect(card.locator('.type')).toHaveText('int')

  // The handle is bookkeeping: there for a screen reader and on hover,
  // but not competing with the value.
  expect(await card.locator('.handle').evaluate((el) => getComputedStyle(el).opacity)).toBe('0')
  await card.hover()
  // Polled, not sampled: opacity is transitioned, and reading it on the
  // first frame after hovering catches it still at 0.
  await expect
    .poll(() => card.locator('.handle').evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBeGreaterThan(0)
  await expect(card).toHaveAttribute('aria-label', /10, int, obj\d+/)
})

test('revealing a handle does not resize the card, or the field would shift', async ({ page }) => {
  await open(page, 'sandbox')
  await say(page, 'n = 10')
  // A moving pill slides out from under the cursor, and `:hover` with it.
  await stillness(page)
  const card = page.locator('.node.object').first()
  // Layout pixels, not screen pixels. The pills sit inside the camera's
  // transform, so a bounding rect also reports the current zoom — which
  // was still easing between the two reads and made this look like a
  // resize. `offsetWidth` is what the layout itself measures.
  const size = () =>
    card.evaluate((el: HTMLElement) => `${el.offsetWidth}x${el.offsetHeight}`)
  const resting = await size()
  await card.hover()
  // A size that changed under the cursor would shove the whole field
  // around as the mouse moved across it.
  expect(await size()).toBe(resting)
  await expect
    .poll(() => card.locator('.handle').evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBeGreaterThan(0)
})

/* ------------------------------ getting around ----------------------------- */

test('every level is reachable from the top, and says which one it is', async ({ page }) => {
  await open(page, 'sandbox')
  await expect(page.locator('.steps button')).toHaveCount(5)
  await expect(page.getByTestId('step-sandbox')).toHaveAttribute('aria-current', 'step')

  await page.getByTestId('step-order').click()
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
  await expect(page.getByTestId('actor-courier')).toBeVisible()
  await expect(page.getByTestId('step-order')).toHaveAttribute('aria-current', 'step')
  await expect(page.getByTestId('step-sandbox')).not.toHaveAttribute('aria-current', 'step')

  // And back, so it is not a one-way door like the in-scene Next.
  await page.getByTestId('step-sandbox').click()
  await expect(page.getByTestId('step-sandbox')).toHaveAttribute('aria-current', 'step')
})

test('the last lesson offers somewhere to go, and only once it is done', async ({ page }) => {
  await open(page, 'order')
  await expect(page.getByTestId('advance')).toHaveCount(0)

  await say(page, 'customer = "Ana"')
  await say(page, 'parcels = 7')
  await expect(page.getByTestId('advance')).toHaveCount(0)
  await say(page, 'parcels * 2')

  // This used to be the end of the road: the crow said its piece and
  // there was nothing on screen to do next.
  await expect(page.getByTestId('guide')).toContainText('Fourteen')
  await page.getByTestId('advance').click()
  expect(page.url()).toContain('#/wake')
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
  // And the editor is what it hands over.
  await expect(page.getByTestId('editor')).toBeVisible()
})

test('the last level celebrates but has nowhere to send you', async ({ page }) => {
  await open(page, EDITOR)
  await send(page, 'power = True\nname = "Bolt"\ncharge = 72\n')

  // Satisfied, so the robot is pleased…
  expect(await robotMood(page)).toBe('mood-celebrate')
  // …and `wake` names no `next`, so there is no door to offer. Every
  // activity before it does name one.
  await expect(page.getByTestId('advance')).toHaveCount(0)
})

test('an object card keeps its three tiers legible', async ({ page }) => {
  await open(page, 'sandbox')
  await say(page, 'n = 30')
  await say(page, 'xs = [1, 2]')
  await stillness(page)

  const audit = await page.evaluate(() => {
    const parse = (c: string) => c.match(/[\d.]+/g)!.map(Number)
    const lin = (v: number) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    const L = ([r, g, b]: number[]) => 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!)
    const blend = (fg: number[], a: number, bg: number[]) => fg.map((c, i) => c * a + bg[i]! * (1 - a))
    const ratio = (a: number[], b: number[]) => {
      const [x, y] = [L(a), L(b)].sort((m, n) => n - m)
      return (x! + 0.05) / (y! + 0.05)
    }
    const box = (el: Element) => el.getBoundingClientRect()
    const overlap = (a: DOMRect, b: DOMRect) =>
      !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)

    return [...document.querySelectorAll('.node.object')].map((card) => {
      const bg = parse(getComputedStyle(card).backgroundColor)
      const of = (sel: string) => {
        const el = card.querySelector(sel)!
        const cs = getComputedStyle(el)
        return { el, size: parseFloat(cs.fontSize), ratio: ratio(blend(parse(cs.color), 1, bg), bg) }
      }
      const repr = of('.repr')
      const type = of('.type')
      const handle = of('.handle')
      const cardBox = box(card)
      return {
        reprRatio: repr.ratio,
        typeRatio: type.ratio,
        // The value leads on size.
        valueLeads: repr.size > type.size && repr.size > handle.size,
        // Nothing is drawn on top of anything else.
        collides:
          overlap(box(repr.el), box(type.el)) ||
          overlap(box(repr.el), box(handle.el)) ||
          overlap(box(type.el), box(handle.el)),
        // The type is off the axis the value is read down.
        typeOffAxis:
          Math.abs(
            (box(type.el).left + box(type.el).right) / 2 - (cardBox.left + cardBox.right) / 2,
          ) > 6,
      }
    })
  })

  expect(audit.length).toBeGreaterThan(2)
  for (const card of audit) {
    // 9px text at 2.25:1 was unreadable; secondary must mean smaller and
    // aside, never faded out.
    expect(card.typeRatio).toBeGreaterThanOrEqual(4.5)
    expect(card.reprRatio).toBeGreaterThanOrEqual(4.5)
    expect(card.valueLeads).toBe(true)
    expect(card.collides).toBe(false)
    expect(card.typeOffAxis).toBe(true)
  }
})

test("the robot's thought is visible on the stage, not just in the DOM", async ({ page }) => {
  await open(page, 'operations')
  await say(page, '7 * 6')

  const geometry = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="thought"]')?.getBoundingClientRect()
    const stage = document.querySelector('.stage')?.getBoundingClientRect()
    const robot = document.querySelector('[data-testid="actor-robot"]')?.getBoundingClientRect()
    if (!t || !stage || !robot) return null
    return {
      inside: t.top >= stage.top && t.bottom <= stage.bottom && t.left >= stage.left && t.right <= stage.right,
      clearsRobot: Math.round(robot.top - t.bottom) >= 0,
    }
  })
  // The stage clips, so "in the DOM" is not the same as "on screen" — an
  // unanchored rail put this clean above the top edge.
  expect(geometry?.inside).toBe(true)
  expect(geometry?.clearsRobot).toBe(true)
})

test('the crow and the robot do not talk over each other', async ({ page }) => {
  await open(page, 'operations')
  // The worst case on purpose: the crow's longest line, which wraps to
  // two lines, beside the longest value in the lesson. A short line and a
  // two-digit number clear each other by luck, and testing that was how
  // an overlap survived to the live site.
  await say(page, '"bot" + "gineer"')
  await expect(page.getByTestId('thought')).toHaveText("'botgineer'")

  const boxes = await page.evaluate(() => {
    const r = (sel: string) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: Math.round(b.width) }
    }
    return { guide: r('[data-testid="guide"]'), thought: r('[data-testid="thought"]'), stage: r('.stage') }
  })

  const { guide, thought, stage } = boxes
  expect(guide).not.toBeNull()
  expect(thought).not.toBeNull()

  // Two bubbles above two adjacent characters. They used to collide,
  // because the thought stretched to the width of its rail — and then
  // came out exactly flush, which let a sub-pixel decide the question.
  // A real gap is asserted instead of mere non-overlap.
  expect(Math.round(guide!.t - thought!.b)).toBeGreaterThanOrEqual(8)

  // The value is eleven characters; its bubble should still be modest.
  expect(thought!.w).toBeLessThan(stage!.w * 0.3)

  // And it must be over the robot. Sizing it to its contents once cost
  // it its centring, which put the robot's thought above the crow —
  // a bug no overlap check would catch, because the two then stack.
  const robot = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="actor-robot"]')?.getBoundingClientRect()
    return b ? (b.left + b.right) / 2 : null
  })
  expect(Math.abs((thought!.l + thought!.r) / 2 - robot!)).toBeLessThan(40)
  // And both stay on the stage.
  for (const box of [guide!, thought!]) {
    expect(box.l).toBeGreaterThanOrEqual(stage!.l)
    expect(box.r).toBeLessThanOrEqual(stage!.r)
  }
})

test('no bubble covers a character, whoever is speaking', async ({ page }) => {
  // The crow stands at x=13 in the counter scene and its bubble clamps
  // towards the middle to stay on stage — which put it across the
  // robot's face, because bubbles used to hang from their own speaker's
  // head rather than from one band above the whole cast.
  await open(page, 'order')
  await say(page, 'customer = "Ana"')
  await say(page, 'parcels = 7')
  await say(page, 'parcels * 2')

  const clashes = await page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect()
    const hits = (a: DOMRect, b: DOMRect) =>
      !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
    const bubbles = [...document.querySelectorAll('[data-testid="guide"], [data-testid="thought"]')]
    // Only the cast: a sign or a gauge is scenery and may sit behind.
    const cast = [...document.querySelectorAll('.actor.robot, .actor.crow, .actor.courier')]
    const out: string[] = []
    for (const bubble of bubbles) {
      for (const actor of cast) {
        if (hits(box(bubble), box(actor))) {
          out.push(`${bubble.getAttribute('data-testid')} over ${actor.getAttribute('data-testid')}`)
        }
      }
    }
    return out
  })
  expect(clashes).toEqual([])
})
