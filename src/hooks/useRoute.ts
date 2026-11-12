import { useSyncExternalStore } from 'react'

export type Route = 'home' | 'create' | 'terminal' | 'support' | 'challenges' | 'ai' | 'stats' | 'account' | 'admin' | 'arcade'

/** `hidden` routes exist but have no button in the nav bar (the Account page has its own button). */
export const ROUTES: { id: Route; label: string; hash: string; hidden?: boolean }[] = [
  { id: 'home', label: 'Home', hash: '#/' },
  { id: 'create', label: 'Create', hash: '#/create' },
  { id: 'terminal', label: 'Terminal', hash: '#/terminal' },
  { id: 'support', label: 'Support', hash: '#/support' },
  { id: 'challenges', label: 'Challenges', hash: '#/challenges' },
  { id: 'ai', label: 'AI challenges', hash: '#/ai' },
  { id: 'account', label: 'Account', hash: '#/account', hidden: true },
  { id: 'stats', label: 'Stats', hash: '#/stats' },
  { id: 'arcade', label: 'Arcade', hash: '#/arcade' },
  // listed in the nav only for an admin (see TopBar)
  { id: 'admin', label: 'Admin', hash: '#/admin', hidden: true },
]

/** Hash routes work on any static host (GitHub Pages included): no server rewrite needed. */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split(/[?/]/)[0]
  return ROUTES.find((r) => r.id === path)?.id ?? 'home'
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseRoute(window.location.hash), () => 'home')
}

export function navigate(route: Route) {
  const hash = ROUTES.find((r) => r.id === route)?.hash ?? '#/'
  if (window.location.hash !== hash) window.location.hash = hash
  else window.scrollTo({ top: 0 })
}
