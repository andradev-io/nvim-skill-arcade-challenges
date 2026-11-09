import { useEffect, useState } from 'react'
import type { Challenge } from '../core/types'

export type Published = Pick<Challenge, 'id' | 'title' | 'area' | 'level' | 'author'>

export type CommunityState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: Published[] }

/** Fetches the published bundle once. Fails soft: the page works without it. */
export function useCommunity(): CommunityState {
  const [state, setState] = useState<CommunityState>({ status: 'loading' })
  useEffect(() => {
    let live = true
    fetch(`${import.meta.env.BASE_URL}community.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : { challenges: [] }))
      .then((d: { challenges?: Published[] }) => live && setState({ status: 'ready', items: d.challenges ?? [] }))
      .catch(() => live && setState({ status: 'error' }))
    return () => {
      live = false
    }
  }, [])
  return state
}
