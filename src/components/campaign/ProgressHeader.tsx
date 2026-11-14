import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useCampaignStore } from '../../store/campaignStore'

export function ProgressHeader() {
  const totalStars = useCampaignStore((s) => s.getTotalStars())
  const maxStars = useCampaignStore((s) => s.getMaxStars())
  const completionPercent = useCampaignStore((s) => s.getCompletionPercent())

  return (
    <Stack spacing={1} sx={{ mb: 3 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography variant="h5" sx={{ fontFamily: 'monospace', color: '#d97706' }}>
          Campaign Progress
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#78716c' }}>
          {totalStars} / {maxStars} ★ ({completionPercent}%)
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={completionPercent}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: '#292524',
          '& .MuiLinearProgress-bar': {
            bgcolor: '#f59e0b',
            borderRadius: 4,
          },
        }}
      />
    </Stack>
  )
}