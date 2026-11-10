import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useCommunity } from '../../hooks/useCommunity'
import { navigate } from '../../hooks/useRoute'
import { useDraftStore } from '../../store/draftStore'
import { useTerminalStore } from '../../store/terminalStore'
import { useUiStore } from '../../store/uiStore'

export function PublishedList() {
  const community = useCommunity()
  const loadChallenge = useDraftStore((s) => s.loadChallenge)
  const setTab = useUiStore((s) => s.setTab)
  const openInTerminal = useTerminalStore((s) => s.open)
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
    <Stack component="section" sx={{ gap: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" component="h1">
          Published challenges
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {count}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '75ch' }}>
        In Neovim, <code>:ArcadeSync</code> downloads these. They join your runs and practice, marked as community. Open one
        in the terminal to try its text with your own keymaps, or use it as a template to see how it is built.
      </Typography>
      <TextField size="small" label="Filter by title, area or author" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ maxWidth: 420 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 2 }}>
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
            <Typography variant="caption" color="text.secondary">
              {c.author ? `by ${c.author}` : ''}
            </Typography>
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  openInTerminal({ name: c.id, text: c.text, cursor: c.cursor })
                  navigate('terminal')
                }}
              >
                Open in terminal
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  loadChallenge(c)
                  setTab('describe')
                  navigate('create')
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
