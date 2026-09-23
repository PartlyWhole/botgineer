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
 */
const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*)/g

export function richText(text: string): ReactNode {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      return (
        <code key={i} className="inline">
          {part.slice(1, -1)}
        </code>
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
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
