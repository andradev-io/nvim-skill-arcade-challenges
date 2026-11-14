import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { CAMPAIGN_STAGES } from '../../store/campaignStages'
import { useCampaignStore } from '../../store/campaignStore'
import { ChapterHeading } from './ChapterHeading'
import { StageNode } from './StageNode'

interface StageMapProps {
  onStageClick: (stageId: string) => void
}

const CHAPTER_NAMES: Record<number, string> = {
  1: 'Foundations',
  2: 'Building Speed',
  3: 'Mastery',
}

export function StageMap({ onStageClick }: StageMapProps) {
  const progress = useCampaignStore((s) => s.progress)

  const chapters = new Map<number, typeof CAMPAIGN_STAGES>()
  for (const stage of CAMPAIGN_STAGES) {
    const list = chapters.get(stage.chapter) ?? []
    list.push(stage)
    chapters.set(stage.chapter, list)
  }

  return (
    <Stack spacing={0}>
      {Array.from(chapters.entries()).map(([chapter, stages], chapterIdx) => (
        <Box key={chapter}>
          <ChapterHeading chapter={chapter} title={CHAPTER_NAMES[chapter] ?? ''} />
          <Stack spacing={1.5} sx={{ pl: 2, borderLeft: '2px solid #44403c', ml: 1 }}>
            {stages.map((stage, stageIdx) => (
              <Box key={stage.id}>
                <StageNode
                  stage={stage}
                  progress={progress[stage.id]}
                  onClick={() => onStageClick(stage.id)}
                />
                {stageIdx < stages.length - 1 && (
                  <Box
                    sx={{
                      height: 12,
                      width: 2,
                      bgcolor: '#44403c',
                      ml: 3,
                    }}
                  />
                )}
              </Box>
            ))}
          </Stack>
          {chapterIdx < chapters.size - 1 && (
            <Box sx={{ height: 24 }} />
          )}
        </Box>
      ))}
    </Stack>
  )
}