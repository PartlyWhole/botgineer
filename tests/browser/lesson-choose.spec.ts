/**
 * Choose the type (`choose`), played end to end: twelve questions with
 * no hint about the type, each likely miss drawn into its picture and
 * named (Mira answering her own), the praise giving the reason, and the
 * shelf at the close holding only the right answers.
 */
import { expect, test, type Page } from '@playwright/test'
import { beat, open, say } from './helpers'

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
  await expect(prop(page)).toHaveAttribute('aria-label', /6 eggs in it/)
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
  await right(page, 'True', /The robot's yes is True/)

  // 12. Tell Mira: the robot's yes leaves her note blank.
  await say(page, 'True')
  await expect(guide(page)).toContainText('robot for yes')
  await right(page, '"Yes, it is locked."', /Mira reads words, so a str/)
  await expect(page.getByTestId('advance')).toBeVisible()

  // The close: the shelf, holding what was said right and no miss.
  await page.evaluate(() => window.botgineer.next())
  expect((await beat(page)).kind).toBe('outro')
  const shelf = await prop(page).getAttribute('aria-label')
  for (const slot of ['bool: True, False;', 'int: 3, 12, -1, 6;', 'float: 0.5, 1.4, 0.25, 1.5;', 'char: "A", "M";']) {
    expect(shelf).toContain(slot)
  }
  for (const missed of ['6.0', '140', '412555019', '1.3', '"no"']) expect(shelf).not.toContain(missed)
  await page.evaluate(() => window.botgineer.next())
  await page.evaluate(() => window.botgineer.next())
  await expect(guide(page)).toContainText('works things out for itself')
  await expect(page.getByTestId('takeaway')).toContainText('the question you are answering decides')
})
