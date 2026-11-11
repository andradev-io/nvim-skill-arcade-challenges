import { useEffect, useState } from 'react'
import type { Challenge } from '../core/types'

export type CommunityState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: Challenge[]; ai: Challenge[] }

/** Fetches the published bundle once: `items` are the community challenges, `ai` the model-written ones. Fails soft: the page works without it. */
export function useCommunity(): CommunityState {
  const [state, setState] = useState<CommunityState>({ status: 'loading' })
  useEffect(() => {
    let live = true
    fetch(`${import.meta.env.BASE_URL}community.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : { challenges: [], ai: [] }))
      .then((d: { challenges?: Challenge[]; ai?: Challenge[] }) => live && setState({ status: 'ready', items: d.challenges ?? [], ai: d.ai ?? [] }))
      .catch(() => live && setState({ status: 'error' }))
    return () => {
      live = false
    }
  }, [])
  return state
}
