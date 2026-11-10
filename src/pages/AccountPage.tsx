import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GitHubIcon from '@mui/icons-material/GitHub'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useAuthStore } from '../auth/authStore'
import { authConfig } from '../auth/config'
import { useClipboard } from '../hooks/useClipboard'

const issuerHost = authConfig ? new URL(authConfig.issuer).host : ''

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', pt: 4 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
        Account
      </Typography>
      {children}
    </Box>
  )
}

/** Sign in with GitHub through Keycloak. The site only ever shows a derived player code, never who you are. */
export function AccountPage() {
  const { status, userCode, results, error, login, logout } = useAuthStore()
  const { copy, copied } = useClipboard()

  if (status === 'off') {
    return (
      <Shell>
        <Alert severity="info" sx={{ mt: 2 }}>
          Sign-in is not set up on this build.
        </Alert>
      </Shell>
    )
  }

  if (status === 'loading') {
    return (
      <Shell>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mt: 3 }}>
          <CircularProgress size={20} />
          <Typography>Checking your session...</Typography>
        </Stack>
      </Shell>
    )
  }

  if (status === 'out') {
    return (
      <Shell>
        <Typography sx={{ opacity: 0.8, mb: 2, maxWidth: 620 }}>
          Sign in with GitHub to get a player code for the leaderboard. This site and its score service never receive your
          name, e-mail or GitHub account: the only thing you get back is a code derived from your login. GitHub sign-in itself
          is handled by the login server at {issuerHost}.
        </Typography>
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Button variant="contained" startIcon={<GitHubIcon />} onClick={() => void login()}>
          Sign in with GitHub
        </Button>
      </Shell>
    )
  }

  return (
    <Shell>
      <Typography sx={{ opacity: 0.8, mb: 2 }}>This is your player code. It is the only name the leaderboard shows.</Typography>
      <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography component="code" aria-label="Your player code" sx={{ fontSize: 28, fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'monospace' }}>
          {userCode}
        </Typography>
        <Button startIcon={<ContentCopyIcon />} onClick={() => userCode && void copy(userCode)}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </Paper>

      <Typography variant="h6" component="h2" sx={{ mt: 4, mb: 1, fontWeight: 700 }}>
        Your best results
      </Typography>
      {results.length === 0 ? (
        <Typography sx={{ opacity: 0.7 }}>Nothing on the board yet.</Typography>
      ) : (
        <Paper variant="outlined">
          {results.map((r, i) => (
            <Stack
              key={r.challenge}
              direction="row"
              sx={{ justifyContent: 'space-between', gap: 2, px: 2, py: 1, borderTop: i ? 1 : 0, borderColor: 'divider' }}
            >
              <Typography sx={{ fontFamily: 'monospace' }}>{r.challenge}</Typography>
              <Typography sx={{ opacity: 0.8 }}>
                {r.keys} keys · {seconds(r.ms)}
              </Typography>
            </Stack>
          ))}
        </Paper>
      )}

      <Button sx={{ mt: 4 }} color="inherit" onClick={() => void logout()}>
        Sign out
      </Button>
    </Shell>
  )
}
