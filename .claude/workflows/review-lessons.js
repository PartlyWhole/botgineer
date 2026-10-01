export const meta = {
  name: 'review-lessons',
  description: 'Story-and-sense review of a unit of lessons: two text reviewers, a picture checker per lesson, one merge, batched verification',
  whenToUse: 'After scripts/review-prep.ts has written a folder of lesson scripts and storyboards. Args: { dir, lessons: [ids in play order] }. See docs/LESSON-REVIEW.md.',
  phases: [
    { title: 'Review', detail: 'story reader and teacher over the whole unit; a picture checker per lesson' },
    { title: 'Merge', detail: 'one agent clusters duplicate findings' },
    { title: 'Verify', detail: 'batches of up to 6 clusters, one lesson per batch, each argued away' },
  ],
}

/*
 * Why this shape (docs/LESSON-REVIEW-COST.md): an agent's floor is about
 * 55k tokens before it reads anything, so cost is mostly agent count. The
 * text lenses read a whole unit at once (continuity is better for it), the
 * picture checker stays per lesson (screenshots are the heavy input), and
 * verification is batched rather than one agent per finding.
 */

const DIR = args && args.dir
const LESSONS = (args && args.lessons) || []
if (!DIR || LESSONS.length === 0) throw new Error('args: { dir, lessons: [...] } — run scripts/review-prep.ts first')

const GUIDE = '/Users/alan/BotGineer/docs/LESSON-REVIEW.md'
const scriptOf = (id) => `${DIR}/${id}.md`
const boardOf = (id) => `${DIR}/${id}-board/`
const sourceOf = (id) => {
  const file = { 'v2-if': 'ifs' }[id] || (id.startsWith('v2-') ? id.slice(3) : id)
  return id.startsWith('v2-') ? `/Users/alan/BotGineer/content/lessons/v2/${file}.ts` : `/Users/alan/BotGineer/content/lessons/${file}.ts`
}
const unit = LESSONS.map((id, i) => `${i + 1}. \`${id}\` — script ${scriptOf(id)}, source ${sourceOf(id)}`).join('\n')

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lesson: { type: 'string', description: 'the lesson id' },
          where: { type: 'string', description: 'step and beat, and the storyboard shot if one shows it' },
          quote: { type: 'string', description: 'the exact words' },
          check: { type: 'string', description: 'S1–S8 or R1–R12' },
          problem: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          fix: { type: 'string' },
        },
        required: ['lesson', 'where', 'quote', 'check', 'problem', 'severity', 'fix'],
      },
    },
  },
  required: ['findings'],
}

const CLUSTERS = {
  type: 'object',
  properties: {
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'C1, C2, …' },
          lesson: { type: 'string', description: 'the lesson most concerned (one id)' },
          title: { type: 'string' },
          members: { type: 'array', items: { type: 'string' }, description: 'the finding ids merged here' },
          quote: { type: 'string' },
          problem: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          fix: { type: 'string' },
        },
        required: ['id', 'lesson', 'title', 'members', 'quote', 'problem', 'severity', 'fix'],
      },
    },
  },
  required: ['clusters'],
}

const VERDICTS = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cluster: { type: 'string' },
          verdict: { type: 'string', enum: ['keep', 'keep-with-changes', 'drop'] },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          reason: { type: 'string', description: 'two or three sentences, with the evidence (file:line or shot name)' },
          fix: { type: 'string', description: 'the fix you would actually make, or "none"' },
        },
        required: ['cluster', 'verdict', 'severity', 'reason', 'fix'],
      },
    },
  },
  required: ['verdicts'],
}

const COMMON = `Read ${GUIDE} first: it defines the rubric (S1–S8, on top of docs/PEDAGOGY.md's R1–R12), the reviewers and what a finding must have. Do not edit any files. Every finding needs an exact quote; taste is not a finding unless it costs the learner something. Be honest rather than exhaustive: none is a fine answer.`

phase('Review')
const reviewers = [
  {
    lens: 'story',
    prompt: `You review lessons of BotGineer, a Python learning game for ~10-year-olds (often gamers), as **the skeptical kid and the continuity editor together** (S1, S4, S5, S8). ${COMMON}

The lessons, in play order (read every script in full, in order):
${unit}

As the kid: read only what is said and shown, as a 10-year-old who has never programmed. Ignore whether the Python is right. Flag what sounds made up, pointless, confusing, babyish or boring — a rule no world would have, a character with no reason, a "so what?".
As the continuity editor: names, items, values, who has what, the cast and the world must agree from step to step and lesson to lesson; each lesson must pick up where the one before left off. For the first lesson listed, compare with the lesson before it in content/roadmap.ts (read its source, not a script).`,
  },
  {
    lens: 'teacher',
    prompt: `You review lessons of BotGineer, a Python learning game for ~10-year-olds, as **the teacher and the Python expert together** (R1–R12, S2, S6, and R8 especially). ${COMMON}

The lessons, in play order (read every script in full, and each source file's header comment, which says what the lesson means to do):
${unit}

As the teacher: does each example need its idea, rather than a simpler one? Is anything asked before it is shown or named? Does each step build on the one before? Is anything taught and never used, or used and never taught — across the lessons as well as within? Do the replies to mistakes teach, and is their advice right?
As the Python expert: could an expert object to any sentence, reply or takeaway? Is anything simplified so far that it will have to be unlearned? (The robot's "thought" is the game's model of a bare expression at the console: CLAUDE.md invariant 8.)`,
  },
  ...LESSONS.map((id) => ({
    lens: `pictures:${id}`,
    prompt: `You review one lesson of BotGineer, a Python learning game for ~10-year-olds, as **the picture checker** (S3, S7). ${COMMON}

The lesson: \`${id}\`. Its storyboard: ${boardOf(id)} — index.md lists each shot beside the line being said; open every PNG it lists with the Read tool (a "-stage" shot is the stage alone, because nothing else changed; "(same screen as …)" lines were not shot again). The script, for what each beat means to show: ${scriptOf(id)}. The screen has two panels: the Scene (cast, speech bubbles, the robot's thought cloud, pictures, Next/Back, multiple-choice options) and the Robot (the console or code editor on top, the robot's memory below).

Walk shot by shot: is everything a line mentions on screen when it is said? Does what is shown agree with what is said? Does a picture give the answer away? Does anything overlap, get cut off, or read too small? A shot is taken after the line settles (and a "-typing" shot early in the first typed line), so a timing doubt is a question for the verifier, not a finding — say so in the problem if you raise one.`,
  })),
]

const reviewed = await parallel(
  reviewers.map((r) => () => agent(r.prompt, { label: `review:${r.lens}`, phase: 'Review', schema: FINDINGS }).then((x) => ({ lens: r.lens, findings: (x && x.findings) || [] }))),
)
const findings = reviewed
  .filter(Boolean)
  .flatMap((r) => r.findings.map((f, i) => ({ ...f, id: `${r.lens}-${i + 1}` })))
log(`${findings.length} findings from ${reviewers.length} reviewers`)
if (findings.length === 0) return { findings: [], kept: [], dropped: [] }

// A barrier on purpose: merging needs every finding at once.
phase('Merge')
const merged = await agent(
  `Merge these lesson-review findings into clusters: one cluster per distinct problem, findings that say the same thing (even from different reviewers, or about the same line from different angles) together. Keep each cluster to one lesson where you can (the lesson most concerned). Take the clearest quote, the highest severity among its members, and the best fix (or a combined one). Do not judge whether they are right; that is the next step. Do not read any files.

${JSON.stringify(findings, null, 1)}`,
  { label: 'merge', phase: 'Merge', schema: CLUSTERS, effort: 'low' },
)
const clusters = (merged && merged.clusters) || []
log(`${clusters.length} clusters`)

// Batches: one lesson each, at most 6 clusters, so no verifier judges two
// lessons' findings, or more than it can argue against properly.
const batches = []
for (const id of [...new Set(clusters.map((c) => c.lesson))]) {
  const mine = clusters.filter((c) => c.lesson === id)
  for (let i = 0; i < mine.length; i += 6) batches.push({ lesson: id, clusters: mine.slice(i, i + 6) })
}

phase('Verify')
const judged = await parallel(
  batches.map((b, n) => () =>
    agent(
      `You verify review findings about \`${b.lesson}\`, a lesson of BotGineer, a Python learning game for ~10-year-olds. Read the "Verifying" section of ${GUIDE}. For EACH cluster below, try to ARGUE IT AWAY: is it a real problem for a learner; do the script (${scriptOf(b.lesson)}), the storyboard (${boardOf(b.lesson)}, index.md) and the source (${sourceOf(b.lesson)}) actually say what it claims; is the fix right and true to Python? Check every claim against the files yourself. A doubt about timing or animation can be settled in the live page: the dev server is at http://localhost:5173/#/${b.lesson}; write a short Playwright script in ${DIR} (import { chromium } from '/Users/alan/BotGineer/node_modules/playwright/index.mjs'; wait for '.app[data-boot="ready"]'; window.botgineer.next() advances a beat, .beat() reports it) and look at your screenshots. Judge each cluster on its own. Do not edit any project files.

${JSON.stringify(b.clusters, null, 1)}`,
      { label: `verify:${b.lesson}#${n + 1}`, phase: 'Verify', schema: VERDICTS },
    ),
  ),
)
const verdicts = judged.filter(Boolean).flatMap((v) => v.verdicts)
const rank = { high: 0, medium: 1, low: 2 }
const joined = clusters.map((c) => ({ ...c, ...(verdicts.find((v) => v.cluster === c.id) || { verdict: 'unverified', reason: 'no verdict returned' }) }))
const kept = joined.filter((c) => c.verdict !== 'drop' && c.verdict !== 'unverified').sort((a, b) => rank[a.severity] - rank[b.severity])
const dropped = joined.filter((c) => c.verdict === 'drop')
const unverified = joined.filter((c) => c.verdict === 'unverified')
if (unverified.length) log(`${unverified.length} clusters came back without a verdict`)
log(`${kept.length} kept, ${dropped.length} dropped`)
return { lessons: LESSONS, agents: reviewers.length + 1 + batches.length, findings: findings.length, kept, dropped, unverified }
