/**
 * The glossary's formal terms, for linking a bold word to its entry.
 * Read straight from the generated JSON so that rendering text does not
 * have to load the whole collection.
 */
import glossary from '../../content/collection/generated/glossary.json'

const norm = (t: string) => t.toLowerCase().replace(/[`*]/g, '').replace(/^(a|an|the)\s+/, '').trim()

export const termSlug = (t: string) => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const TERMS = new Map<string, string>()
for (const g of glossary.groups) {
  for (const t of g.terms) {
    TERMS.set(norm(t.term), termSlug(t.term))
    // Plurals and simple inflections: "parameters", "rebinding".
    TERMS.set(norm(t.term) + 's', termSlug(t.term))
  }
}

/** The glossary anchor for a word, when it is a formal term. */
export const glossaryAnchor = (word: string): string | null => TERMS.get(norm(word)) ?? null
