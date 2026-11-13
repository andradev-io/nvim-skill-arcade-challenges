import MenuIcon from '@mui/icons-material/Menu'
import SearchIcon from '@mui/icons-material/Search'
import BarChartIcon from '@mui/icons-material/BarChart'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useEffect, useMemo, useRef, useState } from 'react'
import { VimEditor } from '../components/play/VimEditor'
import type { VimEditorHandle } from '../components/play/VimEditor'
import { CommandPalette } from '../components/terminal/CommandPalette'
import type { PaletteItem } from '../components/terminal/CommandPalette'
import { PickerOverlay } from '../components/play/PickerOverlay'
import type { PickerConfig } from '../core/types'
import { InfoDialog } from '../components/terminal/InfoDialog'
import type { InfoTab } from '../components/terminal/InfoDialog'
import { Statusline } from '../components/terminal/Statusline'
import type { Snap } from '../components/terminal/Statusline'
import { WhichKeyOverlay } from '../components/terminal/WhichKeyOverlay'
import { TabBar } from '../components/terminal/TabBar'
import { ControlsPopover, ControlsInline } from '../components/terminal/ControlsPopover'
import { useCommunity } from '../hooks/useCommunity'
import { useBuiltin } from '../hooks/useBuiltin'
import { shortName, toChallenge } from '../core/builtin'
import { hintSteps, nextChallenge, orderedBuiltin } from '../core/terminalUx'
import type { Challenge } from '../core/types'
import { usePlay } from '../hooks/usePlay'
import { trackSession } from '../analytics/track'
import { trackAbandon } from '../analytics/track'
import { ChallengeBar } from '../components/terminal/ChallengeBar'
import { SideContent, SideResizer } from '../components/terminal/TerminalSide'
import { StatsPanel } from '../components/stats/StatsPanel'
import { useDraft } from '../hooks/useDraft'
import { THEMES, themeById, themeVars } from '../components/terminal/themes'
import { useThemeStore } from '../store/themeStore'
import { FILETYPE_CHOICES } from '../plugins/comment'
import { useKeymapStore } from '../store/keymapStore'
import { enabledShims, usePluginStore } from '../store/pluginStore'
import { useTerminalStore } from '../store/terminalStore'
import { useTerminalLayout } from '../store/terminalLayoutStore'
import type { TerminalBuffer } from '../store/terminalStore'
import { buildWhichKeyFromChallenge } from '../core/whichKey'
import type { WhichKeyConfig } from '../core/whichKey'
import { useBestScoreTracking } from '../hooks/useBestScoreTracking'
import { useEditorSink } from '../hooks/useEditorSink'

const BG = 'var(--t-bg)'
const LINE = '1px solid var(--t-line)'

/** Stands in for the challenge when the open buffer is not a judged one; nothing reads it then. */
const NO_CHALLENGE: Challenge = {
  id: '', title: '', area: '', level: 1, brief: '', text: '', cursor: [1, 0], expect: { text: '__not_a_challenge__' }, solution: '', why: '',
}

/** The Terminal page: a full-screen Vim with a side menu for keymaps, buffers and help. */
export function TerminalPage() {
  // anonymous session duration: how long the terminal was open (flushed on unmount via keepalive)
  useEffect(() => {
    const t0 = performance.now()
    return () => trackSession(performance.now() - t0)
  }, [])

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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerConfig, setPickerConfig] = useState<PickerConfig | null>(null)
  const [, setPickerSelection] = useState<number | string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  // hints belong to one attempt: a retry, another buffer or tab starts again from none
  const attempt = `${run}|${buffer.id}`
  const [hintState, setHintState] = useState({ attempt, n: 0 })
  const hints = hintState.attempt === attempt ? hintState.n : 0
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

  // best score tracking extracted to its own hook
  const bests = useBestScoreTracking(play.state.passed, buffer.challenge?.id)

  // fire abandon when the user switches away from a started-but-not-completed challenge
  const prevChallengeRef = useRef<string | null>(null)
  const challengeId = buffer.challenge?.id
  useEffect(() => {
    const prev = prevChallengeRef.current
    if (prev && prev !== challengeId && !play.state.passed && play.state.t0 !== null) {
      const prevBuiltin = builtin.find((c) => c.id === prev)
      trackAbandon(prev, prevBuiltin?.area, prevBuiltin?.level)
    }
    prevChallengeRef.current = challengeId ?? null
  }, [challengeId, play.state.passed, play.state.t0, builtin])

  const next = useMemo(() => (buffer.challenge ? nextChallenge(builtin, buffer.challenge.id) : null), [builtin, buffer.challenge])
  const dirty = buffer.text !== buffer.orig.text
  const whichKeyCfg = useMemo<WhichKeyConfig | null>(() => {
    if (!judged?.which_key) return null
    return buildWhichKeyFromChallenge(judged.which_key)
  }, [judged])

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

  // editor sink wiring extracted to its own hook
  useEditorSink({
    editor,
    actions,
    judged,
    setPickerConfig,
    setPickerOpen,
    setPalette,
    noteTimer,
  })

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
    const whichKey = ed.whichKeyState()
    setSnap((p) =>
      p.mode === mode && p.row === c[0] && p.col === c[1] && (p.pending ?? '') === pending && (p.recording ?? null) === recording && p.whichKey === whichKey
        ? p
        : { mode, row: c[0], col: c[1], pending, recording, whichKey },
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
          <TabBar tabs={tabs} activeTab={activeTab} onGoTab={goTab} onCloseTab={closeTab} onNewTab={newTab} />
          <IconButton size="small" aria-label="Your stats" title="Personal stats" onClick={() => setStatsOpen(true)} sx={{ color: 'var(--t-fg)', mx: 0.5 }}>
            <BarChartIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton size="small" aria-label="Command palette" title="Command palette (Ctrl+K)" onClick={() => setPalette(true)} sx={{ color: 'var(--t-fg)', mx: 0.5 }}>
            <SearchIcon sx={{ fontSize: 18 }} />
          </IconButton>
          {roomy ? (
            <ControlsInline themeId={theme.id} onThemeChange={setTheme} filetype={buffer.ft} onFiletypeChange={setFt} onReset={askReset} />
          ) : (
            <ControlsPopover themeId={theme.id} onThemeChange={setTheme} filetype={buffer.ft} onFiletypeChange={setFt} onReset={askReset} />
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
            newBest={play.state.newBest}
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
            whichKeyConfig={whichKeyCfg}
          />
        </Box>
        <WhichKeyOverlay state={snap.whichKey} />
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
      <PickerOverlay
        open={pickerOpen}
        config={pickerConfig}
        onSelect={(index, item) => {
          setPickerSelection(index)
          setPickerOpen(false)
          if (item.line !== undefined && editor.current) {
            const ed = editor.current
            ed.setCursor({ line: item.line - 1, ch: 0 })
            onSync()
          }
          setTimeout(() => editor.current?.focus(), 0)
        }}
        onClose={() => {
          setPickerOpen(false)
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
      <Drawer anchor="right" open={statsOpen} onClose={() => setStatsOpen(false)} className="dark" slotProps={{ paper: { sx: { bgcolor: 'var(--t-side)', color: 'var(--t-fg)', borderLeft: LINE } } }}>
        <StatsPanel />
      </Drawer>
    </Box>
  )
}