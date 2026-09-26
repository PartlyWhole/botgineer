/**
 * Indentation for the console's block input: what Enter, Tab, Shift-Tab
 * and Backspace do to the buffer while a block is being typed.
 *
 * A terminal REPL leaves indentation to you, and so did this console: a
 * learner typing their first `for` body had to count four spaces by hand,
 * and Tab — which every editor they will ever meet uses for exactly that —
 * moved focus off the line instead. So inside a block the console indents
 * the way an editor does: a line after a header (`...:`) starts four
 * spaces in, a body line keeps its indent, Tab adds four, Backspace in the
 * indent takes four back. Outside a block Tab still moves focus, so the
 * page stays keyboard-navigable; inside one, Escape hands Tab back
 * (`RobotConsole`).
 *
 * Pure, on `(text, caret)` pairs, so the rules are tested without a DOM.
 */

/** One level of indentation. Python's own convention, and the collection's. */
export const INDENT = '    '

export type Edit = { text: string; caret: number }

/** Where the line holding `caret` starts. */
const lineStart = (text: string, caret: number) => text.lastIndexOf('\n', caret - 1) + 1

/** The code of a line without its comment or trailing space — enough to
 *  see whether it ends in `:`. A `#` inside a string is rare on a header
 *  line, and misreading one costs only an indent. */
const codeOf = (line: string) => line.split('#')[0]!.trimEnd()

/**
 * Enter inside a block: a new line, indented like the one the caret is on,
 * and one level deeper when that line (up to the caret) opens a block.
 */
export function newline(text: string, from: number, to = from): Edit {
  const start = lineStart(text, from)
  const before = text.slice(start, from)
  const kept = /^[ \t]*/.exec(before)![0]
  const indent = codeOf(before).endsWith(':') ? kept + INDENT : kept
  const insert = `\n${indent}`
  return { text: text.slice(0, from) + insert + text.slice(to), caret: from + insert.length }
}

/**
 * What Enter is asked about: the buffer as it would stand if the caret's
 * line is only indentation — the indent `newline` put there and the player
 * typed nothing after. That line is the blank one that closes a block, and
 * should be judged as blank, not as a line of spaces.
 */
export function asBlank(text: string, caret: number): string {
  if (caret !== text.length) return text
  const start = lineStart(text, caret)
  return /^[ \t]+$/.test(text.slice(start)) ? text.slice(0, start) : text
}

/** Tab: four spaces at the caret, over any selection. */
export function tab(text: string, from: number, to = from): Edit {
  return { text: text.slice(0, from) + INDENT + text.slice(to), caret: from + INDENT.length }
}

/** Shift-Tab: up to four spaces off the front of the caret's line. */
export function untab(text: string, caret: number): Edit {
  const start = lineStart(text, caret)
  const lead = /^ {0,4}/.exec(text.slice(start))![0].length
  if (lead === 0) return { text, caret }
  return { text: text.slice(0, start) + text.slice(start + lead), caret: Math.max(start, caret - lead) }
}

/**
 * Backspace in a line's indentation (only spaces before the caret on its
 * line) takes it back to the previous level, not one space. Anywhere else
 * it is an ordinary Backspace, and this says so by returning null.
 */
export function backspace(text: string, from: number, to = from): Edit | null {
  if (from !== to) return null
  const start = lineStart(text, from)
  const before = text.slice(start, from)
  if (before === '' || !/^ +$/.test(before)) return null
  const cut = before.length % INDENT.length || INDENT.length
  return { text: text.slice(0, from - cut) + text.slice(from), caret: from - cut }
}
