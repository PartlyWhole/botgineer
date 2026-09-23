/**
 * `#/glossary`: plain phrase to formal term.
 *
 * The collection's own glossary, as written. Every term is a label for an
 * idea the player has already practised, and "first met" says where —
 * as a link that opens that exercise. `#/glossary/<term>` opens at one
 * entry, which is where a bold term in the text links to.
 */
import { useEffect } from 'react'
import { GLOSSARY } from '../collection'
import { termSlug } from '../collection/glossaryTerms'
import { Blocks } from '../ui/Blocks'
import { richText } from '../ui/richText'

export function GlossaryScreen({ term }: { term: string | null }) {
  useEffect(() => {
    if (!term) return
    document.getElementById(`term-${term}`)?.scrollIntoView({ block: 'center' })
  }, [term])

  return (
    <main className="map glossary" data-testid="glossary">
      <div className="glossary-column">
        <header className="skills-head">
          <h2>Glossary</h2>
          <Blocks blocks={GLOSSARY.intro} />
        </header>
        {GLOSSARY.groups.map((g) => (
          <section key={g.title} className="glossary-group card">
            <h3>{g.title}</h3>
            {g.terms.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Plain phrase</th>
                      <th>Formal term</th>
                      <th>What it actually means</th>
                      <th>First met</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.terms.map((t) => (
                      <tr
                        key={t.term}
                        id={`term-${termSlug(t.term)}`}
                        className={`glossary-term ${term === termSlug(t.term) ? 'here' : ''}`}
                        data-testid={`term-${termSlug(t.term)}`}
                      >
                        <td>{richText(t.plain)}</td>
                        <td>{richText(t.formal.replace(/\*\*/g, ''))}</td>
                        <td>{richText(t.meaning)}</td>
                        <td>
                          <a href={`#/x-${t.firstMet}`}>{t.firstMet}</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Blocks blocks={g.notes} />
          </section>
        ))}
      </div>
    </main>
  )
}
