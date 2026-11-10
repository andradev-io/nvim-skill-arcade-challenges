import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import MenuIcon from '@mui/icons-material/Menu'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { VimEditor } from '../components/play/VimEditor'
import type { VimEditorHandle } from '../components/play/VimEditor'
import { KeymapSource } from '../components/terminal/KeymapSource'
import { PluginList } from '../components/terminal/PluginList'
import { Statusline } from '../components/terminal/Statusline'
import type { Snap } from '../components/terminal/Statusline'
import { setEditorSink } from '../components/play/exCommands'
import { EXAMPLES } from '../examples'
import { useCommunity } from '../hooks/useCommunity'
import { useDraft } from '../hooks/useDraft'
import { FILETYPE_CHOICES } from '../plugins/comment'
import { useKeymapStore } from '../store/keymapStore'
import { enabledShims, usePluginStore } from '../store/pluginStore'
import { SAMPLE_BUFFER, useTerminalStore } from '../store/terminalStore'
import type { TerminalBuffer } from '../store/terminalStore'

const BG = '#0c0c0d'
const SIDE_W = 330

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #232324' }}>
      <Typography sx={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'primary.main', mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

function BufferItem({ b, active, onOpen }: { b: TerminalBuffer; active: boolean; onOpen: (b: TerminalBuffer) => void }) {
  return (
    <ListItemButton dense selected={active} onClick={() => onOpen(b)} sx={{ borderRadius: '8px', py: 0.25 }}>
      <ListItemText primary={b.name} slotProps={{ primary: { sx: { fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } } }} />
    </ListItemButton>
  )
}

/** The Terminal page: a full-screen Vim with a side menu for keymaps, buffers and help. */
export function TerminalPage() {
  const { data } = useDraft()
  const community = useCommunity()
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTab = useTerminalStore((s) => s.active)
  const buffer = tabs[activeTab]
  const run = useTerminalStore((s) => s.run)
  const open = useTerminalStore((s) => s.open)
  const reset = useTerminalStore((s) => s.reset)
  const newTab = useTerminalStore((s) => s.newTab)
  const closeTab = useTerminalStore((s) => s.closeTab)
  const goTab = useTerminalStore((s) => s.goTab)
  const [note, setNote] = useState('')
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const maps = useKeymapStore((s) => s.maps)
  const enabled = useKeymapStore((s) => s.enabled)
  const active = useMemo(() => (enabled ? maps : []), [enabled, maps])
  const detected = usePluginStore((s) => s.detected)
  const overrides = usePluginStore((s) => s.overrides)
  const setFt = useTerminalStore((s) => s.setFt)
  const shims = useMemo(() => enabledShims({ detected, overrides }), [detected, overrides])
  const wide = useMediaQuery('(min-width:900px)')
  // phones start with the menu closed (one tap away); wide screens always show it
  const [menu, setMenu] = useState(false)
  const editor = useRef<VimEditorHandle>(null)
  const [snap, setSnap] = useState<Snap>({ mode: 'normal', row: 1, col: 0 })
  const [keys, setKeys] = useState<string[]>([])
  const showMenu = wide || menu

  useEffect(() => {
    const t = setTimeout(() => editor.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [run])

  // commands the editor cannot do itself (tabs, buffers, messages) come back to this page
  useEffect(() => {
    const t = useTerminalStore.getState
    setEditorSink({
      note: (text) => {
        clearTimeout(noteTimer.current)
        setNote(text)
        noteTimer.current = setTimeout(() => setNote(''), 5000)
      },
      tab: (action) => {
        // keep the text of the tab we are leaving
        const ed = editor.current
        if (ed) t().save(ed.text(), ed.cursor())
        if (action === 'new') t().newTab()
        else if (action === 'close') t().closeTab()
        else t().stepTab(action === 'next' ? 1 : -1)
      },
    })
    return () => {
      setEditorSink({})
      clearTimeout(noteTimer.current)
    }
  }, [])

  const onSync = () => {
    const ed = editor.current
    if (!ed) return
    const c = ed.cursor()
    const mode = ed.mode()
    setSnap((p) => (p.mode === mode && p.row === c[0] && p.col === c[1] ? p : { mode, row: c[0], col: c[1] }))
    // the store always holds the live text: leaving the page or switching tab never loses it
    useTerminalStore.getState().save(ed.text(), c)
  }
  const onKey = (key: string) => {
    setKeys((k) => [...k.slice(-11), key === ' ' ? '␣' : key])
    return false
  }
  const load = (b: TerminalBuffer) => {
    open(b)
    if (!wide) setMenu(false)
  }

  const published = community.status === 'ready' ? community.items : []

  return (
    <Box
      className="dark"
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        flex: 1,
        minHeight: 0,
        bgcolor: BG,
        color: '#dcdcdc',
        fontFamily: 'inherit',
      }}
    >
      <Collapse in={showMenu} orientation="vertical" sx={{ display: { md: 'none' }, flexShrink: 0 }} unmountOnExit={false}>
        <Box sx={{ maxHeight: '55dvh', overflowY: 'auto', bgcolor: '#111112', borderBottom: '1px solid #232324' }}>
          <SideContent buffer={buffer} published={published} data={data} onOpen={load} />
        </Box>
      </Collapse>
      <Box
        component="aside"
        aria-label="Terminal menu"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: SIDE_W,
          flexShrink: 0,
          overflowY: 'auto',
          bgcolor: '#111112',
          borderRight: '1px solid #232324',
        }}
      >
        <SideContent buffer={buffer} published={published} data={data} onOpen={load} />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
        <Stack direction="row" sx={{ alignItems: 'center', bgcolor: '#161617', borderBottom: '1px solid #232324', minHeight: 34 }}>
          <IconButton
            size="small"
            aria-label="Toggle the menu"
            onClick={() => setMenu((m) => !m)}
            sx={{ display: { md: 'none' }, color: '#bdbdbd', mx: 0.5 }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>
          <Stack direction="row" sx={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
            {tabs.map((t, i) => (
              <Stack
                key={t.id}
                direction="row"
                onClick={() => i !== activeTab && goTab(i)}
                sx={{
                  alignItems: 'center',
                  gap: 0.5,
                  pl: 1.5,
                  pr: 0.5,
                  py: 0.75,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  bgcolor: i === activeTab ? BG : 'transparent',
                  opacity: i === activeTab ? 1 : 0.6,
                  borderRight: '1px solid #232324',
                  borderTop: `2px solid ${i === activeTab ? '#b4b96b' : 'transparent'}`,
                }}
              >
                {t.name}
                {tabs.length > 1 && (
                  <IconButton
                    size="small"
                    aria-label={`Close ${t.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(i)
                    }}
                    sx={{ color: 'inherit', p: 0.25 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </Stack>
            ))}
            <IconButton size="small" aria-label="New tab" onClick={() => newTab()} sx={{ color: '#bdbdbd', mx: 0.5 }}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
          <Select
            size="small"
            variant="standard"
            disableUnderline
            value={buffer.ft}
            onChange={(e) => setFt(e.target.value)}
            aria-label="Filetype"
            title="Filetype (comment characters)"
            sx={{ fontSize: 12.5, color: '#bdbdbd', mr: 1 }}
          >
            {(FILETYPE_CHOICES.includes(buffer.ft) ? FILETYPE_CHOICES : [buffer.ft, ...FILETYPE_CHOICES]).map((f) => (
              <MenuItem key={f} value={f} dense>
                {f}
              </MenuItem>
            ))}
          </Select>
          <Button size="small" color="inherit" onClick={() => reset()} sx={{ opacity: 0.7, mr: 1, whiteSpace: 'nowrap' }}>
            Reset buffer
          </Button>
        </Stack>
        <Box
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) editor.current?.focus()
          }}
          sx={{
            flex: 1,
            minHeight: 0,
            '& > div': { height: '100%', border: 'none', borderRadius: 0, bgcolor: BG },
            '& .cm-editor': { height: '100%', backgroundColor: `${BG} !important`, color: '#e6e6e6' },
            '& .cm-editor.cm-focused': { outline: 'none' },
            '& .cm-scroller': { lineHeight: 1.65 },
            '& .cm-content': { padding: '12px 4px' },
          }}
        >
          <VimEditor
            key={`${run}|${buffer.id}`}
            ref={editor}
            initialText={buffer.text}
            initialCursor={buffer.cursor}
            onKey={onKey}
            onSync={onSync}
            maps={active}
            plugins={shims}
            filetype={buffer.ft}
            size="fill"
          />
        </Box>
        <Statusline snap={snap} name={buffer.name} keys={keys} maps={active.filter((m) => !m.note).length} note={note} />
      </Box>
    </Box>
  )
}

function SideContent({
  buffer,
  published,
  data,
  onOpen,
}: {
  buffer: TerminalBuffer
  published: { id: string; title: string; text: string; cursor: [number, number] }[]
  data: { id: string; title: string; text: string; cursor: [number, number] }
  onOpen: (b: TerminalBuffer) => void
}) {
  const draft: TerminalBuffer = { name: data.id || 'draft', text: data.text, cursor: data.cursor }
  return (
    <Box>
      <Group title="Keymaps">
        <KeymapSource />
      </Group>
      <Group title="Plugins">
        <PluginList />
      </Group>
      <Group title="Buffers">
        <List dense disablePadding>
          <BufferItem b={SAMPLE_BUFFER} active={buffer.name === SAMPLE_BUFFER.name} onOpen={onOpen} />
          {data.text && <BufferItem b={draft} active={buffer.name === draft.name} onOpen={onOpen} />}
        </List>
        <Typography sx={{ fontSize: 11, opacity: 0.55, mt: 1.5, mb: 0.5 }}>Examples</Typography>
        <List dense disablePadding>
          {EXAMPLES.map((e) => (
            <BufferItem
              key={e.challenge.id}
              b={{ name: e.challenge.id, text: e.challenge.text, cursor: e.challenge.cursor }}
              active={buffer.name === e.challenge.id}
              onOpen={onOpen}
            />
          ))}
        </List>
        {published.length > 0 && (
          <>
            <Typography sx={{ fontSize: 11, opacity: 0.55, mt: 1.5, mb: 0.5 }}>Community</Typography>
            <List dense disablePadding>
              {published.map((c) => (
                <BufferItem key={c.id} b={{ name: c.id, text: c.text, cursor: c.cursor }} active={buffer.name === c.id} onOpen={onOpen} />
              ))}
            </List>
          </>
        )}
      </Group>
      <Group title="Good to know">
        <Typography variant="body2" sx={{ fontSize: 12.5, lineHeight: 1.7, opacity: 0.8 }}>
          A free sandbox: nothing is scored or counted. This is a Vim emulation in the browser, not your Neovim, so plugins
          are imitated (see Plugins) rather than run, and a few commands behave a little differently. Esc stays with Vim. Typing <code>:</code> opens the
          command line.
        </Typography>
      </Group>
    </Box>
  )
}
