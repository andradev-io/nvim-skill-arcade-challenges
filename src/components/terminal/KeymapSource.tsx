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

/** Sidebar block: read keymaps from GitHub, switch them on or off, see what loaded and what was skipped. */
export function KeymapSource() {
  const s = useKeymapStore()
  const [filter, setFilter] = useState('')
  const [skippedOpen, setSkippedOpen] = useState(false)
  const loading = s.status === 'loading'
  const has = s.maps.length > 0 || s.skipped.length > 0
  const f = filter.trim().toLowerCase()
  const stubs = s.maps.filter((m) => m.note).length
  const shown = s.maps.filter((m) => !f || `${m.mode} ${m.lhs} ${m.rhs} ${m.note ?? ''}`.toLowerCase().includes(f))
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
          <TextField size="small" fullWidth label="Filter the list" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <Box sx={{ maxHeight: 260, overflowY: 'auto', fontSize: 12, lineHeight: 1.7 }}>
            {shown.map((m) => (
              <Box
                key={`${m.mode}${m.lhs}`}
                sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: m.note ? 0.6 : 1 }}
                title={m.note ?? `${m.file}:${m.line}`}
              >
                <Box component="span" sx={{ opacity: 0.55 }}>{m.mode} </Box>
                {m.lhs} <Box component="span" sx={{ opacity: 0.55 }}>→</Box> {m.note ? m.note.replace(/^[^:]*: /, '').replace(/, not simulated.*$/, '') : m.rhs}
              </Box>
            ))}
            {shown.length === 0 && <Box sx={{ opacity: 0.6 }}>nothing matches</Box>}
          </Box>
          {s.skipped.length > 0 && (
            <>
              <Button size="small" color="inherit" onClick={() => setSkippedOpen((o) => !o)} sx={{ justifyContent: 'flex-start' }}>
                {skippedOpen ? 'Hide skipped' : 'Why were some skipped?'}
              </Button>
              {skippedOpen && (
                <Box sx={{ maxHeight: 200, overflowY: 'auto', fontSize: 12, lineHeight: 1.6, opacity: 0.8 }}>
                  {s.skipped.map((k) => (
                    <Box key={`${k.file}:${k.line}:${k.text}`}>
                      {k.file.split('/').pop()}:{k.line} · {k.reason}
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </>
      )}
      <Typography variant="caption" sx={{ opacity: 0.65 }}>
        Key and :command mappings work, including tabs, buffers, :m and :echo. Mappings that need a plugin or Lua take
        the key over and say what they would do. The file is read, never run, and the result stays in this browser.
      </Typography>
    </Stack>
  )
}
