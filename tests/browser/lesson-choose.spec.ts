/**
 * Choose the type (`choose`), played end to end: twelve questions with
 * no hint about the type, each likely miss drawn into its picture and
 * named (Mira answering her own), the praise giving the reason, and the
 * shelf at the close holding only the right answers.
 */
import { expect, test, type Page } from '@playwright/test'
import { beat, open, say, skip } from './helpers'

const prop = (page: Page) => page.getByTestId('prop')
const guide = (page: Page) => page.getByTestId('guide')

/** A right answer: praised, with its reason. */
async function right(page: Page, line: string, reason: RegExp) {
  await say(page, line)
  expect(await beat(page)).toMatchObject({ kind: 'praise' })
  await expect(guide(page)).toContainText(reason)
}

test('twelve questions, each miss drawn and named, each praise giving the reason', async ({ page }) => {
  await open(page, 'choose')
  // Mira is here from the start, and the shelf is the reference.
  await expect(page.getByTestId('actor-courier')).toHaveAttribute('data-offstage', 'no')
  expect((await beat(page)).text).toMatch(/Now you choose/)
  await expect(prop(page)).toHaveAttribute('data-prop', 'shelf')

  // 1. Is a fish a bird? A word is a note stuck on the fish.
  await say(page, '"no"')
  await expect(prop(page)).toHaveAttribute('aria-label', /note stuck on it that says no\. Nothing happens/)
  await expect(guide(page)).toContainText('note on the fish')
  await say(page, 'True')
  await expect(prop(page)).toHaveAttribute('aria-label', /wings drawn on/)
  await right(page, 'False', /Yes or no, so a bool/)

  // 2. Eggs: a dot means measured.
  await say(page, '6.0')
  await expect(prop(page)).toHaveAttribute('aria-label', /6 eggs in it\. But the robot's 6\.0 is not the answer yet/)
  // A full box is what the right answer draws, so the refused one is
  // drawn in amber: the eggs outlined, not laid.
  await expect(prop(page)).toHaveAttribute('data-refused', 'yes')
  await expect(prop(page).locator('.carton')).toHaveClass(/refused/)
  await expect(guide(page)).toContainText('The dot means measured')
  await right(page, '6', /Counted, so an int/)

  // 3. A quarter-full glass that is not empty.
  await say(page, '0')
  await expect(prop(page)).toHaveAttribute('aria-label', /other glass is filled to 0\./)
  await expect(guide(page)).toContainText("There's water in it")
  await right(page, '0.25', /Measured, so a float/)

  // 4. Mira's sign: her name without quotes stops the robot.
  await say(page, 'Mira')
  await expect(guide(page)).toContainText('Words go inside quotes')
  await right(page, '"Mira"', /Words for people, so a str/)

  // 5. The car park: 1 sends the lift up.
  await say(page, '1')
  await expect(prop(page)).toHaveAttribute('aria-label', /lift is at floor 1\./)
  await expect(guide(page)).toContainText('up')
  await right(page, '-1', /below zero too, so an int/)

  // 6. Mira asks, and answers the miss herself.
  await say(page, '"Mira"')
  expect(await beat(page)).toMatchObject({ kind: 'reply', speaker: 'courier' })
  await expect(prop(page)).toHaveAttribute('aria-label', /card for Mira that says: Mira/)
  await expect(guide(page)).toContainText('whole name')
  await right(page, '"M"', /One letter, so a char, which Python keeps as a str/)

  // 7. Height, in centimetres.
  await say(page, '140')
  await expect(prop(page)).toHaveAttribute('aria-label', /140 metres tall/)
  await expect(guide(page)).toContainText('centimetres')
  await right(page, '1.4', /measured, so a float/)

  // 8. Breakfast, told to a person instead.
  await say(page, '"yes"')
  await expect(guide(page)).toContainText('Tell the robot')
  await right(page, 'True', /yes-or-no, so a bool/)

  // 9. Mira's phone number, as a number, loses its zero.
  await say(page, '412555019')
  await expect(prop(page)).toHaveAttribute('aria-label', /phone showing 412555019/)
  await expect(guide(page)).toContainText('fell off')
  await right(page, '"0412 555 019"', /Nobody adds up phone numbers/)

  // 10. The match: a dot is not a clock.
  await say(page, '1.3')
  await expect(prop(page)).toHaveAttribute('aria-label', /bar reaches 1.3 hours/)
  await expect(guide(page)).toContainText('a dot is not a clock')
  await right(page, '1.5', /Between one hour and two, so a float/)

  // 11. Tell the robot: Mira's word sits on the light as a note.
  await say(page, '"yes"')
  await expect(prop(page)).toHaveAttribute('aria-label', /dark, with a note on it that says yes/)
  await expect(guide(page)).toContainText("That's Mira's word")
  await right(page, 'True', /A yes for the robot, so a bool/)

  // 12. Tell Mira: the robot's yes leaves her note blank.
  await say(page, 'True')
  await expect(guide(page)).toContainText('robot for yes')
  // A no in words is the type right and the answer wrong: it is locked.
  await say(page, '"It is not locked"')
  expect(await beat(page)).toMatchObject({ kind: 'reply' })
  await expect(prop(page)).toHaveAttribute('aria-label', /note for Mira says: It is not locked/)
  await expect(guide(page)).toContainText('It is locked, I checked')
  await right(page, '"Yeah it is"', /Mira reads words, so a str/)
  await skip(page) // Continue waits for the closing lines
  await expect(page.getByTestId('advance')).toBeVisible()

  // The close: the shelf, holding what was said right and no miss.
  await page.evaluate(() => window.botgineer.next())
  expect((await beat(page)).kind).toBe('outro')
  // No stock examples: every chip on it is one the player said, right.
  // A long str wraps over two lines of its chip, broken at its space,
  // rather than being cut short (`"0412 5…` once): each chip, its lines
  // read in order, is what was said, whole.
  const chips = await page
    .locator('[data-testid="prop"] .heard')
    .evaluateAll((els) => els.map((el) => [...el.querySelectorAll('text')].map((t) => t.textContent).join(' ')))
  const said = ['False', 'True', '6', '-1', '0.25', '1.4', '1.5', '"M"', '"Mira"', '"0412 555 019"', '"Yeah it is"']
  expect(chips).toHaveLength(said.length)
  for (const text of said) expect(chips).toContain(text)
  await expect(page.locator('[data-testid="prop"] .example')).toHaveCount(0)
  await page.evaluate(() => window.botgineer.next())
  await page.evaluate(() => window.botgineer.next())
  await expect(guide(page)).toContainText('works things out for itself')
  await expect(page.getByTestId('takeaway')).toContainText('the question you are answering decides')
})
