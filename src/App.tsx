import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import { lazy, Suspense, useEffect } from 'react'
import { loadPublished, trackView } from './analytics/track'
import { useAuthStore } from './auth/authStore'
import { Footer } from './components/layout/Footer'
import { TopBar } from './components/layout/TopBar'
import { useRoute } from './hooks/useRoute'
import type { Route } from './hooks/useRoute'
import { AiPage } from './pages/AiPage'
import { AccountPage } from './pages/AccountPage'
import { AdminPage } from './pages/AdminPage'
import { ChallengesPage } from './pages/ChallengesPage'
import { CreatePage } from './pages/CreatePage'
import { HomePage } from './pages/HomePage'
import { StatsPage } from './pages/StatsPage'
import { SupportPage } from './pages/SupportPage'

// The terminal pulls in the Vim editor (CodeMirror): load it in its own chunk.
const TerminalPage = lazy(() => import('./pages/TerminalPage').then((m) => ({ default: m.TerminalPage })))

const TITLES: Record<Route, string> = {
  home: 'arcade.nvim: train your Neovim with your own keybinds',
  create: 'Create a challenge | arcade.nvim',
  terminal: 'Terminal | arcade.nvim',
  support: 'What works in the terminal | arcade.nvim',
  challenges: 'Published challenges | arcade.nvim',
  ai: 'AI challenges | arcade.nvim',
  account: 'Account | arcade.nvim',
  admin: 'Admin | arcade.nvim',
  stats: 'Stats | arcade.nvim',
}

export default function App() {
  const route = useRoute()
  // finish a sign-in that just came back from Keycloak, or restore this tab's session (does nothing when sign-in is off)
  useEffect(() => {
    void useAuthStore.getState().init()
  }, [])
  // anonymous counts (see analytics/track.ts); the admin's own visits are not counted
  useEffect(() => {
    void loadPublished()
  }, [])
  useEffect(() => {
    if (route !== 'admin') trackView(route)
  }, [route])
  useEffect(() => {
    document.title = TITLES[route]
    if (route !== 'terminal') window.scrollTo({ top: 0 })
  }, [route])

  // the terminal fills the screen under the header; every other page scrolls normally
  if (route === 'terminal') {
    return (
      <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <TopBar fluid />
        <Suspense fallback={null}>
          <TerminalPage />
        </Suspense>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <Container maxWidth={false} sx={{ maxWidth: 1760, pb: 6, flex: 1 }} component="main">
        {route === 'home' && <HomePage />}
        {route === 'create' && <CreatePage />}
        {route === 'support' && <SupportPage />}
        {route === 'challenges' && <ChallengesPage />}
        {route === 'ai' && <AiPage />}
        {route === 'account' && <AccountPage />}
        {route === 'stats' && <StatsPage />}
        {route === 'admin' && <AdminPage />}
      </Container>
      <Footer />
    </Box>
  )
}
