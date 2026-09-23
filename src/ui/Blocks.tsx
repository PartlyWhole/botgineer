/**
 * The collection's prose, drawn: paragraphs, code, tables, lists, quotes.
 *
 * The blocks come from `scripts/collection.mjs`, which is as small a
 * markdown reader as the content allows; this is as small a renderer.
 * Python code is shown in the same view the exercises use, so an example
 * in the ideas looks like the snippet it prepares you for.
 */
import type { ReactNode } from 'react'
import type { Block } from '../collection/model'
import { CodeView } from './CodeView'
import { richText } from './richText'

export function Blocks({ blocks, code }: { blocks: Block[]; code?: (text: string, i: number) => ReactNode }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'p':
            return <p key={i}>{richText(b.text)}</p>
          case 'quote':
            return <blockquote key={i}>{richText(b.text)}</blockquote>
          case 'heading':
            return b.level <= 3 ? <h4 key={i}>{richText(b.text)}</h4> : <h5 key={i}>{richText(b.text)}</h5>
          case 'rule':
            return null
          case 'list': {
            const items = b.items.map((t, k) => <li key={k}>{richText(t)}</li>)
            return b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>
          }
          case 'table':
            return (
              <div key={i} className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {b.head.map((h, k) => (
                        <th key={k}>{richText(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, k) => (
                      <tr key={k}>
                        {r.map((c, j) => (
                          <td key={j}>{richText(c)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'code':
            if (b.lang === 'python') {
              return (
                <div key={i} className="block-code">
                  <CodeView code={b.text} />
                  {code?.(b.text, i)}
                </div>
              )
            }
            return (
              <pre key={i} className="block-text">
                <code>{b.text}</code>
              </pre>
            )
        }
      })}
    </>
  )
}
