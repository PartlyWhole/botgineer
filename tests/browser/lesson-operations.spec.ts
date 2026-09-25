/**
 * Working things out (`operations`), played against real CPython: Mira's
 * sum, the rule that the robot does the working, every operation drawn
 * with the type that comes back, and none of the answers kept.
 */
import { expect, test, type Page } from '@playwright/test'
import { beat, open, reprs, say, skip } from './helpers'

/** Lines that answer this level right, in order. */
const RIGHT = [
  '7 * 6',
  '20 - 7',
  '9 / 2',
  '8 / 2',
  '2 + 0.5',
  '3 > 5',
  '7 * 6 == 42',
  '"bot" + "gineer"',
  '"ha" * 5',
  'ord("M")',
  'True + True + True',
  '2 + 3 * 4',
  '(2 + 3) * 4',
]

const next = (page: Page) => page.evaluate(() => window.botgineer.next())

test('Mira brings a sum the robot cannot know, and the rule comes before the question', async ({ page }) => {
  await open(page, 'operations')
  // She arrives on the first beat and says the problem herself.
  await expect(page.getByTestId('guide')).toHaveAttribute('data-speaker', 'courier')
  await expect(page.getByTestId('actor-courier')).toHaveAttribute('data-offstage', 'no')
  expect((await beat(page)).listening).toBe(true)

  // Walk the beats as a player would, noting what was said.
  const told: string[] = []
  let thoughtQ = false
  for (let i = 0; i < 12 && !(await beat(page)).asking; i++) {
    told.push((await beat(page)).text)
    const cloud = page.getByTestId('thought')
    if ((await cloud.count()) > 0 && (await cloud.first().textContent()) === '?') thoughtQ = true
    await next(page)
  }
  expect(told.some((t) => /give the robot the sum/i.test(t))).toBe(true)
  expect(told.some((t) => t.includes('7 * 6'))).toBe(true)
  expect(thoughtQ).toBe(true)

  const ask = await beat(page)
  expect(ask.text).toBe('How many bolts are in the crates?')
  await expect(page.getByTestId('ask-tag')).toContainText('Robot works it out')
  await expect(page.getByTestId('prop')).toHaveAttribute('data-prop', 'crates')
})

test('the robot works out every operation, drawn, and keeps none of them', async ({ page }) => {
  await open(page, 'operations')

  // Typing the answer is not asking the robot.
  await say(page, '42')
  await expect(page.getByTestId('guide')).toContainText('you worked it out')
  await say(page, RIGHT[0]!)
  await expect(page.getByTestId('thought')).toHaveText('42')
  await expect(page.getByTestId('answer-tag')).toContainText('int')

  await say(page, RIGHT[1]!)
  // Whole litres only leave one in the jug — in the picture, too — and
  // the reply names `//` as a sign of its own.
  await say(page, '9 // 2')
  await expect(page.getByTestId('guide')).toContainText('is a different sign')
  await expect(page.getByTestId('prop')).toHaveAttribute('aria-label', /Each tank gets 4\./)
  await say(page, RIGHT[2]!)
  await say(page, RIGHT[3]!)
  await expect(page.getByTestId('thought')).toHaveText('4.0')

  // A comma is not a point: real Python makes a pair of it.
  await say(page, '2 + 0,5')
  await expect(page.getByTestId('guide')).toContainText('dot')
  await say(page, RIGHT[4]!)
  await expect(page.getByTestId('thought')).toHaveText('2.5')

  // One equals sign is not a question, and real Python says so.
  await say(page, RIGHT[5]!)
  // `==` on the balance: it levels, and its lamp lights True as it is said.
  for (let i = 0; i < 6 && !(await beat(page)).text.includes('balance levels'); i++) await next(page)
  expect((await beat(page)).text).toContain('balance levels')
  await expect(page.getByTestId('prop')).toHaveAttribute('data-prop', 'balance')
  await expect(page.locator('.verdict-lamp.on')).toBeVisible()
  await expect(page.getByTestId('thought')).toHaveText('True')
  await say(page, '7 * 6 = 42')
  await expect(page.getByTestId('console-error').last()).toContainText('SyntaxError')
  await expect(page.getByTestId('guide')).toContainText('give it a name')
  await say(page, RIGHT[6]!)

  await say(page, RIGHT[7]!)
  await expect(page.getByTestId('thought')).toHaveText("'botgineer'")
  await say(page, RIGHT[8]!)
  await expect(page.getByTestId('thought')).toHaveText("'hahahahaha'")

  // `ord` takes one character; Python refuses a word.
  await say(page, 'ord("Mira")')
  await expect(page.getByTestId('console-error').last()).toContainText('TypeError')
  await expect(page.getByTestId('guide')).toContainText('one character')
  await say(page, RIGHT[9]!)
  await expect(page.getByTestId('thought')).toHaveText('77')

  await say(page, RIGHT[10]!)
  await expect(page.getByTestId('thought')).toHaveText('3')
  // Three Trues answered show their working to 3, not two lamps.
  await expect(page.getByTestId('prop')).toHaveAttribute('data-prop', 'expr')
  await expect(page.locator('[data-testid="prop"] .expr.shown')).toBeVisible()

  await say(page, RIGHT[11]!)
  await expect(page.getByTestId('thought')).toHaveText('14')
  await say(page, RIGHT[12]!)
  await expect(page.getByTestId('thought')).toHaveText('20')

  await skip(page)
  await expect(page.getByTestId('guide')).toContainText('help it remember')
  await expect(page.getByTestId('takeaway')).toContainText('Its type depends on the operation')
  // It forgot twenty: the cloud is empty.
  await expect(page.getByTestId('thought')).toHaveCount(0)
  expect(await reprs(page)).toEqual([])
  await expect(page.getByTestId('advance')).toBeVisible()
})
