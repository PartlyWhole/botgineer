import { expect, test, type Page } from '@playwright/test'
import { beat, open, say, skip } from './helpers'

/* Practice sessions (docs/PEDAGOGY.md §6 Practice): generated questions,
   each wearing who does the work, praise as its own beat, and the shelf at
   the end of the thinking unit. Moved here from workbench.spec.ts. */

/** The exercise being asked, from the test surface. */
const exercise = (page: Page) =>
  page.evaluate(() => (window.botgineer as unknown as { exercise: () => { skill: string; answer: string; at: number } | null }).exercise())

const idle = (page: Page) => expect.poll(() => page.evaluate(() => window.botgineer.state().busy)).toBe(false)

/** Passes the praise for the last answer, as a player pressing Next would:
 *  the next exercise starts (its setup runs) only once that is read. */
async function pastPraise(page: Page) {
  if (!(await exercise(page))) return
  await expect(page.getByTestId('guide')).toHaveAttribute('data-kind', 'praise')
  await page.evaluate(() => window.botgineer.next())
  await expect(page.getByTestId('guide')).not.toHaveAttribute('data-kind', 'praise')
  await idle(page)
}

/** Answers every exercise with the line its generator says works, and
 *  returns which skills were asked. The judge sees what *real Python* made
 *  of that line — so a session that finishes is the Python subset agreeing
 *  with CPython on every question it generated. */
async function playSession(page: Page): Promise<string[]> {
  const asked: string[] = []
  for (let i = 0; i < 8; i++) {
    await idle(page)
    const ex = await exercise(page)
    if (!ex) break
    asked.push(ex.skill)
    await say(page, ex.answer)
    // A right answer moves on to the next exercise, whose first beat is
    // the praise for this one.
    await expect.poll(async () => (await exercise(page))?.at ?? 99).toBeGreaterThan(ex.at)
    await pastPraise(page)
  }
  return asked
}

for (const unit of ['thinking', 'remembering']) {
  test(`a ${unit} practice session asks generated questions, and real Python agrees with every answer`, async ({
    page,
  }) => {
    // Three sessions, so a spread of generators and seeds meets CPython.
    for (let round = 0; round < 3; round++) {
      await open(page, `practice-${unit}`)
      const asked = await playSession(page)
      expect(asked).toHaveLength(5)
      // The last praise is read first; the tally is the line it rests on.
      await expect(page.getByTestId('guide')).toHaveAttribute('data-kind', 'praise')
      await skip(page)
      await expect(page.getByTestId('guide')).toContainText('5 of 5 right first time')
      await expect(page.getByTestId('advance')).toBeVisible()
      // Thinking ends on the shelf, every right answer beside its type.
      if (unit === 'thinking') await expect(page.getByTestId('prop')).toHaveAttribute('data-prop', 'shelf')
      await page.goto('./#/map')
    }
  })
}

test('every question says who does the work, and praise waits for Next', async ({ page }) => {
  await open(page, 'practice-thinking')
  await idle(page)
  // The session opens on narration: the console is closed until the ask.
  const first = await beat(page)
  expect(first.listening).toBe(true)
  expect(first.at).toBe(0)
  await skip(page)
  const tag = page.getByTestId('ask-tag')
  await expect(tag).toBeVisible()
  await expect(tag).toHaveText(/You answer|Robot works it out/)

  const ex = (await exercise(page))!
  await say(page, ex.answer)
  await expect.poll(async () => (await exercise(page))?.at).toBe(ex.at + 1)
  // The praise is a beat of its own, and nothing moves on by itself.
  const praise = page.getByTestId('guide')
  await expect(praise).toHaveAttribute('data-kind', 'praise')
  await page.waitForTimeout(4000)
  await expect(praise).toHaveAttribute('data-kind', 'praise')
  expect((await beat(page)).listening).toBe(true)
  // Next (once the line has typed) moves on to the next exercise's lines.
  await page.getByTestId('beat-next').click()
  await expect(praise).not.toHaveAttribute('data-kind', 'praise')
})

test('a wrong answer says why, keeps the question on screen, and counts against mastery', async ({ page }) => {
  await open(page, 'practice-thinking')
  await idle(page)
  const ex = (await exercise(page))!
  // Every thinking exercise is about a picture, like the lessons, and the
  // question stays under it while the crow talks about the answer. A
  // failed line counts as an attempt.
  await say(page, 'undefined_name')
  await expect(page.getByTestId('guide')).toHaveAttribute('data-kind', 'reply')
  await expect(page.getByTestId('prop')).toBeVisible()
  await expect(page.getByTestId('prop-ask')).toBeVisible()
  await expect(page.getByTestId('prop')).toHaveAttribute('data-verdict', 'miss')

  await say(page, 'undefined_name')
  // Two misses and the crow shows a way.
  await expect(page.getByTestId('guide')).toContainText('One way:')
  await say(page, ex.answer)
  await expect(page.locator('.practice-seg').first()).toHaveClass(/recovered/)

  const record = await page.evaluate(
    (skill) => JSON.parse(localStorage.getItem('botgineer.mastery.v1') ?? '{}')[skill],
    ex.skill,
  )
  expect(record.tries).toBe(1)
  expect(record.right).toBe(0)
})

test('a char question names the whole word as the mistake', async ({ page }) => {
  // Sessions are weighted towards weak skills, and every skill starts
  // weak, so a char question turns up within a few sessions.
  for (let round = 0; round < 12; round++) {
    await page.goto('./#/map')
    await expect(page.getByTestId('map')).toBeVisible()
    await open(page, 'practice-thinking')
    for (let i = 0; i < 5; i++) {
      await idle(page)
      const ex = await exercise(page)
      if (!ex) break
      if (ex.skill !== 'char') {
        await say(page, ex.answer)
        await expect.poll(async () => (await exercise(page))?.at ?? 99).toBeGreaterThan(ex.at)
        await pastPraise(page)
        continue
      }
      const say_ = await page.evaluate(() => (window.botgineer as unknown as { exercise: () => { say: string } }).exercise().say)
      const word = say_.match(/word (\w+)|(\w+)’s name/)!.slice(1).find(Boolean)!
      await say(page, `"${word}"`)
      await expect(page.getByTestId('guide')).toContainText('whole word')
      // Drawn: the answer's tiles say how many characters it made.
      await expect(page.getByTestId('prop')).toContainText(`${word.length} characters`)
      await say(page, word[0]!)
      await expect(page.getByTestId('guide')).toContainText('quotes')
      await say(page, ex.answer)
      await expect.poll(async () => (await exercise(page))?.at ?? 99).toBeGreaterThan(ex.at)
      await expect(page.getByTestId('guide')).toContainText('length one')
      return
    }
  }
  throw new Error('twelve sessions without a char question')
})

test('an exercise with setup starts from it, shown as given', async ({ page }) => {
  // Remembering's exercises mostly begin with names already in memory.
  for (let round = 0; round < 6; round++) {
    // Through the map, so each round is a new session: going to the same
    // hash again is not a navigation, and would keep the old one.
    await page.goto('./#/map')
    await expect(page.getByTestId('map')).toBeVisible()
    await open(page, 'practice-remembering')
    await idle(page)
    const ex = (await exercise(page))!
    if (ex.skill === 'bind') continue
    await expect(page.getByTestId('given').first()).toBeVisible()
    expect(await page.evaluate(() => window.botgineer.snapshot().bindings.length)).toBeGreaterThan(0)
    return
  }
  throw new Error('six sessions in a row opened on an exercise with no setup')
})

test('the skills screen shows what practice recorded', async ({ page }) => {
  await open(page, 'practice-thinking')
  await playSession(page)
  await page.getByTestId('advance').click()
  await page.getByTestId('nav-skills').click()
  await expect(page.getByTestId('skills')).toBeVisible()
  // Every skill that was asked shows a first-time tally.
  await expect(page.locator('.skill-stats').first()).toContainText('first time')
  await expect(page.getByTestId('skill-bind')).toContainText('Not introduced yet')
})
