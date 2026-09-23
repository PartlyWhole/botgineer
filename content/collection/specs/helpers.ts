/**
 * Shorthand for writing specs, so each one reads like the exercise it
 * grades. Nothing here decides anything: each helper builds a `Part`.
 */
import type { Check, ErrorType, Moment, Part, SnippetRef, Transform } from '../../../src/collection/model'
import type { RunEvidence } from '../../../src/memory/extract'

type Opt = { prompt?: string; err?: ErrorType; snippet?: SnippetRef }

const extra = (o: Opt = {}) => ({
  ...(o.prompt !== undefined ? { prompt: o.prompt } : {}),
  ...(o.err !== undefined ? { err: o.err } : {}),
  ...(o.snippet !== undefined ? { snippet: o.snippet } : {}),
})

/** What it prints; `raises` when it stops with an error. */
export const output = (
  text: string,
  o: Opt & { raises?: string; match?: 'exact' | 'unordered-lines' | 'unordered-items' } = {},
): Part => ({
  kind: 'output',
  model: { text, raises: o.raises ?? null },
  ...(o.match ? { match: o.match } : {}),
  ...extra(o),
})

/** A choice. The first option is the right one unless `answer` says
 *  otherwise; the page shuffles nothing, so write them in a sensible order. */
export const choice = (
  prompt: string,
  options: string[],
  answer: number | number[] | ((ev: RunEvidence[]) => number | number[]) = 0,
  /** `model` is the key's pick, for an answer derived from the run: the
   *  sweep then checks the key against the interpreter instead of the
   *  derivation against itself. */
  o: Omit<Opt, 'prompt' | 'snippet'> & { model?: number | number[] } = {},
): Part => ({
  kind: 'choice',
  prompt,
  options,
  answer,
  ...(typeof answer !== 'function' ? { model: answer } : o.model !== undefined ? { model: o.model } : {}),
  ...extra(o),
})

export const number = (
  prompt: string,
  answer: number | ((ev: RunEvidence[]) => number),
  model: number,
  o: Omit<Opt, 'prompt' | 'snippet'> = {},
): Part => ({ kind: 'number', prompt, answer, model, ...extra(o) })

export const line = (prompt: string, answer: number | number[] | 'divergence', model: number, o: Omit<Opt, 'prompt'> = {}): Part => ({
  kind: 'line',
  prompt,
  answer,
  model,
  ...extra(o),
})

/** The first line whose effect differs between snippets A and B. */
export const firstDifference = (model: number, o: Omit<Opt, 'prompt' | 'snippet'> = {}): Part =>
  line('Click the first line where the two snippets’ behaviour differs.', 'divergence', model, o)

export const order = (model: number[], o: Opt & { first?: number; lines?: [number, number] } = {}): Part => ({
  kind: 'order',
  model,
  ...(o.first ? { first: o.first } : {}),
  ...(o.lines ? { lines: o.lines } : {}),
  ...extra(o),
})

export const diagram = (at: Moment, distractors: (Transform | { at: Moment })[], o: Opt = {}): Part => ({
  kind: 'diagram',
  at,
  distractors,
  ...extra(o),
})

export const labels = (lineText: string, spans: [string, string][], decoys: string[], o: Omit<Opt, 'snippet'> = {}): Part => ({
  kind: 'labels',
  line: lineText,
  spans: spans.map(([text, role]) => ({ text, role })),
  roles: shuffleStable([...spans.map(([, r]) => r), ...decoys]),
  ...extra(o),
})

export const rule = (o: Omit<Opt, 'snippet'> & { wrongWord?: string } = {}): Part => ({
  kind: 'rule',
  ...(o.wrongWord ? { wrongWord: o.wrongWord } : {}),
  ...extra(o),
})

export const fix = (model: string, checks: Check[], o: Opt & { small?: number } = {}): Part => ({
  kind: 'fix',
  model,
  checks,
  ...(o.small !== undefined ? { small: o.small } : {}),
  ...extra(o),
})

export const write = (model: string, checks: Check[], o: Omit<Opt, 'snippet'> & { starter?: string } = {}): Part => ({
  kind: 'write',
  model,
  checks,
  ...(o.starter !== undefined ? { starter: o.starter } : {}),
  ...extra(o),
})

export const block = (
  header: number,
  body: number[],
  counts: Record<number, number> | null,
  o: Opt = {},
): Part => ({
  kind: 'block',
  header,
  counts: counts !== null,
  model: { body, ...(counts ? { counts } : {}) },
  ...extra(o),
})

/** Checks, briefly. */
export const py = (expr: string, say: string): Check => ({ py: expr, say })
export const prints = (text: string, say = `It should print exactly:\n${text}`): Check => ({ output: text, say })
export const printsLine = (text: string, say: string): Check => ({ printed: text, say })
export const printsLike = (re: string, say: string): Check => ({ printedMatch: re, say })
export const forbid = (re: string, say: string): Check => ({ forbid: re, say })
export const requires = (re: string, say: string): Check => ({ require: re, say })
export const finishes = (say = 'It should run to the end without an error.'): Check => ({ raises: null, say })

/** Role labels are offered in a fixed, scrambled order — never in the
 *  order the spans come in, which would give the answer away. */
function shuffleStable<T>(xs: T[]): T[] {
  const out = [...new Set(xs)]
  return out.map((x, i) => ({ x, k: (i * 7 + 3) % (out.length + 1) })).sort((a, b) => a.k - b.k).map((o) => o.x)
}
