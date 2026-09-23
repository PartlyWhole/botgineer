/**
 * The "Reading Python" collection, as the app plays it.
 *
 * Two halves, kept apart on purpose:
 *
 *   **content**  what the markdown says — prompts, code, answer keys,
 *                authoring records. Parsed at build time by
 *                `scripts/collection.mjs` into `content/collection/generated/`,
 *                and never edited by hand.
 *   **specs**    how to grade each item — which interactions it asks for
 *                and what counts as right. Hand-written TypeScript in
 *                `content/collection/specs/`, keyed by the same ids.
 *
 * Prose lives in markdown and grading lives in code, so an author editing
 * a reasoning paragraph can never break a grader, and a grader can never
 * quietly rewrite what the key says.
 *
 * The interpreter is the answer key. A spec says *what* to compare — the
 * printed output, the order lines ran in, the memory just before line 3 —
 * and the truth comes from running the snippet in the real engine. The
 * `model` answers in a spec are the key's own answers, written as a learner
 * would give them; the self-consistency sweep feeds each one to its own
 * grader against real Python, which is how a key that disagrees with the
 * interpreter (or a spec that disagrees with its key) gets caught.
 */
import type { MemorySnapshot } from '../memory/model'
import type { RunEvidence } from '../memory/extract'

/* -------------------------------- blocks -------------------------------- */

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'rule' }

/* ------------------------------- content ------------------------------- */

/** The four kinds of mistake. The collection's words are Syntax-reading,
 *  Flow, Object-model and Vocabulary-only. */
export type ErrorType = 'syntax' | 'flow' | 'object' | 'vocabulary'

export const ERROR_NAMES: Record<ErrorType, string> = {
  syntax: 'Syntax-reading',
  flow: 'Flow',
  object: 'Object-model',
  vocabulary: 'Vocabulary-only',
}

/** The collection's nine forms, by what the learner does. */
export type Form = 'label' | 'block' | 'order' | 'table' | 'draw' | 'predict' | 'compare' | 'fix' | 'write' | 'rule'

export type Snippet = {
  /** `A`, `B`, … for paired snippets; null for a single one. */
  label: string | null
  code: string
  /** A `# ←` marker in the code: which line, and what it says. */
  marker?: { line: number; text: string }
}

export type Authoring = {
  text: string
  target: string
  prereq: string[]
  syntax: string
  flow: string
  object: string
}

export type KeySection = { label: string; blocks: Block[] }

export type Key = {
  /** Every labelled part of the entry, in order, minus the authoring line. */
  sections: KeySection[]
  answer: Block[]
  reasoning: Block[]
  misconception: string
  /** "If you missed it" and "Error type" text, joined. */
  missed: string
  errorTypes: ErrorType[]
  /** Exercises the key sends you back to. */
  goBack: string[]
  authoring: Authoring | null
}

export type Exercise = {
  id: string
  stage: number
  /** The form as the markdown names it: "Predict the result". */
  form: string
  kind: Form
  prompt: Block[]
  snippets: Snippet[]
  key: Key
}

export type CheckpointItem = {
  id: string
  stage: number
  prompt: Block[]
  snippets: Snippet[]
  answer: Block[]
  errorTypes: ErrorType[]
  goBack: string[]
}

export type Idea = { title: string; blocks: Block[] }

export type Stage = {
  stage: number
  file: string
  title: string
  /** "The one new move", as the stage file words it. */
  move: string
  /** The same move in a few words, from the README's table of stages. */
  summary: string
  adds: Block[]
  ideas: Idea[]
  exercises: Exercise[]
  checkpoint: { intro: Block[]; items: CheckpointItem[] } | null
  capstone: { intro: Block[]; listing: string; program: string; brief: Block[] } | null
  after: Block[]
}

export type GlossaryTerm = { plain: string; term: string; formal: string; meaning: string; firstMet: string }
export type Glossary = { intro: Block[]; groups: { title: string; terms: GlossaryTerm[]; notes: Block[] }[] }

export type Misconception = { id: string; text: string; exercises: string[] }

/* -------------------------------- specs -------------------------------- */

/** Which snippet a part is about: its label (`'A'`), or its index. The
 *  first snippet when omitted. */
export type SnippetRef = string | number

/** A moment in a run, for "draw the picture after line 3" — see
 *  `memory/extract`. */
export type { Moment } from '../memory/extract'
import type { Moment } from '../memory/extract'

/** An answer derived from the run, so the interpreter is the key. */
export type Derived<T> = T | ((ev: RunEvidence[]) => T)

/**
 * A check a written or repaired program must pass.
 *
 * `py` is a Python expression evaluated in the program's own namespace
 * after it has run (`m is n`); `output` compares everything it printed,
 * `printed` looks for one line of it and `printedMatch` a pattern in it;
 * `forbid` and `require` read the source, for instructions such as "using
 * only assignment and print". Each has a sentence that says, when it
 * fails, what was wanted.
 */
export type Check =
  | { py: string; say: string }
  | { output: string; say: string }
  | { printed: string; say: string }
  /** A regular expression the whole printed output must match. */
  | { printedMatch: string; say: string }
  | { forbid: string; say: string }
  | { require: string; say: string }
  | { raises: string | null; say: string }

/** A misconception transform, applied to the true memory to draw a wrong
 *  picture that a particular wrong model would predict. */
export type Transform =
  | 'alias-to-copy'
  | 'copy-to-alias'
  | 'shared-inner-to-separate'
  | 'separate-inner-to-shared'
  | 'default-to-fresh'
  | 'follow-rebind'
  /** Memory one line before or after the moment asked about: the
   *  learner who reads "after line 3" as "before" draws exactly that. */
  | 'earlier'
  | 'later'
  /** Memory at another moment, named by a `{ at }` distractor. */
  | 'moment'

type Common = {
  /** Shown above the widget. */
  prompt?: string
  /** The kind of mistake a miss on this part is. Defaults to the key's
   *  first error type. */
  err?: ErrorType
}

export type Part = Common &
  (
    | {
        /** Type what it prints — and, if it stops with an error, which. */
        kind: 'output'
        snippet?: SnippetRef
        /** How to compare. `exact` after normalising trailing space and
         *  the final newline; `unordered-lines` for set iteration, whose
         *  order is not pinned; `unordered-items` for one printed set. */
        match?: 'exact' | 'unordered-lines' | 'unordered-items'
        /** The key's answer. `raises` names the exception, if any. */
        model: { text: string; raises?: string | null }
      }
    | {
        kind: 'choice'
        prompt: string
        options: string[]
        /** Index, or indices when several must be picked. */
        answer: Derived<number | number[]>
        model?: number | number[]
      }
    | { kind: 'number'; prompt: string; answer: Derived<number>; model: number }
    | {
        /** Click a line of the snippet. */
        kind: 'line'
        prompt: string
        snippet?: SnippetRef
        /** Any of these is right. `divergence` asks the two snippets'
         *  traces for the first line whose effect differs. */
        answer: number | number[] | 'divergence'
        model: number
      }
    | {
        /** Number the lines in the order Python reaches them. */
        kind: 'order'
        snippet?: SnippetRef
        /** Only the first N visits. */
        first?: number
        /** Only visits to lines in this range, inclusive. */
        lines?: [number, number]
        model: number[]
      }
    | {
        /** Fill in a trace table, one row per pass. */
        kind: 'table'
        snippet?: SnippetRef
        columns: string[]
        /** The truth, from the run. */
        truth: (ev: RunEvidence[]) => string[][]
        model: string[][]
      }
    | {
        /** Which lines are the body of the block opened on `header`, and
         *  how many times each line runs. */
        kind: 'block'
        snippet?: SnippetRef
        header: number
        counts: boolean
        model: { body: number[]; counts?: Record<number, number> }
      }
    | {
        /** Pick the picture of memory at a moment, from the truth and the
         *  pictures that named wrong models would draw. */
        kind: 'diagram'
        snippet?: SnippetRef
        at: Moment
        /** Named wrong models, or the picture at another moment. */
        distractors: (Transform | { at: Moment })[]
      }
    | {
        /** Put a role on each piece of a line. */
        kind: 'labels'
        line: string
        spans: { text: string; role: string }[]
        /** Roles offered, including ones that belong to no span. */
        roles: string[]
      }
    | {
        /** Write the rule down, then mark it against the key. */
        kind: 'rule'
        prompt?: string
        /** What "the idea right, the word wrong" means here, for the
         *  self-mark. */
        wrongWord?: string
      }
    | {
        /** Repair the snippet with the smallest change that works. */
        kind: 'fix'
        snippet?: SnippetRef
        checks: Check[]
        /** The key's repair. */
        model: string
        /** More changed lines than this earns a note, not a miss. */
        small?: number
      }
    | {
        /** Write a program from scratch. */
        kind: 'write'
        starter?: string
        checks: Check[]
        model: string
      }
  )

export type Spec = {
  /** Concept ids (`content/concepts.ts`) this item exercises. */
  concepts: string[]
  /** Extra misconception ids, beyond the conventions table. */
  mis?: string[]
  /** Lenses, when the authoring record's wording would pick wrongly. */
  lenses?: Lens[]
  /** Snippets borrowed from other exercises, for items that refer to them
   *  ("Rewrite 5.13 so that …"). */
  from?: string[]
  /** Extra code, for an item with none of its own and nothing to borrow. */
  code?: string[]
  /** How to run the snippets. The default is enough for everything that
   *  terminates quickly. */
  options?: { max_steps?: number }
  parts: Part[]
}

export type Lens = 'syntax' | 'flow' | 'object'

/* ------------------------------- grading ------------------------------- */

/** What the learner gave for one part. */
export type Answer =
  | { kind: 'output'; text: string; raises: string | null }
  | { kind: 'choice'; picked: number[] }
  | { kind: 'number'; value: number | null }
  | { kind: 'line'; line: number | null }
  | { kind: 'order'; lines: number[] }
  | { kind: 'table'; cells: string[][] }
  | { kind: 'block'; body: number[]; counts: Record<number, number> }
  | { kind: 'diagram'; picked: number | null }
  | { kind: 'labels'; roles: (string | null)[] }
  | { kind: 'rule'; text: string; mark: 'right' | 'word' | 'missed' | null }
  | { kind: 'fix'; source: string }
  | { kind: 'write'; source: string }

export type Graded = {
  right: boolean
  /** What was expected, for the key card — shown only after committing. */
  expected?: string
  /** Why it was wrong, when the grader can say. */
  why?: string
  /** Right, with something worth saying — a big fix, say. */
  note?: string
  /** A miss that is not a gap in understanding: the idea was right and
   *  the word was not. Recorded as vocabulary-only, and it does not count
   *  against a checkpoint. */
  soft?: boolean
  /** Overrides the part's error type for this miss. */
  err?: ErrorType
}

/** A diagram choice: the truth and its distractors, shuffled. */
export type DiagramChoice = { options: { snapshot: MemorySnapshot; transform: Transform | null }[]; answer: number }
