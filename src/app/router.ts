/**
 * Hash routing over the activity list.
 *
 * GitHub Pages applies no rewrite rules, so a path route would 404 on
 * refresh. A hash route always requests the existing index.html, which
 * makes deep links and reloads work with no server configuration.
 */
import { useEffect, useState } from 'react'
import { ACTIVITIES, activityById, type Activity } from '../../content/activities'

const FALLBACK = ACTIVITIES[0] as Activity

function read(): Activity {
  const id = window.location.hash.replace(/^#\/?/, '')
  return activityById(id) ?? FALLBACK
}

export function useActivity(): [Activity, (next: Activity) => void] {
  const [activity, setActivity] = useState<Activity>(read)
  useEffect(() => {
    const onHash = () => setActivity(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return [
    activity,
    (next) => {
      window.location.hash = `#/${next.id}`
    },
  ]
}
