/**
 * The seed a page's lessons are drawn with: \`?seed=\` when the URL gives one
 * (journeys, and a reviewer reproducing a question), else one random draw
 * for the whole page. One draw, not one per lesson, so a shared room can
 * hand the page's seed to whoever joins (\`collab/\`) and they get the same
 * questions (\`lessonFor\`).
 */
let drawn: number | null = null

export function pageSeed(): number {
  if (drawn !== null) return drawn
  if (typeof location === 'undefined') return (drawn = 1)
  const given = Number(new URLSearchParams(location.search).get('seed'))
  drawn = Number.isFinite(given) && given > 0 ? given : Math.floor(Math.random() * 1e9) + 1
  return drawn
}
