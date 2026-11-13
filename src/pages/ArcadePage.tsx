import { useSyncExternalStore } from 'react'
import { ArcadeMenuPage } from '../games/ArcadeMenuPage'
import { MazePage } from '../games/maze/MazePage'
import { DefenderPage } from '../games/defender/DefenderPage'
import { RhythmPage } from '../games/rhythm/RhythmPage'

type ArcadeSubRoute = 'menu' | 'maze' | 'defender' | 'rhythm'

function parseArcadeSubRoute(hash: string): ArcadeSubRoute {
  const path = hash.replace(/^#\/?/, '')
  if (path === 'arcade/maze') return 'maze'
  if (path === 'arcade/defender') return 'defender'
  if (path === 'arcade/rhythm') return 'rhythm'
  return 'menu'
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

  if (subRoute === 'maze') {
    return <MazePage />
  }

  if (subRoute === 'defender') {
    return <DefenderPage />
  }

  if (subRoute === 'rhythm') {
    return <RhythmPage />
  }

  return <ArcadeMenuPage />
}