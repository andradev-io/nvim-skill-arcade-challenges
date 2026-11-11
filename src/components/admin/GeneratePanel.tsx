import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { requestGenerate } from '../../auth/api'
import { accessToken } from '../../auth/authStore'
import { authConfig } from '../../auth/config'

// the values the generator and the Worker accept
const AREAS = ['motions', 'textobjects', 'editing', 'search', 'macros', 'registers', 'marks', 'refactor']
const LANGUAGES = ['lua', 'python', 'javascript', 'typescript', 'go', 'cs']
const LEVELS = [1, 2, 3, 4, 5]

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

/** An admin asks for a batch of AI challenges. Nothing runs by itself: this is the only trigger besides the daily one. */
export function GeneratePanel() {
  const [count, setCount] = useState(5)
  const [areas, setAreas] = useState<string[]>([])
  const [levels, setLevels] = useState<number[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [theme, setTheme] = useState('')
  const [dryRun, setDryRun] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ severity: 'success' | 'error'; text: string; link?: string } | null>(null)

  const send = async () => {
    if (!authConfig) return
    setBusy(true)
    setResult(null)
    try {
      const token = await accessToken()
      if (!token) throw new Error('Your session ended. Sign in again.')
      const r = await requestGenerate(authConfig.api, token, { count, areas, levels, languages, theme, dryRun })
      setResult({
        severity: 'success',
        text: r.dryRun
          ? 'Started a dry run: it checks everything and publishes nothing. Read the result in the run summary.'
          : 'Started. When it finishes it opens a pull request for you to review.',
        link: r.actions,
      })
    } catch (e) {
      setResult({ severity: 'error', text: e instanceof Error ? e.message : 'Could not start it.' })
    } finally {
      setBusy(false)
    }
  }

  const chips = <T extends string | number>(all: T[], picked: T[], set: (v: T[]) => void) => (
    <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
      {all.map((v) => (
        <Chip
          key={String(v)}
          size="small"
          label={String(v)}
          color={picked.includes(v) ? 'primary' : 'default'}
          variant={picked.includes(v) ? 'filled' : 'outlined'}
          onClick={() => set(toggle(picked, v))}
        />
      ))}
    </Stack>
  )

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Typography component="h2" sx={{ fontWeight: 700 }}>
        Ask for AI challenges
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.65, display: 'block', mb: 2 }}>
        Starts the generator on GitHub with your choices. Each challenge must pass the same gates as a pull request (the
        reference solution is replayed in real Neovim). Leave a list empty to let it pick. A real run opens a pull request
        for you to review; it never publishes by itself.
      </Typography>
      <Stack sx={{ gap: 2 }}>
        <TextField
          label="How many"
          type="number"
          size="small"
          value={count}
          onChange={(e) => setCount(Math.min(20, Math.max(3, Math.round(Number(e.target.value)) || 3)))}
          slotProps={{ htmlInput: { min: 3, max: 20 } }}
          sx={{ maxWidth: 160 }}
          helperText="3 to 20"
        />
        <Box>
          <Typography variant="body2" sx={{ mb: 0.75 }}>
            Areas
          </Typography>
          {chips(AREAS, areas, setAreas)}
        </Box>
        <Box>
          <Typography variant="body2" sx={{ mb: 0.75 }}>
            Levels
          </Typography>
          {chips(LEVELS, levels, setLevels)}
        </Box>
        <Box>
          <Typography variant="body2" sx={{ mb: 0.75 }}>
            Languages (for refactor challenges)
          </Typography>
          {chips(LANGUAGES, languages, setLanguages)}
        </Box>
        <TextField
          label="Theme or idea (optional)"
          size="small"
          value={theme}
          onChange={(e) => setTheme(e.target.value.slice(0, 160))}
          placeholder="e.g. tabletop RPG notes, an invoicing service"
          helperText={`${theme.length}/160`}
        />
        <FormControlLabel
          control={<Switch checked={dryRun} onChange={(_, v) => setDryRun(v)} />}
          label={dryRun ? 'Dry run: check everything, publish nothing' : 'Real run: open a pull request with the results'}
        />
        <Box>
          <Button variant="contained" disabled={busy || !authConfig} onClick={() => void send()}>
            {busy ? 'Starting...' : dryRun ? 'Start a dry run' : 'Generate and open a PR'}
          </Button>
        </Box>
        {result && (
          <Alert severity={result.severity}>
            {result.text}{' '}
            {result.link && (
              <a href={result.link} target="_blank" rel="noreferrer noopener">
                Watch it on GitHub
              </a>
            )}
          </Alert>
        )}
      </Stack>
    </Paper>
  )
}
