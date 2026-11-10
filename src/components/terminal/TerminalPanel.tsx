import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CloseIcon from '@mui/icons-material/Close'
import OpenInFullIcon from '@mui/icons-material/OpenInFull'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useMemo, useRef, useState } from 'react'
import { useDraft } from '../../hooks/useDraft'
import { useKeymapStore } from '../../store/keymapStore'
import type { VimEditorHandle } from '../play/VimEditor'
import { VimEditor } from '../play/VimEditor'

const SAMPLE = `function greet(name) {
  return "hello, " + name
}

local items = { "alpha", "beta", "gamma" }
for i, item in ipairs(items) do
  print(i, item)
end
`

interface Snap {
  mode: string
  row: number
  col: number
}

const MODE_LABEL: Record<string, string> = { normal: 'NORMAL', insert: 'INSERT', visual: 'VISUAL' }

function Statusline({ snap, keys, active, total }: { snap: Snap; keys: string[]; active: number; total: number }) {
  return (
    <Stack
      direction="row"
      sx={{ gap: 1.5, px: 1.5, py: 0.5, alignItems: 'center', bgcolor: '#1b1b1b', color: '#d6d6d6', fontSize: 12 }}
    >
      <Box
        component="span"
        sx={{ px: 1, fontWeight: 700, color: '#121212', bgcolor: snap.mode === 'insert' ? '#7fb06a' : 'primary.main' }}
      >
        {MODE_LABEL[snap.mode] ?? snap.mode.toUpperCase()}
      </Box>
      <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', opacity: 0.8 }}>
        {keys.length ? keys.join(' ') : 'press keys'}
      </Box>
      {total > 0 && <Box component="span">{active} maps</Box>}
      <Box component="span">
        {snap.row}:{snap.col + 1}
      </Box>
    </Stack>
  )
}

function KeymapLoader() {
  const s = useKeymapStore()
  const [open, setOpen] = useState(false)
  const loading = s.status === 'loading'
  const has = s.maps.length > 0 || s.skipped.length > 0
  return (
    <Stack spacing={1}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        Your keymaps from GitHub
      </Typography>
      <Stack direction="row" sx={{ gap: 1 }}>
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
        <Button variant="contained" disabled={loading || !s.source.trim()} onClick={() => void s.load()} sx={{ whiteSpace: 'nowrap' }}>
          {loading ? 'Loading' : 'Load'}
        </Button>
      </Stack>
      {s.status === 'error' && (
        <Alert severity="warning" variant="outlined">
          {s.error}
        </Alert>
      )}
      {has && (
        <>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip size="small" color="success" label={`${s.maps.length} loaded`} />
            <Chip size="small" color={s.skipped.length ? 'warning' : 'default'} variant="outlined" label={`${s.skipped.length} skipped`} />
            <Chip size="small" variant="outlined" label={`leader ${s.leader === ' ' ? 'Space' : s.leader}`} />
            <Button size="small" onClick={() => setOpen((o) => !o)}>
              {open ? 'Hide list' : 'Show list'}
            </Button>
            <Button size="small" color="inherit" onClick={s.clear}>
              Forget
            </Button>
          </Stack>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ maxHeight: 220, overflowY: 'auto', fontSize: 12, border: 1, borderColor: 'divider', borderRadius: '15px', p: 1.5 }}>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Read from {s.files.join(', ')}
              </Typography>
              {s.maps.map((m) => (
                <Box key={`${m.mode}${m.lhs}`} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.mode} {m.lhs} → {m.rhs}
                </Box>
              ))}
              {s.skipped.length > 0 && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, fontWeight: 700 }}>
                  Skipped
                </Typography>
              )}
              {s.skipped.map((k) => (
                <Box key={`${k.file}:${k.line}:${k.text}`} sx={{ opacity: 0.75 }}>
                  {k.file}:{k.line} · {k.reason}
                </Box>
              ))}
            </Box>
          </Collapse>
        </>
      )}
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        Only plain key-to-key and :command mappings can load. Lua functions, plugin mappings (Telescope, surround ...)
        are skipped. The file is read, never run, and your keymaps stay in this browser.
      </Typography>
    </Stack>
  )
}

/** A free sandbox: a terminal-style Vim with your own keymaps, not scored. */
export function TerminalPanel() {
  const { data } = useDraft()
  const maps = useKeymapStore((s) => s.maps)
  const enabled = useKeymapStore((s) => s.enabled)
  const setEnabled = useKeymapStore((s) => s.setEnabled)
  const editor = useRef<VimEditorHandle>(null)
  const [text, setText] = useState(SAMPLE)
  const [run, setRun] = useState(0)
  const [big, setBig] = useState(false)
  const [snap, setSnap] = useState<Snap>({ mode: 'normal', row: 1, col: 0 })
  const [keys, setKeys] = useState<string[]>([])
  const active = useMemo(() => (enabled ? maps : []), [enabled, maps])

  const onSync = () => {
    const ed = editor.current
    if (!ed) return
    const c = ed.cursor()
    const mode = ed.mode()
    setSnap((p) => (p.mode === mode && p.row === c[0] && p.col === c[1] ? p : { mode, row: c[0], col: c[1] }))
  }
  const onKey = (key: string) => {
    const label = key.length === 1 ? (key === ' ' ? '␣' : key) : key
    setKeys((k) => [...k.slice(-9), label])
    return false
  }

  /** Move between the small inline window and the full-screen one without losing what was typed. */
  const toggleBig = (next: boolean) => {
    setText(editor.current?.text() ?? text)
    setBig(next)
  }

  const windowBox = (large: boolean) => (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: large ? 0 : '15px',
        overflow: 'hidden',
        bgcolor: '#121212',
        fontFamily: 'inherit',
        ...(large && { flex: 1, display: 'flex', flexDirection: 'column', border: 0 }),
      }}
    >
      <Stack direction="row" sx={{ gap: 0.75, px: 1.5, py: 1, alignItems: 'center', bgcolor: '#1b1b1b', borderBottom: '1px solid #2a2a2a' }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#e0625a' }} />
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#e0b45a' }} />
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#7fb06a' }} />
        <Typography sx={{ ml: 1, fontSize: 12, color: '#bdbdbd', flex: 1 }}>nvim · scratch</Typography>
        <IconButton
          size="small"
          aria-label={large ? 'Close full screen' : 'Open full screen'}
          onClick={() => toggleBig(!large)}
          sx={{ color: '#bdbdbd' }}
        >
          {large ? <CloseIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
        </IconButton>
      </Stack>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          '& > div': { border: 'none', borderRadius: 0, ...(large && { height: '100%' }) },
          '& .cm-editor': { backgroundColor: '#121212', color: '#e6e6e6', ...(large && { height: '100%' }) },
        }}
      >
        <VimEditor
          key={`${run}|${text}|${large}`}
          ref={editor}
          initialText={text}
          initialCursor={[1, 0]}
          onKey={onKey}
          onSync={onSync}
          maps={active}
          size={large ? 'large' : 'terminal'}
        />
      </Box>
      <Statusline snap={snap} keys={keys} active={active.length} total={maps.length} />
    </Box>
  )

  const buttons = (
    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
      <Button
        size="small"
        variant="outlined"
        onClick={() => {
          setText(SAMPLE)
          setRun((r) => r + 1)
        }}
      >
        Sample text
      </Button>
      <Button
        size="small"
        variant="outlined"
        disabled={!data.text}
        onClick={() => {
          setText(data.text)
          setRun((r) => r + 1)
        }}
      >
        Use the challenge text
      </Button>
      <Button size="small" variant="outlined" onClick={() => setRun((r) => r + 1)}>
        Reset
      </Button>
    </Stack>
  )

  const keymapSwitch = (
    <FormControlLabel
      control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={maps.length === 0} />}
      label={maps.length ? 'Use my keymaps in the terminal' : 'Load keymaps to use them here'}
    />
  )

  return (
    <Stack spacing={1.5}>
      <Alert severity="info" variant="outlined">
        A free sandbox, not scored and not counted. Try motions and your own mappings on any text. Use the corner button
        for a full-screen terminal.
      </Alert>
      <KeymapLoader />
      {keymapSwitch}
      {!big && windowBox(false)}
      {!big && buttons}
      {/* Esc belongs to Vim here, so the dialog is closed with its button only */}
      <Dialog fullScreen open={big} onClose={() => undefined} slotProps={{ paper: { sx: { bgcolor: '#121212' } } }}>
        <Stack sx={{ height: '100%', p: { xs: 1, md: 2 }, gap: 1.5 }}>
          <Stack direction="row" sx={{ gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {keymapSwitch}
            {buttons}
          </Stack>
          {big && windowBox(true)}
        </Stack>
      </Dialog>
    </Stack>
  )
}
