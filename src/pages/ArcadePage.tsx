import { useEffect, useState } from 'react'
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

export function ArcadePage() {
  const [subRoute, setSubRoute] = useState<ArcadeSubRoute>(() =>
    parseArcadeSubRoute(window.location.hash),
  )

  useEffect(() => {
    const onHashChange = () => {
      setSubRoute(parseArcadeSubRoute(window.location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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