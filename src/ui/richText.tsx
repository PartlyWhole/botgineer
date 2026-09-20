import { Fragment, type ReactNode } from 'react'

/**
 * Renders the two marks the lesson text actually uses: `backticks` as
 * inline code, and *asterisks* as emphasis.
 *
 * The code one is not cosmetic. The lesson talks about Python constantly —
 * `str`, `True`, `3.5` — and telling a word apart from a piece of code is
 * precisely what a beginner is learning to do. Leaving the marks on screen
 * taught the opposite.
 *
 * Deliberately not a markdown parser: two constructs, no nesting, React
 * elements rather than HTML, and nothing that can inject anything.
 */
const TOKEN = /(`[^`]+`|\*[^*\n]+\*)/g

export function richText(text: string): ReactNode {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      return (
        <code key={i} className="inline">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 1) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
