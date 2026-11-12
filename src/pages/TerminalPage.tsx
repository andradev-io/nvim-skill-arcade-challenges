import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import TuneIcon from '@mui/icons-material/Tune'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Popover from '@mui/material/Popover'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { VimEditor } from '../components/play/VimEditor'
import type { VimEditorHandle } from '../components/play/VimEditor'
import { CommandPalette } from '../components/terminal/CommandPalette'
import type { PaletteItem } from '../components/terminal/CommandPalette'
import { InfoDialog } from '../components/terminal/InfoDialog'
import type { InfoTab } from '../components/terminal/InfoDialog'
import { Statusline } from '../components/terminal/Statusline'
import type { Snap } from '../components/terminal/Statusline'
import { setEditorSink } from '../components/play/exCommands'
import { useCommunity } from '../hooks/useCommunity'
import { useBuiltin } from '../hooks/useBuiltin'
import { shortName, toChallenge } from '../core/builtin'
import { hintSteps, nextChallenge, orderedBuiltin } from '../core/terminalUx'
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
  const roomy = useMediaQuery('(min-width:700px)')
  // phones start with the menu closed (one tap away); wide screens always show it
  const [menu, setMenu] = useState(false)
  const editor = useRef<VimEditorHandle>(null)
  const [snap, setSnap] = useState<Snap>({ mode: 'normal', row: 1, col: 0 })
  const [keys, setKeys] = useState<string[]>([])
  const [palette, setPalette] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [settings, setSettings] = useState<HTMLElement | null>(null)
  // hints belong to one attempt: a retry, another buffer or tab starts again from none
  const attempt = `${run}|${buffer.id}`
  const [hintState, setHintState] = useState({ attempt, n: 0 })
  const hints = hintState.attempt === attempt ? hintState.n : 0
  const [bests, setBests] = useState<Record<string, number>>({})
  const [counted, setCounted] = useState<unknown>(null)
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

  // the fewest keys this session for each challenge, so a retry has something to beat (each solve counted once)
  const passed = play.state.passed
  const challengeId = buffer.challenge?.id
  if (passed && passed !== counted) {
    setCounted(passed)
    if (challengeId && !(bests[challengeId] && bests[challengeId] <= passed.keys)) setBests({ ...bests, [challengeId]: passed.keys })
  }

  const next = useMemo(() => (buffer.challenge ? nextChallenge(builtin, buffer.challenge.id) : null), [builtin, buffer.challenge])
  const dirty = buffer.text !== buffer.orig.text

  const toBuffer = (c: (typeof builtin)[number]): TerminalBuffer => ({ name: shortName(c), text: c.text, cursor: c.cursor, challenge: c })
  const load = (b: TerminalBuffer) => {
    open(b)
    if (!wide) setMenu(false)
  }
  useEffect(() => {
    const t = setTimeout(() => {
      // a dialog that is open keeps the focus
      if (!document.querySelector('[role="dialog"]')) editor.current?.focus()
    }, 60)
    return () => clearTimeout(t)
  }, [run])

  const say = (text: string) => {
    clearTimeout(noteTimer.current)
    setNote(text)
    noteTimer.current = setTimeout(() => setNote(''), 5000)
  }
  const revealHint = () => {
    if (!judged) return say('No challenge is open: pick a built-in one in the menu')
    const total = hintSteps(judged).length
    setHintState({ attempt, n: Math.min(total, hints + 1) })
  }
  const retry = () => {
    if (!buffer.challenge) return say('No challenge to retry: pick a built-in one in the menu')
    reset()
  }
  const goNext = () => {
    if (next) load(toBuffer(next))
    else say(buffer.challenge ? 'That was the last challenge' : 'No challenge is open')
  }
  // the editor reaches the page through one stable sink that always calls the latest handlers
  const actions = useRef({ say, revealHint, retry, goNext })
  useEffect(() => {
    actions.current = { say, revealHint, retry, goNext }
  })

  // commands the editor cannot do itself (tabs, buffers, messages) come back to this page
  useEffect(() => {
    const t = useTerminalStore.getState
    setEditorSink({
      note: (text) => actions.current.say(text),
      tab: (action) => {
        // keep the text of the tab we are leaving
        const ed = editor.current
        if (ed) t().save(ed.text(), ed.cursor())
        if (action === 'new') t().newTab()
        else if (action === 'close') t().closeTab()
        else t().stepTab(action === 'next' ? 1 : -1)
      },
      action: (name) => {
        if (name === 'retry') actions.current.retry()
        // (retry, hint and next judge the buffer open right now)
        else if (name === 'hint') actions.current.revealHint()
        else if (name === 'next') actions.current.goNext()
        else setPalette(true)
      },
    })
    return () => {
      setEditorSink({})
      clearTimeout(noteTimer.current)
    }
  }, [])

  // Ctrl+K opens the palette from anywhere on the page (Vim does not use it in normal mode)
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const onSync = () => {
    const ed = editor.current
    if (!ed) return
    const c = ed.cursor()
    const mode = ed.mode()
    const pending = ed.pending()
    const recording = ed.recording()
    setSnap((p) =>
      p.mode === mode && p.row === c[0] && p.col === c[1] && (p.pending ?? '') === pending && (p.recording ?? null) === recording
        ? p
        : { mode, row: c[0], col: c[1], pending, recording },
    )
    // the store always holds the live text: leaving the page or switching tab never loses it
    useTerminalStore.getState().save(ed.text(), c)
    if (judged) play.onSync()
  }
  const onKey = (key: string) => {
    setKeys((k) => [...k.slice(-11), key === ' ' ? '␣' : key])
    if (judged) play.onKey(key, editor.current?.mode() ?? 'normal')
    return false
  }

  const published = community.status === 'ready' ? community.items : []

  const askReset = () => (dirty ? setConfirmReset(true) : reset())
  const palItems: PaletteItem[] = [
    ...(buffer.challenge
      ? [
          { id: 'a-retry', group: 'Action', label: 'Retry this challenge', hint: ':retry', run: retry },
          { id: 'a-hint', group: 'Action', label: 'Show a hint', hint: ':hint', run: revealHint },
          ...(next ? [{ id: 'a-next', group: 'Action', label: `Next challenge: ${next.title}`, hint: ':nextchallenge', run: goNext }] : []),
        ]
      : []),
    { id: 'a-newtab', group: 'Action', label: 'New tab', hint: ':tabnew', run: () => newTab() },
    { id: 'a-reset', group: 'Action', label: 'Reset buffer', run: askReset },
    { id: 'a-menu', group: 'Action', label: sideOpen ? 'Hide the menu' : 'Show the menu', run: () => (wide ? toggleSide() : setMenu((m) => !m)) },
    { id: 'a-keymaps', group: 'Info', label: 'Keymaps and what works here', run: () => setInfo('keymaps') },
    { id: 'a-plugins', group: 'Info', label: 'Plugins', run: () => setInfo('plugins') },
    ...tabs.map((t, i) => ({ id: `tab-${t.id}`, group: 'Tab', label: t.name, hint: i === activeTab ? 'current' : undefined, run: () => goTab(i) })),
    ...THEMES.map((t) => ({ id: `theme-${t.id}`, group: 'Theme', label: t.name, hint: t.id === theme.id ? 'current' : undefined, run: () => setTheme(t.id) })),
    ...FILETYPE_CHOICES.map((f) => ({ id: `ft-${f}`, group: 'Filetype', label: f, hint: f === buffer.ft ? 'current' : undefined, run: () => setFt(f) })),
    ...orderedBuiltin(builtin).map((c) => ({ id: `ch-${c.id}`, group: 'Challenge', label: `${c.area}: ${c.title}`, hint: `level ${c.level}`, run: () => load(toBuffer(c)) })),
  ]

  const tabKey = (e: KeyboardEvent<HTMLElement>, i: number) => {
    const to = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1
    if (to < 0) return
    e.preventDefault()
    goTab(to)
  }

  const controls = (
    <>
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
      <Button
        size="small"
        color="inherit"
        onClick={() => {
          setSettings(null)
          askReset()
        }}
        sx={{ opacity: 0.7, mr: 1, whiteSpace: 'nowrap' }}
      >
        Reset buffer
      </Button>
    </>
  )

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
          <Stack direction="row" role="tablist" aria-label="Buffers" sx={{ flex: 1, minWidth: 0, overflowX: 'auto' }}>
            {tabs.map((t, i) => (
              <Stack
                key={t.id}
                direction="row"
                sx={{
                  alignItems: 'center',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  bgcolor: i === activeTab ? BG : 'transparent',
                  opacity: i === activeTab ? 1 : 0.6,
                  borderRight: LINE,
                  borderTop: `2px solid ${i === activeTab ? 'var(--t-accent)' : 'transparent'}`,
                }}
              >
                <ButtonBase
                  role="tab"
                  aria-selected={i === activeTab}
                  tabIndex={i === activeTab ? 0 : -1}
                  onClick={() => i !== activeTab && goTab(i)}
                  onKeyDown={(e) => tabKey(e, i)}
                  sx={{ pl: 1.5, pr: tabs.length > 1 ? 0.5 : 1.5, py: 0.75, fontSize: 13, fontFamily: 'inherit', color: 'inherit' }}
                >
                  {t.name}
                </ButtonBase>
                {tabs.length > 1 && (
                  <IconButton size="small" aria-label={`Close ${t.name}`} onClick={() => closeTab(i)} sx={{ color: 'inherit', p: 0.25, mr: 0.5 }}>
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </Stack>
            ))}
            <IconButton size="small" aria-label="New tab" onClick={() => newTab()} sx={{ color: 'var(--t-fg)', mx: 0.5 }}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
          <IconButton size="small" aria-label="Command palette" title="Command palette (Ctrl+K)" onClick={() => setPalette(true)} sx={{ color: 'var(--t-fg)', mx: 0.5 }}>
            <SearchIcon sx={{ fontSize: 18 }} />
          </IconButton>
          {roomy ? (
            controls
          ) : (
            <>
              <IconButton size="small" aria-label="Terminal settings" title="Theme, filetype, reset" onClick={(e) => setSettings(e.currentTarget)} sx={{ color: 'var(--t-fg)', mx: 0.5 }}>
                <TuneIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <Popover
                open={!!settings}
                anchorEl={settings}
                onClose={() => setSettings(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                className="dark"
              >
                <Stack sx={{ p: 1.5, gap: 1, alignItems: 'flex-start' }}>{controls}</Stack>
              </Popover>
            </>
          )}
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
        {buffer.challenge && judged && (
          <ChallengeBar
            key={`${run}|${buffer.id}`}
            challenge={buffer.challenge}
            state={play.state}
            actual={buffer.text}
            hints={hints}
            onHint={revealHint}
            onRetry={retry}
            onNext={next ? goNext : null}
            best={bests[buffer.challenge.id]}
          />
        )}
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
      <CommandPalette
        open={palette}
        items={palItems}
        onClose={() => {
          setPalette(false)
          setTimeout(() => editor.current?.focus(), 0)
        }}
      />
      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)} className="dark" aria-labelledby="reset-title">
        <DialogTitle id="reset-title">Reset this buffer?</DialogTitle>
        <DialogContent>
          <DialogContentText>{`What you typed in "${buffer.name}" is thrown away and the buffer goes back to how it started.`}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => setConfirmReset(false)}>
            Keep editing
          </Button>
          <Button
            color="warning"
            onClick={() => {
              setConfirmReset(false)
              reset()
            }}
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
