/**
 * The "Reading Python" collection: markdown in, typed JSON out.
 *
 * The markdown in `content/collection/` is the source of truth, and authors
 * keep editing it there. This turns each stage into the model the app plays
 * (`src/collection/model.ts` names the shapes), plus the glossary and the
 * misconception table, and writes them to `content/collection/generated/`.
 * The output is committed, so a content change shows up in a diff as the
 * data the app will actually see.
 *
 * Prose is kept as blocks — paragraphs, code, tables, lists, quotes — with
 * inline markup left in the text for the renderer. Nothing is interpreted
 * that the page does not need: *how to grade* an exercise is not in the
 * markdown and is not guessed from it. That lives in hand-written specs
 * (`content/collection/specs/`), keyed by exercise id.
 *
 *   node scripts/collection.mjs          regenerate
 *   node scripts/collection.mjs --check  fail if generated/ is stale
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'content', 'collection')
const OUT = join(DIR, 'generated')

/* ------------------------------- blocks ------------------------------- */

/**
 * Splits markdown into blocks. Deliberately small: the collection uses
 * paragraphs, fenced code, pipe tables, `-`/`1.` lists, `>` quotes, `#`
 * headings and `---` rules, and nothing else.
 */
export function blocks(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0
  const para = []
  const flush = () => {
    if (para.length) out.push({ kind: 'p', text: para.join(' ').replace(/\s+/g, ' ').trim() })
    para.length = 0
  }
  while (i < lines.length) {
    const line = lines[i]
    const fence = /^```(\w*)\s*$/.exec(line)
    if (fence) {
      flush()
      const body = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++])
      i++
      out.push({ kind: 'code', lang: fence[1] || 'text', text: body.join('\n') })
      continue
    }
    if (/^\s*$/.test(line)) {
      flush()
      i++
      continue
    }
    if (/^---+\s*$/.test(line)) {
      flush()
      out.push({ kind: 'rule' })
      i++
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      out.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() })
      i++
      continue
    }
    if (/^\|/.test(line)) {
      flush()
      const rows = []
      while (i < lines.length && /^\|/.test(lines[i])) {
        const cells = splitRow(lines[i])
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells)
        i++
      }
      out.push({ kind: 'table', head: rows[0] ?? [], rows: rows.slice(1) })
      continue
    }
    if (/^>\s?/.test(line)) {
      flush()
      const body = []
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''))
      out.push({ kind: 'quote', text: body.join(' ').replace(/\s+/g, ' ').trim() })
      continue
    }
    const bullet = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line)
    if (bullet && para.length === 0) {
      const ordered = /\d/.test(bullet[2])
      const items = []
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i])
        if (m) {
          items.push(m[3])
          i++
        } else if (/^\s{2,}\S/.test(lines[i]) && items.length) {
          items[items.length - 1] += ' ' + lines[i].trim()
          i++
        } else break
      }
      out.push({ kind: 'list', ordered, items: items.map((t) => t.replace(/\s+/g, ' ').trim()) })
      continue
    }
    para.push(line.trim())
    i++
  }
  flush()
  return out
}

/** A table row's cells. Pipes inside backticks are content, not borders. */
function splitRow(line) {
  const cells = []
  let cell = ''
  let code = false
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  for (const c of body) {
    if (c === '`') code = !code
    if (c === '|' && !code) {
      cells.push(cell.trim())
      cell = ''
    } else cell += c
  }
  cells.push(cell.trim())
  return cells
}

/* ------------------------------- helpers ------------------------------- */

const ERROR_WORDS = [
  [/syntax[- ]reading/i, 'syntax'],
  [/\bflow\b/i, 'flow'],
  [/object[- ]model/i, 'object'],
  [/vocabulary[- ]only/i, 'vocabulary'],
]

/** Error types in the order the text names them, each once. */
export function errorTypes(text) {
  const found = []
  for (const [re, type] of ERROR_WORDS) {
    const m = re.exec(text)
    if (m) found.push({ at: m.index, type })
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.type)
}

const ID = /\b(?:9\.C\d|C\d\.\d+|\d\.\d{1,2})\b/g

/** Exercise ids a sentence points at, ranges expanded ("1.1–1.6"). */
export function idsIn(text, own = null) {
  const out = []
  const range = /\b(\d)\.(C?)(\d{1,2})\s*[–-]\s*(?:\1\.)?\2(\d{1,2})\b/g
  let rest = text
  for (const m of text.matchAll(range)) {
    for (let n = Number(m[3]); n <= Number(m[4]); n++) out.push(`${m[1]}.${m[2]}${n}`)
    rest = rest.replace(m[0], ' ')
  }
  for (const m of rest.matchAll(ID)) out.push(m[0])
  return [...new Set(out)].filter((id) => id !== own)
}

/** The italic authoring line, split into its five fields. */
export function authoring(text) {
  const clean = text.replace(/^\*|\*$/g, '').replace(/^Authoring record\s*—\s*/, '')
  const field = (name, next) => {
    const re = new RegExp(`${name}:\\s*([\\s\\S]*?)\\s*(?=${next.map((n) => `${n}:`).join('|')}|$)`)
    return (re.exec(clean)?.[1] ?? '').replace(/\.$/, '').trim()
  }
  const target = field('Target', ['Prereq', 'Prereqs'])
  const prereqText = field('Prereqs?', ['Syntax lens'])
  return {
    text: clean,
    target,
    prereq: /^none/i.test(prereqText) ? [] : idsIn(prereqText),
    syntax: field('Syntax lens', ['Flow lens']),
    flow: field('Flow lens', ['Object lens']),
    object: field('Object lens', ['$^']),
  }
}

/** The collection's nine forms, plus the capstone's step names. */
const FORMS = [
  [/^label/i, 'label'],
  [/^mark the block/i, 'block'],
  [/^what runs next|^trace the flow/i, 'order'],
  [/trace table/i, 'table'],
  [/^draw/i, 'draw'],
  [/^predict/i, 'predict'],
  [/^compare/i, 'compare'],
  [/^find and fix|^diagnose|^the hidden one|^repair/i, 'fix'],
  [/^write|^extend/i, 'write'],
  [/^state the rule/i, 'rule'],
]

export const formOf = (raw) => FORMS.find(([re]) => re.test(raw))?.[1] ?? 'predict'

/** Fenced python code in a prompt, with its A/B label when it has one. */
function snippetsOf(prompt) {
  const out = []
  let label = null
  for (const b of prompt) {
    if (b.kind === 'p') {
      const m = /^Snippet \*\*([A-Z])\*\*:?$/.exec(b.text)
      if (m) label = m[1]
    }
    if (b.kind === 'code' && b.lang === 'python') {
      const lines = b.text.split('\n')
      const at = lines.findIndex((l) => /#\s*←/.test(l))
      out.push({
        label,
        code: b.text + '\n',
        ...(at >= 0 ? { marker: { line: at + 1, text: lines[at].split(/#\s*←/)[1].trim() } } : {}),
      })
      label = null
    }
  }
  return out
}

/** Splits a run of blocks at `**Label.**` paragraphs. The label's own
 *  paragraph keeps whatever followed the label on that line. */
function sectionsOf(bs) {
  const out = []
  for (const b of bs) {
    const m = b.kind === 'p' ? /^\*\*([^*]+?)\.\*\*\s*([\s\S]*)$/.exec(b.text) : null
    if (m) {
      out.push({ label: m[1], blocks: m[2] ? [{ kind: 'p', text: m[2] }] : [] })
    } else if (b.kind === 'p' && /^\*Authoring record/.test(b.text)) {
      out.push({ label: 'Authoring record', blocks: [b] })
    } else if (out.length) {
      out[out.length - 1].blocks.push(b)
    } else {
      out.push({ label: '', blocks: [b] })
    }
  }
  return out
}

const plain = (bs) =>
  bs
    .map((b) => (b.kind === 'p' || b.kind === 'quote' ? b.text : b.kind === 'list' ? b.items.join(' ') : ''))
    .join(' ')
    .trim()

function keyOf(id, bs) {
  const sections = sectionsOf(bs.filter((b) => b.kind !== 'rule'))
  const get = (re) => sections.find((s) => re.test(s.label))
  const answer = get(/^Answer$/)
  const reasoning = get(/^(Reasoning|Explanation|Diagnosis|Why)\b/) ?? null
  const missed = sections.filter((s) => /^(If you missed|Error type)/.test(s.label))
  const record = get(/^Authoring record$/)
  const missedText = missed.map((s) => `${s.label}. ${plain(s.blocks)}`).join(' ')
  return {
    sections: sections.filter((s) => s.label !== 'Authoring record'),
    answer: answer?.blocks ?? [],
    reasoning: reasoning?.blocks ?? [],
    misconception: plain(get(/^Targeted misconception/)?.blocks ?? []),
    missed: missedText,
    errorTypes: errorTypes(missedText),
    goBack: idsIn(missedText, id),
    authoring: record ? authoring(plain(record.blocks)) : null,
  }
}

/* -------------------------------- stages -------------------------------- */

/** Blocks between two top-level markers, by index. */
const slice = (bs, from, to) => bs.slice(from, to < 0 ? bs.length : to)
const find = (bs, test, from = 0) => {
  for (let i = from; i < bs.length; i++) if (test(bs[i])) return i
  return -1
}
const isHeading = (level, re) => (b) => b.kind === 'heading' && b.level === level && re.test(b.text)

const EXERCISE_HEAD = /^\*\*(\d\.C?\d{1,2}) — (.+?)\*\*$/
const CHECKPOINT_HEAD = /^\*\*(C\d\.\d)\*\* — ?([\s\S]*)$/

/** Groups blocks under `**N.M — Form**` paragraphs. */
function exercisesIn(bs) {
  const out = []
  for (const b of bs) {
    const m = b.kind === 'p' ? EXERCISE_HEAD.exec(b.text) : null
    if (m) out.push({ id: m[1], form: m[2], prompt: [] })
    else if (out.length && b.kind !== 'rule') out[out.length - 1].prompt.push(b)
  }
  return out
}

/** Groups blocks under `**CN.M** — …` paragraphs; the rest of the head
 *  paragraph is the first line of the item. */
function checkpointIn(bs) {
  const out = []
  for (const b of bs) {
    const m = b.kind === 'p' ? CHECKPOINT_HEAD.exec(b.text) : null
    if (m) out.push({ id: m[1], blocks: m[2] ? [{ kind: 'p', text: m[2] }] : [] })
    else if (out.length && b.kind !== 'rule') out[out.length - 1].blocks.push(b)
  }
  return out
}

/** `### N.M — Form` sections of an answer key. */
function keysIn(bs) {
  const out = new Map()
  let id = null
  for (const b of bs) {
    const m = b.kind === 'heading' && b.level === 3 ? /^(\d\.C?\d{1,2}) — /.exec(b.text) : null
    if (m) {
      id = m[1]
      out.set(id, [])
    } else if (b.kind === 'heading' && b.level <= 2) id = null
    else if (id) out.get(id).push(b)
  }
  return out
}

/** `## Heading` sections of the ideas part, each with its `###`s. */
function ideasIn(bs) {
  const out = []
  for (const b of bs) {
    if (b.kind === 'heading' && b.level === 3) out.push({ title: b.text, blocks: [] })
    else if (b.kind === 'rule') continue
    else if (out.length) out[out.length - 1].blocks.push(b)
    else out.push({ title: '', blocks: [b] })
  }
  return out
}

/** Strips the listing's `NN  ` line numbers, leaving the runnable program. */
function unnumber(code) {
  return code
    .split('\n')
    .map((l) => l.replace(/^\s?\d{1,2}(?:\s{2}|$)/, ''))
    .join('\n')
}

export function parseStage(file, md) {
  const bs = blocks(md)
  const n = Number(/stage-0(\d)/.exec(file)[1])
  const title = bs[0].text.replace(/^Stage \d+ — /, '')
  const moveBlock = bs.find((b) => b.kind === 'p' && /^\*\*The one new move:\*\*/.test(b.text))
  const move = moveBlock ? moveBlock.text.replace(/^\*\*The one new move:\*\*\s*/, '') : ''

  const keyAt = find(bs, isHeading(1, /Answer Key$/))
  const front = slice(bs, 0, keyAt)
  const back = slice(bs, keyAt + 1, -1)

  const addsAt = find(front, isHeading(2, /^What this stage adds$|^How to work this stage$/))
  const ideasAt = find(front, isHeading(2, /^The ideas/))
  const exAt = find(front, isHeading(2, /^Exercises$|^Part A/))
  const cpAt = find(front, isHeading(2, /^Checkpoint \d+$/))
  const capAt = find(front, isHeading(2, /^Part B/))

  const adds = slice(front, addsAt + 1, ideasAt >= 0 ? ideasAt : exAt).filter((b) => b.kind !== 'rule')
  const ideas = ideasAt >= 0 ? ideasIn(slice(front, ideasAt + 1, exAt)) : []
  const exEnd = cpAt >= 0 ? cpAt : capAt >= 0 ? capAt : -1
  const raw = exercisesIn(slice(front, exAt + 1, exEnd))

  let capstone = null
  if (capAt >= 0) {
    const part = slice(front, capAt + 1, -1)
    const listingAt = find(part, (b) => b.kind === 'code' && b.lang === 'python')
    const listing = part[listingAt].text
    const firstItem = find(part, (b) => b.kind === 'p' && EXERCISE_HEAD.test(b.text))
    capstone = {
      intro: part.slice(0, listingAt).filter((b) => b.kind !== 'rule'),
      listing,
      program: unnumber(listing).replace(/\n+$/, '') + '\n',
      brief: part.slice(listingAt + 1, firstItem).filter((b) => b.kind !== 'rule'),
    }
    raw.push(...exercisesIn(part.slice(firstItem)))
  }

  const keys = keysIn(back)
  const exercises = raw.map((e) => {
    const kb = keys.get(e.id)
    if (!kb) throw new Error(`${file}: no answer-key entry for ${e.id}`)
    const snippets = snippetsOf(e.prompt)
    return {
      id: e.id,
      stage: n,
      form: e.form,
      kind: formOf(e.form),
      prompt: e.prompt,
      snippets: snippets.length || !capstone || !e.id.includes('C') ? snippets : [{ label: null, code: capstone.program }],
      key: keyOf(e.id, kb),
    }
  })

  let checkpoint = null
  if (cpAt >= 0) {
    const cpEnd = find(front, (b) => b.kind === 'heading' && b.level <= 2, cpAt + 1)
    const part = slice(front, cpAt + 1, cpEnd)
    const introEnd = find(part, (b) => b.kind === 'p' && CHECKPOINT_HEAD.test(b.text))
    const answersAt = find(back, isHeading(2, /^Checkpoint \d+ — Answers$/))
    const answersEnd = find(back, (b) => b.kind === 'heading' && b.level <= 2, answersAt + 1)
    const answers = new Map(checkpointIn(slice(back, answersAt + 1, answersEnd)).map((c) => [c.id, c.blocks]))
    checkpoint = {
      intro: part.slice(0, introEnd).filter((b) => b.kind !== 'rule'),
      items: checkpointIn(part.slice(introEnd)).map((c) => {
        const answer = answers.get(c.id)
        if (!answer) throw new Error(`${file}: no checkpoint answer for ${c.id}`)
        const text = plain(answer)
        return {
          id: c.id,
          stage: n,
          prompt: c.blocks,
          snippets: snippetsOf(c.blocks),
          answer,
          errorTypes: errorTypes(text.slice(text.search(/Error type/i) >= 0 ? text.search(/Error type/i) : 0)),
          goBack: idsIn(text.slice(Math.max(0, text.search(/Go back to/i))), c.id).filter(() => /Go back to/i.test(text)),
        }
      }),
    }
  }

  // The closing section: "Before moving on" or the capstone's summary.
  const afterAt = find(back, isHeading(2, /^Before moving on$|^What you should now be able to do$/))
  const after = afterAt >= 0 ? slice(back, afterAt + 1, find(back, isHeading(2, /./), afterAt + 1)).filter((b) => b.kind !== 'rule') : []

  return { stage: n, file, title, move, adds, ideas, exercises, checkpoint, capstone, after }
}

/* ------------------------------- glossary ------------------------------- */

export function parseGlossary(md) {
  const bs = blocks(md)
  const groups = []
  let group = null
  for (const b of bs) {
    if (b.kind === 'heading' && b.level === 2) {
      group = { title: b.text, terms: [], notes: [] }
      groups.push(group)
    } else if (group && b.kind === 'table') {
      for (const row of b.rows) {
        const term = /\*\*(.+?)\*\*/.exec(row[1])?.[1] ?? row[1]
        group.terms.push({ plain: row[0], term: term.replace(/`/g, ''), formal: row[1], meaning: row[2], firstMet: row[3] })
      }
    } else if (group && b.kind === 'p') group.notes.push(b)
  }
  const intro = bs.slice(1, bs.findIndex((b) => b.kind === 'heading' && b.level === 2)).filter((b) => b.kind === 'p')
  return { intro, groups }
}

/* ---------------------------- misconceptions ---------------------------- */

export const slug = (text) =>
  text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/\*/g, 'times')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function parseMisconceptions(md) {
  const bs = blocks(md)
  const table = bs.find((b) => b.kind === 'table' && /Misconception/.test(b.head[0]))
  return table.rows.map(([text, exercises]) => ({ id: slug(text), text, exercises: idsIn(exercises) }))
}

/* --------------------------------- main --------------------------------- */

/** The README's table of stages: each one's "one new reasoning move", in
 *  a few words — what the map says under a stage's name. */
export function parseSummaries(md) {
  const table = blocks(md).find((b) => b.kind === 'table' && /reasoning move/i.test(b.head.join(' ')))
  const out = new Map()
  for (const row of table?.rows ?? []) {
    const n = Number(row[1])
    if (n) out.set(n, row[2])
  }
  return out
}

export function parseAll() {
  const summaries = parseSummaries(readFileSync(join(DIR, 'README.md'), 'utf8'))
  const stages = readdirSync(DIR)
    .filter((f) => /^stage-0\d-.*\.md$/.test(f))
    .sort()
    .map((f) => parseStage(f, readFileSync(join(DIR, f), 'utf8')))
    .map((st) => ({ ...st, summary: summaries.get(st.stage) ?? st.move }))
  const glossary = parseGlossary(readFileSync(join(DIR, 'glossary.md'), 'utf8'))
  const misconceptions = parseMisconceptions(readFileSync(join(DIR, 'answer-key-conventions.md'), 'utf8'))
  return { stages, glossary, misconceptions }
}

function outputs() {
  const { stages, glossary, misconceptions } = parseAll()
  const files = new Map()
  const json = (v) => JSON.stringify(v, null, 1) + '\n'
  for (const s of stages) files.set(`stage-0${s.stage}.json`, json(s))
  files.set('glossary.json', json(glossary))
  files.set('misconceptions.json', json(misconceptions))
  return files
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = outputs()
  if (process.argv.includes('--check')) {
    let stale = 0
    for (const [name, text] of files) {
      let now = ''
      try {
        now = readFileSync(join(OUT, name), 'utf8')
      } catch {}
      if (now !== text) {
        console.error(`stale: content/collection/generated/${name}`)
        stale++
      }
    }
    if (stale) {
      console.error('run `node scripts/collection.mjs` and commit the result')
      process.exit(1)
    }
  } else {
    mkdirSync(OUT, { recursive: true })
    for (const [name, text] of files) writeFileSync(join(OUT, name), text)
    console.log(`collection: ${files.size} files -> content/collection/generated/`)
  }
}
