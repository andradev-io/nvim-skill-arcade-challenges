import CheckIcon from '@mui/icons-material/Check'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GitHubIcon from '@mui/icons-material/GitHub'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { useAuthStore } from '../auth/authStore'
import type { Result } from '../auth/api'
import { authConfig } from '../auth/config'
import { useClipboard } from '../hooks/useClipboard'
import { useCommunity } from '../hooks/useCommunity'
import { navigate } from '../hooks/useRoute'

const issuerHost = authConfig ? new URL(authConfig.issuer).host : ''

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`
const prettify = (id: string) => id.replace(/-/g, ' ')

function Page({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <Box sx={{ maxWidth: narrow ? 560 : 1040, mx: 'auto', pt: { xs: 3, md: 5 } }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 3 }}>
        Account
      </Typography>
      {children}
    </Box>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 120 }}>
      <Typography variant="caption" sx={{ opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, mt: 0.5 }}>{value}</Typography>
    </Paper>
  )
}

function SignedOut({ error, login }: { error: string | null; login: () => void }) {
  return (
    <Page narrow>
      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
          Get a player code
        </Typography>
        <Typography sx={{ opacity: 0.8, mb: 2 }}>
          Sign in once and the leaderboard knows you by a short code, nothing else.
        </Typography>
        <Stack component="ul" sx={{ gap: 0.75, pl: 2.5, m: 0, mb: 3, opacity: 0.85 }}>
          <li>This site and its score service never receive your name, e-mail or GitHub account.</li>
          <li>The code is derived from your login: the same every time, and not traceable to you.</li>
          <li>GitHub sign-in is handled by the login server at {issuerHost}.</li>
        </Stack>
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Button variant="contained" size="large" startIcon={<GitHubIcon />} onClick={login}>
          Sign in with GitHub
        </Button>
      </Paper>
    </Page>
  )
}

function CodeCard({ code, onSignOut }: { code: string; onSignOut: () => void }) {
  const { copy, copied } = useClipboard()
  return (
    <Paper variant="outlined" sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, alignSelf: 'start' }}>
      <Typography variant="caption" sx={{ opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Your player code
      </Typography>
      <Typography
        component="code"
        aria-label="Your player code"
        sx={{ fontSize: { xs: 28, sm: 34 }, fontWeight: 800, letterSpacing: '0.1em', fontFamily: 'monospace', color: 'primary.main', lineHeight: 1.1 }}
      >
        {code}
      </Typography>
      <Button variant="outlined" startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />} onClick={() => void copy(code)} sx={{ alignSelf: 'start' }}>
        {copied ? 'Copied' : 'Copy code'}
      </Button>
      <Typography variant="body2" sx={{ opacity: 0.75 }}>
        It is the only name the leaderboard shows. It comes from your login and cannot be traced to your GitHub account.
      </Typography>
      <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
        <Button color="inherit" size="small" onClick={onSignOut} sx={{ opacity: 0.8 }}>
          Sign out
        </Button>
      </Box>
    </Paper>
  )
}

function Results({ results }: { results: Result[] }) {
  const community = useCommunity()
  const known = new Map((community.status === 'ready' ? community.items : []).map((c) => [c.id, c]))
  const fewest = results.length ? Math.min(...results.map((r) => r.keys)) : null
  const fastest = results.length ? Math.min(...results.map((r) => r.ms)) : null

  return (
    <Stack sx={{ gap: 2.5 }}>
      <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
        <Stat label="On the board" value={String(results.length)} />
        <Stat label="Fewest keys" value={fewest === null ? '–' : String(fewest)} />
        <Stat label="Fastest" value={fastest === null ? '–' : seconds(fastest)} />
      </Stack>

      <Paper variant="outlined">
        <Typography component="h2" sx={{ fontWeight: 700, px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          Your best results
        </Typography>
        {results.length === 0 ? (
          <Stack sx={{ p: 3, gap: 2, alignItems: 'start' }}>
            <Typography sx={{ opacity: 0.75 }}>
              Nothing on the board yet. Your best result for each challenge shows up here, fewest keys first, then time.
            </Typography>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={() => navigate('challenges')}>
                Browse challenges
              </Button>
              <Button variant="outlined" onClick={() => navigate('terminal')}>
                Open the terminal
              </Button>
            </Stack>
          </Stack>
        ) : (
          results.map((r, i) => {
            const c = known.get(r.challenge)
            return (
              <Stack
                key={r.challenge}
                direction="row"
                sx={{ alignItems: 'center', gap: 2, px: 2.5, py: 1.5, borderTop: i ? 1 : 0, borderColor: 'divider', flexWrap: 'wrap' }}
              >
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <Typography sx={{ fontWeight: 600, textTransform: c ? 'none' : 'capitalize' }}>{c?.title ?? prettify(r.challenge)}</Typography>
                  {c && (
                    <Stack direction="row" sx={{ gap: 0.5, mt: 0.5 }}>
                      <Chip size="small" variant="outlined" label={c.area} />
                      <Chip size="small" variant="outlined" label={`level ${c.level}`} />
                    </Stack>
                  )}
                </Box>
                <Typography sx={{ fontFamily: 'monospace' }}>
                  {r.keys} {r.keys === 1 ? 'key' : 'keys'} · {seconds(r.ms)}
                </Typography>
              </Stack>
            )
          })
        )}
      </Paper>
    </Stack>
  )
}

/** Sign in with GitHub through Keycloak. The site only ever shows a derived player code, never who you are. */
export function AccountPage() {
  const { status, userCode, results, error, login, logout } = useAuthStore()

  if (status === 'off') {
    return (
      <Page narrow>
        <Alert severity="info">Sign-in is not set up on this build.</Alert>
      </Page>
    )
  }

  if (status === 'loading') {
    return (
      <Page narrow>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
          <CircularProgress size={20} />
          <Typography>Checking your session...</Typography>
        </Stack>
      </Page>
    )
  }

  if (status === 'out' || !userCode) return <SignedOut error={error} login={() => void login()} />

  return (
    <Page>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'minmax(300px, 380px) 1fr' } }}>
        <CodeCard code={userCode} onSignOut={() => void logout()} />
        <Results results={results} />
      </Box>
    </Page>
  )
}
