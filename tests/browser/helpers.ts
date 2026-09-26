/**
 * What every workbench journey shares: the test surface's shape, opening
 * a level, typing to the robot, and moving through a lesson's beats.
 *
 * Not a spec itself (no `.spec.ts`), so Playwright only runs it through
 * the journeys that import it.
 */
import { expect, type Page } from '@playwright/test'
import { OPS_ANSWERS } from './ops'

/** What `beat()` reports: the line being told, and where it sits in its
 *  step's script. */
export type Beat = {
  at: number
  of: number
  text: string
  asking: boolean
  speaker: string
  kind: 'praise' | 'beat' | 'ask' | 'reply' | 'outro' | null
  listening: boolean
}

declare global {
  interface Window {
    botgineer: {
      setProgram(text: string): void
      getProgram(): string
      run(): Promise<void>
      /** Skips any narration first, then types the line. */
      say(line: string): Promise<void>
      beat(): Beat
      next(): void
      skip(): void
      snapshot(): {
        bindings: { name: string; scope: string; target: string }[]
        objects: Record<
          string,
          {
            id: string
            type: string
            kind: string
            repr: string
            elements: { label: string | null; target: string }[] | null
          }
        >
      }
      state(): {
        boot: string
        busy: boolean
        steps: number
        mode: string
        history: string[]
      }
    }
  }
}

/** The starting activity is a console now, so the journeys that are about
 *  the editor run against an activity that still has one. */
export const EDITOR = 'wake'

export async function open(page: Page, activity: string) {
  await page.goto(`./#/${activity}`)
  // The runtime does not announce that it works; it announces failure.
  // The shell carries its state as data so there is still something to
  // wait on without putting a badge on screen.
  await expect(page.locator('.app')).toHaveAttribute('data-boot', 'ready', { timeout: 60_000 })
}

/** Marks levels finished before the page loads, as if played earlier.
 *  Each test starts with empty storage, so a journey that finishes level
 *  three would otherwise land on a map still asking for level one. */
export async function seedProgress(page: Page, ids: string[]) {
  await page.addInitScript((done) => localStorage.setItem('botgineer.progress.v1', JSON.stringify(done)), ids)
}

/** Every warm-up level, finished: what a journey past the warm-up seeds. */
export const WARM_UP = ['sandbox', 'types', 'choose', 'operations', 'practice-thinking']

/** Memory shares the robot panel with the instrument — there is nothing
 *  to switch to any more, so this only confirms it is on screen. */
export async function showMemory(page: Page) {
  await expect(page.getByTestId('memory')).toBeVisible()
}

/** Past any narration, to the question — as a player pressing Next
 *  through it would. */
export async function skip(page: Page) {
  await page.evaluate(() => window.botgineer.skip())
  await expect.poll(() => page.evaluate(() => window.botgineer.beat().listening)).toBe(false)
}

/** Types a line into the console and waits for the robot to finish.
 *  Skips narration first, since the console is closed while someone on
 *  the stage is talking. */
export async function say(page: Page, line: string) {
  await skip(page)
  const input = page.getByTestId('console-input')
  await input.fill(line)
  await input.press('Enter')
  await expect(page.getByTestId('robot-panel')).toHaveAttribute('data-busy', 'no', {
    timeout: 60_000,
  })
}

/** Sends a program and waits for the run to settle. The panel's own busy
 *  flag is the signal, so there is nothing to sleep on. */
export async function send(page: Page, program: string) {
  await page.evaluate((p) => window.botgineer.setProgram(p), program)
  await expect.poll(() => page.evaluate(() => window.botgineer.getProgram())).toBe(program)
  await page.getByTestId('run').click()
  await expect(page.getByTestId('robot-panel')).toHaveAttribute('data-busy', 'no', {
    timeout: 60_000,
  })
}

export const beat = (page: Page) => page.evaluate(() => window.botgineer.beat())

export const reprs = (page: Page) =>
  page.evaluate(() =>
    Object.values(window.botgineer.snapshot().objects)
      .map((o) => o.repr)
      .sort(),
  )

export const targetOf = (page: Page, name: string) =>
  page.evaluate((n) => window.botgineer.snapshot().bindings.find((b) => b.name === n)?.target ?? null, name)

/** Lines that answer the operations level right, in order (`ops.ts`,
 *  which the unit suite holds to the lesson). The bubble journeys use its
 *  longest lines and widest values. */
export const OPS: string[] = OPS_ANSWERS.map(([source]) => source)

/** Waits for the speech bubble and its tail to stop moving: a change of
 *  speaker slides them across (a CSS transition), and anything measured
 *  part-way is somewhere between the two speakers. */
export async function speechSettled(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll('.bubble, .bubble-tail')].some((el) =>
          el.getAnimations().some((a) => a instanceof CSSTransition && a.playState === 'running'),
        ),
      ),
    )
    .toBe(false)
}

/** What floats over the stage and could stand on a control: the hint
 *  strip, the speech, the thought, the takeaway. The strip takes no
 *  clicks (`pointer-events: none`), so `elementFromPoint` sees through it
 *  just as a click does — and a player's eye does not; hence boxes too. */
export const OVERLAYS = ['.stage-foot', '[data-testid="guide"]', '[data-testid="thought"]', '[data-testid="takeaway"]']

/** Whether a control can be seen and pressed where it stands: in the
 *  viewport, the topmost thing at its centre (or inside it) — so anything
 *  drawn over it fails, as it would fail a finger — and clear of every
 *  overlay's box (`under` names the ones it is not). Scrolls it into view
 *  first, as a player would. */
export async function reachable(
  page: Page,
  testId: string,
  overlays: string[] = OVERLAYS,
): Promise<{ inView: boolean; onTop: string | true; under: string[] }> {
  const el = page.getByTestId(testId)
  await el.scrollIntoViewIfNeeded()
  return el.evaluate((node, sels) => {
    const b = node.getBoundingClientRect()
    const x = (b.left + b.right) / 2
    const y = (b.top + b.bottom) / 2
    const inView = b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth
    const hit = document.elementFromPoint(x, y)
    const onTop = hit !== null && (hit === node || node.contains(hit)) ? true : (hit?.className?.toString() ?? 'nothing')
    const hits = (o: DOMRect) => !(o.right <= b.left || b.right <= o.left || o.bottom <= b.top || b.bottom <= o.top)
    const under = sels.filter((sel) => [...document.querySelectorAll(sel)].some((o) => o !== node && !o.contains(node) && hits(o.getBoundingClientRect())))
    return { inView, onTop, under }
  }, overlays)
}
