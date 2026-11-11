import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { lazy, Suspense, useMemo, useState } from 'react'
import { filterAi, filterOptions, langOf, NO_FILTERS, parsePrompt, sortNewest } from '../../core/ai'
import type { AiFilters } from '../../core/ai'
import { isPlayable } from '../../core/compare'
import type { Challenge } from '../../core/types'
import { useCommunity } from '../../hooks/useCommunity'
import { navigate } from '../../hooks/useRoute'
import { useTerminalStore } from '../../store/terminalStore'
import { CodeBlock } from '../common/CodeBlock'

// the Vim editor (CodeMirror) is only loaded when someone presses Play
const PlaySession = lazy(() => import('../play/PlaySession').then((m) => ({ default: m.PlaySession })))

function PlayDialog({ c, onClose }: { c: Challenge; onClose: () => void }) {
  const [run, setRun] = useState(0)
  const [expectedOpen, setExpectedOpen] = useState(false)
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="ai-play-title">
      <DialogTitle id="ai-play-title">{c.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Typography>{c.brief}</Typography>
          {isPlayable(c) ? (
            <Suspense fallback={<Typography variant="body2">Loading the editor ...</Typography>}>
              <PlaySession
                key={run}
                draft={c}
                onReset={() => setRun((n) => n + 1)}
                expectedOpen={expectedOpen}
                onToggleExpected={() => setExpectedOpen((o) => !o)}
              />
            </Suspense>
          ) : (
            <Typography variant="body2" color="text.secondary">
              This one is judged only in Neovim (:ArcadeAI).
            </Typography>
          )}
          {expectedOpen && c.expect.text !== undefined && <CodeBlock label="Expected end state">{c.expect.text}</CodeBlock>}
          <Button onClick={onClose} sx={{ alignSelf: 'flex-start' }}>
            Close
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <TextField select size="small" label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ minWidth: 140 }}>
      <MenuItem value="">All</MenuItem>
      {options.map((o) => (
        <MenuItem key={o} value={o}>
          {o}
        </MenuItem>
      ))}
    </TextField>
  )
}

export function AiChallenges() {
  const community = useCommunity()
  const openInTerminal = useTerminalStore((s) => s.open)
  const [f, setF] = useState<AiFilters>(NO_FILTERS)
  const [playing, setPlaying] = useState<Challenge | null>(null)
  const all = useMemo(() => sortNewest(community.status === 'ready' ? community.ai : []), [community])
  const options = useMemo(() => filterOptions(all), [all])
  const shown = useMemo(() => filterAi(all, f), [all, f])
  const set = (k: keyof AiFilters) => (v: string) => setF((p) => ({ ...p, [k]: v }))
  const count =
    community.status === 'loading'
      ? 'loading...'
      : community.status === 'error'
        ? 'list unavailable offline'
        : all.length
          ? `${shown.length} of ${all.length}`
          : 'none published yet'

  return (
    <Stack component="section" sx={{ gap: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" component="h1">
          AI challenges
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {count}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '75ch' }}>
        Written every day by a model and kept only if they pass the same checks as any contribution: the safety schema, the
        reference solution replayed in real Neovim, no duplicates. A person reviews each batch before it is published. In
        Neovim, <code>:ArcadeSync</code> then <code>:ArcadeAI</code> plays them; they stay out of your normal runs unless you
        opt in.
      </Typography>
      <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter label="Date" value={f.date} options={options.date} onChange={set('date')} />
        <Filter label="Area" value={f.area} options={options.area} onChange={set('area')} />
        <Filter label="Level" value={f.level} options={options.level} onChange={set('level')} />
        <Filter label="Language" value={f.ft} options={options.ft} onChange={set('ft')} />
        <Filter label="Model" value={f.model} options={options.model} onChange={set('model')} />
        <Button size="small" onClick={() => setF(NO_FILTERS)} disabled={Object.values(f).every((v) => !v)}>
          Clear filters
        </Button>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 2 }}>
        {shown.map((c) => {
          const p = parsePrompt(c.prompt)
          return (
            <Paper key={c.id} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>{c.title}</Typography>
              <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
                {c.date && <Chip size="small" label={c.date} />}
                <Chip size="small" variant="outlined" label={c.area} />
                <Chip size="small" variant="outlined" label={`level ${c.level}`} />
                <Chip size="small" variant="outlined" label={langOf(c)} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                {c.brief}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {c.model ? `model ${c.model}` : 'model not recorded'}
                {p ? ` · prompt v${p.version} (${p.hash})` : ''}
                {c.date ? ` · generated for ${c.date}` : ''}
              </Typography>
              <Stack direction="row" sx={{ gap: 1 }}>
                <Button size="small" variant="contained" onClick={() => setPlaying(c)}>
                  Play
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    openInTerminal({ name: c.id, text: c.text, cursor: c.cursor })
                    navigate('terminal')
                  }}
                >
                  Open in terminal
                </Button>
              </Stack>
            </Paper>
          )
        })}
      </Box>
      {playing && <PlayDialog c={playing} onClose={() => setPlaying(null)} />}
    </Stack>
  )
}
