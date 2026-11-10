import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useKeymapStore } from '../../store/keymapStore'

/** Sidebar block: read keymaps from GitHub, switch them on or off, see the counts. The full list opens in a dialog. */
export function KeymapSource({ onDetails }: { onDetails?: () => void }) {
  const s = useKeymapStore()
  const loading = s.status === 'loading'
  const has = s.maps.length > 0 || s.skipped.length > 0
  const stubs = s.maps.filter((m) => m.note).length
  return (
    <Stack spacing={1.25}>
      <TextField
        size="small"
        fullWidth
        label="GitHub user, user/repo or file link"
        placeholder="you/dotfiles"
        value={s.source}
        onChange={(e) => s.setSource(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void s.load()
        }}
        slotProps={{ htmlInput: { spellCheck: false, autoCapitalize: 'off' } }}
      />
      <Stack direction="row" sx={{ gap: 1 }}>
        <Button variant="contained" size="small" disabled={loading || !s.source.trim()} onClick={() => void s.load()}>
          {loading ? 'Loading' : 'Load keymaps'}
        </Button>
        {has && (
          <Button size="small" color="inherit" onClick={s.clear}>
            Forget
          </Button>
        )}
      </Stack>
      {s.status === 'error' && (
        <Alert severity="warning" variant="outlined">
          {s.error}
        </Alert>
      )}
      {has && (
        <>
          <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
            <Chip size="small" color="success" label={`${s.maps.length - stubs} working`} />
            {stubs > 0 && <Chip size="small" color="info" variant="outlined" label={`${stubs} need a plugin`} />}
            {s.skipped.length > 0 && <Chip size="small" color="warning" variant="outlined" label={`${s.skipped.length} skipped`} />}
            <Chip size="small" variant="outlined" label={`leader ${s.leader === ' ' ? 'Space' : s.leader}`} />
          </Stack>
          <FormControlLabel
            control={<Switch size="small" checked={s.enabled} onChange={(e) => s.setEnabled(e.target.checked)} />}
            label={<Typography variant="body2">Use my keymaps</Typography>}
          />
        </>
      )}
      {onDetails && (
        <Button size="small" variant="outlined" color="inherit" onClick={onDetails} sx={{ alignSelf: 'flex-start' }}>
          {has ? 'See the list' : 'What works here'}
        </Button>
      )}
      <Typography variant="caption" sx={{ opacity: 0.65 }}>
        Your file is read, never run, and stays in this browser.
      </Typography>
    </Stack>
  )
}

/** The loaded mappings in full: searchable list, and why some were skipped. */
export function KeymapReport() {
  const s = useKeymapStore()
  const [filter, setFilter] = useState('')
  const f = filter.trim().toLowerCase()
  const shown = s.maps.filter((m) => !f || `${m.mode} ${m.lhs} ${m.rhs} ${m.note ?? ''}`.toLowerCase().includes(f))
  if (s.maps.length === 0 && s.skipped.length === 0) {
    return <Typography sx={{ opacity: 0.7 }}>No keymaps loaded yet. Load a GitHub user or repo from the side menu.</Typography>
  }
  const stubs = s.maps.filter((m) => m.note).length
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Chip color="success" label={`${s.maps.length - stubs} working`} />
        {stubs > 0 && <Chip color="info" variant="outlined" label={`${stubs} need a plugin (dimmed: the key says what it would do)`} />}
        {s.skipped.length > 0 && <Chip color="warning" variant="outlined" label={`${s.skipped.length} skipped`} />}
      </Stack>
      <TextField size="small" fullWidth label="Filter the list" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <Box sx={{ maxHeight: 340, overflowY: 'auto', fontSize: 13, lineHeight: 1.8 }}>
        {shown.map((m) => (
          <Box key={`${m.mode}${m.lhs}`} sx={{ opacity: m.note ? 0.6 : 1 }} title={m.note ?? `${m.file}:${m.line}`}>
            <Box component="span" sx={{ opacity: 0.55 }}>
              {m.mode}{' '}
            </Box>
            {m.lhs} <Box component="span" sx={{ opacity: 0.55 }}>→</Box>{' '}
            {m.note ? m.note.replace(/^[^:]*: /, '').replace(/, not simulated.*$/, '') : m.rhs}
          </Box>
        ))}
        {shown.length === 0 && <Box sx={{ opacity: 0.6 }}>nothing matches</Box>}
      </Box>
      {s.skipped.length > 0 && (
        <>
          <Typography sx={{ fontWeight: 700 }}>Skipped ({s.skipped.length})</Typography>
          <Box sx={{ maxHeight: 200, overflowY: 'auto', fontSize: 12.5, lineHeight: 1.7, opacity: 0.8 }}>
            {s.skipped.map((k) => (
              <Box key={`${k.file}:${k.line}:${k.text}`}>
                {k.file.split('/').pop()}:{k.line} · {k.reason}
              </Box>
            ))}
          </Box>
        </>
      )}
    </Stack>
  )
}
