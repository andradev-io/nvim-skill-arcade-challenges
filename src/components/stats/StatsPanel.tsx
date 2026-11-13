import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useMemo } from 'react'
import { useScoringStore, type Rank } from '../../store/scoringStore'

/** Rank colors derived from MUI theme palette for theme responsiveness. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRankColors(theme: any): Record<Rank, string> {
  return {
    S: theme.palette.warning.main,
    A: String(theme.palette.grey[500]),
    B: theme.palette.warning.dark,
    C: String(theme.palette.grey[700]),
  }
}

const RANK_LABELS: Record<Rank, string> = {
  S: 'S (Perfect)',
  A: 'A (Great)',
  B: 'B (Good)',
  C: 'C (Completed)',
}

interface RankBarProps {
  rank: Rank
  count: number
  total: number
  color: string
}

function RankBar({ rank, count, total, color }: RankBarProps) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.5 }}>
      <Typography variant="body2" sx={{ width: 90, color, fontWeight: 600 }}>
        {RANK_LABELS[rank]}
      </Typography>
      <Box sx={{ flex: 1 }}>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 8,
            borderRadius: 1,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 },
          }}
        />
      </Box>
      <Typography variant="body2" sx={{ width: 30, textAlign: 'right', opacity: 0.8 }}>
        {count}
      </Typography>
    </Stack>
  )
}

/** Personal stats dashboard: completions, rank distribution, streak, recent activity. */
export function StatsPanel() {
  const theme = useTheme()
  const rankColors = useMemo(() => getRankColors(theme), [theme])
  const bests = useScoringStore((s) => s.bests)
  const totalCompleted = useScoringStore((s) => s.totalCompleted)
  const streak = useScoringStore((s) => s.streak)
  const clearAll = useScoringStore((s) => s.clearAll)

  const stats = useMemo(() => {
    const entries = Object.values(bests)
    const total = entries.length
    let sCount = 0
    let aCount = 0
    let bCount = 0
    let cCount = 0
    let efficiencySum = 0
    for (const b of entries) {
      if (b.rank === 'S') { sCount++; efficiencySum += 100 }
      else if (b.rank === 'A') { aCount++; efficiencySum += 80 }
      else if (b.rank === 'B') { bCount++; efficiencySum += 60 }
      else { cCount++; efficiencySum += 40 }
    }
    return {
      total,
      sCount,
      aCount,
      bCount,
      cCount,
      avgEfficiency: total > 0 ? Math.round(efficiencySum / total) : 0,
    }
  }, [bests])

  const recent = useMemo(() => {
    return Object.values(bests)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
  }, [bests])

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch {
      return iso.slice(0, 10)
    }
  }

  return (
    <Box sx={{ p: 2, maxWidth: 480 }}>
      <Typography variant="h6" sx={{ mb: 2, color: 'warning.main', fontWeight: 700 }}>
        Your Stats
      </Typography>

      {/* Summary cards */}
      <Stack direction="row" sx={{ gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 100, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.6 }}>Challenges</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{stats.total}</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 100, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.6 }}>Streak</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {streak} <Typography component="span" variant="caption" sx={{ opacity: 0.6 }}>days</Typography>
          </Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 100, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ opacity: 0.6 }}>Avg Efficiency</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{stats.avgEfficiency}%</Typography>
        </Box>
      </Stack>

      {/* Total completions vs unique challenges */}
      <Typography variant="body2" sx={{ opacity: 0.7, mb: 1 }}>
        {totalCompleted} total completions across {stats.total} unique challenges
      </Typography>

      {/* Rank distribution */}
      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, opacity: 0.9 }}>Rank Distribution</Typography>
      <RankBar rank="S" count={stats.sCount} total={stats.total} color={rankColors.S} />
      <RankBar rank="A" count={stats.aCount} total={stats.total} color={rankColors.A} />
      <RankBar rank="B" count={stats.bCount} total={stats.total} color={rankColors.B} />
      <RankBar rank="C" count={stats.cCount} total={stats.total} color={rankColors.C} />

      {/* Recent completions */}
      {recent.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1, opacity: 0.9 }}>Recent Bests</Typography>
          <Stack sx={{ gap: 0.5 }}>
            {recent.map((b) => (
              <Stack key={b.challengeId} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.challengeId}
                </Typography>
                <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: rankColors[b.rank], fontWeight: 600 }}>{b.rank}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.5 }}>{fmtDate(b.date)}</Typography>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </>
      )}

      {/* Clear data */}
      <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button size="small" color="inherit" onClick={clearAll} sx={{ opacity: 0.5, fontSize: 11 }}>
          Clear all local stats
        </Button>
      </Box>
    </Box>
  )
}