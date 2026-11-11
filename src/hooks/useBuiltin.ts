import { useEffect, useState } from 'react'

export type BuiltinChallenge = {
  id: string
  title: string
  area: string
  level: number
  ft: string
  text: string
  cursor: [number, number]
  brief: string
}

/** The plugin's plain-text built-in challenges (exported at deploy time). Empty while loading or when unavailable. */
export function useBuiltin(): BuiltinChallenge[] {
  const [items, setItems] = useState<BuiltinChallenge[]>([])
  useEffect(() => {
    let live = true
    fetch(`${import.meta.env.BASE_URL}builtin.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { challenges?: BuiltinChallenge[] } | null) => live && Array.isArray(d?.challenges) && setItems(d.challenges))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  return items
}
