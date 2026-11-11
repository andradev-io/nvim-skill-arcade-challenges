import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchStats } from '../auth/api'
import type { Stats } from '../auth/api'
import { accessToken, useAuthStore } from '../auth/authStore'
import { authConfig } from '../auth/config'
import { BarList, TimeChart } from '../components/admin/Charts'
import { GeneratePanel } from '../components/admin/GeneratePanel'
import { rate } from '../components/admin/chartMath'
import { useCommunity } from '../hooks/useCommunity'

const RANGES = [7, 30, 90]
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const n = (v: number) => v.toLocaleString('en-US')

function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Typography component="h2" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {note && (
        <Typography variant="caption" sx={{ opacity: 0.65, display: 'block', mb: 1.5 }}>
          {note}
        </Typography>
      )}
      {!note && <Box sx={{ mb: 1.5 }} />}
      {children}
    </Paper>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: '1 1 150px' }}>
      <Typography variant="caption" sx={{ opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2, mt: 0.5 }}>{value}</Typography>
      {sub && (
        <Typography variant="caption" sx={{ opacity: 0.65 }}>
          {sub}
        </Typography>
      )}
    </Paper>
  )
}

/** Usage numbers for the site's owner: visits, plays, scores. Only an account on the Worker's admin list gets data. */
export function AdminPage() {
  const status = useAuthStore((s) => s.status)
  const admin = useAuthStore((s) => s.admin)
  const community = useCommunity()
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'in' || !admin || !authConfig) return
    let live = true
    void (async () => {
      try {
        const token = await accessToken()
        if (!token) throw new Error('Your session ended. Sign in again.')
        const s = await fetchStats(authConfig!.api, token, days)
        if (live) {
          setStats(s)
          setError(null)
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Could not load the numbers.')
      }
    })()
    return () => {
      live = false
    }
  }, [status, admin, days])

  const head = (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
        Admin
      </Typography>
      <ToggleButtonGroup size="small" exclusive value={days} onChange={(_, v: number | null) => v && setDays(v)} aria-label="Time range">
        {RANGES.map((r) => (
          <ToggleButton key={r} value={r}>
            {r} days
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  )

  if (status === 'loading') {
    return (
      <Box sx={{ pt: 5, display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <CircularProgress size={20} />
        <Typography>Checking your session...</Typography>
      </Box>
    )
  }
  if (status !== 'in' || !admin) {
    return (
      <Box sx={{ maxWidth: 560, mx: 'auto', pt: 5 }}>
        <Alert severity="info">This page is for the site's owner. Sign in with an admin account to see it.</Alert>
      </Box>
    )
  }

  const titleOf = new Map((community.status === 'ready' ? community.items : []).map((c) => [c.id, c.title]))
  const label = (id: string) => titleOf.get(id) ?? id

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pt: { xs: 3, md: 5 } }}>
      {head}
      <Box sx={{ mb: 2.5 }}>
        <GeneratePanel />
      </Box>
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {!stats && !error && (
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <CircularProgress size={20} />
          <Typography>Loading the numbers...</Typography>
        </Box>
      )}
      {stats && (() => {
        const views = sum(stats.daily.map((d) => d.views))
        const visits = sum(stats.daily.map((d) => d.visitors))
        const started = sum(stats.daily.map((d) => d.started))
        const completed = sum(stats.daily.map((d) => d.completed))
        const done = rate(completed, started)
        return (
          <Stack sx={{ gap: 2.5 }}>
            <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
              <Kpi label="Page views" value={n(views)} sub={`last ${stats.days} days`} />
              <Kpi label="Visits" value={n(visits)} sub="distinct visitors per day, added up" />
              <Kpi label="Challenges started" value={n(started)} sub="on the site" />
              <Kpi label="Finished" value={done === null ? '–' : `${done}%`} sub={`${n(completed)} of ${n(started)}`} />
              <Kpi label="Players" value={n(stats.scores.players)} sub={`${n(stats.scores.total)} scores, all time`} />
            </Stack>

            <Panel title="Visits and page views per day" note="Visits are distinct visitors in a day (an anonymous daily hash). A visitor on two days counts twice.">
              <TimeChart
                points={stats.daily.map((d) => ({ day: d.day, bar: d.views, line: d.visitors }))}
                barLabel="page views"
                lineLabel="visits"
                summary={`Page views per day, ${n(views)} in total, and visits per day, ${n(visits)} in total, over the last ${stats.days} days.`}
              />
            </Panel>

            <Panel title="Challenges started and finished per day" note="Counted on the site, for published challenges only.">
              <TimeChart
                points={stats.daily.map((d) => ({ day: d.day, bar: d.started, line: d.completed }))}
                barLabel="started"
                lineLabel="finished"
                summary={`Challenges started per day, ${n(started)} in total, and finished, ${n(completed)} in total, over the last ${stats.days} days.`}
              />
            </Panel>

            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <Panel title="Pages" note="Page views by page.">
                <BarList items={stats.pages.map((p) => ({ label: p.path, value: p.views }))} empty="No page views in this range yet." />
              </Panel>
              <Panel title="Most played challenges" note="Solid part = finished, light = started.">
                <BarList
                  items={stats.challenges.map((c) => ({ label: label(c.challenge), value: c.started, part: Math.min(c.completed, c.started) }))}
                  partLabel="finished"
                  empty="No challenge was started in this range yet."
                />
              </Panel>
            </Box>

            <Panel title="Scoreboard" note="Players with a saved score for each challenge, all time, and the fewest keys anyone needed.">
              <BarList
                items={stats.scores.perChallenge.map((c) => ({ label: `${label(c.challenge)} · best ${c.best_keys} ${c.best_keys === 1 ? 'key' : 'keys'}`, value: c.players }))}
                empty="No scores saved yet."
              />
            </Panel>
          </Stack>
        )
      })()}
    </Box>
  )
}
