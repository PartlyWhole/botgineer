/**
 * Reading Python, played in the production build.
 *
 * The Node sweep (`tests/semantics`) proves the key and the interpreter
 * agree on every item. These prove the page plays them: commit before
 * run, the key and its error type, "go back to" landing on the exercise,
 * a checkpoint that sends you to review and then lets you through, the
 * glossary, and the switch to formal words at Stage 6.
 *
 * Answers go in through `window.botgineer.read`, the same way the editor
 * journeys use `setProgram` rather than typing into a contenteditable —
 * except where the widget itself is the thing under test.
 */
import { expect, test, type Page } from '@playwright/test'

type Answer = Record<string, unknown> & { kind: string }

const api = (page: Page) => ({
  state: () => page.evaluate(() => (window as any).botgineer.read.state()),
  models: () => page.evaluate(() => (window as any).botgineer.read.models() as Answer[] | null),
  answer: (i: number, a: Answer) => page.evaluate(([i, a]) => (window as any).botgineer.read.answer(i, a), [i, a] as const),
  submit: (i: number, src: string) => page.evaluate(([i, s]) => (window as any).botgineer.read.submit(i, s), [i, src] as const),
  program: (i: number) => page.evaluate((i) => (window as any).botgineer.read.program(i) as string | null, i),
})

async function open(page: Page, level: string) {
  await page.goto(`./#/${level}`)
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
}

/** Seeds finished levels before the page loads. */
async function seedProgress(page: Page, ids: string[]) {
  await page.addInitScript((done) => localStorage.setItem('botgineer.progress.v1', JSON.stringify(done)), ids)
}

/** The item has been run quietly, so its answers (and pictures) exist. */
async function prepared(page: Page) {
  await expect.poll(() => api(page).models(), { timeout: 30_000 }).not.toBeNull()
}

/** A plausible wrong answer of the same kind. */
function wrongOf(a: Answer): Answer {
  switch (a.kind) {
    case 'output':
      return { ...a, text: 'this is not what it prints' }
    case 'choice':
      return { kind: 'choice', picked: [((a.picked as number[])[0]! + 1) % 2] }
    case 'number':
      return { kind: 'number', value: (a.value as number) + 100 }
    case 'line':
      return { kind: 'line', line: (a.line as number) === 1 ? 2 : 1 }
    case 'order':
      return { kind: 'order', lines: [...(a.lines as number[])].reverse() }
    case 'diagram':
      return { kind: 'diagram', picked: (a.picked as number) === 0 ? 1 : 0 }
    default:
      return a
  }
}

/**
 * Plays the item on screen with the key's answers — except the parts
 * listed in `wrong` — commits, marks rules, repairs, and moves on.
 */
async function play(page: Page, opts: { wrong?: boolean; next?: boolean } = {}) {
  await prepared(page)
  const models = (await api(page).models())!
  let spoiled = false
  for (const [i, m] of models.entries()) {
    if (!m || m.kind === 'rule') continue
    const give = opts.wrong && !spoiled && m.kind !== 'labels' && m.kind !== 'block' && m.kind !== 'table' ? wrongOf(m) : m
    if (give !== m) spoiled = true
    await api(page).answer(i, give)
  }
  // Rules are written before the commit and marked after it.
  for (const [i, m] of models.entries()) if (m?.kind === 'rule') await api(page).answer(i, { kind: 'rule', text: 'my rule', mark: null })
  await page.getByTestId('commit').click()
  await expect(page.getByTestId('key-card')).toBeVisible()
  for (const [i, m] of models.entries()) {
    if (m?.kind !== 'rule') continue
    await page.getByTestId(`part-${i}`).getByTestId(opts.wrong && !spoiled ? 'mark-missed' : 'mark-right').click()
    if (opts.wrong) spoiled = true
  }
  for (const [i, m] of models.entries()) {
    if (m !== null) continue
    const program = await api(page).program(i)
    if (program) await api(page).submit(i, program)
  }
  await expect(page.getByTestId('next-item')).toBeVisible({ timeout: 30_000 })
  if (opts.next !== false) await page.getByTestId('next-item').click()
}

/* ------------------------------------------------------------------------- */

test('nothing runs until the prediction is committed', async ({ page }) => {
  await open(page, 'x-1.2')
  await prepared(page)
  // Memory is empty, there is nothing to scrub, and nothing has printed —
  // the robot has run the snippet quietly to prepare, and shown none of it.
  await expect(page.getByTestId('memory')).toHaveClass(/empty/)
  await expect(page.getByTestId('scrubber')).toHaveCount(0)
  await expect(page.getByTestId('key-card')).toHaveCount(0)
  await expect(page.getByTestId('commit')).toBeDisabled()

  await page.getByTestId('output-0').fill('9 4')
  await page.getByTestId('commit').click()

  await expect(page.getByTestId('verdict')).toHaveAttribute('data-right', 'yes')
  await expect(page.getByTestId('memory')).not.toHaveClass(/empty/)
  await expect(page.getByTestId('node-x')).toBeVisible()
  await expect(page.getByTestId('scrubber')).toBeVisible()
  // And it is locked: a committed prediction does not change.
  await expect(page.getByTestId('output-0')).toHaveAttribute('readonly', '')
})

test('a wrong prediction names the kind of mistake and where to go back', async ({ page }) => {
  await open(page, 'x-2.2')
  await prepared(page)
  await page.getByTestId('output-0').fill('[1, 2, 3]\n[1, 2]')
  await page.getByTestId('commit').click()

  await expect(page.getByTestId('verdict')).toHaveAttribute('data-right', 'no')
  await expect(page.getByTestId('error-type')).toHaveAttribute('data-err', 'object')
  await expect(page.getByTestId('guide')).toContainText('object-model')
  // The key opens in full: the reasoning is the actual content.
  await expect(page.getByTestId('key-card')).toContainText('Reasoning')
  await expect(page.getByTestId('go-back')).toContainText('1.3')

  await page.getByTestId('go-back-1.3').click()
  await expect(page.getByTestId('read-panel')).toHaveAttribute('data-item', '1.3')
  await expect(page.getByTestId('level-label')).toContainText('Exercise 1.3')
})

test('a picture choice is drawn by the real memory grid, and only the truth is right', async ({ page }) => {
  await open(page, 'x-1.3')
  await prepared(page)
  const options = page.locator('.diagram-option')
  expect(await options.count()).toBeGreaterThanOrEqual(3)
  // Every picture is memory cards and arrows, the same components memory uses.
  await expect(options.first().locator('.node.name').first()).toBeVisible()

  await play(page, { next: false })
  await expect(page.locator('.diagram-option.key')).toHaveCount(1)
  await expect(page.locator('.diagram-option.key .diagram-says')).toContainText('What Python built')
  await expect(page.locator('.diagram-option:not(.key) .diagram-says').first()).toContainText('picture if')
})

test('a repair is checked by running it, and the key’s fix waits until it works', async ({ page }) => {
  await open(page, 'x-1.8')
  await prepared(page)
  const models = (await api(page).models())!
  await api(page).answer(0, models[0]!)
  await api(page).answer(1, models[1]!)
  await page.getByTestId('commit').click()

  // The key's own code is held back while the repair is owed.
  await expect(page.getByTestId('key-held').first()).toBeVisible()
  await expect(page.locator('.read-editor')).toBeVisible()

  await api(page).submit(2, 'a = 1\nb = 2\na = b\nb = a\nprint(2, 1)\n')
  await expect(page.getByTestId('act-verdict')).toContainText('a should point at 2')

  await api(page).submit(2, 'a = 1\nb = 2\ntemp = a\na = b\nb = temp\nprint(a, b)\n')
  await expect(page.getByTestId('act-done-2')).toBeVisible()
  await expect(page.getByTestId('key-held')).toHaveCount(0)
  await expect(page.getByTestId('next-item')).toBeVisible()
})

test('execution order is numbered by clicking the lines', async ({ page }) => {
  await open(page, 'x-1.4')
  await prepared(page)
  // The order part is the only line-picker, so the code answers it.
  for (const n of [1, 2, 3, 4, 5]) await page.getByTestId(`line-${n}`).click()
  await expect(page.locator('.order-chip')).toHaveCount(5)
  await page.getByTestId('output-0').fill('2\n7')
  await page.getByTestId('commit').click()
  await expect(page.locator('[data-kind="order"] [data-testid="verdict"]')).toHaveAttribute('data-right', 'yes')
})

test('a whole set, played with the key’s answers, finishes and returns to the map', async ({ page }) => {
  await seedProgress(page, ['sandbox', 'operations', 'practice-thinking', 'names', 'order', 'practice-remembering', 's1-ideas', 'wake'])
  await open(page, 's1-set-1')
  for (let i = 0; i < 6; i++) await play(page)
  await expect(page.getByTestId('guide')).toContainText('6 of 6 right first time')
  await page.getByTestId('advance').click()
  await expect(page.getByTestId('level-s1-set-1')).toHaveAttribute('data-state', 'done')
  await expect(page.getByTestId('level-s1-set-2')).toHaveAttribute('data-state', 'current')
})

test('a failed checkpoint sends you to review, and passing it earns the stage', async ({ page }) => {
  const stage1 = ['names', 'order', 'practice-remembering', 's1-ideas', 'wake', 's1-set-1', 's1-set-2', 's1-set-3', 's1-practice']
  await seedProgress(page, ['sandbox', 'operations', 'practice-thinking', ...stage1])
  test.setTimeout(240_000)

  // Two wrong of six: below the pass mark.
  await open(page, 's1-checkpoint')
  for (let i = 0; i < 6; i++) await play(page, { wrong: i === 2 || i === 3 })
  await expect(page.getByTestId('checkpoint-failed')).toBeVisible()
  await expect(page.getByTestId('advance')).toHaveCount(0)
  await page.getByTestId('to-review').click()

  // The map owes a review, in amber, and the checkpoint waits for it.
  await expect(page.getByTestId('level-s1-review')).toHaveAttribute('data-state', 'current')
  await expect(page.getByTestId('level-s1-checkpoint')).toHaveAttribute('data-state', 'locked')
  await page.getByTestId('level-s1-checkpoint').click()
  await expect(page.getByTestId('map-card')).toContainText('The review comes first')

  await open(page, 's1-review')
  const owed = (await api(page).state()).of as number
  expect(owed).toBeGreaterThan(0)
  for (let i = 0; i < owed; i++) await play(page)
  await page.goto('./#/map')
  await expect(page.getByTestId('level-s1-review')).toHaveCount(0)
  await expect(page.getByTestId('level-s1-checkpoint')).toHaveAttribute('data-state', 'current')

  // Retaken, and passed.
  await open(page, 's1-checkpoint')
  for (let i = 0; i < 6; i++) await play(page)
  await expect(page.getByTestId('guide')).toContainText('Checkpoint passed')
  await page.getByTestId('advance').click()
  await expect(page.getByTestId('trophy-stage-1')).toHaveClass(/earned/)
})

test('the ideas run in place, and reading to the end finishes them', async ({ page }) => {
  await open(page, 's2-ideas')
  await expect(page.getByTestId('memory')).toHaveClass(/empty/)
  await page.getByTestId('try-it').first().click()
  await expect(page.getByTestId('memory')).not.toHaveClass(/empty/)
  await expect(page.getByTestId('advance')).toHaveCount(0)
  await page.getByTestId('ideas-end').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('advance')).toBeVisible()
})

test('the glossary opens at a term, and a bold term in the text links to it', async ({ page }) => {
  await open(page, 's6-ideas')
  const term = page.locator('a.term').first()
  await expect(term).toBeVisible()
  const href = await term.getAttribute('href')
  expect(href).toMatch(/^#\/glossary\//)
  await term.click()
  await expect(page.getByTestId('glossary')).toBeVisible()
  await expect(page.getByTestId(`term-${href!.split('/').pop()}`)).toBeInViewport()
  // "First met" opens the exercise.
  await page.getByTestId('term-binding').getByRole('link').click()
  await expect(page.getByTestId('read-panel')).toHaveAttribute('data-item', '1.1')
})

test('the crow speaks plainly until Stage 6, and formally from it', async ({ page }) => {
  await open(page, 'x-5.3')
  await prepared(page)
  await expect(page.getByTestId('guide')).toContainText('write down what it prints')
  await open(page, 'x-6.1')
  await prepared(page)
  await expect(page.getByTestId('guide')).toContainText('Predict the output')
})

test('the skills screen classifies misses and lists the misconceptions fallen for', async ({ page }) => {
  await open(page, 'x-2.2')
  await play(page, { wrong: true, next: false })
  await page.goto('./#/skills')
  await expect(page.getByTestId('err-object')).toContainText('1')
  await expect(page.getByTestId('err-advice')).toContainText('object-model')
  await expect(page.getByTestId('redo')).toContainText('2.2')
})

test('the map shows ten units, the warm-up first and the capstone last', async ({ page }) => {
  await page.goto('./#/map')
  await expect(page.locator('.map-unit')).toHaveCount(10)
  await expect(page.getByTestId('unit-thinking')).toContainText('Warm-up')
  await expect(page.getByTestId('unit-stage-9')).toContainText('Stage 9')
  await expect(page.getByTestId('level-s9-capstone')).toHaveCount(1)
})

test('the reading panel scrolls under the wheel, whatever is under the pointer', async ({ page }) => {
  await open(page, 'x-1.3')
  await prepared(page)
  const panel = page.getByTestId('read-panel')
  const box = (await page.locator('.diagram-option').first().boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, 400)
  await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
})

test('an example that leans on the text before it runs with what the text set up', async ({ page }) => {
  // "Given `original = [[1, 2], [3, 4]]`:" is prose, and the examples after
  // it use `original` without defining it.
  await open(page, 's4-ideas')
  await page.locator('.block-code', { hasText: 'shallow = original[:]' }).getByTestId('try-it').click()
  await expect(page.getByTestId('ideas-note')).toContainText('continues what the section set up')
  await expect(page.getByTestId('node-shallow')).toBeVisible()
  await expect(page.getByTestId('node-original')).toBeVisible()
})

test('the capstone keeps all eight of its steps on screen', async ({ page }) => {
  await open(page, 's9-capstone')
  const steps = page.getByTestId('capstone-steps').locator('li')
  await expect(steps).toHaveCount(8)
  await expect(steps.first()).toHaveAttribute('aria-current', 'step')
  await expect(steps.first()).toContainText('Mark the blocks')
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/capstone-steps.png` })
})

test('unlocking opens every level without finishing any, and starting over forgets everything', async ({ page }) => {
  await page.goto('./#/map')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByTestId('level-s9-capstone')).toHaveAttribute('data-state', 'locked')

  await page.getByTestId('map-end').getByTestId('unlock-all').click()
  await expect(page.getByTestId('level-s9-capstone')).toHaveAttribute('data-state', 'unlocked')
  await expect(page.getByTestId('level-sandbox')).toHaveAttribute('data-state', 'current')
  await expect(page.getByTestId('map-tally')).toContainText('0 of 61')
  await page.getByTestId('level-s9-capstone').click()
  await expect(page.getByTestId('map-go')).toBeVisible()
  await expect(page.getByTestId('trophy-stage-9')).not.toHaveClass(/earned/)
  // It survives a reload, like the rest of progress.
  await page.reload()
  await expect(page.getByTestId('level-s9-capstone')).toHaveAttribute('data-state', 'unlocked')

  // Something to forget: a finished level and a mastery record.
  await page.evaluate(() => {
    localStorage.setItem('botgineer.progress.v1', JSON.stringify(['sandbox', '*unlock-all']))
    localStorage.setItem('botgineer.mastery.v1', JSON.stringify({ int: { tries: 1, right: 1, score: 0.35, streak: 1, last: Date.now() } }))
  })
  await page.reload()
  await expect(page.getByTestId('level-sandbox')).toHaveAttribute('data-state', 'done')

  const controls = page.getByTestId('map-end')
  await controls.getByTestId('reset').click()
  await controls.getByTestId('reset-cancel').click()
  await expect(page.getByTestId('level-sandbox')).toHaveAttribute('data-state', 'done')
  await controls.getByTestId('reset').click()
  await controls.getByTestId('reset-confirm').click()
  await expect(page.getByTestId('level-sandbox')).toHaveAttribute('data-state', 'current')
  await expect(page.getByTestId('level-s9-capstone')).toHaveAttribute('data-state', 'locked')
  expect(await page.evaluate(() => localStorage.getItem('botgineer.mastery.v1'))).toBe('{}')
})
