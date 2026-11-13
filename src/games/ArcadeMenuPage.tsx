import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import { useArcadeStore } from '../store/arcadeStore'
import { navigate } from '../hooks/useRoute'

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

 const mazeBest = getBest('maze', 1) ?? getBest('maze', 2) ?? getBest('maze', 3)
 const rhythmBest = getBest('rhythm', 1) ?? getBest('rhythm', 2) ?? getBest('rhythm', 3)
 const defenderBest = getBest('defender', 1) ?? getBest('defender', 2) ?? getBest('defender', 3) ?? getBest('defender', 4) ?? getBest('defender', 5)

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

 <Grid container spacing={3}>
 <Grid size={{ xs: 12, sm: 6, md: 4 }}>
 <GameCard
 title="Vim Maze"
 description="Navigate mazes with vim motions. Collect items, open doors by typing their command, reach the goal before par time."
 available
 bestScore={mazeBest}
 onClick={() => navigate('arcade')}
 />
 </Grid>
 <Grid size={{ xs: 12, sm: 6, md: 4 }}>
 <GameCard
 title="Vim Rhythm"
 description="Hit h/j/k/l keys when notes reach the line. Build combos for score multipliers in this rhythm-based muscle memory trainer."
 available
 bestScore={rhythmBest}
 onClick={() => navigate('arcade')}
 />
 </Grid>
 <Grid size={{ xs: 12, sm: 6, md: 4 }}>
 <GameCard
 title="Vim Defender"
 description="Defend your buffer from incoming threats. Type vim commands to destroy enemies before they reach your base."
 available
 bestScore={defenderBest}
 onClick={() => navigate('arcade')}
 />
 </Grid>
 </Grid>
 </Stack>
 )
}