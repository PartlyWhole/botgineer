/**
 * The stage pictures, in the stage: where they stand among the cast, and
 * what they draw of an answer the step refused. The pictures' own logic
 * is unit-tested (tests/unit/props.test.ts); these are the claims that
 * only hold once the picture shares a stage with the characters.
 */
import { expect, test, type Page } from '@playwright/test'
import { open, say } from './helpers'

const VIEWPORTS = [
  { name: 'desktop', width: 1400, height: 860 },
  { name: 'phone', width: 390, height: 844 },
]

/**
 * The faces a picture would cover: for each character on stage, whether
 * the topmost thing at its face is part of the picture, first where the
 * picture really stands and then with its slot moved over that face.
 *
 * The move is what makes this a test of layering rather than of where
 * today's scenes happen to put things. At rest no slot overlaps a
 * character; it is a demonstration crossing the stage (the codes'
 * letters sliding in from the left edge, past the crow) or a picture
 * drawn past its slot that does, for a moment, and a moment is not
 * something to assert on. A picture moved onto a face, though, must
 * still be under it. A bubble over a face is the bubbles' business.
 */
function coveredFaces(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const slot = document.querySelector<HTMLElement>('[data-testid="props"]')
    for (const actor of document.querySelectorAll<HTMLElement>('.stage .actor')) {
      if (actor.dataset['offstage'] === 'yes' || !actor.matches('.robot, .crow, .courier')) continue
      const r = actor.querySelector('.character')!.getBoundingClientRect()
      // The face: the middle of the upper part, where every character's
      // eyes are.
      const x = r.left + r.width / 2
      const y = r.top + r.height * 0.4
      const over = () => document.elementFromPoint(x, y)?.closest('[data-testid="props"]') != null
      if (over()) out.push(`${actor.dataset['testid']} where it stands`)
      if (!slot) continue
      const stage = slot.parentElement!.getBoundingClientRect()
      const { left, bottom } = slot.style
      // Centred on the face, its bottom a little under it.
      slot.style.left = `${((x - stage.left) / stage.width) * 100}%`
      slot.style.bottom = `${((stage.bottom - y) / stage.height) * 100 - 10}%`
      if (over()) out.push(`${actor.dataset['testid']} when the picture stands on it`)
      slot.style.left = left
      slot.style.bottom = bottom
    }
    return out
  })
}

/** No character is mid-transition: entering, leaving or turning. */
const castSettled = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.stage .actor, .stage .actor .character')].every((el) =>
      el.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== 'running'),
    ),
  )

/**
 * Walks a lesson from the start, checking every beat that stands a
 * picture, and answering each ask with the next of `answers`. Returns the
 * picture kinds it saw, so a lesson that stopped showing them fails too.
 */
async function walk(page: Page, answers: string[]): Promise<Set<string>> {
  const seen = new Set<string>()
  const queue = [...answers]
  for (let i = 0; i < 160; i++) {
    const kind = await page.getByTestId('prop').getAttribute('data-prop', { timeout: 50 }).catch(() => null)
    if (kind) {
      seen.add(kind)
      // A character walking on is somewhere between offstage and its
      // mark: measured part-way, its face is not where it is drawn.
      await expect.poll(() => castSettled(page)).toBe(true)
      expect(await coveredFaces(page), `the ${kind} picture covers a face`).toEqual([])
    }
    const b = await page.evaluate(() => window.botgineer.beat())
    if (b.listening) await page.evaluate(() => window.botgineer.next())
    else if (queue.length) await say(page, queue.shift()!)
    else break
  }
  return seen
}

const LESSONS: { id: string; answers: string[]; pictures: string[] }[] = [
  { id: 'sandbox', answers: ['7'], pictures: [] },
  { id: 'types', answers: ['True', '-1', '0.5', '"M"', '"hello"'], pictures: ['shelf', 'lift', 'beads'] },
  {
    id: 'choose',
    answers: ['False', '6', '0.25', '"Mira"', '-1', '"M"', '1.7', 'True', '"0412 555 019"', '1.5', 'True', '"Yeah it is"'],
    pictures: ['shelf'],
  },
  {
    id: 'operations',
    answers: ['7 * 6', '20 - 7', '9 / 2', '8 / 2', '2 + 0.5', '3 > 5', '7 * 6 == 42', '"bot" + "gineer"', '"ha" * 5', 'ord("M")', 'True + True + True', '2 + 3 * 4', '(2 + 3) * 4'],
    pictures: ['crates', 'contrast', 'codes'],
  },
  { id: 'order', answers: ['customer = "Mira"', 'parcels = 7', 'parcels * 2'], pictures: ['scale'] },
]

for (const vp of VIEWPORTS) {
  test.describe(`at ${vp.name} width`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    // The slot once had `z-index: 1`, which drew every picture over the
    // whole cast: the pointer's chevrons over the robot, the shelf over
    // the crow on a phone.
    for (const lesson of LESSONS) {
      test(`${lesson.id}: no picture is drawn over a face`, async ({ page }) => {
        test.setTimeout(180_000)
        await open(page, lesson.id)
        const seen = await walk(page, lesson.answers)
        for (const p of lesson.pictures) expect(seen, `never saw the ${p}`).toContain(p)
      })
    }
  })
}

test('a right number typed by hand is drawn as not worked out, not as the answer', async ({ page }) => {
  await open(page, 'operations')
  await say(page, '42')
  const prop = page.getByTestId('prop')
  await expect(prop).toHaveAttribute('data-prop', 'crates')
  await expect(prop).toHaveAttribute('data-verdict', 'miss')
  await expect(prop).toHaveAttribute('data-worked', 'no')
  await expect(prop.locator('.bolt.lit')).toHaveCount(0)
  await expect(prop.locator('.crates-label')).toHaveText('7 * 6 = ?')
  await expect(page.getByTestId('answer-tag')).toHaveClass(/unworked/)

  // Worked out, the same number fills the crates: the answered picture
  // stays on stage through the praise.
  await say(page, '7 * 6')
  const answered = page.locator('[data-prop="crates"][data-verdict="right"]')
  await expect(answered).toHaveCount(1)
  await expect(answered).not.toHaveAttribute('data-worked', 'no')
  await expect(answered.locator('.bolt.lit')).toHaveCount(42)
})

test('the scale waits for a weight nobody worked out from parcels', async ({ page }) => {
  await open(page, 'order')
  for (const l of ['customer = "Mira"', 'parcels = 7', '7 * 2']) await say(page, l)
  const prop = page.getByTestId('prop')
  await expect(prop).toHaveAttribute('data-worked', 'no')
  await expect(prop.locator('.scale')).not.toHaveClass(/weighed/)
  await expect(prop.locator('.reading')).toHaveText('? kg')

  // A name that holds the weight is still not the working.
  for (const l of ['weight = parcels * 2', 'weight']) await say(page, l)
  await expect(prop).toHaveAttribute('data-worked', 'no')
  await expect(prop.locator('.reading')).toHaveText('? kg')

  await say(page, 'parcels * 2')
  await expect(page.locator('[data-prop="scale"] .scale.weighed').first()).toBeVisible()
  await expect(page.locator('[data-prop="scale"] .reading').first()).toHaveText('14 kg')
})

test('a beat can point at a fixture by hopping it', async ({ page }) => {
  await open(page, 'wake')
  const next = () => page.evaluate(() => window.botgineer.next())
  for (let i = 0; i < 4; i++) await next()
  expect((await page.evaluate(() => window.botgineer.beat())).text).toContain('lamp')
  const lamp = page.getByTestId('actor-lamp')
  await expect(lamp).toHaveClass(/act-hop/)
  // The lamp's body is its reaction target: the one-shot actually plays.
  expect(await lamp.locator('.bulb').evaluate((el) => el.getAnimations().map((a) => (a as CSSAnimation).animationName))).toContain('hop-small')
  await next()
  await expect(page.getByTestId('actor-nameplate')).toHaveClass(/act-hop/)
  await expect(lamp).not.toHaveClass(/act-hop/)
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  // styles.css's calm rule (`* { animation: none !important }`) once took
  // the payoff's fade too: the answered picture and its ticked tag never
  // left, and the next question's picture was drawn on top of them.
  test('the answered picture gives way before the next question is asked', async ({ page }) => {
    test.setTimeout(120_000)
    await open(page, 'practice-thinking')
    const exercise = () =>
      page.evaluate(() => (window.botgineer as unknown as { exercise: () => { answer: string } | null }).exercise())
    let left = 0
    for (let k = 0; k < 2; k++) {
      await say(page, (await exercise())!.answer)
      for (let i = 0; i < 6 && !(await page.evaluate(() => window.botgineer.beat())).asking; i++) {
        await page.evaluate(() => window.botgineer.next())
      }
      const leaving = page.getByTestId('prop-leaving')
      if ((await leaving.count()) > 0) {
        left++
        await expect.poll(() => leaving.evaluate((el) => getComputedStyle(el).opacity), { timeout: 5_000 }).toBe('0')
      }
      await expect.poll(() => page.getByTestId('prop').evaluate((el) => getComputedStyle(el).opacity), { timeout: 5_000 }).toBe('1')
    }
    expect(left, 'no answered picture was ever on its way out').toBeGreaterThan(0)
  })
})

/** The smallest type in the picture, as drawn on screen, in pixels: each
 *  text's own size times how far the picture is scaled. */
const smallestType = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const sizes = [...document.querySelectorAll<SVGTextElement>(sel)].map((t) => {
      const k = t.ownerSVGElement!.getScreenCTM()!.a
      return parseFloat(getComputedStyle(t).fontSize) * k
    })
    return sizes.length ? Math.min(...sizes) : 0
  }, selector)

// The shelf is Lesson 1's spine, and its chips were drawn at 6px on a
// desktop stage (3.8px on a phone): nobody could read what was on it.
test.describe('at desktop width', () => {
  test.use({ viewport: { width: 1400, height: 800 } })

  test('the shelf can be read: its labels and chips are drawn at 9px or more', async ({ page }) => {
    await open(page, 'types')
    const answers = ['True', '-1', '0.5', '"M"', '"hello"']
    for (let i = 0; i < 80; i++) {
      const chips = await page.locator('[data-testid="prop"] .shelf .chip').count()
      if (chips >= 8) break
      if ((await page.evaluate(() => window.botgineer.beat())).listening) await page.evaluate(() => window.botgineer.next())
      else await say(page, answers.shift()!)
    }
    expect(await page.locator('[data-testid="prop"] .shelf .chip').count()).toBeGreaterThanOrEqual(8)
    expect(await smallestType(page, '[data-testid="prop"] .shelf .chip text')).toBeGreaterThanOrEqual(9)
    expect(await smallestType(page, '[data-testid="prop"] .shelf .slot-label')).toBeGreaterThanOrEqual(9.5)
  })

  // The chips' type was sized from a per-character estimate that ran
  // short of the stage's face: `"hello"` overran its chip's outline by a
  // pixel, `"Mira"` by 0.6, and the char slot's tag and the `later` label
  // were set under 9px. The shelf now measures what it drew.
  for (const lesson of [
    { id: 'types', answers: ['True', '-1', '0.5', '"M"', '"hello"'], min: 9 },
    { id: 'choose', answers: ['False', '6', '0.25', '"Mira"', '-1', '"M"', '1.7', 'True', '"0412 555 019"', '1.5', 'True', '"Yeah it is"'], min: 0 },
  ])
    test(`${lesson.id}: every shelf chip's text sits inside its chip, with room`, async ({ page }) => {
      test.setTimeout(180_000)
      await open(page, lesson.id)
      const queue = [...lesson.answers]
      const problems = new Set<string>()
      const seen = { chips: new Set<string>(), tag: false, later: false }
      for (let i = 0; i < 160; i++) {
        if (await page.locator('[data-testid="prop"] .shelf').count()) {
          // Settled: the chips fly in scaled, and a size measured mid-
          // flight is not the size a reader gets.
          await expect
            .poll(() => page.evaluate(() => document.querySelector('[data-testid="prop"]')?.getAnimations({ subtree: true }).every((a) => a.playState !== 'running') ?? true), { timeout: 5_000 })
            .toBe(true)
            .catch(() => undefined)
          const m = await page.evaluate((min) => {
            const out: string[] = []
            const chips: string[] = []
            for (const chip of document.querySelectorAll('[data-testid="prop"] .shelf .chip')) {
              const r = chip.querySelector('rect')!.getBoundingClientRect()
              for (const t of chip.querySelectorAll('text')) {
                chips.push(t.textContent ?? '')
                const b = t.getBoundingClientRect()
                // Room across; down, only inside: a text's box is the
                // face's whole ascent and descent, not its ink.
                const side = Math.min(b.left - r.left, r.right - b.right)
                const end = Math.min(b.top - r.top, r.bottom - b.bottom)
                if (side < 1) out.push(`${t.textContent} is ${side.toFixed(1)}px from its chip's side`)
                if (end < -0.5) out.push(`${t.textContent} crosses its chip's top or bottom by ${(-end).toFixed(1)}px`)
              }
            }
            const px = (t: SVGTextElement) => parseFloat(getComputedStyle(t).fontSize) * t.ownerSVGElement!.getScreenCTM()!.a
            const small = (sel: string) =>
              [...document.querySelectorAll<SVGTextElement>(sel)].filter((t) => px(t) < min - 0.05).map((t) => `${t.textContent} at ${px(t).toFixed(1)}px`)
            out.push(...small('[data-testid="prop"] .shelf .chip text'), ...small('[data-testid="prop"] .shelf .char-tag text'), ...small('[data-testid="prop"] .shelf .later-tag text'))
            return {
              out,
              chips,
              tag: document.querySelector('[data-testid="prop"] .shelf .char-tag') != null,
              later: document.querySelector('[data-testid="prop"] .shelf .later-tag') != null,
            }
          }, lesson.min)
          m.out.forEach((o) => problems.add(o))
          m.chips.forEach((c) => seen.chips.add(c))
          seen.tag ||= m.tag
          seen.later ||= m.later
        }
        const b = await page.evaluate(() => window.botgineer.beat())
        if (b.listening) await page.evaluate(() => window.botgineer.next())
        else if (queue.length) await say(page, queue.shift()!)
        else break
      }
      expect([...problems]).toEqual([])
      expect([...seen.chips]).toContain(lesson.id === 'types' ? '"hello"' : '"Mira"')
      if (lesson.id === 'types') expect(seen.tag && seen.later, 'saw the char tag and the later label').toBe(true)
    })
})

// The answer tag hung 40px under the picture's slot, on whatever the
// stage put there: at a narrow stage, beside Next on the order outro.
// It lives in the slot's own box now, at every size.
for (const vp of [
  { name: 'desktop', width: 1400, height: 860 },
  { name: 'stacked', width: 900, height: 1000 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test(`at ${vp.name} width, the scale's answer tag stays inside the picture`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await open(page, 'order')
    for (const line of ['customer = "Mira"', 'parcels = 7', 'parcels * 2']) await say(page, line)
    await expect(page.getByTestId('answer-tag')).toBeVisible()
    await page.evaluate(() => window.botgineer.skip())
    await page.waitForTimeout(600)
    const out = await page.evaluate(() => {
      const slot = document.querySelector('[data-testid="props"]')!.getBoundingClientRect()
      return [...document.querySelectorAll('[data-testid="answer-tag"]')].map((tag) => {
        const b = tag.getBoundingClientRect()
        return Math.min(b.left - slot.left, slot.right - b.right, b.top - slot.top, slot.bottom - b.bottom)
      })
    })
    expect(out.length).toBeGreaterThan(0)
    for (const inset of out) expect(inset).toBeGreaterThanOrEqual(-0.5)
  })
}

// A phone's stage gives the picture a slot about 300px across. Every
// picture scales with its slot, so at that size its smallest type must
// read at 11px or more.
test('on a phone, a 300px slot draws the shelf and its chips at 11px or more', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, 'types')
  await page.addStyleTag({ content: '.stage .props-slot { width: 300px !important }' })
  const answers = ['True', '-1', '0.5', '"M"', '"hello"']
  for (let i = 0; i < 80; i++) {
    if ((await page.locator('[data-testid="prop"] .shelf .char-tag').count()) > 0) break
    if ((await page.evaluate(() => window.botgineer.beat())).listening) await page.evaluate(() => window.botgineer.next())
    else await say(page, answers.shift()!)
  }
  await page.waitForTimeout(1500)
  expect(await smallestType(page, '[data-testid="prop"] .shelf text')).toBeGreaterThanOrEqual(11)
})
