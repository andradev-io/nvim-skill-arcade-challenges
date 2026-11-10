import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { EXAMPLES } from '../../examples'
import { useDraftStore } from '../../store/draftStore'

/** One-click prefilled drafts, so nobody has to start from an empty form. */
export function ExamplePicker() {
  const loadChallenge = useDraftStore((s) => s.loadChallenge)
  const reset = useDraftStore((s) => s.reset)
  const id = useDraftStore((s) => s.form.id)
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
        Start from an example
      </Typography>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
        {EXAMPLES.map((ex) => (
          <Tooltip key={ex.challenge.id} title={ex.note}>
            <Chip
              clickable
              label={ex.label}
              color={ex.challenge.id === id ? 'primary' : 'default'}
              variant={ex.challenge.id === id ? 'filled' : 'outlined'}
              onClick={() => loadChallenge(ex.challenge)}
            />
          </Tooltip>
        ))}
        <Chip clickable variant="outlined" label="Blank" onClick={reset} />
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Loading an example replaces the form. Edit anything: Play, Check and the other tabs follow as you type.
      </Typography>
    </Paper>
  )
}
