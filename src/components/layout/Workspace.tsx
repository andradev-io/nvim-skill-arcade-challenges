import FactCheckIcon from '@mui/icons-material/FactCheck'
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
import { lazy, Suspense, useState } from 'react'
import type { ReactNode } from 'react'
import { parOf } from '../../core/schema'
import { useDraft } from '../../hooks/useDraft'
import { DraftForm } from '../draft/DraftForm'
import { ExamplePicker } from '../draft/ExamplePicker'
import { ResultPanel } from '../draft/ResultPanel'
import { JoinBox } from '../join/JoinBox'
import { SimCheck } from '../sim/SimCheck'

// The Vim editor (CodeMirror) is the heaviest part: load it in its own chunk.
const PlayPanel = lazy(() => import('../play/PlayPanel').then((m) => ({ default: m.PlayPanel })))

function Status() {
  const { data, ok, errors } = useDraft()
  const par = parOf(data)
  return (
    <Stack sx={{ gap: 1, p: 2, pb: 1 }}>
      <Typography sx={{ fontWeight: 700 }} noWrap>
        {data.title || 'Untitled challenge'}
      </Typography>
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Chip size="small" color={ok ? 'success' : 'warning'} label={ok ? 'valid' : `${errors.length} to fix`} />
        <Chip size="small" variant="outlined" label={data.area} />
        <Chip size="small" variant="outlined" label={`level ${data.level}`} />
        {par > 0 && <Chip size="small" variant="outlined" label={`par ${par} keys`} />}
      </Stack>
    </Stack>
  )
}

function Panel({ show, children }: { show: boolean; children: ReactNode }) {
  // every panel stays mounted: switching tabs must not lose a round in progress
  return (
    <Box role="tabpanel" hidden={!show} sx={{ p: 2 }}>
      {children}
    </Box>
  )
}

function Tools() {
  const [tab, setTab] = useState(0)
  const { errors } = useDraft()
  return (
    <Paper sx={{ alignSelf: 'start', position: { md: 'sticky' }, top: 16, overflow: 'hidden' }}>
      <Status />
      <Tabs
        value={tab}
        onChange={(_, v: number) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ '& .MuiTab-root': { minWidth: 0, px: 1.5 } }}
      >
        <Tab icon={<PlayArrowIcon fontSize="small" />} iconPosition="start" label="Play" />
        <Tab icon={<FactCheckIcon fontSize="small" />} iconPosition="start" label="Check" />
        <Tab icon={<TerminalIcon fontSize="small" />} iconPosition="start" label="Neovim" />
        <Tab
          iconPosition="start"
          icon={
            <Badge color="warning" badgeContent={errors.length} max={9}>
              <SendIcon fontSize="small" />
            </Badge>
          }
          label="Submit"
        />
      </Tabs>
      <Box sx={{ maxHeight: { md: 'calc(100vh - 190px)' }, overflowY: 'auto' }}>
        <Panel show={tab === 0}>
          <Suspense fallback={null}>
            <PlayPanel />
          </Suspense>
        </Panel>
        <Panel show={tab === 1}>
          <SimCheck />
        </Panel>
        <Panel show={tab === 2}>
          <JoinBox />
        </Panel>
        <Panel show={tab === 3}>
          <ResultPanel />
        </Panel>
      </Box>
    </Paper>
  )
}

/** Form on the left, a sticky tabbed toolbox (play, check, join, submit) on the right. */
export function Workspace() {
  return (
    <Box
      id="workspace"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
        // phones: examples, then the toolbox (so you can play at once), then the long form
        gridTemplateAreas: { xs: '"picker" "tools" "form"', md: '"picker tools" "form tools"' },
        gridTemplateRows: { md: 'auto 1fr' },
        gap: 2,
        alignItems: 'start',
        scrollMarginTop: 16,
      }}
    >
      <Box sx={{ gridArea: 'picker' }}>
        <ExamplePicker />
      </Box>
      <Box sx={{ gridArea: 'tools', alignSelf: 'stretch' }}>
        <Tools />
      </Box>
      <Box sx={{ gridArea: 'form' }}>
        <DraftForm />
      </Box>
    </Box>
  )
}
