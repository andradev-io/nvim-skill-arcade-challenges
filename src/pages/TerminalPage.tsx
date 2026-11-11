import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import MenuIcon from '@mui/icons-material/Menu'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useEffect, useMemo, useRef, useState } from 'react'
import { VimEditor } from '../components/play/VimEditor'
import type { VimEditorHandle } from '../components/play/VimEditor'
import { InfoDialog } from '../components/terminal/InfoDialog'
import type { InfoTab } from '../components/terminal/InfoDialog'
import { Statusline } from '../components/terminal/Statusline'
import type { Snap } from '../components/terminal/Statusline'
import { setEditorSink } from '../components/play/exCommands'
import { useCommunity } from '../hooks/useCommunity'
import { useBuiltin } from '../hooks/useBuiltin'
import { toChallenge } from '../core/builtin'
import type { Challenge } from '../core/types'
import { usePlay } from '../hooks/usePlay'
import { ChallengeBar } from '../components/terminal/ChallengeBar'
import { SideContent, SideResizer } from '../components/terminal/TerminalSide'
import { useDraft } from '../hooks/useDraft'
import { THEMES, themeById, themeVars } from '../components/terminal/themes'
import { useThemeStore } from '../store/themeStore'
import { FILETYPE_CHOICES } from '../plugins/comment'
import { useKeymapStore } from '../store/keymapStore'
import { enabledShims, usePluginStore } from '../store/pluginStore'
import { useTerminalStore } from '../store/terminalStore'
import { useTerminalLayout } from '../store/terminalLayoutStore'
import type { TerminalBuffer } from '../store/terminalStore'

const BG = 'var(--t-bg)'
const LINE = '1px solid var(--t-line)'

/** Stands in for the challenge when the open buffer is not a judged one; nothing reads it then. */
const NO_CHALLENGE: Challenge = {
  id: '', title: '', area: '', level: 1, brief: '', text: '', cursor: [1, 0], expect: { text: '__not_a_challenge__' }, solution: '', why: '',
}

/** The Terminal page: a full-screen Vim with a side menu for keymaps, buffers and help. */
export function TerminalPage() {
  const { data } = useDraft()
  const community = useCommunity()
  const builtin = useBuiltin()
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTab = useTerminalStore((s) => s.active)
  const buffer = tabs[activeTab]
  const run = useTerminalStore((s) => s.run)
  const open = useTerminalStore((s) => s.open)
  const reset = useTerminalStore((s) => s.reset)
  const newTab = useTerminalStore((s) => s.newTab)
  const closeTab = useTerminalStore((s) => s.closeTab)
  const goTab = useTerminalStore((s) => s.goTab)
  const themeId = useThemeStore((s) => s.id)
  const setTheme = useThemeStore((s) => s.setTheme)
  const theme = themeById(themeId)
  const [info, setInfo] = useState<InfoTab | null>(null)
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
  const side = useTerminalLayout((s) => s.side)
  const sideWidth = useTerminalLayout((s) => s.width)
  const sideOpen = useTerminalLayout((s) => s.open)
  const toggleSide = useTerminalLayout((s) => s.toggle)
  const showMenu = !wide && menu
  // a built-in challenge opened from the menu is judged like in the game: end state, normal mode, keys and time
  const judged = useMemo(() => toChallenge(buffer.challenge), [buffer.challenge])
  const play = usePlay(judged ?? NO_CHALLENGE, editor)
  const resetPlay = play.reset
  useEffect(() => {
    resetPlay()
  }, [run, buffer.id, resetPlay])

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
    if (judged) play.onSync()
  }
  const onKey = (key: string) => {
    setKeys((k) => [...k.slice(-11), key === ' ' ? '␣' : key])
    if (judged) play.onKey(key, editor.current?.mode() ?? 'normal')
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
        flexDirection: { xs: 'column', md: side === 'right' ? 'row-reverse' : 'row' },
        flex: 1,
        minHeight: 0,
        bgcolor: BG,
        color: 'var(--t-fg)',
        '&&': themeVars(theme),
        fontFamily: 'inherit',
      }}
    >
      <Collapse in={showMenu} orientation="vertical" sx={{ display: { md: 'none' }, flexShrink: 0 }} unmountOnExit={false}>
        <Box sx={{ maxHeight: '55dvh', overflowY: 'auto', bgcolor: 'var(--t-side)', borderBottom: LINE }}>
          <SideContent buffer={buffer} published={published} builtin={builtin} data={data} onOpen={load} onInfo={setInfo} />
        </Box>
      </Collapse>
      <Box
        sx={{
          display: { xs: 'none', md: sideOpen ? 'block' : 'none' },
          position: 'relative',
          width: sideWidth,
          flexShrink: 0,
          [side === 'left' ? 'borderRight' : 'borderLeft']: LINE,
        }}
      >
        <Box component="aside" aria-label="Terminal menu" sx={{ height: '100%', overflowY: 'auto', bgcolor: 'var(--t-side)' }}>
          <SideContent buffer={buffer} published={published} builtin={builtin} data={data} onOpen={load} onInfo={setInfo} desktop />
        </Box>
        <SideResizer />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
        <Stack direction="row" sx={{ alignItems: 'center', bgcolor: 'var(--t-bar)', borderBottom: LINE, minHeight: 34 }}>
          <IconButton
            size="small"
            aria-label="Toggle the menu"
            onClick={() => setMenu((m) => !m)}
            sx={{ display: { md: 'none' }, color: 'var(--t-fg)', mx: 0.5 }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>
          {!sideOpen && side === 'left' && (
            <IconButton
              size="small"
              aria-label="Show the menu"
              title="Show the menu"
              onClick={toggleSide}
              sx={{ display: { xs: 'none', md: 'inline-flex' }, color: 'var(--t-fg)', mx: 0.5 }}
            >
              <MenuIcon fontSize="small" />
            </IconButton>
          )}
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
                  borderRight: LINE,
                  borderTop: `2px solid ${i === activeTab ? 'var(--t-accent)' : 'transparent'}`,
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
            <IconButton size="small" aria-label="New tab" onClick={() => newTab()} sx={{ color: 'var(--t-fg)', mx: 0.5 }}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
          <Select
            size="small"
            variant="standard"
            disableUnderline
            value={theme.id}
            onChange={(e) => setTheme(e.target.value)}
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
            value={buffer.ft}
            onChange={(e) => setFt(e.target.value)}
            aria-label="Filetype"
            title="Filetype (comment characters)"
            sx={{ fontSize: 12.5, color: 'var(--t-fg)', mr: 1 }}
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
          {!sideOpen && side === 'right' && (
            <IconButton
              size="small"
              aria-label="Show the menu"
              title="Show the menu"
              onClick={toggleSide}
              sx={{ display: { xs: 'none', md: 'inline-flex' }, color: 'var(--t-fg)', mx: 0.5 }}
            >
              <MenuIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
        {buffer.challenge && judged && <ChallengeBar challenge={buffer.challenge} state={play.state} onRetry={() => reset()} />}
        <Box
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) editor.current?.focus()
          }}
          sx={{
            flex: 1,
            minHeight: 0,
            '& > div': { height: '100%', border: 'none', borderRadius: 0, bgcolor: BG },
            '& .cm-editor': { height: '100%', backgroundColor: `${BG} !important`, color: 'var(--t-fg)' },
            '& .cm-editor.cm-focused': { outline: 'none' },
            '& .cm-scroller': { lineHeight: 1.65 },
            '& .cm-fat-cursor': { background: 'var(--t-accent) !important', color: 'var(--t-on-accent) !important' },
            '& .cm-gutters': { color: 'var(--t-accent)' },
            '& .cm-selectionBackground': { background: 'var(--t-accent) !important' },
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
      <InfoDialog tab={info} onTab={setInfo} onClose={() => setInfo(null)} />
    </Box>
  )
}
