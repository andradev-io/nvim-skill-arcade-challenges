import { useEffect, useState } from 'react'
import { ArcadeMenuPage } from '../games/ArcadeMenuPage'
import { MazePage } from '../games/maze/MazePage'

type ArcadeSubRoute = 'menu' | 'maze'

function parseArcadeSubRoute(hash: string): ArcadeSubRoute {
  const path = hash.replace(/^#\/?/, '')
  if (path === 'arcade/maze') return 'maze'
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

  return <ArcadeMenuPage />
}