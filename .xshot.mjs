// usage: node .xshot.mjs <level> <w> <h> <tag> [cmds...]  ("@next" advances a beat, "@skip" skips narration, "@shot" screenshots)
import { chromium } from '@playwright/test'
const [level, w, h, tag, ...cmds] = process.argv.slice(2)
const SHOTS = '/private/tmp/claude-501/-Users-alan-BotGineer/79cf2d19-82cc-4fb8-84d9-57dd456116c3/scratchpad/shots'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, reducedMotion: process.env.RM ? 'reduce' : 'no-preference' })
const page = await ctx.newPage()
await page.addInitScript((done) => localStorage.setItem('botgineer.progress.v1', JSON.stringify(done)), ['*unlock-all'])
await page.goto(`http://127.0.0.1:8861/botgineer/#/${level}`)
await page.waitForSelector('.app[data-boot="ready"]', { timeout: 90000 })
await page.waitForTimeout(800)
let n = 0
const idle = () => page.waitForSelector('[data-testid="robot-panel"][data-busy="no"]', { timeout: 60000 })
for (const c of cmds) {
  if (c === '@next') { await page.evaluate(() => window.botgineer.next()); await page.waitForTimeout(250) }
  else if (c === '@skip') { await page.evaluate(() => window.botgineer.skip()); await page.waitForTimeout(250) }
  else if (c.startsWith('@wait')) await page.waitForTimeout(+c.slice(5) || 1500)
  else if (c.startsWith('@click:')) { await page.click(c.slice(7)); await page.waitForTimeout(300) }
  else if (c.startsWith('@js:')) console.log(JSON.stringify(await page.evaluate(c.slice(4))))
  else if (c === '@shot') {
    n++
    await page.waitForTimeout(1500)
    const f = `${SHOTS}/X-engine-${tag}-${n}.png`
    await page.screenshot({ path: f })
    const bt = await page.evaluate(() => { try { return window.botgineer.beat() } catch { return null } })
    console.log(f, JSON.stringify(bt), 'scrollY', await page.evaluate(() => scrollY))
  } else {
    await page.evaluate(() => window.botgineer.skip())
    await page.fill('[data-testid="console-input"]', c)
    await page.press('[data-testid="console-input"]', 'Enter')
    await page.waitForTimeout(200)
    await idle()
  }
}
await b.close()
