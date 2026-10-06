/**
 * The sandbox's program console (`src/console/`, `ui/ProgramConsole`), the
 * terminal ported from PLP. These are PLP's X-series acceptance tests
 * (`partlywhole/plp` tests/emulator.spec.mjs, VALIDATION.md), on the
 * sandbox, plus what BotGineer adds: walking a run step by step, typed
 * answers included, and a shared room's console.
 *
 * The evidence is the transcript store and xterm's screen buffer: state,
 * never pixels.
 */
import { expect, test, type Page } from '@playwright/test'

type Chunk = { stream: string; text: string; at: number }
type Bot = {
  setProgram: (s: string) => void
  run: () => Promise<void>
  step: (i: number) => void
  provideInput: (line: string) => void
  events: () => string[]
  state: () => { busy: boolean; step: number; steps: number }
  console: {
    text: () => string
    engineText: () => string
    buffer: () => string
    isWaiting: () => boolean
    chunks: () => Chunk[]
    rows: () => number
    raw: () => {
      append: (s: string, t: string) => void
      reset: () => Promise<boolean>
      term: { buffer: { active: { length: number; getLine: (y: number) => { translateToString: (t: boolean) => string; getCell: (x: number) => { getFgColor: () => number; isFgPalette: () => boolean; isFgDefault: () => boolean } } } }; options: { scrollback: number }; rows: number }
    }
  }
}
declare global {
  interface Window {
    __run?: Promise<void>
  }
}
const bot = <T,>(page: Page, fn: (b: Bot) => T) => page.evaluate(`(${fn.toString()})(window.botgineer)`) as Promise<Awaited<T>>

async function open(page: Page) {
  await page.goto('./#/code')
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
  await expect.poll(() => page.evaluate(() => window.crossOriginIsolated)).toBe(true)
}

async function runProgram(page: Page, source: string) {
  await page.evaluate((src) => (window as unknown as { botgineer: Bot }).botgineer.setProgram(src), source)
  await page.evaluate(() => (window as unknown as { botgineer: Bot }).botgineer.run())
}

test('X0a/X0b: the store matches the engine, and a replay draws the same screen', { tag: '@smoke' }, async ({ page }) => {
  await open(page)
  await runProgram(page, 'import sys\nprint("out1")\nsys.stderr.write("err1\\n")\nprint("out2")\n')
  // X0a: the engine's streams are the step deltas, in order.
  expect(await bot(page, (b) => b.console.engineText())).toBe('out1\nerr1\nout2\n')
  await expect.poll(() => bot(page, (b) => b.console.buffer())).toContain('── program finished ──')
  const before = await bot(page, (b) => b.console.buffer())
  // X0b: walk to the start and back to the end: the same screen.
  await page.evaluate(() => (window as unknown as { botgineer: Bot }).botgineer.step(0))
  await expect.poll(() => bot(page, (b) => b.console.buffer())).not.toContain('out1')
  await page.getByTestId('step-last').click()
  await expect.poll(() => bot(page, (b) => b.console.buffer())).toBe(before)

  // A reset racing xterm's write queue: output queued before it never
  // repaints after, and output since is drawn exactly once.
  await bot(page, (b) => {
    const t = b.console.raw()
    t.append('stdout', 'stale\n')
    void t.reset()
    t.append('stdout', 'current\n')
  })
  await expect.poll(() => bot(page, (b) => b.console.buffer())).toBe('current')
  expect(await bot(page, (b) => b.console.text())).toBe('current\n')
})

test('X2: a carriage return overwrites: one progress line, the last value', async ({ page }) => {
  await open(page)
  await runProgram(page, 'for i in range(5):\n    print(f"\\r{i * 25}%", end="")\nprint()\nprint("done")\n')
  await expect.poll(() => bot(page, (b) => b.console.buffer())).toContain('done')
  const lines = (await bot(page, (b) => b.console.buffer())).split('\n').filter((l) => l.includes('%'))
  expect(lines).toEqual(['100%'])
})

test('X3: ANSI colours land as cell colours', async ({ page }) => {
  await open(page)
  await runProgram(page, 'print("\\x1b[31mred\\x1b[0m plain")\n')
  await expect.poll(() => bot(page, (b) => b.console.buffer())).toContain('red plain')
  const cells = await bot(page, (b) => {
    const buf = b.console.raw().term.buffer.active
    for (let y = 0; y < buf.length; y++) {
      const line = buf.getLine(y)
      if (line.translateToString(true).startsWith('red plain')) {
        const r = line.getCell(0)
        const p = line.getCell(4)
        return { fg: r.getFgColor(), palette: r.isFgPalette(), plain: p.isFgDefault() }
      }
    }
    return null
  })
  expect(cells).toEqual({ fg: 1, palette: true, plain: true })
})

test('X6/X7: typing to input() with a correction, echoed exactly once', async ({ page }) => {
  await open(page)
  await page.evaluate(() => (window as unknown as { botgineer: Bot }).botgineer.setProgram('name = input("Name? ")\nprint("hi", name)\n'))
  await page.evaluate(() => {
    window.__run = (window as unknown as { botgineer: Bot }).botgineer.run()
  })
  await expect.poll(() => bot(page, (b) => b.console.isWaiting()), { timeout: 30_000 }).toBe(true)
  await page.getByTestId('program-console').click()
  await page.keyboard.type('Anx')
  await page.keyboard.press('Backspace')
  await page.keyboard.type('n')
  await page.keyboard.press('Enter')
  await page.evaluate(() => window.__run)
  const buffer = await bot(page, (b) => b.console.buffer())
  expect(buffer).toContain('Name? Ann')
  expect(buffer).toContain('hi Ann')
  expect(buffer.match(/Ann/g)).toHaveLength(2)
  expect((await bot(page, (b) => b.console.text())).match(/Ann/g)).toHaveLength(2)
  // The engine's own echo was off: its streams hold the prompt, not the answer.
  expect(await bot(page, (b) => b.console.engineText())).toBe('Name? hi Ann\n')
})

test('walking an input() run: the answer shows from the step that read it', async ({ page }) => {
  await open(page)
  await page.evaluate(() => (window as unknown as { botgineer: Bot }).botgineer.setProgram('a = input("A? ")\nb = input("B? ")\nprint(a + b)\n'))
  await page.evaluate(() => {
    window.__run = (window as unknown as { botgineer: Bot }).botgineer.run()
  })
  for (const [prompt, answer] of [['A? ', 'x'], ['B? ', 'y']] as const) {
    await expect.poll(() => bot(page, (b) => b.console.buffer()), { timeout: 30_000 }).toContain(prompt.trim())
    await expect.poll(() => bot(page, (b) => b.console.isWaiting())).toBe(true)
    await page.evaluate((a) => (window as unknown as { botgineer: Bot }).botgineer.provideInput(a), answer)
  }
  await page.evaluate(() => window.__run)
  const events = await bot(page, (b) => b.events())
  const firstInput = events.findIndex((e) => e.startsWith('input'))
  await page.evaluate((i) => (window as unknown as { botgineer: Bot }).botgineer.step(i - 1), firstInput)
  await expect.poll(() => bot(page, (b) => b.console.buffer())).not.toContain('A?')
  await page.evaluate((i) => (window as unknown as { botgineer: Bot }).botgineer.step(i), firstInput)
  await expect.poll(() => bot(page, (b) => b.console.buffer())).toContain('A? x')
  expect(await bot(page, (b) => b.console.buffer())).not.toContain('B?')
  await page.getByTestId('step-last').click()
  await expect.poll(() => bot(page, (b) => b.console.buffer())).toContain('xy')
})

test('X9: Ctrl+C in the console stops the run; Ctrl+D says it cannot end the input', async ({ page }) => {
  await open(page)
  await page.evaluate(() => (window as unknown as { botgineer: Bot }).botgineer.setProgram('x = input("? ")\n'))
  await page.evaluate(() => {
    window.__run = (window as unknown as { botgineer: Bot }).botgineer.run()
  })
  await expect.poll(() => bot(page, (b) => b.console.isWaiting()), { timeout: 30_000 }).toBe(true)
  await page.getByTestId('program-console').click()
  await page.keyboard.press('Control+D')
  await expect.poll(() => bot(page, (b) => b.console.buffer())).toContain('EOF (Ctrl+D) is not supported')
  await page.keyboard.press('Control+C')
  await page.evaluate(() => window.__run)
  await expect.poll(() => bot(page, (b) => b.console.buffer())).toContain('── program stopped ──')

  // And a loop busy computing, not waiting.
  await page.evaluate(() => (window as unknown as { botgineer: Bot }).botgineer.setProgram('while True:\n    s = sum(range(100_000))\n'))
  await page.evaluate(() => {
    window.__run = (window as unknown as { botgineer: Bot }).botgineer.run()
  })
  await expect.poll(() => bot(page, (b) => b.state().busy)).toBe(true)
  await page.getByTestId('program-console').click()
  await page.keyboard.press('Control+C')
  await page.evaluate(() => window.__run)
  await expect.poll(() => bot(page, (b) => b.console.buffer())).toMatch(/program stopped|ran out of steps/)
})

test('X11: a flood of output: the whole transcript kept, the screen bounded, the page responsive', async ({ page }) => {
  await open(page)
  await runProgram(page, 'print("\\n".join(map("line {}".format, range(1500))))\n')
  const text = await bot(page, (b) => b.console.text())
  expect(text).toContain('line 0\n')
  expect(text).toContain('line 1499\n')
  const { bufLines, scrollback, rows } = await bot(page, (b) => {
    const t = b.console.raw().term
    return { bufLines: t.buffer.active.length, scrollback: t.options.scrollback, rows: t.rows }
  })
  expect(bufLines).toBeLessThanOrEqual(scrollback + rows)
  const t0 = Date.now()
  await page.evaluate(() => 1 + 1)
  expect(Date.now() - t0).toBeLessThan(1000)
})

test('X12/X14: the console grows with its gutter and keeps a long line whole; nothing fetched from elsewhere', async ({ page }, info) => {
  const external: string[] = []
  const origin = new URL(info.project.use.baseURL!).origin
  page.on('request', (r) => {
    if (new URL(r.url()).origin !== origin) external.push(r.url())
  })
  await open(page)
  await runProgram(page, 'print("x" * 200)\n')
  const rows = await bot(page, (b) => b.console.rows())
  const g = page.getByRole('separator', { name: 'Resize the output' })
  const box = (await g.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y - 150, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => bot(page, (b) => b.console.rows())).toBeGreaterThan(rows)
  await page.evaluate(() => (window as unknown as { botgineer: Bot }).botgineer.step(0))
  await page.getByTestId('step-last').click()
  await expect.poll(async () => (await bot(page, (b) => b.console.buffer())).replace(/\n/g, '')).toContain('x'.repeat(200))
  expect(external).toEqual([])
})
