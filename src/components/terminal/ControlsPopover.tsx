import TuneIcon from '@mui/icons-material/Tune'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Popover from '@mui/material/Popover'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import { useState } from 'react'
import { THEMES } from './themes'
import { FILETYPE_CHOICES } from '../../plugins/comment'

interface ControlsPopoverProps {
  themeId: string
  onThemeChange: (id: string) => void
  filetype: string
  onFiletypeChange: (ft: string) => void
  onReset: () => void
}

/** Theme, filetype and reset controls shown inline on wide screens or in a popover on narrow ones. */
export function ControlsPopover({ themeId, onThemeChange, filetype, onFiletypeChange, onReset }: ControlsPopoverProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  const controls = (
    <>
      <Select
        size="small"
        variant="standard"
        disableUnderline
        value={themeId}
        onChange={(e) => onThemeChange(e.target.value)}
        aria-label="Color theme"
        title="Color theme"
        sx={{ fontSize: 12.5, color: 'var(--t-fg)', mr: 1.5 }}
      >
        {THEMES.map((t) => (
          <MenuItem key={t.id} value={t.id} dense>
            {t.name}
          </MenuItem>
        ))}
      </Select>
      <Select
        size="small"
        variant="standard"
        disableUnderline
        value={filetype}
        onChange={(e) => onFiletypeChange(e.target.value)}
        aria-label="Filetype"
        title="Filetype (comment characters)"
        sx={{ fontSize: 12.5, color: 'var(--t-fg)', mr: 1 }}
      >
        {(FILETYPE_CHOICES.includes(filetype) ? FILETYPE_CHOICES : [filetype, ...FILETYPE_CHOICES]).map((f) => (
          <MenuItem key={f} value={f} dense>
            {f}
          </MenuItem>
        ))}
      </Select>
      <Button
        size="small"
        color="inherit"
        onClick={() => {
          setAnchor(null)
          onReset()
        }}
        sx={{ opacity: 0.7, mr: 1, whiteSpace: 'nowrap' }}
      >
        Reset buffer
      </Button>
    </>
  )

  return (
    <>
      <IconButton size="small" aria-label="Terminal settings" title="Theme, filetype, reset" onClick={(e) => setAnchor(e.currentTarget)} sx={{ color: 'var(--t-fg)', mx: 0.5 }}>
        <TuneIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        className="dark"
      >
        <Stack sx={{ p: 1.5, gap: 1, alignItems: 'flex-start' }}>{controls}</Stack>
      </Popover>
    </>
  )
}

/** Inline controls for wide screens (no popover wrapper). */
export function ControlsInline({ themeId, onThemeChange, filetype, onFiletypeChange, onReset }: ControlsPopoverProps) {
  return (
    <>
      <Select
        size="small"
        variant="standard"
        disableUnderline
        value={themeId}
        onChange={(e) => onThemeChange(e.target.value)}
        aria-label="Color theme"
        title="Color theme"
        sx={{ fontSize: 12.5, color: 'var(--t-fg)', mr: 1.5 }}
      >
        {THEMES.map((t) => (
          <MenuItem key={t.id} value={t.id} dense>
            {t.name}
          </MenuItem>
        ))}
      </Select>
      <Select
        size="small"
        variant="standard"
        disableUnderline
        value={filetype}
        onChange={(e) => onFiletypeChange(e.target.value)}
        aria-label="Filetype"
        title="Filetype (comment characters)"
        sx={{ fontSize: 12.5, color: 'var(--t-fg)', mr: 1 }}
      >
        {(FILETYPE_CHOICES.includes(filetype) ? FILETYPE_CHOICES : [filetype, ...FILETYPE_CHOICES]).map((f) => (
          <MenuItem key={f} value={f} dense>
            {f}
          </MenuItem>
        ))}
      </Select>
      <Button
        size="small"
        color="inherit"
        onClick={onReset}
        sx={{ opacity: 0.7, mr: 1, whiteSpace: 'nowrap' }}
      >
        Reset buffer
      </Button>
    </>
  )
}