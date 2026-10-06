import { expect, test, type Page } from '@playwright/test'

/* The sandbox, shared (`src/collab/`). Two pages of one browser context
   share a room over BroadcastChannel only (`?transports=tabs`), so these
   need no network and never reach the relay. */

const call = <T,>(page: Page, body: string) => page.evaluate(`(async () => { const b = window.botgineer; ${body} })()`) as Promise<T>

async function ready(page: Page, hash: string) {
  await page.goto(`./?transports=tabs${hash}`)
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
}

/** A learner who shares, and a helper who opens the link. */
async function pair(page: Page) {
  const relay: string[] = []
  page.on('websocket', (ws) => relay.push(ws.url()))
  await ready(page, '#/code')
  await page.getByTestId('room-share').click()
  await expect(page.getByTestId('room-bar')).toHaveAttribute('data-room', 'live')
  const link = await page.evaluate(() => window.location.hash)
  expect(link).toMatch(/^#\/code&room=automerge:\w+&via=tabs$/)
  const helper = await page.context().newPage()
  helper.on('websocket', (ws) => relay.push(ws.url()))
  await ready(helper, link)
  await expect(helper.getByTestId('room-bar')).toHaveAttribute('data-room', 'live')
  await expect(page.getByTestId('room-bar')).toHaveAttribute('data-peers', '2')
  await expect(helper.getByTestId('room-bar')).toHaveAttribute('data-peers', '2')
  return { helper, relay }
}

test('a helper joins, edits, and both walk the learner\'s run step by step', { tag: '@smoke' }, async ({ page }) => {
  const { helper, relay } = await pair(page)
  // Names only: nobody is labelled learner or helper.
  await expect(helper.getByTestId('room-bar')).not.toContainText(/helper|learner/)

  // The joiner adopts the learner's program; an edit from either reaches both.
  expect(await call<string>(helper, 'return b.getProgram()')).toBe(await call<string>(page, 'return b.getProgram()'))
  await call(helper, "b.setProgram('x = [1, 2]\\ny = x\\ny.append(3)\\nprint(x)\\n')")
  await expect.poll(() => call<string>(page, 'return b.getProgram()')).toContain('y.append(3)')

  // The learner runs; the helper is shown the same run, on its first step.
  await page.getByTestId('run').click()
  await expect.poll(() => call<number>(helper, 'return b.state().steps')).toBeGreaterThan(3)
  const [mine, theirs] = await Promise.all([call<{ runId: string; steps: number; step: number }>(page, 'return b.state()'), call<{ runId: string; steps: number; step: number }>(helper, 'return b.state()')])
  expect(theirs.runId).toBe(mine.runId)
  expect(theirs.steps).toBe(mine.steps)
  expect(theirs.step).toBe(0)

  // Stepping moves the other page too, and memory agrees.
  await helper.getByTestId('step-last').click()
  await expect.poll(() => call<number>(page, 'return b.state().step')).toBe(mine.steps - 1)
  expect(await call<string[]>(page, 'return b.snapshot().bindings.map(x => x.name)')).toEqual(['x', 'y'])
  await expect(page.getByTestId('transcript')).toContainText('[1, 2, 3]')

  // Picking a card picks it on both screens; letting go lets go on both.
  await helper.locator('.node.name', { hasText: 'y' }).click()
  await expect(page.getByTestId('memory')).toHaveAttribute('data-picked', 'yes')
  await expect(page.locator('.node.name.picked')).toHaveText(/y/)
  await page.locator('.node.object.picked, .node.name.picked').first().click()
  await expect(helper.getByTestId('memory')).toHaveAttribute('data-picked', 'no')

  // One caret for the other peer, and none for yourself.
  await helper.locator('.cm-content').click()
  await expect(page.locator('.cm-peer-caret')).toHaveCount(1)
  await expect(helper.locator('.cm-peer-caret')).toHaveCount(1)

  // Tabs only: the relay was never dialled.
  expect(relay.filter((u) => u.includes('sync.'))).toEqual([])
})

test('a late joiner is shown the last run; leaving drops you from the room', async ({ page }) => {
  await ready(page, '#/code')
  await page.getByTestId('room-share').click()
  await expect(page.getByTestId('room-bar')).toHaveAttribute('data-room', 'live')
  await page.getByTestId('run').click()
  await expect.poll(() => call<number>(page, 'return b.state().steps')).toBeGreaterThan(3)
  const link = await page.evaluate(() => window.location.hash)

  const late = await page.context().newPage()
  await ready(late, link)
  await expect.poll(() => call<string | null>(late, 'return b.state().runId')).toBe(await call<string>(page, 'return b.state().runId'))
  expect(await call<number>(late, 'return b.state().step')).toBe(0)

  await late.getByTestId('room-leave').click()
  await expect(late.getByTestId('room-bar')).toHaveAttribute('data-room', 'solo')
  expect(await late.evaluate(() => window.location.hash)).toBe('#/code')
  await expect(page.getByTestId('room-bar')).toHaveAttribute('data-peers', '1', { timeout: 10_000 })
})

test("nobody may run while another's run is going", async ({ page }) => {
  const { helper } = await pair(page)
  // A run long enough to catch in the act.
  await call(page, "b.setProgram('n = 0\\nfor i in range(400):\\n    n = n + i\\n')")
  await expect.poll(() => call<string>(helper, 'return b.getProgram()')).toContain('range(400)')
  void call(page, 'return b.run()')
  await expect(helper.getByTestId('room-busy')).toContainText('is running the program')
  await expect(helper.getByTestId('run')).toBeDisabled()
  await expect.poll(() => call<number>(helper, 'return b.state().steps'), { timeout: 30_000 }).toBeGreaterThan(100)
  await expect(helper.getByTestId('run')).toBeEnabled()
})

/** Where a peer's caret is drawn: how many characters of its line come
 *  before it. */
const peerCaretColumn = (page: Page) =>
  page.evaluate(() => {
    const caret = document.querySelector('.cm-peer-caret')
    const line = caret?.closest('.cm-line')
    if (!caret || !line) return null
    const r = document.createRange()
    r.setStart(line, 0)
    r.setEndBefore(caret)
    return r.toString().replace(/\u200b/g, '').length
  })

test("a peer's caret is drawn where it really is, whoever types", async ({ page }) => {
  const { helper } = await pair(page)
  await call(helper, "b.setProgram('x = 1\\n')")
  await expect.poll(() => call<string>(page, 'return b.getProgram()')).toBe('x = 1\n')
  // The helper's caret at the end of line 1, placed by the End key and
  // then by a click: the two lean different ways.
  const own = () => call<{ head: number }>(helper, 'return b.selection()').then((s) => s.head)
  for (const place of ['key', 'click'] as const) {
    if (place === 'key') {
      await helper.locator('.cm-content').click()
      await helper.keyboard.press('ControlOrMeta+Home')
      await helper.keyboard.press('End')
    } else {
      const line = helper.locator('.cm-line').first()
      const box = (await line.boundingBox())!
      await helper.mouse.click(box.x + box.width - 4, box.y + box.height / 2)
    }
    await expect.poll(() => peerCaretColumn(page)).toBe(await own())
    // The learner types exactly there, and before it. Someone else's
    // typing never moves your caret: the helper's stays before the "+2".
    const at = await own()
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+Home')
    for (let i = 0; i < at; i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.type('+2')
    await page.keyboard.press('Home')
    await page.keyboard.type('#')
    await expect.poll(() => call<string>(helper, 'return b.getProgram()')).toMatch(/^#.*\+2/)
    expect(await own()).toBe(at + 1)
    // Drawn here where it is there, at once and after the peer's re-send.
    expect(await peerCaretColumn(page)).toBe(await own())
    await page.waitForTimeout(400)
    expect(await peerCaretColumn(page)).toBe(await own())
    await call(helper, "b.setProgram('x = 1\\n')")
    await expect.poll(() => call<string>(page, 'return b.getProgram()')).toBe('x = 1\n')
  }
})

test("a peer's caret holds still while you type before it", async ({ page }) => {
  const { helper } = await pair(page)
  await call(helper, "b.setProgram('x = 1\\n')")
  await expect.poll(() => call<string>(page, 'return b.getProgram()')).toBe('x = 1\n')
  await helper.locator('.cm-content').click()
  await helper.keyboard.press('ControlOrMeta+Home')
  await helper.keyboard.press('End')
  await expect.poll(() => peerCaretColumn(page)).toBe(5)
  // Type steadily at the start of the line, as a person does, and look at
  // the helper's caret after every key: it rides along with its text, one
  // column a key, and never jumps back to where it was.
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+Home')
  const seen: number[] = []
  for (const ch of 'abcdefghijklmnopqrst') {
    await page.keyboard.type(ch)
    await page.waitForTimeout(35)
    seen.push((await peerCaretColumn(page)) ?? -1)
  }
  expect(seen).toEqual(seen.map((_, i) => 6 + i))
  await expect.poll(() => call<string>(helper, 'return b.getProgram()')).toBe('abcdefghijklmnopqrstx = 1\n')
  await page.waitForTimeout(400)
  expect(await peerCaretColumn(page)).toBe(25)
})

test('resizing a pane resizes it for everyone; the output has its own gutter', async ({ page }) => {
  const { helper } = await pair(page)
  const width = (p: Page) => p.locator('.sandbox-code').evaluate((el) => Math.round(el.getBoundingClientRect().width))
  const outputH = (p: Page) => p.getByTestId('transcript').evaluate((el) => Math.round(el.getBoundingClientRect().height))
  const drag = async (p: Page, label: string, dx: number, dy: number) => {
    const g = p.getByRole('separator', { name: label })
    const box = (await g.boundingBox())!
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await p.mouse.down()
    await p.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 })
    await p.mouse.up()
  }
  const before = await width(page)
  await drag(helper, 'Resize the editor', 120, 0)
  const after = await width(helper)
  expect(after).toBeGreaterThan(before + 60)
  await expect.poll(() => width(page)).toBeGreaterThan(after - 4)
  await expect.poll(() => width(page)).toBeLessThan(after + 4)

  const out = await outputH(page)
  await drag(page, 'Resize the output', 0, -80)
  await expect.poll(() => outputH(page)).toBeGreaterThan(out + 50)
  await expect.poll(() => outputH(helper)).toBeGreaterThan(out + 50)
})

test('full screen: no bar along the top, no room strip, and a way back', async ({ page }) => {
  await pair(page)
  await page.getByTestId('full-screen').click()
  await expect(page.locator('.topbar')).toBeHidden()
  await expect(page.getByTestId('room-bar')).toBeHidden()
  await expect(page.getByTestId('instrument')).toBeVisible()
  await page.getByTestId('exit-full-screen').click()
  await expect(page.locator('.topbar')).toBeVisible()
  await expect(page.getByTestId('room-bar')).toBeVisible()
})
