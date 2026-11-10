import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'

export interface Snap {
  mode: string
  row: number
  col: number
}

const MODE: Record<string, { label: string; bg: string }> = {
  normal: { label: 'NORMAL', bg: '#b4b96b' },
  insert: { label: 'INSERT', bg: '#7fb06a' },
  visual: { label: 'VISUAL', bg: '#8fa8d8' },
}

/** A lualine-style bar: mode block, buffer, the last keys typed, loaded maps, cursor. */
export function Statusline({ snap, name, keys, maps }: { snap: Snap; name: string; keys: string[]; maps: number }) {
  const m = MODE[snap.mode] ?? { label: snap.mode.toUpperCase(), bg: '#b4b96b' }
  return (
    <Stack direction="row" sx={{ alignItems: 'stretch', bgcolor: '#1b1b1c', color: '#d6d6d6', fontSize: 13, minHeight: 28, borderTop: '1px solid #2a2a2a' }}>
      <Box sx={{ px: 1.5, display: 'flex', alignItems: 'center', fontWeight: 700, color: '#101010', bgcolor: m.bg }}>{m.label}</Box>
      <Box sx={{ px: 1.5, display: 'flex', alignItems: 'center', bgcolor: '#262627' }}>{name}</Box>
      <Box sx={{ flex: 1, minWidth: 0, px: 1.5, display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', opacity: 0.75 }}>
        {keys.length ? keys.join(' ') : 'press keys'}
      </Box>
      {maps > 0 && <Box sx={{ px: 1.5, display: 'flex', alignItems: 'center', opacity: 0.8 }}>{maps} maps</Box>}
      <Box sx={{ px: 1.5, display: 'flex', alignItems: 'center', bgcolor: '#262627' }}>
        {snap.row}:{snap.col + 1}
      </Box>
    </Stack>
  )
}
