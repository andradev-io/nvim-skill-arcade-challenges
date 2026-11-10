import Box from '@mui/material/Box'
import { PublishedList } from '../components/published/PublishedList'

export function ChallengesPage() {
  return (
    <Box sx={{ py: { xs: 2, md: 3 } }}>
      <PublishedList />
    </Box>
  )
}
