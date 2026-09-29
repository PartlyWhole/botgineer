/**
 * The memory pane's paint for a lesson about binding: marked names, the
 * crow's demonstration framed as the crow's, and the control that wipes
 * the robot's memory. Rendered to markup, so this is what is drawn, not
 * how it moves.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CROW_NAME } from '../../content/cast'
import type { MemorySnapshot } from '../../src/memory/model'
import { MemoryPanel } from '../../src/panels/MemoryPanel'
import { RobotPanel } from '../../src/panels/RobotPanel'

const snapshot: MemorySnapshot = {
  bindings: [
    { name: 'x', scope: 'global', target: 'v:int:3' },
    { name: 'y', scope: 'global', target: 'v:int:5' },
  ],
  objects: {
    'v:int:3': { id: 'v:int:3', type: 'int', kind: 'value', repr: '3', elements: null, partial: false },
    'v:int:5': { id: 'v:int:5', type: 'int', kind: 'value', repr: '5', elements: null, partial: false },
  },
  line: null,
}
const handles = new Map([
  ['v:int:3', 'obj1'],
  ['v:int:5', 'obj2'],
])
const memory = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(MemoryPanel, { snapshot, handles, look: 'v2', ...extra }))

describe('marks in memory', () => {
  it('rings the marked name, its arrow and its object, and nothing else', () => {
    const html = memory({ marked: ['x'] })
    expect(html).toMatch(/class="node name +marked" data-testid="node-x"|data-marked="yes"[^>]*data-testid="node-x"/)
    expect(html.match(/class="node [^"]*marked"/g)).toHaveLength(2)
    expect(html).toMatch(/data-testid="node-v:int:3"/)
    expect(html).toMatch(/class="node object value +marked"[^>]*data-testid="node-v:int:3"/)
    expect(html).not.toMatch(/marked"[^>]*data-testid="node-y"/)
    expect(html.match(/class="edge +marked"/g)).toHaveLength(1)
    expect(html).toContain('url(#tip-marked)')
  })

  it('marks nothing when nothing is marked', () => {
    for (const marked of [undefined, []]) {
      const html = memory({ marked })
      expect(html).not.toContain('data-marked')
      expect(html).not.toContain('url(#tip-marked)')
    }
  })
})

describe("the crow's demonstration in memory", () => {
  it("is framed and tagged as the crow's, and says so in words", () => {
    const html = memory({ demo: true })
    expect(html).toContain('data-demo="yes"')
    expect(html).toContain('data-testid="memory-demo"')
    expect(html).toContain(`class="demo-tag" aria-hidden="true"`)
    expect(html).toContain(`${CROW_NAME}</span>`)
    expect(html).toMatch(new RegExp(`class="sr-only">This is ${CROW_NAME}(&#x27;|')s example`))
    expect(memory()).not.toContain('memory-demo')
  })
})

describe("wiping the robot's memory", () => {
  const panel = (extra: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(RobotPanel, {
        mode: 'console',
        look: 'v2',
        exchanges: [],
        onSay: () => {},
        program: '',
        onProgram: () => {},
        onReady: () => {},
        onRun: () => {},
        onStop: () => {},
        busy: false,
        disabled: false,
        transcript: [],
        index: 0,
        total: 0,
        onIndex: () => {},
        traceLine: null,
        memory: null,
        ...extra,
      }),
    )
  const reset = /<button type="button" class="memory-reset"[^>]*>/

  it('is offered in the console when there is a way to do it, labelled', () => {
    const tag = reset.exec(panel({ onReset: () => {} }))?.[0] ?? ''
    expect(tag).toContain(`aria-label="Wipe the robot&#x27;s memory"`)
    expect(tag).toContain(`title="Wipe the robot&#x27;s memory"`)
    expect(tag).toContain('data-testid="memory-reset"')
    expect(tag).not.toContain('disabled')
    expect(panel({})).not.toMatch(reset)
    expect(panel({ onReset: () => {}, mode: 'editor' })).not.toMatch(reset)
  })

  it('is closed while a line runs or someone is talking', () => {
    expect(reset.exec(panel({ onReset: () => {}, busy: true }))?.[0]).toContain('disabled')
    expect(reset.exec(panel({ onReset: () => {}, listening: true }))?.[0]).toContain('disabled')
  })
})
