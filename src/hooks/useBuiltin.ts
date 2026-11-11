import { useEffect, useState } from 'react'
import type { BuiltinChallenge } from '../core/builtin'

export type { BuiltinChallenge } from '../core/builtin'

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
