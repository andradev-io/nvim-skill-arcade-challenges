import CreateIcon from '@mui/icons-material/Create'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SendIcon from '@mui/icons-material/Send'
import TerminalIcon from '@mui/icons-material/Terminal'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { parOf } from '../../core/schema'
import { useDraft } from '../../hooks/useDraft'
import { useUiStore } from '../../store/uiStore'
import type { TabId } from '../../store/uiStore'
import { DraftForm } from '../draft/DraftForm'
import { ExamplePicker } from '../draft/ExamplePicker'
import { ResultPanel } from '../draft/ResultPanel'
import { JoinBox } from '../join/JoinBox'
import { SimCheck } from '../sim/SimCheck'

// The Vim editor (CodeMirror) is the heaviest part: load it in its own chunk.
const PlayPanel = lazy(() => import('../play/PlayPanel').then((m) => ({ default: m.PlayPanel })))
const TerminalPanel = lazy(() => import('../terminal/TerminalPanel').then((m) => ({ default: m.TerminalPanel })))

function Status() {
  const { data, ok, errors } = useDraft()
  const par = parOf(data)
  return (
    <Stack direction="row" sx={{ gap: 1.5, px: 2, py: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <Typography sx={{ fontWeight: 700, minWidth: 0 }} noWrap>
        {data.title || 'Untitled challenge'}
      </Typography>
      <Chip size="small" color={ok ? 'success' : 'warning'} label={ok ? 'valid' : `${errors.length} to fix`} />
      <Chip size="small" variant="outlined" label={data.area} />
      <Chip size="small" variant="outlined" label={`level ${data.level}`} />
      {par > 0 && <Chip size="small" variant="outlined" label={`par ${par} keys`} />}
    </Stack>
  )
}

/** Every panel stays mounted: switching tabs must not lose a round in progress or a half-typed buffer. */
function Panel({ id, width, children }: { id: TabId; width?: number; children: ReactNode }) {
  const tab = useUiStore((s) => s.tab)
  return (
    <Box role="tabpanel" hidden={tab !== id} sx={{ p: { xs: 1.5, md: 2.5 } }}>
      <Box sx={{ maxWidth: width }}>{children}</Box>
    </Box>
  )
}

/** One full-width workspace: a tab bar (Describe, Play, Terminal, Check, Neovim, Submit) and a panel that uses the whole screen. */
export function Workspace() {
  const tab = useUiStore((s) => s.tab)
  const setTab = useUiStore((s) => s.setTab)
  const { errors } = useDraft()
  return (
    <Stack id="workspace" sx={{ gap: 2, scrollMarginTop: 16 }}>
      <ExamplePicker />
      <Paper sx={{ overflow: 'clip' }}>
        <Box sx={{ position: 'sticky', top: 0, zIndex: 5, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          <Status />
          <Tabs
            value={tab}
            onChange={(_, v: TabId) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 1, '& .MuiTab-root': { minWidth: 0, px: 1.5 } }}
          >
            <Tab value="describe" icon={<CreateIcon fontSize="small" />} iconPosition="start" label="Describe" />
            <Tab value="play" icon={<PlayArrowIcon fontSize="small" />} iconPosition="start" label="Play" />
            <Tab value="terminal" icon={<KeyboardIcon fontSize="small" />} iconPosition="start" label="Terminal" />
            <Tab value="check" icon={<FactCheckIcon fontSize="small" />} iconPosition="start" label="Check" />
            <Tab value="neovim" icon={<TerminalIcon fontSize="small" />} iconPosition="start" label="Neovim" />
            <Tab
              value="submit"
              iconPosition="start"
              icon={
                <Badge color="warning" badgeContent={errors.length} max={9}>
                  <SendIcon fontSize="small" />
                </Badge>
              }
              label="Submit"
            />
          </Tabs>
        </Box>
        <Panel id="describe">
          <DraftForm />
        </Panel>
        <Panel id="play" width={1100}>
          <Suspense fallback={null}>
            <PlayPanel />
          </Suspense>
        </Panel>
        <Panel id="terminal">
          <Suspense fallback={null}>
            <TerminalPanel />
          </Suspense>
        </Panel>
        <Panel id="check" width={900}>
          <SimCheck />
        </Panel>
        <Panel id="neovim" width={900}>
          <JoinBox />
        </Panel>
        <Panel id="submit" width={900}>
          <ResultPanel />
        </Panel>
      </Paper>
    </Stack>
  )
}
