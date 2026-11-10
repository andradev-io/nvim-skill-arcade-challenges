import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import { lazy, Suspense, useEffect } from 'react'
import { TopBar } from './components/layout/TopBar'
import { useRoute } from './hooks/useRoute'
import type { Route } from './hooks/useRoute'
import { ChallengesPage } from './pages/ChallengesPage'
import { CreatePage } from './pages/CreatePage'
import { HomePage } from './pages/HomePage'
import { SupportPage } from './pages/SupportPage'

// The terminal pulls in the Vim editor (CodeMirror): load it in its own chunk.
const TerminalPage = lazy(() => import('./pages/TerminalPage').then((m) => ({ default: m.TerminalPage })))

const TITLES: Record<Route, string> = {
  home: 'Skill Arcade: train your Neovim with your own keybinds',
  create: 'Create a challenge | Skill Arcade',
  terminal: 'Terminal | Skill Arcade',
  support: 'What works in the terminal | Skill Arcade',
  challenges: 'Published challenges | Skill Arcade',
}

export default function App() {
  const route = useRoute()
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
      </Container>
      <Typography variant="caption" component="footer" sx={{ display: 'block', px: 3, pb: 3, opacity: 0.7 }}>
        Challenges are data only and validated by the same schema the plugin uses. See CONTRIBUTING.md in the repository.
      </Typography>
    </Box>
  )
}
