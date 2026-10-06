/**
 * A lesson, shared (`src/collab/`, `Workbench`'s shared lesson): a learner
 * plays alone, shares, and a helper joins and catches up; from then on
 * either can answer, and both are told the same thing. Two pages of one
 * browser on `tabs` only: no network.
 *
 * The helper opens the link with no `?seed=`, so the questions it is asked
 * can only be the learner's if the room carried the seed.
 */
import { expect, test, type Page } from '@playwright/test'
import { bindLesson } from '../../content/lessons/v2/bind'
import { ifLesson } from '../../content/lessons/v2/ifs'
import { beat, say } from './helpers'

async function open(page: Page, hash: string, seed?: number) {
  await page.goto(`./?transports=tabs${seed ? `&seed=${seed}` : ''}${hash}`)
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
}

async function share(learner: Page): Promise<Page> {
  await learner.evaluate(() => window.botgineer.skip())
  await learner.getByTestId('room-share').click()
  await expect(learner.getByTestId('room-bar')).toHaveAttribute('data-room', 'live')
  const link = await learner.evaluate(() => window.location.hash)
  const helper = await learner.context().newPage()
  await open(helper, link)
  await expect(helper.getByTestId('room-bar')).toHaveAttribute('data-room', 'live')
  await expect(learner.getByTestId('room-bar')).toHaveAttribute('data-peers', '2')
  return helper
}

const names = (page: Page) => page.evaluate(() => window.botgineer.snapshot().bindings.map((b) => b.name).sort())
const told = async (page: Page) => (await beat(page)).text

test('a console lesson: the helper catches up, then both answer in turn', { tag: '@smoke' }, async ({ page: learner }) => {
  test.setTimeout(180_000)
  const SEED = 4
  await open(learner, '#/v2-bind', SEED)
  const lesson = bindLesson(SEED)
  let helper: Page | null = null
  for (const [i, step] of lesson.steps.entries()) {
    // Three steps alone, then shared; after that, turn about.
    if (i === 3) {
      helper = await share(learner)
      // Caught up: the same step, the same line, the same memory.
      await expect.poll(() => told(helper!)).toBe(await told(learner))
      expect(await names(helper)).toEqual(await names(learner))
    }
    const by = helper && i % 2 === 0 ? helper : learner
    if (step.choices) {
      await by.evaluate(() => window.botgineer.skip())
      await by.getByTestId(`choice-${step.choices.answer}`).click()
    } else {
      if ((step.beats ?? []).some((b) => b.wipe)) {
        await by.evaluate(() => window.botgineer.skip())
        await expect.poll(() => names(by)).toEqual([])
      }
      if (i === lesson.steps.length - 1) {
        await by.evaluate(() => window.botgineer.skip())
        await by.getByTestId('memory-reset').click()
        await expect.poll(() => names(by)).toEqual([])
      }
      for (const line of step.model!.split('\n')) await say(by, line)
    }
    for (const p of helper ? [learner, helper] : [learner])
      await expect.poll(async () => (await beat(p)).kind, { message: `step ${i}: ${step.say}` }).toMatch(/praise|outro/)
    // In lockstep: the same log applied, the same lines kept.
    if (helper) {
      const state = (p: Page) => p.evaluate(() => window.botgineer.state())
      await expect.poll(async () => (await state(helper!)).log).toBe((await state(learner)).log)
      expect((await state(helper)).history).toEqual((await state(learner)).history)
    }
  }
  // Both finished, with the same memory: only `total`.
  expect(await names(learner)).toEqual(['total'])
  expect(await names(helper!)).toEqual(['total'])
  await learner.evaluate(() => window.botgineer.skip())
  await expect(learner.getByTestId('takeaway')).toBeVisible()
  await expect(helper!.getByTestId('takeaway')).toBeVisible()
})

test('an editor lesson: one shared program, run by either, judged for both', async ({ page: learner }) => {
  test.setTimeout(180_000)
  const SEED = 3
  await open(learner, '#/v2-if', SEED)
  const helper = await share(learner)
  const lesson = ifLesson(SEED)
  for (const [i, step] of lesson.steps.slice(0, 4).entries()) {
    const by = i % 2 === 0 ? helper : learner
    if (step.choices) {
      await by.evaluate(() => window.botgineer.skip())
      await by.getByTestId(`choice-${step.choices.answer}`).click()
    } else {
      await by.evaluate((p) => window.botgineer.send(p), step.model!)
      // The text is the room's: the other page holds the program that ran.
      const other = by === helper ? learner : helper
      await expect.poll(() => other.evaluate(() => window.botgineer.getProgram())).toBe(step.model!)
    }
    for (const p of [learner, helper])
      await expect.poll(async () => (await beat(p)).kind, { message: `step ${i}: ${step.say}` }).toMatch(/praise|outro/)
  }
  // Next on one page is Next on both.
  const at = (await beat(learner)).at
  await helper.evaluate(() => window.botgineer.next())
  await expect.poll(async () => (await beat(learner)).at).toBe(at + 1)
})

test('two answers at once: the log settles on one order, and both replay it', async ({ page: learner }) => {
  test.setTimeout(120_000)
  await open(learner, '#/v2-bind', 4)
  const helper = await share(learner)
  await helper.evaluate(() => window.botgineer.skip())
  // Both type at the same moment, each applying its own line first.
  await Promise.all([learner.evaluate(() => window.botgineer.say('p = 1')), helper.evaluate(() => window.botgineer.say('q = 2'))])
  const state = (p: Page) => p.evaluate(() => window.botgineer.state())
  await expect.poll(async () => (await state(learner)).pending + (await state(helper)).pending).toBe(0)
  await expect.poll(async () => (await state(helper)).history).toEqual((await state(learner)).history)
  expect((await state(learner)).history.sort()).toEqual(['p = 1', 'q = 2'])
})
