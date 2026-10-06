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
  await expect(helper.getByTestId('room-bar')).toContainText('helper')

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
