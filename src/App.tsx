import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import { Hero } from './components/layout/Hero'
import { TopBar } from './components/layout/TopBar'
import { Workspace } from './components/layout/Workspace'
import { PublishedList } from './components/published/PublishedList'

export default function App() {
  return (
    <Container maxWidth={false} sx={{ maxWidth: 1180, pb: 6 }}>
      <TopBar />
      <Hero />
      <Workspace />
      <PublishedList />
      <Typography variant="caption" component="footer" sx={{ display: 'block', mt: 6, opacity: 0.7 }}>
        Challenges are data only and validated by the same schema the plugin uses. See CONTRIBUTING.md in the repository.
      </Typography>
    </Container>
  )
}
