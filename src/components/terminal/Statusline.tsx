import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'

export interface Snap {
  mode: string
  row: number
  col: number
  /** Keys Vim is waiting for (`"a2d`). */
  pending?: string
  /** Register of the macro being recorded. */
  recording?: string | null
}

const MODE: Record<string, { label: string; bg: string }> = {
  normal: { label: 'NORMAL', bg: 'var(--t-mode-normal)' },
  insert: { label: 'INSERT', bg: 'var(--t-mode-insert)' },
  visual: { label: 'VISUAL', bg: 'var(--t-mode-visual)' },
}

const cell = { px: 1.5, display: 'flex', alignItems: 'center' } as const

/** A lualine-style bar: mode block, buffer, the last keys typed, pending keys, macro recording, loaded maps, cursor. */
export function Statusline({ snap, name, keys, maps, note = '' }: { snap: Snap; name: string; keys: string[]; maps: number; note?: string }) {
  const m = MODE[snap.mode] ?? { label: snap.mode.toUpperCase(), bg: 'var(--t-mode-normal)' }
  return (
    <Stack direction="row" sx={{ alignItems: 'stretch', bgcolor: 'var(--t-bar)', color: 'var(--t-fg)', fontSize: 13, minHeight: 28, borderTop: '1px solid var(--t-line)' }}>
      <Box sx={{ ...cell, fontWeight: 700, color: 'var(--t-on-accent)', bgcolor: m.bg }}>{m.label}</Box>
      {snap.recording != null && (
        <Box sx={{ ...cell, fontWeight: 700, color: 'var(--t-on-accent)', bgcolor: 'var(--t-warn)' }} title="Recording a macro: press q to stop">
          {`recording @${snap.recording}`}
        </Box>
      )}
      <Box sx={{ ...cell, bgcolor: 'var(--t-pill)' }}>{name}</Box>
      <Box
        role="status"
        sx={{ ...cell, flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', opacity: note ? 1 : 0.75, color: note ? 'var(--t-warn)' : 'inherit' }}
      >
        {note || (keys.length ? keys.join(' ') : 'press keys')}
      </Box>
      {snap.pending && (
        <Box aria-label={`Pending keys ${snap.pending}`} title="Keys Vim is waiting for" sx={{ ...cell, fontWeight: 700, color: 'var(--t-accent)', bgcolor: 'var(--t-pill)', minWidth: 48, justifyContent: 'center' }}>
          {snap.pending}
        </Box>
      )}
      {maps > 0 && <Box sx={{ ...cell, opacity: 0.8 }}>{maps} maps</Box>}
      <Box sx={{ ...cell, bgcolor: 'var(--t-pill)' }}>
        {snap.row}:{snap.col + 1}
      </Box>
    </Stack>
  )
}
