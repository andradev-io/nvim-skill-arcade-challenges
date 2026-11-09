import { lazy, Suspense } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { DraftForm } from './components/draft/DraftForm'
import { ResultPanel } from './components/draft/ResultPanel'
import { TopBar } from './components/layout/TopBar'
import { JoinBox } from './components/join/JoinBox'
import { PublishedList } from './components/published/PublishedList'
import { SimCheck } from './components/sim/SimCheck'

// The Vim editor (CodeMirror) is the heaviest part: load it in its own chunk.
const PlayPanel = lazy(() => import('./components/play/PlayPanel').then((m) => ({ default: m.PlayPanel })))

export default function App() {
  return (
    <Container maxWidth={false} sx={{ maxWidth: 1120, pb: 5 }}>
      <TopBar />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 2, alignItems: 'start', mt: 2 }}>
        <DraftForm />
        <Stack spacing={2}>
          <ResultPanel />
          <Suspense fallback={null}>
            <PlayPanel />
          </Suspense>
          <JoinBox />
          <SimCheck />
          <PublishedList />
        </Stack>
      </Box>
      <Typography variant="caption" component="footer" sx={{ display: 'block', mt: 4, opacity: 0.7 }}>
        Challenges are data only and validated by the same schema the plugin uses. See CONTRIBUTING.md in the repository.
      </Typography>
    </Container>
  )
}
