/**
 * Five data types (`types`), played end to end: each type shown on the
 * stage, named onto the shelf, then used once. The likely misses are
 * drawn into the picture that asked (a note on the lamp, a lift stuck
 * between floors, a second glass filled to the wrong level) and named.
 * Mira waits off stage until her beat, and the shelf at the close holds
 * the right answers only.
 */
import { expect, test, type Page } from '@playwright/test'
import { beat, open, say, skip } from './helpers'

const prop = (page: Page) => page.getByTestId('prop')

/** Next until the line says `text`, the way a player reads through. */
async function readTo(page: Page, text: string) {
  for (let i = 0; i < 20; i++) {
    const b = await beat(page)
    if (b.text.includes(text)) return b
    if (!b.listening) break
    await page.evaluate(() => window.botgineer.next())
  }
  throw new Error(`never reached a line with: ${text}`)
}

test('five data types, each shown, named and used, with the misses drawn', async ({ page }) => {
  await open(page, 'types')
  // The robot's problem, over an empty shelf; Mira is not here yet.
  expect((await beat(page)).text).toMatch(/doesn't think of everything the same way/)
  await expect(prop(page)).toHaveAttribute('data-prop', 'shelf')
  await expect(page.getByTestId('actor-courier')).toHaveAttribute('data-offstage', 'yes')

  // bool: the switch flips on and off in the narration, then is named.
  await readTo(page, 'yes as `True`')
  await expect(prop(page)).toHaveAttribute('aria-label', /lamp/)
  await readTo(page, 'called `bool`')
  await expect(prop(page)).toHaveAttribute('aria-label', /bool: True, False/)

  // Misses at the lamp: a lower-case word, and a word in quotes stuck on.
  await say(page, 'true')
  await expect(page.getByTestId('guide')).toContainText('capital letter')
  await say(page, '"True"')
  await expect(prop(page)).toHaveAttribute('aria-label', /dark, with a note on it that says True/)
  await expect(page.getByTestId('guide')).toContainText('Quotes make that a word')
  await say(page, 'True')
  expect(await beat(page)).toMatchObject({ kind: 'praise' })
  await expect(page.getByTestId('guide')).toContainText("because True is the robot's yes")

  // int: counted in whole steps; then below zero.
  await readTo(page, 'how many')
  await expect(prop(page)).toHaveAttribute('aria-label', /Counted in one at a time: 3/)
  await readTo(page, 'below zero')
  await expect(prop(page)).toHaveAttribute('aria-label', /lift goes to floor -1/)
  // The ask puts the lift back: the stage does not answer its question.
  await page.evaluate(() => window.botgineer.next())
  expect(await beat(page)).toMatchObject({ kind: 'ask' })
  await expect(prop(page)).not.toHaveAttribute('aria-label', /goes to floor -1/)
  // A whole floor with a dot is parked on its floor, and the reply says
  // the dot is the trouble, not that the lift is stuck.
  await say(page, '-1.0')
  await expect(prop(page)).toHaveAttribute('aria-label', /lift is at floor -1\./)
  await expect(page.getByTestId('guide')).toContainText("has a dot, so it's measured")
  await say(page, '1.5')
  await expect(prop(page)).toHaveAttribute('aria-label', /stuck between floors at 1.5/)
  await expect(page.getByTestId('guide')).toContainText('Stuck between floors')
  await say(page, '1')
  await expect(prop(page)).toHaveAttribute('aria-label', /lift is at floor 1\./)
  await expect(page.getByTestId('guide')).toContainText('one floor up')
  await say(page, '-1')
  await expect(page.getByTestId('guide')).toContainText('so an int')

  // float: a glass filling, a number line, a dot.
  await readTo(page, 'measure')
  await expect(prop(page)).toHaveAttribute('aria-label', /filling smoothly/)
  await readTo(page, 'between the whole numbers')
  await expect(prop(page)).toHaveAttribute('aria-label', /number line from 0 to 1\. A marker stops at a point between the ticks/)
  await say(page, '0')
  await expect(prop(page)).toHaveAttribute('aria-label', /other glass is filled to 0\./)
  await expect(page.getByTestId('guide')).toContainText("There's water in it")
  await say(page, '0,5')
  await expect(page.getByTestId('guide')).toContainText('dot, not a comma')
  await say(page, '0.5')
  await expect(page.getByTestId('guide')).toContainText('measured, so a float')

  // char: Mira arrives on her beat, and speaks.
  await page.evaluate(() => window.botgineer.next())
  const mira = await readTo(page, 'Here')
  expect(mira.text).toMatch(/Mira/)
  await expect(page.getByTestId('actor-courier')).toHaveAttribute('data-offstage', 'no')
  await page.evaluate(() => window.botgineer.next())
  expect(await beat(page)).toMatchObject({ speaker: 'courier' })
  await expect(page.getByTestId('guide')).toHaveAttribute('data-speaker', 'courier')
  await readTo(page, '`"7"` is a thing to read')
  await expect(prop(page)).toHaveAttribute('aria-label', /Side by side: 7, int; and "7", str · length 1/)
  await readTo(page, 'no char type')
  await expect(page.getByTestId('thought')).toHaveText("'A'")

  await say(page, 'M')
  await expect(page.getByTestId('guide')).toContainText('Quotes make it a character')
  await say(page, '"Mira"')
  await expect(prop(page)).toHaveAttribute('aria-label', /card for Mira that says: Mira/)
  await expect(page.getByTestId('guide')).toContainText('more than one letter')
  await say(page, '"M"')
  await expect(page.getByTestId('guide')).toContainText('which Python keeps as a str')

  // str: beads on a thread, the quotes where it starts and stops.
  await readTo(page, 'in a row')
  await expect(prop(page)).toHaveAttribute('aria-label', /characters of hello as beads on a thread/)
  await say(page, 'hello')
  await expect(page.getByTestId('guide')).toContainText('Words go inside quotes')
  await say(page, '"Hello, Mira!"')
  await expect(page.getByTestId('guide')).toContainText("because it's words in quotes")
  await skip(page) // Continue waits for the closing lines
  await expect(page.getByTestId('advance')).toBeVisible()

  // The close: the full shelf, holding what was said right and no miss.
  await page.evaluate(() => window.botgineer.next())
  expect((await beat(page)).kind).toBe('outro')
  const shelf = await prop(page).getAttribute('aria-label')
  expect(shelf).toMatch(/^A shelf of five slots/)
  // Each slot exactly: the examples, and what was said right filed in
  // (an example said is drawn filled, not twice). No 1.5, 1, "True", 0.
  for (const slot of ['bool: True, False;', 'int: 3, 12, -1;', 'float: 0.5, 1.4;', 'char: "A", "M";', 'str: "hello", "Mira", "Hello, Mira!".']) {
    expect(shelf).toContain(slot)
  }
  await page.evaluate(() => window.botgineer.next())
  await expect(page.getByTestId('takeaway')).toContainText('bool, int, float, char and str')
  // Memory stayed empty the whole way: nothing had a name.
  await expect(page.getByTestId('memory')).toContainText('Memory is empty')
})

/**
 * The demonstrations told across several beats of one picture: the lamp
 * flipped on and then off, the half apple, the dot written in on the
 * number line, the clasps lit, and the shelf's title and ghost list. Each
 * is a narration field on a picture the beat before already shows, so it
 * plays on the element that is standing (`staging` keeps its key).
 */
test('narration on the same picture reaches the stage', async ({ page }) => {
  await open(page, 'types')
  await readTo(page, 'data type')
  await expect(prop(page)).toHaveAttribute('aria-label', /labelled Data types/)
  await readTo(page, 'yes as `True`')
  await expect(page.locator('[data-testid="prop"] .lamp')).toHaveClass(/on/)
  await readTo(page, 'no as `False`')
  await expect(prop(page)).toHaveAttribute('aria-label', /the switch says False/)
  await say(page, 'True')
  await readTo(page, 'whole steps')
  await expect(prop(page)).toHaveAttribute('aria-label', /Half an apple bounces off/)
  await say(page, '-1')
  await readTo(page, 'with a dot: `0.5`')
  await expect(prop(page)).toHaveAttribute('aria-label', /A marker stops at 0.5/)
  await say(page, '0.5')
  await say(page, '"M"')
  await readTo(page, 'starts and where it stops')
  await expect(prop(page)).toHaveAttribute('aria-label', /glowing/)
  await say(page, '"hello"')
  await page.evaluate(() => window.botgineer.next())
  await page.evaluate(() => window.botgineer.next())
  await expect(prop(page)).toHaveAttribute('aria-label', /for later/)
})
