import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useArcadeStore } from '../store/arcadeStore'
import { useCampaignStore } from '../store/campaignStore'

interface GameCardProps {
 title: string
 description: string
 available: boolean
 bestScore: number | null
 onClick: () => void
}

function GameCard({ title, description, available, bestScore, onClick }: GameCardProps) {
 return (
 <Card
 sx={{
 height: '100%',
 bgcolor: available ? 'background.paper' : 'action.disabledBackground',
 borderColor: available ? 'divider' : 'transparent',
 borderWidth: 1,
 borderStyle: 'solid',
 }}
 >
 <CardActionArea
 disabled={!available}
 onClick={onClick}
 sx={{ height: '100%', display: 'flex', alignItems: 'flex-start', flexDirection: 'column' }}
 >
 <CardContent sx={{ flex: 1 }}>
 <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
 <Typography variant="h6" sx={{ fontFamily: 'monospace', color: available ? 'text.primary' : 'text.disabled' }}>
 {title}
 </Typography>
 {!available && <Chip label="Coming Soon" size="small" color="default" />}
 </Stack>
 <Typography variant="body2" sx={{ color: available ? 'text.secondary' : 'text.disabled', mb: 2 }}>
 {description}
 </Typography>
 {bestScore !== null && (
 <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'warning.main' }}>
 Best: {bestScore}
 </Typography>
 )}
 </CardContent>
 </CardActionArea>
 </Card>
 )
}

export function ArcadeMenuPage() {
 const getBest = useArcadeStore((s) => s.getBest)
 const totalStars = useCampaignStore((s) => s.getTotalStars())
 const completionPercent = useCampaignStore((s) => s.getCompletionPercent())

 const mazeBest = getBest('maze', 1) ?? getBest('maze', 2) ?? getBest('maze', 3)
 const rhythmBest = getBest('rhythm', 1) ?? getBest('rhythm', 2) ?? getBest('rhythm', 3)
 const defenderBest = getBest('defender', 1) ?? getBest('defender', 2) ?? getBest('defender', 3) ?? getBest('defender', 4) ?? getBest('defender', 5)
 const memoryBest = getBest('memory', 1) ?? getBest('memory', 2) ?? getBest('memory', 3) ?? getBest('memory', 4)
 const snakeBest = getBest('snake', 1) ?? getBest('snake', 2) ?? getBest('snake', 3) ?? getBest('snake', 4)

 const campaignLabel = totalStars > 0 ? 'Continue Campaign' : 'Start Campaign'

 return (
 <Stack sx={{ py: 4, px: 2 }} spacing={4}>
 <Stack spacing={1}>
 <Typography variant="h4" sx={{ fontFamily: 'monospace', color: 'text.primary' }}>
 Arcade
 </Typography>
 <Typography variant="body1" sx={{ color: 'text.secondary' }}>
 Vim-powered mini-games. Use h/j/k/l to move. No mouse required.
 </Typography>
 </Stack>

 {/* Campaign entry card */}
 <Card
 sx={{
 bgcolor: '#292524',
 borderColor: '#d97706',
 borderWidth: 2,
 borderStyle: 'solid',
 }}
 >
 <CardContent>
 <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
 <Stack spacing={0.5}>
 <Typography variant="h6" sx={{ fontFamily: 'monospace', color: '#f59e0b' }}>
 Campaign Mode
 </Typography>
 <Typography variant="body2" sx={{ color: '#a8a29e' }}>
 Structured learning path across all games. Earn stars to unlock new stages.
 </Typography>
 <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
 <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#d97706' }}>
 {totalStars} ★ earned
 </Typography>
 <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#78716c' }}>
 {completionPercent}% complete
 </Typography>
 </Stack>
 </Stack>
 <Button
 variant="contained"
 onClick={() => { window.location.hash = '#/arcade/campaign' }}
 sx={{
 bgcolor: '#d97706',
 color: '#fff',
 fontFamily: 'monospace',
 '&:hover': { bgcolor: '#b45309' },
 whiteSpace: 'nowrap',
 }}
 >
 {campaignLabel}
 </Button>
 </Stack>
 <LinearProgress
 variant="determinate"
 value={completionPercent}
 sx={{
 mt: 2,
 height: 6,
 borderRadius: 3,
 bgcolor: '#1c1917',
 '& .MuiLinearProgress-bar': { bgcolor: '#f59e0b', borderRadius: 3 },
 }}
 />
 </CardContent>
 </Card>

 <Grid container spacing={3}>
 <Grid size={{ xs: 12, sm: 6, md: 4 }}>
 <GameCard
 title="Vim Maze"
 description="Navigate mazes with vim motions. Collect items, open doors by typing their command, reach the goal before par time."
 available
 bestScore={mazeBest}
 onClick={() => { window.location.hash = '#/arcade/maze' }}
 />
 </Grid>
 <Grid size={{ xs: 12, sm: 6, md: 4 }}>
 <GameCard
 title="Vim Rhythm"
 description="Hit h/j/k/l keys when notes reach the line. Build combos for score multipliers in this rhythm-based muscle memory trainer."
 available
 bestScore={rhythmBest}
 onClick={() => { window.location.hash = '#/arcade/rhythm' }}
 />
 </Grid>
 <Grid size={{ xs: 12, sm: 6, md: 4 }}>
 <GameCard
 title="Vim Defender"
 description="Defend your buffer from incoming threats. Type vim commands to destroy enemies before they reach your base."
 available
 bestScore={defenderBest}
 onClick={() => { window.location.hash = '#/arcade/defender' }}
 />
 </Grid>
 <Grid size={{ xs: 12, sm: 6, md: 4 }}>
 <GameCard
 title="Memory Match"
 description="Match vim commands with their effects. Navigate the grid with hjkl and test your vim vocabulary!"
 available
 bestScore={memoryBest}
 onClick={() => { window.location.hash = '#/arcade/memory' }}
 />
 </Grid>
	 <Grid size={{ xs: 12, sm: 6, md: 4 }}>
	 <GameCard
	 title="Vim Snake"
	 description="Guide the snake using vim motions. Eat food to learn vim tips. Avoid walls and your own tail!"
	 available
	 bestScore={snakeBest}
	 onClick={() => { window.location.hash = '#/arcade/snake' }}
	 />
	 </Grid>
	 </Grid>
 </Stack>
 )
}