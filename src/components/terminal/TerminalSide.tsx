import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import type { BuiltinChallenge } from '../../core/builtin'
import { EXAMPLES } from '../../examples'
import { useKeymapStore } from '../../store/keymapStore'
import { enabledShims, usePluginStore } from '../../store/pluginStore'
import { MAX_WIDTH, MIN_WIDTH, useTerminalLayout } from '../../store/terminalLayoutStore'
import { SAMPLE_BUFFER } from '../../store/terminalStore'
import type { TerminalBuffer } from '../../store/terminalStore'
import { BufferPicker } from './BufferPicker'
import { KeymapSource } from './KeymapSource'
import type { InfoTab } from './InfoDialog'
import { PluginList } from './PluginList'

const LINE = '1px solid var(--t-line)'

function Group({ title, summary, defaultOpen = true, children }: { title: string; summary?: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Box sx={{ borderBottom: LINE }}>
      <ButtonBase
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        sx={{ width: '100%', px: 2, py: 1.25, justifyContent: 'flex-start', gap: 1, textAlign: 'left' }}
      >
        <ExpandMoreIcon sx={{ fontSize: 18, opacity: 0.6, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
        <Typography sx={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'primary.main', fontFamily: 'inherit' }}>
          {title}
        </Typography>
        {!open && summary && <Typography sx={{ fontSize: 11.5, opacity: 0.6, ml: 'auto', fontFamily: 'inherit' }}>{summary}</Typography>}
      </ButtonBase>
      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 1.5 }}>{children}</Box>
      </Collapse>
    </Box>
  )
}

interface Draftish {
  id: string
  title: string
  text: string
  cursor: [number, number]
}

/** The menu of the Terminal: pick a buffer (two dropdowns), keymaps, plugins. `desktop` adds the layout controls. */
export function SideContent({
  buffer,
  published,
  builtin,
  data,
  onOpen,
  onInfo,
  desktop = false,
}: {
  buffer: TerminalBuffer
  published: Draftish[]
  builtin: BuiltinChallenge[]
  data: Draftish
  onOpen: (b: TerminalBuffer) => void
  onInfo: (t: InfoTab) => void
  desktop?: boolean
}) {
  const km = useKeymapStore((s) => s.maps.length)
  const detected = usePluginStore((s) => s.detected)
  const overrides = usePluginStore((s) => s.overrides)
  const on = enabledShims({ detected, overrides }).size
  const side = useTerminalLayout((s) => s.side)
  const toggle = useTerminalLayout((s) => s.toggle)
  const swapSide = useTerminalLayout((s) => s.swapSide)
  const pickerData = {
    scratch: SAMPLE_BUFFER,
    draft: data.text ? { name: data.id || 'draft', text: data.text, cursor: data.cursor } : null,
    examples: EXAMPLES.map((e) => ({ name: e.challenge.id, text: e.challenge.text, cursor: e.challenge.cursor })),
    community: published.map((c) => ({ name: c.id, text: c.text, cursor: c.cursor })),
    builtin,
  }
  return (
    <Box>
      {desktop && (
        <Stack direction="row" sx={{ alignItems: 'center', px: 1.5, py: 0.5, borderBottom: LINE }}>
          <Typography sx={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.6, flex: 1, fontFamily: 'inherit' }}>Menu</Typography>
          <IconButton size="small" aria-label={`Move the menu to the ${side === 'left' ? 'right' : 'left'}`} title="Move to the other side" onClick={swapSide} sx={{ color: 'inherit' }}>
            <SwapHorizIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" aria-label="Hide the menu" title="Hide the menu" onClick={toggle} sx={{ color: 'inherit' }}>
            {side === 'left' ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        </Stack>
      )}
      <Group title="Buffer">
        <BufferPicker buffer={buffer} data={pickerData} onOpen={onOpen} />
      </Group>
      <Group title="Keymaps" summary={km ? `${km} loaded` : 'none'}>
        <KeymapSource onDetails={() => onInfo('keymaps')} />
      </Group>
      <Group title="Plugins" summary={`${on} on`} defaultOpen={false}>
        <PluginList compact onDetails={() => onInfo('plugins')} />
      </Group>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Button size="small" color="inherit" onClick={() => onInfo('about')} sx={{ opacity: 0.7 }}>
          About this terminal
        </Button>
      </Box>
    </Box>
  )
}

/** The drag handle on the inner edge of the menu. Arrow keys resize it too. */
export function SideResizer() {
  const side = useTerminalLayout((s) => s.side)
  const width = useTerminalLayout((s) => s.width)
  const setWidth = useTerminalLayout((s) => s.setWidth)
  const [drag, setDrag] = useState<{ x: number; w: number } | null>(null)
  const sign = side === 'left' ? 1 : -1
  const down = (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ x: e.clientX, w: width })
  }
  const move = (e: PointerEvent<HTMLElement>) => {
    if (drag) setWidth(drag.w + sign * (e.clientX - drag.x))
  }
  const key = (e: KeyboardEvent<HTMLElement>) => {
    const step = e.shiftKey ? 48 : 16
    if (e.key === 'ArrowLeft') setWidth(width - sign * step)
    else if (e.key === 'ArrowRight') setWidth(width + sign * step)
    else return
    e.preventDefault()
  }
  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the menu"
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={MAX_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={key}
      sx={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side === 'left' ? 'right' : 'left']: -3,
        width: 6,
        cursor: 'col-resize',
        zIndex: 2,
        touchAction: 'none',
        bgcolor: drag ? 'var(--t-accent)' : 'transparent',
        opacity: drag ? 0.5 : 1,
        '&:hover, &:focus-visible': { bgcolor: 'var(--t-accent)', opacity: 0.5, outline: 'none' },
      }}
    />
  )
}
