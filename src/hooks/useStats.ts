import { useEffect, useState } from 'react'

export type PluginStats = { builtin: number; areas: Record<string, number>; levels: Record<string, number> }

/** Counts of the plugin's built-in challenges, written at deploy time. null while loading or when unavailable. */
export function useStats(): PluginStats | null {
  const [stats, setStats] = useState<PluginStats | null>(null)
  useEffect(() => {
    let live = true
    fetch(`${import.meta.env.BASE_URL}stats.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PluginStats | null) => live && d && typeof d.builtin === 'number' && setStats(d))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  return stats
}
