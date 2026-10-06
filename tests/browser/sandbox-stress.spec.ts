/**
 * The sandbox under load: a battery of programs (`stress/programs.ts`) run,
 * walked and drawn. For each: what Python printed matches CPython
 * (`stress/expected.json`, recorded from python3), the run ends as it
 * should, memory ends with the right names, the page throws nothing, and at
 * steps across the run, once the picture has settled, no two cards overlap
 * and no arrow's label stands on a card.
 *
 * Opt-in, like the collection audit (`npm run test:stress`, which sets
 * STRESS): it plays ~23 programs a dozen steps each.
 */
import { expect, test, type Page } from '@playwright/test'
import { PROGRAMS } from './stress/programs'
import expected from './stress/expected.json' with { type: 'json' }

test.skip(!process.env.STRESS, 'opt-in: npm run test:stress')

const call = <T,>(page: Page, body: string) => page.evaluate(`(async () => { const b = window.botgineer; ${body} })()`) as Promise<T>

/** Cards and labels that sit on each other, once nothing is moving. */
async function settledFaults(page: Page) {
  let last = ''
  for (let i = 0; i < 40; i++) {
    const now = await page.evaluate(() =>
      [...document.querySelectorAll('.graph .node')].map((n) => { const r = n.getBoundingClientRect(); return `${Math.round(r.x)},${Math.round(r.y)}` }).join('|'),
    )
    if (now === last) break
    last = now
    await page.waitForTimeout(120)
  }
  return page.evaluate(() => {
    const rects = ([...document.querySelectorAll('.graph .node:not(.ghost)')] as HTMLElement[]).map((n) => ({ r: n.getBoundingClientRect(), what: (n.getAttribute('aria-label') ?? n.textContent ?? '').slice(0, 20) }))
    const hit = (a: DOMRect, b: DOMRect, m: number) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > m && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > m
    const faults: string[] = []
    rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => hit(a.r, b.r, 2) && faults.push(`${a.what} × ${b.what}`)))
    for (const l of document.querySelectorAll('.graph .edge-label')) {
      const lr = l.getBoundingClientRect()
      for (const c of rects) if (hit(lr, c.r, 1)) faults.push(`label ${l.textContent} on ${c.what}`)
    }
    return faults
  })
}

for (const p of PROGRAMS) {
  test(`stress: ${p.id}`, async ({ page }) => {
    test.setTimeout(180_000)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./#/code')
    await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
    await page.evaluate((src) => (window as unknown as { botgineer: { setProgram: (s: string) => void } }).botgineer.setProgram(src), p.source)
    await expect.poll(() => call<string>(page, 'return b.getProgram()')).toBe(p.source)
    await call(page, 'window.__run = b.run()')
    for (const line of p.inputs ?? []) {
      await expect.poll(() => call<boolean>(page, 'return b.console.isWaiting()'), { timeout: 30_000 }).toBe(true)
      await call(page, `b.provideInput(${JSON.stringify(line)})`)
      // The next input() may be waiting at once; wait for its prompt.
      await page.waitForTimeout(150)
    }
    await call(page, 'await window.__run')

    // What Python printed is what CPython prints.
    const stdout = await call<string>(page, 'return b.console.chunks().filter(c => c.stream === "stdout").map(c => c.text).join("")')
    const want = (expected as Record<string, string>)[p.id]
    if (want !== undefined) expect(stdout).toBe(want)
    await expect.poll(() => call<string>(page, 'return b.console.buffer()')).toContain(p.ends ?? 'program finished')

    // Walked across the run: settled, nothing sits on anything.
    const steps = await call<number>(page, 'return b.state().steps')
    const sample = [...new Set(Array.from({ length: 12 }, (_, k) => Math.round((k * (steps - 1)) / 11)))]
    const faults: string[] = []
    for (const i of sample) {
      await call(page, `b.step(${i})`)
      for (const f of await settledFaults(page)) faults.push(`step ${i + 1}: ${f}`)
    }
    expect(faults).toEqual([])

    // Memory ends with the program's names.
    const names = await call<string[]>(page, 'return b.snapshot().bindings.filter(x => x.scope === "global").map(x => x.name).sort()')
    if (p.names) expect(names).toEqual(p.names)
    expect(errors).toEqual([])
  })
}
