import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useCommunity } from '../../hooks/useCommunity'
import { useDraftStore } from '../../store/draftStore'

const toWorkspace = () => document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export function PublishedList() {
  const community = useCommunity()
  const loadChallenge = useDraftStore((s) => s.loadChallenge)
  const [filter, setFilter] = useState('')
  const items = community.status === 'ready' ? community.items : []
  const f = filter.toLowerCase()
  const shown = items.filter((c) => !f || [c.title, c.area, c.author ?? ''].join(' ').toLowerCase().includes(f))
  const count =
    community.status === 'loading'
      ? 'loading...'
      : community.status === 'error'
        ? 'list unavailable offline'
        : items.length
          ? `${shown.length} of ${items.length}`
          : 'nothing published yet'

  return (
    <Stack component="section" sx={{ gap: 2, mt: 6 }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" component="h2">
          Published challenges
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {count}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        In Neovim, <code>:ArcadeSync</code> downloads these. They join your runs and practice, marked as community. Use one
        as a template to see how it is built.
      </Typography>
      <TextField size="small" label="Filter by title, area or author" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ maxWidth: 420 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {shown.map((c) => (
          <Paper key={c.id} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ fontWeight: 700 }}>{c.title}</Typography>
            <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
              <Chip size="small" variant="outlined" label={c.area} />
              <Chip size="small" variant="outlined" label={`level ${c.level}`} />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              {c.brief}
            </Typography>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                {c.author ? `by ${c.author}` : ''}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  loadChallenge(c)
                  toWorkspace()
                }}
              >
                Use as template
              </Button>
            </Stack>
          </Paper>
        ))}
      </Box>
    </Stack>
  )
}
