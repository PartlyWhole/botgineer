import { Fragment, type ReactNode } from 'react'
import { glossaryAnchor } from '../collection/glossaryTerms'

/**
 * Renders the marks the lesson and collection text actually use:
 * `backticks` as inline code, **double asterisks** as strong, and
 * *asterisks* as emphasis. A strong word that is one of the glossary's
 * formal terms links to its entry — the collection bolds a term where it
 * first names it, which is exactly where a reader wants the definition.
 *
 * The code one is not cosmetic. The text talks about Python constantly —
 * `str`, `True`, `3.5` — and telling a word apart from a piece of code is
 * precisely what a beginner is learning to do. Leaving the marks on screen
 * taught the opposite.
 *
 * Deliberately not a markdown parser: three constructs, no nesting, React
 * elements rather than HTML, and nothing that can inject anything.
 *
 * A code span is atomic, inside emphasis too: `**line 2, `[[0] * cols]`.**`
 * is one strong run holding one piece of code, and the `*` in the code is
 * Python, not a mark. (Matching `[^*]` there let the single-asterisk rule
 * eat the code instead, and 9.C5's key came out garbled.)
 */
// Inside emphasis, a backtick only ever starts a code span: the plain
// character classes leave it out, so the two alternatives never overlap.
// When they did, a stray `*` before a row of code spans backtracked
// exponentially (16 spans: 92ms, and doubling).
const TOKEN = /(`[^`]+`|\*\*(?:`[^`]*`|[^*`])+?\*\*|\*(?:`[^`]*`|[^*`\n])+?\*)/g

// Punctuation that closes what comes before it, so it must never start a
// line: `.` after a chip wrapped onto a line of its own ("points at the
// `10`" / "."). It is kept with the chip in one span that does not wrap.
const TRAILING = /^[.,:;!?)\]}\u2026'"\u2019\u201d]+/

const isCode = (part: string) => part.startsWith('`') && part.endsWith('`') && part.length > 1

export function richText(text: string): ReactNode {
  const parts = text.split(TOKEN)
  return parts.map((part, i) => {
    if (isCode(part)) {
      const chip = (
        <code key={i} className="inline">
          {part.slice(1, -1)}
        </code>
      )
      // `split` with a capturing group alternates plain text and tokens,
      // so what follows a token is always plain text (perhaps empty).
      const tail = parts[i + 1]?.match(TRAILING)?.[0]
      if (!tail) return chip
      parts[i + 1] = parts[i + 1]!.slice(tail.length)
      return (
        <span key={i} className="glued">
          <code className="inline">{part.slice(1, -1)}</code>
          {tail}
        </span>
      )
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      const inner = part.slice(2, -2)
      const anchor = glossaryAnchor(inner)
      return anchor ? (
        <a key={i} className="term" href={`#/glossary/${anchor}`} title="In the glossary">
          <strong>{richText(inner)}</strong>
        </a>
      ) : (
        <strong key={i}>{richText(inner)}</strong>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 1) {
      return <em key={i}>{richText(part.slice(1, -1))}</em>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
