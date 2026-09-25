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
  { id: 'sandbox', answers: ['7'], pictures: ['pointer'] },
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
