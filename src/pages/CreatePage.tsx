import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Workspace } from '../components/layout/Workspace'

export function CreatePage() {
  return (
    <Stack sx={{ gap: 2, py: { xs: 2, md: 3 } }}>
      <Stack>
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 24, md: 30 } }}>
          Create a challenge
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: '75ch' }}>
          A challenge is a start buffer and the state it should end in. Any key sequence that gets there wins, so the best
          ones have one clear goal and many routes. Pick an example, edit it, play it, then submit it as a pull request.
        </Typography>
      </Stack>
      <Workspace />
    </Stack>
  )
}
