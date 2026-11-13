import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import { authConfig } from '../auth/config'

interface DailyRow {
 day: string
 views: number
 visitors: number
 started: number
 completed: number
}

interface TopChallenge {
 challenge: string
 attempts: number
 completions: number
 rate: number | null
}

interface PublicStats {
 totalViews: number
 totalAttempts: number
 totalCompletions: number
 completionRate: number | null
 topChallenges: TopChallenge[]
 daily: DailyRow[]
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
 return (
 <Paper
 sx={{
 p: 3,
 bgcolor: 'background.paper',
 border: '1px solid',
 borderColor: 'divider',
 borderRadius: 2,
 flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' },
 minWidth: 160,
 }}
 >
 <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
 {label}
 </Typography>
 <Typography variant="h3" sx={{ color: 'warning.main', fontWeight: 700, mt: 0.5 }}>
 {value}
 </Typography>
 {sub && (
 <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
 {sub}
 </Typography>
 )}
 </Paper>
 )
}

function TrendChart({ daily }: { daily: DailyRow[] }) {
 if (daily.length === 0) return null
 const maxViews = Math.max(...daily.map((d) => d.views), 1)
 return (
 <Paper sx={{ p: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
 <Typography variant="h6" sx={{ color: 'text.primary', mb: 2 }}>
 30-Day Trend
 </Typography>
 <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: 120 }}>
 {daily.map((d) => {
 const h = Math.max(2, (d.views / maxViews) * 100)
 return (
 <Box
 key={d.day}
 title={`${d.day}: ${d.views} views, ${d.started} attempts`}
 sx={{
 flex: 1,
 height: `${h}%`,
 bgcolor: 'warning.main',
 borderRadius: '2px 2px 0 0',
 opacity: 0.85,
 '&:hover': { opacity: 1 },
 transition: 'opacity 0.15s',
 }}
 />
 )
 })}
 </Box>
 <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
 Views per day (last 30 days)
 </Typography>
 </Paper>
 )
}

export function StatsPage() {
 const [data, setData] = useState<PublicStats | null>(null)
 const [error, setError] = useState<string | null>(null)
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 let cancelled = false
 const api = authConfig?.api
 if (!api) {
 setError('API not configured')
 setLoading(false)
 return
 }
 void fetch(`${api}/api/stats`)
 .then((r) => {
 if (!r.ok) throw new Error(`HTTP ${r.status}`)
 return r.json() as Promise<PublicStats>
 })
 .then((d) => {
 if (!cancelled) {
 setData(d)
 setLoading(false)
 }
 })
 .catch((e) => {
 if (!cancelled) {
 setError(e instanceof Error ? e.message : 'Failed to load stats')
 setLoading(false)
 }
 })
 return () => {
 cancelled = true
 }
 }, [])

 if (loading) {
 return (
 <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
 <CircularProgress sx={{ color: 'warning.main' }} />
 </Box>
 )
 }

 if (error || !data) {
 return (
 <Box sx={{ py: 8, textAlign: 'center' }}>
 <Typography variant="h6" sx={{ color: 'text.secondary' }}>
 {error ?? 'No data available'}
 </Typography>
 </Box>
 )
 }

 return (
 <Stack sx={{ gap: 3, py: 4 }}>
 <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 700 }}>
 Community Stats
 </Typography>
 <Typography variant="body1" sx={{ color: 'text.secondary' }}>
 Anonymous aggregate metrics from the last 30 days. No personal data is collected.
 </Typography>

 {/* Big number cards */}
 <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
 <StatCard label="Total Views" value={data.totalViews.toLocaleString()} />
 <StatCard label="Attempts" value={data.totalAttempts.toLocaleString()} />
 <StatCard label="Completions" value={data.totalCompletions.toLocaleString()} />
 <StatCard
 label="Completion Rate"
 value={data.completionRate !== null ? `${data.completionRate}%` : '—'}
 sub={data.totalAttempts > 0 ? `${data.totalCompletions} of ${data.totalAttempts}` : undefined}
 />
 </Box>

 {/* 30-day trend */}
 <TrendChart daily={data.daily} />

 {/* Top challenges table */}
 <Paper sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
 <Box sx={{ px: 3, pt: 3, pb: 1 }}>
 <Typography variant="h6" sx={{ color: 'text.primary' }}>
 Top Challenges
 </Typography>
 </Box>
 <TableContainer>
 <Table size="small">
 <TableHead>
 <TableRow sx={{ bgcolor: 'action.hover' }}>
 <TableCell sx={{ color: 'text.secondary', borderColor: 'divider' }}>Challenge</TableCell>
 <TableCell align="right" sx={{ color: 'text.secondary', borderColor: 'divider' }}>
 Attempts
 </TableCell>
 <TableCell align="right" sx={{ color: 'text.secondary', borderColor: 'divider' }}>
 Completions
 </TableCell>
 <TableCell sx={{ color: 'text.secondary', borderColor: 'divider', width: '30%' }}>Rate</TableCell>
 </TableRow>
 </TableHead>
 <TableBody>
 {data.topChallenges.map((c, i) => (
 <TableRow key={c.challenge} sx={{ bgcolor: i % 2 === 1 ? 'action.hover' : 'transparent' }}>
 <TableCell sx={{ color: 'text.primary', borderColor: 'divider', fontFamily: 'monospace', fontSize: 13 }}>
 {c.challenge}
 </TableCell>
 <TableCell align="right" sx={{ color: 'text.primary', borderColor: 'divider' }}>
 {c.attempts}
 </TableCell>
 <TableCell align="right" sx={{ color: 'text.primary', borderColor: 'divider' }}>
 {c.completions}
 </TableCell>
 <TableCell sx={{ borderColor: 'divider' }}>
 <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
 <LinearProgress
 variant="determinate"
 value={c.rate ?? 0}
 sx={{
 flex: 1,
 height: 8,
 borderRadius: 4,
 bgcolor: 'action.disabledBackground',
 '& .MuiLinearProgress-bar': { bgcolor: 'warning.main', borderRadius: 4 },
 }}
 />
 <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 36, textAlign: 'right' }}>
 {c.rate !== null ? `${c.rate}%` : '—'}
 </Typography>
 </Box>
 </TableCell>
 </TableRow>
 ))}
 {data.topChallenges.length === 0 && (
 <TableRow>
 <TableCell colSpan={4} sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
 No challenge data yet
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </TableContainer>
 </Paper>
 </Stack>
 )
}