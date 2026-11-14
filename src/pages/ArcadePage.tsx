import { useSyncExternalStore } from 'react'
import { ArcadeMenuPage } from '../games/ArcadeMenuPage'
import { MazePage } from '../games/maze/MazePage'
import { DefenderPage } from '../games/defender/DefenderPage'
import { RhythmPage } from '../games/rhythm/RhythmPage'
import { MemoryPage } from '../games/memory/MemoryPage'
import { SnakePage } from '../games/snake/SnakePage'
import { CampaignPage } from './CampaignPage'

type ArcadeSubRoute = 'menu' | 'maze' | 'defender' | 'rhythm' | 'memory' | 'snake' | 'campaign'

function parseArcadeSubRoute(hash: string): ArcadeSubRoute {
  const path = hash.replace(/^#\/?/, '').split('?')[0]
  if (path === 'arcade/maze') return 'maze'
  if (path === 'arcade/defender') return 'defender'
  if (path === 'arcade/rhythm') return 'rhythm'
  if (path === 'arcade/memory') return 'memory'
  if (path === 'arcade/snake') return 'snake'
  if (path === 'arcade/campaign') return 'campaign'
  return 'menu'
}

/** Extract query params from the hash portion of the URL. */
export function parseArcadeQueryParams(hash: string): Record<string, string> {
  const qIdx = hash.indexOf('?')
  if (qIdx < 0) return {}
  const qs = hash.slice(qIdx + 1)
  const params: Record<string, string> = {}
  for (const pair of qs.split('&')) {
    const [key, val] = pair.split('=')
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(val ?? '')
  }
  return params
}

const subscribeArcade = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

function useArcadeSubRoute(): ArcadeSubRoute {
  return useSyncExternalStore(
    subscribeArcade,
    () => parseArcadeSubRoute(window.location.hash),
    () => 'menu',
  )
}

export function ArcadePage() {
  const subRoute = useArcadeSubRoute()

  if (subRoute === 'campaign') {
    return <CampaignPage />
  }

  if (subRoute === 'maze') {
    return <MazePage />
  }

  if (subRoute === 'defender') {
    return <DefenderPage />
  }

  if (subRoute === 'rhythm') {
    return <RhythmPage />
  }

  if (subRoute === 'memory') {
    return <MemoryPage />
  }

  if (subRoute === 'snake') {
    return <SnakePage />
  }

  return <ArcadeMenuPage />
}