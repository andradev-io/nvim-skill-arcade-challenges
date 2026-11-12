import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { filterCommands } from '../../core/terminalUx'

export interface PaletteItem {
  id: string
  label: string
  group: string
  /** Shown on the right (a key or an ex command). */
  hint?: string
  run: () => void
}

/** Ctrl+K: type a few letters to open a challenge, switch theme, change tab or run an action. */
export function CommandPalette({ open, items, onClose }: { open: boolean; items: PaletteItem[]; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" className="dark" aria-label="Command palette" slotProps={{ paper: { sx: { alignSelf: 'flex-start', mt: '12vh' } } }}>
      {/* the dialog unmounts its content when closed, so every opening starts with an empty search */}
      <PaletteBody items={items} onClose={onClose} />
    </Dialog>
  )
}

function PaletteBody({ items, onClose }: { items: PaletteItem[]; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const list = useMemo(() => filterCommands(items, q, 40), [items, q])
  const active = Math.min(at, Math.max(0, list.length - 1))
  const box = useRef<HTMLUListElement>(null)
  const input = useRef<HTMLInputElement>(null)

  // the dialog's own focus trap can land on its container after autoFocus: take the focus once it has settled
  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    box.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, list])

  const choose = (i: number) => {
    const item = list[i]
    if (!item) return
    onClose()
    // let the dialog release focus before the action (it may focus the editor)
    setTimeout(item.run, 0)
  }

  return (
    <>
      <TextField
        autoFocus
        inputRef={input}
        fullWidth
        placeholder="Type to search: challenges, themes, tabs, actions"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setAt(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setAt(Math.min(list.length - 1, active + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setAt(Math.max(0, active - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            choose(active)
          }
        }}
        slotProps={{ htmlInput: { role: 'combobox', 'aria-expanded': true, 'aria-controls': 'palette-list', 'aria-activedescendant': list[active] ? `pal-${list[active].id}` : undefined } }}
        sx={{ '& fieldset': { border: 'none' }, borderBottom: '1px solid var(--t-line, rgba(255,255,255,0.12))' }}
      />
      <Box component="ul" id="palette-list" role="listbox" ref={box} sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: '50vh', overflowY: 'auto' }}>
        {list.map((it, i) => (
          <Box
            component="li"
            key={it.id}
            id={`pal-${it.id}`}
            role="option"
            aria-selected={i === active}
            onMouseMove={() => setAt(i)}
            onClick={() => choose(i)}
            sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, px: 2, py: 0.9, cursor: 'pointer', bgcolor: i === active ? 'action.selected' : 'transparent' }}
          >
            <Typography sx={{ fontSize: 11, opacity: 0.55, width: 78, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'inherit' }}>{it.group}</Typography>
            <Typography sx={{ flex: 1, fontSize: 14, fontFamily: 'inherit' }}>{it.label}</Typography>
            {it.hint && <Typography sx={{ fontSize: 12, opacity: 0.6, fontFamily: 'inherit' }}>{it.hint}</Typography>}
          </Box>
        ))}
        {list.length === 0 && (
          <Typography sx={{ p: 2, opacity: 0.6, fontSize: 13, fontFamily: 'inherit' }}>Nothing matches.</Typography>
        )}
      </Box>
    </>
  )
}
