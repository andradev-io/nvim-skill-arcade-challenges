import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import LockIcon from '@mui/icons-material/Lock'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { StageProgress } from '../../store/campaignStore'
import type { CampaignStage } from '../../store/campaignStages'

const GAME_COLORS: Record<string, string> = {
  maze: '#22c55e',
  rhythm: '#f59e0b',
  defender: '#ef4444',
  snake: '#8b5cf6',
  memory: '#3b82f6',
}

interface StageNodeProps {
  stage: CampaignStage
  progress: StageProgress | undefined
  onClick: () => void
}

function StarDisplay({ count }: { count: number }) {
  return (
    <Typography
      component="span"
      sx={{ fontFamily: 'monospace', fontSize: 16, color: '#f59e0b', letterSpacing: 2 }}
      aria-label={`${count} of 3 stars`}
    >
      {'★'.repeat(count)}{'☆'.repeat(3 - count)}
    </Typography>
  )
}

export function StageNode({ stage, progress, onClick }: StageNodeProps) {
  const isLocked = !progress || progress.status === 'locked'
  const isCompleted = progress?.status === 'completed'
  const stars = progress?.stars ?? 0
  const gameColor = GAME_COLORS[stage.gameId] ?? '#78716c'

  const card = (
    <Card
      sx={{
        bgcolor: isLocked ? '#1c1917' : '#292524',
        borderColor: isCompleted ? '#d97706' : isLocked ? '#44403c' : '#57534e',
        borderWidth: 1,
        borderStyle: 'solid',
        opacity: isLocked ? 0.6 : 1,
      }}
    >
      <CardActionArea
        disabled={isLocked}
        onClick={onClick}
        sx={{ display: 'flex', alignItems: 'flex-start', flexDirection: 'column' }}
      >
        <CardContent sx={{ width: '100%' }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#a8a29e' }}>
                #{CAMPAIGN_STAGE_NUMBER(stage.id)}
              </Typography>
              <Chip
                label={stage.gameId}
                size="small"
                sx={{
                  height: 20,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  bgcolor: gameColor,
                  color: '#fff',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            </Stack>
            {isLocked && <LockIcon sx={{ fontSize: 16, color: '#78716c' }} />}
            {!isLocked && <StarDisplay count={stars} />}
          </Stack>
          <Typography
            variant="subtitle2"
            sx={{ fontFamily: 'monospace', color: isLocked ? '#78716c' : '#fafaf9', mb: 0.5 }}
          >
            {stage.name}
          </Typography>
          <Typography variant="caption" sx={{ color: isLocked ? '#57534e' : '#a8a29e' }}>
            {stage.description}
          </Typography>
          {isCompleted && progress.bestScore > 0 && (
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 0.5, fontFamily: 'monospace', color: '#d97706' }}
            >
              Best: {progress.bestScore}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  )

  if (isLocked) {
    return (
      <Tooltip title={`Locked: ${stage.unlockCondition.type === 'starTotal' ? `Earn ${stage.unlockCondition.requiredStars}+ stars` : 'Complete previous stage'}`} arrow placement="right">
        <span style={{ display: 'block' }}>{card}</span>
      </Tooltip>
    )
  }

  return card
}

/** Extract a human-readable stage number from the id for display. */
function CAMPAIGN_STAGE_NUMBER(id: string): string {
  // Map known ids to sequential numbers for display
  const KNOWN_IDS = [
    'ch1-maze-l0', 'ch1-maze-l1', 'ch1-rhythm-l0', 'ch1-maze-l2', 'ch1-gate',
    'ch2-rhythm-l1', 'ch2-defender-w1', 'ch2-maze-l3', 'ch2-rhythm-l2', 'ch2-gate',
    'ch3-defender-w3', 'ch3-maze-replay', 'ch3-defender-w5', 'ch3-rhythm-replay', 'ch3-final',
  ]
  const idx = KNOWN_IDS.indexOf(id)
  return idx >= 0 ? String(idx + 1) : '?'
}