import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'

export interface Snap {
  mode: string
  row: number
  col: number
}

const MODE: Record<string, { label: string; bg: string }> = {
  normal: { label: 'NORMAL', bg: 'var(--t-mode-normal)' },
  insert: { label: 'INSERT', bg: 'var(--t-mode-insert)' },
  visual: { label: 'VISUAL', bg: 'var(--t-mode-visual)' },
}

/** A lualine-style bar: mode block, buffer, the last keys typed, loaded maps, cursor. */
export function Statusline({ snap, name, keys, maps, note = '' }: { snap: Snap; name: string; keys: string[]; maps: number; note?: string }) {
  const m = MODE[snap.mode] ?? { label: snap.mode.toUpperCase(), bg: 'var(--t-mode-normal)' }
  return (
    <Stack direction="row" sx={{ alignItems: 'stretch', bgcolor: 'var(--t-bar)', color: 'var(--t-fg)', fontSize: 13, minHeight: 28, borderTop: '1px solid var(--t-line)' }}>
      <Box sx={{ px: 1.5, display: 'flex', alignItems: 'center', fontWeight: 700, color: 'var(--t-on-accent)', bgcolor: m.bg }}>{m.label}</Box>
      <Box sx={{ px: 1.5, display: 'flex', alignItems: 'center', bgcolor: 'var(--t-pill)' }}>{name}</Box>
      <Box
        role="status"
        sx={{ flex: 1, minWidth: 0, px: 1.5, display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', opacity: note ? 1 : 0.75, color: note ? 'var(--t-warn)' : 'inherit' }}
      >
        {note || (keys.length ? keys.join(' ') : 'press keys')}
      </Box>
      {maps > 0 && <Box sx={{ px: 1.5, display: 'flex', alignItems: 'center', opacity: 0.8 }}>{maps} maps</Box>}
      <Box sx={{ px: 1.5, display: 'flex', alignItems: 'center', bgcolor: 'var(--t-pill)' }}>
        {snap.row}:{snap.col + 1}
      </Box>
    </Stack>
  )
}
