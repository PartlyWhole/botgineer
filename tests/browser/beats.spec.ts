/**
 * The beat engine (docs/PEDAGOGY.md §4), played: narration closes the
 * console and Next moves it on; the question opens it; Back goes back;
 * a typed answer still answers; and reduced motion shows every line
 * whole.
 *
 * Played on the first level, whatever its words: it has beats before
 * its question, a demonstration thought, the robot asleep and woken, a
 * beat that points at the console, praise, closing lines and a takeaway
 * (§5), and these journeys ask the test surface for each rather than
 * reading the lines.
 */
import { expect, test, type Page } from '@playwright/test'
import { CROW_NAME } from '../../content/cast'
import { beat, open, reachable, skip, speechSettled } from './helpers'

/** Presses Next until the line moves on — the first press may only
 *  finish the typing. */
async function next(page: Page) {
  const from = (await beat(page)).at
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('beat-next').click()
    if ((await beat(page)).at !== from) return
  }
  throw new Error('Next did not move the line on')
}

test('narration closes the console, Next moves it on, and the question opens it', async ({ page }) => {
  await open(page, 'sandbox')
  const input = page.getByTestId('console-input')

  const first = await beat(page)
  expect(first).toMatchObject({ at: 0, asking: false, listening: true, kind: 'beat', speaker: 'crow' })
  expect(first.of).toBeGreaterThan(2)
  await expect(input).toBeDisabled()
  await expect(input).toHaveAttribute('placeholder', /Listening/)
  await expect(page.getByTestId('beat-next')).toBeVisible()
  // Who is talking, on a tag in their colour.
  await expect(page.getByTestId('speaker-name')).toHaveText(`${CROW_NAME}:`)
  await expect(page.getByTestId('guide')).toHaveAttribute('data-kind', 'beat')
  // The lesson's steps along the top.
  await expect(page.locator('.beat-seg')).not.toHaveCount(0)
  // Nothing to go back to yet.
  await expect(page.getByTestId('beat-back')).toHaveCount(0)

  await next(page)
  expect((await beat(page)).at).toBe(1)

  // The first press on a line still typing finishes it, and only that.
  await page.getByTestId('beat-next').click()
  expect((await beat(page)).at).toBe(1)
  expect(
    await page.locator('[data-testid="guide"] .tw').evaluateAll((els) =>
      els.every((el) => getComputedStyle(el).opacity === '1'),
    ),
  ).toBe(true)
  await page.getByTestId('beat-next').click()
  expect((await beat(page)).at).toBe(2)

  // Back goes back one line.
  await page.getByTestId('beat-back').click()
  expect((await beat(page)).at).toBe(1)

  // Enter anywhere that is not a control moves it on too, to the question.
  await page.locator('.pane-title').first().click()
  for (let i = 0; i < 30 && (await beat(page)).listening; i++) await page.keyboard.press('Enter')
  const ask = await beat(page)
  expect(ask).toMatchObject({ asking: true, listening: false, kind: 'ask' })
  expect(ask.at).toBe(ask.of - 1)

  // At the question the console opens, takes the keyboard, and glows;
  // Next gives way to a pointer at it.
  await expect(input).toBeEnabled()
  await expect(input).toBeFocused()
  await expect(page.getByTestId('instrument')).toHaveClass(/glow/)
  await expect(page.getByTestId('beat-next')).toHaveCount(0)
  // Where the answer goes is said in the console's own prompt.
  await expect(input).toHaveAttribute('placeholder', 'Type your answer here')
  await expect(page.getByTestId('guide')).toHaveAttribute('data-kind', 'ask')

  // And a typed answer answers it.
  await input.fill('7')
  await input.press('Enter')
  await expect.poll(async () => (await beat(page)).kind).toBe('praise')
  await expect(input).toBeDisabled()
})

test('the beats demonstrate: a thought, the robot asleep and woken, a pointer at the console', async ({ page }) => {
  await open(page, 'sandbox')
  const seen = { thought: false, asleep: false, focus: false }
  while ((await beat(page)).listening) {
    if ((await page.getByTestId('thought').count()) > 0) seen.thought = true
    if ((await page.getByTestId('actor-robot').getAttribute('data-asleep')) === 'yes') seen.asleep = true
    if ((await page.getByTestId('instrument').getAttribute('data-focus')) === 'yes') seen.focus = true
    await page.evaluate(() => window.botgineer.next())
  }
  expect(seen).toEqual({ thought: true, asleep: true, focus: true })
  // A demonstration is not evidence: at the question the robot has
  // thought of nothing, and is awake.
  await expect(page.getByTestId('thought')).toHaveCount(0)
  await expect(page.getByTestId('actor-robot')).toHaveAttribute('data-asleep', 'no')
})

test('say() skips the narration, and the lesson ends on its takeaway, which replays', async ({ page }) => {
  await open(page, 'sandbox')
  expect((await beat(page)).listening).toBe(true)
  // The test surface answers the way a player would after pressing Next
  // through everything.
  await page.evaluate(() => window.botgineer.say('12'))
  await expect.poll(async () => (await beat(page)).kind).toBe('praise')
  await expect(page.getByTestId('guide')).toContainText('12')

  await skip(page)
  await expect(page.getByTestId('takeaway')).toBeVisible()
  // Resting at the end, the console is open again for anything.
  await expect(page.getByTestId('console-input')).toBeEnabled()
  await page.getByTestId('replay').click()
  const replayed = await beat(page)
  expect(replayed).toMatchObject({ kind: 'outro', listening: true })
  await expect(page.getByTestId('takeaway')).toHaveCount(0)
})

test('reduced motion shows every line whole, with a still cue', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, 'sandbox')
  const style = await page.evaluate(() => {
    const chars = [...document.querySelectorAll('[data-testid="guide"] .tw')]
    const cue = document.querySelector('[data-testid="guide"] .bubble-cue')
    return {
      chars: chars.length,
      whole: chars.every((el) => getComputedStyle(el).opacity === '1' && getComputedStyle(el).animationName === 'none'),
      cue: cue ? getComputedStyle(cue).animationName : null,
    }
  })
  expect(style.chars).toBeGreaterThan(0)
  expect(style.whole).toBe(true)
  expect(style.cue).toBe('none')
  // Nothing is typing, so one press is one line.
  await page.getByTestId('beat-next').click()
  expect((await beat(page)).at).toBe(1)
})

/** Two boxes on screen overlap. */
const clash = (a: DOMRect | null, b: DOMRect | null) =>
  a !== null && b !== null && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)

/** The boxes that must keep clear of each other on the stage, read at once. */
const boxes = (page: Page) =>
  page.evaluate(() => {
    const r = (sel: string): DOMRect | null => document.querySelector(sel)?.getBoundingClientRect().toJSON() ?? null
    return {
      stage: r('.stage'),
      bar: r('[data-testid="beat-bar"]'),
      name: r('[data-testid="speaker-name"]'),
      guide: r('[data-testid="guide"]'),
      thought: r('[data-testid="thought"]'),
      prop: r('[data-testid="prop"]'),
      ask: r('[data-testid="prop-ask"]'),
      cast: [...document.querySelectorAll('.actor.robot, .actor.crow, .actor.courier')]
        .filter((a) => a.getAttribute('data-offstage') !== 'yes')
        .map((a) => a.getBoundingClientRect().toJSON() as DOMRect),
    }
  })

// Order and wake wait on a name from their first beat, so their hint
// strip is up while the crow and Mira talk — and it used to float over
// Next, the one control a beat needs.
for (const level of ['order', 'wake']) {
  test(`Next stands clear of the hint strip in ${level}`, async ({ page }) => {
    await open(page, level)
    await expect(page.getByTestId('waiting')).toBeVisible()
    expect((await beat(page)).listening).toBe(true)
    expect(await reachable(page, 'beat-next')).toEqual({ inView: true, onTop: true, under: [] })
    // And it works where it stands.
    await next(page)
    expect((await beat(page)).at).toBe(1)
  })
}

test.describe('at phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the stage holds: the bubble over the cast, the picture in view, Next reachable', async ({ page }) => {
    await open(page, 'types')
    for (let i = 0; i < 8; i++) {
      const b = await beat(page)
      if (!b.listening) break
      await speechSettled(page)
      // Nothing stands on Next, and it is on screen.
      expect(await reachable(page, 'beat-next'), `beat ${b.at}`).toEqual({ inView: true, onTop: true, under: [] })
      const on = await boxes(page)
      // The bubble is on the stage, under the bar — the name pill used to
      // sit on it — and over the cast's heads rather than on them.
      expect(on.guide!.top, `beat ${b.at}`).toBeGreaterThanOrEqual(on.stage!.top)
      expect(on.guide!.bottom).toBeLessThanOrEqual(on.stage!.bottom)
      expect(clash(on.name, on.bar), `name on the bar at beat ${b.at}`).toBe(false)
      for (const actor of on.cast) expect(clash(on.guide, actor), `bubble on the cast at beat ${b.at}`).toBe(false)
      if (on.thought) expect(on.thought.top).toBeGreaterThanOrEqual(on.stage!.top)
      // The picture is in view and nothing talks over it.
      if (on.prop) {
        await expect(page.getByTestId('prop')).toBeVisible()
        expect(on.prop.bottom).toBeLessThanOrEqual(on.stage!.bottom)
        expect(clash(on.guide, on.prop), `bubble on the picture at beat ${b.at}`).toBe(false)
      }
      await next(page)
    }
    // The question: the picture still there, and nothing talks over it.
    await skip(page)
    await speechSettled(page)
    const on = await boxes(page)
    expect(on.prop).not.toBeNull()
    expect(clash(on.guide, on.prop)).toBe(false)
    expect(clash(on.name, on.bar)).toBe(false)
  })
})
