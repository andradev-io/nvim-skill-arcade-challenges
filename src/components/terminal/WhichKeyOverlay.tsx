import Box from '@mui/material/Box'
import type { WhichKeyState } from '../../core/whichKey'

interface Props {
  state?: WhichKeyState | null
  maxRows?: number
}

const GROUP_COLORS: Record<string, string> = {
  command: '#e6a756',
  telescope: '#7ec8c8',
  git: '#e07878',
  lsp: '#82b1ff',
  buffer: '#c3e88d',
  tab: '#f78c6c',
  search: '#c792ea',
  file: '#89ddff',
}

/** Floating panel showing available key bindings for the current prefix. Positioned above the statusline. */
export function WhichKeyOverlay({ state, maxRows = 8 }: Props) {
  if (!state?.visible || !state.node) return null

  const entries = state.node.entries
  if (entries.length === 0) return null

  // Group entries by their group field
  const groups = new Map<string, typeof entries>()
  for (const entry of entries) {
    const g = entry.group ?? ''
    let list = groups.get(g)
    if (!list) {
      list = []
      groups.set(g, list)
    }
    list.push(entry)
  }

  // Limit displayed entries to maxRows * columns
  const cols = entries.length > 12 ? 3 : entries.length > 6 ? 2 : 1
  const limited = entries.slice(0, maxRows * cols)

  const typedDisplay = state.typed.map((k) => k === '<Space>' ? '␣' : k).join('')

  return (
    <Box
      role="tooltip"
      aria-live="polite"
      sx={{
        position: 'absolute',
        bottom: 32,
        left: 8,
        right: 8,
        bgcolor: 'var(--t-bar)',
        color: 'var(--t-fg)',
        border: '1px solid var(--t-line)',
        borderRadius: '6px',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
        p: 1.5,
        zIndex: 100,
        pointerEvents: 'none',
        fontFamily: 'inherit',
        fontSize: 13,
      }}
    >
      {/* Entries grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '2px 16px',
          mb: 1,
        }}
      >
        {limited.map((entry, i) => (
          <Box
            key={`${entry.key}-${i}`}
            sx={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 1,
              py: 0.25,
            }}
          >
            <Box
              component="span"
              sx={{
                fontWeight: 700,
                color: GROUP_COLORS[entry.group ?? ''] ?? 'var(--t-accent)',
                minWidth: 24,
                fontFamily: 'monospace',
              }}
            >
              {entry.key === '<Space>' ? '␣' : entry.key}
            </Box>
            <Box
              component="span"
              sx={{
                opacity: 0.85,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.label}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Footer: typed prefix */}
      <Box
        sx={{
          borderTop: '1px solid var(--t-line)',
          pt: 0.75,
          fontSize: 12,
          opacity: 0.7,
          fontFamily: 'monospace',
        }}
      >
        {typedDisplay || '?'}
      </Box>
    </Box>
  )
}