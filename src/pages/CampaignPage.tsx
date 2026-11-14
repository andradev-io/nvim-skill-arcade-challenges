import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useCallback } from 'react'
import { ProgressHeader } from '../components/campaign/ProgressHeader'
import { StageMap } from '../components/campaign/StageMap'
import { CAMPAIGN_STAGES } from '../store/campaignStages'
import { useCampaignStore } from '../store/campaignStore'
import { navigate } from '../hooks/useRoute'

export function CampaignPage() {
  const isUnlocked = useCampaignStore((s) => s.isUnlocked)

  const handleStageClick = useCallback(
    (stageId: string) => {
      if (!isUnlocked(stageId)) return
      const stage = CAMPAIGN_STAGES.find((s) => s.id === stageId)
      if (!stage) return

      // Navigate to the game with campaign param
      const gameRoute = `arcade/${stage.gameId}` as const
      window.location.hash = `#/${gameRoute}?campaign=${encodeURIComponent(stageId)}&level=${stage.levelIndex}`
    },
    [isUnlocked],
  )

  const handleBack = () => {
    navigate('arcade')
  }

  return (
    <Stack sx={{ py: 4, px: 2, maxWidth: 720, mx: 'auto' }} spacing={3}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" sx={{ fontFamily: 'monospace', color: '#d97706' }}>
          Campaign
        </Typography>
        <Button variant="outlined" size="small" onClick={handleBack} sx={{ borderColor: '#57534e', color: '#a8a29e' }}>
          Back to Arcade
        </Button>
      </Stack>

      <ProgressHeader />
      <StageMap onStageClick={handleStageClick} />
    </Stack>
  )
}